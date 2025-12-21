"""
Rutas temporales para inicialización
ELIMINAR DESPUÉS DE USAR EN PRODUCCIÓN
"""
from flask import Blueprint, jsonify, request
from app import db
from app.models.user import User
from app.models.exam import Exam
from app.models.category import Category
from app.models.topic import Topic
from app.models.question import Question, QuestionType
from app.models.answer import Answer
from datetime import datetime
import os

init_bp = Blueprint('init', __name__)

INIT_TOKEN = os.getenv('INIT_TOKEN', 'temp-init-token-12345')


@init_bp.route('/init-database', methods=['POST'])
def init_database():
    """
    Endpoint temporal para inicializar la base de datos
    ELIMINAR EN PRODUCCIÓN
    """
    # Verificar token
    token = request.headers.get('X-Init-Token') or request.args.get('token')
    if token != INIT_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Crear todas las tablas
        db.create_all()
        
        # Verificar si ya existen datos
        if User.query.first():
            return jsonify({
                'status': 'already_initialized',
                'message': 'La base de datos ya contiene datos'
            }), 200
        
        # Tipos de preguntas
        question_types = [
            QuestionType(name='multiple_choice', description='Opción múltiple'),
            QuestionType(name='true_false', description='Verdadero/Falso'),
            QuestionType(name='fill_blank', description='Llenar el espacio')
        ]
        
        for qt in question_types:
            db.session.add(qt)
        
        db.session.commit()
        
        # Usuarios de prueba
        admin = User(
            email='admin@evaluaasi.com',
            username='admin',
            name='Administrador',
            first_surname='Sistema',
            second_surname='Admin',
            curp='AAAA000000HDFAAA00',
            role='admin',
            is_active=True,
            is_verified=True
        )
        admin.set_password('admin123')
        
        editor = User(
            email='editor@evaluaasi.com',
            username='editor',
            name='Editor',
            first_surname='Prueba',
            second_surname='Editor',
            curp='EEEE000000HDFAAA01',
            role='editor',
            is_active=True,
            is_verified=True
        )
        editor.set_password('editor123')
        
        alumno = User(
            email='alumno@evaluaasi.com',
            username='alumno',
            name='Alumno',
            first_surname='Prueba',
            second_surname='Alumno',
            curp='AAAA000000HDFAAA02',
            role='alumno',
            is_active=True,
            is_verified=True
        )
        alumno.set_password('alumno123')
        
        db.session.add_all([admin, editor, alumno])
        db.session.commit()
        
        # Examen de prueba
        exam = Exam(
            name='Microsoft Office Specialist - Excel',
            version='2019',
            standard='MOS',
            stage_id=1,
            description='Examen de certificación Microsoft Office Specialist en Excel 2019',
            instructions='Lee cuidadosamente cada pregunta antes de responder.',
            duration_minutes=50,
            passing_score=70,
            is_published=True,
            created_by=admin.id
        )
        
        db.session.add(exam)
        db.session.commit()
        
        # Categoría
        category = Category(
            exam_id=exam.id,
            name='Gestión de hojas de cálculo',
            description='Gestión de hojas de cálculo y libros',
            percentage=30,
            order=1,
            created_by=admin.id
        )
        
        db.session.add(category)
        db.session.commit()
        
        # Tema
        topic = Topic(
            category_id=category.id,
            name='Modificar hojas y libros',
            description='Crear, modificar y gestionar hojas de cálculo',
            order=1,
            created_by=admin.id
        )
        
        db.session.add(topic)
        db.session.commit()
        
        # Pregunta de ejemplo
        question = Question(
            topic_id=topic.id,
            question_type_id=1,  # multiple_choice
            question_text='¿Cuál es la función para sumar un rango de celdas en Excel?',
            points=1,
            question_number=1,
            difficulty='easy',
            created_by=admin.id
        )
        
        db.session.add(question)
        db.session.commit()
        
        # Respuestas
        answers = [
            Answer(question_id=question.id, answer_text='=SUMA(A1:A10)', is_correct=True, answer_number=1, explanation='Correcto - SUMA es la función estándar de Excel', created_by=admin.id),
            Answer(question_id=question.id, answer_text='=SUMAR(A1:A10)', is_correct=False, answer_number=2, explanation='Incorrecto - esta función no existe en Excel', created_by=admin.id),
            Answer(question_id=question.id, answer_text='=ADD(A1:A10)', is_correct=False, answer_number=3, explanation='Incorrecto - ADD no es una función de Excel en español', created_by=admin.id),
            Answer(question_id=question.id, answer_text='=TOTAL(A1:A10)', is_correct=False, answer_number=4, explanation='Incorrecto - TOTAL no es una función estándar de Excel', created_by=admin.id),
        ]
        
        for answer in answers:
            db.session.add(answer)
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Base de datos inicializada correctamente',
            'users_created': 3,
            'exams_created': 1,
            'questions_created': 1,
            'credentials': {
                'admin': 'admin@evaluaasi.com / admin123',
                'editor': 'editor@evaluaasi.com / editor123',
                'alumno': 'alumno@evaluaasi.com / alumno123'
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@init_bp.route('/health-db', methods=['GET'])
def health_db():
    """Verificar estado de la base de datos"""
    try:
        user_count = User.query.count()
        exam_count = Exam.query.count()
        
        return jsonify({
            'status': 'healthy',
            'users': user_count,
            'exams': exam_count,
            'initialized': user_count > 0
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
