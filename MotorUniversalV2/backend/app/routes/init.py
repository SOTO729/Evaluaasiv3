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
            QuestionType(name='fill_blank', description='Llenar el espacio'),
            QuestionType(name='multiple_select', description='Selección múltiple'),
            QuestionType(name='ordering', description='Ordenar elementos'),
            QuestionType(name='drag_drop', description='Arrastrar y Soltar'),
            QuestionType(name='column_grouping', description='Agrupamiento en Columnas'),
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
        
        coordinator = User(
            email='coordinador@evaluaasi.com',
            username='coordinador',
            name='Coordinador',
            first_surname='Prueba',
            second_surname='Sistema',
            curp='COPR000000HDFCOO01',
            role='coordinator',
            is_active=True,
            is_verified=True
        )
        coordinator.set_password('Coordinador123!')
        
        candidato = User(
            email='candidato@evaluaasi.com',
            username='candidato',
            name='Candidato',
            first_surname='Prueba',
            second_surname='Demo',
            curp='CAND000000HDFAAA02',
            role='candidato',
            is_active=True,
            is_verified=True
        )
        candidato.set_password('Candidato123!')
        
        db.session.add_all([admin, editor, coordinator, candidato])
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
            'users_created': 4,
            'exams_created': 1,
            'questions_created': 1,
            'credentials': {
                'admin': 'admin@evaluaasi.com / admin123',
                'editor': 'editor@evaluaasi.com / editor123',
                'coordinador': 'coordinador@evaluaasi.com / Coordinador123!',
                'candidato': 'candidato@evaluaasi.com / Candidato123!'
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@init_bp.route('/migrate-tables', methods=['POST'])
def migrate_tables():
    """
    Endpoint para crear tablas nuevas sin borrar las existentes
    """
    token = request.headers.get('X-Init-Token') or request.args.get('token')
    if token != INIT_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Crear todas las tablas que no existan
        db.create_all()
        
        return jsonify({
            'status': 'success',
            'message': 'Tablas creadas/actualizadas exitosamente'
        }), 200
    except Exception as e:
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


@init_bp.route('/recreate-study-tables', methods=['POST'])
def recreate_study_tables():
    """
    Elimina y recrea las tablas de study_content
    """
    token = request.headers.get('X-Init-Token') or request.args.get('token')
    if token != INIT_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        from app.models.study_content import (
            StudyMaterial, StudySession, StudyTopic,
            StudyReading, StudyVideo, StudyDownloadableExercise,
            StudyInteractiveExercise, StudyInteractiveExerciseStep,
            StudyInteractiveExerciseAction
        )
        
        # Lista de tablas en orden de eliminación (por dependencias)
        tables_to_drop = [
            'study_interactive_exercise_actions',
            'study_interactive_exercise_steps',
            'study_interactive_exercises',
            'study_downloadable_exercises',
            'study_videos',
            'study_readings',
            'study_topics',
            'study_sessions',
            'study_materials'
        ]
        
        # Eliminar tablas existentes
        for table_name in tables_to_drop:
            try:
                db.session.execute(db.text(f"DROP TABLE IF EXISTS {table_name}"))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                # Continuar si la tabla no existe
        
        # Crear todas las tablas
        db.create_all()
        
        return jsonify({
            'status': 'success',
            'message': 'Tablas de study_content recreadas exitosamente'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@init_bp.route('/add-performance-indexes', methods=['POST'])
def add_performance_indexes():
    """
    Añadir índices de rendimiento a la base de datos
    """
    from sqlalchemy import text
    
    # Verificar token
    token = request.headers.get('X-Init-Token') or request.args.get('token')
    if token != INIT_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Lista de índices a crear
        indexes = [
            # Study Contents - filtrado frecuente por is_published
            ('ix_study_contents_is_published', 'study_contents', 'is_published'),
            ('ix_study_contents_order', 'study_contents', '[order]'),
            # Study Sessions - FK material_id
            ('ix_study_sessions_material_id', 'study_sessions', 'material_id'),
            # Study Topics - FK session_id
            ('ix_study_topics_session_id', 'study_topics', 'session_id'),
            ('ix_study_topics_order', 'study_topics', '[order]'),
            # Study Readings - FK topic_id
            ('ix_study_readings_topic_id', 'study_readings', 'topic_id'),
            # Study Videos - FK topic_id
            ('ix_study_videos_topic_id', 'study_videos', 'topic_id'),
            # Study Downloadable Exercises - FK topic_id
            ('ix_study_downloadable_exercises_topic_id', 'study_downloadable_exercises', 'topic_id'),
            # Study Interactive Exercises - FK topic_id
            ('ix_study_interactive_exercises_topic_id', 'study_interactive_exercises', 'topic_id'),
            # Student Progress
            ('ix_student_content_progress_user_id', 'student_content_progress', 'user_id'),
            ('ix_student_progress_user_content', 'student_content_progress', 'user_id, content_type'),
            ('ix_student_content_progress_topic_id', 'student_content_progress', 'topic_id'),
            # Results
            ('ix_results_user_created', 'results', 'user_id, created_at DESC'),
            # Exams
            ('ix_exams_published_active', 'exams', 'is_published, is_active'),
            # Categories
            ('ix_categories_exam_order', 'categories', 'exam_id, category_number'),
            # Topics
            ('ix_topics_category_order', 'topics', 'category_id, topic_number'),
            # Questions
            ('ix_questions_topic_type', 'questions', 'topic_id, type'),
            # Exercise Steps
            ('ix_exercise_steps_exercise_order', 'exercise_steps', 'exercise_id, step_number'),
            # Vouchers
            ('ix_vouchers_user_id', 'vouchers', 'user_id'),
            ('ix_vouchers_exam_id', 'vouchers', 'exam_id'),
            # CONOCER Certificates
            ('ix_conocer_certificates_status', 'conocer_certificates', 'status'),
        ]
        
        created = []
        skipped = []
        errors = []
        
        for idx_name, table, columns in indexes:
            try:
                # Verificar si el índice ya existe
                check_sql = text(f"""
                    SELECT 1 FROM sys.indexes 
                    WHERE name = '{idx_name}' 
                    AND object_id = OBJECT_ID('{table}')
                """)
                result = db.session.execute(check_sql).fetchone()
                
                if result:
                    skipped.append(idx_name)
                    continue
                
                # Verificar si la tabla existe
                check_table = text(f"""
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = '{table}'
                """)
                table_exists = db.session.execute(check_table).fetchone()
                
                if not table_exists:
                    skipped.append(f"{idx_name} (tabla no existe)")
                    continue
                
                # Crear el índice
                create_sql = text(f"""
                    CREATE NONCLUSTERED INDEX {idx_name}
                    ON {table} ({columns})
                """)
                db.session.execute(create_sql)
                db.session.commit()
                created.append(idx_name)
                
            except Exception as e:
                error_msg = str(e)
                if 'already exists' in error_msg.lower():
                    skipped.append(idx_name)
                else:
                    errors.append(f"{idx_name}: {error_msg[:80]}")
                db.session.rollback()
        
        return jsonify({
            'status': 'success',
            'created': created,
            'skipped': skipped,
            'errors': errors,
            'summary': {
                'created': len(created),
                'skipped': len(skipped),
                'errors': len(errors)
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@init_bp.route('/create-group-exam-members', methods=['POST'])
def create_group_exam_members_table():
    """Endpoint temporal para crear la tabla group_exam_members"""
    from sqlalchemy import text
    
    token = request.headers.get('X-Init-Token') or request.args.get('token')
    if token != INIT_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Primero intentar eliminar la tabla si existe
        try:
            db.session.execute(text("DROP TABLE IF EXISTS group_exam_members"))
            db.session.commit()
        except Exception:
            db.session.rollback()
        
        # Crear la tabla - sin FK a users por incompatibilidad de tipos
        db.session.execute(text("""
            CREATE TABLE group_exam_members (
                id INT IDENTITY(1,1) PRIMARY KEY,
                group_exam_id INT NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                assigned_at DATETIME DEFAULT GETDATE() NOT NULL,
                CONSTRAINT fk_gem_group_exam_v3 FOREIGN KEY (group_exam_id) 
                    REFERENCES group_exams(id) ON DELETE CASCADE,
                CONSTRAINT uq_gem_group_exam_user_v3 UNIQUE (group_exam_id, user_id)
            )
        """))
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Tabla group_exam_members creada exitosamente'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@init_bp.route('/add-campus-website', methods=['POST'])
def add_campus_website_column():
    """Endpoint temporal para agregar columna website a campuses"""
    from sqlalchemy import text
    
    token = request.headers.get('X-Init-Token') or request.args.get('token')
    if token != INIT_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Verificar si la columna ya existe
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'campuses' AND COLUMN_NAME = 'website'
        """))
        exists = result.scalar() > 0
        
        if exists:
            return jsonify({
                'status': 'success',
                'message': 'La columna website ya existe'
            }), 200
        
        # Agregar la columna
        db.session.execute(text("""
            ALTER TABLE campuses ADD website NVARCHAR(500) NULL
        """))
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Columna website agregada exitosamente a la tabla campuses'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500