"""
Módulo de rutas de exámenes - Estructura modular para escalabilidad

Este módulo organiza las rutas de exámenes en submódulos:
- crud.py: Operaciones CRUD básicas de exámenes
- categories.py: Gestión de categorías y temas
- questions.py: Gestión de preguntas y respuestas
- exercises.py: Gestión de ejercicios interactivos
- evaluation.py: Lógica de evaluación de exámenes
- pdf_generator.py: Generación de PDFs y certificados
- publishing.py: Publicación y validación de exámenes

Todas las rutas se registran en un Blueprint común 'exams'
"""
from flask import Blueprint

# Blueprint principal
bp = Blueprint('exams', __name__)

# Importar y registrar todas las rutas de los submódulos
from . import crud
from . import categories
from . import questions
from . import exercises
from . import evaluation
from . import pdf_generator
from . import publishing
from . import utils

# Re-exportar el require_permission para uso en otros módulos
from .utils import require_permission
