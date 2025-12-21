"""
Script para agregar la columna image_url a la tabla exams
"""
import os
import sys

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db

app = create_app()

with app.app_context():
    try:
        # Intentar agregar la columna
        db.engine.execute('ALTER TABLE exams ADD image_url NVARCHAR(MAX)')
        print('✅ Columna image_url agregada exitosamente a la tabla exams')
    except Exception as e:
        error_str = str(e).lower()
        if 'already' in error_str or 'duplicate' in error_str or 'exist' in error_str:
            print('ℹ️  La columna image_url ya existe en la tabla exams')
        else:
            print(f'❌ Error al agregar columna: {e}')
            sys.exit(1)
