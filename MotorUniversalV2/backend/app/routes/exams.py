"""
Rutas de exámenes
"""
import json
from flask import Blueprint, request, jsonify
from werkzeug.exceptions import HTTPException
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.user import User
from app.models.exam import Exam
from app.models.category import Category
from app.models.topic import Topic
from app.models.question import Question, QuestionType
from app.models.answer import Answer
from app.models.exercise import Exercise, ExerciseStep, ExerciseAction
from app.utils.rate_limit import rate_limit_exams, rate_limit_evaluation, rate_limit_pdf
from app.utils.cache_utils import invalidate_on_exam_complete

bp = Blueprint('exams', __name__)


def require_permission(permission):
    """Decorador para verificar permisos"""
    def decorator(fn):
        from functools import wraps
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            
            if not user or not user.has_permission(permission):
                return jsonify({'error': 'Permiso denegado'}), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ============= EXÁMENES =============

# Endpoint de verificación de despliegue
@bp.route('/exercises/ping', methods=['GET', 'OPTIONS'])
def exercises_ping():
    return jsonify({'status': 'ok', 'message': 'exercises routes loaded'}), 200


# SECURITY: Endpoint deshabilitado — ejecutaba db.create_all() sin autenticación
# @bp.route('/migrate-exercise-tables', methods=['POST', 'OPTIONS'])
# def migrate_exercise_tables(): REMOVED — was public without auth
def _disabled_migrate_exercise_tables():
    """DISABLED: Crear tablas exercise_steps y exercise_actions si no existen"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        # Importar db para crear tablas
        db.create_all()
        return jsonify({
            'status': 'ok',
            'message': 'Tablas creadas/verificadas correctamente',
            'tables': ['exercise_steps', 'exercise_actions']
        }), 200
    except HTTPException:
        raise
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


# SECURITY: Endpoint deshabilitado — modificaba datos sin autenticación
# @bp.route('/fix-ordering-answers', methods=['POST', 'OPTIONS'])
# def fix_ordering_answers(): REMOVED — was public without auth
def _disabled_fix_ordering_answers():
    """DISABLED: Arreglar answer_number NULL en respuestas existentes"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        # Obtener todas las preguntas de tipo ordering
        ordering_type = QuestionType.query.filter_by(name='ordering').first()
        if not ordering_type:
            return jsonify({
                'status': 'ok',
                'message': 'No hay tipo de pregunta ordering',
                'fixed_count': 0
            }), 200
        
        ordering_questions = Question.query.filter_by(question_type_id=ordering_type.id).all()
        fixed_count = 0
        
        for question in ordering_questions:
            # Obtener respuestas de esta pregunta
            answers = Answer.query.filter_by(question_id=question.id).order_by(Answer.created_at).all()
            
            # Verificar si alguna tiene answer_number NULL o 0
            needs_fix = any(a.answer_number is None or a.answer_number == 0 for a in answers)
            
            if needs_fix:
                # Renumerar todas las respuestas de esta pregunta
                for idx, answer in enumerate(answers, start=1):
                    if answer.answer_number != idx:
                        answer.answer_number = idx
                        fixed_count += 1
        
        db.session.commit()
        
        return jsonify({
            'status': 'ok',
            'message': f'Se arreglaron {fixed_count} respuestas',
            'fixed_count': fixed_count,
            'questions_checked': len(ordering_questions)
        }), 200
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('', methods=['GET'])
@jwt_required()
@rate_limit_exams(limit=50, window=60)
def get_exams():
    """
    Listar todos los exámenes
    ---
    tags:
      - Exams
    security:
      - Bearer: []
    parameters:
      - name: page
        in: query
        type: integer
        default: 1
      - name: per_page
        in: query
        type: integer
        default: 20
      - name: is_published
        in: query
        type: boolean
      - name: search
        in: query
        type: string
        description: Buscar por nombre o descripción
    responses:
      200:
        description: Lista de exámenes
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    is_published = request.args.get('is_published', type=bool)
    published_only = request.args.get('published_only', type=bool)
    search = request.args.get('search', '', type=str).strip()
    
    query = Exam.query
    
    # Filtrar por búsqueda
    if search:
        search_filter = f'%{search}%'
        query = query.filter(
            db.or_(
                Exam.name.ilike(search_filter),
                Exam.description.ilike(search_filter)
            )
        )
    
    # Filtrar por publicado si se especifica
    if is_published is not None:
        query = query.filter_by(is_published=is_published)
    
    # Filtrar solo publicados si se solicita explícitamente
    if published_only:
        query = query.filter_by(is_published=True)
    
    # Para candidatos, solo mostrar exámenes publicados
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user and user.role in ['alumno', 'candidato']:
        query = query.filter_by(is_published=True)
    
    # Aislamiento de datos para editor_invitado
    if user and user.role == 'editor_invitado':
        # Solo ve exámenes que él creó
        query = query.filter(Exam.created_by == user_id)
    elif user and user.role == 'editor':
        # Editor regular: no ve contenido de editores invitados
        editor_invitado_ids = db.session.query(User.id).filter(User.role == 'editor_invitado').subquery()
        query = query.filter(~Exam.created_by.in_(editor_invitado_ids))
    
    # Ordenar: publicados primero, luego por fecha de actualización (más recientes primero)
    # Esto asegura que al publicar un examen de la página 2+, aparezca en la primera página
    pagination = query.order_by(
        Exam.is_published.desc(),
        Exam.updated_at.desc()
    ).paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )
    
    return jsonify({
        'exams': [exam.to_dict() for exam in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': pagination.page
    }), 200


@bp.route('', methods=['POST'])
@jwt_required()
@require_permission('exams:create')
def create_exam():
    """
    Crear nuevo examen con categorías/módulos
    ---
    tags:
      - Exams
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - name
            - version
            - stage_id
            - categories
          properties:
            name:
              type: string
            version:
              type: string
              description: Código ECM (exactamente 7 caracteres, debe contener 'ECM')
            standard:
              type: string
              description: Nombre del estándar (opcional, por defecto 'ECM')
            stage_id:
              type: integer
            description:
              type: string
            instructions:
              type: string
            duration_minutes:
              type: integer
            passing_score:
              type: integer
            categories:
              type: array
              description: Módulos del examen (máximo 5, suma de porcentajes debe ser 100)
              items:
                type: object
                properties:
                  name:
                    type: string
                  description:
                    type: string
                  percentage:
                    type: integer
    responses:
      201:
        description: Examen creado
      400:
        description: Datos inválidos
    """
    data = request.get_json()
    user_id = get_jwt_identity()
    
    # Validaciones básicas
    required_fields = ['name', 'stage_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} es requerido'}), 400
    
    # Validar que se haya seleccionado un estándar de competencia o se proporcione version
    competency_standard_id = data.get('competency_standard_id')
    version = data.get('version', '')
    
    if not competency_standard_id and not version:
        return jsonify({'error': 'Debe seleccionar un Estándar de Competencia'}), 400
    
    # Si hay competency_standard_id, obtener el código del estándar
    if competency_standard_id:
        from app.models.competency_standard import CompetencyStandard
        standard = CompetencyStandard.query.get(competency_standard_id)
        if standard:
            version = standard.code
        else:
            return jsonify({'error': 'Estándar de Competencia no encontrado'}), 400
    
    # Validar categorías/módulos
    categories = data.get('categories', [])
    if not categories:
        return jsonify({'error': 'Debe incluir al menos un módulo'}), 400
    
    # Validar que la suma de porcentajes sea 100
    total_percentage = sum(cat.get('percentage', 0) for cat in categories)
    if total_percentage != 100:
        return jsonify({'error': f'La suma de los porcentajes debe ser 100 (actual: {total_percentage})'}), 400
    
    # Validar que cada porcentaje esté entre 0 y 100
    for cat in categories:
        percentage = cat.get('percentage', 0)
        if percentage < 0 or percentage > 100:
            return jsonify({'error': f'Cada porcentaje debe estar entre 0 y 100'}), 400
        if not cat.get('name'):
            return jsonify({'error': 'Cada módulo debe tener un nombre'}), 400
    
    try:
        # Crear examen
        exam = Exam(
            name=data['name'],
            version=version,
            standard=data.get('standard', 'ECM'),
            stage_id=data['stage_id'],
            description=data.get('description'),
            instructions=data.get('instructions'),
            duration_minutes=data.get('duration_minutes'),
            passing_score=data.get('passing_score', 70),
            pause_on_disconnect=data.get('pause_on_disconnect', True),
            image_url=data.get('image_url'),
            competency_standard_id=data.get('competency_standard_id'),
            created_by=user_id
        )
        
        db.session.add(exam)
        db.session.flush()  # Obtener el ID del examen sin hacer commit
        
        # Crear categorías/módulos
        for idx, cat_data in enumerate(categories, 1):
            category = Category(
                exam_id=exam.id,
                name=cat_data['name'],
                description=cat_data.get('description'),
                percentage=cat_data['percentage'],
                order=idx,
                created_by=user_id
            )
            db.session.add(category)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Examen creado exitosamente',
            'exam': exam.to_dict(include_details=True)
        }), 201
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al crear el examen: {str(e)}'}), 500


@bp.route('/<int:exam_id>/clone', methods=['POST'])
@jwt_required()
@require_permission('exams:create')
def clone_exam(exam_id):
    """
    Clonar un examen existente
    ---
    tags:
      - Exams
    security:
      - Bearer: []
    parameters:
      - name: exam_id
        in: path
        type: integer
        required: true
        description: ID del examen a clonar
    responses:
      201:
        description: Examen clonado exitosamente
      404:
        description: Examen no encontrado
    """
    import uuid
    
    # Obtener el examen original
    original_exam = Exam.query.get(exam_id)
    if not original_exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    data = request.get_json() or {}
    user_id = get_jwt_identity()
    
    try:
        # Crear el nuevo examen (copia)
        new_exam = Exam(
            name=data.get('name', f"{original_exam.name} (Copia)"),
            version=data.get('version', f"{original_exam.version}-COPY"),
            standard=original_exam.standard,
            stage_id=original_exam.stage_id,
            description=original_exam.description,
            instructions=original_exam.instructions,
            duration_minutes=original_exam.duration_minutes,
            passing_score=original_exam.passing_score,
            pause_on_disconnect=original_exam.pause_on_disconnect,
            image_url=original_exam.image_url,
            competency_standard_id=data.get('competency_standard_id', original_exam.competency_standard_id),
            is_active=True,
            is_published=False,  # Siempre como borrador
            created_by=user_id
        )
        db.session.add(new_exam)
        db.session.flush()  # Obtener el ID del nuevo examen
        
        # Clonar categorías
        for original_category in original_exam.categories:
            new_category = Category(
                exam_id=new_exam.id,
                name=original_category.name,
                description=original_category.description,
                percentage=original_category.percentage,
                order=original_category.order,
                created_by=user_id
            )
            db.session.add(new_category)
            db.session.flush()
            
            # Clonar temas de esta categoría
            for original_topic in original_category.topics:
                new_topic = Topic(
                    category_id=new_category.id,
                    name=original_topic.name,
                    description=original_topic.description,
                    order=original_topic.order,
                    created_by=user_id
                )
                db.session.add(new_topic)
                db.session.flush()
                
                # Clonar preguntas de este tema
                for original_question in original_topic.questions:
                    new_question_id = str(uuid.uuid4())
                    new_question = Question(
                        id=new_question_id,
                        topic_id=new_topic.id,
                        question_type_id=original_question.question_type_id,
                        question_number=original_question.question_number,
                        question_text=original_question.question_text,
                        image_url=original_question.image_url,
                        points=original_question.points,
                        difficulty=original_question.difficulty,
                        created_by=user_id
                    )
                    db.session.add(new_question)
                    
                    # Clonar respuestas de esta pregunta
                    for original_answer in original_question.answers:
                        new_answer = Answer(
                            id=str(uuid.uuid4()),
                            question_id=new_question_id,
                            answer_number=original_answer.answer_number,
                            answer_text=original_answer.answer_text,
                            is_correct=original_answer.is_correct,
                            explanation=original_answer.explanation,
                            created_by=user_id
                        )
                        db.session.add(new_answer)
                
                # Clonar ejercicios de este tema
                for original_exercise in original_topic.exercises:
                    new_exercise_id = str(uuid.uuid4())
                    new_exercise = Exercise(
                        id=new_exercise_id,
                        topic_id=new_topic.id,
                        exercise_number=original_exercise.exercise_number,
                        title=original_exercise.title,
                        description=original_exercise.description,
                        is_active=original_exercise.is_active,
                        created_by=user_id
                    )
                    db.session.add(new_exercise)
                    db.session.flush()
                    
                    # Clonar pasos del ejercicio
                    for original_step in original_exercise.steps:
                        new_step_id = str(uuid.uuid4())
                        new_step = ExerciseStep(
                            id=new_step_id,
                            exercise_id=new_exercise_id,
                            step_number=original_step.step_number,
                            title=original_step.title,
                            description=original_step.description,
                            image_url=original_step.image_url,
                            image_width=original_step.image_width,
                            image_height=original_step.image_height
                        )
                        db.session.add(new_step)
                        db.session.flush()
                        
                        # Clonar acciones del paso
                        for original_action in original_step.actions:
                            new_action = ExerciseAction(
                                id=str(uuid.uuid4()),
                                step_id=new_step_id,
                                action_number=original_action.action_number,
                                action_type=original_action.action_type,
                                position_x=original_action.position_x,
                                position_y=original_action.position_y,
                                width=original_action.width,
                                height=original_action.height,
                                label=original_action.label,
                                placeholder=original_action.placeholder,
                                correct_answer=original_action.correct_answer,
                                is_case_sensitive=original_action.is_case_sensitive,
                                scoring_mode=original_action.scoring_mode,
                                on_error_action=original_action.on_error_action,
                                error_message=original_action.error_message,
                                max_attempts=original_action.max_attempts,
                                text_color=original_action.text_color,
                                font_family=original_action.font_family,
                                label_style=original_action.label_style
                            )
                            db.session.add(new_action)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Examen clonado exitosamente',
            'exam': new_exam.to_dict(include_details=True)
        }), 201
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al clonar el examen: {str(e)}'}), 500


@bp.route('/<int:exam_id>', methods=['GET'])
@jwt_required()
def get_exam(exam_id):
    """
    Obtener un examen específico
    ---
    tags:
      - Exams
    security:
      - Bearer: []
    parameters:
      - name: exam_id
        in: path
        type: integer
        required: true
      - name: include_details
        in: query
        type: boolean
        default: false
    responses:
      200:
        description: Detalles del examen
      404:
        description: Examen no encontrado
    """
    exam = Exam.query.get(exam_id)
    
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    # Verificar visibilidad según rol
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user:
        if user.role == 'editor_invitado' and exam.created_by != user_id:
            return jsonify({'error': 'Examen no encontrado'}), 404
        elif user.role == 'editor' and exam.created_by:
            creator = User.query.get(exam.created_by)
            if creator and creator.role == 'editor_invitado':
                return jsonify({'error': 'Examen no encontrado'}), 404
    
    include_details = request.args.get('include_details', 'false').lower() == 'true'
    
    return jsonify(exam.to_dict(include_details=include_details)), 200


@bp.route('/<int:exam_id>', methods=['PUT'])
@jwt_required()
@require_permission('exams:update')
def update_exam(exam_id):
    """
    Actualizar examen
    ---
    tags:
      - Exams
    security:
      - Bearer: []
    parameters:
      - name: exam_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Examen actualizado
      404:
        description: Examen no encontrado
    """
    exam = Exam.query.get(exam_id)
    
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    data = request.get_json()
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Editor invitado solo puede editar su propio contenido
    if user and user.role == 'editor_invitado' and exam.created_by != user_id:
        return jsonify({'error': 'No tienes permiso para editar este examen'}), 403
    # Editor regular no puede editar contenido de editor_invitado
    if user and user.role == 'editor' and exam.created_by:
        creator = User.query.get(exam.created_by)
        if creator and creator.role == 'editor_invitado':
            return jsonify({'error': 'No tienes permiso para editar este examen'}), 403
    
    # Actualizar campos permitidos
    updatable_fields = [
        'name', 'version', 'standard', 'description', 'instructions',
        'duration_minutes', 'passing_score', 'pause_on_disconnect', 'is_active', 'is_published', 'image_url',
        'default_max_attempts', 'default_max_disconnections', 'default_exam_content_type',
        'default_exam_questions_count', 'default_exam_exercises_count',
        'default_simulator_questions_count', 'default_simulator_exercises_count',
    ]
    
    for field in updatable_fields:
        if field in data:
            setattr(exam, field, data[field])
    
    exam.updated_by = user_id
    db.session.commit()
    
    return jsonify({
        'message': 'Examen actualizado exitosamente',
        'exam': exam.to_dict()
    }), 200


@bp.route('/<int:exam_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_exam(exam_id):
    """
    Eliminar examen y todo su contenido
    ---
    tags:
      - Exams
    security:
      - Bearer: []
    parameters:
      - name: exam_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Examen eliminado
      404:
        description: Examen no encontrado
    """
    from app.models.question import Question
    from app.models.answer import Answer
    from app.models.exercise import Exercise, ExerciseStep, ExerciseAction
    
    exam = Exam.query.get(exam_id)
    
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    # Verificar ownership para editor_invitado
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user and user.role == 'editor_invitado' and exam.created_by != user_id:
        return jsonify({'error': 'No tienes permiso para eliminar este examen'}), 403
    if user and user.role == 'editor' and exam.created_by:
        creator = User.query.get(exam.created_by)
        if creator and creator.role == 'editor_invitado':
            return jsonify({'error': 'No tienes permiso para eliminar este examen'}), 403
    
    try:
        # Eliminar study_materials y study_material_exams que referencian este examen
        from sqlalchemy import text
        db.session.execute(text('DELETE FROM dbo.study_materials WHERE exam_id = :exam_id'), {'exam_id': exam_id})
        db.session.execute(text('DELETE FROM dbo.study_material_exams WHERE exam_id = :exam_id'), {'exam_id': exam_id})
        
        # Archivar códigos de certificado antes de eliminar resultados
        try:
            from app.models.certificate_code_history import CertificateCodeHistory
            results_to_delete = Result.query.filter_by(exam_id=exam_id).all()
            for r in results_to_delete:
                for code_type in ['certificate_code', 'eduit_certificate_code']:
                    code_val = getattr(r, code_type, None)
                    if code_val:
                        existing = CertificateCodeHistory.query.filter_by(code=code_val).first()
                        if not existing:
                            db.session.add(CertificateCodeHistory(
                                result_id=str(r.id), user_id=str(r.user_id), exam_id=r.exam_id,
                                code=code_val, code_type=code_type,
                                score=r.score, result_value=r.result,
                                competency_standard_id=r.competency_standard_id,
                                start_date=r.start_date, end_date=r.end_date,
                            ))
            db.session.flush()
        except Exception as archive_err:
            print(f'⚠️ Error archivando códigos antes de eliminar: {archive_err}')

        # Eliminar results
        db.session.execute(text('DELETE FROM dbo.results WHERE exam_id = :exam_id'), {'exam_id': exam_id})
        
        # Eliminar group_exam_materials de group_exams relacionados
        db.session.execute(text('''
            DELETE FROM dbo.group_exam_materials 
            WHERE group_exam_id IN (SELECT id FROM dbo.group_exams WHERE exam_id = :exam_id)
        '''), {'exam_id': exam_id})
        
        # Eliminar group_exams
        db.session.execute(text('DELETE FROM dbo.group_exams WHERE exam_id = :exam_id'), {'exam_id': exam_id})
        
        # Eliminar en orden correcto (de más profundo a más superficial)
        for category in exam.categories.all():
            for topic in category.topics.all():
                # 1. Eliminar respuestas de las preguntas
                for question in topic.questions.all():
                    Answer.query.filter_by(question_id=question.id).delete()
                
                # 2. Eliminar preguntas
                Question.query.filter_by(topic_id=topic.id).delete()
                
                # 3. Eliminar acciones de los pasos de ejercicios
                for exercise in topic.exercises.all():
                    for step in exercise.steps.all():
                        ExerciseAction.query.filter_by(step_id=step.id).delete()
                    # 4. Eliminar pasos de ejercicios
                    ExerciseStep.query.filter_by(exercise_id=exercise.id).delete()
                
                # 5. Eliminar ejercicios
                Exercise.query.filter_by(topic_id=topic.id).delete()
            
            # 6. Eliminar topics
            Topic.query.filter_by(category_id=category.id).delete()
        
        # 7. Eliminar categorías
        Category.query.filter_by(exam_id=exam_id).delete()
        
        # 8. Finalmente eliminar el examen
        db.session.delete(exam)
        db.session.commit()
        
        return jsonify({'message': 'Examen eliminado exitosamente'}), 200
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar examen: {str(e)}'}), 500


# ============= CATEGORÍAS =============

@bp.route('/<int:exam_id>/categories', methods=['GET'])
@jwt_required()
def get_categories(exam_id):
    """Obtener categorías de un examen"""
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    categories = exam.categories.all()
    include_details = request.args.get('include_details', 'false').lower() == 'true'
    
    return jsonify({
        'categories': [cat.to_dict(include_details=include_details) for cat in categories]
    }), 200


@bp.route('/<int:exam_id>/categories', methods=['POST'])
@jwt_required()
@require_permission('exams:create')
def create_category(exam_id):
    """Crear categoría"""
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    # Verificar que el examen esté en borrador
    if exam.is_published:
        return jsonify({'error': 'No se puede agregar categorías a un examen publicado'}), 400
    
    data = request.get_json()
    user_id = get_jwt_identity()
    
    category = Category(
        exam_id=exam_id,
        name=data['name'],
        description=data.get('description'),
        percentage=data['percentage'],
        order=data.get('order', 0),
        created_by=user_id
    )
    
    db.session.add(category)
    db.session.commit()
    
    return jsonify({
        'message': 'Categoría creada exitosamente',
        'category': category.to_dict()
    }), 201


@bp.route('/<int:exam_id>/categories/<int:category_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_category(exam_id, category_id):
    """Eliminar categoría y todo su contenido (topics, questions, answers, exercises)"""
    from app.models.question import Question
    from app.models.answer import Answer
    from app.models.exercise import Exercise, ExerciseStep, ExerciseAction
    
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    # Verificar que el examen esté en borrador
    if exam.is_published:
        return jsonify({'error': 'No se puede eliminar categorías de un examen publicado'}), 400
    
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Categoría no encontrada'}), 404
    
    # Verificar que la categoría pertenece al examen
    if category.exam_id != exam_id:
        return jsonify({'error': 'La categoría no pertenece a este examen'}), 400
    
    try:
        # Eliminar en orden correcto (de más profundo a más superficial)
        for topic in category.topics.all():
            # 1. Eliminar respuestas de las preguntas
            for question in topic.questions.all():
                Answer.query.filter_by(question_id=question.id).delete()
            
            # 2. Eliminar preguntas
            Question.query.filter_by(topic_id=topic.id).delete()
            
            # 3. Eliminar acciones de los pasos de ejercicios
            for exercise in topic.exercises.all():
                for step in exercise.steps.all():
                    ExerciseAction.query.filter_by(step_id=step.id).delete()
                # 4. Eliminar pasos de ejercicios
                ExerciseStep.query.filter_by(exercise_id=exercise.id).delete()
            
            # 5. Eliminar ejercicios
            Exercise.query.filter_by(topic_id=topic.id).delete()
        
        # 6. Eliminar topics
        Topic.query.filter_by(category_id=category.id).delete()
        
        # 7. Finalmente eliminar la categoría
        db.session.delete(category)
        db.session.commit()
        
        return jsonify({
            'message': 'Categoría y todo su contenido eliminado exitosamente'
        }), 200
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar categoría: {str(e)}'}), 500


@bp.route('/<int:exam_id>/categories/<int:category_id>', methods=['PUT'])
@jwt_required()
@require_permission('exams:update')
def update_category(exam_id, category_id):
    """Actualizar categoría"""
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    # Verificar que el examen esté en borrador
    if exam.is_published:
        return jsonify({'error': 'No se puede modificar categorías de un examen publicado'}), 400
    
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Categoría no encontrada'}), 404
    
    # Verificar que la categoría pertenece al examen
    if category.exam_id != exam_id:
        return jsonify({'error': 'La categoría no pertenece a este examen'}), 400
    
    data = request.get_json()
    user_id = get_jwt_identity()
    
    # Actualizar campos
    if 'name' in data:
        category.name = data['name']
    if 'description' in data:
        category.description = data['description']
    if 'percentage' in data:
        category.percentage = data['percentage']
    if 'order' in data:
        category.order = data['order']
    
    category.updated_by = user_id
    
    db.session.commit()
    
    return jsonify({
        'message': 'Categoría actualizada exitosamente',
        'category': category.to_dict()
    }), 200


# ============= TEMAS =============

@bp.route('/categories/<int:category_id>/topics', methods=['GET'])
@jwt_required()
def get_topics(category_id):
    """Obtener temas de una categoría"""
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Categoría no encontrada'}), 404
    
    topics = category.topics.all()
    include_details = request.args.get('include_details', 'false').lower() == 'true'
    
    return jsonify({
        'topics': [topic.to_dict(include_details=include_details) for topic in topics]
    }), 200


@bp.route('/categories/<int:category_id>/topics', methods=['POST'])
@jwt_required()
@require_permission('exams:create')
def create_topic(category_id):
    """Crear tema"""
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Categoría no encontrada'}), 404
    
    data = request.get_json()
    user_id = get_jwt_identity()
    
    topic = Topic(
        category_id=category_id,
        name=data['name'],
        description=data.get('description'),
        order=data.get('order', 0),
        created_by=user_id
    )
    
    db.session.add(topic)
    db.session.commit()
    
    return jsonify({
        'message': 'Tema creado exitosamente',
        'topic': topic.to_dict()
    }), 201


@bp.route('/topics/<int:topic_id>', methods=['PUT'])
@jwt_required()
@require_permission('exams:update')
def update_topic(topic_id):
    """Actualizar tema"""
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Tema no encontrado'}), 404
    
    data = request.get_json()
    user_id = get_jwt_identity()
    
    print(f"📝 Actualizando tema {topic_id}: {data}")
    
    if 'name' in data:
        topic.name = data['name']
    if 'description' in data:
        topic.description = data.get('description')
    if 'order' in data:
        topic.order = data['order']
    if 'percentage' in data:
        old_percentage = topic.percentage
        topic.percentage = float(data['percentage'])  # Asegurar que es float
        print(f"   📊 Porcentaje cambiado: {old_percentage} -> {topic.percentage}")
    
    topic.updated_by = user_id
    
    # Forzar flush y commit
    db.session.flush()
    db.session.commit()
    
    # Refrescar el objeto desde la base de datos
    db.session.refresh(topic)
    
    print(f"   ✅ Tema actualizado (después de refresh): {topic.to_dict()}")
    
    return jsonify({
        'message': 'Tema actualizado exitosamente',
        'topic': topic.to_dict()
    }), 200


@bp.route('/topics/<int:topic_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_topic(topic_id):
    """Eliminar tema y todo su contenido (preguntas, respuestas, ejercicios, pasos, acciones)"""
    from app.models.question import Question
    from app.models.answer import Answer
    from app.models.exercise import Exercise, ExerciseStep, ExerciseAction
    
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Tema no encontrado'}), 404
    
    try:
        # 1. Eliminar respuestas de las preguntas (sin importar tipo exam/simulator)
        for question in topic.questions.all():
            Answer.query.filter_by(question_id=question.id).delete()
        
        # 2. Eliminar preguntas (sin importar tipo exam/simulator)
        Question.query.filter_by(topic_id=topic.id).delete()
        
        # 3. Eliminar acciones y pasos de ejercicios (sin importar tipo exam/simulator)
        for exercise in topic.exercises.all():
            for step in exercise.steps.all():
                ExerciseAction.query.filter_by(step_id=step.id).delete()
            ExerciseStep.query.filter_by(exercise_id=exercise.id).delete()
        
        # 4. Eliminar ejercicios (sin importar tipo exam/simulator)
        Exercise.query.filter_by(topic_id=topic.id).delete()
        
        # 5. Finalmente eliminar el tema
        db.session.delete(topic)
        db.session.commit()
        
        return jsonify({
            'message': 'Tema y todo su contenido eliminado exitosamente'
        }), 200
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar el tema: {str(e)}'}), 500



# ============= PREGUNTAS =============

@bp.route('/question-types', methods=['GET'])
@jwt_required()
def get_question_types():
    """Obtener todos los tipos de preguntas disponibles"""
    question_types = QuestionType.query.all()
    return jsonify({
        'question_types': [qt.to_dict() for qt in question_types]
    }), 200


@bp.route('/topics/<int:topic_id>/questions', methods=['GET'])
@jwt_required()
def get_questions(topic_id):
    """Obtener preguntas de un tema"""
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Tema no encontrado'}), 404
    
    # Ordenar preguntas por question_number para que las nuevas aparezcan al final
    questions = topic.questions.order_by(Question.question_number).all()
    include_correct = request.args.get('include_correct', 'false').lower() == 'true'
    
    # Solo mostrar respuestas correctas a editores/admins
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user and user.role not in ['admin', 'developer', 'editor']:
        include_correct = False
    
    return jsonify({
        'questions': [q.to_dict(include_correct=include_correct) for q in questions]
    }), 200


@bp.route('/topics/<int:topic_id>/questions', methods=['POST'])
@jwt_required()
@require_permission('exams:create')
def create_question(topic_id):
    """Crear pregunta"""
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Tema no encontrado'}), 404
    
    data = request.get_json()
    user_id = get_jwt_identity()
    
    question = Question(
        topic_id=topic_id,
        question_type_id=data['question_type_id'],
        question_number=data.get('question_number', topic.questions.count() + 1),
        question_text=data['question_text'],
        image_url=data.get('image_url'),
        points=data.get('points', 1),
        difficulty=data.get('difficulty', 'medium'),
        created_by=user_id
    )
    
    db.session.add(question)
    db.session.flush()  # Para obtener el ID
    
    # Crear respuestas
    if 'answers' in data and data['answers']:
        for answer_data in data['answers']:
            answer = Answer(
                question_id=question.id,
                answer_number=answer_data['answer_number'],
                answer_text=answer_data['answer_text'],
                is_correct=answer_data.get('is_correct', False),
                explanation=answer_data.get('explanation'),
                created_by=user_id
            )
            db.session.add(answer)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Pregunta creada exitosamente',
        'question': question.to_dict(include_correct=True)
    }), 201


@bp.route('/questions/<question_id>', methods=['PUT'])
@jwt_required()
@require_permission('exams:update')
def update_question(question_id):
    """Actualizar pregunta"""
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Pregunta no encontrada'}), 404
    
    data = request.get_json()
    user_id = get_jwt_identity()
    
    # Actualizar campos
    if 'question_type_id' in data:
        question.question_type_id = data['question_type_id']
    if 'question_text' in data:
        question.question_text = data['question_text']
    if 'image_url' in data:
        question.image_url = data['image_url']
    if 'points' in data:
        question.points = data['points']
    if 'difficulty' in data:
        question.difficulty = data['difficulty']
    if 'type' in data:
        question.type = data['type']  # exam o simulator
    if 'percentage' in data:
        question.percentage = data['percentage']  # Porcentaje del tema
    
    question.updated_by = user_id
    
    db.session.commit()
    
    return jsonify({
        'message': 'Pregunta actualizada exitosamente',
        'question': question.to_dict(include_correct=True)
    }), 200


@bp.route('/questions/<question_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_question(question_id):
    """Eliminar pregunta y todas sus respuestas"""
    from app.models.answer import Answer
    
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Pregunta no encontrada'}), 404
    
    try:
        # 1. Eliminar todas las respuestas de la pregunta primero
        answers_deleted = Answer.query.filter_by(question_id=question.id).delete()
        
        # 2. Eliminar la pregunta
        db.session.delete(question)
        db.session.commit()
        
        return jsonify({
            'message': 'Pregunta eliminada exitosamente',
            'answers_deleted': answers_deleted
        }), 200
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar pregunta: {str(e)}'}), 500


@bp.route('/questions/<question_id>', methods=['GET'])
@jwt_required()
def get_question(question_id):
    """Obtener una pregunta por ID"""
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Pregunta no encontrada'}), 404
    
    return jsonify({
        'question': question.to_dict(include_correct=True)
    }), 200


# ============= RESPUESTAS =============

@bp.route('/questions/<question_id>/answers', methods=['GET'])
@jwt_required()
def get_answers(question_id):
    """Obtener todas las respuestas de una pregunta"""
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Pregunta no encontrada'}), 404
    
    answers = Answer.query.filter_by(question_id=question_id).all()
    
    return jsonify({
        'answers': [answer.to_dict(include_correct=True) for answer in answers]
    }), 200


@bp.route('/questions/<question_id>/answers', methods=['POST'])
@jwt_required()
@require_permission('exams:create')
def create_answer(question_id):
    """Crear una nueva respuesta para una pregunta"""
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Pregunta no encontrada'}), 404
    
    data = request.get_json()
    user_id = get_jwt_identity()
    
    # Validar datos requeridos
    if not data.get('answer_text'):
        return jsonify({'error': 'El texto de la respuesta es requerido'}), 400
    
    try:
        # Crear nueva respuesta
        answer = Answer(
            question_id=question_id,
            answer_text=data['answer_text'],
            is_correct=data.get('is_correct', False),
            answer_number=data.get('answer_number'),  # Guardar el número de orden
            correct_answer=data.get('correct_answer'),  # Para drag_drop y column_grouping
            created_by=user_id
        )
        
        db.session.add(answer)
        db.session.commit()
        
        return jsonify({
            'message': 'Respuesta creada exitosamente',
            'answer': answer.to_dict(include_correct=True)
        }), 201
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al crear respuesta: {str(e)}'}), 500


@bp.route('/answers/<answer_id>', methods=['PUT'])
@jwt_required()
@require_permission('exams:update')
def update_answer(answer_id):
    """Actualizar una respuesta"""
    answer = Answer.query.get(answer_id)
    if not answer:
        return jsonify({'error': 'Respuesta no encontrada'}), 404
    
    data = request.get_json()
    user_id = get_jwt_identity()
    
    # Actualizar campos
    if 'answer_text' in data:
        answer.answer_text = data['answer_text']
    if 'is_correct' in data:
        answer.is_correct = data['is_correct']
    if 'answer_number' in data:
        answer.answer_number = data['answer_number']
    if 'correct_answer' in data:
        answer.correct_answer = data['correct_answer']
    
    answer.updated_by = user_id
    
    db.session.commit()
    
    return jsonify({
        'message': 'Respuesta actualizada exitosamente',
        'answer': answer.to_dict(include_correct=True)
    }), 200


@bp.route('/answers/<answer_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_answer(answer_id):
    """Eliminar una respuesta"""
    answer = Answer.query.get(answer_id)
    if not answer:
        return jsonify({'error': 'Respuesta no encontrada'}), 404
    
    db.session.delete(answer)
    db.session.commit()
    
    return jsonify({'message': 'Respuesta eliminada exitosamente'}), 200


# ============= EJERCICIOS =============

@bp.route('/topics/<int:topic_id>/exercises', methods=['GET'])
@jwt_required()
def get_topic_exercises(topic_id):
    """
    Obtener todos los ejercicios de un tema
    """
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Tema no encontrado'}), 404
    
    exercises = Exercise.query.filter_by(topic_id=topic_id).order_by(Exercise.exercise_number).all()
    
    return jsonify({
        'exercises': [ex.to_dict() for ex in exercises],
        'total': len(exercises)
    }), 200


@bp.route('/topics/<int:topic_id>/exercises', methods=['OPTIONS'])
def options_topic_exercises(topic_id):
    # Responder preflight CORS para permitir POST/GET desde el frontend
    response = jsonify({'status': 'ok'})
    response.status_code = 200
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    response.headers['Access-Control-Max-Age'] = '600'
    return response


@bp.route('/topics/<int:topic_id>/exercises', methods=['POST'])
@jwt_required()
@require_permission('exams:create')
def create_exercise(topic_id):
    """
    Crear un nuevo ejercicio para un tema
    """
    import uuid
    from datetime import datetime
    
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Tema no encontrado'}), 404
    
    data = request.get_json()
    
    # Validar datos requeridos
    if not data.get('exercise_text'):
        return jsonify({'error': 'El texto del ejercicio es requerido'}), 400
    
    # Obtener el siguiente número de ejercicio
    last_exercise = Exercise.query.filter_by(topic_id=topic_id).order_by(Exercise.exercise_number.desc()).first()
    exercise_number = (last_exercise.exercise_number + 1) if last_exercise else 1
    
    # Crear el ejercicio
    user_id = get_jwt_identity()
    # Mapear exercise_text a description y is_complete a is_active (invertido)
    exercise = Exercise(
        id=str(uuid.uuid4()),
        topic_id=topic_id,
        exercise_number=exercise_number,
        title='',
        description=data['exercise_text'],
        is_active=not data.get('is_complete', False),  # Invertir: is_complete=True -> is_active=False
        created_by=user_id,
        created_at=datetime.utcnow()
    )
    
    db.session.add(exercise)
    db.session.commit()
    
    return jsonify({
        'message': 'Ejercicio creado exitosamente',
        'exercise': exercise.to_dict()
    }), 201


@bp.route('/exercises/<exercise_id>', methods=['PUT'])
@jwt_required()
@require_permission('exams:update')
def update_exercise(exercise_id):
    """
    Actualizar un ejercicio
    """
    from datetime import datetime
    
    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Ejercicio no encontrado'}), 404
    
    data = request.get_json()
    
    # Actualizar campos permitidos
    if 'exercise_text' in data:
        exercise.description = data['exercise_text']
    if 'is_complete' in data:
        exercise.is_active = not data['is_complete']  # Invertir: is_complete=True -> is_active=False
    if 'type' in data:
        exercise.type = data['type']  # exam o simulator
    if 'percentage' in data:
        exercise.percentage = data['percentage']  # Porcentaje del tema
    
    exercise.updated_by = get_jwt_identity()
    exercise.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Ejercicio actualizado exitosamente',
        'exercise': exercise.to_dict()
    }), 200


@bp.route('/exercises/<exercise_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_exercise(exercise_id):
    """
    Eliminar un ejercicio, todos sus pasos, acciones e imágenes del blob storage
    """
    import sys
    from app.utils.azure_storage import AzureStorageService
    from app.models.exercise import ExerciseStep, ExerciseAction
    
    # Forzar flush para que los logs se muestren inmediatamente
    def log(msg):
        print(msg, flush=True)
        sys.stdout.flush()
    
    log(f"\n{'='*50}")
    log(f"=== ELIMINAR EJERCICIO ===")
    log(f"{'='*50}")
    log(f"Exercise ID: {exercise_id}")
    
    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        log(f"ERROR: Ejercicio {exercise_id} no encontrado")
        return jsonify({'error': 'Ejercicio no encontrado'}), 404
    
    # Obtener todos los pasos para eliminar sus imágenes
    steps = exercise.steps.all()
    log(f"📊 Ejercicio tiene {len(steps)} pasos")
    
    # Eliminar imágenes de blob storage
    storage = AzureStorageService()
    images_deleted = 0
    images_failed = 0
    
    if len(steps) > 0:
        log(f"\n🗑️  ELIMINANDO IMÁGENES DEL BLOB STORAGE:")
        for step in steps:
            if step.image_url:
                log(f"  → Eliminando imagen del paso {step.step_number}: {step.image_url[:80]}...")
                try:
                    if storage.delete_file(step.image_url):
                        images_deleted += 1
                        log(f"    ✓ Imagen eliminada exitosamente")
                    else:
                        images_failed += 1
                        log(f"    ✗ No se pudo eliminar imagen")
                except HTTPException:
                    raise
                except Exception as e:
                    images_failed += 1
                    log(f"    ✗ Error al eliminar imagen: {str(e)}")
    
    # Contar acciones antes de eliminar
    total_actions = sum(step.actions.count() for step in steps)
    log(f"\n📊 Ejercicio tiene {total_actions} acciones en total")
    
    # Eliminar explícitamente acciones, pasos y ejercicio (no confiar en cascade de BD)
    log(f"\n🗑️  ELIMINANDO EJERCICIO DE LA BASE DE DATOS...")
    
    # 1. Eliminar todas las acciones de todos los pasos
    for step in steps:
        ExerciseAction.query.filter_by(step_id=step.id).delete()
    log(f"✓ {total_actions} acciones eliminadas")
    
    # 2. Eliminar todos los pasos
    ExerciseStep.query.filter_by(exercise_id=exercise.id).delete()
    log(f"✓ {len(steps)} pasos eliminados")
    
    # 3. Finalmente eliminar el ejercicio
    db.session.delete(exercise)
    db.session.commit()
    
    log(f"\n{'='*50}")
    log(f"✅ RESUMEN DE ELIMINACIÓN:")
    log(f"{'='*50}")
    log(f"✓ Ejercicio eliminado de la base de datos")
    log(f"✓ {len(steps)} pasos eliminados (cascade)")
    log(f"✓ {total_actions} acciones eliminadas (cascade)")
    log(f"✓ {images_deleted} imágenes eliminadas del blob storage")
    if images_failed > 0:
        log(f"✗ {images_failed} imágenes no se pudieron eliminar")
    log(f"{'='*50}")
    log(f"=== FIN ELIMINAR EJERCICIO ===")
    log(f"{'='*50}\n")
    
    return jsonify({
        'message': 'Ejercicio eliminado exitosamente',
        'steps_deleted': len(steps),
        'actions_deleted': total_actions,
        'images_deleted': images_deleted,
        'images_failed': images_failed
    }), 200


@bp.route('/exercises/<exercise_id>', methods=['OPTIONS'])
def options_exercise_item(exercise_id):
    # Responder preflight CORS para permitir PUT/DELETE desde el frontend
    response = jsonify({'status': 'ok'})
    response.status_code = 200
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    response.headers['Access-Control-Max-Age'] = '600'
    return response


# ============= EJERCICIO DETALLE (con steps) =============

@bp.route('/exercises/<exercise_id>/details', methods=['GET'])
@jwt_required()
def get_exercise_details(exercise_id):
    """
    Obtener ejercicio con todos sus pasos y acciones
    """
    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Ejercicio no encontrado'}), 404
    
    return jsonify({
        'exercise': exercise.to_dict(include_steps=True)
    }), 200


# ============= PASOS DE EJERCICIO (STEPS) =============

@bp.route('/exercises/<exercise_id>/steps', methods=['GET'])
@jwt_required()
def get_exercise_steps(exercise_id):
    """
    Listar todos los pasos de un ejercicio
    """
    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Ejercicio no encontrado'}), 404
    
    # La relación ya tiene order_by definido, solo necesitamos .all()
    steps = exercise.steps.all()
    
    return jsonify({
        'steps': [step.to_dict(include_actions=True) for step in steps]
    }), 200


@bp.route('/exercises/<exercise_id>/steps', methods=['POST'])
@jwt_required()
@require_permission('exams:update')
def create_exercise_step(exercise_id):
    """
    Crear un nuevo paso para un ejercicio
    """
    import uuid
    from app.utils.azure_storage import azure_storage
    
    print(f"\n=== CREAR PASO DE EJERCICIO ===")
    print(f"Exercise ID: {exercise_id}")
    
    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        print(f"ERROR: Ejercicio {exercise_id} no encontrado")
        return jsonify({'error': 'Ejercicio no encontrado'}), 404
    
    data = request.get_json()
    print(f"Datos recibidos: {data}")
    
    # Obtener el siguiente número de paso (usar query directa para evitar conflicto de order_by)
    last_step = ExerciseStep.query.filter_by(exercise_id=exercise_id).order_by(ExerciseStep.step_number.desc()).first()
    next_number = (last_step.step_number + 1) if last_step else 1
    print(f"Número de paso asignado: {next_number}")
    
    # Procesar imagen si viene en base64
    image_url = data.get('image_url')
    if image_url and image_url.startswith('data:image'):
        # Subir a Azure Blob Storage
        blob_url = azure_storage.upload_base64_image(image_url, folder='exercise-steps')
        if blob_url:
            image_url = blob_url
        else:
            # Si falla blob storage, guardar en BD (fallback)
            print("Warning: Blob storage no disponible, guardando base64 en BD")
    
    step_id = str(uuid.uuid4())
    step = ExerciseStep(
        id=step_id,
        exercise_id=exercise_id,
        step_number=next_number,
        title=data.get('title'),
        description=data.get('description'),
        image_url=image_url,
        image_width=data.get('image_width'),
        image_height=data.get('image_height')
    )
    
    db.session.add(step)
    db.session.commit()
    
    print(f"✓ Paso creado exitosamente: ID={step_id}, Número={next_number}")
    print(f"=== FIN CREAR PASO ===")
    
    return jsonify({
        'message': 'Paso creado exitosamente',
        'step': step.to_dict(include_actions=True)
    }), 201


@bp.route('/exercises/<exercise_id>/steps', methods=['OPTIONS'])
def options_exercise_steps(exercise_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/steps/<step_id>', methods=['GET'])
@jwt_required()
def get_step(step_id):
    """
    Obtener un paso específico
    """
    step = ExerciseStep.query.get(step_id)
    if not step:
        return jsonify({'error': 'Paso no encontrado'}), 404
    
    return jsonify({
        'step': step.to_dict(include_actions=True)
    }), 200


@bp.route('/steps/<step_id>', methods=['PUT'])
@jwt_required()
@require_permission('exams:update')
def update_step(step_id):
    """
    Actualizar un paso
    """
    from datetime import datetime
    
    print(f"\n=== ACTUALIZAR PASO ===")
    print(f"Step ID: {step_id}")
    
    step = ExerciseStep.query.get(step_id)
    if not step:
        print(f"ERROR: Paso {step_id} no encontrado")
        return jsonify({'error': 'Paso no encontrado'}), 404
    
    data = request.get_json()
    print(f"Datos a actualizar: {data}")
    
    # Guardar el step_number anterior para logging
    old_step_number = step.step_number
    
    if 'title' in data:
        step.title = data['title']
    if 'description' in data:
        step.description = data['description']
    if 'image_url' in data:
        step.image_url = data['image_url']
    if 'image_width' in data:
        step.image_width = data['image_width']
    if 'image_height' in data:
        step.image_height = data['image_height']
    if 'step_number' in data:
        new_step_number = data['step_number']
        print(f"⚠️ REORDENANDO PASO: {old_step_number} → {new_step_number}")
        step.step_number = new_step_number
    
    step.updated_at = datetime.utcnow()
    db.session.commit()
    
    print(f"✓ Paso actualizado exitosamente: ID={step_id}, step_number={step.step_number}")
    print(f"=== FIN ACTUALIZAR PASO ===")
    
    return jsonify({
        'message': 'Paso actualizado exitosamente',
        'step': step.to_dict(include_actions=True)
    }), 200


@bp.route('/steps/<step_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_step(step_id):
    """
    Eliminar un paso, sus acciones y su imagen del blob storage
    """
    from app.utils.azure_storage import AzureStorageService
    from app.models.exercise import ExerciseAction
    
    print(f"\n=== ELIMINAR PASO ===")
    print(f"Step ID: {step_id}")
    
    step = ExerciseStep.query.get(step_id)
    if not step:
        print(f"ERROR: Paso {step_id} no encontrado")
        return jsonify({'error': 'Paso no encontrado'}), 404
    
    # Guardar info del paso antes de eliminarlo
    exercise_id = step.exercise_id
    deleted_step_number = step.step_number
    print(f"Eliminando paso #{deleted_step_number} del ejercicio {exercise_id}")
    
    # Si tiene imagen, eliminarla del blob storage
    image_deleted = False
    if step.image_url:
        try:
            storage = AzureStorageService()
            image_deleted = storage.delete_file(step.image_url)
            if image_deleted:
                print(f"Imagen eliminada del blob: {step.image_url}")
            else:
                print(f"No se pudo eliminar imagen del blob: {step.image_url}")
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al eliminar imagen del blob: {str(e)}")
    
    # 1. Eliminar todas las acciones del paso primero
    actions_deleted = ExerciseAction.query.filter_by(step_id=step.id).delete()
    print(f"✓ {actions_deleted} acciones eliminadas")
    
    # 2. Eliminar el paso
    db.session.delete(step)
    db.session.commit()
    print(f"✓ Paso eliminado de la base de datos")
    
    # Renumerar los pasos restantes del ejercicio
    remaining_steps = ExerciseStep.query.filter(
        ExerciseStep.exercise_id == exercise_id,
        ExerciseStep.step_number > deleted_step_number
    ).order_by(ExerciseStep.step_number).all()
    
    print(f"Renumerando {len(remaining_steps)} pasos restantes...")
    for remaining_step in remaining_steps:
        old_number = remaining_step.step_number
        remaining_step.step_number -= 1
        print(f"  Paso {remaining_step.id}: #{old_number} → #{remaining_step.step_number}")
    
    db.session.commit()
    print(f"✓ Renumeración completada")
    print(f"=== FIN ELIMINAR PASO ===")
    
    return jsonify({
        'message': 'Paso eliminado exitosamente',
        'image_deleted': image_deleted
    }), 200


@bp.route('/steps/<step_id>', methods=['OPTIONS'])
def options_step_item(step_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


# ============= ACCIONES DE PASO (ACTIONS) =============

@bp.route('/steps/<step_id>/actions', methods=['GET'])
@jwt_required()
def get_step_actions(step_id):
    """
    Listar todas las acciones de un paso
    """
    step = ExerciseStep.query.get(step_id)
    if not step:
        return jsonify({'error': 'Paso no encontrado'}), 404
    
    # Usar query directa para evitar ORDER BY duplicado (la relación ya tiene order_by)
    actions = ExerciseAction.query.filter_by(step_id=step_id).order_by(ExerciseAction.action_number).all()
    
    return jsonify({
        'actions': [action.to_dict() for action in actions]
    }), 200


@bp.route('/steps/<step_id>/actions', methods=['POST'])
@jwt_required()
@require_permission('exams:update')
def create_step_action(step_id):
    """
    Crear una nueva acción para un paso
    """
    import uuid
    
    print(f"\n=== CREAR ACCIÓN ===")
    print(f"Step ID: {step_id}")
    
    step = ExerciseStep.query.get(step_id)
    if not step:
        print(f"ERROR: Paso {step_id} no encontrado")
        return jsonify({'error': 'Paso no encontrado'}), 404
    
    data = request.get_json()
    print(f"Datos recibidos: {data}")
    
    # Validar tipo de acción
    action_type = data.get('action_type')
    if action_type not in ['button', 'textbox']:
        print(f"ERROR: Tipo de acción inválido: {action_type}")
        return jsonify({'error': 'Tipo de acción inválido. Debe ser "button" o "textbox"'}), 400
    
    # Obtener el siguiente número de acción (usar query directa para evitar ORDER BY duplicado)
    last_action = ExerciseAction.query.filter_by(step_id=step_id).order_by(ExerciseAction.action_number.desc()).first()
    next_number = (last_action.action_number + 1) if last_action else 1
    print(f"Número de acción asignado: {next_number}")
    
    action_id = str(uuid.uuid4())
    action = ExerciseAction(
        id=action_id,
        step_id=step_id,
        action_number=next_number,
        action_type=action_type,
        position_x=data.get('position_x', 0),
        position_y=data.get('position_y', 0),
        width=data.get('width', 10),
        height=data.get('height', 5),
        label=data.get('label'),
        placeholder=data.get('placeholder'),
        correct_answer=data.get('correct_answer'),
        is_case_sensitive=data.get('is_case_sensitive', False),
        scoring_mode=data.get('scoring_mode', 'exact'),
        on_error_action=data.get('on_error_action', 'next_step'),
        error_message=data.get('error_message'),
        max_attempts=data.get('max_attempts', 3),
        text_color=data.get('text_color', '#000000'),
        font_family=data.get('font_family', 'Arial'),
        label_style=data.get('label_style', 'invisible')
    )
    
    db.session.add(action)
    db.session.commit()
    
    print(f"✓ Acción creada exitosamente: ID={action_id}, Tipo={action_type}, Número={next_number}")
    print(f"=== FIN CREAR ACCIÓN ===")
    
    return jsonify({
        'message': 'Acción creada exitosamente',
        'action': action.to_dict()
    }), 201


@bp.route('/steps/<step_id>/actions', methods=['OPTIONS'])
def options_step_actions(step_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/actions/<action_id>', methods=['GET'])
@jwt_required()
def get_action(action_id):
    """
    Obtener una acción específica
    """
    action = ExerciseAction.query.get(action_id)
    if not action:
        return jsonify({'error': 'Acción no encontrada'}), 404
    
    return jsonify({
        'action': action.to_dict()
    }), 200


@bp.route('/actions/<action_id>', methods=['PUT'])
@jwt_required()
@require_permission('exams:update')
def update_action(action_id):
    """
    Actualizar una acción
    """
    from datetime import datetime
    
    print(f"\n=== ACTUALIZAR ACCIÓN ===")
    print(f"Action ID: {action_id}")
    
    action = ExerciseAction.query.get(action_id)
    if not action:
        print(f"ERROR: Acción {action_id} no encontrada")
        return jsonify({'error': 'Acción no encontrada'}), 404
    
    data = request.get_json()
    print(f"Datos a actualizar: {data}")
    
    if 'action_type' in data and data['action_type'] in ['button', 'textbox']:
        action.action_type = data['action_type']
    if 'position_x' in data:
        action.position_x = data['position_x']
    if 'position_y' in data:
        action.position_y = data['position_y']
    if 'width' in data:
        action.width = data['width']
    if 'height' in data:
        action.height = data['height']
    if 'label' in data:
        action.label = data['label']
    if 'placeholder' in data:
        action.placeholder = data['placeholder']
    if 'correct_answer' in data:
        action.correct_answer = data['correct_answer']
    if 'is_case_sensitive' in data:
        action.is_case_sensitive = data['is_case_sensitive']
    if 'action_number' in data:
        action.action_number = data['action_number']
    if 'scoring_mode' in data:
        action.scoring_mode = data['scoring_mode']
    if 'on_error_action' in data:
        action.on_error_action = data['on_error_action']
    if 'error_message' in data:
        action.error_message = data['error_message']
    if 'max_attempts' in data:
        action.max_attempts = data['max_attempts']
    if 'text_color' in data:
        action.text_color = data['text_color']
    if 'font_family' in data:
        action.font_family = data['font_family']
    if 'label_style' in data:
        action.label_style = data['label_style']
    
    action.updated_at = datetime.utcnow()
    db.session.commit()
    
    print(f"✓ Acción actualizada exitosamente: ID={action_id}")
    print(f"=== FIN ACTUALIZAR ACCIÓN ===")
    
    return jsonify({
        'message': 'Acción actualizada exitosamente',
        'action': action.to_dict()
    }), 200


@bp.route('/actions/<action_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_action(action_id):
    """
    Eliminar una acción
    """
    print(f"\n=== ELIMINAR ACCIÓN ===")
    print(f"Action ID: {action_id}")
    
    action = ExerciseAction.query.get(action_id)
    if not action:
        print(f"ERROR: Acción {action_id} no encontrada")
        return jsonify({'error': 'Acción no encontrada'}), 404
    
    print(f"Eliminando acción tipo '{action.action_type}' del paso {action.step_id}")
    db.session.delete(action)
    db.session.commit()
    
    print(f"✓ Acción eliminada exitosamente")
    print(f"=== FIN ELIMINAR ACCIÓN ===")
    
    return jsonify({'message': 'Acción eliminada exitosamente'}), 200


@bp.route('/actions/<action_id>', methods=['OPTIONS'])
def options_action_item(action_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


# ============= UPLOAD DE IMAGEN PARA STEP =============

@bp.route('/steps/<step_id>/upload-image', methods=['POST'])
@jwt_required()
@require_permission('exams:update')
def upload_step_image(step_id):
    """
    Subir imagen para un paso (como base64)
    Si ya existe una imagen, se elimina del blob antes de subir la nueva
    """
    from datetime import datetime
    from app.utils.azure_storage import azure_storage
    
    step = ExerciseStep.query.get(step_id)
    if not step:
        return jsonify({'error': 'Paso no encontrado'}), 404
    
    data = request.get_json()
    
    if 'image_data' not in data:
        return jsonify({'error': 'Se requiere image_data (base64)'}), 400
    
    # Guardar la URL de la imagen anterior para eliminarla después
    old_image_url = step.image_url
    
    image_data = data['image_data']
    
    # Subir a Azure Blob Storage si es base64
    if image_data.startswith('data:image'):
        blob_url = azure_storage.upload_base64_image(image_data, folder='exercise-steps')
        if blob_url:
            image_data = blob_url
            
            # Eliminar la imagen anterior del blob si existe
            if old_image_url and 'blob.core.windows.net' in old_image_url:
                try:
                    if azure_storage.delete_file(old_image_url):
                        print(f"Imagen anterior eliminada del blob: {old_image_url[:80]}...")
                    else:
                        print(f"No se pudo eliminar imagen anterior: {old_image_url[:80]}...")
                except HTTPException:
                    raise
                except Exception as e:
                    print(f"Error al eliminar imagen anterior: {e}")
        else:
            print("Warning: Blob storage no disponible, guardando base64 en BD")
    
    step.image_url = image_data
    step.image_width = data.get('image_width')
    step.image_height = data.get('image_height')
    step.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Imagen subida exitosamente',
        'step': step.to_dict()
    }), 200


@bp.route('/steps/<step_id>/upload-image', methods=['OPTIONS'])
def options_upload_step_image(step_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


# ============= VALIDAR Y PUBLICAR EXAMEN =============

@bp.route('/<int:exam_id>/validate', methods=['GET'])
@jwt_required()
@require_permission('exams:read')
def validate_exam(exam_id):
    """
    Validar que un examen esté completo antes de publicar
    Verifica:
    - El examen tiene al menos una categoría
    - Las categorías suman 100%
    - Cada categoría tiene al menos un tema
    - Cada tema tiene al menos una pregunta con respuestas válidas O un ejercicio
    - Las preguntas tienen respuestas correctas configuradas
    - Los ejercicios tienen al menos un paso
    - Los pasos tienen imagen y al menos una acción
    """
    try:
        print(f"\n=== VALIDAR EXAMEN {exam_id} ===")
        
        exam = Exam.query.get(exam_id)
        if not exam:
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        errors = []
        warnings = []
        
        # 1. Verificar que tenga categorías
        categories = Category.query.filter_by(exam_id=exam_id).all()
        if not categories:
            errors.append({
                'type': 'exam',
                'message': 'El examen no tiene categorías',
                'details': 'Debes agregar al menos una categoría al examen'
            })
        else:
            # 2. Verificar que las categorías sumen 100%
            total_percentage = sum(c.percentage or 0 for c in categories)
            if total_percentage != 100:
                errors.append({
                    'type': 'categories',
                    'message': f'Las categorías suman {total_percentage}%, deben sumar 100%',
                    'details': 'Ajusta los porcentajes de las categorías para que sumen exactamente 100%'
                })
            
            # 3. Verificar cada categoría
            for category in categories:
                topics = Topic.query.filter_by(category_id=category.id).all()
                
                if not topics:
                    errors.append({
                        'type': 'category',
                        'message': f'La categoría "{category.name}" no tiene temas',
                        'details': f'Agrega al menos un tema a la categoría "{category.name}"'
                    })
                    continue
                
                # 4. Verificar que los porcentajes de temas sumen 100% dentro de cada categoría
                total_topic_percentage = sum(t.percentage or 0 for t in topics)
                print(f"  📊 Categoría '{category.name}': {len(topics)} temas, suma de porcentajes = {total_topic_percentage}%")
                for t in topics:
                    print(f"      - Tema '{t.name}': {t.percentage or 0}%")
                
                if total_topic_percentage != 100:
                    errors.append({
                        'type': 'topics',
                        'category': category.name,
                        'message': f'Los temas de la categoría "{category.name}" suman {total_topic_percentage}%, deben sumar 100%',
                        'details': f'Ajusta los porcentajes de los temas en la categoría "{category.name}" para que sumen exactamente 100%'
                    })
                
                # 5. Verificar cada tema
                for topic in topics:
                    questions = Question.query.filter_by(topic_id=topic.id).all()
                    exercises = Exercise.query.filter_by(topic_id=topic.id).all()
                    
                    if not questions and not exercises:
                        errors.append({
                            'type': 'topic',
                            'message': f'El tema "{topic.name}" no tiene preguntas ni ejercicios',
                            'details': f'Agrega al menos una pregunta o ejercicio al tema "{topic.name}" en la categoría "{category.name}"'
                        })
                        continue
                    
                    # 6. Verificar preguntas
                    for question in questions:
                        answers = Answer.query.filter_by(question_id=question.id).all()
                        
                        if not answers:
                            errors.append({
                                'type': 'question',
                                'message': f'La pregunta #{question.question_number} en "{topic.name}" no tiene respuestas',
                                'details': f'Configura las respuestas para la pregunta #{question.question_number}'
                            })
                        else:
                            # Verificar que tenga al menos una respuesta correcta
                            correct_answers = [a for a in answers if a.is_correct]
                            if not correct_answers:
                                errors.append({
                                    'type': 'question',
                                    'message': f'La pregunta #{question.question_number} en "{topic.name}" no tiene respuesta correcta',
                                    'details': f'Marca al menos una respuesta como correcta para la pregunta #{question.question_number}'
                                })
                    
                    # 7. Verificar ejercicios
                    for exercise in exercises:
                        steps = ExerciseStep.query.filter_by(exercise_id=exercise.id).all()
                        
                        if not steps:
                            errors.append({
                                'type': 'exercise',
                                'message': f'El ejercicio "{exercise.title or f"#{exercise.exercise_number}"}" en "{topic.name}" no tiene pasos',
                                'details': f'Agrega al menos un paso al ejercicio'
                            })
                        else:
                            for step in steps:
                                # Verificar que el paso tenga imagen
                                if not step.image_url:
                                    warnings.append({
                                        'type': 'step',
                                        'message': f'El paso #{step.step_number} del ejercicio "{exercise.title or f"#{exercise.exercise_number}"}" no tiene imagen',
                                        'details': 'Es recomendable agregar una imagen al paso'
                                    })
                                
                                # Verificar que el paso tenga acciones
                                actions = ExerciseAction.query.filter_by(step_id=step.id).all()
                                if not actions:
                                    warnings.append({
                                        'type': 'step',
                                        'message': f'El paso #{step.step_number} del ejercicio "{exercise.title or f"#{exercise.exercise_number}"}" no tiene acciones',
                                        'details': 'Es recomendable agregar al menos una acción (botón o campo de texto) al paso'
                                    })
        
        is_valid = len(errors) == 0
        
        print(f"Validación completada: {'VÁLIDO' if is_valid else 'INVÁLIDO'}")
        print(f"Errores: {len(errors)}, Advertencias: {len(warnings)}")
        print(f"=== FIN VALIDAR EXAMEN ===")
        
        # Calcular totales usando los métodos del modelo
        total_questions = exam.get_total_questions() if hasattr(exam, 'get_total_questions') else 0
        total_exercises = exam.get_total_exercises() if hasattr(exam, 'get_total_exercises') else 0
        
        return jsonify({
            'is_valid': is_valid,
            'errors': errors,
            'warnings': warnings,
            'summary': {
                'total_categories': len(categories) if categories else 0,
                'total_topics': sum(Topic.query.filter_by(category_id=c.id).count() for c in categories) if categories else 0,
                'total_questions': total_questions,
                'total_exercises': total_exercises
            }
        }), 200
    
    except HTTPException:
    
        raise
    
    except Exception as e:
        print(f"ERROR en validación: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Error al validar el examen',
            'message': str(e)
        }), 500


@bp.route('/<int:exam_id>/validate', methods=['OPTIONS'])
def options_validate_exam(exam_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/<int:exam_id>/check-ecm-conflict', methods=['GET'])
@jwt_required()
@require_permission('exams:read')
def check_ecm_conflict(exam_id):
    """
    Verificar si hay otro examen publicado con el mismo código ECM
    """
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    # Si el examen no tiene código ECM, no hay conflicto
    if not exam.competency_standard_id:
        return jsonify({
            'has_conflict': False,
            'message': 'El examen no tiene código ECM asignado'
        }), 200
    
    # Buscar otro examen publicado con el mismo competency_standard_id
    conflicting_exam = Exam.query.filter(
        Exam.id != exam_id,
        Exam.competency_standard_id == exam.competency_standard_id,
        Exam.is_published == True
    ).first()
    
    if conflicting_exam:
        return jsonify({
            'has_conflict': True,
            'current_exam': {
                'id': exam.id,
                'name': exam.name,
                'version': exam.version,
                'ecm_code': exam.competency_standard.code if exam.competency_standard else None
            },
            'conflicting_exam': {
                'id': conflicting_exam.id,
                'name': conflicting_exam.name,
                'version': conflicting_exam.version,
                'is_published': conflicting_exam.is_published
            },
            'message': f'Ya existe un examen publicado con el mismo código ECM: {conflicting_exam.name}'
        }), 200
    
    return jsonify({
        'has_conflict': False,
        'message': 'No hay conflicto de ECM'
    }), 200


@bp.route('/<int:exam_id>/check-ecm-conflict', methods=['OPTIONS'])
def options_check_ecm_conflict(exam_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/<int:exam_id>/publish', methods=['POST'])
@jwt_required()
@require_permission('exams:update')
def publish_exam(exam_id):
    """
    Publicar un examen después de validarlo
    """
    print(f"\n=== PUBLICAR EXAMEN {exam_id} ===")
    
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    # Primero validar el examen
    categories = Category.query.filter_by(exam_id=exam_id).all()
    
    if not categories:
        return jsonify({
            'error': 'No se puede publicar',
            'message': 'El examen no tiene categorías'
        }), 400
    
    total_percentage = sum(c.percentage or 0 for c in categories)
    if total_percentage != 100:
        return jsonify({
            'error': 'No se puede publicar',
            'message': f'Las categorías suman {total_percentage}%, deben sumar 100%'
        }), 400
    
    # Verificar que tenga al menos una pregunta o ejercicio usando los métodos del modelo
    total_questions = exam.get_total_questions() if hasattr(exam, 'get_total_questions') else 0
    total_exercises = exam.get_total_exercises() if hasattr(exam, 'get_total_exercises') else 0
    
    if total_questions == 0 and total_exercises == 0:
        return jsonify({
            'error': 'No se puede publicar',
            'message': 'El examen no tiene preguntas ni ejercicios'
        }), 400
    
    # Publicar el examen
    from datetime import datetime
    exam.is_published = True
    exam.updated_at = datetime.utcnow()
    
    user_id = get_jwt_identity()
    exam.updated_by = user_id
    
    db.session.commit()
    
    print(f"✓ Examen publicado exitosamente")
    print(f"=== FIN PUBLICAR EXAMEN ===")
    
    return jsonify({
        'message': 'Examen publicado exitosamente',
        'exam': exam.to_dict()
    }), 200


@bp.route('/<int:exam_id>/publish', methods=['OPTIONS'])
def options_publish_exam(exam_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/<int:exam_id>/unpublish', methods=['POST'])
@jwt_required()
@require_permission('exams:update')
def unpublish_exam(exam_id):
    """
    Despublicar un examen
    """
    print(f"\n=== DESPUBLICAR EXAMEN {exam_id} ===")
    
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    from datetime import datetime
    exam.is_published = False
    exam.updated_at = datetime.utcnow()
    
    user_id = get_jwt_identity()
    exam.updated_by = user_id
    
    db.session.commit()
    
    print(f"✓ Examen despublicado exitosamente")
    print(f"=== FIN DESPUBLICAR EXAMEN ===")
    
    return jsonify({
        'message': 'Examen despublicado exitosamente',
        'exam': exam.to_dict()
    }), 200


@bp.route('/<int:exam_id>/unpublish', methods=['OPTIONS'])
def options_unpublish_exam(exam_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


# ============= EVALUACIÓN DE EXAMEN =============

def calculate_text_similarity(user_answer: str, correct_answer: str) -> float:
    """
    Calcula la similitud entre dos textos usando distancia de Levenshtein normalizada
    """
    if not user_answer or not correct_answer:
        return 0.0
    
    # Normalizar textos
    s1 = user_answer.lower().strip()
    s2 = correct_answer.lower().strip()
    
    if s1 == s2:
        return 1.0
    
    # Calcular distancia de Levenshtein
    len1, len2 = len(s1), len(s2)
    
    # Crear matriz de distancias
    dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]
    
    for i in range(len1 + 1):
        dp[i][0] = i
    for j in range(len2 + 1):
        dp[0][j] = j
    
    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            if s1[i-1] == s2[j-1]:
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    
    distance = dp[len1][len2]
    max_len = max(len1, len2)
    
    return 1.0 - (distance / max_len) if max_len > 0 else 1.0


def evaluate_question(question_data: dict, user_answer: any) -> dict:
    """
    Evalúa la respuesta de una pregunta
    
    Args:
        question_data: Diccionario con datos de la pregunta (incluye answers con is_correct)
        user_answer: Respuesta del usuario
    
    Returns:
        dict con is_correct, score, correct_answer, user_answer, explanation
    """
    result = {
        'question_id': question_data.get('id'),
        'question_type': question_data.get('question_type', {}).get('name') if isinstance(question_data.get('question_type'), dict) else question_data.get('question_type'),
        'question_text': question_data.get('question_text'),
        'user_answer': user_answer,
        'is_correct': False,
        'score': 0,
        'correct_answer': None,
        'explanation': None,
        'answers': question_data.get('answers', [])
    }
    
    q_type = result['question_type']
    answers = question_data.get('answers', [])
    
    if user_answer is None:
        result['explanation'] = 'Pregunta sin responder'
        return result
    
    if q_type == 'true_false':
        # Para verdadero/falso, buscar la respuesta correcta
        correct_answer_obj = next((a for a in answers if a.get('is_correct')), None)
        if correct_answer_obj:
            # El answer_text contiene 'true' o 'false' o similar
            correct_text = correct_answer_obj.get('answer_text', '').lower()
            correct_value = correct_text in ['true', 'verdadero', '1', 'si', 'sí']
            
            result['is_correct'] = user_answer == correct_value
            result['correct_answer'] = correct_value
            result['score'] = 1 if result['is_correct'] else 0
            result['explanation'] = correct_answer_obj.get('explanation')
    
    elif q_type == 'multiple_choice':
        # Para opción múltiple, comparar ID de respuesta
        correct_answer_obj = next((a for a in answers if a.get('is_correct')), None)
        if correct_answer_obj:
            result['is_correct'] = str(user_answer) == str(correct_answer_obj.get('id'))
            result['correct_answer'] = correct_answer_obj.get('id')
            result['correct_answer_text'] = correct_answer_obj.get('answer_text')
            result['score'] = 1 if result['is_correct'] else 0
            result['explanation'] = correct_answer_obj.get('explanation')
    
    elif q_type == 'multiple_select':
        # Para selección múltiple, verificar que todas las correctas estén seleccionadas
        correct_answer_ids = [str(a.get('id')) for a in answers if a.get('is_correct')]
        user_answer_ids = [str(a) for a in (user_answer if isinstance(user_answer, list) else [])]
        
        # Ordenar para comparar
        correct_answer_ids.sort()
        user_answer_ids.sort()
        
        result['is_correct'] = correct_answer_ids == user_answer_ids
        result['correct_answer'] = correct_answer_ids
        result['correct_answers_text'] = [a.get('answer_text') for a in answers if a.get('is_correct')]
        
        # Puntaje parcial: calcular proporción de respuestas correctas
        if len(correct_answer_ids) > 0:
            correct_selections = len(set(user_answer_ids) & set(correct_answer_ids))
            wrong_selections = len(set(user_answer_ids) - set(correct_answer_ids))
            result['score'] = max(0, (correct_selections - wrong_selections) / len(correct_answer_ids))
        
    elif q_type == 'ordering':
        # Para ordenamiento, verificar el orden de los IDs
        # Manejar None en answer_number usando 0 como default
        def get_order_key(a):
            num = a.get('answer_number')
            return num if num is not None else 0
        
        sorted_answers = sorted(answers, key=get_order_key)
        correct_order = [str(a.get('id')) for a in sorted_answers]
        user_order = [str(a) for a in (user_answer if isinstance(user_answer, list) else [])]
        
        result['is_correct'] = correct_order == user_order
        result['correct_answer'] = correct_order
        result['correct_answers_text'] = [a.get('answer_text') for a in sorted_answers]
        
        # Puntaje parcial: cada posición correcta vale 1/N
        if len(correct_order) > 0:
            correct_positions = 0
            for i, correct_id in enumerate(correct_order):
                if i < len(user_order) and user_order[i] == correct_id:
                    correct_positions += 1
            result['score'] = correct_positions / len(correct_order)
            result['correct_positions'] = correct_positions
            result['total_positions'] = len(correct_order)
        else:
            result['score'] = 0
    
    elif q_type == 'drag_drop':
        # Para completar espacios en blanco arrastrando
        # user_answer es un dict {blank_id: answer_id}
        user_blanks = user_answer if isinstance(user_answer, dict) else {}
        
        # Construir el mapa correcto: qué respuesta va en qué blank
        correct_blanks = {}
        for a in answers:
            blank = a.get('correct_answer', '')
            if blank and blank.startswith('blank_'):
                correct_blanks[blank] = str(a.get('id'))
        
        # Verificar si la respuesta del usuario es correcta
        total_blanks = len(correct_blanks)
        correct_count = 0
        
        for blank_id, correct_answer_id in correct_blanks.items():
            user_answer_id = str(user_blanks.get(blank_id, ''))
            if user_answer_id == correct_answer_id:
                correct_count += 1
        
        result['is_correct'] = correct_count == total_blanks
        result['correct_answer'] = correct_blanks
        result['score'] = correct_count / total_blanks if total_blanks > 0 else 0
        result['correct_count'] = correct_count
        result['total_blanks'] = total_blanks
    
    elif q_type == 'column_grouping':
        # Para agrupamiento en columnas
        # user_answer es un dict {column_id: [answer_id1, answer_id2, ...]}
        user_columns = user_answer if isinstance(user_answer, dict) else {}
        
        # Crear mapa de respuesta correcta: answer_id -> columna correcta
        correct_column_map = {}
        for a in answers:
            column = a.get('correct_answer', '')
            if column:
                correct_column_map[str(a.get('id'))] = column
        
        # Total de elementos a clasificar
        total_items = len(correct_column_map)
        correct_count = 0
        
        # Verificar cada elemento clasificado por el usuario
        for column_id, answer_ids in user_columns.items():
            if isinstance(answer_ids, list):
                for answer_id in answer_ids:
                    answer_id_str = str(answer_id)
                    # Verificar si este elemento está en la columna correcta
                    if correct_column_map.get(answer_id_str) == column_id:
                        correct_count += 1
        
        result['is_correct'] = correct_count == total_items and total_items > 0
        result['correct_answer'] = correct_column_map
        result['score'] = correct_count / total_items if total_items > 0 else 0
        result['correct_count'] = correct_count
        result['total_items'] = total_items
    
    return result


def evaluate_exercise(exercise_data: dict, exercise_responses: dict) -> dict:
    """
    Evalúa las respuestas de un ejercicio
    
    Args:
        exercise_data: Diccionario con datos del ejercicio (incluye steps y actions)
        exercise_responses: Dict con respuestas del usuario {stepId_actionId: value}
    
    Returns:
        dict con resultados de evaluación por paso y acción
    """
    result = {
        'exercise_id': exercise_data.get('id'),
        'title': exercise_data.get('title'),
        'is_correct': True,
        'total_score': 0,
        'max_score': 0,
        'steps': []
    }
    
    steps = exercise_data.get('steps', [])
    
    for step in steps:
        step_result = {
            'step_id': step.get('id'),
            'step_number': step.get('step_number'),
            'title': step.get('title'),
            'is_correct': True,
            'actions': []
        }
        
        actions = step.get('actions', [])
        
        for action in actions:
            action_id = action.get('id')
            step_id = step.get('id')
            response_key = f"{step_id}_{action_id}"
            user_response = exercise_responses.get(response_key)
            correct_answer = action.get('correct_answer', '')
            
            # Determinar si esta acción es "correcta" (debe ser evaluada)
            # o "incorrecta" (no debe ser evaluada, es una trampa/distractor)
            action_type = action.get('action_type')
            
            # Verificar si es un botón/campo incorrecto (distractor)
            is_wrong_action = False
            if action_type == 'button':
                # Botón correcto: correct_answer es 'correct', 'true', '1', 'yes', etc.
                is_correct_button = correct_answer and str(correct_answer).lower().strip() in ['true', '1', 'correct', 'yes', 'si', 'sí']
                is_wrong_action = not is_correct_button
            elif action_type in ['textbox', 'text_input']:
                # Campo de texto correcto: tiene correct_answer válido que no sea 'wrong'
                has_valid_answer = correct_answer and str(correct_answer).strip() != '' and str(correct_answer).lower().strip() != 'wrong'
                is_wrong_action = not has_valid_answer
            
            # Si es una acción incorrecta (distractor), NO la evaluamos
            if is_wrong_action:
                # No contar en el score, pero registrar si el usuario hizo clic (para estadísticas)
                action_result = {
                    'action_id': action_id,
                    'action_number': action.get('action_number'),
                    'action_type': action_type,
                    'user_response': user_response,
                    'is_correct': True,  # No se penaliza si no hizo clic
                    'is_wrong_action': True,  # Marcar como acción incorrecta
                    'clicked_wrong': bool(user_response),  # Indicar si hizo clic en un campo incorrecto
                    'score': 0,  # No suma ni resta
                    'correct_answer': correct_answer,
                    'explanation': None
                }
                # Si el usuario hizo clic en un campo incorrecto, eso sí es error
                if user_response:
                    action_result['is_correct'] = False
                    step_result['is_correct'] = False
                    result['is_correct'] = False
                
                step_result['actions'].append(action_result)
                continue
            
            # Es una acción correcta (debe ser evaluada normalmente)
            action_result = {
                'action_id': action_id,
                'action_number': action.get('action_number'),
                'action_type': action_type,
                'user_response': user_response,
                'is_correct': False,
                'is_wrong_action': False,
                'score': 0,
                'correct_answer': correct_answer,
                'explanation': None
            }
            
            result['max_score'] += 1
            
            if action_type == 'button':
                # Para botones correctos, verificar si fue clickeado
                action_result['is_correct'] = bool(user_response)
                action_result['score'] = 1 if action_result['is_correct'] else 0
                
            elif action_type in ['textbox', 'text_input']:
                scoring_mode = action.get('scoring_mode', 'exact')
                is_case_sensitive = action.get('is_case_sensitive', False)
                
                if user_response is None:
                    user_response = ''
                
                if scoring_mode == 'exact':
                    # Comparación exacta
                    if is_case_sensitive:
                        action_result['is_correct'] = str(user_response).strip() == str(correct_answer).strip()
                    else:
                        action_result['is_correct'] = str(user_response).strip().lower() == str(correct_answer).strip().lower()
                    action_result['score'] = 1 if action_result['is_correct'] else 0
                    
                elif scoring_mode == 'similarity':
                    # Comparación por similitud
                    if is_case_sensitive:
                        similarity = calculate_text_similarity(str(user_response), str(correct_answer))
                    else:
                        similarity = calculate_text_similarity(str(user_response).lower(), str(correct_answer).lower())
                    
                    # Consideramos correcto si la similitud es >= 80%
                    action_result['is_correct'] = similarity >= 0.8
                    action_result['score'] = similarity
                    action_result['similarity'] = round(similarity * 100, 1)
                
                if action.get('error_message'):
                    action_result['explanation'] = action.get('error_message')
            
            if not action_result['is_correct']:
                step_result['is_correct'] = False
                result['is_correct'] = False
            
            result['total_score'] += action_result['score']
            step_result['actions'].append(action_result)
        
        result['steps'].append(step_result)
    
    return result


@bp.route('/<int:exam_id>/evaluate', methods=['POST'])
@jwt_required()
@rate_limit_evaluation(limit=10, window=60)
def evaluate_exam(exam_id):
    """
    Evalúa las respuestas de un examen
    
    Request body:
    {
        "answers": {"question_id": answer_value, ...},
        "exerciseResponses": {"exercise_id": {"stepId_actionId": value, ...}, ...},
        "items": [lista de items del test con datos completos]
    }
    
    Returns:
    {
        "results": {
            "questions": [resultados evaluados de preguntas],
            "exercises": [resultados evaluados de ejercicios],
            "summary": {
                "total_items": N,
                "total_questions": N,
                "total_exercises": N,
                "correct_questions": N,
                "correct_exercises": N,
                "question_score": X,
                "exercise_score": X,
                "total_score": X,
                "percentage": X
            }
        }
    }
    """
    print(f"\n=== EVALUAR EXAMEN {exam_id} ===")
    
    try:
        # Verificar que el examen existe
        exam = Exam.query.get(exam_id)
        if not exam:
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
        
        answers = data.get('answers', {})
        exercise_responses = data.get('exerciseResponses', {})
        items = data.get('items', [])
        
        print(f"Recibido: {len(answers)} respuestas de preguntas, {len(exercise_responses)} respuestas de ejercicios, {len(items)} items")
        
        # Debug: mostrar categorías y temas de los items recibidos
        for i, item in enumerate(items[:5]):  # Solo los primeros 5 para no llenar los logs
            print(f"  Item {i}: type={item.get('type')}, category={item.get('category_name')}, topic={item.get('topic_name')}")
        
        question_results = []
        exercise_results = []
        
        for item in items:
            if item.get('type') == 'question':
                question_id = str(item.get('question_id') or item.get('id'))
                user_answer = answers.get(question_id)
                
                # Obtener información de categoría y tema del item
                category_name = item.get('category_name', 'Sin categoría')
                topic_name = item.get('topic_name', 'Sin tema')
                
                question = Question.query.get(question_id)
                if question:
                    question_data = question.to_dict(include_answers=True, include_correct=True)
                    result = evaluate_question(question_data, user_answer)
                    # Agregar categoría y tema al resultado
                    result['category_name'] = category_name
                    result['topic_name'] = topic_name
                    result['max_score'] = 1  # Una pregunta vale máximo 1 punto
                    question_results.append(result)
                    print(f"  Pregunta {question_id}: {'✓' if result['is_correct'] else '✗'} (score: {result['score']:.2f})")
                else:
                    # Si no encontramos en BD, usar datos del item
                    item_with_answers = item.copy()
                    # Intentar obtener respuestas de la BD
                    answers_from_db = Answer.query.filter_by(question_id=question_id).all()
                    if answers_from_db:
                        item_with_answers['answers'] = [a.to_dict(include_correct=True) for a in answers_from_db]
                    result = evaluate_question(item_with_answers, user_answer)
                    # Agregar categoría y tema al resultado
                    result['category_name'] = category_name
                    result['topic_name'] = topic_name
                    result['max_score'] = 1
                    question_results.append(result)
                    print(f"  Pregunta {question_id} (sin BD): {'✓' if result['is_correct'] else '✗'} (score: {result['score']:.2f})")
            
            elif item.get('type') == 'exercise':
                exercise_id = str(item.get('exercise_id') or item.get('id'))
                ex_responses = exercise_responses.get(exercise_id, {})
                
                # Obtener información de categoría y tema del item
                category_name = item.get('category_name', 'Sin categoría')
                topic_name = item.get('topic_name', 'Sin tema')
                
                # Obtener ejercicio de la BD con pasos y acciones
                exercise = Exercise.query.get(exercise_id)
                if exercise:
                    exercise_data = exercise.to_dict(include_steps=True)
                else:
                    # Usar datos del item
                    exercise_data = item
                
                result = evaluate_exercise(exercise_data, ex_responses)
                # Agregar categoría y tema al resultado
                result['category_name'] = category_name
                result['topic_name'] = topic_name
                exercise_results.append(result)
                print(f"  Ejercicio {exercise_id}: {'✓' if result['is_correct'] else '✗'} ({result['total_score']}/{result['max_score']})")
        
        # Calcular resumen
        total_questions = len(question_results)
        total_exercises = len(exercise_results)
        correct_questions = sum(1 for r in question_results if r['is_correct'])
        correct_exercises = sum(1 for r in exercise_results if r['is_correct'])
        
        # Calcular puntajes simples - cada pregunta y ejercicio tiene el mismo peso
        question_score = sum(r['score'] for r in question_results) if question_results else 0
        exercise_score = sum(r['total_score'] for r in exercise_results) if exercise_results else 0
        max_exercise_score = sum(r['max_score'] for r in exercise_results) if exercise_results else 0
        
        total_points = total_questions + max_exercise_score
        earned_points = question_score + exercise_score
        
        # Calcular desglose por categoría y tema para la evaluación ponderada
        evaluation_breakdown = {}
        
        # Obtener porcentajes de categorías y temas del examen
        category_percentages = {}
        topic_percentages = {}
        for category in exam.categories:
            category_percentages[category.name] = category.percentage or 0
            for topic in category.topics:
                topic_key = f"{category.name}|{topic.name}"
                topic_percentages[topic_key] = topic.percentage or 0
        
        print(f"  📊 Porcentajes de categorías: {category_percentages}")
        print(f"  📊 Porcentajes de temas: {topic_percentages}")
        
        # Procesar preguntas
        for qr in question_results:
            cat_name = qr.get('category_name', 'Sin categoría')
            topic_name = qr.get('topic_name', 'Sin tema')
            
            if cat_name not in evaluation_breakdown:
                evaluation_breakdown[cat_name] = {'topics': {}, 'earned': 0, 'max': 0, 'percentage': 0}
            if topic_name not in evaluation_breakdown[cat_name]['topics']:
                evaluation_breakdown[cat_name]['topics'][topic_name] = {'earned': 0, 'max': 0, 'percentage': 0}
            
            earned = qr.get('score', 0)
            max_score = qr.get('max_score', 1)
            
            evaluation_breakdown[cat_name]['earned'] += earned
            evaluation_breakdown[cat_name]['max'] += max_score
            evaluation_breakdown[cat_name]['topics'][topic_name]['earned'] += earned
            evaluation_breakdown[cat_name]['topics'][topic_name]['max'] += max_score
        
        # Procesar ejercicios
        for er in exercise_results:
            cat_name = er.get('category_name', 'Sin categoría')
            topic_name = er.get('topic_name', 'Sin tema')
            
            if cat_name not in evaluation_breakdown:
                evaluation_breakdown[cat_name] = {'topics': {}, 'earned': 0, 'max': 0, 'percentage': 0}
            if topic_name not in evaluation_breakdown[cat_name]['topics']:
                evaluation_breakdown[cat_name]['topics'][topic_name] = {'earned': 0, 'max': 0, 'percentage': 0}
            
            earned = er.get('total_score', 0)
            max_score = er.get('max_score', 1)
            
            evaluation_breakdown[cat_name]['earned'] += earned
            evaluation_breakdown[cat_name]['max'] += max_score
            evaluation_breakdown[cat_name]['topics'][topic_name]['earned'] += earned
            evaluation_breakdown[cat_name]['topics'][topic_name]['max'] += max_score
        
        # Calcular porcentajes por rendimiento (earned/max) para cada categoría y tema
        for cat_name, cat_data in evaluation_breakdown.items():
            if cat_data['max'] > 0:
                cat_data['percentage'] = round((cat_data['earned'] / cat_data['max']) * 100, 1)
            for topic_name, topic_data in cat_data['topics'].items():
                if topic_data['max'] > 0:
                    topic_data['percentage'] = round((topic_data['earned'] / topic_data['max']) * 100, 1)
        
        # Calcular calificación ponderada usando porcentajes de categorías y temas
        # Fórmula: Σ (porcentaje_categoría/100) × Σ (porcentaje_tema/100) × (earned/max del tema)
        weighted_percentage = 0
        has_weighted_config = False
        
        for cat_name, cat_data in evaluation_breakdown.items():
            cat_weight = category_percentages.get(cat_name, 0) / 100  # Porcentaje de la categoría
            
            if cat_weight > 0:
                has_weighted_config = True
                cat_contribution = 0
                
                for topic_name, topic_data in cat_data['topics'].items():
                    topic_key = f"{cat_name}|{topic_name}"
                    topic_weight = topic_percentages.get(topic_key, 0) / 100  # Porcentaje del tema dentro de la categoría
                    
                    if topic_weight > 0 and topic_data['max'] > 0:
                        topic_score = topic_data['earned'] / topic_data['max']  # Rendimiento del tema (0-1)
                        cat_contribution += topic_weight * topic_score
                    elif topic_data['max'] > 0:
                        # Si el tema no tiene porcentaje configurado, usar rendimiento directo
                        topic_score = topic_data['earned'] / topic_data['max']
                        cat_contribution += topic_score / len(cat_data['topics'])  # Distribuir equitativamente
                
                weighted_percentage += cat_weight * cat_contribution * 100
        
        # Si hay configuración ponderada, usar ese resultado; sino usar cálculo simple
        if has_weighted_config and weighted_percentage > 0:
            percentage = weighted_percentage
            print(f"  📊 Cálculo PONDERADO: {percentage:.1f}%")
        else:
            # Fallback a cálculo simple si no hay ponderación configurada
            percentage = (earned_points / total_points * 100) if total_points > 0 else 0
            print(f"  📊 Cálculo SIMPLE: {earned_points:.2f}/{total_points} = {percentage:.1f}%")
        
        summary = {
            'total_items': len(items),
            'total_questions': total_questions,
            'total_exercises': total_exercises,
            'correct_questions': correct_questions,
            'correct_exercises': correct_exercises,
            'question_score': round(question_score, 2),
            'exercise_score': round(exercise_score, 2),
            'max_exercise_score': max_exercise_score,
            'total_points': total_points,
            'earned_points': round(earned_points, 2),
            'percentage': round(percentage, 1),
            'weighted': has_weighted_config,
            'evaluation_breakdown': evaluation_breakdown
        }
        
        print(f"Resumen: {correct_questions}/{total_questions} preguntas, {correct_exercises}/{total_exercises} ejercicios, {percentage:.1f}%")
        print(f"Desglose por categoría: {list(evaluation_breakdown.keys())}")
        # Debug detallado del breakdown
        for cat_name, cat_data in evaluation_breakdown.items():
            print(f"  Categoría '{cat_name}': earned={cat_data['earned']:.2f}, max={cat_data['max']}, %={cat_data['percentage']}")
            for topic_name, topic_data in cat_data['topics'].items():
                print(f"    Tema '{topic_name}': earned={topic_data['earned']:.2f}, max={topic_data['max']}, %={topic_data['percentage']}")
        print(f"=== FIN EVALUAR EXAMEN ===\n")
        
        return jsonify({
            'results': {
                'questions': question_results,
                'exercises': exercise_results,
                'summary': summary
            }
        }), 200
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        import traceback
        print(f"ERROR en evaluate_exam: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': 'Error al evaluar el examen',
            'message': str(e)
        }), 500


@bp.route('/<int:exam_id>/evaluate', methods=['OPTIONS'])
def options_evaluate_exam(exam_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response

@bp.route('/<int:exam_id>/check-access', methods=['GET'])
@jwt_required()
def check_exam_access(exam_id):
    """
    Verifica si el candidato puede presentar un examen basándose en sus intentos.
    Retorna info de intentos y precio de retoma si los intentos están agotados.
    
    Query params:
        geid: group_exam_id (requerido)
    """
    try:
        from app.models.result import Result
        from app.models.partner import GroupExam, GroupMember, CandidateGroup, EcmRetake
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        group_exam_id = request.args.get('geid', type=int)
        if not group_exam_id:
            return jsonify({'error': 'Se requiere group_exam_id (geid)'}), 400
        
        group_exam = GroupExam.query.get(group_exam_id)
        if not group_exam:
            return jsonify({'error': 'Asignación de examen no encontrada'}), 404
        
        if group_exam.exam_id != exam_id:
            return jsonify({'error': 'El examen no corresponde a la asignación'}), 400
        
        # Verificar vigencia de la asignación
        if group_exam.is_expired:
            return jsonify({
                'can_take': False,
                'expired': True,
                'expires_at': group_exam.effective_expires_at.isoformat() if group_exam.effective_expires_at else None,
                'validity_months': group_exam.validity_months,
                'extended_months': group_exam.extended_months or 0,
                'error': 'La vigencia de esta asignación ha expirado. Contacta a tu coordinador para solicitar una extensión o una nueva asignación.'
            }), 200
        
        # Contar resultados del usuario para este group_exam
        results_count = Result.query.filter_by(
            user_id=str(user_id),
            group_exam_id=group_exam_id
        ).count()
        
        max_attempts = group_exam.max_attempts or 1
        
        # Contar retomas activas
        retakes_total = EcmRetake.query.filter_by(
            user_id=str(user_id),
            group_exam_id=group_exam_id
        ).count()
        
        total_allowed = max_attempts + retakes_total
        attempts_remaining = max(0, total_allowed - results_count)
        attempts_exhausted = results_count >= total_allowed
        
        # Calcular precio de retoma (group override → campus → 0)
        group = CandidateGroup.query.get(group_exam.group_id)
        retake_cost = 0.0
        if group:
            if group.retake_cost_override is not None:
                retake_cost = float(group.retake_cost_override)
            elif group.campus_id:
                from app.models.partner import Campus
                campus = Campus.query.get(group.campus_id)
                if campus and campus.retake_cost is not None:
                    retake_cost = float(campus.retake_cost)
        
        # Determinar si se requiere PIN:
        # 1) PIN específico de la asignación (GroupExam.require_security_pin + security_pin)
        # 2) PIN diario del campus/grupo (Campus.require_exam_pin o CandidateGroup.require_exam_pin_override)
        pin_required = bool(group_exam.require_security_pin and group_exam.security_pin)
        if not pin_required:
            from app.models.partner import Campus
            campus_pin = False
            if group and group.require_exam_pin_override is not None:
                campus_pin = bool(group.require_exam_pin_override)
            elif group and group.campus_id:
                campus_obj = Campus.query.get(group.campus_id)
                if campus_obj:
                    campus_pin = bool(campus_obj.require_exam_pin)
            pin_required = campus_pin

        return jsonify({
            'can_take': not attempts_exhausted,
            'max_attempts': max_attempts,
            'retakes_total': retakes_total,
            'total_allowed': total_allowed,
            'attempts_used': results_count,
            'attempts_remaining': attempts_remaining,
            'attempts_exhausted': attempts_exhausted,
            'retake_cost': retake_cost,
            'max_disconnections': group_exam.max_disconnections or 3,
            'expired': False,
            'validity_months': group_exam.validity_months,
            'expires_at': group_exam.effective_expires_at.isoformat() if group_exam.effective_expires_at else None,
            'extended_months': group_exam.extended_months or 0,
            'require_security_pin': pin_required,
        }), 200
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:exam_id>/check-access', methods=['OPTIONS'])
def options_check_exam_access(exam_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/<int:exam_id>/verify-pin', methods=['POST'])
@jwt_required()
def verify_exam_pin(exam_id):
    """Verificar PIN de seguridad para iniciar un examen."""
    try:
        from app.models.partner import GroupExam

        user_id = get_jwt_identity()
        data = request.get_json() or {}
        group_exam_id = data.get('group_exam_id')
        pin = (data.get('pin') or '').strip()

        if not group_exam_id:
            return jsonify({'error': 'Se requiere group_exam_id'}), 400
        if not pin:
            return jsonify({'error': 'Se requiere el PIN'}), 400

        group_exam = GroupExam.query.get(group_exam_id)
        if not group_exam or group_exam.exam_id != exam_id:
            return jsonify({'error': 'Asignación de examen no encontrada'}), 404

        # Primero verificar PIN específico de la asignación
        if group_exam.require_security_pin and group_exam.security_pin:
            import hmac
            if hmac.compare_digest(pin, group_exam.security_pin):
                return jsonify({'valid': True}), 200
            else:
                return jsonify({'valid': False, 'error': 'PIN incorrecto'}), 200

        # Si no tiene PIN de asignación, verificar PIN diario del campus / grupo
        from app.models.partner import CandidateGroup, Campus
        group = CandidateGroup.query.get(group_exam.group_id)
        campus_requires_pin = False
        campus_obj = None
        if group:
            if group.require_exam_pin_override is not None:
                campus_requires_pin = bool(group.require_exam_pin_override)
            elif group.campus_id:
                campus_obj = Campus.query.get(group.campus_id)
                if campus_obj:
                    campus_requires_pin = bool(campus_obj.require_exam_pin)
            if not campus_obj and group.campus_id:
                campus_obj = Campus.query.get(group.campus_id)

        if not campus_requires_pin:
            return jsonify({'valid': True}), 200

        if campus_obj:
            daily_pin = campus_obj.get_daily_pin()
            if daily_pin and pin == daily_pin:
                return jsonify({'valid': True}), 200

        return jsonify({'valid': False, 'error': 'PIN incorrecto'}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:exam_id>/save-result', methods=['POST'])
@jwt_required()
def save_exam_result(exam_id):
    """
    Guarda el resultado de un examen en la base de datos
    
    Request body:
    {
        "score": 85,
        "percentage": 85.0,
        "status": 1,  # 0=en proceso, 1=completado, 2=abandonado
        "duration_seconds": 1200,
        "answers_data": {...},  # Opcional: datos de respuestas
        "questions_order": [...]  # Opcional: orden de preguntas
    }
    """
    print(f"\n=== GUARDAR RESULTADO EXAMEN {exam_id} ===")
    
    try:
        from app.models.result import Result
        import uuid
        
        user_id = get_jwt_identity()
        
        # Verificar que el examen existe
        exam = Exam.query.get(exam_id)
        if not exam:
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400
        
        score = data.get('score', 0)
        percentage = data.get('percentage', 0)
        status = data.get('status', 1)  # 1 = completado por defecto
        duration_seconds = data.get('duration_seconds', 0)
        answers_data = data.get('answers_data')
        questions_order = data.get('questions_order')
        
        # Contexto de grupo (enviado por el frontend desde la cadena de asignación)
        group_id = data.get('group_id')
        group_exam_id = data.get('group_exam_id')
        
        # Fallback: si no se envió contexto de grupo, intentar resolverlo
        if not group_id or not group_exam_id:
            try:
                from app.models.partner import GroupExam, GroupMember, GroupExamMember
                # Buscar grupos activos donde el usuario es miembro
                memberships = GroupMember.query.filter_by(user_id=str(user_id), status='active').all()
                for m in memberships:
                    ge = GroupExam.query.filter_by(
                        group_id=m.group_id, exam_id=exam_id, is_active=True
                    ).first()
                    if ge:
                        # Verificar que el usuario tiene acceso a este group_exam
                        if ge.assignment_type == 'all' or ge.assignment_type is None:
                            group_id = ge.group_id
                            group_exam_id = ge.id
                            break
                        elif ge.assignment_type == 'selected':
                            member_assign = GroupExamMember.query.filter_by(
                                group_exam_id=ge.id, user_id=str(user_id)
                            ).first()
                            if member_assign:
                                group_id = ge.group_id
                                group_exam_id = ge.id
                                break
            except Exception as resolve_err:
                print(f"⚠️ No se pudo resolver contexto de grupo: {resolve_err}")
        
        # VALIDAR INTENTOS: No permitir guardar resultado si los intentos están agotados
        if group_exam_id:
            try:
                from app.models.partner import GroupExam as GE2, EcmRetake
                ge_check = GE2.query.get(group_exam_id)
                if ge_check:
                    # Verificar vigencia
                    if ge_check.is_expired:
                        print(f"⛔ ASIGNACIÓN EXPIRADA: user={user_id}, geid={group_exam_id}")
                        return jsonify({
                            'error': 'La vigencia de esta asignación ha expirado. No se puede guardar el resultado.'
                        }), 403
                    
                    max_att = ge_check.max_attempts or 1
                    retakes_t = EcmRetake.query.filter_by(
                        user_id=str(user_id), group_exam_id=group_exam_id
                    ).count()
                    total_allowed = max_att + retakes_t
                    existing_results = Result.query.filter_by(
                        user_id=str(user_id), group_exam_id=group_exam_id
                    ).count()
                    if existing_results >= total_allowed:
                        print(f"⛔ INTENTOS AGOTADOS: user={user_id}, geid={group_exam_id}, usado={existing_results}, permitido={total_allowed}")
                        return jsonify({
                            'error': 'Has agotado tus intentos para este examen. Solicita una retoma a tu coordinador.'
                        }), 403
            except Exception as att_err:
                print(f"⚠️ Error validando intentos: {att_err}")
        
        # DEBUG: Ver qué se está guardando
        print(f"📋 SAVE - answers_data keys: {list(answers_data.keys()) if isinstance(answers_data, dict) else 'No es dict'}")
        if isinstance(answers_data, dict):
            eb = answers_data.get('evaluation_breakdown', {})
            print(f"📋 SAVE - evaluation_breakdown: {eb}")
            summary_eb = answers_data.get('summary', {}).get('evaluation_breakdown', {}) if isinstance(answers_data.get('summary'), dict) else {}
            print(f"📋 SAVE - summary.evaluation_breakdown: {summary_eb}")
        
        # Determinar si aprobó
        passing_score = exam.passing_score or 70
        result_value = 1 if percentage >= passing_score else 0
        
        # Crear el resultado SIN voucher (voucher_id es nullable)
        # IMPORTANTE: Los resultados se asocian al ECM (competency_standard_id) para 
        # mantener historial unificado entre versiones de examen
        result = Result(
            id=str(uuid.uuid4()),
            user_id=str(user_id),
            voucher_id=None,  # Sin voucher - campo es nullable
            exam_id=exam_id,
            competency_standard_id=exam.competency_standard_id,  # Asociar al ECM para historial unificado
            group_id=group_id,
            group_exam_id=group_exam_id,
            score=int(round(percentage)),
            status=status,
            result=result_value,
            duration_seconds=duration_seconds,
            answers_data=answers_data,
            questions_order=questions_order
        )
        
        # Generar códigos de verificación únicos
        import string
        import random
        chars = string.ascii_uppercase + string.digits
        
        # Código para Reporte de Evaluación: ZC + 10 caracteres
        zc_random = ''.join(random.choices(chars, k=10))
        result.certificate_code = f"ZC{zc_random}"
        
        # Código para Certificado Eduit: EC + 10 caracteres
        ec_random = ''.join(random.choices(chars, k=10))
        result.eduit_certificate_code = f"EC{ec_random}"
        
        result.end_date = db.func.now()
        
        db.session.add(result)
        db.session.commit()
        
        # Invalidar cache del dashboard del usuario para que vea los resultados actualizados
        invalidate_on_exam_complete(str(user_id), exam_id, exam.competency_standard_id)
        
        # Enviar email de resultado al candidato
        try:
            from app.services.email_service import send_exam_result_email
            exam_user = User.query.get(str(user_id))
            if exam_user and exam_user.email:
                import re as re_strip
                exam_name_clean = re_strip.sub(r'<[^>]+>', '', exam.name or 'Evaluación')
                ecm_code = None
                if exam.competency_standard_id:
                    from app.models.competency_standard import CompetencyStandard
                    std = CompetencyStandard.query.get(exam.competency_standard_id)
                    ecm_code = std.code if std else None
                send_exam_result_email(
                    exam_user,
                    exam_name_clean,
                    int(round(percentage)),
                    result_value == 1,
                    ecm_code=ecm_code
                )
        except Exception as email_err:
            print(f"Error enviando email de resultado: {email_err}")
        
        # ── Emisión automática de Insignia Digital (Open Badges 3.0) ──
        issued_badge_data = None
        if result_value == 1:
            try:
                from app.services.badge_service import issue_badge_for_result
                exam_user_badge = exam_user if exam_user else User.query.get(str(user_id))
                badge = issue_badge_for_result(result, exam_user_badge, exam)
                if badge:
                    issued_badge_data = {
                        'badge_code': badge.badge_code,
                        'badge_image_url': badge.badge_image_url,
                        'badge_uuid': badge.badge_uuid,
                    }
                    print(f"🏅 Insignia digital emitida: {badge.badge_code}")
            except Exception as badge_err:
                print(f"Error emitiendo insignia digital: {badge_err}")
        
        print(f"✅ Resultado guardado: id={result.id}, score={score}, percentage={percentage}, aprobado={result_value == 1}")
        print(f"=== FIN GUARDAR RESULTADO ===\n")
        
        response_data = {
            'message': 'Resultado guardado exitosamente',
            'result': result.to_dict(),
            'is_approved': result_value == 1
        }
        if issued_badge_data:
            response_data['badge'] = issued_badge_data
        
        return jsonify(response_data), 201
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"ERROR en save_exam_result: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': 'Error al guardar el resultado',
            'message': str(e)
        }), 500


@bp.route('/<int:exam_id>/save-result', methods=['OPTIONS'])
def options_save_exam_result(exam_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/<int:exam_id>/my-results', methods=['GET'])
@jwt_required()
def get_my_exam_results(exam_id):
    """
    Obtiene los resultados del usuario actual para un examen específico.
    
    IMPORTANTE: Si el examen tiene un ECM asociado, retorna TODOS los resultados
    de ese ECM (incluyendo resultados de otras versiones del examen), para mantener
    un historial unificado por estándar de competencia.
    """
    try:
        from app.models.result import Result
        
        user_id = get_jwt_identity()
        
        # Obtener el examen para ver si tiene ECM asociado
        exam = Exam.query.get(exam_id)
        if not exam:
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        # Si el examen tiene ECM, buscar resultados por ECM (historial unificado)
        # Si no tiene ECM, buscar solo por exam_id (comportamiento legacy)
        if exam.competency_standard_id:
            results = Result.query.filter_by(
                user_id=str(user_id),
                competency_standard_id=exam.competency_standard_id
            ).order_by(Result.created_at.desc()).all()
        else:
            results = Result.query.filter_by(
                user_id=str(user_id),
                exam_id=exam_id
            ).order_by(Result.created_at.desc()).all()
        
        return jsonify({
            'results': [r.to_dict(include_details=True) for r in results],
            'total': len(results),
            'grouped_by': 'ecm' if exam.competency_standard_id else 'exam',
            'ecm_id': exam.competency_standard_id
        }), 200
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        import traceback
        print(f"ERROR en get_my_exam_results: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': 'Error al obtener resultados',
            'message': str(e)
        }), 500


@bp.route('/results/<result_id>/upload-report', methods=['POST'])
@jwt_required()
def upload_result_report(result_id):
    """
    Sube el PDF del reporte de evaluación a Azure Blob Storage
    
    Request:
        - file: PDF del reporte (multipart/form-data)
    
    Returns:
        - report_url: URL del PDF guardado
    """
    print(f"\n=== SUBIR REPORTE PDF {result_id} ===")
    
    try:
        from app.models.result import Result
        from app.utils.azure_storage import AzureStorageService
        
        user_id = get_jwt_identity()
        
        # Verificar que el resultado existe y pertenece al usuario
        result = Result.query.filter_by(id=result_id, user_id=str(user_id)).first()
        if not result:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        # Verificar que se envió un archivo
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Nombre de archivo vacío'}), 400
        
        # Verificar que es un PDF
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'El archivo debe ser un PDF'}), 400
        
        # Subir a Azure Blob Storage
        storage = AzureStorageService()
        report_url = storage.upload_file(file, folder='reports')
        
        if not report_url:
            return jsonify({'error': 'Error al subir el archivo'}), 500
        
        # Actualizar el resultado con la URL del reporte
        result.report_url = report_url
        db.session.commit()
        
        # Enviar email de certificado/reporte listo
        try:
            from app.services.email_service import send_certificate_ready_email
            report_user = User.query.get(result.user_id)
            if report_user and report_user.email:
                from app.models.exam import Exam as ExamModel
                report_exam = ExamModel.query.get(result.exam_id)
                import re as re_strip
                exam_name_clean = re_strip.sub(r'<[^>]+>', '', report_exam.name or 'Evaluación') if report_exam else 'Evaluación'
                send_certificate_ready_email(
                    report_user,
                    cert_type='reporte_evaluacion',
                    cert_name=exam_name_clean,
                    download_url=report_url
                )
        except Exception as email_err:
            print(f"Error enviando email de reporte listo: {email_err}")
        
        print(f"✅ Reporte PDF guardado: {report_url}")
        print(f"=== FIN SUBIR REPORTE ===\n")
        
        return jsonify({
            'message': 'Reporte subido exitosamente',
            'report_url': report_url
        }), 200
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"ERROR en upload_result_report: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': 'Error al subir el reporte',
            'message': str(e)
        }), 500


@bp.route('/results/<result_id>/upload-report', methods=['OPTIONS'])
def options_upload_result_report(result_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/results/<result_id>/generate-pdf', methods=['GET'])
@jwt_required()
@rate_limit_pdf(limit=5, window=60)
def generate_result_pdf(result_id):
    """
    Genera el PDF del reporte de evaluación usando el módulo compartido.
    """
    from flask import send_file, current_app, request
    from app.utils.pdf_generator import generate_evaluation_report_pdf
    import re
    import time
    
    start_time = time.time()
    current_app.logger.info(f'📥 [PDF] Iniciando generación de reporte - result_id: {result_id}')
    
    client_timezone = request.args.get('timezone', 'America/Mexico_City')
    
    try:
        from app.models.result import Result
        from app.models.exam import Exam
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        result = Result.query.filter_by(id=result_id, user_id=str(user_id)).first()
        if not result:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        exam = Exam.query.get(result.exam_id)
        if not exam:
            current_app.logger.warning(f'📥 [PDF] Examen no encontrado para resultado: {result_id}')
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        # Generar PDF usando módulo compartido
        buffer = generate_evaluation_report_pdf(result, exam, user, timezone=client_timezone)
        
        def strip_html(text):
            if not text:
                return ''
            return re.sub(r'<[^>]+>', '', str(text))

        exam_short = strip_html(exam.name)[:20] if exam.name else 'Examen'
        filename = f"Reporte_Evaluacion_{exam_short.replace(' ', '_')}.pdf"
        
        elapsed_time = time.time() - start_time
        pdf_size = buffer.getbuffer().nbytes
        current_app.logger.info(f'✅ [PDF] Reporte generado: {filename} - {pdf_size/1024:.2f} KB - {elapsed_time*1000:.0f} ms')
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        import traceback
        current_app.logger.error(f"❌ [PDF] Error generando PDF: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Error al generar el PDF',
            'message': str(e)
        }), 500


@bp.route('/results/<result_id>/generate-pdf', methods=['OPTIONS'])
def options_generate_pdf(result_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/results/<result_id>/generate-certificate', methods=['GET'])
@jwt_required()
@rate_limit_pdf(limit=5, window=60)
def generate_certificate_pdf(result_id):
    """
    Genera el certificado PDF usando la plantilla (módulo compartido).
    Solo disponible para resultados aprobados.
    """
    from flask import send_file, current_app
    from app.utils.pdf_generator import generate_certificate_pdf as _gen_cert
    import re
    import time
    
    start_time = time.time()
    
    try:
        from app.models.result import Result
        from app.models.exam import Exam
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        result = Result.query.filter_by(id=result_id, user_id=str(user_id)).first()
        if not result:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        exam = Exam.query.get(result.exam_id)
        if not exam:
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        if result.score < exam.passing_score:
            return jsonify({'error': 'Solo se pueden generar certificados para exámenes aprobados'}), 400
        
        buffer_final = _gen_cert(result, exam, user)
        
        def strip_html(text):
            if not text:
                return ''
            return re.sub(r'<[^>]+>', '', str(text))
        
        exam_short = strip_html(exam.name)[:30] if exam.name else 'Certificado'
        filename = f"Certificado_{exam_short.replace(' ', '_')}.pdf"
        
        elapsed_time = time.time() - start_time
        pdf_size = buffer_final.getbuffer().nbytes
        current_app.logger.info(f'✅ [CERTIFICADO] Generado: {filename} - {pdf_size/1024:.2f} KB - {elapsed_time*1000:.0f} ms')
        
        return send_file(
            buffer_final,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        import traceback
        current_app.logger.error(f"❌ [CERTIFICADO] Error generando certificado: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Error al generar el certificado',
            'message': str(e)
        }), 500


@bp.route('/results/<result_id>/generate-certificate', methods=['OPTIONS'])
def options_generate_certificate(result_id):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response


@bp.route('/results/<result_id>/debug-data', methods=['GET'])
def debug_result_data(result_id):
    """
    Endpoint de debug para ver los datos de un resultado (temporal sin auth)
    """
    try:
        from app.models.result import Result
        
        # Buscar sin filtrar por user_id para debug
        result = Result.query.filter_by(id=result_id).first()
        
        if not result:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        answers_data_raw = result.answers_data
        if isinstance(answers_data_raw, str):
            try:
                answers_data = json.loads(answers_data_raw)
            except:
                answers_data = {}
        else:
            answers_data = answers_data_raw or {}
        
        # Buscar evaluation_breakdown
        category_results = {}
        if isinstance(answers_data, dict):
            category_results = answers_data.get('evaluation_breakdown', {})
            if not category_results:
                summary = answers_data.get('summary', {})
                if isinstance(summary, dict):
                    category_results = summary.get('evaluation_breakdown', {})
        
        return jsonify({
            'result_id': result_id,
            'score': result.score,
            'answers_data_type': str(type(answers_data)),
            'answers_data_keys': list(answers_data.keys()) if isinstance(answers_data, dict) else None,
            'evaluation_breakdown': category_results,
            'summary_in_answers_data': answers_data.get('summary', {}) if isinstance(answers_data, dict) else None
        }), 200
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


# ============= GENERACIÓN ASÍNCRONA DE PDFs =============

@bp.route('/results/<result_id>/request-pdf', methods=['POST'])
@jwt_required()
@rate_limit_pdf(limit=5, window=60)
def request_pdf_generation(result_id):
    """
    Solicita la generación asíncrona de un PDF.
    El PDF se genera en segundo plano y se almacena en Azure Blob Storage.
    
    Body opcional:
    {
        "type": "evaluation_report" | "certificate"
    }
    """
    from app.models.result import Result
    from app.utils.queue_utils import queue_pdf_generation, is_async_pdf_enabled
    
    user_id = get_jwt_identity()
    
    try:
        # Verificar que el resultado pertenece al usuario
        result = Result.query.filter_by(id=result_id, user_id=user_id).first()
        
        if not result:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        # Obtener tipo de PDF
        data = request.get_json() or {}
        pdf_type = data.get('type', 'evaluation_report')
        
        if pdf_type not in ['evaluation_report', 'certificate']:
            return jsonify({'error': 'Tipo de PDF inválido'}), 400
        
        # Verificar si la generación async está habilitada
        if not is_async_pdf_enabled():
            # Fallback: redirigir a la generación síncrona
            return jsonify({
                'message': 'Async PDF generation not enabled',
                'fallback_url': f'/api/exams/results/{result_id}/generate-pdf' if pdf_type == 'evaluation_report' 
                               else f'/api/exams/results/{result_id}/generate-certificate',
                'status': 'sync'
            }), 200
        
        # Verificar si ya existe el PDF
        if pdf_type == 'evaluation_report' and result.report_url:
            return jsonify({
                'status': 'completed',
                'url': result.report_url
            }), 200
        
        if pdf_type == 'certificate' and result.certificate_url:
            return jsonify({
                'status': 'completed',
                'url': result.certificate_url
            }), 200
        
        # Marcar como procesando
        if hasattr(result, 'pdf_status'):
            result.pdf_status = 'processing'
            db.session.commit()
        
        # Encolar la generación
        queued = queue_pdf_generation(
            result_id=str(result_id),
            user_id=str(user_id),
            pdf_type=pdf_type
        )
        
        if queued:
            return jsonify({
                'status': 'queued',
                'message': 'PDF generation queued. Check status with GET /results/<id>/pdf-status',
                'result_id': result_id
            }), 202  # Accepted
        else:
            return jsonify({
                'error': 'Failed to queue PDF generation',
                'fallback_url': f'/api/exams/results/{result_id}/generate-pdf'
            }), 500
            
    except HTTPException:
            
        raise
            
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@bp.route('/results/<result_id>/pdf-status', methods=['GET'])
@jwt_required()
def get_pdf_status(result_id):
    """
    Verifica el estado de la generación del PDF.
    
    Retorna:
    - pending: En cola, esperando procesamiento
    - processing: Generándose
    - completed: Listo, incluye URL
    - error: Error en la generación
    """
    from app.models.result import Result
    
    user_id = get_jwt_identity()
    
    try:
        result = Result.query.filter_by(id=result_id, user_id=user_id).first()
        
        if not result:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        response = {
            'result_id': result_id,
            'report_url': result.report_url if hasattr(result, 'report_url') else None,
            'certificate_url': result.certificate_url if hasattr(result, 'certificate_url') else None,
            'status': getattr(result, 'pdf_status', 'unknown')
        }
        
        # Determinar estado basado en URLs disponibles
        if result.report_url or result.certificate_url:
            response['status'] = 'completed'
        
        return jsonify(response), 200
        
    except HTTPException:
        
        raise
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/results/<result_id>/request-pdf', methods=['OPTIONS'])
@bp.route('/results/<result_id>/pdf-status', methods=['OPTIONS'])
def options_pdf_async(result_id):
    """Maneja CORS para endpoints async de PDF"""
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
    return response