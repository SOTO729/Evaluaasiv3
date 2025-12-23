"""
Entry point de la aplicación
"""
from app import create_app
import os

app = create_app(os.getenv('FLASK_ENV', 'development'))

# Auto-migración: Agregar columnas faltantes si no existen
with app.app_context():
    try:
        from app.auto_migrate import check_and_add_columns
        check_and_add_columns()
    except Exception as e:
        print(f"⚠️  Auto-migración falló (continuando de todas formas): {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
