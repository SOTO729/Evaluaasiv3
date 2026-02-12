"""
Rutas para gestión de Certificados CONOCER
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User
from app.models.conocer_certificate import ConocerCertificate
from app.services.conocer_blob_service import get_conocer_blob_service
import io

# Lazy import para Azure (puede no estar instalado)
ResourceNotFoundError = None

def _get_azure_exceptions():
    global ResourceNotFoundError
    if ResourceNotFoundError is None:
        try:
            from azure.core.exceptions import ResourceNotFoundError as _ResourceNotFoundError
            ResourceNotFoundError = _ResourceNotFoundError
        except ImportError:
            # Crear una excepción dummy si azure no está instalado
            class _ResourceNotFoundError(Exception):
                pass
            ResourceNotFoundError = _ResourceNotFoundError
    return ResourceNotFoundError

conocer_bp = Blueprint('conocer', __name__)


@conocer_bp.route('/certificates', methods=['GET'])
@jwt_required()
def get_my_certificates():
    """
    Obtener todos los certificados CONOCER del usuario autenticado
    
    Query params:
        - status: Filtrar por estado (active, archived, revoked)
        - standard_code: Filtrar por código de estándar
    
    Returns:
        Lista de certificados con metadata
    """
    current_user_id = get_jwt_identity()
    
    # Obtener filtros
    status_filter = request.args.get('status')
    standard_filter = request.args.get('standard_code')
    
    # Query base
    query = ConocerCertificate.query.filter_by(user_id=current_user_id)
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    if standard_filter:
        query = query.filter_by(standard_code=standard_filter)
    
    certificates = query.order_by(ConocerCertificate.issue_date.desc()).all()
    
    return jsonify({
        'certificates': [cert.to_dict() for cert in certificates],
        'total': len(certificates)
    })


@conocer_bp.route('/certificates/<int:certificate_id>', methods=['GET'])
@jwt_required()
def get_certificate(certificate_id):
    """
    Obtener detalle de un certificado específico
    
    Returns:
        Información detallada del certificado
    """
    current_user_id = get_jwt_identity()
    
    certificate = ConocerCertificate.query.filter_by(
        id=certificate_id,
        user_id=current_user_id
    ).first()
    
    if not certificate:
        return jsonify({'error': 'Certificado no encontrado'}), 404
    
    # Obtener estado del blob
    blob_status = None
    try:
        blob_service = get_conocer_blob_service()
        blob_status = blob_service.get_blob_status(certificate.blob_name)
    except Exception as e:
        current_app.logger.error(f"Error obteniendo estado del blob: {e}")
    
    response = certificate.to_dict(include_blob_info=True)
    response['blob_status'] = blob_status
    
    return jsonify(response)


@conocer_bp.route('/certificates/<int:certificate_id>/download', methods=['GET'])
@jwt_required()
def download_certificate(certificate_id):
    """
    Descargar el PDF del certificado
    
    Si el certificado está en Archive tier, inicia la rehidratación
    y retorna un mensaje indicando el tiempo estimado.
    
    Returns:
        PDF del certificado o mensaje de estado si está en Archive
    """
    current_user_id = get_jwt_identity()
    
    certificate = ConocerCertificate.query.filter_by(
        id=certificate_id,
        user_id=current_user_id
    ).first()
    
    if not certificate:
        return jsonify({'error': 'Certificado no encontrado'}), 404
    
    try:
        blob_service = get_conocer_blob_service()
        content, properties = blob_service.download_certificate(certificate.blob_name)
        
        # Verificar integridad del archivo
        import hashlib
        file_hash = hashlib.sha256(content).hexdigest()
        if certificate.file_hash and file_hash != certificate.file_hash:
            current_app.logger.warning(
                f"Hash mismatch para certificado {certificate_id}: "
                f"esperado {certificate.file_hash}, obtenido {file_hash}"
            )
        
        # Crear nombre de archivo para descarga
        filename = f"CONOCER_{certificate.standard_code}_{certificate.certificate_number}.pdf"
        
        return send_file(
            io.BytesIO(content),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        error_msg = str(e)
        
        # Verificar si es un error de rehidratación
        if 'archivo' in error_msg.lower() or 'archive' in error_msg.lower():
            return jsonify({
                'error': 'certificate_in_archive',
                'message': error_msg,
                'status': 'rehydrating',
                'estimated_time': '15 horas (aprox.)'
            }), 202  # 202 Accepted - proceso en curso
        
        current_app.logger.error(f"Error descargando certificado {certificate_id}: {e}")
        return jsonify({'error': 'Error al descargar el certificado'}), 500


@conocer_bp.route('/certificates/<int:certificate_id>/download-url', methods=['GET'])
@jwt_required()
def get_download_url(certificate_id):
    """
    Obtener URL temporal para descarga directa
    
    Query params:
        - expiry_hours: Horas de validez (default: 1, max: 24)
    
    Returns:
        URL con SAS token para descarga directa
    """
    current_user_id = get_jwt_identity()
    
    certificate = ConocerCertificate.query.filter_by(
        id=certificate_id,
        user_id=current_user_id
    ).first()
    
    if not certificate:
        return jsonify({'error': 'Certificado no encontrado'}), 404
    
    expiry_hours = min(int(request.args.get('expiry_hours', 1)), 24)
    
    try:
        blob_service = get_conocer_blob_service()
        filename = f"CONOCER_{certificate.standard_code}_{certificate.certificate_number}.pdf"
        download_url = blob_service.generate_download_url(
            certificate.blob_name,
            expiry_hours=expiry_hours,
            filename=filename
        )
        
        if not download_url:
            # Verificar si está en Archive
            status = blob_service.get_blob_status(certificate.blob_name)
            if status and status.get('blob_tier') == 'StandardBlobTier.ARCHIVE':
                return jsonify({
                    'error': 'certificate_in_archive',
                    'message': 'El certificado está en almacenamiento de archivo',
                    'rehydration_url': f'/api/conocer/certificates/{certificate_id}/rehydrate'
                }), 202
            
            return jsonify({'error': 'No se pudo generar el URL de descarga'}), 500
        
        return jsonify({
            'download_url': download_url,
            'expires_in_hours': expiry_hours,
            'filename': filename
        })
        
    except Exception as e:
        current_app.logger.error(f"Error generando URL para certificado {certificate_id}: {e}")
        return jsonify({'error': 'Error al generar URL de descarga'}), 500


@conocer_bp.route('/certificates/<int:certificate_id>/rehydrate', methods=['POST'])
@jwt_required()
def rehydrate_certificate(certificate_id):
    """
    Iniciar rehidratación de un certificado desde Archive tier
    
    Body JSON (opcional):
        - priority: 'standard' (~15hrs) o 'high' (~1hr, más costoso)
    
    Returns:
        Estado de la rehidratación
    """
    current_user_id = get_jwt_identity()
    
    certificate = ConocerCertificate.query.filter_by(
        id=certificate_id,
        user_id=current_user_id
    ).first()
    
    if not certificate:
        return jsonify({'error': 'Certificado no encontrado'}), 404
    
    data = request.get_json() or {}
    priority = data.get('priority', 'standard')
    
    try:
        blob_service = get_conocer_blob_service()
        result = blob_service.rehydrate_from_archive(certificate.blob_name, priority)
        
        return jsonify(result)
        
    except Exception as e:
        current_app.logger.error(f"Error rehidratando certificado {certificate_id}: {e}")
        return jsonify({'error': 'Error al iniciar rehidratación'}), 500


@conocer_bp.route('/certificates/<int:certificate_id>/status', methods=['GET'])
@jwt_required()
def get_certificate_status(certificate_id):
    """
    Obtener estado del certificado (útil para verificar rehidratación)
    
    Returns:
        Estado actual del certificado en blob storage
    """
    current_user_id = get_jwt_identity()
    
    certificate = ConocerCertificate.query.filter_by(
        id=certificate_id,
        user_id=current_user_id
    ).first()
    
    if not certificate:
        return jsonify({'error': 'Certificado no encontrado'}), 404
    
    try:
        blob_service = get_conocer_blob_service()
        status = blob_service.get_blob_status(certificate.blob_name)
        
        if not status:
            return jsonify({
                'error': 'Archivo no encontrado en almacenamiento',
                'certificate_id': certificate_id
            }), 404
        
        return jsonify({
            'certificate_id': certificate_id,
            'certificate_number': certificate.certificate_number,
            **status
        })
        
    except Exception as e:
        current_app.logger.error(f"Error obteniendo estado de certificado {certificate_id}: {e}")
        return jsonify({'error': 'Error al obtener estado'}), 500


# ===== ENDPOINTS ADMIN (para gestión) =====

@conocer_bp.route('/admin/certificates', methods=['POST'])
@jwt_required()
def upload_certificate():
    """
    Subir un nuevo certificado CONOCER (solo admin/editor)
    
    Form data:
        - file: Archivo PDF del certificado (required)
        - user_id: ID del usuario propietario (required)
        - certificate_number: Folio oficial CONOCER (required)
        - curp: CURP del certificado (required)
        - standard_code: Código del estándar (required, ej: EC0217)
        - standard_name: Nombre del estándar (required)
        - issue_date: Fecha de emisión YYYY-MM-DD (required)
        - expiration_date: Fecha de vencimiento YYYY-MM-DD (optional)
        - evaluation_date: Fecha de evaluación YYYY-MM-DD (optional)
        - competency_level: Nivel de competencia (optional)
        - evaluation_center_name: Nombre del centro evaluador (optional)
        - evaluation_center_code: Código del centro evaluador (optional)
        - evaluator_name: Nombre del evaluador (optional)
    
    Returns:
        Certificado creado con metadata
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    # Verificar permisos
    if current_user.role not in ['admin', 'developer', 'editor']:
        return jsonify({'error': 'No tiene permisos para esta acción'}), 403
    
    # Validar archivo
    if 'file' not in request.files:
        return jsonify({'error': 'No se envió ningún archivo'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacío'}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Solo se permiten archivos PDF'}), 400
    
    # Validar campos requeridos
    required_fields = ['user_id', 'certificate_number', 'curp', 'standard_code', 'standard_name', 'issue_date']
    for field in required_fields:
        if not request.form.get(field):
            return jsonify({'error': f'El campo {field} es requerido'}), 400
    
    # Verificar que el usuario destino existe
    target_user = User.query.get(request.form['user_id'])
    if not target_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Verificar que no exista certificado con el mismo número
    existing = ConocerCertificate.query.filter_by(
        certificate_number=request.form['certificate_number']
    ).first()
    if existing:
        return jsonify({'error': 'Ya existe un certificado con ese número de folio'}), 409
    
    try:
        # Subir archivo al blob storage
        blob_service = get_conocer_blob_service()
        file_content = file.read()
        
        blob_name, file_hash, file_size = blob_service.upload_certificate(
            file_content=file_content,
            user_id=request.form['user_id'],
            certificate_number=request.form['certificate_number'],
            standard_code=request.form['standard_code'],
            metadata={
                'curp': request.form['curp'],
                'standard_name': request.form['standard_name'],
                'uploaded_by': current_user_id
            }
        )
        
        # Parsear fechas
        issue_date = datetime.strptime(request.form['issue_date'], '%Y-%m-%d').date()
        expiration_date = None
        evaluation_date = None
        
        if request.form.get('expiration_date'):
            expiration_date = datetime.strptime(request.form['expiration_date'], '%Y-%m-%d').date()
        
        if request.form.get('evaluation_date'):
            evaluation_date = datetime.strptime(request.form['evaluation_date'], '%Y-%m-%d').date()
        
        # Crear registro en BD
        certificate = ConocerCertificate(
            user_id=request.form['user_id'],
            certificate_number=request.form['certificate_number'],
            curp=request.form['curp'],
            standard_code=request.form['standard_code'],
            standard_name=request.form['standard_name'],
            competency_level=request.form.get('competency_level'),
            evaluation_center_name=request.form.get('evaluation_center_name'),
            evaluation_center_code=request.form.get('evaluation_center_code'),
            evaluator_name=request.form.get('evaluator_name'),
            issue_date=issue_date,
            expiration_date=expiration_date,
            evaluation_date=evaluation_date,
            blob_name=blob_name,
            blob_container='conocer-certificates',
            blob_tier='Cool',
            file_size=file_size,
            file_hash=file_hash,
            status='active'
        )
        
        db.session.add(certificate)
        db.session.commit()
        
        return jsonify({
            'message': 'Certificado subido exitosamente',
            'certificate': certificate.to_dict(include_blob_info=True)
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error subiendo certificado: {e}")
        return jsonify({'error': 'Error al subir el certificado'}), 500


@conocer_bp.route('/admin/certificates/<int:certificate_id>/archive', methods=['POST'])
@jwt_required()
def archive_certificate(certificate_id):
    """
    Mover un certificado al tier Archive manualmente (solo admin)
    
    Útil para certificados antiguos que ya no se consultan frecuentemente.
    
    Returns:
        Estado actualizado del certificado
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Solo administradores pueden archivar certificados'}), 403
    
    certificate = ConocerCertificate.query.get(certificate_id)
    if not certificate:
        return jsonify({'error': 'Certificado no encontrado'}), 404
    
    try:
        blob_service = get_conocer_blob_service()
        moved = blob_service.move_to_archive(certificate.blob_name)
        
        if moved:
            certificate.blob_tier = 'Archive'
            certificate.archived_at = datetime.utcnow()
            certificate.status = 'archived'
            db.session.commit()
            
            return jsonify({
                'message': 'Certificado movido a archivo exitosamente',
                'certificate': certificate.to_dict()
            })
        else:
            return jsonify({
                'message': 'El certificado ya estaba en archivo',
                'certificate': certificate.to_dict()
            })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error archivando certificado {certificate_id}: {e}")
        return jsonify({'error': 'Error al archivar certificado'}), 500


@conocer_bp.route('/admin/certificates/by-user/<user_id>', methods=['GET'])
@jwt_required()
def get_user_certificates_admin(user_id):
    """
    Obtener certificados de un usuario específico (solo admin/editor)
    
    Returns:
        Lista de certificados del usuario
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role not in ['admin', 'developer', 'editor', 'soporte']:
        return jsonify({'error': 'No tiene permisos para esta acción'}), 403
    
    certificates = ConocerCertificate.query.filter_by(user_id=user_id)\
        .order_by(ConocerCertificate.issue_date.desc()).all()
    
    return jsonify({
        'user_id': user_id,
        'certificates': [cert.to_dict(include_blob_info=True) for cert in certificates],
        'total': len(certificates)
    })


@conocer_bp.route('/verify/<certificate_number>', methods=['GET'])
def verify_certificate_public(certificate_number):
    """
    Verificar un certificado públicamente por su número de folio
    
    Este endpoint es público para permitir verificación externa.
    
    Returns:
        Información básica del certificado si existe
    """
    certificate = ConocerCertificate.query.filter_by(
        certificate_number=certificate_number
    ).first()
    
    if not certificate:
        return jsonify({
            'valid': False,
            'message': 'Certificado no encontrado'
        }), 404
    
    # Retornar solo información pública
    return jsonify({
        'valid': True,
        'certificate_number': certificate.certificate_number,
        'standard_code': certificate.standard_code,
        'standard_name': certificate.standard_name,
        'issue_date': certificate.issue_date.isoformat() if certificate.issue_date else None,
        'expiration_date': certificate.expiration_date.isoformat() if certificate.expiration_date else None,
        'is_expired': certificate.is_expired,
        'status': certificate.status,
        'evaluation_center_name': certificate.evaluation_center_name,
        'verification_url': certificate.verification_url
    })
