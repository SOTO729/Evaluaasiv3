"""
Rutas de pagos en línea (Mercado Pago Checkout Pro)

Endpoints:
  POST /api/payments/checkout         — Crear preferencia de pago (responsable)
  POST /api/payments/candidate-pay    — Candidato paga por certificación
  POST /api/payments/candidate-retake — Candidato paga retoma
  POST /api/payments/webhook          — Recibir notificaciones IPN de MP (público)
  GET  /api/payments/status/<ref>     — Consultar estado de un pago por referencia
  GET  /api/payments/my-payments      — Historial de pagos del responsable
"""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.user import User
from app.models.partner import Campus, CandidateGroup, GroupExam, GroupMember, GroupExamMember
from app.models.payment import Payment
from app.services.mercadopago_service import (
    create_checkout_preference,
    process_direct_payment,
    process_candidate_payment,
    process_webhook_notification,
    verify_webhook_signature,
)

logger = logging.getLogger(__name__)

bp = Blueprint('payments', __name__)


# ─── POST /checkout — Crear preferencia de pago ──────────────────────────────

@bp.route('/checkout', methods=['POST'])
@jwt_required()
def create_checkout():
    """Crea una preferencia de Checkout Pro en Mercado Pago.

    Body JSON:
        units (int): Número de vouchers a comprar (mín. 1)

    Returns:
        201: { payment_id, preference_id, init_point, sandbox_init_point }
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    if user.role not in ('responsable', 'admin', 'developer'):
        return jsonify({'error': 'Solo los responsables pueden realizar pagos en línea'}), 403

    # Obtener campus del responsable
    campus = _get_user_campus(user)
    if not campus:
        return jsonify({'error': 'No se encontró un plantel asignado'}), 404

    # Verificar que el campus tenga pagos en línea habilitados
    if not campus.enable_online_payments:
        return jsonify({'error': 'Los pagos en línea no están habilitados para este plantel'}), 403

    data = request.get_json(silent=True) or {}
    units = data.get('units')

    if not units or not isinstance(units, int) or units < 1:
        return jsonify({'error': 'Debes indicar un número válido de vouchers (mínimo 1)'}), 400

    if units > 999:
        return jsonify({'error': 'Máximo 999 vouchers por transacción'}), 400

    # Precio unitario del campus
    unit_price = float(campus.certification_cost or 0)
    if unit_price <= 0:
        return jsonify({'error': 'El plantel no tiene un costo de certificación configurado'}), 400

    try:
        result = create_checkout_preference(user, campus, units, unit_price)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        logger.exception('Error creando checkout: %s', e)
        return jsonify({'error': 'Error interno al crear el pago'}), 500


# ─── POST /process — Procesar pago directo con token de tarjeta ──────────────

@bp.route('/process', methods=['POST'])
@jwt_required()
def process_payment():
    """Procesa un pago directo con token de tarjeta tokenizado client-side.

    Body JSON:
        units (int): Número de vouchers (1-999)
        token (str): Token de tarjeta de MP (generado client-side)
        payment_method_id (str): ID del método de pago (visa, master, etc.)
        installments (int): Número de cuotas (default 1)
        issuer_id (str): ID del emisor (opcional)
        payer_email (str): Email del pagador (opcional)

    Returns:
        200: { payment_id, status, mp_status, mp_status_detail, mp_payment_id, credits_applied }
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    if user.role not in ('responsable', 'admin', 'developer'):
        return jsonify({'error': 'Solo los responsables pueden realizar pagos en línea'}), 403

    campus = _get_user_campus(user)
    if not campus:
        return jsonify({'error': 'No se encontró un plantel asignado'}), 404

    if not campus.enable_online_payments:
        return jsonify({'error': 'Los pagos en línea no están habilitados para este plantel'}), 403

    data = request.get_json(silent=True) or {}

    # Validar campos requeridos
    units = data.get('units')
    token = data.get('token', '').strip()
    payment_method_id = data.get('payment_method_id', '').strip()
    installments = data.get('installments', 1)
    issuer_id = data.get('issuer_id')
    payer_email = data.get('payer_email', '').strip()

    if not units or not isinstance(units, int) or units < 1:
        return jsonify({'error': 'Debes indicar un número válido de vouchers (mínimo 1)'}), 400

    if units > 999:
        return jsonify({'error': 'Máximo 999 vouchers por transacción'}), 400

    if not token:
        return jsonify({'error': 'Token de tarjeta requerido'}), 400

    if not payment_method_id:
        return jsonify({'error': 'Método de pago requerido'}), 400

    if not isinstance(installments, int) or installments < 1:
        installments = 1

    unit_price = float(campus.certification_cost or 0)
    if unit_price <= 0:
        return jsonify({'error': 'El plantel no tiene un costo de certificación configurado'}), 400

    try:
        result = process_direct_payment(
            user=user,
            campus=campus,
            units=units,
            unit_price=unit_price,
            token=token,
            payment_method_id=payment_method_id,
            installments=installments,
            issuer_id=issuer_id,
            payer_email=payer_email or user.email,
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        logger.exception('Error procesando pago directo: %s', e)
        return jsonify({'error': 'Error interno al procesar el pago'}), 500


# ─── POST /candidate-pay — Candidato paga por certificación ──────────────────

@bp.route('/candidate-pay', methods=['POST'])
@jwt_required()
def candidate_pay():
    """Candidato paga por una certificación específica (asignación de examen).

    Body JSON:
        group_exam_id (int): ID de la asignación de examen
        token (str): Token de tarjeta de MP
        payment_method_id (str): Método de pago
        installments (int): Cuotas (default 1)
        issuer_id (str): Emisor (opcional)
        payer_email (str): Email del pagador

    Returns:
        200: { payment_id, status, mp_status, ... }
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    if user.role != 'candidato':
        return jsonify({'error': 'Solo los candidatos pueden realizar este pago'}), 403

    data = request.get_json(silent=True) or {}
    group_exam_id = data.get('group_exam_id')
    token = data.get('token', '').strip()
    payment_method_id = data.get('payment_method_id', '').strip()
    installments = data.get('installments', 1)
    issuer_id = data.get('issuer_id')
    payer_email = data.get('payer_email', '').strip()

    if not group_exam_id:
        return jsonify({'error': 'group_exam_id es requerido'}), 400
    if not token:
        return jsonify({'error': 'Token de tarjeta requerido'}), 400
    if not payment_method_id:
        return jsonify({'error': 'Método de pago requerido'}), 400
    if not isinstance(installments, int) or installments < 1:
        installments = 1

    # Validar que la asignación existe y el candidato pertenece al grupo
    group_exam = GroupExam.query.get(group_exam_id)
    if not group_exam or not group_exam.is_active:
        return jsonify({'error': 'Asignación de examen no encontrada'}), 404

    group = CandidateGroup.query.get(group_exam.group_id)
    if not group or not group.is_active:
        return jsonify({'error': 'Grupo no encontrado'}), 404

    # Verificar membresía
    membership = GroupMember.query.filter_by(
        user_id=current_user_id,
        group_id=group.id,
        status='active'
    ).first()
    if not membership:
        return jsonify({'error': 'No perteneces a este grupo'}), 403

    # Si la asignación es de tipo 'selected', verificar asignación individual
    if group_exam.assignment_type == 'selected':
        member_assignment = GroupExamMember.query.filter_by(
            group_exam_id=group_exam_id,
            user_id=current_user_id
        ).first()
        if not member_assignment:
            return jsonify({'error': 'No estás asignado a este examen'}), 403

    # Verificar que el grupo/campus tiene pagos habilitados
    campus = Campus.query.get(group.campus_id)
    if not campus:
        return jsonify({'error': 'Campus no encontrado'}), 404

    payments_enabled = group.enable_online_payments_override if group.enable_online_payments_override is not None else campus.enable_online_payments
    if not payments_enabled:
        return jsonify({'error': 'Los pagos en línea no están habilitados para este grupo'}), 403

    # Determinar precio
    cert_cost = float(group.certification_cost_override or campus.certification_cost or 0)
    if cert_cost <= 0:
        return jsonify({'error': 'No hay costo de certificación configurado'}), 400

    # Verificar que no haya ya un pago aprobado para esta asignación
    existing = Payment.query.filter_by(
        user_id=current_user_id,
        group_exam_id=group_exam_id,
        payment_type='certification',
        status='approved'
    ).first()
    if existing:
        return jsonify({'error': 'Ya tienes un pago aprobado para esta certificación'}), 400

    try:
        result = process_candidate_payment(
            user=user,
            campus=campus,
            group_exam=group_exam,
            unit_price=cert_cost,
            payment_type='certification',
            token=token,
            payment_method_id=payment_method_id,
            installments=installments,
            issuer_id=issuer_id,
            payer_email=payer_email or user.email,
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        logger.exception('Error procesando pago de candidato: %s', e)
        return jsonify({'error': 'Error interno al procesar el pago'}), 500


# ─── POST /candidate-retake — Candidato paga retoma ──────────────────────────

@bp.route('/candidate-retake', methods=['POST'])
@jwt_required()
def candidate_retake():
    """Candidato paga por una retoma de examen.

    Body JSON:
        group_exam_id (int): ID de la asignación de examen
        token (str): Token de tarjeta de MP
        payment_method_id (str): Método de pago
        installments (int): Cuotas (default 1)
        issuer_id (str): Emisor (opcional)
        payer_email (str): Email del pagador

    Returns:
        200: { payment_id, status, mp_status, ..., retake_id }
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    if user.role != 'candidato':
        return jsonify({'error': 'Solo los candidatos pueden realizar este pago'}), 403

    data = request.get_json(silent=True) or {}
    group_exam_id = data.get('group_exam_id')
    token = data.get('token', '').strip()
    payment_method_id = data.get('payment_method_id', '').strip()
    installments = data.get('installments', 1)
    issuer_id = data.get('issuer_id')
    payer_email = data.get('payer_email', '').strip()

    if not group_exam_id:
        return jsonify({'error': 'group_exam_id es requerido'}), 400
    if not token:
        return jsonify({'error': 'Token de tarjeta requerido'}), 400
    if not payment_method_id:
        return jsonify({'error': 'Método de pago requerido'}), 400
    if not isinstance(installments, int) or installments < 1:
        installments = 1

    group_exam = GroupExam.query.get(group_exam_id)
    if not group_exam or not group_exam.is_active:
        return jsonify({'error': 'Asignación de examen no encontrada'}), 404

    group = CandidateGroup.query.get(group_exam.group_id)
    if not group or not group.is_active:
        return jsonify({'error': 'Grupo no encontrado'}), 404

    membership = GroupMember.query.filter_by(
        user_id=current_user_id,
        group_id=group.id,
        status='active'
    ).first()
    if not membership:
        return jsonify({'error': 'No perteneces a este grupo'}), 403

    if group_exam.assignment_type == 'selected':
        member_assignment = GroupExamMember.query.filter_by(
            group_exam_id=group_exam_id,
            user_id=current_user_id
        ).first()
        if not member_assignment:
            return jsonify({'error': 'No estás asignado a este examen'}), 403

    campus = Campus.query.get(group.campus_id)
    if not campus:
        return jsonify({'error': 'Campus no encontrado'}), 404

    payments_enabled = group.enable_online_payments_override if group.enable_online_payments_override is not None else campus.enable_online_payments
    if not payments_enabled:
        return jsonify({'error': 'Los pagos en línea no están habilitados para este grupo'}), 403

    # Determinar costo de retoma
    retake_cost = float(group.retake_cost_override or campus.retake_cost or 0)
    if retake_cost <= 0:
        return jsonify({'error': 'No hay costo de retoma configurado'}), 400

    # Verificar que el candidato realmente ha agotado sus intentos
    from app.models.result import Result
    from app.models.partner import EcmRetake
    results_count = Result.query.filter_by(
        user_id=str(current_user_id),
        exam_id=group_exam.exam_id,
        status=1
    ).count()
    retakes = EcmRetake.query.filter_by(
        group_exam_id=group_exam_id,
        user_id=current_user_id,
        status='approved'
    ).count()
    max_attempts = group_exam.max_attempts or 1
    total_allowed = max_attempts + retakes
    if results_count < total_allowed:
        return jsonify({'error': 'Aún tienes intentos disponibles, no necesitas una retoma'}), 400

    try:
        result = process_candidate_payment(
            user=user,
            campus=campus,
            group_exam=group_exam,
            unit_price=retake_cost,
            payment_type='retake',
            token=token,
            payment_method_id=payment_method_id,
            installments=installments,
            issuer_id=issuer_id,
            payer_email=payer_email or user.email,
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502
    except Exception as e:
        logger.exception('Error procesando retoma de candidato: %s', e)
        return jsonify({'error': 'Error interno al procesar el pago'}), 500


# ─── POST /webhook — Notificaciones IPN de Mercado Pago ──────────────────────

@bp.route('/webhook', methods=['POST'])
def webhook():
    """Recibe notificaciones webhook/IPN de Mercado Pago.

    No requiere autenticación JWT — es llamado directamente por MP.
    Se valida mediante firma HMAC (x-signature header).

    MP puede enviar:
      - query param: ?type=payment&data.id=XXXX (notificaciones IPN)
      - body JSON: { action, data: { id }, type } (webhooks v2)
    """
    # Intentar verificar firma si viene el header
    x_signature = request.headers.get('x-signature', '')
    x_request_id = request.headers.get('x-request-id', '')

    body = request.get_json(silent=True) or {}

    # Obtener topic y data_id de query params o body
    topic = request.args.get('type') or request.args.get('topic') or body.get('type', '')
    data_id = request.args.get('data.id') or (body.get('data', {}) or {}).get('id', '')

    if not data_id:
        logger.warning('Webhook sin data_id: args=%s body=%s', dict(request.args), body)
        return jsonify({'status': 'ignored'}), 200

    # Verificar firma si hay signature
    if x_signature:
        parts = dict(p.split('=', 1) for p in x_signature.split(',') if '=' in p)
        ts = parts.get('ts', '')
        v1 = parts.get('v1', '')
        if not verify_webhook_signature(x_request_id, str(data_id), ts, v1):
            logger.warning('Firma de webhook inválida')
            return jsonify({'error': 'Invalid signature'}), 401

    logger.info('Webhook recibido: topic=%s, data_id=%s', topic, data_id)

    try:
        process_webhook_notification(topic, str(data_id), full_body=body)
    except Exception as e:
        logger.exception('Error procesando webhook: %s', e)
        # Siempre retornar 200 a MP para evitar reintentos excesivos
        return jsonify({'status': 'error', 'detail': str(e)}), 200

    return jsonify({'status': 'ok'}), 200


# ─── GET /status/<ref> — Estado de un pago ────────────────────────────────────

@bp.route('/status/<reference>', methods=['GET'])
@jwt_required()
def payment_status(reference):
    """Consulta el estado de un pago por su external_reference.

    Returns:
        200: Payment dict
        404: si no se encontró
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    payment = Payment.query.filter_by(mp_external_reference=reference).first()
    if not payment:
        return jsonify({'error': 'Pago no encontrado'}), 404

    # Solo el dueño o admin puede ver el pago
    if payment.user_id != user.id and user.role not in ('admin', 'developer', 'gerente', 'financiero'):
        return jsonify({'error': 'No tienes permiso para ver este pago'}), 403

    return jsonify(payment.to_dict()), 200


# ─── GET /my-payments — Historial de pagos del usuario ────────────────────────

@bp.route('/my-payments', methods=['GET'])
@jwt_required()
def my_payments():
    """Retorna el historial de pagos del usuario autenticado.

    Query params:
        page (int): Página (default 1)
        per_page (int): Resultados por página (default 20, max 100)
        status (str): Filtrar por estado (approved, pending, rejected, etc.)

    Returns:
        200: { payments: [...], total, page, per_page }
    """
    current_user_id = get_jwt_identity()

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    status_filter = request.args.get('status', '')

    query = Payment.query.filter_by(user_id=current_user_id)

    if status_filter:
        query = query.filter_by(status=status_filter)

    query = query.order_by(Payment.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'payments': [p.to_dict() for p in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
    }), 200


# ─── Helper ──────────────────────────────────────────────────────────────────

def _get_user_campus(user):
    """Obtener el campus asignado a un responsable."""
    if user.role in ('admin', 'developer'):
        # Admin puede especificar campus_id en el request
        campus_id = (request.get_json(silent=True) or {}).get('campus_id')
        if campus_id:
            return Campus.query.get(campus_id)
        return None

    # Para responsable: buscar campus donde es responsable
    return Campus.query.filter_by(responsable_id=user.id).first()
