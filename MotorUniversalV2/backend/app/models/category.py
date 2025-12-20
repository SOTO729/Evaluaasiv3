"""
Modelo de Categoría
"""
from datetime import datetime
from app import db


class Category(db.Model):
    """Modelo de categoría de examen"""
    
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exams.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    percentage = db.Column(db.Integer, nullable=False)  # Peso en el examen (%)
    order = db.Column(db.Integer, default=0)  # Orden de presentación
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    topics = db.relationship('Topic', backref='category', lazy='dynamic', cascade='all, delete-orphan', order_by='Topic.order')
    
    def to_dict(self, include_details=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'exam_id': self.exam_id,
            'name': self.name,
            'description': self.description,
            'percentage': self.percentage,
            'order': self.order,
            'total_topics': self.topics.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
        if include_details:
            data['topics'] = [topic.to_dict(include_details=True) for topic in self.topics]
        
        return data
    
    def __repr__(self):
        return f'<Category {self.name}>'
