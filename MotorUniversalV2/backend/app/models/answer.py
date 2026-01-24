"""
Modelo de Respuesta
"""
from datetime import datetime
from app import db


class Answer(db.Model):
    """Modelo de respuesta a una pregunta"""
    
    __tablename__ = 'answers'
    
    id = db.Column(db.String(36), primary_key=True)
    question_id = db.Column(db.String(36), db.ForeignKey('questions.id'), nullable=False, index=True)
    answer_number = db.Column(db.Integer)  # A, B, C, D (1, 2, 3, 4) - opcional para verdadero/falso
    answer_text = db.Column(db.Text, nullable=False)
    is_correct = db.Column(db.Boolean, default=False, nullable=False)
    explanation = db.Column(db.Text)  # Explicación de por qué es correcta/incorrecta
    correct_answer = db.Column(db.String(100))  # Para drag_drop: zona correcta, para column_grouping: columna correcta
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __init__(self, **kwargs):
        super(Answer, self).__init__(**kwargs)
        if not self.id:
            import uuid
            self.id = str(uuid.uuid4())
    
    def to_dict(self, include_correct=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'question_id': self.question_id,
            'answer_number': self.answer_number,
            'answer_text': self.answer_text,
            'correct_answer': self.correct_answer  # Para drag_drop y column_grouping
        }
        
        # Solo incluir si es correcto cuando se solicita (para evaluación)
        if include_correct:
            data['is_correct'] = self.is_correct
            data['explanation'] = self.explanation
        
        return data
    
    def __repr__(self):
        return f'<Answer {self.id} - {"Correct" if self.is_correct else "Incorrect"}>'
