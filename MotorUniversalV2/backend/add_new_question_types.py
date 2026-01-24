"""
Script para agregar nuevos tipos de pregunta: drag_drop y column_grouping
"""
import os
import sys

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models.question import QuestionType

def add_new_question_types():
    """Agregar nuevos tipos de pregunta a la base de datos"""
    app = create_app()
    
    with app.app_context():
        # Nuevos tipos a agregar
        new_types = [
            ('drag_drop', 'Arrastrar y Soltar'),
            ('column_grouping', 'Agrupamiento en Columnas'),
        ]
        
        for name, description in new_types:
            # Verificar si ya existe
            existing = QuestionType.query.filter_by(name=name).first()
            if existing:
                print(f"  ✓ Tipo '{name}' ya existe (ID: {existing.id})")
            else:
                new_type = QuestionType(name=name, description=description)
                db.session.add(new_type)
                print(f"  + Agregando tipo '{name}'...")
        
        db.session.commit()
        
        # Mostrar todos los tipos
        print("\n📋 Tipos de pregunta disponibles:")
        for qt in QuestionType.query.order_by(QuestionType.id).all():
            print(f"   {qt.id}: {qt.name} - {qt.description}")
        
        print("\n✅ Migración completada exitosamente")

if __name__ == '__main__':
    print("🔧 Agregando nuevos tipos de pregunta...")
    add_new_question_types()
