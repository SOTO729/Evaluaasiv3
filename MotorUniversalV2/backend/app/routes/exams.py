"""
Rutas de exámenes
"""
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
    
    # Para alumnos, solo mostrar exámenes publicados
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user and user.role == 'alumno':
        query = query.filter_by(is_published=True)
    
    pagination = query.order_by(Exam.created_at.desc()).paginate(
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
    required_fields = ['name', 'version', 'stage_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} es requerido'}), 400
    
    # Validar código ECM (debe contener 'ECM' y tener exactamente 7 caracteres)
    version = data['version']
    if 'ECM' not in version:
        return jsonify({'error': 'El código debe contener "ECM"'}), 400
    
    if len(version) != 7:
        return jsonify({'error': 'El código debe tener exactamente 7 caracteres (incluyendo ECM)'}), 400
    
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
                                font_family=original_action.font_family
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
    
    questions = topic.questions.all()
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
    
    steps = exercise.steps.order_by(ExerciseStep.step_number).all()
    
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
        font_family=data.get('font_family', 'Arial')
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
        result['score'] = 1 if result['is_correct'] else 0
    
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
            
            action_result = {
                'action_id': action_id,
                'action_number': action.get('action_number'),
                'action_type': action.get('action_type'),
                'user_response': user_response,
                'is_correct': False,
                'score': 0,
                'correct_answer': action.get('correct_answer'),
                'explanation': None
            }
            
            result['max_score'] += 1
            
            if action.get('action_type') == 'button':
                # Para botones, verificar si fue clickeado (cualquier valor truthy)
                action_result['is_correct'] = bool(user_response)
                action_result['score'] = 1 if action_result['is_correct'] else 0
                
            elif action.get('action_type') == 'textbox':
                correct_answer = action.get('correct_answer', '')
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
        
        question_results = []
        exercise_results = []
        
        for item in items:
            if item.get('type') == 'question':
                question_id = str(item.get('question_id') or item.get('id'))
                user_answer = answers.get(question_id)
                
                # Obtener la pregunta de la BD con respuestas correctas
                question = Question.query.get(question_id)
                if question:
                    question_data = question.to_dict(include_answers=True, include_correct=True)
                    result = evaluate_question(question_data, user_answer)
                    question_results.append(result)
                    print(f"  Pregunta {question_id}: {'✓' if result['is_correct'] else '✗'}")
                else:
                    # Si no encontramos en BD, usar datos del item
                    item_with_answers = item.copy()
                    # Intentar obtener respuestas de la BD
                    answers_from_db = Answer.query.filter_by(question_id=question_id).all()
                    if answers_from_db:
                        item_with_answers['answers'] = [a.to_dict(include_correct=True) for a in answers_from_db]
                    result = evaluate_question(item_with_answers, user_answer)
                    question_results.append(result)
                    print(f"  Pregunta {question_id} (sin BD): {'✓' if result['is_correct'] else '✗'}")
            
            elif item.get('type') == 'exercise':
                exercise_id = str(item.get('exercise_id') or item.get('id'))
                ex_responses = exercise_responses.get(exercise_id, {})
                
                # Obtener ejercicio de la BD con pasos y acciones
                exercise = Exercise.query.get(exercise_id)
                if exercise:
                    exercise_data = exercise.to_dict(include_steps=True)
                else:
                    # Usar datos del item
                    exercise_data = item
                
                result = evaluate_exercise(exercise_data, ex_responses)
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
            'percentage': round(percentage, 1)
        }
        
        print(f"Resumen: {correct_questions}/{total_questions} preguntas, {correct_exercises}/{total_exercises} ejercicios, {percentage:.1f}%")
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
