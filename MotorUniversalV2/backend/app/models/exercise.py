"""
Modelo de Ejercicio
"""
from datetime import datetime
from app import db


class Exercise(db.Model):
    """Modelo de ejercicio"""
    
    __tablename__ = 'exercises'
    
    id = db.Column(db.String(36), primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('topics.id'), nullable=False)
    exercise_number = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(500))
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __init__(self, **kwargs):
        super(Exercise, self).__init__(**kwargs)
    
    def to_dict(self):
        """Convierte el ejercicio a diccionario"""
        return {
            'id': self.id,
            'topic_id': self.topic_id,
            'exercise_number': self.exercise_number,
            'exercise_text': self.description or '',  # Mapear description a exercise_text para compatibilidad
            'is_complete': not self.is_active if self.is_active is not None else False,  # Invertir is_active a is_complete
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_by': self.updated_by,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
