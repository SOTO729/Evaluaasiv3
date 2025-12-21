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
from app.models.exercise import Exercise

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
    Eliminar un ejercicio
    """
    exercise = Exercise.query.get(exercise_id)
    if not exercise:
        return jsonify({'error': 'Ejercicio no encontrado'}), 404
    
    db.session.delete(exercise)
    db.session.commit()
    
    return jsonify({'message': 'Ejercicio eliminado exitosamente'}), 200


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
