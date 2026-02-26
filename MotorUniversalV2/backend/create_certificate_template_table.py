"""
Migración: Crear tabla certificate_templates
Para plantillas de certificado personalizadas por ECM
"""
import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    """Obtener conexión a la base de datos"""
    # Conexión directa a Azure SQL
    server = 'evaluaasi-motorv2-sql.database.windows.net'
    database = 'evaluaasi'
    username = 'evaluaasi_admin'
    password = 'EvalAasi2024_newpwd!'
    driver = '{ODBC Driver 18 for SQL Server}'
    
    conn = pyodbc.connect(
        f'DRIVER={driver};SERVER={server};DATABASE={database};'
        f'UID={username};PWD={password};Encrypt=yes;TrustServerCertificate=no;'
        f'Connection Timeout=30'
    )
    return conn


def run_migration():
    """Ejecutar la migración"""
    conn = get_connection()
    cursor = conn.cursor()
    
    print("🔧 Verificando si la tabla certificate_templates ya existe...")
    
    cursor.execute("""
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'certificate_templates'
    """)
    exists = cursor.fetchone()[0] > 0
    
    if exists:
        print("✅ La tabla certificate_templates ya existe. No se requiere migración.")
        conn.close()
        return
    
    print("📝 Creando tabla certificate_templates...")
    
    cursor.execute("""
        CREATE TABLE certificate_templates (
            id INT IDENTITY(1,1) PRIMARY KEY,
            competency_standard_id INT NOT NULL,
            template_blob_url NVARCHAR(500) NOT NULL,
            pdf_width FLOAT NOT NULL DEFAULT 612.0,
            pdf_height FLOAT NOT NULL DEFAULT 792.0,
            config NVARCHAR(MAX) NOT NULL DEFAULT '{}',
            created_by NVARCHAR(36) NOT NULL,
            created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            updated_by NVARCHAR(36) NULL,
            updated_at DATETIME2 NULL DEFAULT GETUTCDATE(),
            
            CONSTRAINT fk_cert_template_standard 
                FOREIGN KEY (competency_standard_id) 
                REFERENCES competency_standards(id) 
                ON DELETE CASCADE,
            CONSTRAINT fk_cert_template_creator 
                FOREIGN KEY (created_by) 
                REFERENCES users(id),
            CONSTRAINT fk_cert_template_updater 
                FOREIGN KEY (updated_by) 
                REFERENCES users(id),
            CONSTRAINT uq_cert_template_standard 
                UNIQUE (competency_standard_id)
        )
    """)
    
    print("📋 Creando índice en competency_standard_id...")
    cursor.execute("""
        CREATE INDEX ix_cert_template_standard_id 
        ON certificate_templates(competency_standard_id)
    """)
    
    conn.commit()
    print("✅ Tabla certificate_templates creada exitosamente!")
    
    # Verificar
    cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'certificate_templates'")
    count = cursor.fetchone()[0]
    print(f"✅ Verificación: {count} tabla(s) encontrada(s)")
    
    conn.close()


if __name__ == '__main__':
    run_migration()
