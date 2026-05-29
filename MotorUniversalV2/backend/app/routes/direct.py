"""
Modelo Directo (B2C) — Catálogo público + Checkout self-service.

Endpoints públicos (sin JWT):
    GET  /api/direct/catalog                 — lista de exámenes con is_public_catalog=True
    GET  /api/direct/catalog/<exam_id>       — detalle de un examen del catálogo
    POST /api/direct/checkout                — crea cuenta (si email es nuevo) +
                                               Payment pendiente + preferencia MP

Endpoint con JWT:
    GET  /api/direct/my-purchases            — lista de pagos directos del usuario

Reglas de negocio:
    - Solo aparecen exámenes con is_public_catalog=True
    - Para checkout, se requiere exam con direct_price_mxn > 0 (a menos que
      is_free_sample=True, en cuyo caso se otorga acceso sin pago)
    - Si el email no existe → se crea User con rol=candidato, username
      auto-generado (10 alfanuméricos) y se cuelga del Group Directo
    - Si el email ya existe → se reutiliza la cuenta
    - El acceso al examen (GroupExamMember) se concede SOLO cuando el
      webhook MP confirma pago aprobado (servicio mercadopago_service)
"""
import random
import string
import logging
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from sqlalchemy import or_, func

from app import db
from app.models.exam import Exam
from app.models.user import User
from app.models.partner import (
    Partner, Campus, CandidateGroup, GroupMember, GroupExam, GroupExamMember
)
from app.models.payment import Payment
from app.services.mercadopago_service import (
    create_direct_exam_preference,
    create_direct_bundle_preference,
    process_direct_bundle_payment,
)
from app.services.addon_pricing import (
    ADDONS,
    calculate_bundle,
    normalize_addons,
)
from app.utils.rate_limit import rate_limit


logger = logging.getLogger(__name__)
bp = Blueprint('direct', __name__)


# CURP: 4 letras + 6 dígitos + H|M + 5 letras + alfanumérico + dígito
import re  # noqa: E402
_CURP_REGEX = re.compile(r'^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$')
_CURP_CHAR_VALUES = {c: i for i, c in enumerate('0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ')}


def _validate_curp(curp: str) -> bool:
    """Valida formato + dígito verificador oficial RENAPO."""
    if not curp or len(curp) != 18:
        return False
    curp = curp.upper().strip()
    if not _CURP_REGEX.match(curp):
        return False
    # Dígito verificador
    try:
        total = 0
        for i, ch in enumerate(curp[:17]):
            total += _CURP_CHAR_VALUES[ch] * (18 - i)
        expected = (10 - (total % 10)) % 10
        return str(expected) == curp[17]
    except KeyError:
        return False


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_direct_group():
    """Devuelve (partner, campus, group) del modelo Directo. None si no setup."""
    partner = Partner.query.filter_by(is_system_direct=True).first()
    if not partner:
        return None, None, None
    campus = Campus.query.filter_by(partner_id=partner.id).order_by(Campus.id.asc()).first()
    if not campus:
        return partner, None, None
    group = CandidateGroup.query.filter_by(campus_id=campus.id).order_by(CandidateGroup.id.asc()).first()
    return partner, campus, group


def _generate_unique_username(max_attempts: int = 12) -> str:
    """Genera un username de 10 caracteres alfanuméricos único (regla B3).
    Reintenta hasta 12 veces; en el caso casi imposible de no encontrar,
    lanza RuntimeError.
    """
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(max_attempts):
        candidate = ''.join(random.choices(alphabet, k=10))
        if not User.query.filter_by(username=candidate).first():
            return candidate
    raise RuntimeError('No se pudo generar un username único después de varios intentos')


def _generate_random_password(length: int = 14) -> str:
    """Password temporal para usuarios que se registran vía checkout sin proveer uno."""
    alphabet = string.ascii_letters + string.digits + '@#$%&!'
    return ''.join(random.choices(alphabet, k=length))


def _find_or_create_direct_user(email, name, first_surname, second_surname=None,
                                phone=None, password=None, campus=None, partner=None,
                                curp=None):
    """Busca un User por email; si no existe lo crea bajo el campus Directo.

    Si `curp` se provee y el usuario (nuevo o existente) no tiene CURP
    registrada, se asigna (normalizada a mayúsculas).

    Returns:
        (user, was_created, temp_password|None)
    """
    if not email:
        raise ValueError('El email es obligatorio para el checkout directo.')

    curp_norm = (curp or '').strip().upper() or None

    email_norm = email.strip().lower()
    existing = User.query.filter(db.func.lower(User.email) == email_norm).first()
    if existing:
        if curp_norm and not (existing.curp or '').strip():
            existing.curp = curp_norm
            db.session.flush()
        return existing, False, None

    # Crear nuevo usuario
    username = _generate_unique_username()
    pwd = password or _generate_random_password()

    user = User(
        email=email_norm,
        username=username,
        name=(name or '').strip() or 'Candidato',
        first_surname=(first_surname or '').strip() or 'Directo',
        second_surname=(second_surname or '').strip() or None,
        phone=(phone or '').strip() or None,
        role='candidato',
        is_active=True,
        is_verified=False,
        campus_id=campus.id if campus else None,
        coordinator_id=partner.coordinator_id if partner else None,
        curp=curp_norm,
    )
    user.set_password(pwd)
    db.session.add(user)
    db.session.flush()
    return user, True, (pwd if not password else None)


def _ensure_group_membership(user, group):
    """Crea GroupMember si no existe."""
    if not group:
        return None
    member = GroupMember.query.filter_by(group_id=group.id, user_id=user.id).first()
    if member:
        return member
    member = GroupMember(group_id=group.id, user_id=user.id, status='active')
    db.session.add(member)
    db.session.flush()
    return member


def _ensure_group_exam(group, exam):
    """Crea GroupExam (assignment_type='selected') si no existe para (group, exam)."""
    if not group or not exam:
        return None
    ge = GroupExam.query.filter_by(group_id=group.id, exam_id=exam.id).first()
    if ge:
        return ge
    ge = GroupExam(
        group_id=group.id,
        exam_id=exam.id,
        assignment_type='selected',
        is_active=True,
        max_attempts=1,
        max_disconnections=3,
        exam_content_type='questions_only',
    )
    db.session.add(ge)
    db.session.flush()
    return ge


def _exam_card_dict(exam):
    """Versión recortada del examen para el catálogo público."""
    return {
        'id': exam.id,
        'title': exam.name,
        'description': exam.description,
        'direct_sale_description': exam.direct_sale_description,
        'direct_price_mxn': float(exam.direct_price_mxn) if exam.direct_price_mxn is not None else None,
        'is_free_sample': bool(exam.is_free_sample),
        'is_public_catalog': True,
        'image_url': getattr(exam, 'image_url', None),
        'info_sheet_url': (
            getattr(exam, 'info_sheet_url', None)
            or (getattr(exam.competency_standard, 'info_sheet_url', None) if getattr(exam, 'competency_standard', None) else None)
        ),
        'time_limit_minutes': getattr(exam, 'duration_minutes', None),
        'total_questions': exam.get_total_questions() if hasattr(exam, 'get_total_questions') else None,
    }


# ─── Endpoints públicos: catálogo ────────────────────────────────────────────

@bp.route('/catalog', methods=['GET'])
def list_catalog():
    """Lista de exámenes públicos disponibles para venta directa."""
    q = (request.args.get('q') or '').strip()
    query = Exam.query.filter(
        Exam.is_public_catalog == True,  # noqa: E712
        Exam.is_active == True,  # noqa: E712
        Exam.is_published == True,  # noqa: E712
    )
    if q:
        pattern = f'%{q}%'
        query = query.filter(or_(Exam.name.ilike(pattern), Exam.description.ilike(pattern)))
    exams = query.order_by(Exam.name.asc()).all()
    return jsonify({'exams': [_exam_card_dict(e) for e in exams]})


@bp.route('/catalog/<int:exam_id>', methods=['GET'])
def get_catalog_exam(exam_id):
    """Detalle de un examen del catálogo público."""
    exam = Exam.query.get(exam_id)
    if not exam or not exam.is_public_catalog or not exam.is_active or not exam.is_published:
        return jsonify({'error': 'Examen no disponible en el catálogo público'}), 404
    return jsonify({'exam': _exam_card_dict(exam)})


@bp.route('/addons', methods=['GET'])
def list_addons():
    """Catálogo de productos / add-ons que el candidato puede añadir al bundle.

    El precio del bundle se calcula como suma de los addons seleccionados,
    multiplicada por la cantidad de exámenes en el carrito.
    """
    return jsonify({'addons': ADDONS})


# ─── Checkout directo ────────────────────────────────────────────────────────

@bp.route('/checkout', methods=['POST'])
def direct_checkout():
    """Crea/reutiliza usuario y genera preferencia MP para compra individual.

    Acepta JWT **opcional**. Si el cliente envía Authorization Bearer válido,
    se reutiliza el usuario autenticado (el campo `customer` se vuelve
    opcional y solo se usa para completar datos faltantes). Si NO hay JWT,
    se requiere `customer` con email/name/first_surname para crear o
    reutilizar la cuenta vía email.
    """
    data = request.get_json(silent=True) or {}
    exam_id = data.get('exam_id')
    customer = data.get('customer') or {}

    if not exam_id:
        return jsonify({'error': 'exam_id es requerido'}), 400

    # ¿Hay un JWT válido en el header? (opcional)
    auth_user = None
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        if uid:
            auth_user = User.query.get(uid)
    except Exception:
        auth_user = None

    if not auth_user:
        # Modo anónimo: customer obligatorio
        if not customer.get('email'):
            return jsonify({'error': 'customer.email es requerido'}), 400
        if not customer.get('name') or not customer.get('first_surname'):
            return jsonify({'error': 'customer.name y customer.first_surname son requeridos'}), 400

    exam = Exam.query.get(exam_id)
    if not exam or not exam.is_public_catalog or not exam.is_active or not exam.is_published:
        return jsonify({'error': 'Examen no disponible en el catálogo público'}), 404

    if not exam.is_free_sample:
        if exam.direct_price_mxn is None or float(exam.direct_price_mxn) <= 0:
            return jsonify({'error': 'Este examen aún no tiene precio configurado'}), 400

    partner, campus, group = _get_direct_group()
    if not (partner and campus and group):
        return jsonify({'error': 'El modelo Directo no está configurado. Contacta al administrador.'}), 500

    try:
        if auth_user:
            # Usuario ya autenticado: reutilizar directamente
            user, created, temp_password = auth_user, False, None
            # Asegurar que esté colgado del campus/grupo directo (idempotente)
            if not user.campus_id:
                user.campus_id = campus.id
        else:
            user, created, temp_password = _find_or_create_direct_user(
                email=customer['email'],
                name=customer.get('name'),
                first_surname=customer.get('first_surname'),
                second_surname=customer.get('second_surname'),
                phone=customer.get('phone'),
                password=customer.get('password'),
                campus=campus,
                partner=partner,
            )
        _ensure_group_membership(user, group)
        group_exam = _ensure_group_exam(group, exam)

        # Caso especial: examen gratis de muestra → conceder acceso inmediato
        if exam.is_free_sample:
            existing_member = GroupExamMember.query.filter_by(
                group_exam_id=group_exam.id, user_id=user.id
            ).first()
            if not existing_member:
                db.session.add(GroupExamMember(group_exam_id=group_exam.id, user_id=user.id))
            db.session.commit()
            return jsonify({
                'free_sample': True,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'created': created,
                    'temp_password': temp_password,
                },
                'exam': {'id': exam.id, 'title': exam.name},
                'message': 'Acceso otorgado al examen gratuito de muestra. Inicia sesión para comenzar.',
            }), 200

        # Crear preferencia MP (esto crea el Payment internamente)
        result = create_direct_exam_preference(
            user=user,
            exam=exam,
            group_exam=group_exam,
            campus=campus,
            unit_price=float(exam.direct_price_mxn),
        )
        db.session.commit()

        return jsonify({
            **result,
            'user': {
                'id': user.id,
                'email': user.email,
                'created': created,
                'temp_password': temp_password,
            },
            'exam': {'id': exam.id, 'title': exam.name},
        }), 200

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': str(ve)}), 400
    except RuntimeError as re:
        db.session.rollback()
        logger.exception('Error en checkout directo: %s', re)
        return jsonify({'error': str(re)}), 502
    except Exception as e:
        db.session.rollback()
        logger.exception('Error inesperado en checkout directo')
        return jsonify({'error': 'Error procesando el pago. Intenta de nuevo.'}), 500


# ─── Checkout múltiple (bundle) — compra de varios exámenes en un solo pago ──

@bp.route('/checkout-bundle', methods=['POST'])
def direct_checkout_bundle():
    """Compra múltiple de certificaciones en una sola preferencia MercadoPago.

    Body JSON:
        {
            "exam_ids": [1, 5, 9],
            "customer": { ... }   // requerido si NO hay JWT; opcional con JWT
        }

    El bundle se modela como UN solo Payment con:
        * bundle_exam_ids = JSON list de exam_ids
        * group_exam_id   = NULL
        * units           = N exámenes
        * total_amount    = suma de direct_price_mxn

    Al aprobarse, el webhook crea GroupExamMember para cada examen.
    """
    data = request.get_json(silent=True) or {}
    exam_ids = data.get('exam_ids') or []
    customer = data.get('customer') or {}
    addons = data.get('addons') or []
    # CURP puede venir top-level (auth) o dentro de customer (guest)
    curp_in = (data.get('curp') or customer.get('curp') or '').strip().upper() or None

    if not isinstance(exam_ids, list) or not exam_ids:
        return jsonify({'error': 'exam_ids debe ser una lista no vacía'}), 400
    # Dedup preservando orden y convertir a int
    try:
        seen = set()
        exam_ids = [int(x) for x in exam_ids if not (int(x) in seen or seen.add(int(x)))]
    except (TypeError, ValueError):
        return jsonify({'error': 'exam_ids debe contener enteros válidos'}), 400
    if len(exam_ids) > 20:
        return jsonify({'error': 'Máximo 20 exámenes por compra'}), 400
    if not isinstance(addons, list):
        return jsonify({'error': 'addons debe ser una lista'}), 400
    addons = normalize_addons([str(a) for a in addons])

    # JWT opcional
    auth_user = None
    try:
        verify_jwt_in_request(optional=True)
        uid = get_jwt_identity()
        if uid:
            auth_user = User.query.get(uid)
    except Exception:
        auth_user = None

    # Si el bundle incluye CONOCER, la CURP es obligatoria y debe ser válida.
    requires_curp = 'cert_conocer' in addons
    if requires_curp:
        # Si está autenticado y ya tiene una CURP válida, no exigir input nuevo.
        existing_curp = None
        if auth_user and (auth_user.curp or '').strip():
            existing_curp = auth_user.curp.strip().upper()
        effective_curp = curp_in or existing_curp
        if not effective_curp:
            return jsonify({'error': 'La CURP es obligatoria para el certificado CONOCER.'}), 400
        if not _validate_curp(effective_curp):
            return jsonify({'error': 'CURP inválida (formato o dígito verificador incorrecto).'}), 400
        curp_in = effective_curp

    if not auth_user:
        if not customer.get('email'):
            return jsonify({'error': 'customer.email es requerido'}), 400
        if not customer.get('name') or not customer.get('first_surname'):
            return jsonify({'error': 'customer.name y customer.first_surname son requeridos'}), 400

    # Validar todos los exámenes (deben ser públicos, activos)
    exams = Exam.query.filter(Exam.id.in_(exam_ids)).all()
    by_id = {e.id: e for e in exams}
    missing = [eid for eid in exam_ids if eid not in by_id]
    if missing:
        return jsonify({'error': f'Exámenes no encontrados: {missing}'}), 404

    invalid = []
    for eid in exam_ids:
        e = by_id[eid]
        if not (getattr(e, 'is_public_catalog', False) and getattr(e, 'is_active', True)
                and getattr(e, 'is_published', False)):
            invalid.append({'id': e.id, 'reason': 'no_publico'})

    if invalid:
        return jsonify({
            'error': 'Algunos exámenes no se pueden comprar',
            'invalid': invalid,
        }), 400

    # Calcular total a partir de addons (no del precio por examen)
    total_price_dec, line_items = calculate_bundle(len(exam_ids), addons)
    if total_price_dec <= 0:
        return jsonify({'error': 'El total a pagar debe ser mayor a cero'}), 400
    total_price = float(total_price_dec)

    # Resolver grupo/campus/partner Directo
    info = _get_direct_group()
    if not info:
        return jsonify({'error': 'Modelo Directo no está configurado'}), 503
    partner, campus, group = info

    try:
        if auth_user:
            user, created, temp_password = auth_user, False, None
            if not user.campus_id:
                user.campus_id = campus.id
            if curp_in and not (user.curp or '').strip():
                user.curp = curp_in
        else:
            user, created, temp_password = _find_or_create_direct_user(
                email=customer['email'],
                name=customer.get('name'),
                first_surname=customer.get('first_surname'),
                second_surname=customer.get('second_surname'),
                phone=customer.get('phone'),
                password=customer.get('password'),
                campus=campus,
                partner=partner,
                curp=curp_in,
            )
        _ensure_group_membership(user, group)
        # Asegurar GroupExam para cada examen (se usará al acreditar en webhook)
        exam_objs = [by_id[eid] for eid in exam_ids]
        for e in exam_objs:
            _ensure_group_exam(group, e)

        # Crear UNA preferencia MP con N ítems
        result = create_direct_bundle_preference(
            user=user,
            exams=exam_objs,
            campus=campus,
            line_items=line_items,
            total_amount=total_price_dec,
        )
        db.session.commit()

        return jsonify({
            **result,
            'user': {
                'id': user.id,
                'email': user.email,
                'created': created,
                'temp_password': temp_password,
            },
            'exams': [{'id': e.id, 'title': e.name}
                      for e in exam_objs],
            'addons': addons,
            'line_items': line_items,
            'total_amount': total_price,
            'units': len(exam_objs),
        }), 200

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': str(ve)}), 400
    except RuntimeError as re:
        db.session.rollback()
        logger.exception('Error en checkout bundle: %s', re)
        return jsonify({'error': str(re)}), 502
    except Exception:
        db.session.rollback()
        logger.exception('Error inesperado en checkout bundle')
        return jsonify({'error': 'Error procesando el pago. Intenta de nuevo.'}), 500


# ─── Checkout embebido (card token) ──────────────────────────────────────────

@bp.route('/pay-bundle', methods=['POST'])
@jwt_required()
@rate_limit(limit=5, window=60, key_prefix='rl_pay_direct_bundle')
def direct_pay_bundle():
    """Cobro embebido con token de tarjeta MP para uno o varios exámenes
    del modelo Directo. Equivalente a `/payments/candidate-pay` del modelo
    Partners, pero para compras self-service del catálogo.

    Body JSON:
        exam_ids: list[int]   — 1..20 exámenes del catálogo público
        token: str            — token de tarjeta generado vía MP card_tokens
        payment_method_id: str
        installments: int     — default 1
        issuer_id: str?       — opcional
        payer_email: str?     — opcional, default user.email

    Returns:
        200: { payment_id, status, mp_status, mp_status_detail,
               mp_payment_id, credits_applied, exam_ids }
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    data = request.get_json(silent=True) or {}
    exam_ids = data.get('exam_ids') or []
    addons = data.get('addons') or []
    token = (data.get('token') or '').strip()
    payment_method_id = (data.get('payment_method_id') or '').strip()
    installments = data.get('installments', 1)
    issuer_id = data.get('issuer_id')
    payer_email = (data.get('payer_email') or user.email or '').strip()

    if not isinstance(exam_ids, list) or not exam_ids:
        return jsonify({'error': 'exam_ids debe ser una lista no vacía'}), 400
    try:
        seen = set()
        exam_ids = [int(x) for x in exam_ids if not (int(x) in seen or seen.add(int(x)))]
    except (TypeError, ValueError):
        return jsonify({'error': 'exam_ids debe contener enteros válidos'}), 400
    if len(exam_ids) > 20:
        return jsonify({'error': 'Máximo 20 exámenes por compra'}), 400
    if not isinstance(addons, list):
        return jsonify({'error': 'addons debe ser una lista'}), 400
    addons = normalize_addons([str(a) for a in addons])
    # Si el bundle incluye CONOCER, exigir CURP válida en el usuario.
    if 'cert_conocer' in addons:
        curp_in = (data.get('curp') or '').strip().upper() or None
        existing_curp = (user.curp or '').strip().upper() or None
        effective_curp = curp_in or existing_curp
        if not effective_curp:
            return jsonify({'error': 'La CURP es obligatoria para el certificado CONOCER.'}), 400
        if not _validate_curp(effective_curp):
            return jsonify({'error': 'CURP inválida (formato o dígito verificador incorrecto).'}), 400
        if not existing_curp and curp_in:
            user.curp = curp_in
    if not token:
        return jsonify({'error': 'Token de tarjeta requerido'}), 400
    if not payment_method_id:
        return jsonify({'error': 'Método de pago requerido'}), 400
    if not isinstance(installments, int) or installments < 1:
        installments = 1

    # Validar que todos los exámenes existen y son comprables
    exams = Exam.query.filter(Exam.id.in_(exam_ids)).all()
    by_id = {e.id: e for e in exams}
    missing = [eid for eid in exam_ids if eid not in by_id]
    if missing:
        return jsonify({'error': f'Exámenes no encontrados: {missing}'}), 404

    invalid = []
    for eid in exam_ids:
        e = by_id[eid]
        if not (getattr(e, 'is_public_catalog', False) and getattr(e, 'is_active', True)
                and getattr(e, 'is_published', False)):
            invalid.append({'id': e.id, 'reason': 'no_publico'})

    if invalid:
        return jsonify({
            'error': 'Algunos exámenes no se pueden comprar',
            'invalid': invalid,
        }), 400

    total_price_dec, line_items = calculate_bundle(len(exam_ids), addons)
    if total_price_dec <= 0:
        return jsonify({'error': 'El total a pagar debe ser mayor a cero'}), 400
    total_price = float(total_price_dec)

    info = _get_direct_group()
    if not info:
        return jsonify({'error': 'Modelo Directo no está configurado'}), 503
    partner, campus, group = info

    try:
        if not user.campus_id:
            user.campus_id = campus.id
        _ensure_group_membership(user, group)
        exam_objs = [by_id[eid] for eid in exam_ids]
        for e in exam_objs:
            _ensure_group_exam(group, e)

        result = process_direct_bundle_payment(
            user=user,
            exams=exam_objs,
            campus=campus,
            line_items=line_items,
            total_amount=total_price_dec,
            token=token,
            payment_method_id=payment_method_id,
            installments=installments,
            issuer_id=issuer_id,
            payer_email=payer_email,
        )
        db.session.commit()
        return jsonify({
            **result,
            'addons': addons,
            'line_items': line_items,
            'total_amount': total_price,
            'units': len(exam_objs),
        }), 200

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': str(ve)}), 400
    except RuntimeError as re:
        db.session.rollback()
        logger.exception('Error en pay-bundle directo: %s', re)
        return jsonify({'error': str(re)}), 502
    except Exception:
        db.session.rollback()
        logger.exception('Error inesperado en pay-bundle directo')
        return jsonify({'error': 'Error procesando el pago. Intenta de nuevo.'}), 500


# ─── Estado de pago (polling desde la página success) ────────────────────────

@bp.route('/payment-status', methods=['GET'])
def payment_status():
    """Devuelve el estado actual de un pago por external_reference (público)."""
    ref = (request.args.get('ref') or '').strip()
    if not ref:
        return jsonify({'error': 'ref es requerido'}), 400
    payment = Payment.query.filter_by(mp_external_reference=ref).first()
    if not payment:
        return jsonify({'error': 'Pago no encontrado'}), 404
    return jsonify({
        'status': payment.status,
        'mp_status': payment.mp_status,
        'credits_applied': payment.credits_applied,
        'payment_type': payment.payment_type,
        'group_exam_id': payment.group_exam_id,
    })


# ─── Mis compras (autenticado) ───────────────────────────────────────────────

@bp.route('/my-purchases', methods=['GET'])
@jwt_required()
def my_purchases():
    """Pagos directos del usuario autenticado, con info del examen comprado."""
    user_id = get_jwt_identity()
    payments = (Payment.query
                .filter_by(user_id=user_id, payment_type='direct_exam')
                .order_by(Payment.created_at.desc())
                .all())

    out = []
    for p in payments:
        exam_dict = None
        exams_list = None
        bundle_ids = p.get_bundle_exam_ids()
        if bundle_ids:
            # Bundle: incluir array de exámenes
            exams_list = []
            for eid in bundle_ids:
                e = Exam.query.get(eid)
                if e:
                    exams_list.append({'id': e.id, 'title': e.name})
        elif p.group_exam_id:
            ge = GroupExam.query.get(p.group_exam_id)
            if ge and ge.exam:
                exam_dict = {'id': ge.exam.id, 'title': ge.exam.name}
        out.append({
            **p.to_dict(),
            'exam': exam_dict,
            'exams': exams_list,
        })
    return jsonify({'purchases': out})


# ─── Panel de control — métricas Modelo Directo (admin/gerente) ──────────────

@bp.route('/metrics', methods=['GET'])
@jwt_required()
def metrics():
    """Métricas agregadas del Modelo Directo para admin/gerente.

    Devuelve:
        revenue: { today, week, month, total }    (solo pagos approved)
        payments: { approved, pending, rejected, total }
        top_exams: [{ exam_id, title, sold, revenue }, ...] (top 10 últimos 90d)
        registrations_by_day: [{ date, count }] (últimos 30d, Group Directo)
        conversion: { paying_users, registered_users, rate_pct }
        catalog: { paid_published, free_samples, draft_with_price }
    """
    user = User.query.get(get_jwt_identity())
    if not user or user.role not in ('admin', 'developer', 'gerente'):
        return jsonify({'error': 'Permiso denegado'}), 403

    now = datetime.utcnow()
    start_today = datetime(now.year, now.month, now.day)
    start_week = start_today - timedelta(days=7)
    start_month = start_today - timedelta(days=30)
    start_90 = start_today - timedelta(days=90)

    base_q = Payment.query.filter(Payment.payment_type == 'direct_exam')

    def _sum_revenue(since=None):
        q = base_q.filter(Payment.status == 'approved')
        if since is not None:
            q = q.filter(Payment.created_at >= since)
        total = db.session.query(func.coalesce(func.sum(Payment.total_amount), 0)).filter(
            Payment.payment_type == 'direct_exam',
            Payment.status == 'approved',
            *( [Payment.created_at >= since] if since is not None else [] ),
        ).scalar()
        return float(total or 0)

    revenue = {
        'today': _sum_revenue(start_today),
        'week': _sum_revenue(start_week),
        'month': _sum_revenue(start_month),
        'total': _sum_revenue(None),
    }

    # Conteos por estado
    status_counts = dict(
        db.session.query(Payment.status, func.count(Payment.id))
        .filter(Payment.payment_type == 'direct_exam')
        .group_by(Payment.status).all()
    )
    payments = {
        'approved': int(status_counts.get('approved', 0)),
        'pending': int(status_counts.get('pending', 0)),
        'rejected': int(status_counts.get('rejected', 0)),
        'total': int(sum(status_counts.values())),
    }

    # Top exámenes vendidos (últimos 90d)
    top_rows = (
        db.session.query(
            GroupExam.exam_id.label('exam_id'),
            func.count(Payment.id).label('sold'),
            func.coalesce(func.sum(Payment.total_amount), 0).label('revenue'),
        )
        .join(GroupExam, GroupExam.id == Payment.group_exam_id)
        .filter(
            Payment.payment_type == 'direct_exam',
            Payment.status == 'approved',
            Payment.created_at >= start_90,
        )
        .group_by(GroupExam.exam_id)
        .order_by(func.count(Payment.id).desc())
        .limit(10)
        .all()
    )
    top_exams = []
    for row in top_rows:
        ex = Exam.query.get(row.exam_id)
        top_exams.append({
            'exam_id': row.exam_id,
            'title': ex.name if ex else f'(eliminado #{row.exam_id})',
            'sold': int(row.sold),
            'revenue': float(row.revenue or 0),
        })

    # Registros por día (últimos 30d, Group Directo)
    _, _, direct_group = _get_direct_group()
    registrations_by_day = []
    registered_users = 0
    if direct_group:
        rows = (
            db.session.query(
                func.cast(User.created_at, db.Date).label('d'),
                func.count(User.id).label('c'),
            )
            .join(GroupMember, GroupMember.user_id == User.id)
            .filter(
                GroupMember.group_id == direct_group.id,
                User.created_at >= start_month,
            )
            .group_by(func.cast(User.created_at, db.Date))
            .order_by(func.cast(User.created_at, db.Date).asc())
            .all()
        )
        registrations_by_day = [{'date': str(r.d), 'count': int(r.c)} for r in rows]
        registered_users = int(
            db.session.query(func.count(GroupMember.id))
            .filter(GroupMember.group_id == direct_group.id).scalar() or 0
        )

    # Conversión: usuarios con al menos 1 pago aprobado / usuarios registrados
    paying_users = int(
        db.session.query(func.count(func.distinct(Payment.user_id)))
        .filter(
            Payment.payment_type == 'direct_exam',
            Payment.status == 'approved',
        ).scalar() or 0
    )
    rate_pct = (paying_users / registered_users * 100.0) if registered_users > 0 else 0.0
    conversion = {
        'paying_users': paying_users,
        'registered_users': registered_users,
        'rate_pct': round(rate_pct, 2),
    }

    # Catálogo: publicados (pago) vs muestras vs con precio sin publicar
    paid_published = int(
        Exam.query.filter(
            Exam.is_public_catalog == True,  # noqa: E712
            Exam.is_free_sample == False,  # noqa: E712
        ).count()
    )
    free_samples = int(
        Exam.query.filter(
            Exam.is_public_catalog == True,  # noqa: E712
            Exam.is_free_sample == True,  # noqa: E712
        ).count()
    )
    draft_with_price = int(
        Exam.query.filter(
            Exam.is_public_catalog == False,  # noqa: E712
            Exam.direct_price_mxn != None,  # noqa: E711
        ).count()
    )
    catalog = {
        'paid_published': paid_published,
        'free_samples': free_samples,
        'draft_with_price': draft_with_price,
    }

    return jsonify({
        'revenue': revenue,
        'payments': payments,
        'top_exams': top_exams,
        'registrations_by_day': registrations_by_day,
        'conversion': conversion,
        'catalog': catalog,
        'generated_at': now.isoformat() + 'Z',
    })
