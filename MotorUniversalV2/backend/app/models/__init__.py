"""
Modelos de base de datos
"""
from app.models.user import User
from app.models.exam import Exam
from app.models.category import Category
from app.models.topic import Topic
from app.models.question import Question
from app.models.answer import Answer
from app.models.exercise import Exercise
from app.models.voucher import Voucher
from app.models.result import Result

__all__ = [
    'User',
    'Exam',
    'Category',
    'Topic',
    'Question',
    'Answer',
    'Exercise',
    'Voucher',
    'Result'
]
