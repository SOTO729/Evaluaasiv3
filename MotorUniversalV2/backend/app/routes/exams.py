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
    responses:
      200:
        description: Lista de exámenes
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    is_published = request.args.get('is_published', type=bool)
    
    query = Exam.query
    
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
    
    if len(categories) > 5:
        return jsonify({'error': 'Máximo 5 módulos permitidos'}), 400
    
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
        'duration_minutes', 'passing_score', 'is_active', 'is_published'
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
    from app.utils.azure_storage import AzureStorageService
    
    print(f"\n=== ELIMINAR EJERCICIO ===")
    print(f"Exercise ID: {exercise_id}")
    
    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        print(f"ERROR: Ejercicio {exercise_id} no encontrado")
        return jsonify({'error': 'Ejercicio no encontrado'}), 404
    
    # Obtener todos los pasos para eliminar sus imágenes
    steps = exercise.steps.all()
    print(f"Ejercicio tiene {len(steps)} pasos")
    
    # Eliminar imágenes de blob storage
    storage = AzureStorageService()
    images_deleted = 0
    images_failed = 0
    
    for step in steps:
        if step.image_url:
            print(f"Eliminando imagen del paso {step.step_number}: {step.image_url}")
            try:
                if storage.delete_file(step.image_url):
                    images_deleted += 1
                    print(f"  ✓ Imagen eliminada")
                else:
                    images_failed += 1
                    print(f"  ✗ No se pudo eliminar imagen")
            except Exception as e:
                images_failed += 1
                print(f"  ✗ Error al eliminar imagen: {str(e)}")
    
    # Contar acciones antes de eliminar
    total_actions = sum(step.actions.count() for step in steps)
    print(f"Ejercicio tiene {total_actions} acciones en total")
    
    # Eliminar ejercicio (cascade eliminará pasos y acciones automáticamente)
    db.session.delete(exercise)
    db.session.commit()
    
    print(f"✓ Ejercicio eliminado de la base de datos")
    print(f"✓ {len(steps)} pasos eliminados (cascade)")
    print(f"✓ {total_actions} acciones eliminadas (cascade)")
    print(f"✓ {images_deleted} imágenes eliminadas del blob storage")
    if images_failed > 0:
        print(f"✗ {images_failed} imágenes no se pudieron eliminar")
    print(f"=== FIN ELIMINAR EJERCICIO ===")
    
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
        step.step_number = data['step_number']
    
    step.updated_at = datetime.utcnow()
    db.session.commit()
    
    print(f"✓ Paso actualizado exitosamente: ID={step_id}")
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
        is_case_sensitive=data.get('is_case_sensitive', False)
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
