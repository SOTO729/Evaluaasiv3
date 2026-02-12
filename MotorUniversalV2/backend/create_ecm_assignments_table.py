"""
Crea la tabla ecm_candidate_assignments para asignaciones permanentes de ECM a candidatos.
Cada asignación tiene un número único de 12 caracteres.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text, inspect

app = create_app()

def create_table():
    with app.app_context():
        inspector = inspect(db.engine)
        existing = inspector.get_table_names()
        
        if 'ecm_candidate_assignments' in existing:
            print("✅ Tabla 'ecm_candidate_assignments' ya existe")
            return
        
        print("Creando tabla 'ecm_candidate_assignments'...")
        
        db.session.execute(text("""
            CREATE TABLE ecm_candidate_assignments (
                id INT IDENTITY(1,1) PRIMARY KEY,
                assignment_number NVARCHAR(12) NOT NULL,
                user_id NVARCHAR(36) NOT NULL,
                competency_standard_id INT NOT NULL,
                exam_id INT NOT NULL,
                campus_id INT NULL,
                group_id INT NULL,
                group_name NVARCHAR(200) NULL,
                group_exam_id INT NULL,
                assigned_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                assigned_by_id NVARCHAR(36) NULL,
                assignment_source NVARCHAR(20) NOT NULL DEFAULT 'bulk',
                
                CONSTRAINT uq_ecm_assignment_number UNIQUE (assignment_number),
                CONSTRAINT fk_ecm_assign_user FOREIGN KEY (user_id) REFERENCES users(id),
                CONSTRAINT fk_ecm_assign_standard FOREIGN KEY (competency_standard_id) REFERENCES competency_standards(id),
                CONSTRAINT fk_ecm_assign_exam FOREIGN KEY (exam_id) REFERENCES exams(id),
                CONSTRAINT fk_ecm_assign_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE SET NULL,
                CONSTRAINT fk_ecm_assign_by FOREIGN KEY (assigned_by_id) REFERENCES users(id)
            )
        """))
        
        # Índices para consultas frecuentes
        db.session.execute(text("""
            CREATE INDEX ix_ecm_candidate_user_ecm 
            ON ecm_candidate_assignments (user_id, competency_standard_id)
        """))
        
        db.session.execute(text("""
            CREATE INDEX ix_ecm_candidate_assignment_number 
            ON ecm_candidate_assignments (assignment_number)
        """))
        
        db.session.execute(text("""
            CREATE INDEX ix_ecm_candidate_campus 
            ON ecm_candidate_assignments (campus_id)
        """))
        
        db.session.execute(text("""
            CREATE INDEX ix_ecm_candidate_group_exam 
            ON ecm_candidate_assignments (group_exam_id)
        """))
        
        db.session.commit()
        print("✅ Tabla 'ecm_candidate_assignments' creada exitosamente con índices")

if __name__ == '__main__':
    create_table()
