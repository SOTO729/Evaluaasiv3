"""
Servicio de integración con Mercado Pago

Maneja la creación de preferencias de pago (Checkout Pro) y el procesamiento
de notificaciones webhook/IPN para acreditar vouchers automáticamente.

Docs: https://www.mercadopago.com.mx/developers/es/reference
"""
import os
import uuid
import hashlib
import hmac
import json
import logging
from datetime import datetime
from decimal import Decimal

import requests as http_requests

from app import db
from app.models.payment import Payment
from app.models.balance import CoordinatorBalance, create_balance_transaction

logger = logging.getLogger(__name__)


# ─── Configuración ───────────────────────────────────────────────────────────

def _get_access_token():
    return os.getenv('MP_ACCESS_TOKEN', '')


def _get_webhook_secret():
    return os.getenv('MP_WEBHOOK_SECRET', '')


def _get_base_url():
    """URL base del frontend para redirecciones post-pago."""
    return os.getenv('APP_URL', 'https://app.evaluaasi.com')


MP_API_BASE = 'https://api.mercadopago.com'


# ─── Crear preferencia de pago (Checkout Pro) ────────────────────────────────

def create_checkout_preference(user, campus, units, unit_price):
    """Crea una preferencia de Checkout Pro en Mercado Pago.

    Args:
        user: Objeto User (el responsable que paga)
        campus: Objeto Campus
        units: Número de vouchers a comprar
        unit_price: Precio unitario (Decimal o float)

    Returns:
        dict con { payment_id, preference_id, init_point, sandbox_init_point }

    Raises:
        ValueError: si datos inválidos
        RuntimeError: si error de comunicación con MP
    """
    access_token = _get_access_token()
    if not access_token:
        raise RuntimeError('Mercado Pago no está configurado. Contacta al administrador.')

    total = Decimal(str(unit_price)) * units
    external_reference = f'ev-{campus.id}-{user.id}-{uuid.uuid4().hex[:12]}'

    # Crear registro en BD antes de llamar a MP
    payment = Payment(
        user_id=user.id,
        campus_id=campus.id,
        units=units,
        unit_price=Decimal(str(unit_price)),
        total_amount=total,
        mp_external_reference=external_reference,
        status='pending',
    )
    db.session.add(payment)
    db.session.flush()  # obtener payment.id

    base_url = _get_base_url()

    preference_data = {
        'items': [{
            'title': f'Vouchers de certificación — {campus.name}',
            'description': f'{units} voucher{"s" if units > 1 else ""} de certificación para {campus.name}',
            'quantity': units,
            'unit_price': float(unit_price),
            'currency_id': 'MXN',
        }],
        'payer': {
            'name': user.name or '',
            'surname': user.first_surname or '',
            'email': user.email,
        },
        'back_urls': {
            'success': f'{base_url}/mi-plantel/vouchers?payment=success&ref={external_reference}',
            'failure': f'{base_url}/mi-plantel/vouchers?payment=failure&ref={external_reference}',
            'pending': f'{base_url}/mi-plantel/vouchers?payment=pending&ref={external_reference}',
        },
        'auto_return': 'approved',
        'external_reference': external_reference,
        'notification_url': f'{os.getenv("API_URL", "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io")}/api/payments/webhook',
        'statement_descriptor': 'EVALUAASI',
        'expires': False,
    }

    resp = http_requests.post(
        f'{MP_API_BASE}/checkout/preferences',
        json=preference_data,
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
        timeout=15,
    )

    if resp.status_code not in (200, 201):
        logger.error('MP preference creation failed: %s %s', resp.status_code, resp.text)
        db.session.rollback()
        raise RuntimeError(f'Error al crear preferencia de pago: {resp.status_code}')

    mp_data = resp.json()
    payment.mp_preference_id = mp_data.get('id')
    db.session.commit()

    is_sandbox = access_token.startswith('TEST-')
    checkout_url = mp_data.get('sandbox_init_point') if is_sandbox else mp_data.get('init_point')

    return {
        'payment_id': payment.id,
        'preference_id': mp_data['id'],
        'init_point': mp_data.get('init_point'),
        'sandbox_init_point': mp_data.get('sandbox_init_point'),
        'checkout_url': checkout_url,
    }


# ─── Procesar pago directo con token de tarjeta ──────────────────────────────

def process_direct_payment(user, campus, units, unit_price, token, payment_method_id,
                           installments=1, issuer_id=None, payer_email=None):
    """Procesa un pago directo con token de tarjeta vía la API de Mercado Pago.

    El frontend tokeniza la tarjeta llamando directamente a MP (browser→MP API),
    y envía el token a nuestro backend para procesarlo.

    Args:
        user: Objeto User (el responsable que paga)
        campus: Objeto Campus
        units: Número de vouchers
        unit_price: Precio unitario
        token: Token de tarjeta generado por MP (client-side)
        payment_method_id: ID del método de pago (visa, master, etc.)
        installments: Número de cuotas (default 1)
        issuer_id: ID del emisor (opcional)
        payer_email: Email del pagador (opcional, usa user.email como fallback)

    Returns:
        dict con resultado del pago

    Raises:
        ValueError: si MP rechaza el pago (datos de tarjeta, fondos, etc.)
        RuntimeError: si error de comunicación con MP
    """
    access_token = _get_access_token()
    if not access_token:
        raise RuntimeError('Mercado Pago no está configurado. Contacta al administrador.')

    total = Decimal(str(unit_price)) * units
    external_reference = f'ev-{campus.id}-{user.id}-{uuid.uuid4().hex[:12]}'

    # Crear registro en BD
    payment = Payment(
        user_id=user.id,
        campus_id=campus.id,
        units=units,
        unit_price=Decimal(str(unit_price)),
        total_amount=total,
        mp_external_reference=external_reference,
        status='pending',
    )
    db.session.add(payment)
    db.session.flush()

    api_url = os.getenv('API_URL', 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io')

    payment_body = {
        'transaction_amount': float(total),
        'token': token,
        'description': f'Vouchers de certificación — {campus.name}',
        'installments': int(installments),
        'payment_method_id': payment_method_id,
        'external_reference': external_reference,
        'notification_url': f'{api_url}/api/payments/webhook',
        'statement_descriptor': 'EVALUAASI',
        'payer': {
            'email': payer_email or user.email,
        },
    }

    if issuer_id:
        payment_body['issuer_id'] = str(issuer_id)

    try:
        resp = http_requests.post(
            f'{MP_API_BASE}/v1/payments',
            json=payment_body,
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
                'X-Idempotency-Key': external_reference,
            },
            timeout=30,
        )
    except http_requests.RequestException as e:
        payment.status = 'error'
        db.session.commit()
        logger.exception('Error de red al procesar pago: %s', e)
        raise RuntimeError('Error de comunicación con Mercado Pago. Intenta de nuevo.')

    mp_data = resp.json()

    # Actualizar registro con respuesta de MP
    payment.mp_payment_id = str(mp_data.get('id', ''))
    payment.mp_status = mp_data.get('status', '')
    payment.mp_status_detail = mp_data.get('status_detail', '')
    payment.mp_payment_method = mp_data.get('payment_method_id', '')
    payment.mp_payment_type = mp_data.get('payment_type_id', '')

    if resp.status_code not in (200, 201):
        # Pago rechazado o error
        payment.status = 'rejected'
        db.session.commit()

        # Extraer mensaje amigable
        cause = mp_data.get('cause', [])
        error_msg = 'El pago fue rechazado.'
        if cause and isinstance(cause, list) and len(cause) > 0:
            error_msg = cause[0].get('description', error_msg)
        elif mp_data.get('message'):
            error_msg = mp_data['message']

        logger.warning('Pago rechazado por MP: status=%s detail=%s cause=%s',
                       mp_data.get('status'), mp_data.get('status_detail'), cause)
        raise ValueError(error_msg)

    # Mapear estado
    status_map = {
        'approved': 'approved',
        'pending': 'processing',
        'in_process': 'processing',
        'rejected': 'rejected',
        'cancelled': 'cancelled',
        'refunded': 'refunded',
        'charged_back': 'charged_back',
        'in_mediation': 'in_mediation',
    }
    payment.status = status_map.get(mp_data.get('status', ''), 'pending')

    # Si aprobado → acreditar vouchers
    if mp_data.get('status') == 'approved' and not payment.credits_applied:
        _apply_credits(payment)

    db.session.commit()

    logger.info('Pago directo procesado: payment=%s, mp_status=%s, credits_applied=%s',
                payment.id, mp_data.get('status'), payment.credits_applied)

    return {
        'payment_id': payment.id,
        'status': payment.status,
        'mp_status': payment.mp_status,
        'mp_status_detail': payment.mp_status_detail,
        'mp_payment_id': payment.mp_payment_id,
        'credits_applied': payment.credits_applied,
    }


# ─── Procesar pago de candidato (certificación o retoma) ─────────────────────

def process_candidate_payment(user, campus, group_exam, unit_price, payment_type,
                              token, payment_method_id, installments=1,
                              issuer_id=None, payer_email=None):
    """Procesa un pago directo de un candidato para certificación o retoma.

    Si el pago es aprobado:
      - Para 'certification': acredita al CoordinatorBalance
      - Para 'retake': crea un EcmRetake + acredita al CoordinatorBalance

    Args:
        user: Candidato que paga
        campus: Campus del grupo
        group_exam: GroupExam (asignación)
        unit_price: Precio a cobrar
        payment_type: 'certification' o 'retake'
        token: Token de tarjeta MP
        payment_method_id: Método de pago
        installments: Cuotas
        issuer_id: Emisor (opcional)
        payer_email: Email del pagador

    Returns:
        dict con resultado del pago
    """
    access_token = _get_access_token()
    if not access_token:
        raise RuntimeError('Mercado Pago no está configurado. Contacta al administrador.')

    total = Decimal(str(unit_price))
    external_reference = f'ev-cand-{campus.id}-{user.id}-{group_exam.id}-{uuid.uuid4().hex[:8]}'

    label = 'Certificación' if payment_type == 'certification' else 'Retoma'

    payment = Payment(
        user_id=user.id,
        campus_id=campus.id,
        group_exam_id=group_exam.id,
        payment_type=payment_type,
        units=1,
        unit_price=total,
        total_amount=total,
        mp_external_reference=external_reference,
        status='pending',
    )
    db.session.add(payment)
    db.session.flush()

    api_url = os.getenv('API_URL', 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io')

    payment_body = {
        'transaction_amount': float(total),
        'token': token,
        'description': f'{label} — {campus.name}',
        'installments': int(installments),
        'payment_method_id': payment_method_id,
        'external_reference': external_reference,
        'notification_url': f'{api_url}/api/payments/webhook',
        'statement_descriptor': 'EVALUAASI',
        'payer': {
            'email': payer_email or user.email,
        },
    }

    if issuer_id:
        payment_body['issuer_id'] = str(issuer_id)

    try:
        resp = http_requests.post(
            f'{MP_API_BASE}/v1/payments',
            json=payment_body,
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
                'X-Idempotency-Key': external_reference,
            },
            timeout=30,
        )
    except http_requests.RequestException as e:
        payment.status = 'error'
        db.session.commit()
        logger.exception('Error de red al procesar pago candidato: %s', e)
        raise RuntimeError('Error de comunicación con Mercado Pago. Intenta de nuevo.')

    mp_data = resp.json()

    payment.mp_payment_id = str(mp_data.get('id', ''))
    payment.mp_status = mp_data.get('status', '')
    payment.mp_status_detail = mp_data.get('status_detail', '')
    payment.mp_payment_method = mp_data.get('payment_method_id', '')
    payment.mp_payment_type = mp_data.get('payment_type_id', '')

    if resp.status_code not in (200, 201):
        payment.status = 'rejected'
        db.session.commit()

        cause = mp_data.get('cause', [])
        error_msg = 'El pago fue rechazado.'
        if cause and isinstance(cause, list) and len(cause) > 0:
            error_msg = cause[0].get('description', error_msg)
        elif mp_data.get('message'):
            error_msg = mp_data['message']

        logger.warning('Pago candidato rechazado: status=%s detail=%s',
                       mp_data.get('status'), mp_data.get('status_detail'))
        raise ValueError(error_msg)

    status_map = {
        'approved': 'approved',
        'pending': 'processing',
        'in_process': 'processing',
        'rejected': 'rejected',
        'cancelled': 'cancelled',
        'refunded': 'refunded',
        'charged_back': 'charged_back',
        'in_mediation': 'in_mediation',
    }
    payment.status = status_map.get(mp_data.get('status', ''), 'pending')

    result_data = {
        'payment_id': payment.id,
        'status': payment.status,
        'mp_status': payment.mp_status,
        'mp_status_detail': payment.mp_status_detail,
        'mp_payment_id': payment.mp_payment_id,
        'credits_applied': False,
    }

    if mp_data.get('status') == 'approved' and not payment.credits_applied:
        _apply_candidate_credits(payment, payment_type)
        result_data['credits_applied'] = True

        # Si es retoma, crear el EcmRetake inmediatamente
        if payment_type == 'retake':
            retake = _create_retake_for_payment(payment, group_exam)
            if retake:
                result_data['retake_id'] = retake.id

    db.session.commit()

    logger.info('Pago candidato procesado: payment=%s, type=%s, mp_status=%s, credits_applied=%s',
                payment.id, payment_type, mp_data.get('status'), payment.credits_applied)

    return result_data


def _apply_candidate_credits(payment, payment_type):
    """Acredita el pago del candidato al CoordinatorBalance.

    Busca el coordinador a través del campus → partner → coordinator.
    """
    from app.models.user import User
    from app.models.partner import Campus, CandidateGroup, GroupExam

    campus = Campus.query.get(payment.campus_id)
    if not campus:
        logger.error('No se pudo acreditar pago candidato: campus=%s no encontrado', payment.campus_id)
        return

    # Encontrar coordinador: campus → partner → coordinator
    # O buscar el responsable del campus y su coordinator_id
    coordinator_id = None

    if campus.responsable_id:
        responsable = User.query.get(campus.responsable_id)
        if responsable:
            coordinator_id = getattr(responsable, 'coordinator_id', None)

    if not coordinator_id and campus.partner_id:
        from app.models.partner import Partner
        partner = Partner.query.get(campus.partner_id)
        if partner:
            coordinator_id = partner.coordinator_id

    if not coordinator_id:
        logger.error('No se encontró coordinador para campus=%s — no se puede acreditar pago candidato %s',
                      payment.campus_id, payment.id)
        return

    label = 'Certificación' if payment_type == 'certification' else 'Retoma'
    user = User.query.get(payment.user_id)
    user_name = f'{user.name} {user.first_surname}' if user else f'Usuario {payment.user_id}'
    amount = float(payment.total_amount)

    create_balance_transaction(
        coordinator_id=coordinator_id,
        campus_id=payment.campus_id,
        transaction_type='credit',
        concept='pago_en_linea',
        amount=amount,
        reference_type='payment',
        reference_id=payment.id,
        notes=f'Pago candidato #{payment.id} — {label} — {user_name} — MP ID: {payment.mp_payment_id}',
        created_by_id=payment.user_id,
    )

    payment.credits_applied = True
    payment.credits_applied_at = datetime.utcnow()
    logger.info('Créditos candidato aplicados: payment=%s, coordinator=%s, campus=%s, amount=%s',
                payment.id, coordinator_id, payment.campus_id, amount)


def _create_retake_for_payment(payment, group_exam):
    """Crea un EcmRetake para un pago de retoma aprobado."""
    from app.models.partner import EcmRetake

    try:
        retake = EcmRetake(
            group_exam_id=group_exam.id,
            user_id=payment.user_id,
            cost=float(payment.total_amount),
            status='approved',
        )
        db.session.add(retake)
        db.session.flush()
        logger.info('EcmRetake creada: retake=%s, payment=%s, user=%s',
                     retake.id, payment.id, payment.user_id)
        return retake
    except Exception as e:
        logger.exception('Error creando EcmRetake para pago %s: %s', payment.id, e)
        return None


# ─── Procesar notificación webhook ───────────────────────────────────────────

def verify_webhook_signature(request_id, data_id, timestamp, received_signature):
    """Verifica la firma HMAC del webhook de Mercado Pago.

    MP envía el header x-signature con formato: ts=XXXX,v1=YYYY
    La firma se calcula como: HMAC-SHA256(secret, "id:{data_id};request-id:{request_id};ts:{ts};")

    Returns:
        True si la firma es válida o si no hay secret configurado (modo desarrollo)
    """
    secret = _get_webhook_secret()
    if not secret:
        logger.warning('MP_WEBHOOK_SECRET no configurado — omitiendo verificación de firma')
        return True

    manifest = f'id:{data_id};request-id:{request_id};ts:{timestamp};'
    expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received_signature)


def process_webhook_notification(topic, data_id, full_body=None):
    """Procesa una notificación webhook de Mercado Pago.

    Args:
        topic: Tipo de notificación ('payment', 'merchant_order', etc.)
        data_id: ID del recurso en MP
        full_body: Body completo del webhook (para logging)

    Returns:
        True si se procesó correctamente
    """
    if topic != 'payment':
        logger.info('Webhook ignorado — topic: %s', topic)
        return True

    access_token = _get_access_token()
    if not access_token:
        logger.error('No se puede procesar webhook: MP_ACCESS_TOKEN no configurado')
        return False

    # Consultar datos del pago a MP
    resp = http_requests.get(
        f'{MP_API_BASE}/v1/payments/{data_id}',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=15,
    )

    if resp.status_code != 200:
        logger.error('Error consultando pago %s: %s', data_id, resp.status_code)
        return False

    mp_payment = resp.json()
    external_ref = mp_payment.get('external_reference', '')
    mp_status = mp_payment.get('status', '')
    mp_status_detail = mp_payment.get('status_detail', '')

    # Buscar el pago en nuestra BD
    payment = Payment.query.filter_by(mp_external_reference=external_ref).first()
    if not payment:
        # Intentar por mp_payment_id
        payment = Payment.query.filter_by(mp_payment_id=str(data_id)).first()

    if not payment:
        logger.warning('Pago no encontrado para external_reference=%s, mp_payment_id=%s', external_ref, data_id)
        return False

    # Actualizar datos del pago
    payment.mp_payment_id = str(data_id)
    payment.mp_status = mp_status
    payment.mp_status_detail = mp_status_detail
    payment.mp_payment_method = mp_payment.get('payment_method_id', '')
    payment.mp_payment_type = mp_payment.get('payment_type_id', '')
    payment.webhook_data = json.dumps(full_body or {})

    # Mapear estado MP → estado interno
    status_map = {
        'approved': 'approved',
        'pending': 'processing',
        'in_process': 'processing',
        'rejected': 'rejected',
        'cancelled': 'cancelled',
        'refunded': 'refunded',
        'charged_back': 'charged_back',
        'in_mediation': 'in_mediation',
    }
    payment.status = status_map.get(mp_status, 'pending')

    # Si fue aprobado y aún no se acreditaron los vouchers → acreditar
    if mp_status == 'approved' and not payment.credits_applied:
        pt = getattr(payment, 'payment_type', 'voucher') or 'voucher'
        if pt in ('certification', 'retake'):
            _apply_candidate_credits(payment, pt)
            # Si es retoma, crear el EcmRetake
            if pt == 'retake' and payment.group_exam_id:
                from app.models.partner import GroupExam
                ge = GroupExam.query.get(payment.group_exam_id)
                if ge:
                    _create_retake_for_payment(payment, ge)
        else:
            _apply_credits(payment)

    db.session.commit()
    logger.info('Webhook procesado: payment=%s, mp_status=%s, credits_applied=%s',
                payment.id, mp_status, payment.credits_applied)
    return True


def _apply_credits(payment):
    """Acredita los vouchers al saldo del coordinador del campus.

    El flujo es: pago aprobado → se acredita al CoordinatorBalance del campus.
    Se busca al coordinador vinculado al responsable que pagó.
    """
    from app.models.user import User
    from app.models.partner import Campus

    user = User.query.get(payment.user_id)
    campus = Campus.query.get(payment.campus_id)

    if not user or not campus:
        logger.error('No se pudo acreditar: user=%s campus=%s', payment.user_id, payment.campus_id)
        return

    # Determinar coordinador: usar coordinator_id del responsable
    coordinator_id = getattr(user, 'coordinator_id', None)
    if not coordinator_id:
        logger.error('Responsable %s no tiene coordinador asignado — no se puede acreditar pago %s',
                      user.id, payment.id)
        return

    amount = float(payment.total_amount)

    create_balance_transaction(
        coordinator_id=coordinator_id,
        campus_id=payment.campus_id,
        transaction_type='credit',
        concept='pago_en_linea',
        amount=amount,
        reference_type='payment',
        reference_id=payment.id,
        notes=f'Pago en línea #{payment.id} — {payment.units} vouchers × ${float(payment.unit_price):.2f} — MP ID: {payment.mp_payment_id}',
        created_by_id=user.id,
    )

    payment.credits_applied = True
    payment.credits_applied_at = datetime.utcnow()
    logger.info('Créditos aplicados: payment=%s, coordinator=%s, campus=%s, amount=%s',
                payment.id, coordinator_id, payment.campus_id, amount)


# ─── Consultar estado de un pago ─────────────────────────────────────────────

def get_payment_status_from_mp(mp_payment_id):
    """Consulta el estado actual de un pago directamente a la API de MP.

    Returns:
        dict con datos del pago o None si error
    """
    access_token = _get_access_token()
    if not access_token:
        return None

    resp = http_requests.get(
        f'{MP_API_BASE}/v1/payments/{mp_payment_id}',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=15,
    )

    if resp.status_code != 200:
        return None

    return resp.json()
