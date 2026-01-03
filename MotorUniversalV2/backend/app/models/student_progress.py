"""
Modelo para el progreso del estudiante en contenidos de estudio
"""
from datetime import datetime
from app import db


class StudentContentProgress(db.Model):
    """Registra el progreso del estudiante en cada contenido (lectura, video, etc.)"""
    
    __tablename__ = 'student_content_progress'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    # Tipo de contenido: 'reading', 'video', 'downloadable', 'interactive'
    content_type = db.Column(db.String(50), nullable=False)
    
    # ID del contenido específico (study_readings.id, study_videos.id, etc.)
    content_id = db.Column(db.Integer, nullable=False)
    
    # ID del tema al que pertenece el contenido
    topic_id = db.Column(db.Integer, db.ForeignKey('study_topics.id'), nullable=False)
    
    # Estado de completado
    is_completed = db.Column(db.Boolean, default=False, nullable=False)
    
    # Para ejercicios interactivos: última calificación obtenida (0-100)
    score = db.Column(db.Float, nullable=True)
    
    # Fecha de completado
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('user_id', 'content_type', 'content_id', name='unique_user_content_progress'),
        {'extend_existing': True}
    )
    
    def to_dict(self):
        """Convierte el progreso a diccionario"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'content_type': self.content_type,
            'content_id': self.content_id,
            'topic_id': self.topic_id,
            'is_completed': self.is_completed,
            'score': self.score,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class StudentTopicProgress(db.Model):
    """Resumen del progreso del estudiante por tema (calculado)"""
    
    __tablename__ = 'student_topic_progress'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    topic_id = db.Column(db.Integer, db.ForeignKey('study_topics.id'), nullable=False)
    
    # Contadores de progreso
    total_contents = db.Column(db.Integer, default=0)
    completed_contents = db.Column(db.Integer, default=0)
    
    # Porcentaje de progreso (0-100)
    progress_percentage = db.Column(db.Float, default=0.0)
    
    # Estado general del tema
    is_completed = db.Column(db.Boolean, default=False, nullable=False)
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Índice único
    __table_args__ = (
        db.UniqueConstraint('user_id', 'topic_id', name='unique_user_topic_progress'),
        {'extend_existing': True}
    )
    
    def to_dict(self):
        """Convierte el progreso a diccionario"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'topic_id': self.topic_id,
            'total_contents': self.total_contents,
            'completed_contents': self.completed_contents,
            'progress_percentage': self.progress_percentage,
            'is_completed': self.is_completed,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
