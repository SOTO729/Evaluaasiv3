"""
Módulo compartido de generación de PDFs para certificados y reportes de evaluación.
Usado tanto por los endpoints del candidato (exams.py) como del coordinador (partners.py).
"""
import os
import re
import json
import pytz
from io import BytesIO
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.utils import ImageReader

# Directorio static
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')


def get_base_url():
    """Retorna la URL base según el entorno (PROD vs DEV)."""
    if os.getenv('FLASK_ENV') == 'production':
        return 'https://app.evaluaasi.com'
    return 'https://dev.evaluaasi.com'


def _strip_html(text):
    if not text:
        return ''
    return re.sub(r'<[^>]+>', '', str(text))


def _get_student_name(user):
    name_parts = [user.name or '']
    if getattr(user, 'first_surname', None):
        name_parts.append(user.first_surname)
    if getattr(user, 'second_surname', None):
        name_parts.append(user.second_surname)
    return ' '.join(name_parts).strip() or user.email


def generate_evaluation_report_pdf(result, exam, user, timezone='America/Mexico_City'):
    """
    Genera el PDF completo del reporte de evaluación.
    Retorna un BytesIO con el PDF listo para enviar o incluir en un ZIP.
    """
    try:
        tz = pytz.timezone(timezone)
    except Exception:
        tz = pytz.timezone('America/Mexico_City')

    buffer = BytesIO()
    page_width, page_height = letter
    margin = 50

    c = canvas.Canvas(buffer, pagesize=letter)

    primary_color = HexColor('#1e40af')
    success_color = HexColor('#16a34a')
    error_color = HexColor('#dc2626')
    gray_color = HexColor('#6b7280')
    light_gray = HexColor('#e5e7eb')

    y = page_height - margin

    # === ENCABEZADO CON LOGO ===
    logo_path = os.path.join(STATIC_DIR, 'logo.png')
    if os.path.exists(logo_path):
        try:
            logo = ImageReader(logo_path)
            c.drawImage(logo, margin, y - 30, width=40, height=40,
                        preserveAspectRatio=True, mask='auto')
            c.setFillColor(colors.black)
            c.setFont('Helvetica-Bold', 16)
            c.drawString(margin + 42, y - 15, 'Evaluaasi')
        except Exception:
            c.setFillColor(colors.black)
            c.setFont('Helvetica-Bold', 16)
            c.drawString(margin, y, 'Evaluaasi')
    else:
        c.setFillColor(colors.black)
        c.setFont('Helvetica-Bold', 16)
        c.drawString(margin, y, 'Evaluaasi')

    now_utc = datetime.now(pytz.utc)
    now_local = now_utc.astimezone(tz)
    c.setFillColor(gray_color)
    c.setFont('Helvetica', 7)
    c.drawRightString(page_width - margin, y, 'Sistema de Evaluación y Certificación')
    c.drawRightString(page_width - margin, y - 12,
                      f'Fecha de descarga: {now_local.strftime("%d/%m/%Y %H:%M")}')

    y -= 45
    c.setStrokeColor(primary_color)
    c.setLineWidth(2)
    c.line(margin, y, page_width - margin, y)
    y -= 30

    # === TÍTULO ===
    c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold', 14)
    c.drawCentredString(page_width / 2, y, 'REPORTE DE EVALUACIÓN')
    y -= 30

    # === DATOS DEL ESTUDIANTE ===
    c.setFillColor(primary_color)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(margin, y, 'DATOS DEL ESTUDIANTE')
    y -= 15

    student_name = _get_student_name(user)
    c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 5, y, 'Nombre:')
    c.setFont('Helvetica', 9)
    c.drawString(margin + 50, y, student_name)
    y -= 12
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 5, y, 'Correo:')
    c.setFont('Helvetica', 9)
    c.drawString(margin + 50, y, user.email or 'N/A')
    y -= 20

    # === DATOS DEL EXAMEN ===
    c.setFillColor(primary_color)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(margin, y, 'DATOS DEL EXAMEN')
    y -= 15

    exam_name = _strip_html(exam.name)[:60] if exam.name else 'Sin nombre'
    c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 5, y, 'Examen:')
    c.setFont('Helvetica', 9)
    c.drawString(margin + 55, y, exam_name)
    y -= 12

    ecm_code = exam.version or 'N/A'
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 5, y, 'Código ECM:')
    c.setFont('Helvetica', 9)
    c.drawString(margin + 70, y, ecm_code)
    y -= 12

    # Fecha de evaluación
    if result.start_date:
        try:
            utc_date = pytz.utc.localize(result.start_date) if result.start_date.tzinfo is None else result.start_date
            local_date = utc_date.astimezone(tz)
            start_date = local_date.strftime('%d/%m/%Y %H:%M')
        except Exception:
            start_date = result.start_date.strftime('%d/%m/%Y %H:%M') if result.start_date else 'N/A'
    else:
        start_date = 'N/A'
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 5, y, 'Fecha de la evaluación:')
    c.setFont('Helvetica', 9)
    c.drawString(margin + 115, y, start_date)
    y -= 25

    # === OBTENER DATOS DE ANSWERS_DATA ===
    answers_data_raw = result.answers_data
    if isinstance(answers_data_raw, str):
        try:
            answers_data = json.loads(answers_data_raw)
        except Exception:
            answers_data = {}
    else:
        answers_data = answers_data_raw or {}

    real_percentage = result.score or 0
    if isinstance(answers_data, dict):
        summary = answers_data.get('summary', {})
        if isinstance(summary, dict) and 'percentage' in summary:
            real_percentage = summary.get('percentage', real_percentage)

    real_percentage = round(float(real_percentage), 1)
    score_1000 = round(real_percentage * 10)

    # === RESULTADO ===
    c.setFillColor(primary_color)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(margin, y, 'RESULTADO DE LA EVALUACIÓN')
    y -= 10

    box_height = 40
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.rect(margin, y - box_height, page_width - 2 * margin, box_height)

    passing_score = exam.passing_score or 70
    is_passed = result.result == 1

    c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 10, y - 15, 'Calificación:')
    c.setFont('Helvetica-Bold', 18)
    if real_percentage == int(real_percentage):
        c.drawString(margin + 70, y - 18, f'{int(real_percentage)}%')
    else:
        c.drawString(margin + 70, y - 18, f'{real_percentage}%')

    puntaje_x = page_width / 2 + 10
    c.setFont('Helvetica-Bold', 9)
    c.drawString(puntaje_x, y - 15, 'Puntaje:')
    c.setFont('Helvetica-Bold', 14)
    c.drawString(puntaje_x + 80, y - 17, f'{score_1000}')
    c.setFont('Helvetica', 10)
    c.drawString(puntaje_x + 115, y - 17, '/ 1000 puntos')

    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 10, y - 35, 'Resultado:')

    if is_passed:
        c.setFillColor(success_color)
        result_text = 'APROBADO'
    else:
        c.setFillColor(error_color)
        result_text = 'NO APROBADO'

    c.setFont('Helvetica-Bold', 11)
    c.drawString(margin + 60, y - 35, result_text)

    c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(puntaje_x, y - 35, 'Puntaje mínimo:')
    c.setFont('Helvetica', 9)
    passing_score_1000 = round(passing_score * 10)
    c.drawString(puntaje_x + 80, y - 35, f'{passing_score_1000} / 1000 puntos')

    y -= box_height + 20

    # === DESGLOSE POR ÁREA/TEMA ===
    category_results = {}
    if isinstance(answers_data, dict):
        summary = answers_data.get('summary', {})
        if isinstance(summary, dict):
            category_results = summary.get('evaluation_breakdown', {})
        if not category_results:
            category_results = answers_data.get('evaluation_breakdown', {})

    if category_results:
        c.setStrokeColor(primary_color)
        c.setLineWidth(0.5)
        c.line(margin, y, page_width - margin, y)
        y -= 15

        c.setFillColor(colors.black)
        c.setFont('Helvetica-Bold', 8)
        c.drawString(margin + 5, y, 'ÁREA / TEMA')
        c.drawRightString(page_width - margin - 10, y, 'PORCENTAJE')
        y -= 8

        c.setStrokeColor(colors.black)
        c.setLineWidth(0.3)
        c.line(margin, y, page_width - margin, y)
        y -= 12

        cat_index = 0
        for cat_name, cat_data in category_results.items():
            cat_index += 1

            if y < 100:
                c.showPage()
                y = page_height - margin

            cat_percentage = cat_data.get('percentage')
            if cat_percentage is None or (isinstance(cat_percentage, (int, float)) and cat_percentage == 0):
                earned = cat_data.get('earned', cat_data.get('correct', 0))
                max_score = cat_data.get('max', cat_data.get('total', 0))
                if max_score and max_score > 0:
                    cat_percentage = round((float(earned) / float(max_score)) * 100, 1)
                else:
                    cat_percentage = 0
            try:
                cat_percentage = float(cat_percentage)
            except (TypeError, ValueError):
                cat_percentage = 0

            if cat_percentage == int(cat_percentage):
                cat_pct_str = f'{int(cat_percentage)}%'
            else:
                cat_pct_str = f'{cat_percentage}%'

            c.setFillColor(colors.black)
            c.setFont('Helvetica-Bold', 9)
            display_name = _strip_html(cat_name).upper()[:40]
            c.drawString(margin + 5, y, f'{cat_index}. {display_name}')
            c.drawRightString(page_width - margin - 10, y, cat_pct_str)
            y -= 12

            topics = cat_data.get('topics', {})
            topic_index = 0
            for topic_name, topic_data in topics.items():
                topic_index += 1
                if y < 80:
                    c.showPage()
                    y = page_height - margin

                topic_percentage = topic_data.get('percentage')
                if topic_percentage is None or (isinstance(topic_percentage, (int, float)) and topic_percentage == 0):
                    earned = topic_data.get('earned', topic_data.get('correct', 0))
                    max_score = topic_data.get('max', topic_data.get('total', 0))
                    if max_score and max_score > 0:
                        topic_percentage = round((float(earned) / float(max_score)) * 100, 1)
                    else:
                        topic_percentage = 0
                try:
                    topic_percentage = float(topic_percentage)
                except (TypeError, ValueError):
                    topic_percentage = 0

                if topic_percentage == int(topic_percentage):
                    topic_pct_str = f'{int(topic_percentage)}%'
                else:
                    topic_pct_str = f'{topic_percentage}%'

                c.setFillColor(gray_color)
                c.setFont('Helvetica', 8)
                topic_display = _strip_html(topic_name)[:35]
                c.drawString(margin + 20, y, f'{cat_index}.{topic_index} {topic_display}')
                c.drawRightString(page_width - margin - 10, y, topic_pct_str)
                y -= 10

            c.setStrokeColor(light_gray)
            c.setLineWidth(0.2)
            c.line(margin, y, page_width - margin, y)
            y -= 8

        # Total
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.3)
        c.line(margin, y, page_width - margin, y)
        y -= 12

        c.setFillColor(colors.black)
        c.setFont('Helvetica-Bold', 9)
        c.drawString(margin + 5, y, 'TOTAL')
        if real_percentage == int(real_percentage):
            c.drawRightString(page_width - margin - 10, y, f'{int(real_percentage)}%')
        else:
            c.drawRightString(page_width - margin - 10, y, f'{real_percentage}%')
        y -= 8

        c.setLineWidth(0.5)
        c.line(margin, y, page_width - margin, y)
        y -= 15

    # === QR DE VERIFICACIÓN ===
    verification_code = result.certificate_code
    if verification_code:
        import qrcode

        verify_url = f"{get_base_url()}/verify/{verification_code}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=3,
            border=1,
        )
        qr.add_data(verify_url)
        qr.make(fit=True)

        qr_img = qr.make_image(fill_color="black", back_color="transparent").convert('RGBA')

        qr_buffer = BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)

        qr_image = ImageReader(qr_buffer)
        qr_size = 60
        qr_x = margin
        qr_y = 25
        c.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size, mask='auto')

        c.setFillColor(gray_color)
        c.setFont('Helvetica', 6)
        c.drawCentredString(qr_x + qr_size / 2, qr_y - 8, verification_code)
        c.setFont('Helvetica', 5)
        c.drawCentredString(qr_x + qr_size / 2, qr_y - 14, 'Escanea para verificar')

    # === PIE DE PÁGINA ===
    y_footer = 50
    c.setStrokeColor(primary_color)
    c.setLineWidth(0.3)
    c.line(margin + 70, y_footer, page_width - margin, y_footer)
    y_footer -= 10

    c.setFillColor(primary_color)
    c.setFont('Helvetica', 7)
    c.drawString(margin + 75, y_footer,
                 'Este documento es un reporte oficial de evaluación generado por el sistema Evaluaasi.')
    y_footer -= 8
    c.setFillColor(gray_color)
    c.drawString(margin, y_footer, f'ID de resultado: {result.id}')

    if result.certificate_code:
        c.setFillColor(gray_color)
        c.setFont('Helvetica', 8)
        c.drawCentredString(page_width / 2, y_footer,
                            f'Código de verificación: {result.certificate_code}')

    c.save()
    buffer.seek(0)
    return buffer


def generate_certificate_pdf(result, exam, user):
    """
    Genera el certificado PDF usando la plantilla.
    Soporta plantillas personalizadas por ECM.
    Retorna un BytesIO con el PDF listo.
    """
    from pypdf import PdfReader, PdfWriter

    # === Buscar plantilla personalizada por ECM ===
    custom_template = None
    custom_template_bytes = None
    if getattr(exam, 'competency_standard_id', None):
        try:
            from app.models.certificate_template import CertificateTemplate
            custom_template = CertificateTemplate.query.filter_by(
                competency_standard_id=exam.competency_standard_id
            ).first()

            if custom_template:
                try:
                    from app.utils.azure_storage import azure_storage as az_storage
                    custom_template_bytes = az_storage.download_file(custom_template.template_blob_url)
                except Exception:
                    custom_template = None
                    custom_template_bytes = None
        except Exception:
            custom_template = None

    # Cargar plantilla PDF
    if custom_template_bytes:
        reader = PdfReader(BytesIO(custom_template_bytes))
    else:
        template_path = os.path.join(STATIC_DIR, 'plantilla.pdf')
        if not os.path.exists(template_path):
            # Fallback: generar reporte de evaluación en vez de error
            return generate_evaluation_report_pdf(result, exam, user)
        reader = PdfReader(template_path)

    page = reader.pages[0]
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)

    buffer_overlay = BytesIO()
    c = canvas.Canvas(buffer_overlay, pagesize=(width, height))
    c.setFillColor(HexColor('#1a365d'))

    # === Configuración de posiciones ===
    if custom_template:
        tmpl_config = custom_template.get_config()
        name_cfg = tmpl_config['name_field']
        cert_cfg = tmpl_config['cert_name_field']
        qr_cfg = tmpl_config['qr_field']
    else:
        name_cfg = {'x': 85, 'y': 375, 'width': 455, 'height': 50,
                    'maxFontSize': 36, 'color': '#1a365d'}
        cert_cfg = {'x': 85, 'y': 300, 'width': 455, 'height': 30,
                    'maxFontSize': 18, 'color': '#1a365d'}
        qr_cfg = {'x': 30, 'y': 25, 'size': 50, 'background': 'transparent',
                  'showCode': True, 'showText': True}

    def draw_fitted_text_cfg(canv, text, cfg, font_name='Helvetica-Bold'):
        color = cfg.get('color', '#1a365d')
        canv.setFillColor(HexColor(color))
        cx = cfg['x'] + cfg['width'] / 2
        y_pos = cfg['y']
        mw = cfg['width']
        max_font_size = cfg.get('maxFontSize', 36)
        font_size = max_font_size
        while font_size >= 8:
            text_width = stringWidth(text, font_name, font_size)
            if text_width <= mw:
                canv.setFont(font_name, font_size)
                canv.drawCentredString(cx, y_pos, text)
                return font_size
            font_size -= 1
        canv.setFont(font_name, 8)
        canv.drawCentredString(cx, y_pos, text)
        return 8

    # Nombre del usuario (Title Case)
    student_name = _get_student_name(user).title()
    draw_fitted_text_cfg(c, student_name, name_cfg)

    # Nombre del certificado (MAYÚSCULAS)
    cert_name = _strip_html(exam.name).upper()[:80] if exam.name else "CERTIFICADO DE COMPETENCIA"
    draw_fitted_text_cfg(c, cert_name, cert_cfg)

    # === QR DE VERIFICACIÓN ===
    verification_code = result.eduit_certificate_code
    if verification_code:
        import qrcode

        verify_url = f"{get_base_url()}/verify/{verification_code}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=3,
            border=1,
        )
        qr.add_data(verify_url)
        qr.make(fit=True)

        bg_color = qr_cfg.get('background', 'transparent')
        if bg_color == 'transparent':
            qr_img = qr.make_image(fill_color="black", back_color="transparent").convert('RGBA')
        else:
            qr_img = qr.make_image(fill_color="black", back_color="white")

        qr_buffer = BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)

        qr_image = ImageReader(qr_buffer)
        qr_size = qr_cfg.get('size', 50)
        qr_x = qr_cfg.get('x', 30)
        qr_y = qr_cfg.get('y', 25)
        c.drawImage(qr_image, qr_x, qr_y, width=qr_size, height=qr_size, mask='auto')

        if qr_cfg.get('showCode', True):
            c.setFillColor(HexColor('#666666'))
            c.setFont('Helvetica', 5)
            c.drawCentredString(qr_x + qr_size / 2, qr_y - 6, verification_code)

        if qr_cfg.get('showText', True):
            c.setFillColor(HexColor('#666666'))
            c.setFont('Helvetica', 4)
            c.drawCentredString(qr_x + qr_size / 2, qr_y - 11, 'Escanea para verificar')

    # === LOGO/ESCUDO DEL PARTNER ===
    # Obtener el partner a través de: Result.group_id → CandidateGroup → Campus → Partner
    try:
        if getattr(result, 'group_id', None):
            from app.models.partner import CandidateGroup, Campus, Partner
            group = CandidateGroup.query.get(result.group_id)
            if group and group.campus_id:
                campus = Campus.query.get(group.campus_id)
                if campus and campus.partner_id:
                    partner = Partner.query.get(campus.partner_id)
                    if partner and partner.logo_url:
                        try:
                            import requests as req_lib
                            logo_resp = req_lib.get(partner.logo_url, timeout=10)
                            if logo_resp.status_code == 200:
                                logo_bytes = BytesIO(logo_resp.content)
                                partner_logo = ImageReader(logo_bytes)
                                # Dibujar logo del partner en posición indicada
                                logo_w = 80
                                logo_h = 80
                                c.drawImage(partner_logo, 910, 1135,
                                            width=logo_w, height=logo_h,
                                            preserveAspectRatio=True, mask='auto')
                        except Exception:
                            pass  # Si falla la descarga del logo, continuar sin él
    except Exception:
        pass  # Si falla la búsqueda del partner, continuar sin logo

    c.save()

    # Combinar plantilla con overlay
    buffer_overlay.seek(0)
    overlay = PdfReader(buffer_overlay)

    if custom_template_bytes:
        reader2 = PdfReader(BytesIO(custom_template_bytes))
    else:
        reader2 = PdfReader(template_path)
    page2 = reader2.pages[0]
    page2.merge_page(overlay.pages[0])

    writer = PdfWriter()
    writer.add_page(page2)

    buffer_final = BytesIO()
    writer.write(buffer_final)
    buffer_final.seek(0)
    return buffer_final
