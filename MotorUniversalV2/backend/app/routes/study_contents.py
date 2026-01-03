"""
Rutas de Contenidos de Estudio
Estructura: Material de Estudio → Sesiones → Temas → (4 elementos)
"""
import uuid
import os
from functools import wraps
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from app import db
from app.models.user import User
from app.models.study_content import (
    StudyMaterial,
    StudySession,
    StudyTopic,
    StudyReading,
    StudyVideo,
    StudyDownloadableExercise,
    StudyInteractiveExercise,
    StudyInteractiveExerciseStep,
    StudyInteractiveExerciseAction,
    study_material_exams
)
from app.models.exam import Exam
from app.models.student_progress import StudentContentProgress, StudentTopicProgress
from app.utils.azure_storage import azure_storage

study_contents_bp = Blueprint('study_contents', __name__)


def admin_or_editor_required(fn):
    """Decorador para verificar que el usuario sea admin o editor"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user or user.role not in ['admin', 'editor']:
            return jsonify({'error': 'Permiso denegado'}), 403
        
        return fn(*args, **kwargs)
    return wrapper


def get_current_user():
    """Obtener el usuario actual"""
    user_id = get_jwt_identity()
    return User.query.get(user_id)


def ensure_study_material_exams_table():
    """Asegurar que la tabla study_material_exams existe"""
    try:
        # Verificar si la tabla existe
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'study_material_exams'
        """))
        exists = result.scalar() > 0
        
        if not exists:
            # Crear la tabla si no existe
            db.session.execute(text("""
                CREATE TABLE study_material_exams (
                    study_material_id INT NOT NULL,
                    exam_id INT NOT NULL,
                    created_at DATETIME DEFAULT GETDATE(),
                    PRIMARY KEY (study_material_id, exam_id),
                    FOREIGN KEY (study_material_id) REFERENCES study_contents(id) ON DELETE CASCADE,
                    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
                )
            """))
            db.session.commit()
            print("✅ Tabla study_material_exams creada exitosamente")
            return True
        return False
    except Exception as e:
        print(f"Error verificando/creando tabla: {e}")
        db.session.rollback()
        return False


# Endpoint para crear la tabla manualmente (solo admin)
@study_contents_bp.route('/migrate-exams-table', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def migrate_exams_table():
    """Crear la tabla study_material_exams si no existe"""
    try:
        created = ensure_study_material_exams_table()
        if created:
            return jsonify({'message': 'Tabla study_material_exams creada exitosamente'}), 201
        else:
            return jsonify({'message': 'La tabla ya existe o hubo un error'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint público temporal para crear la tabla (ELIMINAR DESPUÉS DE USAR)
@study_contents_bp.route('/setup-exams-table', methods=['GET'])
def setup_exams_table_public():
    """Crear la tabla study_material_exams - endpoint público temporal"""
    try:
        created = ensure_study_material_exams_table()
        if created:
            return jsonify({'message': 'Tabla study_material_exams creada exitosamente', 'created': True}), 201
        else:
            return jsonify({'message': 'La tabla ya existe', 'created': False}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint público para listar materiales (solo IDs y títulos) - diagnóstico
@study_contents_bp.route('/list-materials', methods=['GET'])
def list_materials_public():
    """Listar todos los materiales - endpoint público de diagnóstico"""
    try:
        materials = StudyMaterial.query.all()
        return jsonify([{'id': m.id, 'title': m.title, 'exam_ids': m.to_dict().get('exam_ids', [])} for m in materials]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint público de diagnóstico para verificar relaciones de exámenes
@study_contents_bp.route('/debug-exams/<int:material_id>', methods=['GET'])
def debug_material_exams(material_id):
    """Verificar las relaciones de exámenes de un material - endpoint público de diagnóstico"""
    try:
        material = StudyMaterial.query.get_or_404(material_id)
        
        # Verificar directamente en la tabla de relación
        direct_query = db.session.execute(text("""
            SELECT sme.exam_id, e.title as exam_title
            FROM study_material_exams sme
            JOIN exams e ON sme.exam_id = e.id
            WHERE sme.study_material_id = :material_id
        """), {'material_id': material_id})
        direct_exams = [{'exam_id': row[0], 'exam_title': row[1]} for row in direct_query.fetchall()]
        
        # Verificar a través de SQLAlchemy
        orm_exams = []
        try:
            orm_exams = [{'id': e.id, 'title': e.title} for e in material.exams]
        except Exception as orm_error:
            orm_exams = f"Error: {str(orm_error)}"
        
        return jsonify({
            'material_id': material_id,
            'material_title': material.title,
            'exam_id_legacy': material.exam_id,
            'direct_query_exams': direct_exams,
            'orm_exams': orm_exams,
            'linked_exams_from_to_dict': material.to_dict().get('linked_exams', [])
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint público temporal para crear tablas de sesiones y temas
@study_contents_bp.route('/setup-sessions-tables', methods=['GET'])
def setup_sessions_tables_public():
    """Crear las tablas study_sessions y study_topics - endpoint público temporal"""
    try:
        results = []
        
        # Verificar y crear tabla study_sessions
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'study_sessions'
        """))
        sessions_exists = result.scalar() > 0
        
        if not sessions_exists:
            db.session.execute(text("""
                CREATE TABLE study_sessions (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    material_id INT NOT NULL,
                    session_number INT NOT NULL,
                    title NVARCHAR(255) NOT NULL,
                    description NVARCHAR(MAX),
                    created_at DATETIME DEFAULT GETDATE() NOT NULL,
                    updated_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (material_id) REFERENCES study_contents(id) ON DELETE CASCADE
                )
            """))
            db.session.commit()
            results.append('study_sessions creada')
        else:
            results.append('study_sessions ya existe')
        
        # Verificar y crear tabla study_topics
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'study_topics'
        """))
        topics_exists = result.scalar() > 0
        
        if not topics_exists:
            db.session.execute(text("""
                CREATE TABLE study_topics (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    session_id INT NOT NULL,
                    title NVARCHAR(255) NOT NULL,
                    description NVARCHAR(MAX),
                    [order] INT DEFAULT 0,
                    created_at DATETIME DEFAULT GETDATE() NOT NULL,
                    updated_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
                )
            """))
            db.session.commit()
            results.append('study_topics creada')
        else:
            results.append('study_topics ya existe')
        
        return jsonify({'message': 'Proceso completado', 'results': results}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# Endpoint para corregir la FK de study_sessions
@study_contents_bp.route('/fix-sessions-fk', methods=['GET'])
def fix_sessions_fk():
    """Corregir la FK de study_sessions para que apunte a study_contents"""
    try:
        results = []
        
        # 1. Verificar FKs existentes
        fk_result = db.session.execute(text("""
            SELECT fk.name 
            FROM sys.foreign_keys fk
            INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
            WHERE t.name = 'study_sessions'
        """))
        fk_names = [row[0] for row in fk_result.fetchall()]
        results.append(f'FKs encontradas: {fk_names}')
        
        for fk_name in fk_names:
            try:
                db.session.execute(text(f"ALTER TABLE study_sessions DROP CONSTRAINT [{fk_name}]"))
                db.session.commit()
                results.append(f'FK {fk_name} eliminada')
            except Exception as e:
                results.append(f'Error eliminando {fk_name}: {str(e)}')
        
        # 2. Eliminar registros huérfanos
        delete_result = db.session.execute(text("""
            DELETE FROM study_sessions 
            WHERE material_id NOT IN (SELECT id FROM study_contents)
        """))
        db.session.commit()
        results.append(f'Registros huérfanos eliminados: {delete_result.rowcount}')
        
        # 3. Intentar crear la FK
        try:
            db.session.execute(text("""
                ALTER TABLE study_sessions 
                ADD CONSTRAINT FK_study_sessions_study_contents 
                FOREIGN KEY (material_id) REFERENCES study_contents(id) ON DELETE CASCADE
            """))
            db.session.commit()
            results.append('Nueva FK creada exitosamente')
        except Exception as e:
            results.append(f'Error creando FK: {str(e)}')
        
        return jsonify({'message': 'Proceso completado', 'results': results}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== CRUD de Materiales de Estudio ====================

@study_contents_bp.route('', methods=['GET'])
@jwt_required()
def get_materials():
    """Obtener todos los materiales de estudio"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        
        query = StudyMaterial.query
        
        if search:
            query = query.filter(StudyMaterial.title.ilike(f'%{search}%'))
        
        query = query.order_by(StudyMaterial.order, StudyMaterial.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'materials': [m.to_dict() for m in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>', methods=['GET'])
@jwt_required()
def get_material(material_id):
    """Obtener un material de estudio por ID"""
    try:
        material = StudyMaterial.query.get_or_404(material_id)
        return jsonify(material.to_dict(include_sessions=True)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def create_material():
    """Crear un nuevo material de estudio"""
    try:
        data = request.get_json()
        user = get_current_user()
        
        material = StudyMaterial(
            title=data.get('title'),
            description=data.get('description'),
            image_url=data.get('image_url'),
            is_published=data.get('is_published', False),
            order=data.get('order', 0),
            exam_id=data.get('exam_id'),
            created_by=user.id
        )
        
        db.session.add(material)
        db.session.flush()  # Para obtener el ID del material
        
        # Manejar múltiples exámenes
        exam_ids = data.get('exam_ids', [])
        if exam_ids:
            # Asegurar que la tabla existe antes de usarla
            ensure_study_material_exams_table()
            for exam_id in exam_ids:
                exam = Exam.query.get(exam_id)
                if exam:
                    material.exams.append(exam)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Material de estudio creado exitosamente',
            'material': material.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>', methods=['PUT'])
@jwt_required()
@admin_or_editor_required
def update_material(material_id):
    """Actualizar un material de estudio"""
    try:
        material = StudyMaterial.query.get_or_404(material_id)
        data = request.get_json()
        user = get_current_user()
        
        material.title = data.get('title', material.title)
        material.description = data.get('description', material.description)
        material.image_url = data.get('image_url', material.image_url)
        material.is_published = data.get('is_published', material.is_published)
        material.order = data.get('order', material.order)
        material.exam_id = data.get('exam_id', material.exam_id)
        material.updated_by = user.id
        
        # Manejar múltiples exámenes
        if 'exam_ids' in data:
            # Asegurar que la tabla existe
            ensure_study_material_exams_table()
            # Limpiar exámenes actuales
            material.exams = []
            # Agregar nuevos exámenes
            exam_ids = data.get('exam_ids', [])
            for exam_id in exam_ids:
                exam = Exam.query.get(exam_id)
                if exam:
                    material.exams.append(exam)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Material actualizado exitosamente',
            'material': material.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_material(material_id):
    """Eliminar un material de estudio y todos sus archivos de Azure Storage"""
    try:
        material = StudyMaterial.query.get_or_404(material_id)
        
        # Eliminar archivos de Azure Storage antes de borrar el material
        for session in material.sessions:
            for topic in session.topics:
                # Eliminar archivo de video si existe
                if topic.video and topic.video.video_url and 'blob.core.windows.net' in topic.video.video_url:
                    try:
                        azure_storage.delete_video(topic.video.video_url)
                    except Exception as e:
                        print(f"Error eliminando video {topic.video.video_url}: {e}")
                # Eliminar archivo descargable si existe
                if topic.downloadable_exercise and topic.downloadable_exercise.file_url and 'blob.core.windows.net' in topic.downloadable_exercise.file_url:
                    try:
                        azure_storage.delete_downloadable(topic.downloadable_exercise.file_url)
                    except Exception as e:
                        print(f"Error eliminando descargable {topic.downloadable_exercise.file_url}: {e}")
        
        # Eliminar imagen de portada si existe
        if material.image_url and 'blob.core.windows.net' in material.image_url:
            try:
                azure_storage.delete_file(material.image_url)
            except Exception as e:
                print(f"Error eliminando imagen de portada {material.image_url}: {e}")
        
        db.session.delete(material)
        db.session.commit()
        
        return jsonify({'message': 'Material eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== Upload de Imagen de Portada ====================

@study_contents_bp.route('/upload-cover-image', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def upload_cover_image():
    """
    Subir imagen de portada para materiales de estudio a Azure Blob Storage (Hot tier)
    Acepta FormData con campo 'image'
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No se proporcionó imagen'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'Nombre de archivo vacío'}), 400
        
        # Validar que es una imagen
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        if ext not in allowed_extensions:
            return jsonify({'error': 'Tipo de archivo no permitido. Use: png, jpg, jpeg, gif, webp'}), 400
        
        # Subir a Azure Blob Storage (Hot tier - carpeta study-materials/covers)
        file_url = azure_storage.upload_file(file, folder='study-materials/covers')
        
        if not file_url:
            return jsonify({'error': 'Error al subir la imagen. Verifique la configuración de Azure Storage.'}), 500
        
        return jsonify({
            'message': 'Imagen subida exitosamente',
            'url': file_url
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== CRUD de Sesiones ====================

@study_contents_bp.route('/<int:material_id>/sessions', methods=['GET'])
@jwt_required()
def get_sessions(material_id):
    """Obtener todas las sesiones de un material"""
    try:
        material = StudyMaterial.query.get_or_404(material_id)
        sessions = material.sessions.all()
        return jsonify([s.to_dict(include_topics=True) for s in sessions]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def create_session(material_id):
    """Crear una nueva sesión"""
    try:
        material = StudyMaterial.query.get_or_404(material_id)
        data = request.get_json()
        
        # Obtener el máximo número de sesión
        max_number = db.session.query(db.func.max(StudySession.session_number)).filter_by(material_id=material_id).scalar() or 0
        
        session = StudySession(
            material_id=material_id,
            session_number=data.get('session_number', max_number + 1),
            title=data.get('title'),
            description=data.get('description')
        )
        
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            'message': 'Sesión creada exitosamente',
            'session': session.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>', methods=['GET'])
@jwt_required()
def get_session(material_id, session_id):
    """Obtener una sesión por ID"""
    try:
        session = StudySession.query.filter_by(id=session_id, material_id=material_id).first_or_404()
        return jsonify(session.to_dict(include_topics=True)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>', methods=['PUT'])
@jwt_required()
@admin_or_editor_required
def update_session(material_id, session_id):
    """Actualizar una sesión"""
    try:
        session = StudySession.query.filter_by(id=session_id, material_id=material_id).first_or_404()
        data = request.get_json()
        
        session.title = data.get('title', session.title)
        session.description = data.get('description', session.description)
        session.session_number = data.get('session_number', session.session_number)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Sesión actualizada exitosamente',
            'session': session.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_session(material_id, session_id):
    """Eliminar una sesión y todos sus archivos de Azure Storage"""
    try:
        session = StudySession.query.filter_by(id=session_id, material_id=material_id).first_or_404()
        
        # Eliminar archivos de Azure Storage antes de borrar la sesión
        for topic in session.topics:
            # Eliminar archivo de video si existe
            if topic.video and topic.video.video_url and 'blob.core.windows.net' in topic.video.video_url:
                azure_storage.delete_video(topic.video.video_url)
            # Eliminar archivo descargable si existe
            if topic.downloadable_exercise and topic.downloadable_exercise.file_url and 'blob.core.windows.net' in topic.downloadable_exercise.file_url:
                azure_storage.delete_downloadable(topic.downloadable_exercise.file_url)
        
        db.session.delete(session)
        db.session.commit()
        
        return jsonify({'message': 'Sesión eliminada exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== CRUD de Temas ====================

@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics', methods=['GET'])
@jwt_required()
def get_topics(material_id, session_id):
    """Obtener todos los temas de una sesión"""
    try:
        session = StudySession.query.filter_by(id=session_id, material_id=material_id).first_or_404()
        topics = session.topics.all()
        return jsonify([t.to_dict(include_elements=True) for t in topics]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def create_topic(material_id, session_id):
    """Crear un nuevo tema"""
    try:
        session = StudySession.query.filter_by(id=session_id, material_id=material_id).first_or_404()
        data = request.get_json()
        
        # DEBUG: Log de datos recibidos
        import logging
        logging.warning(f"=== CREATE TOPIC - DATA RECEIVED ===")
        logging.warning(f"Raw data: {data}")
        logging.warning(f"allow_reading: {data.get('allow_reading')} (type: {type(data.get('allow_reading'))})")
        logging.warning(f"allow_video: {data.get('allow_video')} (type: {type(data.get('allow_video'))})")
        logging.warning(f"allow_downloadable: {data.get('allow_downloadable')} (type: {type(data.get('allow_downloadable'))})")
        logging.warning(f"allow_interactive: {data.get('allow_interactive')} (type: {type(data.get('allow_interactive'))})")
        
        max_order = db.session.query(db.func.max(StudyTopic.order)).filter_by(session_id=session_id).scalar() or 0
        
        # Extraer valores explícitamente
        allow_reading = data.get('allow_reading') if data.get('allow_reading') is not None else True
        allow_video = data.get('allow_video') if data.get('allow_video') is not None else True
        allow_downloadable = data.get('allow_downloadable') if data.get('allow_downloadable') is not None else True
        allow_interactive = data.get('allow_interactive') if data.get('allow_interactive') is not None else True
        
        logging.warning(f"Final values - reading: {allow_reading}, video: {allow_video}, downloadable: {allow_downloadable}, interactive: {allow_interactive}")
        
        topic = StudyTopic(
            session_id=session_id,
            title=data.get('title'),
            description=data.get('description'),
            order=data.get('order', max_order + 1),
            allow_reading=allow_reading,
            allow_video=allow_video,
            allow_downloadable=allow_downloadable,
            allow_interactive=allow_interactive
        )
        
        db.session.add(topic)
        db.session.commit()
        
        return jsonify({
            'message': 'Tema creado exitosamente',
            'topic': topic.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>', methods=['GET'])
@jwt_required()
def get_topic(material_id, session_id, topic_id):
    """Obtener un tema por ID"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        return jsonify(topic.to_dict(include_elements=True)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>', methods=['PUT'])
@jwt_required()
@admin_or_editor_required
def update_topic(material_id, session_id, topic_id):
    """Actualizar un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        data = request.get_json()
        
        topic.title = data.get('title', topic.title)
        topic.description = data.get('description', topic.description)
        topic.order = data.get('order', topic.order)
        
        # Actualizar campos allow_* si se proporcionan
        if 'allow_reading' in data:
            topic.allow_reading = data.get('allow_reading')
        if 'allow_video' in data:
            topic.allow_video = data.get('allow_video')
        if 'allow_downloadable' in data:
            topic.allow_downloadable = data.get('allow_downloadable')
        if 'allow_interactive' in data:
            topic.allow_interactive = data.get('allow_interactive')
        
        db.session.commit()
        
        return jsonify({
            'message': 'Tema actualizado exitosamente',
            'topic': topic.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_topic(material_id, session_id, topic_id):
    """Eliminar un tema y sus archivos de Azure Storage"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        # Eliminar archivos de Azure Storage antes de borrar el tema
        # Eliminar video si existe
        if topic.video and topic.video.video_url and 'blob.core.windows.net' in topic.video.video_url:
            azure_storage.delete_video(topic.video.video_url)
        # Eliminar archivo descargable si existe
        if topic.downloadable_exercise and topic.downloadable_exercise.file_url and 'blob.core.windows.net' in topic.downloadable_exercise.file_url:
            azure_storage.delete_downloadable(topic.downloadable_exercise.file_url)
        
        db.session.delete(topic)
        db.session.commit()
        
        return jsonify({'message': 'Tema eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== Elementos del Tema ====================

# --- Lectura ---
@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/reading', methods=['POST', 'PUT'])
@jwt_required()
@admin_or_editor_required
def upsert_reading(material_id, session_id, topic_id):
    """Crear o actualizar la lectura de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        data = request.get_json()
        
        if topic.reading:
            # Actualizar
            topic.reading.title = data.get('title', topic.reading.title)
            topic.reading.content = data.get('content', topic.reading.content)
            topic.reading.estimated_time_minutes = data.get('estimated_time_minutes', topic.reading.estimated_time_minutes)
        else:
            # Crear
            reading = StudyReading(
                topic_id=topic_id,
                title=data.get('title'),
                content=data.get('content'),
                estimated_time_minutes=data.get('estimated_time_minutes')
            )
            db.session.add(reading)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Lectura guardada exitosamente',
            'reading': topic.reading.to_dict() if topic.reading else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/reading', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_reading(material_id, session_id, topic_id):
    """Eliminar la lectura de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        if topic.reading:
            db.session.delete(topic.reading)
            db.session.commit()
        
        return jsonify({'message': 'Lectura eliminada exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- Video ---
@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/video', methods=['POST', 'PUT'])
@jwt_required()
@admin_or_editor_required
def upsert_video(material_id, session_id, topic_id):
    """Crear o actualizar el video de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        data = request.get_json()
        
        if topic.video:
            topic.video.title = data.get('title', topic.video.title)
            topic.video.description = data.get('description', topic.video.description)
            topic.video.video_url = data.get('video_url', topic.video.video_url)
            topic.video.video_type = data.get('video_type', topic.video.video_type)
            topic.video.thumbnail_url = data.get('thumbnail_url', topic.video.thumbnail_url)
            topic.video.duration_minutes = data.get('duration_minutes', topic.video.duration_minutes)
        else:
            video = StudyVideo(
                topic_id=topic_id,
                title=data.get('title'),
                description=data.get('description'),
                video_url=data.get('video_url'),
                video_type=data.get('video_type', 'youtube'),
                thumbnail_url=data.get('thumbnail_url'),
                duration_minutes=data.get('duration_minutes')
            )
            db.session.add(video)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Video guardado exitosamente',
            'video': topic.video.to_dict() if topic.video else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/video', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_video(material_id, session_id, topic_id):
    """Eliminar el video de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        if topic.video:
            # Eliminar archivo de Azure si existe
            if topic.video.video_url and 'blob.core.windows.net' in topic.video.video_url:
                azure_storage.delete_file(topic.video.video_url)
            db.session.delete(topic.video)
            db.session.commit()
        
        return jsonify({'message': 'Video eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/video/get-upload-url', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def get_video_upload_url(material_id, session_id, topic_id):
    """
    Obtener URL con SAS token para subir video directamente a Azure
    Esto evita el límite de 30MB de Azure App Service
    """
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        data = request.get_json()
        filename = data.get('filename', 'video.mp4')
        
        result = azure_storage.generate_video_upload_sas(filename)
        
        if not result:
            return jsonify({'error': 'No se pudo generar la URL de subida'}), 500
        
        return jsonify({
            'upload_url': result['upload_url'],
            'download_url': result['download_url'],
            'blob_name': result['blob_name']
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/video/confirm-upload', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def confirm_video_upload(material_id, session_id, topic_id):
    """
    Confirmar que el video se subió correctamente y guardar en BD
    """
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        data = request.get_json()
        video_url = data.get('video_url')
        title = data.get('title', 'Video')
        description = data.get('description', '')
        duration_minutes = data.get('duration_minutes')
        
        if not video_url:
            return jsonify({'error': 'URL del video es requerida'}), 400
        
        # Eliminar video anterior si existe
        if topic.video:
            if topic.video.video_url and 'blob.core.windows.net' in topic.video.video_url:
                azure_storage.delete_video(topic.video.video_url)
            topic.video.title = title
            topic.video.description = description
            topic.video.video_url = video_url
            if duration_minutes:
                topic.video.duration_minutes = duration_minutes
        else:
            video = StudyVideo(
                topic_id=topic.id,
                title=title,
                description=description,
                video_url=video_url,
                duration_minutes=duration_minutes
            )
            db.session.add(video)
        
        db.session.commit()
        
        # Recargar el video
        db.session.refresh(topic)
        
        return jsonify({
            'message': 'Video guardado exitosamente',
            'video': topic.video.to_dict() if topic.video else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/video/upload', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def upload_video(material_id, session_id, topic_id):
    """
    Subir un archivo de video para un tema
    - Comprime el video con FFmpeg (~60% reducción)
    - Lo sube a cuenta Azure Cool tier (~50% más barato)
    - Extrae y guarda las dimensiones del video
    """
    from app.utils.video_compressor import video_compressor
    
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        if 'video' not in request.files:
            return jsonify({'error': 'No se proporcionó archivo de video'}), 400
        
        file = request.files['video']
        
        if file.filename == '':
            return jsonify({'error': 'Nombre de archivo vacío'}), 400
        
        # Validar extensión
        allowed_extensions = {'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'mpeg', '3gp'}
        ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        if ext not in allowed_extensions:
            return jsonify({'error': f'Extensión no permitida. Use: {", ".join(allowed_extensions)}'}), 400
        
        # Validar tamaño (máximo 2GB)
        file.seek(0, 2)  # Ir al final
        file_size = file.tell()
        file.seek(0)  # Volver al inicio
        
        max_size = 2 * 1024 * 1024 * 1024  # 2GB
        if file_size > max_size:
            return jsonify({'error': 'El video excede el tamaño máximo de 2GB'}), 400
        
        original_filename = file.filename
        compression_info = {}
        video_width = None
        video_height = None
        
        # Intentar comprimir el video
        compressed_path, original_size, compressed_size = video_compressor.compress_video(file)
        
        if compressed_path:
            # Obtener dimensiones del video comprimido
            video_width, video_height = video_compressor.get_video_dimensions(compressed_path)
            
            # Usar video comprimido
            video_url = azure_storage.upload_video(compressed_path, original_filename)
            compression_info = {
                'original_size_mb': round(original_size / (1024 * 1024), 2),
                'compressed_size_mb': round(compressed_size / (1024 * 1024), 2),
                'reduction_percent': round((1 - compressed_size / original_size) * 100, 1),
                'compressed': True,
                'video_width': video_width,
                'video_height': video_height
            }
            # Limpiar archivo temporal
            video_compressor.cleanup_temp_file(compressed_path)
        else:
            # Guardar archivo temporal para obtener dimensiones
            import tempfile
            import os
            temp_dir = tempfile.mkdtemp()
            temp_path = os.path.join(temp_dir, 'temp_video')
            file.save(temp_path)
            file.seek(0)
            
            # Obtener dimensiones del video original
            video_width, video_height = video_compressor.get_video_dimensions(temp_path)
            
            # Limpiar temp
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            # Subir archivo original si compresión falló
            file.seek(0)
            video_url = azure_storage.upload_video(file, original_filename)
            compression_info = {
                'original_size_mb': round(file_size / (1024 * 1024), 2),
                'compressed': False,
                'reason': 'FFmpeg no disponible o compresión no significativa',
                'video_width': video_width,
                'video_height': video_height
            }
        
        if not video_url:
            return jsonify({'error': 'Error al subir el video. Verifique la configuración de Azure Storage.'}), 500
        
        # Obtener metadatos del request
        title = request.form.get('title', file.filename)
        description = request.form.get('description', '')
        duration_minutes = request.form.get('duration_minutes', type=int)
        
        # Actualizar o crear el video en la BD
        if topic.video:
            # Eliminar video anterior de Azure
            if topic.video.video_url and 'blob.core.windows.net' in topic.video.video_url:
                azure_storage.delete_video(topic.video.video_url)
            topic.video.title = title
            topic.video.description = description
            topic.video.video_url = video_url
            topic.video.video_type = 'uploaded'
            topic.video.duration_minutes = duration_minutes
            topic.video.video_width = video_width
            topic.video.video_height = video_height
        else:
            video = StudyVideo(
                topic_id=topic_id,
                title=title,
                description=description,
                video_url=video_url,
                video_type='uploaded',
                duration_minutes=duration_minutes,
                video_width=video_width,
                video_height=video_height
            )
            db.session.add(video)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Video subido exitosamente',
            'video': topic.video.to_dict() if topic.video else None,
            'compression': compression_info,
            'storage_tier': 'Cool (optimizado para costos)'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# Endpoint genérico para subir archivos (útil para ejercicios descargables también)
@study_contents_bp.route('/upload-file', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def upload_file():
    """Subir un archivo genérico a Azure Storage"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No se proporcionó archivo'}), 400
        
        file = request.files['file']
        folder = request.form.get('folder', 'general')
        
        if file.filename == '':
            return jsonify({'error': 'Nombre de archivo vacío'}), 400
        
        # Subir a Azure Blob Storage
        file_url = azure_storage.upload_file(file, folder=folder)
        
        if not file_url:
            return jsonify({'error': 'Error al subir el archivo. Verifique la configuración de Azure Storage.'}), 500
        
        return jsonify({
            'message': 'Archivo subido exitosamente',
            'url': file_url,
            'filename': file.filename
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Ejercicio Descargable ---
@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/downloadable', methods=['POST', 'PUT'])
@jwt_required()
@admin_or_editor_required
def upsert_downloadable(material_id, session_id, topic_id):
    """Crear o actualizar el ejercicio descargable de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        data = request.get_json()
        
        if topic.downloadable_exercise:
            topic.downloadable_exercise.title = data.get('title', topic.downloadable_exercise.title)
            topic.downloadable_exercise.description = data.get('description', topic.downloadable_exercise.description)
            topic.downloadable_exercise.file_url = data.get('file_url', topic.downloadable_exercise.file_url)
            topic.downloadable_exercise.file_name = data.get('file_name', topic.downloadable_exercise.file_name)
            topic.downloadable_exercise.file_type = data.get('file_type', topic.downloadable_exercise.file_type)
            topic.downloadable_exercise.file_size_bytes = data.get('file_size_bytes', topic.downloadable_exercise.file_size_bytes)
        else:
            downloadable = StudyDownloadableExercise(
                topic_id=topic_id,
                title=data.get('title'),
                description=data.get('description'),
                file_url=data.get('file_url'),
                file_name=data.get('file_name'),
                file_type=data.get('file_type'),
                file_size_bytes=data.get('file_size_bytes')
            )
            db.session.add(downloadable)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Ejercicio descargable guardado exitosamente',
            'downloadable_exercise': topic.downloadable_exercise.to_dict() if topic.downloadable_exercise else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/downloadable', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_downloadable(material_id, session_id, topic_id):
    """Eliminar el ejercicio descargable de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        if topic.downloadable_exercise:
            # Eliminar archivo de Azure si existe
            if topic.downloadable_exercise.file_url and 'blob.core.windows.net' in topic.downloadable_exercise.file_url:
                azure_storage.delete_downloadable(topic.downloadable_exercise.file_url)
            db.session.delete(topic.downloadable_exercise)
            db.session.commit()
        
        return jsonify({'message': 'Ejercicio descargable eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/downloadable/upload', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def upload_downloadable(material_id, session_id, topic_id):
    """
    Subir archivo(s) para ejercicio descargable
    - Si se sube un archivo: se guarda directamente
    - Si se suben múltiples archivos: se comprimen en ZIP
    - Almacena en Cool tier para optimizar costos
    """
    from app.utils.file_compressor import file_compressor
    
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        if 'files' not in request.files and 'file' not in request.files:
            return jsonify({'error': 'No se proporcionaron archivos'}), 400
        
        # Obtener archivos (soporta tanto 'file' como 'files')
        files = request.files.getlist('files') or [request.files.get('file')]
        files = [f for f in files if f and f.filename]  # Filtrar vacíos
        
        if not files:
            return jsonify({'error': 'No se proporcionaron archivos válidos'}), 400
        
        # Validar tamaño total (máximo 100MB)
        max_size = 100 * 1024 * 1024
        total_size = 0
        for f in files:
            f.seek(0, 2)
            total_size += f.tell()
            f.seek(0)
        
        if total_size > max_size:
            return jsonify({'error': 'Los archivos exceden el tamaño máximo de 100MB'}), 400
        
        # Obtener metadatos
        title = request.form.get('title', files[0].filename if len(files) == 1 else 'Ejercicio descargable')
        description = request.form.get('description', '')
        
        compression_info = {}
        
        if len(files) == 1:
            # Un solo archivo - subir directamente
            file = files[0]
            file_info = file_compressor.get_file_info(file)
            
            file_url, upload_error = azure_storage.upload_downloadable(file, file.filename, file_info['content_type'])
            
            if not file_url:
                error_msg = upload_error or 'Error desconocido al subir el archivo'
                return jsonify({'error': error_msg}), 500
            
            final_filename = file_info['filename']
            final_size = file_info['size_bytes']
            final_type = file_info['content_type']
            
            compression_info = {
                'files_count': 1,
                'original_size_mb': file_info['size_mb'],
                'compressed': False
            }
        else:
            # Múltiples archivos - comprimir en ZIP
            zip_filename = f"{title.replace(' ', '_')}.zip" if title else 'ejercicio.zip'
            zip_path, original_size, zip_size = file_compressor.compress_files_to_zip(files, zip_filename)
            
            if not zip_path:
                return jsonify({'error': 'Error al comprimir archivos'}), 500
            
            file_url, upload_error = azure_storage.upload_downloadable(zip_path, zip_filename, 'application/zip')
            
            # Limpiar archivo temporal
            file_compressor.cleanup_temp_file(zip_path)
            
            if not file_url:
                error_msg = upload_error or 'Error desconocido al subir el archivo ZIP'
                return jsonify({'error': error_msg}), 500
            
            final_filename = zip_filename
            final_size = zip_size
            final_type = 'application/zip'
            
            compression_info = {
                'files_count': len(files),
                'original_size_mb': round(original_size / (1024 * 1024), 2),
                'compressed_size_mb': round(zip_size / (1024 * 1024), 2),
                'reduction_percent': round((1 - zip_size / original_size) * 100, 1) if original_size > 0 else 0,
                'compressed': True
            }
        
        # Actualizar o crear el ejercicio descargable
        if topic.downloadable_exercise:
            # Eliminar archivo anterior
            if topic.downloadable_exercise.file_url and 'blob.core.windows.net' in topic.downloadable_exercise.file_url:
                azure_storage.delete_downloadable(topic.downloadable_exercise.file_url)
            
            topic.downloadable_exercise.title = title
            topic.downloadable_exercise.description = description
            topic.downloadable_exercise.file_url = file_url
            topic.downloadable_exercise.file_name = final_filename
            topic.downloadable_exercise.file_type = final_type
            topic.downloadable_exercise.file_size_bytes = final_size
        else:
            downloadable = StudyDownloadableExercise(
                topic_id=topic_id,
                title=title,
                description=description,
                file_url=file_url,
                file_name=final_filename,
                file_type=final_type,
                file_size_bytes=final_size
            )
            db.session.add(downloadable)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Archivo(s) subido(s) exitosamente',
            'downloadable_exercise': topic.downloadable_exercise.to_dict() if topic.downloadable_exercise else None,
            'compression': compression_info,
            'storage_tier': 'Cool (optimizado para costos)'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# --- Ejercicio Interactivo ---
@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def create_interactive(material_id, session_id, topic_id):
    """Crear el ejercicio interactivo de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        if topic.interactive_exercise:
            return jsonify({'error': 'El tema ya tiene un ejercicio interactivo'}), 400
        
        data = request.get_json()
        user = get_current_user()
        
        interactive = StudyInteractiveExercise(
            id=str(uuid.uuid4()),
            topic_id=topic_id,
            title=data.get('title', 'Ejercicio Interactivo'),
            description=data.get('description'),
            is_active=True,
            created_by=user.id
        )
        
        db.session.add(interactive)
        db.session.commit()
        
        return jsonify({
            'message': 'Ejercicio interactivo creado exitosamente',
            'interactive_exercise': interactive.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive', methods=['PUT'])
@jwt_required()
@admin_or_editor_required
def update_interactive(material_id, session_id, topic_id):
    """Actualizar el ejercicio interactivo de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        if not topic.interactive_exercise:
            return jsonify({'error': 'El tema no tiene un ejercicio interactivo'}), 404
        
        data = request.get_json()
        user = get_current_user()
        
        topic.interactive_exercise.title = data.get('title', topic.interactive_exercise.title)
        topic.interactive_exercise.description = data.get('description', topic.interactive_exercise.description)
        topic.interactive_exercise.is_active = data.get('is_active', topic.interactive_exercise.is_active)
        topic.interactive_exercise.updated_by = user.id
        
        db.session.commit()
        
        return jsonify({
            'message': 'Ejercicio interactivo actualizado exitosamente',
            'interactive_exercise': topic.interactive_exercise.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_interactive(material_id, session_id, topic_id):
    """Eliminar el ejercicio interactivo de un tema"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        if topic.interactive_exercise:
            db.session.delete(topic.interactive_exercise)
            db.session.commit()
        
        return jsonify({'message': 'Ejercicio interactivo eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== Pasos y Acciones de Ejercicios Interactivos ====================

@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive/steps', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def create_step(material_id, session_id, topic_id):
    """Crear un paso en el ejercicio interactivo"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        if not topic.interactive_exercise:
            return jsonify({'error': 'El tema no tiene un ejercicio interactivo'}), 404
        
        data = request.get_json()
        exercise_id = topic.interactive_exercise.id
        
        max_number = db.session.query(db.func.max(StudyInteractiveExerciseStep.step_number)).filter_by(exercise_id=exercise_id).scalar() or 0
        
        step = StudyInteractiveExerciseStep(
            id=str(uuid.uuid4()),
            exercise_id=exercise_id,
            step_number=data.get('step_number', max_number + 1),
            title=data.get('title'),
            description=data.get('description'),
            image_url=data.get('image_url'),
            image_width=data.get('image_width'),
            image_height=data.get('image_height')
        )
        
        db.session.add(step)
        db.session.commit()
        
        return jsonify({
            'message': 'Paso creado exitosamente',
            'step': step.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive/steps/<string:step_id>', methods=['PUT'])
@jwt_required()
@admin_or_editor_required
def update_step(material_id, session_id, topic_id, step_id):
    """Actualizar un paso"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        if not topic.interactive_exercise:
            return jsonify({'error': 'El tema no tiene un ejercicio interactivo'}), 404
        
        step = StudyInteractiveExerciseStep.query.filter_by(id=step_id, exercise_id=topic.interactive_exercise.id).first_or_404()
        data = request.get_json()
        
        step.title = data.get('title', step.title)
        step.description = data.get('description', step.description)
        step.step_number = data.get('step_number', step.step_number)
        step.image_url = data.get('image_url', step.image_url)
        step.image_width = data.get('image_width', step.image_width)
        step.image_height = data.get('image_height', step.image_height)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Paso actualizado exitosamente',
            'step': step.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive/steps/<string:step_id>', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_step(material_id, session_id, topic_id, step_id):
    """Eliminar un paso"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        if not topic.interactive_exercise:
            return jsonify({'error': 'El tema no tiene un ejercicio interactivo'}), 404
        
        step = StudyInteractiveExerciseStep.query.filter_by(id=step_id, exercise_id=topic.interactive_exercise.id).first_or_404()
        db.session.delete(step)
        db.session.commit()
        
        return jsonify({'message': 'Paso eliminado exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive/steps/<string:step_id>/actions', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def create_action(material_id, session_id, topic_id, step_id):
    """Crear una acción en un paso"""
    try:
        topic = StudyTopic.query.filter_by(id=topic_id, session_id=session_id).first_or_404()
        
        if not topic.interactive_exercise:
            return jsonify({'error': 'El tema no tiene un ejercicio interactivo'}), 404
        
        step = StudyInteractiveExerciseStep.query.filter_by(id=step_id, exercise_id=topic.interactive_exercise.id).first_or_404()
        data = request.get_json()
        
        max_number = db.session.query(db.func.max(StudyInteractiveExerciseAction.action_number)).filter_by(step_id=step_id).scalar() or 0
        
        action = StudyInteractiveExerciseAction(
            id=str(uuid.uuid4()),
            step_id=step_id,
            action_number=data.get('action_number', max_number + 1),
            action_type=data.get('action_type', 'button'),
            position_x=data.get('position_x', 0),
            position_y=data.get('position_y', 0),
            width=data.get('width', 10),
            height=data.get('height', 10),
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
        
        return jsonify({
            'message': 'Acción creada exitosamente',
            'action': action.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive/steps/<string:step_id>/actions/<string:action_id>', methods=['PUT'])
@jwt_required()
@admin_or_editor_required
def update_action(material_id, session_id, topic_id, step_id, action_id):
    """Actualizar una acción"""
    try:
        action = StudyInteractiveExerciseAction.query.filter_by(id=action_id, step_id=step_id).first_or_404()
        data = request.get_json()
        
        action.action_type = data.get('action_type', action.action_type)
        action.action_number = data.get('action_number', action.action_number)
        action.position_x = data.get('position_x', action.position_x)
        action.position_y = data.get('position_y', action.position_y)
        action.width = data.get('width', action.width)
        action.height = data.get('height', action.height)
        action.label = data.get('label', action.label)
        # Placeholder: si se envía (incluso vacío), usar el valor enviado
        if 'placeholder' in data:
            action.placeholder = data['placeholder'] if data['placeholder'] else None
        action.correct_answer = data.get('correct_answer', action.correct_answer)
        action.is_case_sensitive = data.get('is_case_sensitive', action.is_case_sensitive)
        action.scoring_mode = data.get('scoring_mode', action.scoring_mode)
        action.on_error_action = data.get('on_error_action', action.on_error_action)
        action.error_message = data.get('error_message', action.error_message)
        action.max_attempts = data.get('max_attempts', action.max_attempts)
        action.text_color = data.get('text_color', action.text_color)
        action.font_family = data.get('font_family', action.font_family)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Acción actualizada exitosamente',
            'action': action.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@study_contents_bp.route('/<int:material_id>/sessions/<int:session_id>/topics/<int:topic_id>/interactive/steps/<string:step_id>/actions/<string:action_id>', methods=['DELETE'])
@jwt_required()
@admin_or_editor_required
def delete_action(material_id, session_id, topic_id, step_id, action_id):
    """Eliminar una acción"""
    try:
        action = StudyInteractiveExerciseAction.query.filter_by(id=action_id, step_id=step_id).first_or_404()
        db.session.delete(action)
        db.session.commit()
        
        return jsonify({'message': 'Acción eliminada exitosamente'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== Upload de Imagen para Ejercicios Interactivos ====================

@study_contents_bp.route('/upload-image', methods=['POST'])
@jwt_required()
@admin_or_editor_required
def upload_interactive_image():
    """
    Subir imagen para ejercicios interactivos a Azure Blob Storage (Hot tier)
    Acepta FormData con campo 'image'
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No se proporcionó imagen'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'Nombre de archivo vacío'}), 400
        
        # Validar que es una imagen
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        if ext not in allowed_extensions:
            return jsonify({'error': 'Tipo de archivo no permitido. Use: png, jpg, jpeg, gif, webp'}), 400
        
        # Subir a Azure Blob Storage (Hot tier - carpeta interactive-exercises)
        file_url = azure_storage.upload_file(file, folder='interactive-exercises')
        
        if not file_url:
            return jsonify({'error': 'Error al subir la imagen. Verifique la configuración de Azure Storage.'}), 500
        
        return jsonify({
            'message': 'Imagen subida exitosamente',
            'url': file_url
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==========================================
# ENDPOINTS DE PROGRESO DEL ESTUDIANTE
# ==========================================

def ensure_student_progress_tables():
    """Asegurar que las tablas de progreso existen"""
    try:
        # Verificar si la tabla student_content_progress existe
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'student_content_progress'
        """))
        exists = result.scalar() > 0
        
        if not exists:
            # Crear la tabla student_content_progress (usando VARCHAR(36) como users.id)
            db.session.execute(text("""
                CREATE TABLE student_content_progress (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    content_type VARCHAR(50) NOT NULL,
                    content_id INT NOT NULL,
                    topic_id INT NOT NULL,
                    is_completed BIT DEFAULT 0 NOT NULL,
                    score FLOAT NULL,
                    completed_at DATETIME NULL,
                    created_at DATETIME DEFAULT GETDATE() NOT NULL,
                    updated_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (topic_id) REFERENCES study_topics(id) ON DELETE CASCADE,
                    CONSTRAINT unique_user_content_progress UNIQUE (user_id, content_type, content_id)
                )
            """))
            db.session.commit()
            print("✅ Tabla student_content_progress creada exitosamente")
        
        # Verificar si la tabla student_topic_progress existe
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'student_topic_progress'
        """))
        exists = result.scalar() > 0
        
        if not exists:
            # Crear la tabla student_topic_progress (usando VARCHAR(36) como users.id)
            db.session.execute(text("""
                CREATE TABLE student_topic_progress (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    topic_id INT NOT NULL,
                    total_contents INT DEFAULT 0,
                    completed_contents INT DEFAULT 0,
                    progress_percentage FLOAT DEFAULT 0.0,
                    is_completed BIT DEFAULT 0 NOT NULL,
                    created_at DATETIME DEFAULT GETDATE() NOT NULL,
                    updated_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (topic_id) REFERENCES study_topics(id) ON DELETE CASCADE,
                    CONSTRAINT unique_user_topic_progress UNIQUE (user_id, topic_id)
                )
            """))
            db.session.commit()
            print("✅ Tabla student_topic_progress creada exitosamente")
        
        return True
    except Exception as e:
        print(f"Error verificando/creando tablas de progreso: {e}")
        db.session.rollback()
        return False


# Endpoint para crear las tablas de progreso
@study_contents_bp.route('/setup-progress-tables', methods=['GET'])
def setup_progress_tables():
    """Crear las tablas de progreso si no existen (endpoint público temporal)"""
    try:
        errors = []
        
        # Verificar si la tabla student_content_progress existe
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'student_content_progress'
        """))
        exists = result.scalar() > 0
        
        if not exists:
            try:
                # Crear la tabla student_content_progress (usando VARCHAR(36) como users.id)
                db.session.execute(text("""
                    CREATE TABLE student_content_progress (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        user_id VARCHAR(36) NOT NULL,
                        content_type VARCHAR(50) NOT NULL,
                        content_id INT NOT NULL,
                        topic_id INT NOT NULL,
                        is_completed BIT DEFAULT 0 NOT NULL,
                        score FLOAT NULL,
                        completed_at DATETIME NULL,
                        created_at DATETIME DEFAULT GETDATE() NOT NULL,
                        updated_at DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (topic_id) REFERENCES study_topics(id) ON DELETE CASCADE,
                        CONSTRAINT unique_user_content_progress UNIQUE (user_id, content_type, content_id)
                    )
                """))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                errors.append(f"student_content_progress: {str(e)}")
        
        # Verificar si la tabla student_topic_progress existe
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'student_topic_progress'
        """))
        exists = result.scalar() > 0
        
        if not exists:
            try:
                # Crear la tabla student_topic_progress (usando VARCHAR(36) como users.id)
                db.session.execute(text("""
                    CREATE TABLE student_topic_progress (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        user_id VARCHAR(36) NOT NULL,
                        topic_id INT NOT NULL,
                        total_contents INT DEFAULT 0,
                        completed_contents INT DEFAULT 0,
                        progress_percentage FLOAT DEFAULT 0.0,
                        is_completed BIT DEFAULT 0 NOT NULL,
                        created_at DATETIME DEFAULT GETDATE() NOT NULL,
                        updated_at DATETIME DEFAULT GETDATE(),
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (topic_id) REFERENCES study_topics(id) ON DELETE CASCADE,
                        CONSTRAINT unique_user_topic_progress UNIQUE (user_id, topic_id)
                    )
                """))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                errors.append(f"student_topic_progress: {str(e)}")
        
        if errors:
            return jsonify({'message': 'Errores al crear tablas', 'errors': errors}), 500
        
        return jsonify({'message': 'Tablas de progreso verificadas/creadas'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint de debug para verificar las tablas
@study_contents_bp.route('/debug-progress-tables', methods=['GET'])
def debug_progress_tables():
    """Debug para verificar el estado de las tablas de progreso"""
    try:
        result = {}
        
        # Verificar si las tablas existen
        tables_check = db.session.execute(text("""
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME IN ('student_content_progress', 'student_topic_progress')
        """))
        result['tables'] = [row[0] for row in tables_check]
        
        # Verificar tipo de columna users.id
        user_id_type = db.session.execute(text("""
            SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
        """))
        row = user_id_type.fetchone()
        if row:
            result['users_id_type'] = f"{row[0]}({row[1]})" if row[1] else row[0]
        
        # Contar registros en cada tabla
        if 'student_content_progress' in result['tables']:
            count = db.session.execute(text("SELECT COUNT(*) FROM student_content_progress")).scalar()
            result['student_content_progress_count'] = count
        
        if 'student_topic_progress' in result['tables']:
            count = db.session.execute(text("SELECT COUNT(*) FROM student_topic_progress")).scalar()
            result['student_topic_progress_count'] = count
        
        return jsonify(result), 200
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@study_contents_bp.route('/progress/<content_type>/<int:content_id>', methods=['POST'])
@jwt_required()
def register_content_progress(content_type, content_id):
    """
    Registrar el progreso del estudiante en un contenido específico
    content_type: 'reading', 'video', 'downloadable', 'interactive'
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        
        # Validar tipo de contenido
        valid_types = ['reading', 'video', 'downloadable', 'interactive']
        if content_type not in valid_types:
            return jsonify({'error': f'Tipo de contenido inválido. Use: {", ".join(valid_types)}'}), 400
        
        # Obtener el topic_id según el tipo de contenido
        topic_id = None
        if content_type == 'reading':
            content = StudyReading.query.get(content_id)
            if content:
                topic_id = content.topic_id
        elif content_type == 'video':
            content = StudyVideo.query.get(content_id)
            if content:
                topic_id = content.topic_id
        elif content_type == 'downloadable':
            content = StudyDownloadableExercise.query.get(content_id)
            if content:
                topic_id = content.topic_id
        elif content_type == 'interactive':
            content = StudyInteractiveExercise.query.get(content_id)
            if content:
                topic_id = content.topic_id
        
        if not topic_id:
            return jsonify({'error': 'Contenido no encontrado'}), 404
        
        # Buscar progreso existente o crear uno nuevo
        progress = StudentContentProgress.query.filter_by(
            user_id=user_id,
            content_type=content_type,
            content_id=content_id
        ).first()
        
        if not progress:
            progress = StudentContentProgress(
                user_id=user_id,
                content_type=content_type,
                content_id=content_id,
                topic_id=topic_id
            )
            db.session.add(progress)
        
        # Determinar si está completado según el tipo
        is_completed = data.get('is_completed', False)
        score = data.get('score', None)
        
        # Para interactivos, verificar si la calificación es >= 80%
        if content_type == 'interactive' and score is not None:
            progress.score = score
            if score >= 80:
                is_completed = True
        
        # Actualizar estado de completado
        if is_completed and not progress.is_completed:
            progress.is_completed = True
            progress.completed_at = db.func.now()
        
        db.session.commit()
        
        # Actualizar progreso del tema
        update_topic_progress(user_id, topic_id)
        
        return jsonify({
            'message': 'Progreso registrado exitosamente',
            'progress': progress.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def update_topic_progress(user_id, topic_id):
    """Actualizar el progreso resumen del tema para un usuario"""
    try:
        # Obtener el tema
        topic = StudyTopic.query.get(topic_id)
        if not topic:
            return
        
        # Contar contenidos totales del tema
        total_contents = 0
        content_ids = {
            'reading': [],
            'video': [],
            'downloadable': [],
            'interactive': []
        }
        
        # Lecturas
        readings = StudyReading.query.filter_by(topic_id=topic_id).all()
        for r in readings:
            content_ids['reading'].append(r.id)
            total_contents += 1
        
        # Videos
        videos = StudyVideo.query.filter_by(topic_id=topic_id).all()
        for v in videos:
            content_ids['video'].append(v.id)
            total_contents += 1
        
        # Descargables
        downloadables = StudyDownloadableExercise.query.filter_by(topic_id=topic_id).all()
        for d in downloadables:
            content_ids['downloadable'].append(d.id)
            total_contents += 1
        
        # Interactivos
        interactives = StudyInteractiveExercise.query.filter_by(topic_id=topic_id).all()
        for i in interactives:
            content_ids['interactive'].append(i.id)
            total_contents += 1
        
        # Contar contenidos completados
        completed_contents = 0
        for content_type, ids in content_ids.items():
            if ids:
                completed = StudentContentProgress.query.filter(
                    StudentContentProgress.user_id == user_id,
                    StudentContentProgress.content_type == content_type,
                    StudentContentProgress.content_id.in_(ids),
                    StudentContentProgress.is_completed == True
                ).count()
                completed_contents += completed
        
        # Calcular porcentaje
        progress_percentage = (completed_contents / total_contents * 100) if total_contents > 0 else 0
        
        # Buscar o crear registro de progreso del tema
        topic_progress = StudentTopicProgress.query.filter_by(
            user_id=user_id,
            topic_id=topic_id
        ).first()
        
        if not topic_progress:
            topic_progress = StudentTopicProgress(
                user_id=user_id,
                topic_id=topic_id
            )
            db.session.add(topic_progress)
        
        topic_progress.total_contents = total_contents
        topic_progress.completed_contents = completed_contents
        topic_progress.progress_percentage = progress_percentage
        topic_progress.is_completed = (completed_contents == total_contents and total_contents > 0)
        
        db.session.commit()
        
    except Exception as e:
        print(f"Error actualizando progreso del tema: {e}")
        db.session.rollback()


@study_contents_bp.route('/progress/topic/<int:topic_id>', methods=['GET'])
@jwt_required()
def get_topic_progress(topic_id):
    """Obtener el progreso del estudiante en un tema específico"""
    try:
        user_id = get_jwt_identity()
        
        # Verificar/crear tablas si no existen
        ensure_student_progress_tables()
        
        # Obtener progreso del tema
        topic_progress = StudentTopicProgress.query.filter_by(
            user_id=user_id,
            topic_id=topic_id
        ).first()
        
        # Obtener progreso de cada contenido
        content_progress = StudentContentProgress.query.filter_by(
            user_id=user_id,
            topic_id=topic_id
        ).all()
        
        # Organizar por tipo
        progress_by_type = {
            'reading': {},
            'video': {},
            'downloadable': {},
            'interactive': {}
        }
        
        for p in content_progress:
            progress_by_type[p.content_type][p.content_id] = {
                'is_completed': p.is_completed,
                'score': p.score,
                'completed_at': p.completed_at.isoformat() if p.completed_at else None
            }
        
        return jsonify({
            'topic_progress': topic_progress.to_dict() if topic_progress else {
                'total_contents': 0,
                'completed_contents': 0,
                'progress_percentage': 0,
                'is_completed': False
            },
            'content_progress': progress_by_type
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error in get_topic_progress: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@study_contents_bp.route('/progress/material/<int:material_id>', methods=['GET'])
@jwt_required()
def get_material_progress(material_id):
    """Obtener el progreso del estudiante en todo el material de estudio"""
    try:
        user_id = get_jwt_identity()
        
        # Obtener el material
        material = StudyMaterial.query.get_or_404(material_id)
        
        # Obtener todas las sesiones y temas
        sessions_progress = []
        total_contents = 0
        completed_contents = 0
        
        # Diccionario para almacenar todos los contenidos completados del material
        completed_content_ids = {
            'reading': [],
            'video': [],
            'downloadable': [],
            'interactive': []
        }
        
        # No usar order_by aquí porque ya está definido en la relación del modelo
        for session in material.sessions.all():
            session_data = {
                'session_id': session.id,
                'session_number': session.session_number,
                'title': session.title,
                'topics': []
            }
            
            # No usar order_by aquí porque ya está definido en la relación del modelo
            for topic in session.topics.all():
                # Contar contenidos totales de este tema directamente de las tablas
                topic_total = 0
                topic_completed_count = 0
                
                # Contar lecturas
                readings_count = StudyReading.query.filter_by(topic_id=topic.id).count()
                topic_total += readings_count
                
                # Contar videos
                videos_count = StudyVideo.query.filter_by(topic_id=topic.id).count()
                topic_total += videos_count
                
                # Contar descargables
                downloadables_count = StudyDownloadableExercise.query.filter_by(topic_id=topic.id).count()
                topic_total += downloadables_count
                
                # Contar interactivos
                interactives_count = StudyInteractiveExercise.query.filter_by(topic_id=topic.id).count()
                topic_total += interactives_count
                
                total_contents += topic_total
                
                # Obtener contenidos completados de este tema
                topic_completed = {
                    'reading': [],
                    'video': [],
                    'downloadable': [],
                    'interactive': []
                }
                
                # Obtener todos los content progress completados para este tema
                content_progresses = StudentContentProgress.query.filter_by(
                    user_id=user_id,
                    topic_id=topic.id,
                    is_completed=True
                ).all()
                
                for cp in content_progresses:
                    if cp.content_type in topic_completed:
                        topic_completed[cp.content_type].append(cp.content_id)
                        completed_content_ids[cp.content_type].append(cp.content_id)
                        topic_completed_count += 1
                
                completed_contents += topic_completed_count
                
                # Calcular porcentaje del tema
                topic_percentage = (topic_completed_count / topic_total * 100) if topic_total > 0 else 0
                
                topic_data = {
                    'topic_id': topic.id,
                    'topic_number': topic.order,
                    'title': topic.title,
                    'progress': {
                        'total_contents': topic_total,
                        'completed_contents': topic_completed_count,
                        'progress_percentage': topic_percentage,
                        'is_completed': topic_completed_count == topic_total and topic_total > 0
                    },
                    'completed_contents': topic_completed
                }
                
                session_data['topics'].append(topic_data)
            
            sessions_progress.append(session_data)
        
        # Calcular progreso general del material
        overall_percentage = (completed_contents / total_contents * 100) if total_contents > 0 else 0
        
        return jsonify({
            'material_id': material_id,
            'title': material.title,
            'total_contents': total_contents,
            'completed_contents': completed_contents,
            'progress_percentage': overall_percentage,
            'sessions': sessions_progress,
            'all_completed_contents': completed_content_ids
        }), 200
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error in get_material_progress: {error_traceback}")
        return jsonify({'error': str(e), 'traceback': error_traceback}), 500


# Endpoint de debug para probar progreso sin autenticación
@study_contents_bp.route('/debug-material-progress/<int:material_id>', methods=['GET'])
def debug_material_progress(material_id):
    """Debug endpoint para ver errores de progreso"""
    try:
        # Obtener el material
        material = StudyMaterial.query.get_or_404(material_id)
        
        result = {
            'material_id': material_id,
            'title': material.title,
            'sessions_count': 0,
            'topics_count': 0,
            'total_contents': 0,
            'debug_info': []
        }
        
        # Iterar sesiones
        for session in material.sessions.all():
            result['sessions_count'] += 1
            session_info = {
                'session_id': session.id,
                'session_number': session.session_number,
                'title': session.title,
                'topics': []
            }
            
            # Iterar temas
            for topic in session.topics.all():
                result['topics_count'] += 1
                topic_info = {
                    'topic_id': topic.id,
                    'title': topic.title,
                    'order': topic.order
                }
                
                # Contar contenidos
                readings = StudyReading.query.filter_by(topic_id=topic.id).count()
                videos = StudyVideo.query.filter_by(topic_id=topic.id).count()
                downloadables = StudyDownloadableExercise.query.filter_by(topic_id=topic.id).count()
                interactives = StudyInteractiveExercise.query.filter_by(topic_id=topic.id).count()
                
                topic_info['readings'] = readings
                topic_info['videos'] = videos
                topic_info['downloadables'] = downloadables
                topic_info['interactives'] = interactives
                topic_info['total'] = readings + videos + downloadables + interactives
                
                result['total_contents'] += topic_info['total']
                session_info['topics'].append(topic_info)
            
            result['debug_info'].append(session_info)
        
        return jsonify(result), 200
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@study_contents_bp.route('/debug-list-materials', methods=['GET'])
def debug_list_materials():
    """Debug endpoint para listar materiales sin autenticación"""
    try:
        materials = StudyMaterial.query.all()
        return jsonify({
            'count': len(materials),
            'materials': [{'id': m.id, 'title': m.title} for m in materials]
        }), 200
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@study_contents_bp.route('/debug-test-progress-query', methods=['GET'])
def debug_test_progress_query():
    """Debug endpoint para probar consultas de progreso"""
    try:
        # Probar si podemos consultar la tabla student_content_progress
        result = db.session.execute(text("""
            SELECT TOP 5 * FROM student_content_progress
        """))
        rows = result.fetchall()
        
        # Probar con ORM
        orm_count = StudentContentProgress.query.count()
        
        return jsonify({
            'sql_rows': len(rows),
            'orm_count': orm_count,
            'success': True
        }), 200
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@study_contents_bp.route('/debug-full-progress/<int:material_id>', methods=['GET'])
def debug_full_progress(material_id):
    """Debug endpoint que replica get_material_progress sin autenticación"""
    try:
        user_id = request.args.get('user_id', 'test-user')
        
        # Obtener el material
        material = StudyMaterial.query.get_or_404(material_id)
        
        # Obtener todas las sesiones y temas
        sessions_progress = []
        total_contents = 0
        completed_contents = 0
        
        # Diccionario para almacenar todos los contenidos completados del material
        completed_content_ids = {
            'reading': [],
            'video': [],
            'downloadable': [],
            'interactive': []
        }
        
        # No usar order_by aquí porque ya está definido en la relación del modelo
        for session in material.sessions.all():
            session_data = {
                'session_id': session.id,
                'session_number': session.session_number,
                'title': session.title,
                'topics': []
            }
            
            # No usar order_by aquí porque ya está definido en la relación del modelo
            for topic in session.topics.all():
                # Contar contenidos totales de este tema directamente de las tablas
                topic_total = 0
                topic_completed_count = 0
                
                # Contar lecturas
                readings_count = StudyReading.query.filter_by(topic_id=topic.id).count()
                topic_total += readings_count
                
                # Contar videos
                videos_count = StudyVideo.query.filter_by(topic_id=topic.id).count()
                topic_total += videos_count
                
                # Contar descargables
                downloadables_count = StudyDownloadableExercise.query.filter_by(topic_id=topic.id).count()
                topic_total += downloadables_count
                
                # Contar interactivos
                interactives_count = StudyInteractiveExercise.query.filter_by(topic_id=topic.id).count()
                topic_total += interactives_count
                
                total_contents += topic_total
                
                # Obtener contenidos completados de este tema
                topic_completed = {
                    'reading': [],
                    'video': [],
                    'downloadable': [],
                    'interactive': []
                }
                
                # Obtener todos los content progress completados para este tema
                content_progresses = StudentContentProgress.query.filter_by(
                    user_id=user_id,
                    topic_id=topic.id,
                    is_completed=True
                ).all()
                
                for cp in content_progresses:
                    if cp.content_type in topic_completed:
                        topic_completed[cp.content_type].append(cp.content_id)
                        completed_content_ids[cp.content_type].append(cp.content_id)
                        topic_completed_count += 1
                
                completed_contents += topic_completed_count
                
                # Calcular porcentaje del tema
                topic_percentage = (topic_completed_count / topic_total * 100) if topic_total > 0 else 0
                
                topic_data = {
                    'topic_id': topic.id,
                    'topic_number': topic.order,
                    'title': topic.title,
                    'progress': {
                        'total_contents': topic_total,
                        'completed_contents': topic_completed_count,
                        'progress_percentage': topic_percentage,
                        'is_completed': topic_completed_count == topic_total and topic_total > 0
                    },
                    'completed_contents': topic_completed
                }
                
                session_data['topics'].append(topic_data)
            
            sessions_progress.append(session_data)
        
        # Calcular progreso general del material
        overall_percentage = (completed_contents / total_contents * 100) if total_contents > 0 else 0
        
        return jsonify({
            'material_id': material_id,
            'title': material.title,
            'total_contents': total_contents,
            'completed_contents': completed_contents,
            'progress_percentage': overall_percentage,
            'sessions': sessions_progress,
            'all_completed_contents': completed_content_ids
        }), 200
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500
