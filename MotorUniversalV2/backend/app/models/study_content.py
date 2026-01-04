"""
Modelos de Contenidos de Estudio
Estructura: Material de Estudio → Sesiones → Temas → (Lectura, Video, Ejercicio Descargable, Ejercicio Interactivo)
"""
from datetime import datetime
from app import db
import re


def normalize_html_spaces(html_content: str) -> str:
    """
    Normaliza espacios no rompibles (\xa0, &nbsp;) a espacios normales.
    Esto permite que el CSS del navegador maneje el ajuste de línea automáticamente.
    """
    if not html_content:
        return html_content
    
    # Reemplazar espacios no rompibles con espacios normales
    # Esto permite el ajuste de línea natural por el navegador
    return html_content.replace('\xa0', ' ').replace('&nbsp;', ' ')


# Tabla de asociación para relación muchos a muchos entre materiales y exámenes
study_material_exams = db.Table('study_material_exams',
    db.Column('study_material_id', db.Integer, db.ForeignKey('study_contents.id', ondelete='CASCADE'), primary_key=True),
    db.Column('exam_id', db.Integer, db.ForeignKey('exams.id', ondelete='CASCADE'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)


class StudyMaterial(db.Model):
    """Modelo de material de estudio (curso principal)"""
    
    __tablename__ = 'study_contents'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.Text)
    is_published = db.Column(db.Boolean, default=False, nullable=False)
    order = db.Column(db.Integer, default=0)
    
    # Campo legacy para compatibilidad (se mantiene por ahora)
    exam_id = db.Column(db.Integer, db.ForeignKey('exams.id'), nullable=True)
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    sessions = db.relationship('StudySession', backref='material', lazy='dynamic', cascade='all, delete-orphan', order_by='StudySession.session_number')
    exam = db.relationship('Exam', backref='study_materials', foreign_keys=[exam_id])
    # Nueva relación muchos a muchos
    exams = db.relationship('Exam', secondary=study_material_exams, backref=db.backref('linked_study_materials', lazy='dynamic'))
    
    def to_dict(self, include_sessions=False):
        """Convierte el material a diccionario"""
        # Obtener lista de exámenes vinculados (con manejo de error si la tabla no existe)
        linked_exams = []
        exam_ids = []
        try:
            if self.exams:
                linked_exams = [{
                    'id': e.id,
                    'name': e.name,
                    'version': e.version
                } for e in self.exams]
                exam_ids = [e.id for e in self.exams]
        except Exception:
            # La tabla study_material_exams puede no existir aún
            pass
        
        # Calcular total de sesiones y temas
        sessions_count = self.sessions.count() if self.sessions else 0
        topics_count = 0
        if self.sessions:
            for session in self.sessions.all():
                topics_count += session.topics.count() if session.topics else 0
        
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'image_url': self.image_url,
            'is_published': self.is_published,
            'order': self.order,
            'exam_id': self.exam_id,
            'exam_title': self.exam.title if self.exam else None,
            'exam_ids': exam_ids,
            'linked_exams': linked_exams,
            'sessions_count': sessions_count,
            'topics_count': topics_count,
            'total_sessions': sessions_count,  # Para compatibilidad
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_by': self.updated_by,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_sessions:
            data['sessions'] = [s.to_dict(include_topics=True) for s in self.sessions.all()]
        
        return data


class StudySession(db.Model):
    """Modelo de sesión de estudio"""
    
    __tablename__ = 'study_sessions'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    material_id = db.Column(db.Integer, db.ForeignKey('study_contents.id', ondelete='CASCADE'), nullable=False)
    session_number = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    topics = db.relationship('StudyTopic', backref='session', lazy='dynamic', cascade='all, delete-orphan', order_by='StudyTopic.order')
    
    def to_dict(self, include_topics=False):
        """Convierte la sesión a diccionario"""
        data = {
            'id': self.id,
            'material_id': self.material_id,
            'session_number': self.session_number,
            'title': self.title,
            'description': self.description,
            'total_topics': self.topics.count() if self.topics else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_topics:
            data['topics'] = [t.to_dict(include_elements=True) for t in self.topics.all()]
        
        return data


class StudyTopic(db.Model):
    """Modelo de tema de estudio (contiene los 4 elementos)"""
    
    __tablename__ = 'study_topics'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('study_sessions.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    
    # Tipos de elementos permitidos (por defecto todos habilitados)
    allow_reading = db.Column(db.Boolean, default=True, nullable=False)
    allow_video = db.Column(db.Boolean, default=True, nullable=False)
    allow_downloadable = db.Column(db.Boolean, default=True, nullable=False)
    allow_interactive = db.Column(db.Boolean, default=True, nullable=False)
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones con los 4 elementos
    reading = db.relationship('StudyReading', backref='topic', uselist=False, cascade='all, delete-orphan')
    video = db.relationship('StudyVideo', backref='topic', uselist=False, cascade='all, delete-orphan')
    downloadable_exercise = db.relationship('StudyDownloadableExercise', backref='topic', uselist=False, cascade='all, delete-orphan')
    interactive_exercise = db.relationship('StudyInteractiveExercise', backref='topic', uselist=False, cascade='all, delete-orphan')
    
    def to_dict(self, include_elements=False):
        """Convierte el tema a diccionario"""
        data = {
            'id': self.id,
            'session_id': self.session_id,
            'title': self.title,
            'description': self.description,
            'order': self.order,
            'allow_reading': self.allow_reading if self.allow_reading is not None else True,
            'allow_video': self.allow_video if self.allow_video is not None else True,
            'allow_downloadable': self.allow_downloadable if self.allow_downloadable is not None else True,
            'allow_interactive': self.allow_interactive if self.allow_interactive is not None else True,
            'has_reading': self.reading is not None,
            'has_video': self.video is not None,
            'has_downloadable': self.downloadable_exercise is not None,
            'has_interactive': self.interactive_exercise is not None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_elements:
            data['reading'] = self.reading.to_dict() if self.reading else None
            data['video'] = self.video.to_dict() if self.video else None
            data['downloadable_exercise'] = self.downloadable_exercise.to_dict() if self.downloadable_exercise else None
            data['interactive_exercise'] = self.interactive_exercise.to_dict(include_steps=True) if self.interactive_exercise else None
        
        return data


class StudyReading(db.Model):
    """Modelo de lectura de estudio (uno por tema)"""
    
    __tablename__ = 'study_readings'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('study_topics.id', ondelete='CASCADE'), nullable=False, unique=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text)
    estimated_time_minutes = db.Column(db.Integer)
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self, wrap_content: bool = True):
        """Convierte la lectura a diccionario"""
        # Normalizar espacios para permitir ajuste de línea automático por CSS
        processed_content = normalize_html_spaces(self.content) if self.content else self.content
        
        return {
            'id': self.id,
            'topic_id': self.topic_id,
            'title': self.title,
            'content': processed_content,
            'estimated_time_minutes': self.estimated_time_minutes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class StudyVideo(db.Model):
    """Modelo de video de estudio (uno por tema)"""
    
    __tablename__ = 'study_videos'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('study_topics.id', ondelete='CASCADE'), nullable=False, unique=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    video_url = db.Column(db.Text, nullable=False)
    video_type = db.Column(db.String(50), default='youtube')
    thumbnail_url = db.Column(db.Text)
    duration_minutes = db.Column(db.Integer)
    video_width = db.Column(db.Integer)  # Ancho del video en pixels
    video_height = db.Column(db.Integer)  # Alto del video en pixels
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convierte el video a diccionario"""
        return {
            'id': self.id,
            'topic_id': self.topic_id,
            'title': normalize_html_spaces(self.title) if self.title else self.title,
            'description': normalize_html_spaces(self.description) if self.description else self.description,
            'video_url': self.video_url,
            'video_type': self.video_type,
            'thumbnail_url': self.thumbnail_url,
            'duration_minutes': self.duration_minutes,
            'video_width': self.video_width,
            'video_height': self.video_height,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class StudyDownloadableExercise(db.Model):
    """Modelo de ejercicio descargable (uno por tema)"""
    
    __tablename__ = 'study_downloadable_exercises'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('study_topics.id', ondelete='CASCADE'), nullable=False, unique=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    file_url = db.Column(db.Text, nullable=False)
    file_name = db.Column(db.String(255))
    file_type = db.Column(db.String(50))
    file_size_bytes = db.Column(db.Integer)
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convierte el ejercicio descargable a diccionario"""
        return {
            'id': self.id,
            'topic_id': self.topic_id,
            'title': normalize_html_spaces(self.title) if self.title else self.title,
            'description': normalize_html_spaces(self.description) if self.description else self.description,
            'file_url': self.file_url,
            'file_name': self.file_name,
            'file_type': self.file_type,
            'file_size_bytes': self.file_size_bytes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class StudyInteractiveExercise(db.Model):
    """Modelo de ejercicio interactivo (uno por tema)"""
    
    __tablename__ = 'study_interactive_exercises'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.String(36), primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('study_topics.id', ondelete='CASCADE'), nullable=False, unique=True)
    title = db.Column(db.String(500))
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relación con pasos
    steps = db.relationship('StudyInteractiveExerciseStep', backref='exercise', lazy='dynamic', cascade='all, delete-orphan', order_by='StudyInteractiveExerciseStep.step_number')
    
    def to_dict(self, include_steps=False):
        """Convierte el ejercicio a diccionario"""
        data = {
            'id': self.id,
            'topic_id': self.topic_id,
            'title': normalize_html_spaces(self.title) if self.title else '',
            'description': normalize_html_spaces(self.description) if self.description else '',
            'is_active': self.is_active,
            'is_complete': not self.is_active if self.is_active is not None else False,
            'total_steps': self.steps.count() if self.steps else 0,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_by': self.updated_by,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_steps:
            data['steps'] = [step.to_dict(include_actions=True) for step in self.steps.all()]
        
        return data


class StudyInteractiveExerciseStep(db.Model):
    """Modelo de paso de ejercicio interactivo de estudio"""
    
    __tablename__ = 'study_interactive_exercise_steps'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.String(36), primary_key=True)
    exercise_id = db.Column(db.String(36), db.ForeignKey('study_interactive_exercises.id', ondelete='CASCADE'), nullable=False)
    step_number = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    image_url = db.Column(db.Text)
    image_width = db.Column(db.Integer)
    image_height = db.Column(db.Integer)
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relación con acciones
    actions = db.relationship('StudyInteractiveExerciseAction', backref='step', lazy='dynamic', cascade='all, delete-orphan', order_by='StudyInteractiveExerciseAction.action_number')
    
    def to_dict(self, include_actions=False):
        """Convierte el paso a diccionario"""
        data = {
            'id': self.id,
            'exercise_id': self.exercise_id,
            'step_number': self.step_number,
            'title': normalize_html_spaces(self.title) if self.title else self.title,
            'description': normalize_html_spaces(self.description) if self.description else self.description,
            'image_url': self.image_url,
            'image_width': self.image_width,
            'image_height': self.image_height,
            'total_actions': self.actions.count() if self.actions else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_actions:
            data['actions'] = [action.to_dict() for action in self.actions.all()]
        
        return data


class StudyInteractiveExerciseAction(db.Model):
    """Modelo de acción de ejercicio interactivo de estudio"""
    
    __tablename__ = 'study_interactive_exercise_actions'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.String(36), primary_key=True)
    step_id = db.Column(db.String(36), db.ForeignKey('study_interactive_exercise_steps.id', ondelete='CASCADE'), nullable=False)
    action_number = db.Column(db.Integer, nullable=False)
    action_type = db.Column(db.String(20), nullable=False)
    
    # Posición y tamaño
    position_x = db.Column(db.Float, nullable=False)
    position_y = db.Column(db.Float, nullable=False)
    width = db.Column(db.Float, nullable=False)
    height = db.Column(db.Float, nullable=False)
    
    # Configuración
    label = db.Column(db.String(255))
    placeholder = db.Column(db.String(255))
    correct_answer = db.Column(db.Text)
    is_case_sensitive = db.Column(db.Boolean, default=False)
    
    # Scoring y manejo de errores
    scoring_mode = db.Column(db.String(20), default='exact')
    on_error_action = db.Column(db.String(20), default='next_step')
    error_message = db.Column(db.Text)
    max_attempts = db.Column(db.Integer, default=3)
    
    # Personalización
    text_color = db.Column(db.String(20), default='#000000')
    font_family = db.Column(db.String(50), default='Arial')
    label_style = db.Column(db.String(20), default='invisible')  # invisible, text_only, text_with_shadow, shadow_only
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convierte la acción a diccionario"""
        return {
            'id': self.id,
            'step_id': self.step_id,
            'action_number': self.action_number,
            'action_type': self.action_type,
            'position_x': self.position_x,
            'position_y': self.position_y,
            'width': self.width,
            'height': self.height,
            'label': normalize_html_spaces(self.label) if self.label else self.label,
            'placeholder': normalize_html_spaces(self.placeholder) if self.placeholder else self.placeholder,
            'correct_answer': self.correct_answer,
            'is_case_sensitive': self.is_case_sensitive,
            'scoring_mode': self.scoring_mode,
            'on_error_action': self.on_error_action,
            'error_message': normalize_html_spaces(self.error_message) if self.error_message else self.error_message,
            'max_attempts': self.max_attempts,
            'text_color': self.text_color,
            'font_family': self.font_family,
            'label_style': self.label_style,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
