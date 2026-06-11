"""
Modelo de progreso (borrador) de examen en curso.

Permite guardar periódicamente el avance del candidato en el servidor (no solo en
localStorage), de modo que si pierde o cambia de dispositivo pueda recuperar el
intento. Hay como máximo un borrador por (usuario, examen); se elimina al entregar.
"""
from datetime import datetime
from app import db


class ExamProgress(db.Model):
    __tablename__ = 'exam_progress'

    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), nullable=False, index=True)
    exam_id = db.Column(db.Integer, nullable=False, index=True)
    attempt_id = db.Column(db.String(64), nullable=True)
    data = db.Column(db.JSON)  # answers, exerciseResponses, índice actual, etc.
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'exam_id', name='uq_exam_progress_user_exam'),
    )

    def to_dict(self):
        return {
            'attempt_id': self.attempt_id,
            'data': self.data,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
