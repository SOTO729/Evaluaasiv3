"""
Migración para agregar columna attachments a balance_requests
"""
import os
import sys

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text, inspect

def add_attachments_column():
    """Agregar columna attachments a balance_requests"""
    app = create_app()
    
    with app.app_context():
        try:
            # Verificar si la columna ya existe usando inspector
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('balance_requests')]
            
            if 'attachments' in columns:
                print("✓ La columna 'attachments' ya existe en balance_requests")
                return
            
            # Agregar columna
            alter_sql = text("""
                ALTER TABLE balance_requests 
                ADD COLUMN attachments TEXT NULL
            """)
            db.session.execute(alter_sql)
            db.session.commit()
            
            print("✓ Columna 'attachments' agregada exitosamente a balance_requests")
            
        except Exception as e:
            db.session.rollback()
            print(f"✗ Error al agregar columna: {str(e)}")
            raise e

if __name__ == '__main__':
    add_attachments_column()
