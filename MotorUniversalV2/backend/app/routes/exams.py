"""
Rutas de exámenes
"""
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.user import User
from app.models.exam import Exam
from app.models.category import Category
from app.models.topic import Topic
from app.models.question import Question, QuestionType
from app.models.answer import Answer
from app.models.exercise import Exercise, ExerciseStep, ExerciseAction

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


# Endpoint temporal para crear las tablas de ejercicios
@bp.route('/migrate-exercise-tables', methods=['POST', 'OPTIONS'])
def migrate_exercise_tables():
    """Crear tablas exercise_steps y exercise_actions si no existen"""
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
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


# Endpoint para arreglar answer_number NULL en respuestas de preguntas de ordenamiento
@bp.route('/fix-ordering-answers', methods=['POST', 'OPTIONS'])
def fix_ordering_answers():
    """Arreglar answer_number NULL en respuestas existentes"""
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
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('', methods=['GET'])
@jwt_required()
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
    
    # Actualizar campos permitidos
    updatable_fields = [
        'name', 'version', 'standard', 'description', 'instructions',
        'duration_minutes', 'passing_score', 'is_active', 'is_published', 'image_url'
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
    Eliminar examen
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
    exam = Exam.query.get(exam_id)
    
    if not exam:
        return jsonify({'error': 'Examen no encontrado'}), 404
    
    db.session.delete(exam)
    db.session.commit()
    
    return jsonify({'message': 'Examen eliminado exitosamente'}), 200


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
    """Eliminar categoría"""
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
    
    db.session.delete(category)
    db.session.commit()
    
    return jsonify({
        'message': 'Categoría eliminada exitosamente'
    }), 200


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
    
    if 'name' in data:
        topic.name = data['name']
    if 'description' in data:
        topic.description = data.get('description')
    if 'order' in data:
        topic.order = data['order']
    
    topic.updated_by = user_id
    
    db.session.commit()
    
    return jsonify({
        'message': 'Tema actualizado exitosamente',
        'topic': topic.to_dict()
    }), 200


@bp.route('/topics/<int:topic_id>', methods=['DELETE'])
@jwt_required()
@require_permission('exams:delete')
def delete_topic(topic_id):
    """Eliminar tema y todo su contenido"""
    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Tema no encontrado'}), 404
    
    try:
        db.session.delete(topic)
        db.session.commit()
        
        return jsonify({
            'message': 'Tema eliminado exitosamente'
        }), 200
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
    if user and user.role not in ['admin', 'editor']:
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
    """Eliminar pregunta"""
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Pregunta no encontrada'}), 404
    
    db.session.delete(question)
    db.session.commit()
    
    return jsonify({'message': 'Pregunta eliminada exitosamente'}), 200


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
            created_by=user_id
        )
        
        db.session.add(answer)
        db.session.commit()
        
        return jsonify({
            'message': 'Respuesta creada exitosamente',
            'answer': answer.to_dict(include_correct=True)
        }), 201
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
                except Exception as e:
                    images_failed += 1
                    log(f"    ✗ Error al eliminar imagen: {str(e)}")
    
    # Contar acciones antes de eliminar
    total_actions = sum(step.actions.count() for step in steps)
    log(f"\n📊 Ejercicio tiene {total_actions} acciones en total")
    
    # Eliminar ejercicio (cascade eliminará pasos y acciones automáticamente)
    log(f"\n🗑️  ELIMINANDO EJERCICIO DE LA BASE DE DATOS...")
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
    Eliminar un paso y su imagen del blob storage
    """
    from app.utils.azure_storage import AzureStorageService
    
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
        except Exception as e:
            print(f"Error al eliminar imagen del blob: {str(e)}")
    
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
    """
    from datetime import datetime
    from app.utils.azure_storage import azure_storage
    
    step = ExerciseStep.query.get(step_id)
    if not step:
        return jsonify({'error': 'Paso no encontrado'}), 404
    
    data = request.get_json()
    
    if 'image_data' not in data:
        return jsonify({'error': 'Se requiere image_data (base64)'}), 400
    
    image_data = data['image_data']
    
    # Subir a Azure Blob Storage si es base64
    if image_data.startswith('data:image'):
        blob_url = azure_storage.upload_base64_image(image_data, folder='exercise-steps')
        if blob_url:
            image_data = blob_url
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
                
                # 4. Verificar cada tema
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
                    
                    # 5. Verificar preguntas
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
                    
                    # 6. Verificar ejercicios
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
                
                # Obtener la pregunta de la BD con respuestas correctas
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
        
        question_score = sum(r['score'] for r in question_results) if question_results else 0
        exercise_score = sum(r['total_score'] for r in exercise_results) if exercise_results else 0
        max_exercise_score = sum(r['max_score'] for r in exercise_results) if exercise_results else 0
        
        total_points = total_questions + max_exercise_score
        earned_points = question_score + exercise_score
        
        percentage = (earned_points / total_points * 100) if total_points > 0 else 0
        
        # Calcular desglose por categoría y tema
        evaluation_breakdown = {}
        
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
        
        # Calcular porcentajes
        for cat_name, cat_data in evaluation_breakdown.items():
            if cat_data['max'] > 0:
                cat_data['percentage'] = round((cat_data['earned'] / cat_data['max']) * 100, 1)
            for topic_name, topic_data in cat_data['topics'].items():
                if topic_data['max'] > 0:
                    topic_data['percentage'] = round((topic_data['earned'] / topic_data['max']) * 100, 1)
        
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
            score=int(round(percentage)),
            status=status,
            result=result_value,
            duration_seconds=duration_seconds,
            answers_data=answers_data,
            questions_order=questions_order
        )
        
        # Generar código de certificado con formato ZC + 10 caracteres alfanuméricos
        import string
        import random
        chars = string.ascii_uppercase + string.digits
        random_part = ''.join(random.choices(chars, k=10))
        result.certificate_code = f"ZC{random_part}"
        
        result.end_date = db.func.now()
        
        db.session.add(result)
        db.session.commit()
        
        print(f"✅ Resultado guardado: id={result.id}, score={score}, percentage={percentage}, aprobado={result_value == 1}")
        print(f"=== FIN GUARDAR RESULTADO ===\n")
        
        return jsonify({
            'message': 'Resultado guardado exitosamente',
            'result': result.to_dict(),
            'is_approved': result_value == 1
        }), 201
        
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
        
        print(f"✅ Reporte PDF guardado: {report_url}")
        print(f"=== FIN SUBIR REPORTE ===\n")
        
        return jsonify({
            'message': 'Reporte subido exitosamente',
            'report_url': report_url
        }), 200
        
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
def generate_result_pdf(result_id):
    """
    Genera el PDF del reporte de evaluación en el backend
    """
    from flask import send_file
    from io import BytesIO
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.pdfgen import canvas
    from datetime import datetime
    import re
    
    try:
        from app.models.result import Result
        from app.models.exam import Exam
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Obtener resultado
        result = Result.query.filter_by(id=result_id, user_id=str(user_id)).first()
        if not result:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        # Obtener examen
        exam = Exam.query.get(result.exam_id)
        if not exam:
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        # Crear PDF en memoria
        buffer = BytesIO()
        
        # Configuración de página
        page_width, page_height = letter
        margin = 50
        
        c = canvas.Canvas(buffer, pagesize=letter)
        
        # Colores
        primary_color = colors.HexColor('#1e40af')
        success_color = colors.HexColor('#16a34a')
        error_color = colors.HexColor('#dc2626')
        gray_color = colors.HexColor('#6b7280')
        light_gray = colors.HexColor('#e5e7eb')
        
        # Función para limpiar HTML
        def strip_html(text):
            if not text:
                return ''
            return re.sub(r'<[^>]+>', '', str(text))
        
        y = page_height - margin
        
        # === ENCABEZADO CON LOGO ===
        # Cargar logo
        import os
        logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'logo.png')
        logo_height = 40
        if os.path.exists(logo_path):
            try:
                from reportlab.lib.utils import ImageReader
                logo = ImageReader(logo_path)
                # Logo de 40x40 en la esquina superior izquierda
                c.drawImage(logo, margin, y - 30, width=40, height=logo_height, preserveAspectRatio=True, mask='auto')
                # Texto "Evaluaasi" en negro, pegado al logo
                c.setFillColor(colors.black)
                c.setFont('Helvetica-Bold', 16)
                c.drawString(margin + 42, y - 15, 'Evaluaasi')  # Pegado al logo
            except Exception as e:
                print(f"Error cargando logo: {e}")
                c.setFillColor(colors.black)
                c.setFont('Helvetica-Bold', 16)
                c.drawString(margin, y, 'Evaluaasi')
        else:
            c.setFillColor(colors.black)
            c.setFont('Helvetica-Bold', 16)
            c.drawString(margin, y, 'Evaluaasi')
        
        # Esquina superior derecha - ajustado para que quepa
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
        # Construir nombre completo usando los campos correctos del modelo
        name_parts = [user.name or '']
        if user.first_surname:
            name_parts.append(user.first_surname)
        if user.second_surname:
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
        
        # Código ECM del examen
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
        
        # === OBTENER DATOS DE ANSWERS_DATA PARA PORCENTAJE REAL ===
        answers_data_raw = result.answers_data
        if isinstance(answers_data_raw, str):
            try:
                answers_data = json.loads(answers_data_raw)
            except:
                answers_data = {}
        else:
            answers_data = answers_data_raw or {}
        
        # Obtener porcentaje real del summary (con decimales)
        real_percentage = result.score or 0  # Fallback al score entero
        if isinstance(answers_data, dict):
            summary = answers_data.get('summary', {})
            if isinstance(summary, dict) and 'percentage' in summary:
                real_percentage = summary.get('percentage', real_percentage)
        
        # Redondear a 1 decimal
        real_percentage = round(float(real_percentage), 1)
        # Calcular puntaje sobre 1000
        score_1000 = round(real_percentage * 10)
        
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
        
        # Calificación (porcentaje con decimal)
        passing_score = exam.passing_score or 70
        is_passed = result.result == 1
        
        c.setFillColor(colors.black)
        c.setFont('Helvetica-Bold', 9)
        c.drawString(margin + 10, y - 15, 'Calificación:')
        c.setFont('Helvetica-Bold', 18)
        # Mostrar con decimal solo si es necesario
        if real_percentage == int(real_percentage):
            c.drawString(margin + 70, y - 18, f'{int(real_percentage)}%')
        else:
            c.drawString(margin + 70, y - 18, f'{real_percentage}%')
        
        # Puntaje (puntos sobre 1000) - alineado
        puntaje_x = page_width / 2 + 10
        c.setFont('Helvetica-Bold', 9)
        c.drawString(puntaje_x, y - 15, 'Puntaje:')
        c.setFont('Helvetica-Bold', 14)
        c.drawString(puntaje_x + 80, y - 17, f'{score_1000}')
        c.setFont('Helvetica', 10)
        c.drawString(puntaje_x + 115, y - 17, '/ 1000 puntos')
        
        # Resultado y puntaje mínimo - alineado
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
        # (answers_data ya fue parseado arriba)
        
        # DEBUG: Mostrar estructura de answers_data
        print(f"📋 PDF - answers_data keys: {list(answers_data.keys()) if isinstance(answers_data, dict) else 'No es dict'}")
        
        # Buscar evaluation_breakdown - PRIORIZAR el de summary que tiene earned/max/percentage correctos
        category_results = {}
        if isinstance(answers_data, dict):
            # Primero buscar en summary (tiene los datos correctos con earned/max)
            summary = answers_data.get('summary', {})
            if isinstance(summary, dict):
                category_results = summary.get('evaluation_breakdown', {})
            
            # Solo si no hay en summary, usar el de nivel raíz (fallback)
            if not category_results:
                category_results = answers_data.get('evaluation_breakdown', {})
        
        # DEBUG: Mostrar estructura de category_results  
        print(f"📋 PDF - evaluation_breakdown: {category_results}")
        for cat_name, cat_data in category_results.items():
            print(f"📋 PDF - Categoría '{cat_name}': {cat_data}")
        
        if category_results:
            c.setStrokeColor(primary_color)
            c.setLineWidth(0.5)
            c.line(margin, y, page_width - margin, y)
            y -= 15
            
            # Encabezado de tabla
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
                
                # Verificar si necesitamos nueva página
                if y < 100:
                    c.showPage()
                    y = page_height - margin
                
                # Porcentaje de categoría - usar el porcentaje pre-calculado si existe
                # Verificar que sea un número válido, no solo None
                cat_percentage = cat_data.get('percentage')
                print(f"📋 PDF - cat '{cat_name}' percentage raw: {cat_percentage} (type: {type(cat_percentage)})")
                
                # Si no hay percentage o es None/0, calcularlo de earned/max o correct/total
                if cat_percentage is None or (isinstance(cat_percentage, (int, float)) and cat_percentage == 0):
                    earned = cat_data.get('earned')
                    max_score = cat_data.get('max')
                    
                    # Si no hay earned/max, usar correct/total como fallback
                    if earned is None:
                        earned = cat_data.get('correct', 0)
                    if max_score is None:
                        max_score = cat_data.get('total', 0)
                    
                    print(f"📋 PDF - cat '{cat_name}' calculando: earned={earned}, max={max_score}")
                    
                    if max_score and max_score > 0:
                        cat_percentage = round((float(earned) / float(max_score)) * 100, 1)
                    else:
                        cat_percentage = 0
                
                # Asegurar que sea un número
                try:
                    cat_percentage = float(cat_percentage)
                except (TypeError, ValueError):
                    cat_percentage = 0
                
                print(f"📋 PDF - cat '{cat_name}' percentage final: {cat_percentage}")
                
                # Formatear porcentaje (mostrar decimal solo si es necesario)
                if cat_percentage == int(cat_percentage):
                    cat_percentage_str = f'{int(cat_percentage)}%'
                else:
                    cat_percentage_str = f'{cat_percentage}%'
                
                # Nombre de categoría
                c.setFillColor(colors.black)
                c.setFont('Helvetica-Bold', 9)
                display_name = strip_html(cat_name).upper()[:40]
                c.drawString(margin + 5, y, f'{cat_index}. {display_name}')
                c.drawRightString(page_width - margin - 10, y, cat_percentage_str)
                y -= 12
                
                # Topics
                topics = cat_data.get('topics', {})
                topic_index = 0
                for topic_name, topic_data in topics.items():
                    topic_index += 1
                    
                    if y < 80:
                        c.showPage()
                        y = page_height - margin
                    
                    # Porcentaje del tema - usar el porcentaje pre-calculado si existe
                    topic_percentage = topic_data.get('percentage')
                    print(f"📋 PDF - topic '{topic_name}' percentage raw: {topic_percentage}")
                    
                    # Si no hay percentage o es None/0, calcularlo
                    if topic_percentage is None or (isinstance(topic_percentage, (int, float)) and topic_percentage == 0):
                        earned = topic_data.get('earned')
                        max_score = topic_data.get('max')
                        
                        if earned is None:
                            earned = topic_data.get('correct', 0)
                        if max_score is None:
                            max_score = topic_data.get('total', 0)
                        
                        print(f"📋 PDF - topic '{topic_name}' calculando: earned={earned}, max={max_score}")
                        
                        if max_score and max_score > 0:
                            topic_percentage = round((float(earned) / float(max_score)) * 100, 1)
                        else:
                            topic_percentage = 0
                    
                    # Asegurar que sea un número
                    try:
                        topic_percentage = float(topic_percentage)
                    except (TypeError, ValueError):
                        topic_percentage = 0
                    
                    print(f"📋 PDF - topic '{topic_name}' percentage final: {topic_percentage}")
                    
                    # Formatear porcentaje (mostrar decimal solo si es necesario)
                    if topic_percentage == int(topic_percentage):
                        topic_percentage_str = f'{int(topic_percentage)}%'
                    else:
                        topic_percentage_str = f'{topic_percentage}%'
                    
                    c.setFillColor(gray_color)
                    c.setFont('Helvetica', 8)
                    topic_display = strip_html(topic_name)[:35]
                    c.drawString(margin + 20, y, f'{cat_index}.{topic_index} {topic_display}')
                    c.drawRightString(page_width - margin - 10, y, topic_percentage_str)
                    y -= 10
                
                # Línea separadora
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
            # Mostrar con decimal solo si es necesario
            if real_percentage == int(real_percentage):
                c.drawRightString(page_width - margin - 10, y, f'{int(real_percentage)}%')
            else:
                c.drawRightString(page_width - margin - 10, y, f'{real_percentage}%')
            y -= 8
            
            c.setLineWidth(0.5)
            c.line(margin, y, page_width - margin, y)
            y -= 15
        
        # === PIE DE PÁGINA ===
        y = 50
        c.setStrokeColor(primary_color)
        c.setLineWidth(0.3)
        c.line(margin, y, page_width - margin, y)
        y -= 10
        
        c.setFillColor(primary_color)
        c.setFont('Helvetica', 7)
        c.drawCentredString(page_width / 2, y, 'Este documento es un reporte oficial de evaluación generado por el sistema Evaluaasi.')
        y -= 8
        c.setFillColor(gray_color)
        c.drawCentredString(page_width / 2, y, f'ID de resultado: {result.id}')
        
        c.save()
        
        # Preparar respuesta
        buffer.seek(0)
        
        # Nombre del archivo
        exam_short = strip_html(exam.name)[:20] if exam.name else 'Examen'
        filename = f"Reporte_Evaluacion_{exam_short.replace(' ', '_')}.pdf"
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        import traceback
        print(f"ERROR generando PDF: {str(e)}")
        print(traceback.format_exc())
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
def generate_certificate_pdf(result_id):
    """
    Genera el certificado PDF usando la plantilla
    Solo disponible para resultados aprobados
    """
    from flask import send_file
    from io import BytesIO
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import HexColor
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from pypdf import PdfReader, PdfWriter
    import os
    
    try:
        from app.models.result import Result
        from app.models.exam import Exam
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Obtener resultado
        result = Result.query.filter_by(id=result_id, user_id=str(user_id)).first()
        if not result:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        # Verificar que el resultado sea aprobado
        exam = Exam.query.get(result.exam_id)
        if not exam:
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        if result.score < exam.passing_score:
            return jsonify({'error': 'Solo se pueden generar certificados para exámenes aprobados'}), 400
        
        # Cargar plantilla PDF
        template_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'plantilla.pdf')
        if not os.path.exists(template_path):
            return jsonify({'error': 'Plantilla de certificado no encontrada'}), 500
        
        reader = PdfReader(template_path)
        page = reader.pages[0]
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        
        # Crear overlay con el texto
        buffer_overlay = BytesIO()
        c = canvas.Canvas(buffer_overlay, pagesize=(width, height))
        
        c.setFillColor(HexColor('#1a365d'))
        
        # Configuración del área compartida para nombre y certificado
        x_min = 85
        x_max = 540
        max_width = x_max - x_min
        center_x = (x_min + x_max) / 2
        
        # Función para ajustar tamaño de fuente
        def draw_fitted_text(canv, text, cx, y, mw, font_name, max_font_size, min_font_size=8):
            font_size = max_font_size
            while font_size >= min_font_size:
                text_width = stringWidth(text, font_name, font_size)
                if text_width <= mw:
                    canv.setFont(font_name, font_size)
                    canv.drawCentredString(cx, y, text)
                    return font_size
                font_size -= 1
            canv.setFont(font_name, min_font_size)
            canv.drawCentredString(cx, y, text)
            return min_font_size
        
        # Construir nombre completo del usuario (Title Case)
        name_parts = [user.name or '']
        if user.first_surname:
            name_parts.append(user.first_surname)
        if user.second_surname:
            name_parts.append(user.second_surname)
        student_name = ' '.join(name_parts).strip() or user.email
        # Convertir a Title Case
        student_name = student_name.title()
        
        # NOMBRE en (center_x, 375), max 36pt
        draw_fitted_text(c, student_name, center_x, 375, max_width, 'Helvetica-Bold', 36)
        
        # Construir nombre del certificado (MAYÚSCULAS)
        # Usar solo el nombre del examen (sin código ECM)
        if exam.name:
            cert_name = exam.name.upper()
        else:
            cert_name = "CERTIFICADO DE COMPETENCIA"
        
        # CERTIFICADO en (center_x, 300), max 18pt
        draw_fitted_text(c, cert_name, center_x, 300, max_width, 'Helvetica-Bold', 18)
        
        c.save()
        
        # Combinar plantilla con overlay
        buffer_overlay.seek(0)
        overlay = PdfReader(buffer_overlay)
        
        # Recargar plantilla para combinar
        reader2 = PdfReader(template_path)
        page2 = reader2.pages[0]
        page2.merge_page(overlay.pages[0])
        
        writer = PdfWriter()
        writer.add_page(page2)
        
        # Escribir PDF final a buffer
        buffer_final = BytesIO()
        writer.write(buffer_final)
        buffer_final.seek(0)
        
        # Generar nombre del archivo
        import re
        def strip_html(text):
            if not text:
                return ''
            return re.sub(r'<[^>]+>', '', str(text))
        
        exam_short = strip_html(exam.name)[:30] if exam.name else 'Certificado'
        filename = f"Certificado_{exam_short.replace(' ', '_')}.pdf"
        
        return send_file(
            buffer_final,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        import traceback
        print(f"ERROR generando certificado: {str(e)}")
        print(traceback.format_exc())
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
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500