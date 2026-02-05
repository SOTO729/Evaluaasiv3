"""
Rutas para gestión de Estándares de Competencia (ECM)
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, cache
from app.models import User, CompetencyStandard, DeletionRequest, Exam
from app.utils.cache_utils import make_cache_key, invalidate_standards_cache

standards_bp = Blueprint('standards', __name__)


@standards_bp.route('/', methods=['GET'])
@jwt_required()
def get_standards():
    """
    Obtener lista de estándares de competencia
    
    Query params:
        - active_only: Solo estándares activos (default: true)
        - include_stats: Incluir estadísticas (default: false)
    
    Nota: Se eliminó el caché y se agregan headers no-cache para garantizar datos actualizados
    """
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    include_stats = request.args.get('include_stats', 'false').lower() == 'true'
    
    query = CompetencyStandard.query
    
    if active_only:
        query = query.filter_by(is_active=True)
    
    standards = query.order_by(CompetencyStandard.code).all()
    
    response = jsonify({
        'standards': [s.to_dict(include_stats=include_stats) for s in standards],
        'total': len(standards)
    })
    # Evitar cualquier caché en navegador o proxies
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@standards_bp.route('/<int:standard_id>', methods=['GET'])
@jwt_required()
def get_standard(standard_id):
    """Obtener detalle de un estándar de competencia"""
    standard = CompetencyStandard.query.get(standard_id)
    
    if not standard:
        return jsonify({'error': 'Estándar no encontrado'}), 404
    
    return jsonify(standard.to_dict(include_stats=True))


@standards_bp.route('/', methods=['POST'])
@jwt_required()
def create_standard():
    """
    Crear un nuevo estándar de competencia
    
    Solo admin y editor pueden crear estándares.
    
    Body JSON:
        - code: Código del estándar (required, unique) ej: EC0217
        - name: Nombre del estándar (required)
        - description: Descripción (optional)
        - sector: Sector productivo (optional)
        - level: Nivel de competencia 1-5 (optional)
        - validity_years: Años de vigencia (default: 5)
        - certifying_body: Organismo certificador (default: CONOCER)
        - brand_id: ID de la marca (Microsoft, Huawei, Abierto) (optional)
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role not in ['admin', 'editor']:
        return jsonify({'error': 'No tiene permisos para crear estándares'}), 403
    
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No se enviaron datos'}), 400
    
    # Validar campos requeridos
    if not data.get('code'):
        return jsonify({'error': 'El código del estándar es requerido'}), 400
    
    if not data.get('name'):
        return jsonify({'error': 'El nombre del estándar es requerido'}), 400
    
    # Verificar que el código no exista
    existing = CompetencyStandard.query.filter_by(code=data['code'].upper()).first()
    if existing:
        return jsonify({'error': f'Ya existe un estándar con el código {data["code"]}'}), 409
    
    try:
        standard = CompetencyStandard(
            code=data['code'].upper(),
            name=data['name'],
            description=data.get('description'),
            sector=data.get('sector'),
            level=data.get('level'),
            validity_years=data.get('validity_years', 5),
            certifying_body=data.get('certifying_body', 'CONOCER'),
            brand_id=data.get('brand_id'),
            is_active=True,
            created_by=current_user_id
        )
        
        db.session.add(standard)
        db.session.commit()
        
        # Invalidar caché de estándares
        invalidate_standards_cache()
        
        return jsonify({
            'message': 'Estándar creado exitosamente',
            'standard': standard.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al crear el estándar: {str(e)}'}), 500


@standards_bp.route('/<int:standard_id>', methods=['PUT'])
@jwt_required()
def update_standard(standard_id):
    """
    Actualizar un estándar de competencia
    
    Admin puede editar cualquier estándar.
    Editor solo puede editar los que creó.
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role not in ['admin', 'editor']:
        return jsonify({'error': 'No tiene permisos para editar estándares'}), 403
    
    standard = CompetencyStandard.query.get(standard_id)
    
    if not standard:
        return jsonify({'error': 'Estándar no encontrado'}), 404
    
    # Editor solo puede editar sus propios estándares
    if current_user.role == 'editor' and standard.created_by != current_user_id:
        return jsonify({'error': 'Solo puede editar los estándares que usted creó'}), 403
    
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No se enviaron datos'}), 400
    
    try:
        # Actualizar campos permitidos
        if 'name' in data:
            standard.name = data['name']
        if 'description' in data:
            standard.description = data['description']
        if 'sector' in data:
            standard.sector = data['sector']
        if 'level' in data:
            standard.level = data['level']
        if 'validity_years' in data:
            standard.validity_years = data['validity_years']
        if 'certifying_body' in data:
            standard.certifying_body = data['certifying_body']
        if 'brand_id' in data:
            standard.brand_id = data['brand_id']
        if 'is_active' in data and current_user.role == 'admin':
            standard.is_active = data['is_active']
        
        # No permitir cambiar el código una vez creado
        if 'code' in data and data['code'].upper() != standard.code:
            return jsonify({'error': 'No se puede cambiar el código del estándar'}), 400
        
        standard.updated_by = current_user_id
        standard.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Invalidar caché de estándares
        invalidate_standards_cache()
        
        return jsonify({
            'message': 'Estándar actualizado exitosamente',
            'standard': standard.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al actualizar el estándar: {str(e)}'}), 500


@standards_bp.route('/<int:standard_id>', methods=['DELETE'])
@jwt_required()
def delete_standard(standard_id):
    """
    Eliminar un estándar de competencia
    
    Solo admin puede eliminar estándares.
    No se puede eliminar si tiene exámenes o resultados asociados.
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role != 'admin':
        return jsonify({'error': 'Solo administradores pueden eliminar estándares'}), 403
    
    standard = CompetencyStandard.query.get(standard_id)
    
    if not standard:
        return jsonify({'error': 'Estándar no encontrado'}), 404
    
    # Verificar que no tenga exámenes asociados
    exam_count = standard.get_exam_count()
    if exam_count > 0:
        return jsonify({
            'error': f'No se puede eliminar: el estándar tiene {exam_count} examen(es) asociado(s)'
        }), 409
    
    # Verificar que no tenga resultados asociados
    results_count = standard.get_results_count()
    if results_count > 0:
        return jsonify({
            'error': f'No se puede eliminar: el estándar tiene {results_count} resultado(s) asociado(s)'
        }), 409
    
    try:
        db.session.delete(standard)
        db.session.commit()
        
        # Invalidar caché de estándares
        invalidate_standards_cache()
        
        return jsonify({'message': 'Estándar eliminado exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar el estándar: {str(e)}'}), 500


@standards_bp.route('/<int:standard_id>/request-deletion', methods=['POST'])
@jwt_required()
def request_deletion(standard_id):
    """
    Solicitar eliminación de un estándar (para editores)
    
    Body JSON:
        - reason: Razón de la solicitud (required)
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role not in ['admin', 'editor']:
        return jsonify({'error': 'No tiene permisos para esta acción'}), 403
    
    standard = CompetencyStandard.query.get(standard_id)
    
    if not standard:
        return jsonify({'error': 'Estándar no encontrado'}), 404
    
    data = request.get_json()
    
    if not data or not data.get('reason'):
        return jsonify({'error': 'Debe proporcionar una razón para la solicitud'}), 400
    
    # Verificar si ya existe una solicitud pendiente
    existing_request = DeletionRequest.query.filter_by(
        entity_type='competency_standard',
        entity_id=standard_id,
        status='pending'
    ).first()
    
    if existing_request:
        return jsonify({'error': 'Ya existe una solicitud de eliminación pendiente para este estándar'}), 409
    
    try:
        deletion_request = DeletionRequest(
            entity_type='competency_standard',
            entity_id=standard_id,
            entity_name=f'{standard.code} - {standard.name}',
            reason=data['reason'],
            requested_by=current_user_id
        )
        
        db.session.add(deletion_request)
        db.session.commit()
        
        return jsonify({
            'message': 'Solicitud de eliminación enviada',
            'request': deletion_request.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al crear la solicitud: {str(e)}'}), 500


@standards_bp.route('/<int:standard_id>/exams', methods=['GET'])
@jwt_required()
def get_standard_exams(standard_id):
    """Obtener todos los exámenes asociados a un estándar"""
    standard = CompetencyStandard.query.get(standard_id)
    
    if not standard:
        return jsonify({'error': 'Estándar no encontrado'}), 404
    
    exams = standard.exams.order_by(Exam.version.desc()).all()
    
    return jsonify({
        'standard': {
            'id': standard.id,
            'code': standard.code,
            'name': standard.name
        },
        'exams': [e.to_dict() for e in exams],
        'total': len(exams)
    })


# ===== ENDPOINTS ADMIN PARA SOLICITUDES DE ELIMINACIÓN =====

@standards_bp.route('/deletion-requests', methods=['GET'])
@jwt_required()
def get_deletion_requests():
    """
    Obtener solicitudes de eliminación (solo admin)
    
    Query params:
        - status: Filtrar por estado (pending, approved, rejected)
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role != 'admin':
        return jsonify({'error': 'Solo administradores pueden ver las solicitudes'}), 403
    
    status_filter = request.args.get('status')
    
    query = DeletionRequest.query
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    requests = query.order_by(DeletionRequest.requested_at.desc()).all()
    
    return jsonify({
        'requests': [r.to_dict() for r in requests],
        'total': len(requests)
    })


@standards_bp.route('/deletion-requests/<int:request_id>/review', methods=['POST'])
@jwt_required()
def review_deletion_request(request_id):
    """
    Aprobar o rechazar una solicitud de eliminación (solo admin)
    
    Body JSON:
        - action: 'approve' o 'reject' (required)
        - response: Respuesta del admin (optional)
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role != 'admin':
        return jsonify({'error': 'Solo administradores pueden revisar solicitudes'}), 403
    
    deletion_request = DeletionRequest.query.get(request_id)
    
    if not deletion_request:
        return jsonify({'error': 'Solicitud no encontrada'}), 404
    
    if deletion_request.status != 'pending':
        return jsonify({'error': 'Esta solicitud ya fue procesada'}), 400
    
    data = request.get_json()
    
    if not data or data.get('action') not in ['approve', 'reject']:
        return jsonify({'error': 'Debe especificar una acción válida (approve/reject)'}), 400
    
    try:
        if data['action'] == 'approve':
            # Intentar eliminar la entidad
            if deletion_request.entity_type == 'competency_standard':
                standard = CompetencyStandard.query.get(deletion_request.entity_id)
                if standard:
                    # Verificar restricciones
                    if standard.get_exam_count() > 0:
                        return jsonify({
                            'error': 'No se puede eliminar: el estándar tiene exámenes asociados'
                        }), 409
                    if standard.get_results_count() > 0:
                        return jsonify({
                            'error': 'No se puede eliminar: el estándar tiene resultados asociados'
                        }), 409
                    
                    db.session.delete(standard)
            
            deletion_request.status = 'approved'
        else:
            deletion_request.status = 'rejected'
        
        deletion_request.admin_response = data.get('response')
        deletion_request.reviewed_by = current_user_id
        deletion_request.reviewed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': f'Solicitud {deletion_request.status}',
            'request': deletion_request.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al procesar la solicitud: {str(e)}'}), 500


# ============== ENDPOINTS DE MARCAS (BRANDS) ==============

@standards_bp.route('/brands', methods=['GET'])
@jwt_required()
def get_brands():
    """
    Obtener lista de marcas disponibles para ECM
    
    Query params:
        - active_only: Solo marcas activas (default: true)
        - include_stats: Incluir conteo de ECMs (default: false)
    """
    from app.models.brand import Brand
    
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    include_stats = request.args.get('include_stats', 'false').lower() == 'true'
    
    query = Brand.query
    
    if active_only:
        query = query.filter_by(is_active=True)
    
    brands = query.order_by(Brand.display_order, Brand.name).all()
    
    return jsonify({
        'brands': [b.to_dict(include_stats=include_stats) for b in brands],
        'total': len(brands)
    })


@standards_bp.route('/brands/<int:brand_id>', methods=['GET'])
@jwt_required()
def get_brand(brand_id):
    """Obtener detalle de una marca"""
    from app.models.brand import Brand
    
    brand = Brand.query.get_or_404(brand_id)
    return jsonify({
        'brand': brand.to_dict(include_stats=True)
    })


@standards_bp.route('/brands', methods=['POST'])
@jwt_required()
def create_brand():
    """Crear una nueva marca (solo admin)"""
    from app.models.brand import Brand
    
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or user.role not in ['admin', 'coordinador']:
        return jsonify({'error': 'No tienes permisos para crear marcas'}), 403
    
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'El nombre de la marca es requerido'}), 400
    
    # Verificar nombre único
    existing = Brand.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Ya existe una marca con ese nombre'}), 400
    
    try:
        brand = Brand(
            name=data['name'],
            logo_url=data.get('logo_url'),
            description=data.get('description'),
            display_order=data.get('display_order', 0),
            is_active=data.get('is_active', True),
            created_by=current_user_id
        )
        
        db.session.add(brand)
        db.session.commit()
        
        return jsonify({
            'message': 'Marca creada exitosamente',
            'brand': brand.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al crear la marca: {str(e)}'}), 500


@standards_bp.route('/brands/<int:brand_id>', methods=['PUT'])
@jwt_required()
def update_brand(brand_id):
    """Actualizar una marca existente (solo admin)"""
    from app.models.brand import Brand
    
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or user.role not in ['admin', 'coordinador']:
        return jsonify({'error': 'No tienes permisos para editar marcas'}), 403
    
    brand = Brand.query.get_or_404(brand_id)
    data = request.get_json()
    
    # Verificar nombre único si cambia
    if data.get('name') and data['name'] != brand.name:
        existing = Brand.query.filter_by(name=data['name']).first()
        if existing:
            return jsonify({'error': 'Ya existe una marca con ese nombre'}), 400
    
    try:
        if 'name' in data:
            brand.name = data['name']
        if 'logo_url' in data:
            brand.logo_url = data['logo_url']
        if 'description' in data:
            brand.description = data['description']
        if 'display_order' in data:
            brand.display_order = data['display_order']
        if 'is_active' in data:
            brand.is_active = data['is_active']
        
        brand.updated_by = current_user_id
        
        db.session.commit()
        
        return jsonify({
            'message': 'Marca actualizada exitosamente',
            'brand': brand.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al actualizar la marca: {str(e)}'}), 500


@standards_bp.route('/brands/<int:brand_id>', methods=['DELETE'])
@jwt_required()
def delete_brand(brand_id):
    """Eliminar una marca (solo admin, soft delete)"""
    from app.models.brand import Brand
    
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Solo administradores pueden eliminar marcas'}), 403
    
    brand = Brand.query.get_or_404(brand_id)
    
    # Verificar si tiene estándares asociados
    standards_count = brand.get_standards_count()
    if standards_count > 0:
        return jsonify({
            'error': f'No se puede eliminar: la marca tiene {standards_count} estándares asociados'
        }), 409
    
    try:
        # Soft delete
        brand.is_active = False
        brand.updated_by = current_user_id
        db.session.commit()
        
        return jsonify({
            'message': 'Marca desactivada exitosamente'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar la marca: {str(e)}'}), 500


# ============== ENDPOINTS DE LOGO ECM ==============

@standards_bp.route('/<int:standard_id>/logo', methods=['POST'])
@jwt_required()
def upload_standard_logo(standard_id):
    """
    Subir logo para un estándar de competencia
    
    El logo se convierte automáticamente a WebP para optimización.
    
    Acepta:
        - multipart/form-data con archivo 'logo'
        - application/json con campo 'logo' en base64
    
    Returns:
        - logo_url: URL del logo subido
    """
    from app.utils.azure_storage import azure_storage
    
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role not in ['admin', 'editor']:
        return jsonify({'error': 'No tiene permisos para subir logos'}), 403
    
    standard = CompetencyStandard.query.get(standard_id)
    
    if not standard:
        return jsonify({'error': 'Estándar no encontrado'}), 404
    
    try:
        logo_data = None
        
        # Verificar si viene como archivo o como base64
        if request.files and 'logo' in request.files:
            logo_data = request.files['logo']
        elif request.is_json:
            data = request.get_json()
            if data and 'logo' in data:
                logo_data = data['logo']
        
        if not logo_data:
            return jsonify({'error': 'No se recibió ningún archivo de logo'}), 400
        
        # Subir imagen convertida a WebP
        logo_url = azure_storage.upload_image_as_webp(
            logo_data, 
            folder='ecm-logos',
            quality=85
        )
        
        if not logo_url:
            return jsonify({'error': 'Error al subir el logo a Azure Storage'}), 500
        
        # Si hay logo anterior, intentar eliminarlo
        if standard.logo_url:
            try:
                azure_storage.delete_file(standard.logo_url)
            except:
                pass  # No es crítico si falla
        
        # Actualizar estándar con nuevo logo
        standard.logo_url = logo_url
        standard.updated_by = current_user_id
        standard.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Invalidar caché
        invalidate_standards_cache()
        
        return jsonify({
            'message': 'Logo subido exitosamente',
            'logo_url': logo_url,
            'standard': standard.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al subir logo: {str(e)}'}), 500


@standards_bp.route('/<int:standard_id>/logo', methods=['DELETE'])
@jwt_required()
def delete_standard_logo(standard_id):
    """
    Eliminar logo de un estándar de competencia
    """
    from app.utils.azure_storage import azure_storage
    
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role not in ['admin', 'editor']:
        return jsonify({'error': 'No tiene permisos para eliminar logos'}), 403
    
    standard = CompetencyStandard.query.get(standard_id)
    
    if not standard:
        return jsonify({'error': 'Estándar no encontrado'}), 404
    
    if not standard.logo_url:
        return jsonify({'message': 'El estándar no tiene logo'}), 200
    
    try:
        # Intentar eliminar de Azure Storage
        try:
            azure_storage.delete_file(standard.logo_url)
        except:
            pass  # No es crítico si falla
        
        # Quitar logo del estándar
        standard.logo_url = None
        standard.updated_by = current_user_id
        standard.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Invalidar caché
        invalidate_standards_cache()
        
        return jsonify({
            'message': 'Logo eliminado exitosamente',
            'standard': standard.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar logo: {str(e)}'}), 500
