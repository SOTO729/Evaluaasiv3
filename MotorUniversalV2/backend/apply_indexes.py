"""
Script para aplicar índices de rendimiento directamente en la base de datos.
Ejecutar en Azure Cloud Shell o localmente con conexión a la BD de producción.

Uso:
    python apply_indexes.py

Variables de entorno requeridas:
    DATABASE_URL - URL de conexión a PostgreSQL
"""
import os
import sys
from sqlalchemy import create_engine, text

# Índices a crear
INDEXES = [
    # Results table - heavily queried
    "CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_results_exam_id ON results(exam_id)",
    "CREATE INDEX IF NOT EXISTS idx_results_competency_standard_id ON results(competency_standard_id)",
    "CREATE INDEX IF NOT EXISTS idx_results_status ON results(status)",
    "CREATE INDEX IF NOT EXISTS idx_results_created_at ON results(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_results_user_exam ON results(user_id, exam_id)",
    
    # Categories table
    "CREATE INDEX IF NOT EXISTS idx_categories_exam_id ON categories(exam_id)",
    
    # Topics table
    "CREATE INDEX IF NOT EXISTS idx_topics_category_id ON topics(category_id)",
    
    # Questions table
    "CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id)",
    "CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type)",
    
    # Answers table
    "CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id)",
    
    # Exercises table
    "CREATE INDEX IF NOT EXISTS idx_exercises_topic_id ON exercises(topic_id)",
    "CREATE INDEX IF NOT EXISTS idx_exercises_type ON exercises(type)",
    
    # Exams table
    "CREATE INDEX IF NOT EXISTS idx_exams_is_published ON exams(is_published)",
    "CREATE INDEX IF NOT EXISTS idx_exams_is_active ON exams(is_active)",
    "CREATE INDEX IF NOT EXISTS idx_exams_competency_standard_id ON exams(competency_standard_id)",
    
    # Study contents table
    "CREATE INDEX IF NOT EXISTS idx_study_contents_exam_id ON study_contents(exam_id)",
    "CREATE INDEX IF NOT EXISTS idx_study_contents_is_published ON study_contents(is_published)",
]


def apply_indexes():
    """Aplicar índices a la base de datos"""
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL no está configurada")
        sys.exit(1)
    
    print(f"Conectando a la base de datos...")
    engine = create_engine(database_url)
    
    success_count = 0
    error_count = 0
    
    with engine.connect() as conn:
        for index_sql in INDEXES:
            try:
                print(f"  Ejecutando: {index_sql[:60]}...")
                conn.execute(text(index_sql))
                conn.commit()
                success_count += 1
                print(f"    ✓ OK")
            except Exception as e:
                error_count += 1
                print(f"    ✗ Error: {e}")
    
    print(f"\n{'='*50}")
    print(f"Resumen:")
    print(f"  ✓ Índices creados exitosamente: {success_count}")
    print(f"  ✗ Errores: {error_count}")
    print(f"{'='*50}")
    
    return error_count == 0


if __name__ == '__main__':
    success = apply_indexes()
    sys.exit(0 if success else 1)
