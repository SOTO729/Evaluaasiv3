"""
Migración: Sistema de Retomas ECM
- Tabla ecm_retakes: retomas aplicadas a asignaciones ECM
- Columna max_retakes en campuses
- Columna max_retakes_override en candidate_groups

Ejecutar: python migrations/add_ecm_retakes.py
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_migration():
    """Crear tabla ecm_retakes y agregar columnas max_retakes"""
    import pymssql
    
    # Extraer credenciales del DATABASE_URL o usar directas
    db_url = os.getenv('DATABASE_URL', '')
    
    conn = pymssql.connect(
        server='evaluaasi-motorv2-sql.database.windows.net',
        user='evaluaasi_admin',
        password='EvalAasi2024_newpwd!',
        database='evaluaasi'
    )
    cursor = conn.cursor()
    
    try:
        # ===== 1. Columna max_retakes en campuses =====
        print("[MIGRATION] Agregando max_retakes a campuses...")
        cursor.execute("""
            IF NOT EXISTS (
                SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'campuses' AND COLUMN_NAME = 'max_retakes'
            )
            BEGIN
                ALTER TABLE campuses ADD max_retakes INT NOT NULL DEFAULT 1
                PRINT 'Columna max_retakes agregada a campuses'
            END
            ELSE
            BEGIN
                PRINT 'Columna max_retakes ya existe en campuses'
            END
        """)
        print("[OK] max_retakes en campuses")
        
        # ===== 2. Columna max_retakes_override en candidate_groups =====
        print("[MIGRATION] Agregando max_retakes_override a candidate_groups...")
        cursor.execute("""
            IF NOT EXISTS (
                SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'candidate_groups' AND COLUMN_NAME = 'max_retakes_override'
            )
            BEGIN
                ALTER TABLE candidate_groups ADD max_retakes_override INT NULL
                PRINT 'Columna max_retakes_override agregada a candidate_groups'
            END
            ELSE
            BEGIN
                PRINT 'Columna max_retakes_override ya existe en candidate_groups'
            END
        """)
        print("[OK] max_retakes_override en candidate_groups")
        
        # ===== 3. Tabla ecm_retakes =====
        print("[MIGRATION] Creando tabla ecm_retakes...")
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ecm_retakes')
            BEGIN
                CREATE TABLE ecm_retakes (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    assignment_id INT NOT NULL,
                    group_exam_id INT NOT NULL,
                    user_id VARCHAR(36) NOT NULL,
                    cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
                    transaction_id INT NULL,
                    status NVARCHAR(20) NOT NULL DEFAULT 'active',
                    result_id VARCHAR(36) NULL,
                    applied_by_id VARCHAR(36) NULL,
                    applied_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    used_at DATETIME2 NULL,
                    
                    CONSTRAINT FK_ecm_retakes_assignment FOREIGN KEY (assignment_id)
                        REFERENCES ecm_candidate_assignments(id) ON DELETE CASCADE,
                    CONSTRAINT FK_ecm_retakes_user FOREIGN KEY (user_id)
                        REFERENCES users(id),
                    CONSTRAINT FK_ecm_retakes_applied_by FOREIGN KEY (applied_by_id)
                        REFERENCES users(id),
                    CONSTRAINT FK_ecm_retakes_transaction FOREIGN KEY (transaction_id)
                        REFERENCES balance_transactions(id) ON DELETE SET NULL
                );
                
                CREATE INDEX IX_ecm_retakes_assignment ON ecm_retakes(assignment_id);
                CREATE INDEX IX_ecm_retakes_user_group_exam ON ecm_retakes(user_id, group_exam_id);
                CREATE INDEX IX_ecm_retakes_status ON ecm_retakes(status);
                
                PRINT 'Tabla ecm_retakes creada exitosamente'
            END
            ELSE
            BEGIN
                PRINT 'Tabla ecm_retakes ya existe'
            END
        """)
        print("[OK] Tabla ecm_retakes")
        
        conn.commit()
        print("[DONE] Migración completada exitosamente")
        
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] {e}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    run_migration()
