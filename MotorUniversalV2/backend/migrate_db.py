"""
Script simple para agregar columnas pendientes a la base de datos
"""
from app import create_app, db
from sqlalchemy import text

app = create_app()

def add_column_if_not_exists(table_name, column_name, column_definition):
    """Helper para agregar una columna si no existe"""
    with app.app_context():
        try:
            # Verificar si la columna ya existe
            result = db.session.execute(text(f"""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '{table_name}' AND COLUMN_NAME = '{column_name}'
            """))
            exists = result.scalar()
            
            if exists > 0:
                print(f'ℹ️  La columna {column_name} ya existe en {table_name}')
                return
            
            # Agregar la columna
            db.session.execute(text(f'ALTER TABLE {table_name} ADD {column_name} {column_definition}'))
            db.session.commit()
            print(f'✅ Columna {column_name} agregada exitosamente a {table_name}')
        except Exception as e:
            db.session.rollback()
            error_str = str(e).lower()
            if 'already' in error_str or 'duplicate' in error_str or 'exist' in error_str:
                print(f'ℹ️  La columna {column_name} ya existe en {table_name}')
            else:
                print(f'❌ Error agregando columna {column_name}: {e}')

# Ejecutar migraciones
print('🔄 Ejecutando migraciones de base de datos...')

# Migración: image_url en exams
add_column_if_not_exists('exams', 'image_url', 'NVARCHAR(MAX)')

# Migración: label_style en study_interactive_exercise_actions
add_column_if_not_exists('study_interactive_exercise_actions', 'label_style', "VARCHAR(20) DEFAULT 'text_with_shadow'")

print('✅ Migraciones completadas')