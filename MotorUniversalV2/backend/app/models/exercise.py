"""
Modelo de Ejercicio
"""
from datetime import datetime
from app import db


class Exercise(db.Model):
    """Modelo de ejercicio"""
    
    __tablename__ = 'exercises'
    __table_args__ = {'extend_existing': True}
    
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
    
    # Relación con pasos
    steps = db.relationship('ExerciseStep', backref='exercise', lazy='dynamic', cascade='all, delete-orphan', order_by='ExerciseStep.step_number')
    
    def __init__(self, **kwargs):
        super(Exercise, self).__init__(**kwargs)
    
    def to_dict(self, include_steps=False):
        """Convierte el ejercicio a diccionario"""
        data = {
            'id': self.id,
            'topic_id': self.topic_id,
            'exercise_number': self.exercise_number,
            'title': self.title or '',
            'exercise_text': self.description or '',  # Mapear description a exercise_text para compatibilidad
            'is_complete': not self.is_active if self.is_active is not None else False,  # Invertir is_active a is_complete
            'total_steps': self.steps.count() if self.steps else 0,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_by': self.updated_by,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_steps:
            data['steps'] = [step.to_dict(include_actions=True) for step in self.steps.all()]
        
        return data


class ExerciseStep(db.Model):
    """Modelo de paso/imagen de ejercicio"""
    
    __tablename__ = 'exercise_steps'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.String(36), primary_key=True)
    exercise_id = db.Column(db.String(36), db.ForeignKey('exercises.id'), nullable=False)
    step_number = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    image_url = db.Column(db.Text)  # URL o base64 de la imagen
    image_width = db.Column(db.Integer)  # Ancho original de la imagen
    image_height = db.Column(db.Integer)  # Alto original de la imagen
    
    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relación con acciones
    actions = db.relationship('ExerciseAction', backref='step', lazy='dynamic', cascade='all, delete-orphan', order_by='ExerciseAction.action_number')
    
    def to_dict(self, include_actions=False):
        """Convierte el paso a diccionario"""
        data = {
            'id': self.id,
            'exercise_id': self.exercise_id,
            'step_number': self.step_number,
            'title': self.title,
            'description': self.description,
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


class ExerciseAction(db.Model):
    """Modelo de acción (botón o campo de texto) sobre una imagen"""
    
    __tablename__ = 'exercise_actions'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.String(36), primary_key=True)
    step_id = db.Column(db.String(36), db.ForeignKey('exercise_steps.id'), nullable=False)
    action_number = db.Column(db.Integer, nullable=False)
    action_type = db.Column(db.String(20), nullable=False)  # 'button' o 'textbox'
    
    # Posición y tamaño (porcentajes relativos a la imagen)
    position_x = db.Column(db.Float, nullable=False)  # Porcentaje desde la izquierda (0-100)
    position_y = db.Column(db.Float, nullable=False)  # Porcentaje desde arriba (0-100)
    width = db.Column(db.Float, nullable=False)  # Ancho en porcentaje
    height = db.Column(db.Float, nullable=False)  # Alto en porcentaje
    
    # Configuración
    label = db.Column(db.String(255))  # Etiqueta opcional para mostrar
    placeholder = db.Column(db.String(255))  # Placeholder para textbox
    correct_answer = db.Column(db.Text)  # Respuesta correcta (para textbox) o identificador del clic correcto
    is_case_sensitive = db.Column(db.Boolean, default=False)  # Para comparación de texto
    
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
            'label': self.label,
            'placeholder': self.placeholder,
            'correct_answer': self.correct_answer,
            'is_case_sensitive': self.is_case_sensitive,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

