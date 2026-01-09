"""
Modelo de Pregunta
"""
from datetime import datetime
from app import db


class QuestionType(db.Model):
    """Tipos de preguntas"""
    
    __tablename__ = 'question_types'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)  # multiple_choice, true_false, fill_blank
    description = db.Column(db.String(255))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }


class Question(db.Model):
    """Modelo de pregunta"""
    
    __tablename__ = 'questions'
    
    id = db.Column(db.String(36), primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('topics.id'), nullable=False)
    question_type_id = db.Column(db.Integer, db.ForeignKey('question_types.id'), nullable=False)
    question_number = db.Column(db.Integer, nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(500))  # URL de imagen en Azure Blob
    points = db.Column(db.Integer, default=1)  # Puntos que vale la pregunta
    difficulty = db.Column(db.String(20), default='medium')  # easy, medium, hard
    type = db.Column(db.String(20), default='exam', nullable=False)  # exam, simulator
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    question_type = db.relationship('QuestionType', backref='questions')
    answers = db.relationship('Answer', backref='question', lazy='dynamic', cascade='all, delete-orphan', order_by='Answer.answer_number')
    
    def __init__(self, **kwargs):
        super(Question, self).__init__(**kwargs)
        if not self.id:
            import uuid
            self.id = str(uuid.uuid4())
    
    def get_correct_answers(self):
        """Obtener respuestas correctas"""
        return [a for a in self.answers if a.is_correct]
    
    def to_dict(self, include_answers=True, include_correct=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'topic_id': self.topic_id,
            'question_type': self.question_type.to_dict() if self.question_type else None,
            'question_number': self.question_number,
            'question_text': self.question_text,
            'image_url': self.image_url,
            'points': self.points,
            'difficulty': self.difficulty,
            'type': self.type or 'exam',  # exam o simulator
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
        if include_answers:
            data['answers'] = [a.to_dict(include_correct=include_correct) for a in self.answers]
        
        return data
    
    def __repr__(self):
        return f'<Question {self.id}>'
