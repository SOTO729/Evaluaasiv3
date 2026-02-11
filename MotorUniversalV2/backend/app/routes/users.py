"""
Rutas de usuarios
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, cache
from app.models.user import User
from app.models.exam import Exam
from app.models.voucher import Voucher
from app.models.result import Result
from app.utils.cache_utils import make_cache_key_with_user
from app.utils.cdn_helper import transform_to_cdn_url

bp = Blueprint('users', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
def get_users():
    """
    Listar usuarios (solo admin/soporte)
    ---
    tags:
      - Users
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de usuarios
      403:
        description: Sin permisos
    """
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user or not current_user.has_permission('users:read'):
        return jsonify({'error': 'Permiso denegado'}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    role = request.args.get('role')
    
    query = User.query
    
    if role:
        query = query.filter_by(role=role)
    
    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )
    
    return jsonify({
        'users': [user.to_dict() for user in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': pagination.page
    }), 200


@bp.route('/<string:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Obtener información de un usuario"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Solo admin/soporte pueden ver otros usuarios, o el usuario mismo
    if user_id != current_user_id and not current_user.has_permission('users:read'):
        return jsonify({'error': 'Permiso denegado'}), 403
    
    include_private = (user_id == current_user_id or current_user.role in ['admin', 'soporte'])
    
    return jsonify(user.to_dict(include_private=include_private)), 200


@bp.route('/<string:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Actualizar usuario"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Solo el mismo usuario o admin pueden actualizar
    if user_id != current_user_id and current_user.role != 'admin':
        return jsonify({'error': 'Permiso denegado'}), 403
    
    data = request.get_json()
    
    # Campos que puede actualizar cualquier usuario
    self_updatable_fields = ['name', 'first_surname', 'second_surname', 'phone', 'gender']
    
    # Campos que solo admin puede actualizar
    admin_only_fields = ['role', 'is_active', 'campus_id', 'subsystem_id']
    
    for field in self_updatable_fields:
        if field in data:
            setattr(user, field, data[field])
    
    # Solo admin puede cambiar role y estado
    if current_user.role == 'admin':
        for field in admin_only_fields:
            if field in data:
                setattr(user, field, data[field])
    
    db.session.commit()
    
    return jsonify({
        'message': 'Usuario actualizado exitosamente',
        'user': user.to_dict(include_private=True)
    }), 200


@bp.route('/<string:user_id>/document-options', methods=['PUT'])
@jwt_required()
def update_document_options(user_id):
    """
    Actualizar opciones de documentos/certificados de un usuario
    Solo admin puede modificar estas opciones
    ---
    tags:
      - Users
    security:
      - Bearer: []
    parameters:
      - name: user_id
        in: path
        type: string
        required: true
      - name: body
        in: body
        schema:
          type: object
          properties:
            evaluation_report:
              type: boolean
            certificate:
              type: boolean
            conocer_certificate:
              type: boolean
            digital_badge:
              type: boolean
    responses:
      200:
        description: Opciones actualizadas
      403:
        description: Sin permisos
      404:
        description: Usuario no encontrado
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    # Solo admin puede actualizar opciones de documentos
    if current_user.role != 'admin':
        return jsonify({'error': 'Permiso denegado. Solo administradores pueden modificar estas opciones'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    data = request.get_json()
    
    # Mapeo de campos del request a columnas de BD
    option_fields = {
        'evaluation_report': 'enable_evaluation_report',
        'certificate': 'enable_certificate',
        'conocer_certificate': 'enable_conocer_certificate',
        'digital_badge': 'enable_digital_badge'
    }
    
    updated = []
    for key, db_field in option_fields.items():
        if key in data and isinstance(data[key], bool):
            setattr(user, db_field, data[key])
            updated.append(key)
    
    if updated:
        db.session.commit()
    
    return jsonify({
        'message': f'Opciones actualizadas: {", ".join(updated)}' if updated else 'No se realizaron cambios',
        'document_options': {
            'evaluation_report': user.enable_evaluation_report,
            'certificate': user.enable_certificate,
            'conocer_certificate': user.enable_conocer_certificate,
            'digital_badge': user.enable_digital_badge
        }
    }), 200


@bp.route('/me/dashboard', methods=['GET'])
@jwt_required()
@cache.cached(timeout=60, make_cache_key=make_cache_key_with_user)  # Cache por usuario, 60 segundos
def get_dashboard():
    """
    Obtener datos del dashboard del usuario actual
    Incluye exámenes disponibles, resultados y materiales de estudio
    
    OPTIMIZADO: Usa queries agregadas para evitar N+1
    
    IMPORTANTE: Los resultados se agrupan por ECM (competency_standard_id) cuando
    el examen tiene uno asociado, permitiendo ver el historial unificado de todas
    las versiones de examen para ese estándar de competencia.
    """
    try:
        from sqlalchemy import func, and_, or_, case, literal
        from sqlalchemy.orm import joinedload
        
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        if not current_user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        # ========== OPTIMIZACIÓN: Query única para exámenes con conteo de categorías ==========
        # Usamos subquery para contar categorías en lugar de lazy loading
        from app.models.category import Category
        
        category_counts = db.session.query(
            Category.exam_id,
            func.count(Category.id).label('count')
        ).group_by(Category.exam_id).subquery()
        
        available_exams = db.session.query(
            Exam,
            func.coalesce(category_counts.c.count, 0).label('categories_count')
        ).outerjoin(
            category_counts, Exam.id == category_counts.c.exam_id
        ).filter(
            Exam.is_published == True
        ).order_by(Exam.name).all()
        
        # ========== OPTIMIZACIÓN: Una sola query para todos los resultados ==========
        user_results = Result.query.filter_by(user_id=str(user_id)).order_by(Result.created_at.desc()).all()
        
        # Crear diccionarios de resultados por ECM y por exam_id
        results_by_ecm = {}
        results_by_exam = {}
        
        for result in user_results:
            if result.competency_standard_id:
                ecm_id = result.competency_standard_id
                if ecm_id not in results_by_ecm:
                    results_by_ecm[ecm_id] = []
                results_by_ecm[ecm_id].append(result.to_dict())
            else:
                exam_id = result.exam_id
                if exam_id not in results_by_exam:
                    results_by_exam[exam_id] = []
                results_by_exam[exam_id].append(result.to_dict())
        
        # Construir lista de exámenes con resultados
        exams_data = []
        for exam, categories_count in available_exams:
            if exam.competency_standard_id and exam.competency_standard_id in results_by_ecm:
                exam_results = results_by_ecm.get(exam.competency_standard_id, [])
            else:
                exam_results = results_by_exam.get(exam.id, [])
            
            best_score = max([r['score'] for r in exam_results], default=None)
            attempts = len(exam_results)
            last_attempt = exam_results[0] if exam_results else None
            is_completed = any(r['status'] == 1 for r in exam_results)
            is_approved = any(r['result'] == 1 for r in exam_results)
            approved_result = next((r for r in exam_results if r['result'] == 1), None)
            
            exams_data.append({
                'id': exam.id,
                'name': exam.name,
                'description': exam.description,
                'version': exam.version,
                'time_limit_minutes': exam.duration_minutes,
                'passing_score': exam.passing_score,
                'is_published': exam.is_published,
                'categories_count': categories_count,
                'competency_standard_id': exam.competency_standard_id,
                'user_stats': {
                    'attempts': attempts,
                    'best_score': best_score,
                    'is_completed': is_completed,
                    'is_approved': is_approved,
                    'last_attempt': last_attempt,
                    'approved_result': approved_result
                }
            })
        
        # Calcular estadísticas generales
        total_exams = len(available_exams)
        completed_exams = sum(1 for e in exams_data if e['user_stats']['is_completed'])
        approved_exams = sum(1 for e in exams_data if e['user_stats']['is_approved'])
        scores = [e['user_stats']['best_score'] for e in exams_data if e['user_stats']['best_score'] is not None]
        average_score = sum(scores) / len(scores) if scores else 0
        
        # ========== OPTIMIZACIÓN: Materiales con queries agregadas ==========
        materials_data = []
        try:
            from app.models.study_content import StudyMaterial, StudySession, StudyTopic, StudyReading, StudyVideo, StudyDownloadableExercise, StudyInteractiveExercise
            from app.models.student_progress import StudentContentProgress
            
            # Query para obtener materiales publicados
            available_materials = StudyMaterial.query.filter_by(is_published=True).order_by(StudyMaterial.order, StudyMaterial.title).all()
            
            if available_materials:
                material_ids = [m.id for m in available_materials]
                
                # ========== OPTIMIZACIÓN: Contar sesiones por material en una query ==========
                sessions_count_query = db.session.query(
                    StudySession.material_id,
                    func.count(StudySession.id).label('count')
                ).filter(
                    StudySession.material_id.in_(material_ids)
                ).group_by(StudySession.material_id).all()
                
                sessions_count_map = {row[0]: row[1] for row in sessions_count_query}
                
                # ========== OPTIMIZACIÓN: Obtener todos los topic_ids de una vez ==========
                sessions_subquery = db.session.query(StudySession.id).filter(
                    StudySession.material_id.in_(material_ids)
                ).subquery()
                
                all_topics = db.session.query(
                    StudyTopic.id,
                    StudySession.material_id
                ).join(
                    StudySession, StudyTopic.session_id == StudySession.id
                ).filter(
                    StudySession.material_id.in_(material_ids)
                ).all()
                
                # Mapear topics por material
                topics_by_material = {}
                all_topic_ids = []
                for topic_id, material_id in all_topics:
                    if material_id not in topics_by_material:
                        topics_by_material[material_id] = []
                    topics_by_material[material_id].append(topic_id)
                    all_topic_ids.append(topic_id)
                
                # ========== OPTIMIZACIÓN: Contar contenidos por tipo en queries agregadas ==========
                content_counts = {}
                
                if all_topic_ids:
                    # Contar readings
                    readings = db.session.query(
                        StudyReading.topic_id,
                        StudyReading.id
                    ).filter(StudyReading.topic_id.in_(all_topic_ids)).all()
                    
                    # Contar videos
                    videos = db.session.query(
                        StudyVideo.topic_id,
                        StudyVideo.id
                    ).filter(StudyVideo.topic_id.in_(all_topic_ids)).all()
                    
                    # Contar downloadables
                    downloadables = db.session.query(
                        StudyDownloadableExercise.topic_id,
                        StudyDownloadableExercise.id
                    ).filter(StudyDownloadableExercise.topic_id.in_(all_topic_ids)).all()
                    
                    # Contar ejercicios interactivos
                    try:
                        interactives = db.session.query(
                            StudyInteractiveExercise.topic_id,
                            StudyInteractiveExercise.id
                        ).filter(StudyInteractiveExercise.topic_id.in_(all_topic_ids)).all()
                    except:
                        interactives = []
                    
                    # Crear mapeo de todos los content_ids por tipo
                    all_content_ids = []
                    content_type_map = {}  # content_id -> (content_type, topic_id)
                    
                    for topic_id, content_id in readings:
                        all_content_ids.append(str(content_id))
                        content_type_map[str(content_id)] = ('reading', topic_id)
                    
                    for topic_id, content_id in videos:
                        all_content_ids.append(str(content_id))
                        content_type_map[str(content_id)] = ('video', topic_id)
                    
                    for topic_id, content_id in downloadables:
                        all_content_ids.append(str(content_id))
                        content_type_map[str(content_id)] = ('downloadable', topic_id)
                    
                    for topic_id, content_id in interactives:
                        all_content_ids.append(str(content_id))
                        content_type_map[str(content_id)] = ('interactive', topic_id)
                    
                    # ========== OPTIMIZACIÓN: Una sola query para progreso del usuario ==========
                    completed_content_ids = set()
                    if all_content_ids:
                        user_progress = db.session.query(
                            StudentContentProgress.content_id
                        ).filter(
                            StudentContentProgress.user_id == str(user_id),
                            StudentContentProgress.content_id.in_(all_content_ids),
                            StudentContentProgress.is_completed == True
                        ).all()
                        
                        completed_content_ids = {row[0] for row in user_progress}
                    
                    # Calcular totales y completados por material
                    for material in available_materials:
                        topic_ids_for_material = topics_by_material.get(material.id, [])
                        total_contents = 0
                        completed_contents = 0
                        
                        for content_id, (content_type, topic_id) in content_type_map.items():
                            if topic_id in topic_ids_for_material:
                                total_contents += 1
                                if content_id in completed_content_ids:
                                    completed_contents += 1
                        
                        content_counts[material.id] = {
                            'total': total_contents,
                            'completed': completed_contents
                        }
                
                # Construir respuesta de materiales
                for material in available_materials:
                    sessions_count = sessions_count_map.get(material.id, 0)
                    counts = content_counts.get(material.id, {'total': 0, 'completed': 0})
                    total = counts['total']
                    completed = counts['completed']
                    
                    progress_percentage = round((completed / total * 100)) if total > 0 else 0
                    
                    materials_data.append({
                        'id': material.id,
                        'title': material.title,
                        'description': material.description,
                        'image_url': transform_to_cdn_url(material.image_url) if material.image_url else None,
                        'sessions_count': sessions_count,
                        'progress': {
                            'total_contents': total,
                            'completed_contents': completed,
                            'percentage': progress_percentage
                        }
                    })
                    
        except Exception as e:
            print(f"[DASHBOARD] Error al obtener materiales: {e}")
            import traceback
            traceback.print_exc()
        
        # ========== OBTENER DOCUMENT_OPTIONS DEL GRUPO DEL CANDIDATO ==========
        # Para candidatos, los certificados habilitados se determinan por el grupo
        # PERO también depende de si el candidato tiene CURP (conocer) y email (badge)
        document_options = {
            'evaluation_report': True,  # El reporte siempre está habilitado
            'certificate': False,
            'conocer_certificate': False,
            'digital_badge': False
        }
        
        # Validar que el candidato tenga los datos requeridos para cada tipo de certificado
        # Estos flags indican si el candidato PODRÍA recibir el certificado (si el grupo lo tiene habilitado)
        can_receive_conocer = bool(current_user.curp)  # Requiere CURP
        can_receive_badge = bool(current_user.email)   # Requiere email
        
        if current_user.role == 'candidato':
            try:
                from app.models.partner import GroupMember, CandidateGroup
                
                # Buscar membresía activa del candidato
                membership = GroupMember.query.filter_by(
                    user_id=str(user_id),
                    status='active'
                ).first()
                
                if membership:
                    # Buscar grupo (sin filtrar por is_active para obtener configuración)
                    group = CandidateGroup.query.get(membership.group_id)
                    
                    if group:
                        # Obtener configuración efectiva (grupo override o campus)
                        campus = group.campus
                        
                        # enable_tier_basic = Constancia de Evaluación (Reporte) - siempre true por ahora
                        # enable_tier_standard = Certificado Eduit (certificate)
                        # enable_tier_advanced = Certificado CONOCER
                        # enable_digital_badge = Insignia digital
                        
                        # Tier Standard -> Certificado Eduit (siempre disponible)
                        if group.enable_tier_standard_override is not None:
                            document_options['certificate'] = group.enable_tier_standard_override
                        elif campus and campus.enable_tier_standard is not None:
                            document_options['certificate'] = campus.enable_tier_standard
                        
                        # Tier Advanced -> Certificado CONOCER (requiere CURP)
                        conocer_enabled = False
                        if group.enable_tier_advanced_override is not None:
                            conocer_enabled = group.enable_tier_advanced_override
                        elif campus and campus.enable_tier_advanced is not None:
                            conocer_enabled = campus.enable_tier_advanced
                        # Solo habilitado si el candidato tiene CURP
                        document_options['conocer_certificate'] = conocer_enabled and can_receive_conocer
                        
                        # Digital Badge (requiere email)
                        badge_enabled = False
                        if group.enable_digital_badge_override is not None:
                            badge_enabled = group.enable_digital_badge_override
                        elif campus and campus.enable_digital_badge is not None:
                            badge_enabled = campus.enable_digital_badge
                        # Solo habilitado si el candidato tiene email
                        document_options['digital_badge'] = badge_enabled and can_receive_badge
            except Exception as e:
                pass  # Mantener defaults si hay error
        
        # Agregar información sobre requisitos faltantes al response
        document_requirements_missing = []
        if not can_receive_conocer:
            document_requirements_missing.append('curp_required_for_conocer')
        if not can_receive_badge:
            document_requirements_missing.append('email_required_for_badge')
        
        # ========== VM FLAG ==========
        vm_enabled = False
        if current_user.role == 'candidato':
            try:
                from app.models.partner import GroupMember as GM2, CandidateGroup as CG2
                mem = GM2.query.filter_by(user_id=str(user_id), status='active').first()
                if mem:
                    grp = CG2.query.get(mem.group_id)
                    if grp:
                        cmp = grp.campus
                        if grp.enable_virtual_machines_override is not None:
                            vm_enabled = grp.enable_virtual_machines_override
                        elif cmp and cmp.enable_virtual_machines is not None:
                            vm_enabled = cmp.enable_virtual_machines
            except Exception:
                pass
        elif current_user.role in ['admin', 'coordinator']:
            vm_enabled = True
        
        # Construir respuesta del usuario con document_options actualizados
        user_data = current_user.to_dict()
        user_data['document_options'] = document_options
        user_data['document_requirements_missing'] = document_requirements_missing
        user_data['vm_enabled'] = vm_enabled
        
        return jsonify({
            'user': user_data,
            'stats': {
                'total_exams': total_exams,
                'completed_exams': completed_exams,
                'approved_exams': approved_exams,
                'average_score': round(average_score, 1)
            },
            'exams': exams_data,
            'materials': materials_data
        }), 200
        
    except Exception as e:
        print(f"Error en get_dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error interno del servidor', 'message': str(e)}), 500

@bp.route('/me/editor-dashboard', methods=['GET'])
@jwt_required()
@cache.cached(timeout=120, make_cache_key=make_cache_key_with_user)  # Cache por usuario, 2 minutos
def get_editor_dashboard():
    """
    Dashboard para usuarios tipo editor con métricas de creación
    ---
    tags:
      - Users
    security:
      - Bearer: []
    responses:
      200:
        description: Dashboard del editor con estadísticas de creación
      403:
        description: No es un editor
    """
    try:
        from app.models.exam import Exam
        from app.models.competency_standard import CompetencyStandard
        from app.models.study_content import StudyMaterial
        from sqlalchemy import func
        
        user_id = get_jwt_identity()
        current_user = User.query.get(user_id)
        
        if not current_user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        # Verificar que sea editor o admin
        if current_user.role not in ['admin', 'editor']:
            return jsonify({'error': 'Acceso solo para editores'}), 403
        
        # ===== ESTADÍSTICAS DE ESTÁNDARES (ECM) =====
        total_standards = CompetencyStandard.query.count()
        active_standards = CompetencyStandard.query.filter_by(is_active=True).count()
        
        # Estándares recientes (ordenados por updated_at, más reciente primero)
        recent_standards = CompetencyStandard.query.order_by(
            CompetencyStandard.updated_at.desc()
        ).limit(5).all()
        
        recent_standards_data = [{
            'id': s.id,
            'code': s.code,
            'name': s.name,
            'sector': s.sector,
            'level': s.level,
            'is_active': s.is_active,
            'created_at': s.created_at.isoformat() if s.created_at else None,
            'updated_at': s.updated_at.isoformat() if s.updated_at else None
        } for s in recent_standards]
        
        # ===== ESTADÍSTICAS DE EXÁMENES =====
        total_exams = Exam.query.count()
        published_exams = Exam.query.filter_by(is_published=True).count()
        draft_exams = Exam.query.filter_by(is_published=False).count()
        
        # Exámenes recientes (ordenados por updated_at, más reciente primero)
        recent_exams = Exam.query.order_by(
            Exam.updated_at.desc()
        ).limit(5).all()
        
        recent_exams_data = [{
            'id': e.id,
            'name': e.name,
            'version': e.version,
            'is_published': e.is_published,
            'passing_score': e.passing_score,
            'duration_minutes': e.duration_minutes,
            'total_categories': e.categories.count() if e.categories else 0,
            'created_at': e.created_at.isoformat() if e.created_at else None,
            'updated_at': e.updated_at.isoformat() if e.updated_at else None,
            'competency_standard': {
                'id': e.competency_standard.id,
                'code': e.competency_standard.code,
                'name': e.competency_standard.name
            } if e.competency_standard else None
        } for e in recent_exams]
        
        # ===== ESTADÍSTICAS DE MATERIALES DE ESTUDIO =====
        total_materials = StudyMaterial.query.count()
        published_materials = StudyMaterial.query.filter_by(is_published=True).count()
        draft_materials = StudyMaterial.query.filter_by(is_published=False).count()
        
        # Materiales recientes (ordenados por updated_at, más reciente primero)
        recent_materials = StudyMaterial.query.order_by(
            StudyMaterial.updated_at.desc()
        ).limit(5).all()
        
        recent_materials_data = []
        for m in recent_materials:
            # Calcular conteo de sesiones y temas
            sessions_count = m.sessions.count() if m.sessions else 0
            topics_count = 0
            total_estimated_time = 0
            if m.sessions:
                for session in m.sessions.all():
                    if session.topics:
                        topics_count += session.topics.count()
                        # Sumar tiempo estimado de cada tema
                        for topic in session.topics.all():
                            total_estimated_time += getattr(topic, 'estimated_time_minutes', 0) or 0
            
            recent_materials_data.append({
                'id': m.id,
                'title': m.title,
                'description': m.description,
                'image_url': transform_to_cdn_url(m.image_url) if m.image_url else None,
                'is_published': m.is_published,
                'sessions_count': sessions_count,
                'topics_count': topics_count,
                'estimated_time_minutes': total_estimated_time,
                'created_at': m.created_at.isoformat() if m.created_at else None,
                'updated_at': m.updated_at.isoformat() if m.updated_at else None
            })
        
        # ===== ESTADÍSTICAS DE PREGUNTAS =====
        from app.models.question import Question, QuestionType
        from app.models.topic import Topic
        
        total_questions = Question.query.count()
        
        # Contar preguntas por tipo usando un join con question_types
        questions_by_type = db.session.query(
            QuestionType.name,
            func.count(Question.id)
        ).join(Question, Question.question_type_id == QuestionType.id
        ).group_by(QuestionType.name).all()
        
        questions_by_type_data = {qt_name: count for qt_name, count in questions_by_type}
        
        # ===== RESUMEN RÁPIDO =====
        summary = {
            'standards': {
                'total': total_standards,
                'active': active_standards
            },
            'exams': {
                'total': total_exams,
                'published': published_exams,
                'draft': draft_exams
            },
            'materials': {
                'total': total_materials,
                'published': published_materials,
                'draft': draft_materials
            },
            'questions': {
                'total': total_questions,
                'by_type': questions_by_type_data
            }
        }
        
        return jsonify({
            'user': current_user.to_dict(),
            'summary': summary,
            'recent_standards': recent_standards_data,
            'recent_exams': recent_exams_data,
            'recent_materials': recent_materials_data
        }), 200
        
    except Exception as e:
        print(f"Error en get_editor_dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error interno del servidor', 'message': str(e)}), 500