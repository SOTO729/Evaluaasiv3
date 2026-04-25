"""
Endpoints admin para diagnosticar y probar el envío de email (SMTP).
"""
import logging
import os

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.user import User
from app.services import email_service

logger = logging.getLogger(__name__)

bp = Blueprint('admin_email_check', __name__, url_prefix='/api/admin/email-check')


def _require_admin():
    user = User.query.get(get_jwt_identity())
    if not user or user.role not in ('admin', 'developer'):
        return None, (jsonify({'error': 'No autorizado'}), 403)
    return user, None


@bp.route('/config', methods=['GET'])
@jwt_required()
def get_config():
    """Mostrar configuración SMTP actual (sin la contraseña)."""
    _, err = _require_admin()
    if err:
        return err
    return jsonify({
        'transport': 'smtp' if email_service._smtp_configured() else (
            'acs' if email_service.ACS_CONNECTION_STRING else 'none'
        ),
        'smtp': {
            'host': email_service.SMTP_HOST,
            'port': email_service.SMTP_PORT,
            'use_tls': email_service.SMTP_USE_TLS,
            'use_ssl': email_service.SMTP_USE_SSL,
            'username': email_service.SMTP_USERNAME,
            'default_sender': email_service.SMTP_DEFAULT_SENDER,
            'display_name': email_service.SMTP_DISPLAY_NAME,
            'password_set': bool(email_service.SMTP_PASSWORD),
        },
        'test_email_override': email_service.TEST_EMAIL_OVERRIDE or None,
    })


@bp.route('/send', methods=['POST'])
@jwt_required()
def send_test():
    """
    POST {"to": "destino@correo.com", "kind": "smtp_test|welcome|reset|exam_result|certificate|balance"}
    Envía un correo de prueba real.
    """
    user, err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    to = (data.get('to') or '').strip()
    kind = (data.get('kind') or 'smtp_test').strip().lower()
    if not to:
        return jsonify({'error': 'to requerido'}), 400

    sent = False
    detail = None

    class _U:
        """Stub mínimo compatible con todas las firmas de email_service."""
        id = 'test-uuid-0001'
        username = 'prueba.smtp'
        role = 'candidato'
        name = 'Prueba'
        first_surname = 'SMTP'
        second_surname = ''
        first_name = 'Prueba'
        last_name = 'SMTP'

    try:
        u = _U()
        u.email = to
        if kind == 'smtp_test':
            html = (
                '<h2>Prueba SMTP</h2>'
                '<p>Este correo se envió desde Evaluaasi a través del SMTP configurado.</p>'
                f'<p>Servidor: <code>{email_service.SMTP_HOST}:{email_service.SMTP_PORT}</code></p>'
                f'<p>Sender: <code>{email_service.SMTP_DEFAULT_SENDER}</code></p>'
            )
            sent = email_service.send_email(
                to=to, subject='[Evaluaasi] Prueba SMTP', html=html,
                plain_text='Prueba de SMTP — si recibes esto, el envío funciona.',
            )
        elif kind == 'welcome':
            sent = email_service.send_welcome_email(u, 'TempPass123!')
        elif kind == 'reset':
            sent = email_service.send_password_reset_email(u, 'token-de-prueba-123')
        elif kind == 'exam_result':
            sent = email_service.send_exam_result_email(u, 'Examen de Prueba', 92.5, True, 'ECM0054')
        elif kind == 'certificate':
            sent = email_service.send_certificate_ready_email(u, 'CONOCER', 'Certificado de Prueba',
                                                              'https://app.evaluaasi.com/certificates')
        elif kind == 'verification':
            sent = email_service.send_email_verification(u)
        elif kind == 'reconfirmation':
            sent = email_service.send_email_reconfirmation(u)
        elif kind == 'contact':
            sent = email_service.send_contact_form_email(
                'Prueba', to, 'Prueba SMTP desde admin', 'Mensaje de prueba.'
            )
        elif kind in ('support_reenvio', 'support_registro'):
            tpl = kind.replace('support_', '')
            html = (
                f'<h3>Prueba template soporte: <code>{tpl}</code></h3>'
                f'<p>Hola Prueba SMTP,</p>'
                '<p>Este es un correo del módulo de soporte enviado vía SMTP central.</p>'
            )
            sent = email_service.send_email(
                to=to, subject=f'[Evaluaasi] Soporte — {tpl}', html=html,
                plain_text=f'Prueba template soporte ({tpl}).',
            )
        # ─── Balance: gerente recibe solicitud de aprobación (saldo) ───
        elif kind == 'balance_approval_saldo':
            sent = email_service.send_balance_approval_email(
                gerente_email=to, gerente_name='Gerente Prueba',
                gerente_id='test-gerente-id', request_id=99999,
                coordinator_name='Coordinador Prueba', campus_name='Plantel Demo',
                amount=2500.0, request_type='saldo',
                justification='Justificación de prueba para validar el envío SMTP.',
                financiero_notes='Revisión OK por financiero (prueba)',
                recommended_amount=2500.0, has_financiero_review=True,
            )
        elif kind == 'balance_approval_beca':
            sent = email_service.send_balance_approval_email(
                gerente_email=to, gerente_name='Gerente Prueba',
                gerente_id='test-gerente-id', request_id=99998,
                coordinator_name='Coordinador Prueba', campus_name='Plantel Demo',
                amount=1500.0, request_type='beca',
                justification='Solicitud de beca de prueba.',
                has_financiero_review=False,
            )
        # ─── Balance: gerente recibe lote de solicitudes ───
        elif kind == 'balance_batch':
            sent = email_service.send_balance_batch_approval_email(
                gerente_email=to, gerente_name='Gerente Prueba',
                gerente_id='test-gerente-id',
                coordinator_name='Coordinador Prueba',
                justification='Lote de pruebas SMTP',
                items=[
                    {'request_id': 70001, 'campus_name': 'Plantel A', 'group_name': 'Grupo 1',
                     'amount': 1000.0, 'request_type': 'saldo'},
                    {'request_id': 70002, 'campus_name': 'Plantel B', 'group_name': 'Grupo 2',
                     'amount': 2500.0, 'request_type': 'beca'},
                ],
                has_financiero_review=True,
            )
        # ─── Balance: gerente notificado de aprobación por delegación ───
        elif kind == 'balance_delegation':
            sent = email_service.send_balance_delegation_notification_email(
                gerente_email=to, gerente_name='Gerente Prueba',
                request_id=80001, coordinator_name='Coordinador Prueba',
                campus_name='Plantel Demo', amount_requested=3000.0,
                amount_approved=2800.0, request_type='saldo',
                justification='Necesitamos saldo para certificaciones (prueba).',
                financiero_name='Financiero Delegado', financiero_notes='Aprobado bajo delegación.',
            )
        # ─── Balance: coordinador recibe resolución (aprobada / rechazada) ───
        elif kind == 'balance_resolution_approved':
            sent = email_service.send_balance_resolution_email(
                coordinator_email=to, coordinator_name='Coordinador Prueba',
                approved=True, amount=2500.0, request_type='saldo',
                approver_notes='Aprobado en prueba SMTP.',
            )
        elif kind == 'balance_resolution_rejected':
            sent = email_service.send_balance_resolution_email(
                coordinator_email=to, coordinator_name='Coordinador Prueba',
                approved=False, amount=1500.0, request_type='beca',
                approver_notes='Rechazado en prueba SMTP.',
            )
        # ─── CURP RENAPO (al coordinador) ───
        elif kind == 'curp_valid':
            sent = email_service.send_curp_validation_result_email(
                coordinator_email=to, coordinator_name='Coordinador Prueba',
                candidate_name='Candidato Prueba', curp='SOTD801231HDFRRG09',
                valid=True, renapo_name='DIEGO', renapo_first_surname='SOTO',
                renapo_second_surname='RUIZ',
            )
        elif kind == 'curp_invalid':
            sent = email_service.send_curp_validation_result_email(
                coordinator_email=to, coordinator_name='Coordinador Prueba',
                candidate_name='Candidato Prueba', curp='XXXX000000XXXXXX99',
                valid=False, error_reason='CURP no encontrada en RENAPO (prueba).',
            )
        # ─── VDI (notifica a operaciones — usamos TEST_EMAIL_OVERRIDE) ───
        elif kind == 'vdi_session':
            old_override = os.environ.get('TEST_EMAIL_OVERRIDE', '')
            os.environ['TEST_EMAIL_OVERRIDE'] = to
            email_service.TEST_EMAIL_OVERRIDE = to
            try:
                sent = email_service.send_vdi_session_notification(
                    action='created', candidate_name='Candidato Prueba',
                    candidate_username='prueba.smtp', session_date='2026-04-25',
                    start_hour=12, workstation_name='WS-PRUEBA',
                    campus_name='Plantel Demo', session_type='simulador',
                )
            finally:
                if old_override:
                    os.environ['TEST_EMAIL_OVERRIDE'] = old_override
                    email_service.TEST_EMAIL_OVERRIDE = old_override
                else:
                    os.environ.pop('TEST_EMAIL_OVERRIDE', None)
                    email_service.TEST_EMAIL_OVERRIDE = ''
        else:
            return jsonify({'error': f'kind desconocido: {kind}'}), 400
    except Exception as e:
        logger.exception("admin email-check send failed")
        detail = str(e)

    return jsonify({
        'sent': sent,
        'kind': kind,
        'to': to,
        'transport': 'smtp' if email_service._smtp_configured() else 'acs/none',
        'error': detail,
    }), (200 if sent else 502)
