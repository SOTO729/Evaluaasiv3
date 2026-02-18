"""
Migración: Crear tablas para carga masiva de certificados CONOCER
- conocer_upload_batches: Registro de cada carga ZIP
- conocer_upload_logs: Log por cada PDF procesado

Ejecutar: python migrations/add_conocer_upload_tables.py
"""
import os
import sys

# Agregar el directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from sqlalchemy import text


def run_migration():
    """Crear las tablas de carga masiva CONOCER"""
    app = create_app(os.getenv('FLASK_ENV', 'production'))
    
    with app.app_context():
        conn = db.engine.connect()
        trans = conn.begin()
        
        try:
            # ===== Tabla: conocer_upload_batches =====
            print("[MIGRATION] Creando tabla conocer_upload_batches...")
            conn.execute(text("""
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'conocer_upload_batches')
                BEGIN
                    CREATE TABLE conocer_upload_batches (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        uploaded_by NVARCHAR(36) NOT NULL,
                        filename NVARCHAR(255) NOT NULL,
                        blob_name NVARCHAR(500),
                        total_files INT DEFAULT 0,
                        processed_files INT DEFAULT 0,
                        matched_files INT DEFAULT 0,
                        replaced_files INT DEFAULT 0,
                        skipped_files INT DEFAULT 0,
                        discarded_files INT DEFAULT 0,
                        error_files INT DEFAULT 0,
                        status NVARCHAR(20) NOT NULL DEFAULT 'queued',
                        started_at DATETIME2,
                        completed_at DATETIME2,
                        error_message NVARCHAR(MAX),
                        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        
                        CONSTRAINT FK_upload_batch_user FOREIGN KEY (uploaded_by) 
                            REFERENCES users(id)
                    );
                    
                    CREATE INDEX IX_upload_batches_uploaded_by ON conocer_upload_batches(uploaded_by);
                    CREATE INDEX IX_upload_batches_status ON conocer_upload_batches(status);
                    CREATE INDEX IX_upload_batches_created_at ON conocer_upload_batches(created_at DESC);
                    
                    PRINT 'Tabla conocer_upload_batches creada exitosamente';
                END
                ELSE
                BEGIN
                    PRINT 'Tabla conocer_upload_batches ya existe';
                END
            """))
            
            # ===== Tabla: conocer_upload_logs =====
            print("[MIGRATION] Creando tabla conocer_upload_logs...")
            conn.execute(text("""
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'conocer_upload_logs')
                BEGIN
                    CREATE TABLE conocer_upload_logs (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        batch_id INT NOT NULL,
                        filename NVARCHAR(500) NOT NULL,
                        extracted_curp NVARCHAR(18),
                        extracted_ecm_code NVARCHAR(20),
                        extracted_name NVARCHAR(255),
                        extracted_folio NVARCHAR(50),
                        extracted_ecm_name NVARCHAR(500),
                        extracted_issue_date NVARCHAR(100),
                        extracted_certifying_entity NVARCHAR(255),
                        status NVARCHAR(20) NOT NULL,
                        discard_reason NVARCHAR(50),
                        discard_detail NVARCHAR(500),
                        matched_user_id NVARCHAR(36),
                        certificate_id INT,
                        replaced_previous_hash NVARCHAR(64),
                        processing_time_ms INT,
                        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        
                        CONSTRAINT FK_upload_log_batch FOREIGN KEY (batch_id) 
                            REFERENCES conocer_upload_batches(id) ON DELETE CASCADE,
                        CONSTRAINT FK_upload_log_certificate FOREIGN KEY (certificate_id) 
                            REFERENCES conocer_certificates(id) ON DELETE SET NULL
                    );
                    
                    CREATE INDEX IX_upload_logs_batch_id ON conocer_upload_logs(batch_id);
                    CREATE INDEX IX_upload_logs_status ON conocer_upload_logs(status);
                    CREATE INDEX IX_upload_logs_batch_status ON conocer_upload_logs(batch_id, status);
                    
                    PRINT 'Tabla conocer_upload_logs creada exitosamente';
                END
                ELSE
                BEGIN
                    PRINT 'Tabla conocer_upload_logs ya existe';
                END
            """))
            
            trans.commit()
            print("[MIGRATION] ✅ Migración completada exitosamente")
            
        except Exception as e:
            trans.rollback()
            print(f"[MIGRATION] ❌ Error en migración: {e}")
            raise
        finally:
            conn.close()


if __name__ == '__main__':
    run_migration()
