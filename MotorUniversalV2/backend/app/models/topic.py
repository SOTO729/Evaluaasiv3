"""
Modelo de Tema
"""
from datetime import datetime
from app import db


class Topic(db.Model):
    """Modelo de tema dentro de una categoría"""
    
    __tablename__ = 'topics'
    
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    questions = db.relationship('Question', backref='topic', lazy='dynamic', cascade='all, delete-orphan')
    exercises = db.relationship('Exercise', backref='topic', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_details=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'category_id': self.category_id,
            'name': self.name,
            'description': self.description,
            'order': self.order,
            'total_questions': self.questions.count(),
            'total_exercises': self.exercises.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
        if include_details:
            data['questions'] = [q.to_dict() for q in self.questions]
            data['exercises'] = [e.to_dict() for e in self.exercises]
        
        return data
    
    def __repr__(self):
        return f'<Topic {self.name}>'
