"""
Script para agregar la columna assignment_type a la tabla group_exams
y crear la tabla group_exam_members
"""
import os
import sys

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text

def run_migration():
    app = create_app()
    
    with app.app_context():
        try:
            # 1. Agregar columna assignment_type a group_exams si no existe
            print("Verificando columna assignment_type en group_exams...")
            
            check_column = text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'group_exams' AND COLUMN_NAME = 'assignment_type'
            """)
            result = db.session.execute(check_column).fetchone()
            
            if not result:
                print("Agregando columna assignment_type...")
                db.session.execute(text("""
                    ALTER TABLE group_exams 
                    ADD assignment_type NVARCHAR(20) DEFAULT 'all' NOT NULL
                """))
                db.session.commit()
                print("✓ Columna assignment_type agregada exitosamente")
            else:
                print("✓ Columna assignment_type ya existe")
            
            # 2. Crear tabla group_exam_members si no existe
            print("\nVerificando tabla group_exam_members...")
            
            check_table = text("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'group_exam_members'
            """)
            result = db.session.execute(check_table).fetchone()
            
            if not result:
                print("Creando tabla group_exam_members...")
                db.session.execute(text("""
                    CREATE TABLE group_exam_members (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        group_exam_id INT NOT NULL,
                        user_id NVARCHAR(36) NOT NULL,
                        assigned_at DATETIME DEFAULT GETDATE() NOT NULL,
                        CONSTRAINT fk_gem_group_exam FOREIGN KEY (group_exam_id) 
                            REFERENCES group_exams(id) ON DELETE CASCADE,
                        CONSTRAINT fk_gem_user FOREIGN KEY (user_id) 
                            REFERENCES users(id) ON DELETE CASCADE,
                        CONSTRAINT uq_gem_group_exam_user UNIQUE (group_exam_id, user_id)
                    )
                """))
                db.session.commit()
                print("✓ Tabla group_exam_members creada exitosamente")
            else:
                print("✓ Tabla group_exam_members ya existe")
            
            print("\n✅ Migración completada exitosamente!")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error durante la migración: {str(e)}")
            raise

if __name__ == '__main__':
    run_migration()
