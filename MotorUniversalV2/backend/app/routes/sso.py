"""
Blueprint /api/sso — API de Tokenización SSO de Evaluaasi (a nivel PLANTEL).

Contrato POST /api/sso/generar_token (mayo 2026):
  Obligatorios: apikey, matricula, nombre, apellido
  Opcionales:   email, curp, grupo

  - `grupo` (opcional, ≤50): si se envía y existe un CandidateGroup con ese
    código dentro del plantel, liga al alumno. Si no existe, el grupo se
    crea automáticamente. Si no se envía, se liga al grupo más reciente del
    plantel; si el plantel no tiene grupos, se crea uno por defecto
    `"Grupo <nombre_plantel>"` y se liga.
  - Campos legacy `programa` y `grupo_codigo` ya no se aceptan: si llegan
    se responde 400 para forzar la migración del integrador.

Endpoints:
  POST   /api/sso/generar_token                   — público, autenticado por API key del plantel
  GET    /api/sso/campuses/<id>/api-key           — info pública (prefix, fechas, share flag) (admin/coord/auxiliar/responsable)
  POST   /api/sso/campuses/<id>/api-key           — generar/rotar (SOLO admin/developer, requiere current_password)
  POST   /api/sso/campuses/<id>/api-key/reveal    — revela secreto (admin/coord/auxiliar; responsable si share)
  DELETE /api/sso/campuses/<id>/api-key           — revoca (SOLO admin/developer, requiere current_password)
  PATCH  /api/sso/campuses/<id>/share-api-key     — toggle share_api_key_with_responsable (admin/coord)
  PATCH  /api/sso/campuses/<id>/enable-sso-api    — toggle enable_sso_api (admin/coord/aux/responsable). Auto-genera la llave si no existe.
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
    find_campus_and_api_key,
    apply_api_key_assignments,
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

    # Campos legacy ya removidos del contrato público. Si llegan, rechazamos
    # para que el integrador detecte la migración (estamos en fase de
    # desarrollo, sin terceros productivos aún).
    legacy_fields = [k for k in ('programa', 'grupo_codigo') if k in payload]
    if legacy_fields:
        return jsonify({
            'error': True,
            'mensajeError': (
                f"Campos no soportados: {', '.join(legacy_fields)}. "
                "Usa 'grupo' (opcional) en lugar de 'grupo_codigo'. El campo "
                "'programa' fue eliminado del contrato SSO."
            ),
        }), 400

    apikey = (payload.get('apikey') or '').strip()
    matricula = (payload.get('matricula') or '').strip()
    nombre = (payload.get('nombre') or '').strip()
    apellido = (payload.get('apellido') or '').strip()
    email = (payload.get('email') or '').strip().lower() or None
    grupo = (payload.get('grupo') or '').strip() or None
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

    campus, api_key_row = find_campus_and_api_key(apikey)
    if campus is None:
        return jsonify({'error': True, 'mensajeError': 'API key inválida o inactiva'}), 401
    if not campus.is_active:
        return jsonify({'error': True, 'mensajeError': 'Plantel inactivo'}), 403
    if not bool(getattr(campus, 'enable_sso_api', False)):
        # Módulo SSO apagado a nivel plantel: la llave existe pero no acepta
        # llamadas hasta que se vuelva a encender el flag desde el panel.
        return jsonify({'error': True, 'mensajeError': 'Módulo SSO deshabilitado para este plantel'}), 403

    if len(matricula) > 80:
        return jsonify({'error': True, 'mensajeError': 'matricula excede 80 caracteres'}), 400
    if len(nombre) > 100 or len(apellido) > 200:
        return jsonify({'error': True, 'mensajeError': 'nombre o apellido exceden el largo permitido (nombre 100, apellido 200)'}), 400
    if grupo and len(grupo) > 50:
        return jsonify({'error': True, 'mensajeError': 'grupo excede 50 caracteres'}), 400

    if curp_invalid_reason:
        import logging
        logging.getLogger(__name__).warning(
            f'[SSO-GEN] CURP descartada para matricula={matricula} campus_id={campus.id}: {curp_invalid_reason}'
        )

    try:
        user, resolved_group = upsert_candidate_from_sso(
            campus=campus,
            matricula=matricula,
            nombre=nombre,
            apellido=apellido,
            email=email,
            grupo=grupo,
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

    # Tracking + materialización de plantillas de asignación (api keys nuevas)
    if api_key_row is not None:
        try:
            api_key_row.touch_usage(get_client_ip())
            db.session.commit()
        except Exception:
            db.session.rollback()
        if resolved_group is not None:
            try:
                apply_api_key_assignments(api_key_row, user, resolved_group)
            except Exception as e:
                db.session.rollback()
                import logging
                logging.getLogger(__name__).warning(
                    f'[SSO-GEN] no se pudieron materializar plantillas api_key={api_key_row.id}: {e}'
                )

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
    tiene el permiso `can_manage_groups` (mismo permiso que habilita la
    gestión de grupos del plantel — incluye acceso a la API key SSO)."""
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
        and bool(getattr(user, 'can_manage_groups', False))
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
        'enable_sso_api': bool(getattr(campus, 'enable_sso_api', False)),
        'token_ttl_minutes': SSO_TOKEN_TTL_MINUTES,
    }


def _can_toggle_sso_api(user: User, campus: Campus) -> bool:
    """Activar/desactivar el módulo SSO API del plantel. admin/dev,
    coordinador del plantel, auxiliar del coordinador y responsable del
    plantel pueden hacerlo. Al activar, si no existe llave se auto-genera.
    """
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
    ):
        return True
    return False


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
    """Revela el secreto. admin/coord siempre; responsable solo si share flag.

    No requiere step-up: el usuario ya está autenticado vía JWT y este endpoint
    solo MUESTRA el secreto (no muta nada). La acción se registra en la
    bitácora para auditoría.
    """
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_reveal_api_key(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    if not campus.api_key_active or not campus.api_key_encrypted:
        return jsonify({'error': 'Este plantel no tiene API key activa'}), 404
    if not bool(getattr(campus, 'enable_sso_api', False)):
        return jsonify({'error': 'Módulo SSO deshabilitado para este plantel'}), 403

    raw = campus.reveal_api_key()
    if not raw:
        return jsonify({'error': 'No se pudo descifrar la API key'}), 500

    log_activity(
        user=current_user,
        action_type='sso_api_key_revealed',
        entity_type='campus',
        entity_id=campus.id,
        entity_name=campus.name,
        details={'api_key_prefix': campus.api_key_prefix},
        ip_address=get_client_ip(),
        success=True,
    )
    db.session.commit()

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


@bp.route('/campuses/<int:campus_id>/enable-sso-api', methods=['PATCH'])
@jwt_required()
@rate_limit(limit=20, window=60, key_prefix='rl_sso_toggle')
def toggle_enable_sso_api(campus_id: int):
    """Activa o desactiva el módulo SSO API para el plantel.

    - Permitido: admin/developer, coordinador del plantel, auxiliar del
      coordinador y responsable del plantel.
    - Al ACTIVAR: si no existe llave, se auto-genera silenciosamente y se
      devuelve UNA sola vez en el campo `api_key`. Si ya existe, solo se
      enciende el flag y la llave previa sigue siendo válida.
    - Al DESACTIVAR: solo se apaga el flag. La llave se conserva en BD,
      pero `/api/sso/generar_token` y `/reveal` rechazarán las llamadas
      hasta que se vuelva a activar.

    Body JSON: { "enabled": true | false }
    """
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_toggle_sso_api(current_user, campus):
        return jsonify({
            'error': 'No autorizado',
            'detail': 'Solo admin, coordinador, auxiliar o responsable del plantel pueden cambiar este flag.',
        }), 403

    payload = request.get_json(silent=True) or {}
    if 'enabled' not in payload:
        return jsonify({'error': 'enabled requerido (true|false)'}), 400
    enabled = bool(payload.get('enabled'))

    raw_key = campus.set_sso_module_enabled(enabled, user_id=current_user.id)
    auto_generated = raw_key is not None
    action = 'sso_api_enabled' if enabled else 'sso_api_disabled'

    log_activity(
        user=current_user,
        action_type=action,
        entity_type='campus',
        entity_id=campus.id,
        entity_name=campus.name,
        details={'auto_generated_api_key': auto_generated},
        ip_address=get_client_ip(),
        success=True,
    )
    db.session.commit()

    info = _api_key_info(campus)
    if raw_key:
        info['api_key'] = raw_key
        info['warning'] = 'Guarda esta API key. Después solo podrás revelarla mientras el módulo esté activo.'
    return jsonify(info), 200


# ════════════════════════════════════════════════════════════════════════════
# 3) Multi-API-keys por plantel (mayo 2026)
# ════════════════════════════════════════════════════════════════════════════
from app.models.campus_api_key import CampusApiKey, CampusApiKeyAssignment
from app.models.exam import Exam


def _can_manage_api_keys(user: User, campus: Campus) -> bool:
    """Crear / rotar / revocar / configurar plantillas: admin, coordinador del
    plantel y auxiliar de ese coordinador. Responsables NO pueden crear.
    """
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
    return False


def _resolve_campus_coordinator_id(campus: Campus):
    """Resuelve el coordinador efectivo de un plantel.

    1) `campus.coordinator_id` directo, si existe.
    2) Caso contrario, hereda del `partner.coordinator_id` del plantel.
    Devuelve None si no se puede resolver.
    """
    coord_id = getattr(campus, 'coordinator_id', None)
    if coord_id:
        return coord_id
    partner_id = getattr(campus, 'partner_id', None)
    if partner_id:
        from app.models.partner import Partner
        partner = Partner.query.get(partner_id)
        if partner:
            return getattr(partner, 'coordinator_id', None)
    return None


def _can_create_api_key(user: User, campus: Campus) -> bool:
    """Permiso específico para CREAR una api key del plantel.

    Más permisivo que `_can_manage_api_keys`: además del coordinador
    asignado directamente al campus, también acepta al coordinador del
    partner padre (campus que heredan coord vía partner). También
    incluye al auxiliar de cualquiera de esos coordinadores. NO afecta
    rotate / revoke / configure (esos siguen usando `_can_manage_api_keys`).
    """
    if not user:
        return False
    if user.role in ('admin', 'developer'):
        return True
    resolved_coord_id = _resolve_campus_coordinator_id(campus)
    if not resolved_coord_id:
        return False
    if user.role == 'coordinator' and resolved_coord_id == user.id:
        return True
    if user.role == 'auxiliar' and user.coordinator_id == resolved_coord_id:
        return True
    return False


def _can_read_api_keys(user: User, campus: Campus) -> bool:
    """Listar api keys: misma regla que ver metadata (incluye responsable)."""
    return _can_view_api_key_metadata(user, campus)


def _can_reveal_api_key_row(user: User, campus: Campus) -> bool:
    """Revelar el secreto de una api key específica (mismo criterio que la
    función existente para la api key 1:1)."""
    return _can_reveal_api_key(user, campus)


def _verify_step_up(user: User, payload: dict, action: str, campus: Campus) -> Optional[tuple]:
    """Devuelve None si la contraseña es correcta; tupla (status, body) si no."""
    current_password = (payload.get('current_password') or '').strip()
    if not current_password:
        return 401, {
            'error': 'password_required',
            'detail': 'Debes confirmar tu contraseña para esta acción.',
        }
    if not user.check_password(current_password):
        log_activity(
            user=user,
            action_type=f'sso_apikey_{action}_denied',
            entity_type='campus',
            entity_id=campus.id,
            entity_name=campus.name,
            details={'reason': 'invalid_password'},
            ip_address=get_client_ip(),
            success=False,
            error_message='Contraseña incorrecta',
        )
        db.session.commit()
        return 401, {
            'error': 'password_incorrect',
            'detail': 'La contraseña no es correcta.',
        }
    return None


def _parse_assignment_payload(data: dict) -> dict:
    """Convierte el payload JSON del wizard en kwargs para CampusApiKeyAssignment.

    El payload sigue el mismo contrato que `/api/groups/<id>/exams` (assign
    exam wizard). NO persiste: devuelve kwargs.
    """
    from dateutil.parser import isoparse

    def _opt_int(v):
        try:
            return int(v) if v not in (None, '', 'null') else None
        except Exception:
            return None

    def _opt_dt(v):
        if not v:
            return None
        try:
            return isoparse(v) if isinstance(v, str) else v
        except Exception:
            return None

    exam_id = _opt_int(data.get('exam_id'))
    if not exam_id:
        raise ValueError('exam_id requerido')

    assignment_type = (data.get('assignment_type') or 'all').lower()
    if assignment_type not in ('all', 'selected'):
        assignment_type = 'all'

    members = data.get('member_ids') or data.get('members') or []
    if not isinstance(members, list):
        members = []
    materials = data.get('material_ids') or data.get('materials') or []
    if not isinstance(materials, list):
        materials = []

    return {
        'exam_id': exam_id,
        'assignment_type': assignment_type,
        'available_from': _opt_dt(data.get('available_from')),
        'available_until': _opt_dt(data.get('available_until')),
        'time_limit_minutes': _opt_int(data.get('time_limit_minutes')),
        'passing_score': _opt_int(data.get('passing_score')),
        'max_attempts': _opt_int(data.get('max_attempts')) or 1,
        'max_disconnections': _opt_int(data.get('max_disconnections')) or 3,
        'exam_content_type': (data.get('exam_content_type') or 'questions_only'),
        'exam_questions_count': _opt_int(data.get('exam_questions_count')),
        'exam_exercises_count': _opt_int(data.get('exam_exercises_count')),
        'simulator_questions_count': _opt_int(data.get('simulator_questions_count')),
        'simulator_exercises_count': _opt_int(data.get('simulator_exercises_count')),
        'security_pin': (data.get('security_pin') or None),
        'require_security_pin': bool(data.get('require_security_pin')),
        'validity_months': _opt_int(data.get('validity_months')),
        'certificate_type': _normalize_cert_type(data.get('certificate_type')),
        '_members': [str(m) for m in members if m],
        '_materials': [int(m) for m in materials if str(m).isdigit()],
    }


def _normalize_cert_type(value) -> str:
    """Normaliza certificate_type. Default 'eduit' (no requiere CURP).

    Valores aceptados: 'conocer', 'eduit', 'badge', 'none'. Solo 'conocer'
    fuerza la validación de CURP del candidato al entrar por SSO.
    """
    v = (str(value or '').strip().lower())
    if v in ('conocer', 'eduit', 'badge', 'none'):
        return v
    return 'eduit'


def _sanitize_pin_for_campus(parsed: dict, campus) -> dict:
    """Si el plantel no tiene `require_exam_pin` activado, anula los campos
    de PIN en la plantilla. El PIN diario lo emite el plantel; cuando está
    deshabilitado, no tiene sentido aceptarlo en la api key.
    """
    if not getattr(campus, 'require_exam_pin', False):
        parsed['security_pin'] = None
        parsed['require_security_pin'] = False
    return parsed


# ── Listado / detalle ──────────────────────────────────────────────────

@bp.route('/campuses/<int:campus_id>/api-keys', methods=['GET'])
@jwt_required()
def list_campus_api_keys(campus_id: int):
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_read_api_keys(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    rows = (
        CampusApiKey.query
        .filter_by(campus_id=campus.id)
        .order_by(CampusApiKey.is_active.desc(), CampusApiKey.created_at.desc())
        .all()
    )
    return jsonify({
        'campus_id': campus.id,
        'enable_sso_api': bool(getattr(campus, 'enable_sso_api', False)),
        'token_ttl_minutes': SSO_TOKEN_TTL_MINUTES,
        'api_keys': [r.to_dict(include_creator=True) for r in rows],
    }), 200


@bp.route('/api-keys/<int:key_id>', methods=['GET'])
@jwt_required()
def get_api_key_detail(key_id: int):
    current_user = User.query.get(get_jwt_identity())
    ak = CampusApiKey.query.get_or_404(key_id)
    campus = Campus.query.get_or_404(ak.campus_id)
    if not _can_read_api_keys(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    return jsonify(ak.to_dict(include_assignments=True, include_creator=True)), 200


# ── Crear (con plantilla inicial opcional) ─────────────────────────────

@bp.route('/campuses/<int:campus_id>/api-keys', methods=['POST'])
@jwt_required()
@rate_limit(limit=10, window=60, key_prefix='rl_sso_capi_create')
def create_campus_api_key_v2(campus_id: int):
    """Crea una nueva api key para el plantel.

    Body:
      - current_password (step-up, requerido)
      - description (string, requerido)
      - name (string, opcional)
      - assignment (dict, opcional): plantilla inicial (mismo schema que
        `/groups/<id>/exams`). Si se envía, se crea la primera plantilla
        adjunta. Si no, la api key queda sin plantillas (se pueden agregar
        después vía /api-keys/<id>/assignments).
    """
    current_user = User.query.get(get_jwt_identity())
    campus = Campus.query.get_or_404(campus_id)
    if not _can_create_api_key(current_user, campus):
        return jsonify({
            'error': 'No autorizado',
            'detail': 'Solo admin, coordinador del plantel/partner o auxiliar pueden crear api keys.',
        }), 403

    payload = request.get_json(silent=True) or {}
    err = _verify_step_up(current_user, payload, 'create', campus)
    if err:
        return jsonify(err[1]), err[0]

    description = (payload.get('description') or '').strip()
    if not description:
        return jsonify({'error': 'description requerida'}), 400
    name = (payload.get('name') or '').strip() or None

    assignment_data = payload.get('assignment')
    parsed = None
    if assignment_data:
        try:
            parsed = _parse_assignment_payload(assignment_data)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        _sanitize_pin_for_campus(parsed, campus)
        # Validar que el exam existe
        if not Exam.query.get(parsed['exam_id']):
            return jsonify({'error': f"Examen {parsed['exam_id']} no encontrado"}), 404

    # Crear key
    ak = CampusApiKey(
        campus_id=campus.id,
        description=description,
        name=name,
        is_active=True,
        is_legacy=False,
        created_by_id=current_user.id,
    )
    raw = CampusApiKey.generate_raw()
    ak.set_secret(raw)
    db.session.add(ak)
    db.session.flush()

    if parsed:
        members = parsed.pop('_members', [])
        materials = parsed.pop('_materials', [])
        assignment = CampusApiKeyAssignment(api_key_id=ak.id, **parsed)
        assignment.members = members
        assignment.materials = materials
        db.session.add(assignment)

    log_activity(
        user=current_user,
        action_type='sso_apikey_created',
        entity_type='campus',
        entity_id=campus.id,
        entity_name=campus.name,
        details={'api_key_id': ak.id, 'prefix': ak.api_key_prefix, 'description': description},
        ip_address=get_client_ip(),
        success=True,
    )
    db.session.commit()

    data = ak.to_dict(include_assignments=True, include_creator=True)
    data['api_key'] = raw  # secreto en claro, solo se devuelve UNA vez
    data['warning'] = 'Guarda esta API key. Después solo podrás revelarla mientras esté activa.'
    return jsonify(data), 201


# ── Reveal / Rotate / Revoke / Toggle ───────────────────────────────────

@bp.route('/api-keys/<int:key_id>/reveal', methods=['POST'])
@jwt_required()
@rate_limit(limit=20, window=60, key_prefix='rl_sso_capi_reveal')
def reveal_api_key(key_id: int):
    current_user = User.query.get(get_jwt_identity())
    ak = CampusApiKey.query.get_or_404(key_id)
    campus = Campus.query.get_or_404(ak.campus_id)
    if not _can_reveal_api_key_row(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    if not ak.is_active:
        return jsonify({'error': 'API key inactiva'}), 404
    if not bool(getattr(campus, 'enable_sso_api', False)):
        return jsonify({'error': 'Módulo SSO deshabilitado para este plantel'}), 403
    raw = ak.reveal()
    if not raw:
        return jsonify({'error': 'No se pudo descifrar la API key'}), 500
    log_activity(
        user=current_user,
        action_type='sso_apikey_revealed',
        entity_type='campus',
        entity_id=campus.id,
        entity_name=campus.name,
        details={'api_key_id': ak.id, 'prefix': ak.api_key_prefix},
        ip_address=get_client_ip(),
        success=True,
    )
    db.session.commit()
    data = ak.to_dict()
    data['api_key'] = raw
    return jsonify(data), 200


@bp.route('/api-keys/<int:key_id>/rotate', methods=['POST'])
@jwt_required()
@rate_limit(limit=5, window=60, key_prefix='rl_sso_capi_rotate')
def rotate_api_key(key_id: int):
    current_user = User.query.get(get_jwt_identity())
    ak = CampusApiKey.query.get_or_404(key_id)
    campus = Campus.query.get_or_404(ak.campus_id)
    if not _can_manage_api_keys(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    payload = request.get_json(silent=True) or {}
    err = _verify_step_up(current_user, payload, 'rotate', campus)
    if err:
        return jsonify(err[1]), err[0]
    raw = ak.rotate()
    ak.is_active = True
    log_activity(
        user=current_user,
        action_type='sso_apikey_rotated',
        entity_type='campus',
        entity_id=campus.id,
        entity_name=campus.name,
        details={'api_key_id': ak.id, 'prefix': ak.api_key_prefix},
        ip_address=get_client_ip(),
        success=True,
    )
    db.session.commit()
    data = ak.to_dict(include_assignments=True)
    data['api_key'] = raw
    data['warning'] = 'Guarda esta API key. Después solo podrás revelarla mientras esté activa.'
    return jsonify(data), 200


@bp.route('/api-keys/<int:key_id>', methods=['DELETE'])
@jwt_required()
@rate_limit(limit=5, window=60, key_prefix='rl_sso_capi_revoke')
def revoke_api_key(key_id: int):
    current_user = User.query.get(get_jwt_identity())
    ak = CampusApiKey.query.get_or_404(key_id)
    campus = Campus.query.get_or_404(ak.campus_id)
    if not _can_manage_api_keys(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    payload = request.get_json(silent=True) or {}
    err = _verify_step_up(current_user, payload, 'revoke', campus)
    if err:
        return jsonify(err[1]), err[0]
    ak.revoke()
    log_activity(
        user=current_user,
        action_type='sso_apikey_revoked',
        entity_type='campus',
        entity_id=campus.id,
        entity_name=campus.name,
        details={'api_key_id': ak.id, 'prefix': ak.api_key_prefix},
        ip_address=get_client_ip(),
        success=True,
    )
    db.session.commit()
    return jsonify({'message': 'API key revocada', 'api_key_id': ak.id}), 200


@bp.route('/api-keys/<int:key_id>', methods=['PATCH'])
@jwt_required()
def update_api_key(key_id: int):
    """Edita description / name / is_active. Sin step-up para metadata."""
    current_user = User.query.get(get_jwt_identity())
    ak = CampusApiKey.query.get_or_404(key_id)
    campus = Campus.query.get_or_404(ak.campus_id)
    if not _can_manage_api_keys(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    payload = request.get_json(silent=True) or {}
    if 'description' in payload:
        desc = (payload.get('description') or '').strip()
        if not desc:
            return jsonify({'error': 'description no puede ser vacía'}), 400
        ak.description = desc
    if 'name' in payload:
        ak.name = (payload.get('name') or '').strip() or None
    if 'is_active' in payload:
        ak.is_active = bool(payload.get('is_active'))
    db.session.commit()
    return jsonify(ak.to_dict(include_assignments=True)), 200


# ── Gestión de plantillas de asignación ────────────────────────────────

@bp.route('/api-keys/<int:key_id>/assignments', methods=['POST'])
@jwt_required()
def add_api_key_assignment(key_id: int):
    """Agrega un examen a la api key (con su config completa)."""
    current_user = User.query.get(get_jwt_identity())
    ak = CampusApiKey.query.get_or_404(key_id)
    campus = Campus.query.get_or_404(ak.campus_id)
    if not _can_manage_api_keys(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    if ak.is_legacy:
        return jsonify({'error': 'No se pueden agregar plantillas a una api key legacy'}), 400
    payload = request.get_json(silent=True) or {}
    try:
        parsed = _parse_assignment_payload(payload)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    _sanitize_pin_for_campus(parsed, campus)
    if not Exam.query.get(parsed['exam_id']):
        return jsonify({'error': f"Examen {parsed['exam_id']} no encontrado"}), 404
    existing = CampusApiKeyAssignment.query.filter_by(
        api_key_id=ak.id, exam_id=parsed['exam_id']
    ).first()
    if existing:
        return jsonify({
            'error': 'Este examen ya está asignado a la api key. Edítalo en su lugar.',
            'assignment_id': existing.id,
        }), 409
    members = parsed.pop('_members', [])
    materials = parsed.pop('_materials', [])
    a = CampusApiKeyAssignment(api_key_id=ak.id, **parsed)
    a.members = members
    a.materials = materials
    db.session.add(a)
    db.session.commit()
    return jsonify(a.to_dict(include_exam=True)), 201


@bp.route('/api-keys/<int:key_id>/assignments/<int:assignment_id>', methods=['PUT'])
@jwt_required()
def update_api_key_assignment(key_id: int, assignment_id: int):
    current_user = User.query.get(get_jwt_identity())
    ak = CampusApiKey.query.get_or_404(key_id)
    campus = Campus.query.get_or_404(ak.campus_id)
    if not _can_manage_api_keys(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    a = CampusApiKeyAssignment.query.filter_by(id=assignment_id, api_key_id=ak.id).first_or_404()
    payload = request.get_json(silent=True) or {}
    # Permitimos editar todos los campos del snapshot, excepto exam_id (si
    # quieren cambiar el examen mejor borran y crean otra plantilla).
    payload['exam_id'] = a.exam_id
    try:
        parsed = _parse_assignment_payload(payload)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    _sanitize_pin_for_campus(parsed, campus)
    members = parsed.pop('_members', [])
    materials = parsed.pop('_materials', [])
    parsed.pop('exam_id', None)
    for k, v in parsed.items():
        setattr(a, k, v)
    a.members = members
    a.materials = materials
    db.session.commit()
    return jsonify(a.to_dict(include_exam=True)), 200


@bp.route('/api-keys/<int:key_id>/assignments/<int:assignment_id>', methods=['DELETE'])
@jwt_required()
def delete_api_key_assignment(key_id: int, assignment_id: int):
    current_user = User.query.get(get_jwt_identity())
    ak = CampusApiKey.query.get_or_404(key_id)
    campus = Campus.query.get_or_404(ak.campus_id)
    if not _can_manage_api_keys(current_user, campus):
        return jsonify({'error': 'No autorizado'}), 403
    a = CampusApiKeyAssignment.query.filter_by(id=assignment_id, api_key_id=ak.id).first_or_404()
    db.session.delete(a)
    db.session.commit()
    return jsonify({'message': 'Plantilla eliminada', 'assignment_id': assignment_id}), 200
