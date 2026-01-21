"""
Azure Function para generar PDFs de evaluación de forma asíncrona

Esta función se activa cuando se agrega un mensaje a la cola 'pdf-generation-queue'.
Genera el PDF y lo sube a Azure Blob Storage.

Formato del mensaje:
{
    "result_id": "uuid-del-resultado",
    "type": "evaluation_report" | "certificate",
    "user_id": "uuid-del-usuario",
    "callback_url": "opcional - URL para notificar cuando esté listo"
}
"""
import azure.functions as func
import json
import os
import logging
import base64
from io import BytesIO
from datetime import datetime
import time

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('PDFGenerator')

# Formateador para logs más visibles
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)


def main(msg: func.QueueMessage) -> None:
    """
    Procesa mensaje de cola para generar PDF
    """
    start_time = time.time()
    
    logger.info('=' * 60)
    logger.info('📥 [Azure Function] PDF Generator - Función activada')
    logger.info(f'📥 [Azure Function] Message ID: {msg.id}')
    logger.info(f'📥 [Azure Function] Queue Time: {msg.insertion_time}')
    logger.info('=' * 60)
    
    try:
        # Parsear mensaje (puede venir en base64 o texto plano)
        message_body = msg.get_body().decode('utf-8')
        
        # Intentar decodificar base64 si es necesario
        try:
            decoded = base64.b64decode(message_body).decode('utf-8')
            data = json.loads(decoded)
        except:
            data = json.loads(message_body)
        
        result_id = data.get('result_id')
        pdf_type = data.get('type', 'evaluation_report')
        user_id = data.get('user_id')
        queued_at = data.get('queued_at', 'Unknown')
        
        logger.info(f'📋 [Azure Function] Datos del mensaje:')
        logger.info(f'   - Result ID: {result_id}')
        logger.info(f'   - User ID: {user_id}')
        logger.info(f'   - Tipo: {pdf_type}')
        logger.info(f'   - Encolado: {queued_at}')
        
        if not result_id or not user_id:
            logger.error(f"❌ [Azure Function] Campos requeridos faltantes: result_id={result_id}, user_id={user_id}")
            return
        
        logger.info(f'🔄 [Azure Function] Conectando a base de datos...')
        
        # Conectar a la base de datos
        from database import get_db_session, Result, Exam, User
        
        session = get_db_session()
        logger.info(f'✅ [Azure Function] Conexión a BD establecida')
        
        try:
            # Obtener datos necesarios
            logger.info(f'🔍 [Azure Function] Buscando resultado: {result_id}')
            result = session.query(Result).filter_by(id=result_id, user_id=user_id).first()
            
            if not result:
                logger.error(f"❌ [Azure Function] Resultado no encontrado: {result_id}")
                return
            
            user = session.query(User).filter_by(id=user_id).first()
            exam = session.query(Exam).filter_by(id=result.exam_id).first()
            
            if not user:
                logger.error(f"❌ [Azure Function] Usuario no encontrado: {user_id}")
                return
                
            if not exam:
                logger.error(f"❌ [Azure Function] Examen no encontrado: {result.exam_id}")
                return
            
            logger.info(f'📊 [Azure Function] Datos obtenidos:')
            logger.info(f'   - Usuario: {user.email}')
            logger.info(f'   - Examen: {exam.name[:50] if exam.name else "Sin nombre"}')
            logger.info(f'   - Score: {result.score}%')
            logger.info(f'   - Resultado: {"Aprobado" if result.result == 1 else "No aprobado"}')
            
            # Actualizar estado a procesando
            if hasattr(result, 'pdf_status'):
                result.pdf_status = 'processing'
                session.commit()
                logger.info(f'🔄 [Azure Function] Estado actualizado a: processing')
            
            # Generar PDF según tipo
            logger.info(f'🔧 [Azure Function] Generando PDF tipo: {pdf_type}')
            pdf_start = time.time()
            
            if pdf_type == 'certificate':
                pdf_buffer = generate_certificate_pdf(result, exam, user)
                filename = f"certificate_{result_id}.pdf"
            else:
                pdf_buffer = generate_evaluation_report_pdf(result, exam, user)
                filename = f"report_{result_id}.pdf"
            
            pdf_time = time.time() - pdf_start
            pdf_size = pdf_buffer.getbuffer().nbytes
            
            logger.info(f'✅ [Azure Function] PDF generado:')
            logger.info(f'   - Archivo: {filename}')
            logger.info(f'   - Tamaño: {pdf_size/1024:.2f} KB')
            logger.info(f'   - Tiempo: {pdf_time*1000:.0f} ms')
            
            # Subir a Azure Blob Storage
            logger.info(f'☁️  [Azure Function] Subiendo a Azure Blob Storage...')
            upload_start = time.time()
            
            blob_url = upload_to_blob(pdf_buffer, filename)
            
            upload_time = time.time() - upload_start
            logger.info(f'✅ [Azure Function] Upload completado en {upload_time*1000:.0f} ms')
            logger.info(f'   - URL: {blob_url}')
            
            # Actualizar resultado en BD con la URL del PDF
            if pdf_type == 'certificate':
                result.certificate_url = blob_url
            else:
                result.report_url = blob_url
            
            if hasattr(result, 'pdf_status'):
                result.pdf_status = 'completed'
            
            session.commit()
            logger.info(f'✅ [Azure Function] Base de datos actualizada')
            
            # Resumen final
            total_time = time.time() - start_time
            logger.info('=' * 60)
            logger.info(f'✅ [Azure Function] PDF GENERADO EXITOSAMENTE')
            logger.info(f'   - Tipo: {pdf_type}')
            logger.info(f'   - URL: {blob_url}')
            logger.info(f'   - Tiempo total: {total_time*1000:.0f} ms')
            logger.info('=' * 60)
            
        finally:
            session.close()
            logger.info(f'🔒 [Azure Function] Conexión a BD cerrada')
            
    except Exception as e:
        logger.error('=' * 60)
        logger.error(f"❌ [Azure Function] ERROR PROCESANDO PDF")
        logger.error(f"   - Error: {str(e)}")
        import traceback
        logger.error(f"   - Traceback:\n{traceback.format_exc()}")
        logger.error('=' * 60)
        raise


def generate_evaluation_report_pdf(result, exam, user) -> BytesIO:
    """
    Genera el PDF del reporte de evaluación
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    import re
    
    buffer = BytesIO()
    page_width, page_height = letter
    margin = 50
    
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Colores
    primary_color = colors.HexColor('#1e40af')
    success_color = colors.HexColor('#16a34a')
    error_color = colors.HexColor('#dc2626')
    gray_color = colors.HexColor('#6b7280')
    
    def strip_html(text):
        if not text:
            return ''
        return re.sub(r'<[^>]+>', '', str(text))
    
    y = page_height - margin
    
    # === ENCABEZADO ===
    c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold', 16)
    c.drawString(margin, y, 'Evaluaasi')
    
    c.setFillColor(gray_color)
    c.setFont('Helvetica', 7)
    c.drawRightString(page_width - margin, y, 'Sistema de Evaluación y Certificación')
    c.drawRightString(page_width - margin, y - 12, datetime.now().strftime('%d/%m/%Y %H:%M'))
    
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
    
    c.setFillColor(colors.black)
    name_parts = [user.name or '']
    if hasattr(user, 'first_surname') and user.first_surname:
        name_parts.append(user.first_surname)
    if hasattr(user, 'second_surname') and user.second_surname:
        name_parts.append(user.second_surname)
    student_name = ' '.join(name_parts).strip() or user.email
    
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 5, y, 'Nombre:')
    c.setFont('Helvetica', 9)
    c.drawString(margin + 50, y, student_name)
    y -= 12
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 5, y, 'Correo:')
    c.setFont('Helvetica', 9)
    c.drawString(margin + 50, y, user.email)
    y -= 20
    
    # === DATOS DEL EXAMEN ===
    c.setFillColor(primary_color)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(margin, y, 'DATOS DEL EXAMEN')
    y -= 15
    
    c.setFillColor(colors.black)
    exam_name = strip_html(exam.name)[:60] if exam.name else 'Sin nombre'
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
    
    start_date = result.start_date.strftime('%d/%m/%Y %H:%M') if result.start_date else 'N/A'
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 5, y, 'Fecha:')
    c.setFont('Helvetica', 9)
    c.drawString(margin + 40, y, start_date)
    y -= 25
    
    # === RESULTADO ===
    c.setFillColor(primary_color)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(margin, y, 'RESULTADO DE LA EVALUACIÓN')
    y -= 10
    
    # Recuadro de resultados
    box_height = 40
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.rect(margin, y - box_height, page_width - 2 * margin, box_height)
    
    passing_score = exam.passing_score or 70
    is_passed = result.result == 1
    percentage = result.score or 0
    
    c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 10, y - 15, 'Calificación:')
    c.setFont('Helvetica-Bold', 18)
    c.drawString(margin + 70, y - 18, f'{percentage}%')
    
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin + 10, y - 35, 'Resultado:')
    
    if is_passed:
        c.setFillColor(success_color)
        c.setFont('Helvetica-Bold', 12)
        c.drawString(margin + 60, y - 37, 'APROBADO')
    else:
        c.setFillColor(error_color)
        c.setFont('Helvetica-Bold', 12)
        c.drawString(margin + 60, y - 37, 'NO APROBADO')
    
    c.setFillColor(colors.black)
    c.setFont('Helvetica', 9)
    c.drawRightString(page_width - margin - 10, y - 35, f'Puntaje mínimo requerido: {passing_score}%')
    
    y -= 60
    
    # Código de certificado
    if result.certificate_code:
        c.setFillColor(gray_color)
        c.setFont('Helvetica', 8)
        c.drawCentredString(page_width / 2, y, f'Código de verificación: {result.certificate_code}')
    
    c.save()
    buffer.seek(0)
    return buffer


def generate_certificate_pdf(result, exam, user) -> BytesIO:
    """
    Genera el certificado PDF usando plantilla
    TODO: Implementar con plantilla de certificado específica
    """
    logger.info(f'🎓 [Azure Function] Generando certificado para resultado aprobado')
    # Por ahora, usar el mismo formato que el reporte
    # En el futuro, implementar con plantilla de certificado
    return generate_evaluation_report_pdf(result, exam, user)


def upload_to_blob(buffer: BytesIO, filename: str) -> str:
    """
    Sube el PDF a Azure Blob Storage y retorna la URL
    """
    from azure.storage.blob import BlobServiceClient, ContentSettings
    
    logger.info(f'☁️  [Azure Function] Preparando upload a Blob Storage')
    
    connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
    container_name = os.environ.get('AZURE_STORAGE_CONTAINER', 'evaluaasi-files')
    
    if not connection_string:
        logger.error(f'❌ [Azure Function] AZURE_STORAGE_CONNECTION_STRING no configurado')
        raise ValueError("AZURE_STORAGE_CONNECTION_STRING not configured")
    
    logger.info(f'   - Container: {container_name}')
    
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    container_client = blob_service_client.get_container_client(container_name)
    
    # Crear el container si no existe
    try:
        container_client.create_container()
        logger.info(f'   - Container creado')
    except Exception:
        pass  # Ya existe
    
    # Crear el blob en una carpeta 'pdfs'
    blob_name = f"pdfs/{filename}"
    blob_client = container_client.get_blob_client(blob_name)
    
    logger.info(f'   - Blob: {blob_name}')
    
    # Subir con content type PDF
    blob_client.upload_blob(
        buffer,
        overwrite=True,
        content_settings=ContentSettings(content_type='application/pdf')
    )
    
    logger.info(f'✅ [Azure Function] Archivo subido: {blob_client.url}')
    
    # Retornar URL del blob
    return blob_client.url
