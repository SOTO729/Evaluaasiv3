"""
Servicio de envío de emails usando Azure Communication Services.

Uso:
    from app.services.email_service import send_email, send_welcome_email, ...

    # Envío genérico
    send_email(to="user@example.com", subject="Asunto", html="<h1>Hola</h1>")
    
    # Envíos especializados
    send_welcome_email(user, temporary_password)
    send_password_reset_email(user, reset_url)
    send_exam_result_email(user, exam_name, score, passed)
    send_certificate_ready_email(user, cert_type, cert_name)
    send_approval_request_email(gerente, request_data)
    send_contact_form_email(name, email, message)
"""
import os
import logging
import hashlib
import hmac
import json
import time
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Connection config ───
ACS_CONNECTION_STRING = os.getenv('ACS_CONNECTION_STRING', '')
ACS_SENDER_EMAIL = os.getenv('ACS_SENDER_EMAIL', 'DoNotReply@15832cde-409e-4487-a3e6-d8da9a86f6b8.azurecomm.net')
APP_URL = os.getenv('APP_URL', 'https://app.evaluaasi.com')
API_URL = os.getenv('API_URL', 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io')
CONTACT_RECIPIENT = os.getenv('CONTACT_RECIPIENT', 'contacto@evaluaasi.com')
EMAIL_ACTION_SECRET = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# Token expiration: 7 days
EMAIL_TOKEN_MAX_AGE = 7 * 24 * 3600


def generate_email_action_token(request_id, gerente_id: str, action: str) -> str:
    """Generate a signed token for email action (approve/reject).
    request_id can be int (single) or list[int] (batch).
    """
    import base64
    payload = json.dumps({
        'rid': request_id,           # int or list[int]
        'gid': gerente_id,
        'act': action,
        'ts': int(time.time()),
    }, separators=(',', ':'))
    
    payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip('=')
    sig = hmac.new(EMAIL_ACTION_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{payload_b64}.{sig}"


def verify_email_action_token(token: str) -> dict | None:
    """Verify and decode an email action token. Returns payload or None."""
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        
        payload_b64, sig = parts
        expected_sig = hmac.new(EMAIL_ACTION_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()[:32]
        
        if not hmac.compare_digest(sig, expected_sig):
            return None
        
        import base64
        # Add back padding
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode())
        
        # Check expiration
        if time.time() - payload.get('ts', 0) > EMAIL_TOKEN_MAX_AGE:
            return None
        
        return payload
    except Exception:
        return None


def _get_client():
    """Obtener cliente de email ACS (lazy init)."""
    if not ACS_CONNECTION_STRING:
        logger.warning("ACS_CONNECTION_STRING no configurado — emails deshabilitados")
        return None
    try:
        from azure.communication.email import EmailClient
        return EmailClient.from_connection_string(ACS_CONNECTION_STRING)
    except Exception as e:
        logger.error(f"Error creando EmailClient: {e}")
        return None


def send_email(
    to: str,
    subject: str,
    html: str,
    plain_text: Optional[str] = None,
    sender: Optional[str] = None,
    reply_to: Optional[str] = None,
    attachments: Optional[list] = None,
    cc: Optional[list] = None,
) -> bool:
    """
    Enviar un email.
    
    Args:
        to: Dirección del destinatario principal
        subject: Asunto del correo
        html: Contenido HTML
        plain_text: Contenido texto plano (opcional)
        sender: Dirección del remitente (opcional, usa default ACS)
        reply_to: Dirección de respuesta (opcional)
        attachments: Lista de dicts con {name, content_type, content_base64} (opcional)
        cc: Lista de direcciones de correo para CC (opcional)
    
    Returns True si se envió correctamente, False en caso de error.
    NO lanza excepciones para no interrumpir flujos principales.
    """
    client = _get_client()
    if not client:
        logger.info(f"[EMAIL SKIP] to={to} subject={subject}")
        return False

    try:
        recipients = {"to": [{"address": to}]}
        if cc:
            recipients["cc"] = [{"address": addr} for addr in cc]
        
        message = {
            "senderAddress": sender or ACS_SENDER_EMAIL,
            "recipients": recipients,
            "content": {
                "subject": subject,
                "html": html,
            },
        }
        if plain_text:
            message["content"]["plainText"] = plain_text
        if reply_to:
            message["replyTo"] = [{"address": reply_to}]
        if attachments:
            message["attachments"] = [
                {
                    "name": att["name"],
                    "contentType": att["content_type"],
                    "contentInBase64": att["content_base64"],
                }
                for att in attachments
            ]

        poller = client.begin_send(message)
        result = poller.result()
        logger.info(f"[EMAIL OK] to={to} subject={subject} id={result.get('id', 'n/a')}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL ERROR] to={to} subject={subject} error={e}")
        return False


# ═══════════════════════════════════════════════════════════════
# BASE HTML TEMPLATE
# ═══════════════════════════════════════════════════════════════

LOGO_URL = 'https://thankful-stone-07fbe5410.6.azurestaticapps.net/logo.png'

def _base_template(title: str, body_content: str, footer_extra: str = '') -> str:
    """Template base HTML para todos los emails."""
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:24px 32px;text-align:center;">
                            <img src="{LOGO_URL}" alt="Evaluaasi" width="48" height="48" style="display:block;margin:0 auto 10px;border-radius:10px;" />
                            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Evaluaasi</h1>
                            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Plataforma de Evaluación y Certificación</p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:32px;">
                            {body_content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
                            {footer_extra}
                            <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">
                                Este email fue enviado por Evaluaasi. Si no esperabas este mensaje, puedes ignorarlo.
                            </p>
                            <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;text-align:center;">
                                &copy; {datetime.now().year} Evaluaasi — Todos los derechos reservados
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


def _button(text: str, url: str, color: str = '#2563eb') -> str:
    """Genera un botón CTA para emails."""
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
        <tr>
            <td style="background-color:{color};border-radius:8px;">
                <a href="{url}" target="_blank" style="display:inline-block;padding:12px 32px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.3px;">{text}</a>
            </td>
        </tr>
    </table>"""


def _info_row(label: str, value: str) -> str:
    """Fila de información clave-valor."""
    return f"""<tr>
        <td style="padding:6px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">{label}</td>
        <td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">{value}</td>
    </tr>"""


def _info_table(rows: list) -> str:
    """Tabla de información con filas clave-valor."""
    rows_html = ''.join(_info_row(label, value) for label, value in rows)
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin:16px 0;">
        {rows_html}
    </table>"""


# ═══════════════════════════════════════════════════════════════
# 1. EMAIL DE BIENVENIDA + CONTRASEÑA TEMPORAL
# ═══════════════════════════════════════════════════════════════

def send_welcome_email(user, temporary_password: str) -> bool:
    """Enviar email de bienvenida con credenciales de acceso."""
    if not user.email:
        return False

    full_name = f"{user.name or ''} {user.first_surname or ''}".strip() or user.username or 'Usuario'
    
    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">¡Bienvenido/a a Evaluaasi!</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Hola <strong>{full_name}</strong>, tu cuenta ha sido creada exitosamente.
            A continuación encontrarás tus credenciales de acceso:
        </p>
        
        {_info_table([
            ('Usuario', user.username or user.email),
            ('Contraseña temporal', temporary_password),
            ('Email', user.email),
        ])}
        
        <div style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px 0;">
            <p style="margin:0;color:#92400e;font-size:13px;">
                <strong>⚠️ Importante:</strong> Te recomendamos cambiar tu contraseña después de tu primer inicio de sesión.
            </p>
        </div>
        
        {_button('Iniciar Sesión', f'{APP_URL}/login')}
        
        <p style="color:#9ca3af;font-size:12px;text-align:center;">
            Si tienes problemas para iniciar sesión, contacta a tu coordinador.
        </p>
    """
    
    return send_email(
        to=user.email,
        subject="[Evaluaasi] ¡Bienvenido/a! — Tus credenciales de acceso",
        html=_base_template("Bienvenido a Evaluaasi", body),
        plain_text=f"Bienvenido a Evaluaasi. Usuario: {user.username or user.email}. Contraseña temporal: {temporary_password}. Inicia sesión en {APP_URL}/login",
    )


# ═══════════════════════════════════════════════════════════════
# 2. RECUPERACIÓN DE CONTRASEÑA
# ═══════════════════════════════════════════════════════════════

def send_password_reset_email(user, reset_token: str) -> bool:
    """Enviar email con link de recuperación de contraseña."""
    if not user.email:
        return False

    full_name = f"{user.name or ''} {user.first_surname or ''}".strip() or 'Usuario'
    reset_url = f"{APP_URL}/reset-password?token={reset_token}"
    
    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Recuperación de contraseña</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Hola <strong>{full_name}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta.
        </p>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Haz clic en el siguiente botón para crear una nueva contraseña:
        </p>
        
        {_button('Restablecer Contraseña', reset_url)}
        
        <div style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px 0;">
            <p style="margin:0;color:#92400e;font-size:13px;">
                <strong>⚠️</strong> Este enlace expira en <strong>1 hora</strong>. Si no solicitaste este cambio, ignora este email.
            </p>
        </div>
        
        <p style="color:#9ca3af;font-size:12px;">
            Si el botón no funciona, copia y pega esta URL en tu navegador:<br>
            <span style="color:#6b7280;word-break:break-all;">{reset_url}</span>
        </p>
    """
    
    return send_email(
        to=user.email,
        subject="[Evaluaasi] Restablecer contraseña",
        html=_base_template("Recuperar contraseña", body),
        plain_text=f"Recuperación de contraseña Evaluaasi. Visita: {reset_url} (expira en 1 hora)",
    )


# ═══════════════════════════════════════════════════════════════
# 3. NOTIFICACIÓN DE RESULTADOS DE EXAMEN
# ═══════════════════════════════════════════════════════════════

def send_exam_result_email(user, exam_name: str, score: float, passed: bool, ecm_code: str = None) -> bool:
    """Enviar notificación de resultado de examen."""
    if not user.email:
        return False

    full_name = f"{user.name or ''} {user.first_surname or ''}".strip() or 'Usuario'
    
    if passed:
        status_html = '<span style="color:#059669;font-weight:700;font-size:16px;">✅ APROBADO</span>'
        status_text = 'Aprobado'
        message = "¡Felicidades! Has completado exitosamente tu evaluación."
        color_bg = '#ecfdf5'
        color_border = '#059669'
    else:
        status_html = '<span style="color:#dc2626;font-weight:700;font-size:16px;">❌ NO APROBADO</span>'
        status_text = 'No Aprobado'
        message = "Lamentablemente no alcanzaste la calificación mínima. Puedes intentarlo de nuevo."
        color_bg = '#fef2f2'
        color_border = '#dc2626'

    info_rows = [
        ('Examen', exam_name),
        ('Calificación', f'{score}'),
        ('Resultado', status_text),
    ]
    if ecm_code:
        info_rows.insert(0, ('Estándar ECM', ecm_code))

    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Resultado de tu evaluación</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Hola <strong>{full_name}</strong>, {message}
        </p>
        
        <div style="background-color:{color_bg};border-left:4px solid {color_border};border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;text-align:center;">
            {status_html}
        </div>
        
        {_info_table(info_rows)}
        
        {_button('Ver mis resultados', f'{APP_URL}/dashboard')}
    """
    
    return send_email(
        to=user.email,
        subject=f"[Evaluaasi] Resultado de evaluación: {exam_name}",
        html=_base_template("Resultado de evaluación", body),
        plain_text=f"Resultado: {exam_name}. Calificación: {score}. {status_text}.",
    )


# ═══════════════════════════════════════════════════════════════
# 4. CERTIFICADO LISTO
# ═══════════════════════════════════════════════════════════════

def send_certificate_ready_email(user, cert_type: str, cert_name: str, download_url: str = None) -> bool:
    """Notificar que un certificado está listo para descargar."""
    if not user.email:
        return False

    full_name = f"{user.name or ''} {user.first_surname or ''}".strip() or 'Usuario'
    
    type_labels = {
        'reporte_evaluacion': 'Reporte de Evaluación',
        'certificado_eduit': 'Certificado EduIT',
        'conocer': 'Certificado CONOCER',
        'insignia_digital': 'Insignia Digital',
    }
    cert_type_label = type_labels.get(cert_type, cert_type)
    
    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">🎓 ¡Tu certificado está listo!</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Hola <strong>{full_name}</strong>, nos complace informarte que tu certificado ya está disponible.
        </p>
        
        {_info_table([
            ('Tipo', cert_type_label),
            ('Certificado', cert_name),
        ])}
        
        <div style="background-color:#ecfdf5;border:1px solid #059669;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
            <p style="margin:0;color:#065f46;font-size:14px;font-weight:600;">
                Tu certificado puede ser verificado en línea escaneando el código QR incluido en el documento.
            </p>
        </div>
        
        {_button('Ver mi certificado', download_url or f'{APP_URL}/dashboard')}
    """
    
    return send_email(
        to=user.email,
        subject=f"[Evaluaasi] Tu {cert_type_label} está listo",
        html=_base_template("Certificado listo", body),
        plain_text=f"Tu {cert_type_label} ({cert_name}) está listo. Descárgalo en {APP_URL}/dashboard",
    )


# ═══════════════════════════════════════════════════════════════
# 5. EMAIL DE APROBACIÓN/RECHAZO DE SALDO (GERENTE)
# ═══════════════════════════════════════════════════════════════

def send_balance_approval_email(
    gerente_email: str,
    gerente_name: str,
    gerente_id: str,
    request_id: int,
    coordinator_name: str,
    campus_name: str,
    amount: float,
    request_type: str,
    justification: str,
    financiero_notes: str = None,
    recommended_amount: float = None,
    has_financiero_review: bool = False,
) -> bool:
    """
    Enviar email al gerente con botones para aprobar o rechazar solicitud de saldo.
    Los botones ejecutan la acción directamente vía token (sin necesidad de iniciar sesión).
    Si no hay revisión del financiero, se incluye un botón para esperar.
    """
    if not gerente_email:
        return False

    type_label = 'Beca' if request_type == 'beca' else 'Recarga de saldo'
    
    # Generar tokens firmados para cada acción
    approve_token = generate_email_action_token(request_id, gerente_id, 'approve')
    reject_token = generate_email_action_token(request_id, gerente_id, 'reject')
    approve_url = f"{API_URL}/api/balance/email-action/{approve_token}"
    reject_url = f"{API_URL}/api/balance/email-action/{reject_token}"
    detail_url = f"{APP_URL}/gerente/aprobaciones/{request_id}"

    financiero_section = ''
    if financiero_notes:
        rec_amount_text = f"${recommended_amount:,.2f}" if recommended_amount else 'N/A'
        financiero_section = f"""
        <div style="background-color:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;color:#1e40af;font-size:13px;font-weight:600;">📋 Revisión del financiero:</p>
            <p style="margin:0 0 4px;color:#1e3a5f;font-size:13px;">{financiero_notes}</p>
            <p style="margin:8px 0 0;color:#1e3a5f;font-size:13px;">Monto recomendado: <strong>{rec_amount_text}</strong></p>
        </div>
        """

    # Sección de aviso si no hay revisión financiera
    no_review_warning = ''
    if not has_financiero_review:
        no_review_warning = """
        <div style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#92400e;font-size:13px;">
                <strong>⚠️ Sin revisión financiera:</strong> Esta solicitud aún no ha sido revisada por el área financiera.
                Puede aprobarla directamente o esperar la revisión del financiero.
            </p>
        </div>
        """

    # Botones: Aprobar / Rechazar / (Esperar si no hay revisión financiera)
    wait_button = ''
    if not has_financiero_review:
        wait_button = f"""
                <td align="center" style="padding:0 4px;">
                    <a href="{detail_url}" target="_blank" style="display:inline-block;padding:14px 24px;background-color:#6b7280;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;letter-spacing:0.3px;">⏳ Esperar revisión</a>
                </td>"""

    amount_display = f"${recommended_amount:,.2f}" if recommended_amount else f"${amount:,.2f}"

    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Solicitud pendiente de aprobación</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Hola <strong>{gerente_name}</strong>, hay una solicitud de <strong>{type_label}</strong> que requiere tu aprobación:
        </p>
        
        {_info_table([
            ('Solicitante', coordinator_name),
            ('Plantel', campus_name),
            ('Tipo', type_label),
            ('Monto solicitado', f'${amount:,.2f} MXN'),
            ('Justificación', justification[:200] + ('...' if len(justification) > 200 else '')),
        ])}
        
        {financiero_section}
        {no_review_warning}
        
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
            <tr>
                <td align="center" style="padding:0 4px;">
                    <a href="{approve_url}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;letter-spacing:0.3px;">✅ Aprobar ({amount_display})</a>
                </td>
                <td align="center" style="padding:0 4px;">
                    <a href="{reject_url}" target="_blank" style="display:inline-block;padding:14px 28px;background-color:#dc2626;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;letter-spacing:0.3px;">❌ Rechazar</a>
                </td>{wait_button}
            </tr>
        </table>
        
        <p style="color:#9ca3af;font-size:12px;text-align:center;">
            Al hacer clic, la acción se ejecutará directamente. Este enlace es válido por 7 días.
            <br/>
            <a href="{detail_url}" style="color:#6366f1;">Ver detalle en la plataforma</a>
        </p>
    """
    
    return send_email(
        to=gerente_email,
        subject=f"[Evaluaasi] Nueva solicitud de {type_label} — {coordinator_name} — ${amount:,.2f}",
        html=_base_template("Solicitud de aprobación", body),
        plain_text=f"Solicitud de {type_label} por ${amount:,.2f} de {coordinator_name}. Aprueba: {approve_url} | Rechaza: {reject_url}",
    )


# ═══════════════════════════════════════════════════════════════
# 5a-batch. EMAIL DE APROBACIÓN DE SALDO CONSOLIDADO (GERENTE)
# ═══════════════════════════════════════════════════════════════

def send_balance_batch_approval_email(
    gerente_email: str,
    gerente_name: str,
    gerente_id: str,
    coordinator_name: str,
    justification: str,
    items: list,  # [{request_id, campus_name, group_name, amount, request_type}]
    has_financiero_review: bool = False,
) -> bool:
    """
    Enviar un solo email al gerente con TODAS las solicitudes en una tabla desglosada.
    items = lista de dicts con request_id, campus_name, group_name, amount, request_type.
    """
    if not gerente_email or not items:
        return False

    total_amount = sum(item['amount'] for item in items)
    request_ids = [item['request_id'] for item in items]
    all_types = set(item.get('request_type', 'saldo') for item in items)
    type_label = 'Becas' if all_types == {'beca'} else 'Recargas de saldo' if all_types == {'saldo'} else 'Solicitudes de saldo/beca'

    # Tokens para aprobar o rechazar TODAS las solicitudes de golpe
    approve_token = generate_email_action_token(request_ids, gerente_id, 'approve')
    reject_token = generate_email_action_token(request_ids, gerente_id, 'reject')
    approve_url = f"{API_URL}/api/balance/email-action/{approve_token}"
    reject_url = f"{API_URL}/api/balance/email-action/{reject_token}"
    detail_url = f"{APP_URL}/gerente/aprobaciones"

    # Construir filas de la tabla desglosada
    table_rows = ''
    for i, item in enumerate(items):
        bg = '#ffffff' if i % 2 == 0 else '#f9fafb'
        item_type = 'Beca' if item.get('request_type') == 'beca' else 'Saldo'
        table_rows += f"""<tr style="background-color:{bg};">
            <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">{item['campus_name']}</td>
            <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">{item.get('group_name', 'N/A')}</td>
            <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;text-align:center;">
                <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;{'background:#ecfdf5;color:#065f46;' if item_type == 'Saldo' else 'background:#f5f3ff;color:#5b21b6;'}">{item_type}</span>
            </td>
            <td style="padding:10px 12px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;text-align:right;">${item['amount']:,.2f}</td>
        </tr>"""

    # Fila total
    table_rows += f"""<tr style="background-color:#eff6ff;">
        <td colspan="3" style="padding:12px;font-size:14px;font-weight:700;color:#1e40af;border-top:2px solid #2563eb;">TOTAL</td>
        <td style="padding:12px;font-size:14px;font-weight:700;color:#1e40af;border-top:2px solid #2563eb;text-align:right;">${total_amount:,.2f} MXN</td>
    </tr>"""

    items_table = f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0;">
        <thead>
            <tr style="background-color:#1e40af;">
                <th style="padding:10px 12px;font-size:12px;font-weight:600;color:#ffffff;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Plantel</th>
                <th style="padding:10px 12px;font-size:12px;font-weight:600;color:#ffffff;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Grupo</th>
                <th style="padding:10px 12px;font-size:12px;font-weight:600;color:#ffffff;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">Tipo</th>
                <th style="padding:10px 12px;font-size:12px;font-weight:600;color:#ffffff;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Monto</th>
            </tr>
        </thead>
        <tbody>{table_rows}</tbody>
    </table>"""

    # Aviso si no tiene revisión financiera
    no_review_warning = ''
    if not has_financiero_review:
        no_review_warning = """
        <div style="background-color:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:14px 16px;margin:16px 0;">
            <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                <strong>⚠️ Sin revisión financiera:</strong> Estas solicitudes aún no han sido revisadas por el área financiera.
                Puede aprobarlas directamente o esperar la revisión.
            </p>
        </div>
        """

    # Botón Esperar
    wait_button = ''
    if not has_financiero_review:
        wait_button = f"""
                <td align="center" style="padding:0 4px;">
                    <a href="{detail_url}" target="_blank" style="display:inline-block;padding:14px 20px;background-color:#6b7280;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">⏳ Esperar</a>
                </td>"""

    count_label = f"{len(items)} solicitud{'es' if len(items) > 1 else ''}"

    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Nuevas solicitudes pendientes de aprobación</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Hola <strong>{gerente_name}</strong>, <strong>{coordinator_name}</strong> ha enviado
            <strong>{count_label}</strong> que requiere{'n' if len(items) > 1 else ''} tu aprobación:
        </p>
        
        {_info_table([
            ('Solicitante', coordinator_name),
            ('Cantidad de solicitudes', str(len(items))),
            ('Total solicitado', f'${total_amount:,.2f} MXN'),
            ('Justificación', justification[:200] + ('...' if len(justification) > 200 else '')),
        ])}
        
        {items_table}
        {no_review_warning}
        
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
            <tr>
                <td align="center" style="padding:0 4px;">
                    <a href="{approve_url}" target="_blank" style="display:inline-block;padding:14px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">✅ Aprobar todas (${total_amount:,.2f})</a>
                </td>
                <td align="center" style="padding:0 4px;">
                    <a href="{reject_url}" target="_blank" style="display:inline-block;padding:14px 24px;background-color:#dc2626;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">❌ Rechazar todas</a>
                </td>{wait_button}
            </tr>
        </table>
        
        <p style="color:#9ca3af;font-size:12px;text-align:center;">
            Al hacer clic, la acción se ejecutará directamente para todas las solicitudes. Enlace válido por 7 días.
            <br/>
            <a href="{detail_url}" style="color:#6366f1;">Ver detalles en la plataforma</a>
        </p>
    """
    
    return send_email(
        to=gerente_email,
        subject=f"[Evaluaasi] {count_label} de {coordinator_name} — ${total_amount:,.2f} pendiente{'s' if len(items) > 1 else ''} de aprobación",
        html=_base_template("Solicitudes de aprobación", body),
        plain_text=f"{count_label} por ${total_amount:,.2f} de {coordinator_name}. Aprobar: {approve_url} | Rechazar: {reject_url}",
    )


# ═══════════════════════════════════════════════════════════════
# 5b. NOTIFICACIÓN DE APROBACIÓN POR FINANCIERO DELEGADO (AL GERENTE)
# ═══════════════════════════════════════════════════════════════

def send_balance_delegation_notification_email(
    gerente_email: str,
    gerente_name: str,
    request_id: int,
    coordinator_name: str,
    campus_name: str,
    amount_requested: float,
    amount_approved: float,
    request_type: str,
    justification: str,
    financiero_name: str,
    financiero_notes: str = '',
) -> bool:
    """
    Notificar al gerente que un financiero con delegación aprobó una solicitud.
    Email informativo (sin botones de acción ya que la solicitud fue procesada).
    """
    if not gerente_email:
        return False

    type_label = 'Beca' if request_type == 'beca' else 'Recarga de saldo'
    detail_url = f"{APP_URL}/gerente/aprobaciones/{request_id}"

    notes_section = ''
    if financiero_notes:
        notes_section = f"""
        <div style="background-color:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;color:#1e40af;font-size:13px;font-weight:600;">📋 Notas del financiero:</p>
            <p style="margin:0;color:#1e3a5f;font-size:13px;">{financiero_notes}</p>
        </div>
        """

    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Solicitud aprobada por financiero delegado</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Hola <strong>{gerente_name}</strong>, el financiero <strong>{financiero_name}</strong> ha aprobado
            la siguiente solicitud de <strong>{type_label}</strong> mediante delegación:
        </p>
        
        <div style="background-color:#ecfdf5;border-left:4px solid #059669;border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;text-align:center;">
            <span style="color:#059669;font-weight:700;font-size:18px;">✅ APROBADA POR DELEGACIÓN</span>
        </div>
        
        {_info_table([
            ('Solicitante', coordinator_name),
            ('Plantel', campus_name),
            ('Tipo', type_label),
            ('Monto solicitado', f'${amount_requested:,.2f} MXN'),
            ('Monto aprobado', f'${amount_approved:,.2f} MXN'),
            ('Aprobado por', financiero_name),
            ('Justificación', justification[:200] + ('...' if len(justification) > 200 else '')),
        ])}
        
        {notes_section}
        
        {_button('Ver detalle', detail_url, '#6b7280')}
        
        <p style="color:#9ca3af;font-size:12px;text-align:center;">
            Esta solicitud fue procesada por un financiero con permisos de aprobación delegados.
        </p>
    """
    
    return send_email(
        to=gerente_email,
        subject=f"[Evaluaasi] {type_label} aprobada por delegación — {financiero_name} — ${amount_approved:,.2f}",
        html=_base_template("Aprobación por delegación", body),
        plain_text=f"Solicitud de {type_label} por ${amount_approved:,.2f} aprobada por {financiero_name} (delegación). Detalle: {detail_url}",
    )


# ═══════════════════════════════════════════════════════════════
# 6. FORMULARIO DE CONTACTO
# ═══════════════════════════════════════════════════════════════

def send_contact_form_email(name: str, email: str, subject_text: str, message: str) -> bool:
    """Enviar email del formulario de contacto de la landing page."""
    
    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Nuevo mensaje de contacto</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Se ha recibido un nuevo mensaje desde el formulario de contacto de Evaluaasi:
        </p>
        
        {_info_table([
            ('Nombre', name),
            ('Email', email),
            ('Asunto', subject_text),
        ])}
        
        <div style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:16px;margin:16px 0;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Mensaje:</p>
            <p style="margin:0;color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap;">{message}</p>
        </div>
        
        <p style="color:#9ca3af;font-size:12px;">
            Puedes responder directamente a <a href="mailto:{email}" style="color:#2563eb;">{email}</a>
        </p>
    """
    
    return send_email(
        to=CONTACT_RECIPIENT,
        subject=f"[Evaluaasi] Contacto: {subject_text}",
        html=_base_template("Nuevo mensaje de contacto", body),
        reply_to=email,
        plain_text=f"Mensaje de {name} ({email}): {message}",
    )


# ═══════════════════════════════════════════════════════════════
# 7. NOTIFICACIÓN DE RESOLUCIÓN DE SOLICITUD (AL COORDINADOR)
# ═══════════════════════════════════════════════════════════════

def send_balance_resolution_email(
    coordinator_email: str,
    coordinator_name: str,
    approved: bool,
    amount: float,
    request_type: str,
    approver_notes: str = '',
) -> bool:
    """Notificar al coordinador que su solicitud fue aprobada o rechazada."""
    if not coordinator_email:
        return False

    type_label = 'beca' if request_type == 'beca' else 'recarga de saldo'
    
    if approved:
        status_html = '<span style="color:#059669;font-weight:700;font-size:18px;">✅ APROBADA</span>'
        message = f"Tu solicitud de {type_label} ha sido aprobada."
        color_bg = '#ecfdf5'
        color_border = '#059669'
    else:
        status_html = '<span style="color:#dc2626;font-weight:700;font-size:18px;">❌ RECHAZADA</span>'
        message = f"Tu solicitud de {type_label} ha sido rechazada."
        color_bg = '#fef2f2'
        color_border = '#dc2626'

    notes_section = ''
    if approver_notes:
        notes_section = f"""
        <div style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:16px;margin:16px 0;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;">Notas:</p>
            <p style="margin:0;color:#111827;font-size:14px;">{approver_notes}</p>
        </div>
        """

    body = f"""
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Resolución de tu solicitud</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Hola <strong>{coordinator_name}</strong>, {message}
        </p>
        
        <div style="background-color:{color_bg};border-left:4px solid {color_border};border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;text-align:center;">
            {status_html}
        </div>
        
        {_info_table([
            ('Tipo', type_label.title()),
            ('Monto', f'${amount:,.2f} MXN'),
        ])}
        
        {notes_section}
        
        {_button('Ver mi saldo', f'{APP_URL}/mi-saldo')}
    """
    
    subject = f"[Evaluaasi] Tu solicitud de {type_label} fue {'aprobada ✅' if approved else 'rechazada ❌'} — ${amount:,.2f}"
    
    return send_email(
        to=coordinator_email,
        subject=subject,
        html=_base_template("Resolución de solicitud", body),
        plain_text=f"Tu solicitud de {type_label} por ${amount:,.2f} fue {'aprobada' if approved else 'rechazada'}.",
    )
