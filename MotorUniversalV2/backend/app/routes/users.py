"""
Rutas de usuarios
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.exam import Exam
from app.models.voucher import Voucher
from app.models.result import Result

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
    self_updatable_fields = ['name', 'first_surname', 'second_surname', 'phone']
    
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


@bp.route('/me/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    """
    Obtener datos del dashboard del usuario actual
    Incluye exámenes disponibles, resultados y materiales de estudio
    """
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Obtener exámenes publicados disponibles para todos
    available_exams = Exam.query.filter_by(is_published=True).order_by(Exam.name).all()
    
    # Obtener resultados del usuario
    user_results = Result.query.filter_by(user_id=user_id).order_by(Result.created_at.desc()).all()
    
    # Crear diccionario de resultados por examen para fácil acceso
    results_by_exam = {}
    for result in user_results:
        exam_id = result.exam_id
        if exam_id not in results_by_exam:
            results_by_exam[exam_id] = []
        results_by_exam[exam_id].append(result.to_dict())
    
    # Construir lista de exámenes con resultados
    exams_data = []
    for exam in available_exams:
        exam_dict = exam.to_dict()
        exam_results = results_by_exam.get(exam.id, [])
        
        # Calcular estadísticas del examen
        best_score = max([r['score'] for r in exam_results], default=None)
        attempts = len(exam_results)
        last_attempt = exam_results[0] if exam_results else None
        is_completed = any(r['status'] == 1 for r in exam_results)
        is_approved = any(r['result'] == 1 for r in exam_results)
        
        exams_data.append({
            'id': exam.id,
            'name': exam.name,
            'description': exam.description,
            'version': exam.version,
            'time_limit_minutes': exam.time_limit_minutes,
            'passing_score': exam.passing_score,
            'is_published': exam.is_published,
            'categories_count': exam.categories.count() if hasattr(exam.categories, 'count') else len(list(exam.categories)),
            # Resultados del usuario
            'user_stats': {
                'attempts': attempts,
                'best_score': best_score,
                'is_completed': is_completed,
                'is_approved': is_approved,
                'last_attempt': last_attempt
            }
        })
    
    # Calcular estadísticas generales
    total_exams = len(available_exams)
    completed_exams = sum(1 for e in exams_data if e['user_stats']['is_completed'])
    approved_exams = sum(1 for e in exams_data if e['user_stats']['is_approved'])
    
    # Calcular promedio solo de exámenes completados
    scores = [e['user_stats']['best_score'] for e in exams_data if e['user_stats']['best_score'] is not None]
    average_score = sum(scores) / len(scores) if scores else 0
    
    # Obtener materiales de estudio publicados
    try:
        from app.models.study_content import StudyMaterial, StudentContentProgress
        
        available_materials = StudyMaterial.query.filter_by(is_published=True).order_by(StudyMaterial.order, StudyMaterial.title).all()
        
        materials_data = []
        for material in available_materials:
            # Calcular progreso del material
            total_contents = 0
            completed_contents = 0
            
            for session in material.sessions.all():
                for topic in session.topics.all():
                    # Contar contenidos del tema
                    from app.models.study_content import StudyReading, StudyVideo, StudyDownloadableExercise, StudyInteractiveExercise
                    
                    readings = StudyReading.query.filter_by(topic_id=topic.id).count()
                    videos = StudyVideo.query.filter_by(topic_id=topic.id).count()
                    downloadables = StudyDownloadableExercise.query.filter_by(topic_id=topic.id).count()
                    interactives = StudyInteractiveExercise.query.filter_by(topic_id=topic.id).count()
                    
                    total_contents += readings + videos + downloadables + interactives
                    
                    # Contar contenidos completados por el usuario
                    completed = StudentContentProgress.query.filter_by(
                        user_id=user_id,
                        topic_id=topic.id,
                        is_completed=True
                    ).count()
                    completed_contents += completed
            
            progress_percentage = (completed_contents / total_contents * 100) if total_contents > 0 else 0
            
            materials_data.append({
                'id': material.id,
                'title': material.title,
                'description': material.description,
                'image_url': material.image_url,
                'sessions_count': material.sessions.count() if hasattr(material.sessions, 'count') else len(list(material.sessions)),
                'progress': {
                    'total_contents': total_contents,
                    'completed_contents': completed_contents,
                    'percentage': round(progress_percentage, 1)
                }
            })
    except Exception as e:
        print(f"Error al obtener materiales: {e}")
        materials_data = []
    
    return jsonify({
        'user': current_user.to_dict(),
        'stats': {
            'total_exams': total_exams,
            'completed_exams': completed_exams,
            'approved_exams': approved_exams,
            'average_score': round(average_score, 1)
        },
        'exams': exams_data,
        'materials': materials_data
    }), 200
