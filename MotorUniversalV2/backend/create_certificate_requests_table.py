"""
Migración: Crear tabla certificate_requests
Solicitudes de certificados de responsable de plantel a coordinador.
"""
import pyodbc
import os

def run_migration():
    server = os.environ.get('DB_SERVER', 'evaluaasi-motorv2-sql.database.windows.net')
    database = os.environ.get('DB_NAME', 'evaluaasi')
    username = os.environ.get('DB_USER', 'evaluaasi_admin')
    password = os.environ.get('DB_PASSWORD', 'EvalAasi2024_newpwd!')
    
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    # Verificar si la tabla ya existe
    cursor.execute("""
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'certificate_requests'
    """)
    if cursor.fetchone()[0] > 0:
        print("✅ Tabla certificate_requests ya existe")
        conn.close()
        return
    
    print("Creando tabla certificate_requests...")
    cursor.execute("""
        CREATE TABLE certificate_requests (
            id INT IDENTITY(1,1) PRIMARY KEY,
            responsable_id VARCHAR(36) NOT NULL,
            campus_id INT NOT NULL,
            group_id INT NULL,
            coordinator_id VARCHAR(36) NOT NULL,
            units_requested INT NOT NULL,
            justification NVARCHAR(MAX) NOT NULL,
            status NVARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            CONSTRAINT FK_cert_req_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE NO ACTION,
            CONSTRAINT FK_cert_req_group FOREIGN KEY (group_id) REFERENCES candidate_groups(id) ON DELETE SET NULL
        )
    """)
    
    # Índices
    cursor.execute("CREATE INDEX IX_cert_req_responsable ON certificate_requests(responsable_id)")
    cursor.execute("CREATE INDEX IX_cert_req_coordinator ON certificate_requests(coordinator_id)")
    cursor.execute("CREATE INDEX IX_cert_req_campus ON certificate_requests(campus_id)")
    cursor.execute("CREATE INDEX IX_cert_req_status ON certificate_requests(status)")
    
    conn.commit()
    print("✅ Tabla certificate_requests creada exitosamente")
    conn.close()

if __name__ == '__main__':
    run_migration()
