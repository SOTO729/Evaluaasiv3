"""
Script para crear las tablas de pasos y acciones de ejercicios
"""
import os
import sys

# Agregar el directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import ExerciseStep, ExerciseAction

def create_exercise_tables():
    """Crear las tablas exercise_steps y exercise_actions si no existen"""
    app = create_app()
    
    with app.app_context():
        # Crear las tablas
        db.create_all()
        print("Tablas creadas correctamente:")
        print("- exercise_steps")
        print("- exercise_actions")

if __name__ == '__main__':
    create_exercise_tables()
