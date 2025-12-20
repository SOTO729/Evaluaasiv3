"""
Modelo de Examen
"""
from datetime import datetime
from app import db


class Exam(db.Model):
    """Modelo de examen"""
    
    __tablename__ = 'exams'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    version = db.Column(db.String(10), nullable=False)
    standard = db.Column(db.String(15))
    stage_id = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    instructions = db.Column(db.Text)
    duration_minutes = db.Column(db.Integer)  # Duración en minutos
    passing_score = db.Column(db.Integer, default=70)  # Puntaje mínimo para aprobar
    
    # Estado
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_published = db.Column(db.Boolean, default=False, nullable=False)
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    categories = db.relationship('Category', backref='exam', lazy='dynamic', cascade='all, delete-orphan', order_by='Category.order')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_exams')
    updater = db.relationship('User', foreign_keys=[updated_by], backref='updated_exams')
    
    def get_total_questions(self):
        """Calcular total de preguntas del examen"""
        total = 0
        for category in self.categories:
            for topic in category.topics:
                total += topic.questions.count()
        return total
    
    def get_total_exercises(self):
        """Calcular total de ejercicios del examen"""
        total = 0
        for category in self.categories:
            for topic in category.topics:
                total += topic.exercises.count()
        return total
    
    def to_dict(self, include_details=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'name': self.name,
            'version': self.version,
            'standard': self.standard,
            'stage_id': self.stage_id,
            'description': self.description,
            'duration_minutes': self.duration_minutes,
            'passing_score': self.passing_score,
            'is_active': self.is_active,
            'is_published': self.is_published,
            'total_questions': self.get_total_questions(),
            'total_exercises': self.get_total_exercises(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_details:
            data['instructions'] = self.instructions
            data['categories'] = [cat.to_dict(include_details=True) for cat in self.categories]
        
        return data
    
    def __repr__(self):
        return f'<Exam {self.name} v{self.version}>'
