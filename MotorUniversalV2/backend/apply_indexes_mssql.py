"""
Script para aplicar índices de rendimiento en SQL Server (Azure SQL).
Ejecutar con la DATABASE_URL de producción.

Uso:
    DATABASE_URL="mssql+pymssql://..." python apply_indexes_mssql.py
"""
import os
import sys

# SQL Server usa sintaxis diferente para CREATE INDEX IF NOT EXISTS
# Usamos una verificación con sys.indexes antes de crear

INDEXES = [
    # Results table - heavily queried
    ("idx_results_user_id", "results", "user_id"),
    ("idx_results_exam_id", "results", "exam_id"),
    ("idx_results_competency_standard_id", "results", "competency_standard_id"),
    ("idx_results_status", "results", "status"),
    ("idx_results_created_at", "results", "created_at"),
    
    # Categories table
    ("idx_categories_exam_id", "categories", "exam_id"),
    
    # Topics table
    ("idx_topics_category_id", "topics", "category_id"),
    
    # Questions table
    ("idx_questions_topic_id", "questions", "topic_id"),
    ("idx_questions_type", "questions", "type"),
    
    # Answers table
    ("idx_answers_question_id", "answers", "question_id"),
    
    # Exercises table
    ("idx_exercises_topic_id", "exercises", "topic_id"),
    ("idx_exercises_type", "exercises", "type"),
    
    # Exams table
    ("idx_exams_is_published", "exams", "is_published"),
    ("idx_exams_is_active", "exams", "is_active"),
    ("idx_exams_competency_standard_id", "exams", "competency_standard_id"),
    
    # Study contents table
    ("idx_study_contents_exam_id", "study_contents", "exam_id"),
    ("idx_study_contents_is_published", "study_contents", "is_published"),
]

# Índice compuesto especial
COMPOSITE_INDEXES = [
    ("idx_results_user_exam", "results", "user_id, exam_id"),
]


def generate_index_sql(index_name, table_name, columns):
    """Genera SQL para crear índice si no existe en SQL Server"""
    return f"""
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = '{index_name}' AND object_id = OBJECT_ID('{table_name}'))
    BEGIN
        CREATE NONCLUSTERED INDEX [{index_name}] ON [{table_name}] ([{columns.replace(', ', '], [')}])
    END
    """


def apply_indexes():
    """Aplicar índices a la base de datos SQL Server"""
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL no está configurada")
        print("Uso: DATABASE_URL='mssql+pymssql://...' python apply_indexes_mssql.py")
        sys.exit(1)
    
    # Importar aquí para evitar error si no está instalado
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print("ERROR: SQLAlchemy no está instalado")
        print("Instalar con: pip install sqlalchemy pymssql")
        sys.exit(1)
    
    print("Conectando a Azure SQL Database...")
    print(f"  Host: {database_url.split('@')[1].split('/')[0] if '@' in database_url else 'N/A'}")
    
    engine = create_engine(database_url)
    
    success_count = 0
    skip_count = 0
    error_count = 0
    
    all_indexes = [(n, t, c) for n, t, c in INDEXES] + [(n, t, c) for n, t, c in COMPOSITE_INDEXES]
    
    with engine.connect() as conn:
        for index_name, table_name, columns in all_indexes:
            try:
                # Verificar si la tabla existe
                check_table = text(f"SELECT OBJECT_ID('{table_name}')")
                result = conn.execute(check_table).scalar()
                
                if result is None:
                    print(f"  ⚠ Tabla '{table_name}' no existe, saltando índice {index_name}")
                    skip_count += 1
                    continue
                
                # Verificar si el índice ya existe
                check_sql = text(f"""
                    SELECT COUNT(*) FROM sys.indexes 
                    WHERE name = '{index_name}' AND object_id = OBJECT_ID('{table_name}')
                """)
                exists = conn.execute(check_sql).scalar()
                
                if exists > 0:
                    print(f"  ✓ Índice {index_name} ya existe")
                    skip_count += 1
                    continue
                
                # Crear el índice
                # Para índices compuestos, manejar múltiples columnas
                if ', ' in columns:
                    cols = ', '.join([f"[{c.strip()}]" for c in columns.split(', ')])
                else:
                    cols = f"[{columns}]"
                
                create_sql = text(f"CREATE NONCLUSTERED INDEX [{index_name}] ON [{table_name}] ({cols})")
                print(f"  Creando: {index_name} en {table_name}({columns})...")
                conn.execute(create_sql)
                conn.commit()
                success_count += 1
                print(f"    ✓ OK")
                
            except Exception as e:
                error_count += 1
                print(f"    ✗ Error en {index_name}: {e}")
    
    print(f"\n{'='*50}")
    print(f"Resumen:")
    print(f"  ✓ Creados: {success_count}")
    print(f"  ⊘ Saltados (ya existen o tabla no existe): {skip_count}")
    print(f"  ✗ Errores: {error_count}")
    print(f"{'='*50}")
    
    return error_count == 0


if __name__ == "__main__":
    success = apply_indexes()
    sys.exit(0 if success else 1)
