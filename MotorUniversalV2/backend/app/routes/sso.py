"""
Blueprint /api/sso — API de Tokenización SSO de Evaluaasi (a nivel PLANTEL).

Endpoints:
  POST   /api/sso/generar_token                   — público, autenticado por API key del plantel
  GET    /api/sso/campuses/<id>/api-key           — info pública (prefix, fechas, share flag) (admin/coord/auxiliar/responsable)
  POST   /api/sso/campuses/<id>/api-key           — generar/rotar (SOLO admin/developer, requiere current_password)
  POST   /api/sso/campuses/<id>/api-key/reveal    — revela secreto (admin/coord/auxiliar; responsable si share)
  DELETE /api/sso/campuses/<id>/api-key           — revoca (SOLO admin/developer, requiere current_password)
  PATCH  /api/sso/campuses/<id>/share-api-key     — toggle share_api_key_with_responsable (admin/coord)
"""
from datetime import datetime
from typing import Optional

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.partner import Campus
from app.models.user import User
from app.services.sso_service import (
    upsert_candidate_from_sso,
    issue_sso_token,
    find_campus_by_api_key,
    SSO_TOKEN_TTL_MINUTES,
)
from app.utils.rate_limit import rate_limit, get_client_ip
from app.models.activity_log import log_activity


bp = Blueprint('sso', __name__)


# ════════════════════════════════════════════════════════════════════════════
# 1) Endpoint público: generar token SSO para un alumno (autenticado por apikey)
# ════════════════════════════════════════════════════════════════════════════

@bp.route('/generar_token', methods=['POST'])
@rate_limit(limit=120, window=60, key_prefix='rl_sso_gen')
def generar_token():
    """Recibe datos del alumno + apikey del plantel y retorna un token SSO.

    Acepta application/x-www-form-urlencoded y application/json (UTF-8).

    Respuesta éxito (200):
        { "error": false, "mensaje_error": "", "token": "<raw>" }

    Respuesta error (4xx):
        { "error": true, "mensajeError": "<mensaje>" }
    """
    payload = request.form if request.form else (request.get_json(silent=True) or {})

    apikey = (payload.get('apikey') or '').strip()
    matricula = (payload.get('matricula') or '').strip()
    nombre = (payload.get('nombre') or '').strip()
    apellido = (payload.get('apellido') or '').strip()
    programa = (payload.get('programa') or '').strip() or None
    email = (payload.get('email') or '').strip().lower() or None
    grupo_codigo = (payload.get('grupo_codigo') or '').strip() or None
    curp = (payload.get('curp') or '').strip().upper() or None

    missing = []
    if not apikey:
        missing.append('apikey')
    if not matricula:
        missing.append('matricula')
    if not nombre:
        missing.append('nombre')
    if not apellido:
        missing.append('apellido')
    if missing:
        return jsonify({
            'error': True,
            'mensajeError': f"Parámetros incompletos, favor de enviar por lo menos: {', '.join(missing)}",
        }), 400

    if email is not None:
        import re as _re
        if not _re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            return jsonify({'error': True, 'mensajeError': 'email con formato inválido'}), 400

    # CURP: si viene, validamos formato + entidad + dígito verificador. Si NO
    # pasa la validación, lo descartamos en silencio (no rompemos el alta) y
    # el candidato será solicitado a capturar su CURP por el flujo normal de
    # `requires_curp_validation`. Si la CURP es válida, se persiste y entra al
    # flujo RENAPO habitual.
    curp_invalid_reason: Optional[str] = None
    if curp is not None:
        from app.services.renapo_service import validate_curp_format, is_generic_foreign_curp
        if is_generic_foreign_curp(curp):
            # CURP genérica de extranjero — válida sin validación de checksum
            pass
        else:
            fmt_valid, fmt_error = validate_curp_format(curp)
            if not fmt_valid:
                curp_invalid_reason = fmt_error or 'CURP inválida'
                curp = None  # descartar y dejar que el candidato la capture luego

    campus = find_campus_by_api_key(apikey)
    if campus is None:
        return jsonify({'error': True, 'mensajeError': 'API key inválida o inactiva'}), 401
    if not campus.is_active:
        return jsonify({'error': True, 'mensajeError': 'Plantel inactivo'}), 403

    if len(matricula) > 80:
        return jsonify({'error': True, 'mensajeError': 'matricula excede 80 caracteres'}), 400
    if len(nombre) > 100 or len(apellido) > 200:
        return jsonify({'error': True, 'mensajeError': 'nombre o apellido exceden el largo permitido (nombre 100, apellido 200)'}), 400
    if grupo_codigo and len(grupo_codigo) > 50:
        return jsonify({'error': True, 'mensajeError': 'grupo_codigo excede 50 caracteres'}), 400

    if curp_invalid_reason:
        import logging
        logging.getLogger(__name__).warning(
            f'[SSO-GEN] CURP descartada para matricula={matricula} campus_id={campus.id}: {curp_invalid_reason}'
        )

    try:
        user = upsert_candidate_from_sso(
            campus=campus,
            matricula=matricula,
            nombre=nombre,
            apellido=apellido,
            programa=programa,
            email=email,
            grupo_codigo=grupo_codigo,
            curp=curp,
        )
    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f'[SSO-GEN] error upsert user: {e}')
        return jsonify({
            'error': True,
            'mensajeError': 'No fue posible registrar al alumno. Intenta de nuevo.',
        }), 500

    try:
        raw_token = issue_sso_token(user, campus, issuer_ip=get_client_ip())
    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f'[SSO-GEN] error issue token: {e}')
        return jsonify({
            'error': True,
            'mensajeError': 'No fue posible emitir el token SSO. Intenta de nuevo.',
        }), 500

    response_body = {
        'error': False,
        'mensaje_error': '',
        'token': raw_token,
    }
    if curp_invalid_reason:
        # Indicador no bloqueante para la integración de tercero: la CURP
        # enviada fue ignorada y se solicitará al candidato en plataforma.
        response_body['curp_warning'] = f'CURP ignorada: {curp_invalid_reason}. Será solicitada al candidato.'
    return jsonify(response_body), 200


# ════════════════════════════════════════════════════════════════════════════
# 2) Gestión de la API key del plantel
# ════════════════════════════════════════════════════════════════════════════

def _can_rotate_api_key(user: User) -> bool:
    """Generar/rotar/revocar la API key. RESERVADO a admin / developer.

    Política de seguridad: la rotación/revocación de credenciales SSO está
    restringida al equipo de administración del producto. Los coordinadores
    pueden revelar la llave, configurar el share flag y solicitar rotación,
    pero no ejecutar la rotación directamente.
    """
    return bool(user and user.role in ('admin', 'developer'))


def _can_configure_share(user: User, campus: Campus) -> bool:
    """Toggle share_api_key_with_responsable. admin / coordinador del plantel."""
    if not user:
        return False
    if user.role in ('admin', 'developer'):
        return True
    if user.role == 'coordinator' and campus.coordinator_id == user.id:
        return True
    return False


def _can_view_api_key_metadata(user: User, campus: Campus) -> bool:
    """Ver metadata (prefix, fecha, share flag). admin, coordinador del plantel,
    auxiliar del coordinador y responsable del plantel."""
    if not user:
        return False
    if user.role in ('admin', 'developer'):
        return True
    if user.role == 'coordinator' and campus.coordinator_id == user.id:
        return True
    if (
        user.role == 'auxiliar'
        and campus.coordinator_id
        and user.coordinator_id == campus.coordinator_id
    ):
        return True
    if user.role in ('responsable', 'responsable_partner', 'responsable_estatal') and campus.responsable_id == user.id:
        return True
    return False


def _can_reveal_api_key(user: User, campus: Campus) -> bool:
    """Revelar el secreto. admin/coord siempre. Auxiliar del coordinador del
    plantel también (igual que el coord). Responsable del plantel solo si
    campus.share_api_key_with_responsable está en True."""
    if not user:
        return False
    if user.role in ('admin', 'developer'):
        return True
    if user.role == 'coordinator' and campus.coordinator_id == user.id:
        return True
    if (
        user.role == 'auxiliar'
        and campus.coordinator_id
        and user.coordinator_id == campus.coordinator_id
    ):
        return True
    if (
        user.role in ('responsable', 'responsable_partner', 'responsable_estatal')
        and campus.responsable_id == user.id
        and bool(campus.share_api_key_with_responsable)
    ):
        return True
    return False


def _api_key_info(campus: Campus) -> dict:
    return {
        'campus_id': campus.id,
        'has_key': bool(campus.api_key_hash and campus.api_key_active),
        'api_key_prefix': campus.api_key_prefix if campus.api_key_active else None,
        'api_key_active': bool(campus.api_key_active),
        'api_key_created_at': campus.api_key_created_at.isoformat() if campus.api_key_created_at else None,
        'api_key_created_by': campus.api_key_created_by,
        'share_api_key_with_responsable': bool(campus.share_api_key_with_responsable),
        'token_ttl_minutes': SSO_TOKEN_TTL_MINUTES,
    }


@bp.route('/campuses/<int:campus_id>/api-key', methods=['GET'])
@jwt_required()
def get_campus_api_key_info(campus_id: int):
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_view_api_key_metadata(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    return jsonify(_api_key_info(campus)), 200


@bp.route('/campuses/<int:campus_id>/api-key', methods=['POST'])
@jwt_required()
@rate_limit(limit=5, window=60, key_prefix='rl_sso_rotate')
def create_campus_api_key(campus_id: int):
    """Genera (o rota) la API key del plantel. Devuelve el secreto en claro.

    Requiere step-up auth: el admin debe reenviar su contraseña en el body
    como `current_password`. Solo admin / developer pueden ejecutar esta acción.
    """
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_rotate_api_key(current_user):
        return jsonify({
            'error': 'No autorizado',
            'detail': 'Solo un administrador puede generar o rotar la API key del plantel.',
        }), 403

    payload = request.get_json(silent=True) or {}
    current_password = (payload.get('current_password') or '').strip()
    if not current_password:
        return jsonify({
            'error': 'password_required',
            'detail': 'Debes confirmar tu contraseña para rotar la API key.',
        }), 401
    if not current_user.check_password(current_password):
        log_activity(
            user=current_user,
            action_type='sso_api_key_rotate_denied',
            entity_type='campus',
            entity_id=campus.id,
            entity_name=campus.name,
            details={'reason': 'invalid_password'},
            ip_address=get_client_ip(),
            success=False,
            error_message='Contraseña incorrecta',
        )
        db.session.commit()
        return jsonify({
            'error': 'password_incorrect',
            'detail': 'La contraseña no es correcta.',
        }), 401

    raw_key = campus.generate_api_key(created_by_user_id=current_user.id)
    log_activity(
        user=current_user,
        action_type='sso_api_key_rotated',
        entity_type='campus',
        entity_id=campus.id,
        entity_name=campus.name,
        details={'api_key_prefix': campus.api_key_prefix},
        ip_address=get_client_ip(),
        success=True,
    )
    db.session.commit()

    info = _api_key_info(campus)
    info['api_key'] = raw_key  # secreto en claro
    info['warning'] = 'Guarda esta API key. Después solo podrás revelarla mientras esté activa.'
    return jsonify(info), 201


@bp.route('/campuses/<int:campus_id>/api-key/reveal', methods=['POST'])
@jwt_required()
@rate_limit(limit=20, window=60, key_prefix='rl_sso_reveal')
def reveal_campus_api_key(campus_id: int):
    """Revela el secreto. admin/coord siempre; responsable solo si share flag."""
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_reveal_api_key(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    if not campus.api_key_active or not campus.api_key_encrypted:
        return jsonify({'error': 'Este plantel no tiene API key activa'}), 404

    raw = campus.reveal_api_key()
    if not raw:
        return jsonify({'error': 'No se pudo descifrar la API key'}), 500

    info = _api_key_info(campus)
    info['api_key'] = raw
    return jsonify(info), 200


@bp.route('/campuses/<int:campus_id>/api-key', methods=['DELETE'])
@jwt_required()
@rate_limit(limit=5, window=60, key_prefix='rl_sso_revoke')
def revoke_campus_api_key(campus_id: int):
    """Revoca la API key del plantel. Solo admin / developer.

    Requiere step-up auth: reenviar `current_password` en el body JSON.
    """
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_rotate_api_key(current_user):
        return jsonify({
            'error': 'No autorizado',
            'detail': 'Solo un administrador puede revocar la API key del plantel.',
        }), 403

    payload = request.get_json(silent=True) or {}
    current_password = (payload.get('current_password') or '').strip()
    if not current_password:
        return jsonify({
            'error': 'password_required',
            'detail': 'Debes confirmar tu contraseña para revocar la API key.',
        }), 401
    if not current_user.check_password(current_password):
        log_activity(
            user=current_user,
            action_type='sso_api_key_revoke_denied',
            entity_type='campus',
            entity_id=campus.id,
            entity_name=campus.name,
            details={'reason': 'invalid_password'},
            ip_address=get_client_ip(),
            success=False,
            error_message='Contraseña incorrecta',
        )
        db.session.commit()
        return jsonify({
            'error': 'password_incorrect',
            'detail': 'La contraseña no es correcta.',
        }), 401

    campus.revoke_api_key()
    log_activity(
        user=current_user,
        action_type='sso_api_key_revoked',
        entity_type='campus',
        entity_id=campus.id,
        entity_name=campus.name,
        ip_address=get_client_ip(),
        success=True,
    )
    db.session.commit()
    return jsonify({'message': 'API key revocada', 'campus_id': campus.id}), 200


@bp.route('/campuses/<int:campus_id>/share-api-key', methods=['PATCH'])
@jwt_required()
def toggle_share_api_key(campus_id: int):
    """Alterna si el responsable del plantel puede revelar la API key."""
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_configure_share(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    payload = request.get_json(silent=True) or {}
    share = bool(payload.get('share'))
    campus.share_api_key_with_responsable = share
    db.session.commit()
    return jsonify(_api_key_info(campus)), 200
