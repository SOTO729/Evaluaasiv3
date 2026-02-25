"""
Servicio de Insignias Digitales — Open Badges 3.0

Genera credenciales verificables, imágenes con QR baked
y gestiona el ciclo de vida de insignias emitidas.
"""
import json
import uuid
import string
import random
import qrcode
from io import BytesIO
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont
from dateutil.relativedelta import relativedelta

from app import db
from app.models.badge import BadgeTemplate, IssuedBadge

# Base URLs
SWA_BASE = "https://app.evaluaasi.com"
API_BASE = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io"


def generate_badge_code():
    """Genera código único BD + 10 caracteres alfanuméricos"""
    chars = string.ascii_uppercase + string.digits
    while True:
        code = 'BD' + ''.join(random.choices(chars, k=10))
        existing = IssuedBadge.query.filter_by(badge_code=code).first()
        if not existing:
            return code


def build_ob3_credential(issued_badge, template, user, result=None):
    """
    Construye un OpenBadgeCredential JSON-LD conforme a Open Badges 3.0

    Spec: https://www.imsglobal.org/spec/ob/v3p0/
    """
    badge_uuid = issued_badge.badge_uuid
    issued_at = issued_badge.issued_at or datetime.utcnow()
    valid_from = issued_badge.valid_from or issued_at

    # Build issuer Profile
    issuer = {
        "id": f"{API_BASE}/api/badges/issuer",
        "type": ["Profile"],
        "name": template.issuer_name or "ENTRENAMIENTO INFORMATICO AVANZADO S.A. DE C.V.",
        "url": template.issuer_url or "https://evaluaasi.com",
    }
    if template.issuer_image_url:
        issuer["image"] = {
            "id": template.issuer_image_url,
            "type": "Image"
        }

    # Build Achievement (BadgeClass)
    achievement = {
        "id": f"{API_BASE}/api/badges/templates/{template.id}/achievement",
        "type": ["Achievement"],
        "name": template.name,
        "criteria": {
            "narrative": template.criteria_narrative or f"Aprobación del examen asociado con calificación mínima aprobatoria."
        },
    }
    if template.description:
        achievement["description"] = template.description
    if template.badge_image_url:
        achievement["image"] = {
            "id": template.badge_image_url,
            "type": "Image"
        }
    if template.tags:
        achievement["tag"] = [t.strip() for t in template.tags.split(',') if t.strip()]

    # Build CredentialSubject
    user_name = f"{user.name or ''} {getattr(user, 'first_surname', '') or ''} {getattr(user, 'second_surname', '') or ''}".strip()
    subject = {
        "id": f"did:email:{user.email}" if user.email else f"urn:uuid:{user.id}",
        "type": ["AchievementSubject"],
        "achievement": achievement,
    }
    if user_name:
        subject["name"] = user_name

    # Build credential
    credential = {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
        ],
        "id": f"urn:uuid:{badge_uuid}",
        "type": ["VerifiableCredential", "OpenBadgeCredential"],
        "issuer": issuer,
        "validFrom": valid_from.strftime('%Y-%m-%dT%H:%M:%SZ'),
        "name": template.name,
        "credentialSubject": subject,
    }

    # Add expiration if configured
    if issued_badge.expires_at:
        credential["validUntil"] = issued_badge.expires_at.strftime('%Y-%m-%dT%H:%M:%SZ')

    # Evidence from result
    if result and hasattr(result, 'score'):
        credential["evidence"] = [{
            "id": f"{SWA_BASE}/verify/{issued_badge.badge_code}",
            "type": ["Evidence"],
            "name": "Resultado de evaluación",
            "description": f"Calificación obtenida: {result.score}%"
        }]

    # Verification — hosted
    credential["credentialSchema"] = [{
        "id": "https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json",
        "type": "1EdTechJsonSchemaValidator2019"
    }]

    return credential


def generate_qr_code_image(url, size=200):
    """Genera imagen QR como PIL Image"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGBA')
    qr_img = qr_img.resize((size, size), Image.LANCZOS)
    return qr_img


def bake_badge_image(template, issued_badge, user):
    """
    Genera imagen de la insignia con QR code embebido.

    Si template tiene badge_image_url, descarga y embebe QR.
    Si no, genera una imagen procedural con gradiente, nombre y QR.

    Retorna: BytesIO con PNG
    """
    verify_url = f"{SWA_BASE}/verify/{issued_badge.badge_code}"
    qr_img = generate_qr_code_image(verify_url, size=140)

    # Intentar descargar imagen de template
    template_img = None
    if template.badge_image_url:
        try:
            import requests
            resp = requests.get(template.badge_image_url, timeout=10)
            if resp.status_code == 200:
                template_img = Image.open(BytesIO(resp.content)).convert('RGBA')
        except Exception:
            pass

    if template_img:
        # Resize to standard badge size
        template_img = template_img.resize((600, 600), Image.LANCZOS)
        canvas = Image.new('RGBA', (600, 750), (255, 255, 255, 255))
        canvas.paste(template_img, (0, 0), template_img)

        # QR in bottom center
        qr_x = (600 - 140) // 2
        qr_y = 600 + 5
        # White background for QR
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([qr_x - 5, qr_y - 5, qr_x + 145, qr_y + 145], fill=(255, 255, 255, 255))
        canvas.paste(qr_img, (qr_x, qr_y), qr_img)
    else:
        # Procedural badge image
        canvas = Image.new('RGBA', (600, 750), (255, 255, 255, 255))
        draw = ImageDraw.Draw(canvas)

        # Gradient background (top area)
        for y in range(400):
            r = int(16 + (99 - 16) * y / 400)
            g = int(185 + (102 - 185) * y / 400)
            b = int(129 + (241 - 129) * y / 400)
            draw.line([(0, y), (600, y)], fill=(r, g, b, 255))

        # Badge circle
        circle_center = (300, 180)
        circle_r = 120
        draw.ellipse(
            [circle_center[0] - circle_r, circle_center[1] - circle_r,
             circle_center[0] + circle_r, circle_center[1] + circle_r],
            fill=(255, 255, 255, 230), outline=(255, 255, 255, 255), width=4
        )

        # Star in circle
        _draw_star(draw, circle_center, 70, fill=(16, 185, 129, 255))

        # Badge title
        try:
            title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
            small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
            code_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
        except Exception:
            title_font = ImageFont.load_default()
            small_font = title_font
            code_font = title_font

        # Name text (white on gradient)
        name_text = template.name[:45] + ('...' if len(template.name) > 45 else '')
        bbox = draw.textbbox((0, 0), name_text, font=title_font)
        text_w = bbox[2] - bbox[0]
        draw.text(((600 - text_w) / 2, 330), name_text, fill=(255, 255, 255, 255), font=title_font)

        # Subtitle
        sub_text = "Insignia Digital Verificable"
        bbox2 = draw.textbbox((0, 0), sub_text, font=small_font)
        text_w2 = bbox2[2] - bbox2[0]
        draw.text(((600 - text_w2) / 2, 360), sub_text, fill=(255, 255, 255, 200), font=small_font)

        # User name (below gradient)
        user_name = f"{user.name or ''} {getattr(user, 'first_surname', '') or ''}".strip()
        if user_name:
            bbox3 = draw.textbbox((0, 0), user_name, font=title_font)
            text_w3 = bbox3[2] - bbox3[0]
            draw.text(((600 - text_w3) / 2, 420), user_name, fill=(55, 65, 81, 255), font=title_font)

        # Issuer
        issuer_text = template.issuer_name or 'EduIT / Evaluaasi'
        if len(issuer_text) > 50:
            issuer_text = issuer_text[:47] + '...'
        bbox4 = draw.textbbox((0, 0), issuer_text, font=small_font)
        text_w4 = bbox4[2] - bbox4[0]
        draw.text(((600 - text_w4) / 2, 455), issuer_text, fill=(107, 114, 128, 255), font=small_font)

        # Date
        date_text = f"Emitida: {(issued_badge.issued_at or datetime.utcnow()).strftime('%d/%m/%Y')}"
        bbox5 = draw.textbbox((0, 0), date_text, font=small_font)
        text_w5 = bbox5[2] - bbox5[0]
        draw.text(((600 - text_w5) / 2, 485), date_text, fill=(107, 114, 128, 255), font=small_font)

        # Code
        code_text = f"Código: {issued_badge.badge_code}"
        bbox6 = draw.textbbox((0, 0), code_text, font=code_font)
        text_w6 = bbox6[2] - bbox6[0]
        draw.text(((600 - text_w6) / 2, 515), code_text, fill=(156, 163, 175, 255), font=code_font)

        # QR at bottom
        qr_x = (600 - 140) // 2
        qr_y = 560
        canvas.paste(qr_img, (qr_x, qr_y), qr_img)

        # Verify text under QR
        verify_text = "Escanea para verificar"
        bbox7 = draw.textbbox((0, 0), verify_text, font=code_font)
        text_w7 = bbox7[2] - bbox7[0]
        draw = ImageDraw.Draw(canvas)
        draw.text(((600 - text_w7) / 2, 705), verify_text, fill=(156, 163, 175, 255), font=code_font)

    # Convert to PNG bytes
    output = BytesIO()
    canvas.convert('RGB').save(output, format='PNG', quality=95)
    output.seek(0)
    return output


def _draw_star(draw, center, size, fill):
    """Dibuja una estrella de 5 puntas"""
    import math
    cx, cy = center
    points = []
    for i in range(10):
        angle = math.pi / 2 + i * math.pi / 5
        r = size if i % 2 == 0 else size * 0.4
        x = cx + r * math.cos(angle)
        y = cy - r * math.sin(angle)
        points.append((x, y))
    draw.polygon(points, fill=fill)


def _is_badge_enabled_for_result(result, user):
    """
    Determina si las insignias digitales están habilitadas para un resultado.

    Prioridad:
      1) result.group_id → config efectiva del grupo (override o campus)
      2) Membresía del usuario en cualquier grupo con badge activado
      3) user.enable_digital_badge (legacy, campo directo)
    """
    from app.models.partner import CandidateGroup, GroupMember

    # 1) Si el resultado tiene group_id, usar la config efectiva de ese grupo
    if result and getattr(result, 'group_id', None):
        group = CandidateGroup.query.get(result.group_id)
        if group:
            if group.enable_digital_badge_override is not None:
                return group.enable_digital_badge_override
            if group.campus and group.campus.enable_digital_badge:
                return True

    # 2) Buscar en todas las membresías activas del usuario
    if user:
        memberships = GroupMember.query.filter_by(user_id=user.id, status='active').all()
        for m in memberships:
            g = CandidateGroup.query.get(m.group_id)
            if g:
                if g.enable_digital_badge_override is not None and g.enable_digital_badge_override:
                    return True
                if g.enable_digital_badge_override is None and g.campus and g.campus.enable_digital_badge:
                    return True

    # 3) Legacy: campo directo del usuario
    return getattr(user, 'enable_digital_badge', False)


def issue_badge_for_result(result, user, exam):
    """
    Emite una insignia para un resultado aprobado.

    Busca un BadgeTemplate activo asociado al exam_id o competency_standard_id.
    Si no existe plantilla, no emite nada.

    Returns: IssuedBadge or None
    """
    if not result or result.result != 1:
        return None

    if not _is_badge_enabled_for_result(result, user):
        return None

    if not user.email:
        return None

    # Find matching template
    template = None
    if exam and exam.id:
        template = BadgeTemplate.query.filter_by(exam_id=exam.id, is_active=True).first()

    if not template and hasattr(exam, 'competency_standard_id') and exam.competency_standard_id:
        template = BadgeTemplate.query.filter_by(
            competency_standard_id=exam.competency_standard_id, is_active=True
        ).first()

    if not template:
        return None

    # Check if already issued for this result
    existing = IssuedBadge.query.filter_by(result_id=result.id).first()
    if existing:
        return existing

    # Also check if already issued for same user+template (avoid duplicates)
    existing2 = IssuedBadge.query.filter_by(
        user_id=user.id, badge_template_id=template.id, status='active'
    ).first()
    if existing2:
        return existing2

    try:
        badge_uuid = str(uuid.uuid4())
        badge_code = generate_badge_code()
        now = datetime.utcnow()

        expires_at = None
        if template.expiry_months:
            expires_at = now + relativedelta(months=template.expiry_months)

        issued = IssuedBadge(
            badge_uuid=badge_uuid,
            badge_template_id=template.id,
            user_id=user.id,
            result_id=result.id,
            badge_code=badge_code,
            issued_at=now,
            valid_from=now,
            expires_at=expires_at,
            status='active',
        )
        db.session.add(issued)
        db.session.flush()  # Get ID before building credential

        # Build OB3 credential JSON-LD
        credential = build_ob3_credential(issued, template, user, result)
        issued.credential_json = json.dumps(credential, ensure_ascii=False)

        # Generate baked badge image
        try:
            image_bytes = bake_badge_image(template, issued, user)
            blob_name = f"badges/{badge_uuid}.png"

            from app.utils.azure_storage import AzureStorageService
            storage = AzureStorageService()
            image_url = storage.upload_bytes(
                image_bytes.read(),
                blob_name,
                content_type='image/png'
            )
            issued.badge_image_url = image_url
            issued.badge_image_blob_name = blob_name
        except Exception as e:
            print(f"[BADGE] Error generating image for {badge_code}: {e}")
            # Badge still valid without custom image

        db.session.commit()
        return issued

    except Exception as e:
        db.session.rollback()
        print(f"[BADGE] Error issuing badge: {e}")
        return None


def issue_badges_batch(result_ids):
    """
    Emite badges para múltiples resultados (batch).
    Útil para generación retroactiva.

    Returns: list of IssuedBadge
    """
    from app.models.user import User
    from app.models.exam import Result, Exam

    issued_list = []
    for result_id in result_ids:
        result = Result.query.get(result_id)
        if not result or result.result != 1:
            continue

        user = User.query.get(result.user_id)
        if not user:
            continue

        exam = Exam.query.get(result.exam_id)
        if not exam:
            continue

        badge = issue_badge_for_result(result, user, exam)
        if badge:
            issued_list.append(badge)

    return issued_list
