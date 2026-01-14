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
    version = db.Column(db.String(50), nullable=False)  # Versión del examen (ej: 1.0, 2.0)
    standard = db.Column(db.String(15))  # Deprecated: usar competency_standard_id
    stage_id = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    instructions = db.Column(db.Text)
    duration_minutes = db.Column(db.Integer)  # Duración en minutos
    passing_score = db.Column(db.Integer, default=70)  # Puntaje mínimo para aprobar
    image_url = db.Column(db.Text)  # URL o base64 de la imagen del examen
    
    # Relación con Estándar de Competencia (ECM)
    competency_standard_id = db.Column(db.Integer, db.ForeignKey('competency_standards.id'), nullable=True)
    
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
        # Obtener las categorías como lista (lazy='dynamic' devuelve una query)
        categories_list = self.categories.all()
        
        data = {
            'id': self.id,
            'name': self.name,
            'version': self.version,
            'standard': self.standard,
            'competency_standard_id': self.competency_standard_id,
            'stage_id': self.stage_id,
            'description': self.description,
            'duration_minutes': self.duration_minutes,
            'passing_score': self.passing_score,
            'image_url': self.image_url,
            'is_active': self.is_active,
            'is_published': self.is_published,
            'total_questions': self.get_total_questions(),
            'total_exercises': self.get_total_exercises(),
            'total_categories': len(categories_list),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'categories': [{'id': cat.id, 'name': cat.name, 'percentage': cat.percentage} for cat in categories_list]  # Siempre incluir resumen de categorías
        }
        
        # Incluir info del estándar de competencia si existe
        if self.competency_standard:
            data['competency_standard'] = {
                'id': self.competency_standard.id,
                'code': self.competency_standard.code,
                'name': self.competency_standard.name
            }
        
        if include_details:
            data['instructions'] = self.instructions
            data['categories'] = [cat.to_dict(include_details=True) for cat in categories_list]
        
        return data
    
    def __repr__(self):
        return f'<Exam {self.name} v{self.version}>'
