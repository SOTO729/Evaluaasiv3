"""
Script para agregar la columna percentage a las tablas questions y exercises
"""
import os
import sys

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text

def add_percentage_column():
    """Agregar columna percentage a questions y exercises"""
    app = create_app()
    
    with app.app_context():
        try:
            # Verificar si la columna existe en questions
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'questions' AND column_name = 'percentage'
            """))
            
            if not result.fetchone():
                print("Agregando columna 'percentage' a la tabla 'questions'...")
                db.session.execute(text("""
                    ALTER TABLE questions 
                    ADD COLUMN percentage FLOAT DEFAULT 0
                """))
                db.session.commit()
                print("✓ Columna 'percentage' agregada a 'questions'")
            else:
                print("✓ La columna 'percentage' ya existe en 'questions'")
            
            # Verificar si la columna existe en exercises
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'exercises' AND column_name = 'percentage'
            """))
            
            if not result.fetchone():
                print("Agregando columna 'percentage' a la tabla 'exercises'...")
                db.session.execute(text("""
                    ALTER TABLE exercises 
                    ADD COLUMN percentage FLOAT DEFAULT 0
                """))
                db.session.commit()
                print("✓ Columna 'percentage' agregada a 'exercises'")
            else:
                print("✓ La columna 'percentage' ya existe en 'exercises'")
            
            print("\n✅ Migración completada exitosamente")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error durante la migración: {e}")
            raise

if __name__ == '__main__':
    add_percentage_column()
