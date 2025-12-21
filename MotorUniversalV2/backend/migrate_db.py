"""
Script simple para agregar columna image_url
"""
from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Intentar agregar la columna
        db.session.execute(text('ALTER TABLE exams ADD image_url NVARCHAR(MAX)'))
        db.session.commit()
        print('✅ Columna image_url agregada exitosamente')
    except Exception as e:
        error_str = str(e).lower()
        if 'already' in error_str or 'duplicate' in error_str or 'exist' in error_str:
            print('ℹ️  La columna image_url ya existe')
        else:
            print(f'Error: {e}')
            # Intentar de otra forma
            try:
                db.session.rollback()
                result = db.session.execute(text("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'exams' AND COLUMN_NAME = 'image_url'"))
                exists = result.scalar()
                if exists > 0:
                    print('ℹ️  La columna image_url ya existe en la base de datos')
                else:
                    print('❌ La columna no existe y no se pudo agregar:', e)
            except Exception as e2:
                print('❌ Error verificando columna:', e2)
