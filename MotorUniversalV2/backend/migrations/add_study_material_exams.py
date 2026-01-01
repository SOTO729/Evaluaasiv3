"""
Migración para crear la tabla de asociación study_material_exams
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from sqlalchemy import text

def run_migration():
    app = create_app()
    with app.app_context():
        # Crear la tabla de asociación
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS study_material_exams (
                study_material_id INTEGER NOT NULL,
                exam_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (study_material_id, exam_id),
                FOREIGN KEY (study_material_id) REFERENCES study_materials(id) ON DELETE CASCADE,
                FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
            )
        """))
        
        # Migrar datos existentes (si hay exam_id en study_materials)
        db.session.execute(text("""
            INSERT OR IGNORE INTO study_material_exams (study_material_id, exam_id)
            SELECT id, exam_id FROM study_materials WHERE exam_id IS NOT NULL
        """))
        
        db.session.commit()
        print("✅ Tabla study_material_exams creada exitosamente")
        print("✅ Datos existentes migrados")

if __name__ == '__main__':
    run_migration()
