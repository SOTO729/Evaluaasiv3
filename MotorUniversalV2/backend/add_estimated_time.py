"""
Script para agregar la columna estimated_time_minutes a study_topics
Compatible con SQL Server (Azure SQL)
"""
from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Verificar si la columna ya existe (sintaxis SQL Server)
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'study_topics' AND COLUMN_NAME = 'estimated_time_minutes'
        """))
        exists = result.scalar()
        
        if exists > 0:
            print('La columna estimated_time_minutes ya existe en study_topics')
        else:
            # Sintaxis SQL Server para agregar columna
            db.session.execute(text('ALTER TABLE study_topics ADD estimated_time_minutes INT NULL'))
            db.session.commit()
            print('Columna estimated_time_minutes agregada exitosamente!')
    except Exception as e:
        print(f'Error: {e}')
