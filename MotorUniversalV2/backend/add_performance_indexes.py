"""
Script de migración para añadir índices de rendimiento
Ejecutar con: python add_performance_indexes.py
"""
import os
import sys

# Añadir el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text

def add_indexes():
    """Añadir índices para mejorar rendimiento de queries frecuentes"""
    
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("AÑADIENDO ÍNDICES DE RENDIMIENTO")
        print("=" * 60)
        
        # Lista de índices a crear
        indexes = [
            # Study Contents - filtrado frecuente por is_published
            {
                'name': 'ix_study_contents_is_published',
                'table': 'study_contents',
                'columns': 'is_published',
                'description': 'Filtrado de materiales publicados'
            },
            # Study Contents - ordenamiento por order
            {
                'name': 'ix_study_contents_order',
                'table': 'study_contents',
                'columns': '[order]',  # order es palabra reservada
                'description': 'Ordenamiento de materiales'
            },
            # Study Sessions - FK material_id (muy consultado)
            {
                'name': 'ix_study_sessions_material_id',
                'table': 'study_sessions',
                'columns': 'material_id',
                'description': 'Buscar sesiones por material'
            },
            # Study Topics - FK session_id (muy consultado)
            {
                'name': 'ix_study_topics_session_id',
                'table': 'study_topics',
                'columns': 'session_id',
                'description': 'Buscar temas por sesión'
            },
            # Study Topics - ordenamiento
            {
                'name': 'ix_study_topics_order',
                'table': 'study_topics',
                'columns': '[order]',
                'description': 'Ordenamiento de temas'
            },
            # Study Readings - FK topic_id
            {
                'name': 'ix_study_readings_topic_id',
                'table': 'study_readings',
                'columns': 'topic_id',
                'description': 'Buscar lecturas por tema'
            },
            # Study Videos - FK topic_id
            {
                'name': 'ix_study_videos_topic_id',
                'table': 'study_videos',
                'columns': 'topic_id',
                'description': 'Buscar videos por tema'
            },
            # Study Downloadable Exercises - FK topic_id
            {
                'name': 'ix_study_downloadable_exercises_topic_id',
                'table': 'study_downloadable_exercises',
                'columns': 'topic_id',
                'description': 'Buscar descargables por tema'
            },
            # Study Interactive Exercises - FK topic_id
            {
                'name': 'ix_study_interactive_exercises_topic_id',
                'table': 'study_interactive_exercises',
                'columns': 'topic_id',
                'description': 'Buscar ejercicios interactivos por tema'
            },
            # Student Progress - user_id (muy consultado)
            {
                'name': 'ix_student_content_progress_user_id',
                'table': 'student_content_progress',
                'columns': 'user_id',
                'description': 'Buscar progreso por usuario'
            },
            # Student Progress - índice compuesto para queries de dashboard
            {
                'name': 'ix_student_progress_user_content',
                'table': 'student_content_progress',
                'columns': 'user_id, content_type',
                'description': 'Filtrar progreso por usuario y tipo'
            },
            # Student Progress - topic_id para agregaciones
            {
                'name': 'ix_student_content_progress_topic_id',
                'table': 'student_content_progress',
                'columns': 'topic_id',
                'description': 'Buscar progreso por tema'
            },
            # Results - índice compuesto para consultas de usuario
            {
                'name': 'ix_results_user_created',
                'table': 'results',
                'columns': 'user_id, created_at DESC',
                'description': 'Resultados recientes por usuario'
            },
            # Exams - is_published y is_active (filtrado frecuente)
            {
                'name': 'ix_exams_published_active',
                'table': 'exams',
                'columns': 'is_published, is_active',
                'description': 'Filtrar exámenes publicados y activos'
            },
            # Categories - exam_id ya tiene índice, pero añadimos composite
            {
                'name': 'ix_categories_exam_order',
                'table': 'categories',
                'columns': 'exam_id, category_number',
                'description': 'Categorías ordenadas por examen'
            },
            # Topics - composite para navegación
            {
                'name': 'ix_topics_category_order',
                'table': 'topics',
                'columns': 'category_id, topic_number',
                'description': 'Temas ordenados por categoría'
            },
            # Questions - composite para consultas
            {
                'name': 'ix_questions_topic_type',
                'table': 'questions',
                'columns': 'topic_id, type',
                'description': 'Preguntas por tema y tipo'
            },
            # Exercise Steps - exercise_id para ordenamiento
            {
                'name': 'ix_exercise_steps_exercise_order',
                'table': 'exercise_steps',
                'columns': 'exercise_id, step_number',
                'description': 'Pasos ordenados por ejercicio'
            },
            # Vouchers - user_id para consultas
            {
                'name': 'ix_vouchers_user_id',
                'table': 'vouchers',
                'columns': 'user_id',
                'description': 'Vouchers por usuario'
            },
            # Vouchers - exam_id para consultas
            {
                'name': 'ix_vouchers_exam_id',
                'table': 'vouchers',
                'columns': 'exam_id',
                'description': 'Vouchers por examen'
            },
            # CONOCER Certificates - status para filtrado
            {
                'name': 'ix_conocer_certificates_status',
                'table': 'conocer_certificates',
                'columns': 'status',
                'description': 'Certificados por estado'
            },
        ]
        
        created = 0
        skipped = 0
        errors = 0
        
        for idx in indexes:
            try:
                # Verificar si el índice ya existe
                check_sql = text(f"""
                    SELECT 1 FROM sys.indexes 
                    WHERE name = '{idx['name']}' 
                    AND object_id = OBJECT_ID('{idx['table']}')
                """)
                result = db.session.execute(check_sql).fetchone()
                
                if result:
                    print(f"⏭️  {idx['name']} - Ya existe")
                    skipped += 1
                    continue
                
                # Verificar si la tabla existe
                check_table = text(f"""
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = '{idx['table']}'
                """)
                table_exists = db.session.execute(check_table).fetchone()
                
                if not table_exists:
                    print(f"⚠️  {idx['name']} - Tabla '{idx['table']}' no existe")
                    skipped += 1
                    continue
                
                # Crear el índice
                create_sql = text(f"""
                    CREATE NONCLUSTERED INDEX {idx['name']}
                    ON {idx['table']} ({idx['columns']})
                """)
                db.session.execute(create_sql)
                db.session.commit()
                
                print(f"✅ {idx['name']} - Creado ({idx['description']})")
                created += 1
                
            except Exception as e:
                error_msg = str(e)
                if 'already exists' in error_msg.lower():
                    print(f"⏭️  {idx['name']} - Ya existe")
                    skipped += 1
                else:
                    print(f"❌ {idx['name']} - Error: {error_msg[:100]}")
                    errors += 1
                db.session.rollback()
        
        print()
        print("=" * 60)
        print(f"RESUMEN: {created} creados, {skipped} omitidos, {errors} errores")
        print("=" * 60)
        
        return created, skipped, errors


if __name__ == '__main__':
    add_indexes()
