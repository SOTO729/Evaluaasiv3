"""
Migración: Extender tabla certificate_requests para flujo completo
Responsable → Coordinador → Financiero → Gerente

Nuevas columnas:
- attachments: JSON con documentos adjuntos
- coordinator_units: Unidades aprobadas por coordinador
- coordinator_group_id: Grupo seleccionado por coordinador (precio especial)
- coordinator_notes: Notas del coordinador
- coordinator_reviewed_at: Fecha de revisión
- forwarded_request_id: FK a balance_requests
- forwarded_at: Fecha de envío al flujo
- status: Ampliar a String(30) para nuevos estados
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from sqlalchemy import text, inspect

app = create_app()

def run_migration():
    with app.app_context():
        conn = db.engine.connect()
        inspector = inspect(db.engine)
        
        # Verificar que la tabla existe
        if 'certificate_requests' not in inspector.get_table_names():
            print("⚠️  Tabla certificate_requests no existe. Creándola...")
            db.create_all()
            print("✅ Tabla creada con todas las columnas")
            return
        
        existing_columns = [col['name'] for col in inspector.get_columns('certificate_requests')]
        print(f"Columnas existentes: {existing_columns}")
        
        dialect = db.engine.dialect.name
        print(f"Dialecto: {dialect}")
        
        migrations = []
        
        # Columna attachments (Text/JSON)
        if 'attachments' not in existing_columns:
            migrations.append(("attachments", "ALTER TABLE certificate_requests ADD COLUMN attachments TEXT NULL"))
        
        # coordinator_units
        if 'coordinator_units' not in existing_columns:
            migrations.append(("coordinator_units", "ALTER TABLE certificate_requests ADD COLUMN coordinator_units INTEGER NULL"))
        
        # coordinator_group_id (FK)
        if 'coordinator_group_id' not in existing_columns:
            if dialect == 'mssql':
                migrations.append(("coordinator_group_id", 
                    "ALTER TABLE certificate_requests ADD coordinator_group_id INTEGER NULL CONSTRAINT fk_cert_req_coord_group REFERENCES candidate_groups(id) ON DELETE SET NULL"))
            else:
                migrations.append(("coordinator_group_id", 
                    "ALTER TABLE certificate_requests ADD COLUMN coordinator_group_id INTEGER NULL REFERENCES candidate_groups(id) ON DELETE SET NULL"))
        
        # coordinator_notes
        if 'coordinator_notes' not in existing_columns:
            migrations.append(("coordinator_notes", "ALTER TABLE certificate_requests ADD COLUMN coordinator_notes TEXT NULL"))
        
        # coordinator_reviewed_at
        if 'coordinator_reviewed_at' not in existing_columns:
            if dialect == 'mssql':
                migrations.append(("coordinator_reviewed_at", "ALTER TABLE certificate_requests ADD coordinator_reviewed_at DATETIME2 NULL"))
            else:
                migrations.append(("coordinator_reviewed_at", "ALTER TABLE certificate_requests ADD COLUMN coordinator_reviewed_at DATETIME NULL"))
        
        # forwarded_request_id (FK)
        if 'forwarded_request_id' not in existing_columns:
            if dialect == 'mssql':
                migrations.append(("forwarded_request_id", 
                    "ALTER TABLE certificate_requests ADD forwarded_request_id INTEGER NULL CONSTRAINT fk_cert_req_fwd_request REFERENCES balance_requests(id) ON DELETE SET NULL"))
            else:
                migrations.append(("forwarded_request_id", 
                    "ALTER TABLE certificate_requests ADD COLUMN forwarded_request_id INTEGER NULL REFERENCES balance_requests(id) ON DELETE SET NULL"))
        
        # forwarded_at
        if 'forwarded_at' not in existing_columns:
            if dialect == 'mssql':
                migrations.append(("forwarded_at", "ALTER TABLE certificate_requests ADD forwarded_at DATETIME2 NULL"))
            else:
                migrations.append(("forwarded_at", "ALTER TABLE certificate_requests ADD COLUMN forwarded_at DATETIME NULL"))
        
        # Ampliar columna status a String(30) si es necesario
        # (solo para MSSQL, SQLite y PostgreSQL manejan TEXT de forma flexible)
        if dialect == 'mssql':
            migrations.append(("status_widen", "ALTER TABLE certificate_requests ALTER COLUMN status NVARCHAR(30) NOT NULL"))
        
        if not migrations:
            print("✅ No hay migraciones pendientes. Todas las columnas ya existen.")
            return
        
        for name, sql in migrations:
            try:
                conn.execute(text(sql))
                print(f"✅ Columna '{name}' agregada correctamente")
            except Exception as e:
                error_msg = str(e).lower()
                if 'already exists' in error_msg or 'duplicate column' in error_msg:
                    print(f"⚠️  Columna '{name}' ya existe, saltando...")
                else:
                    print(f"❌ Error al agregar '{name}': {e}")
        
        conn.commit()
        conn.close()
        print("\n✅ Migración completada exitosamente")


if __name__ == '__main__':
    run_migration()
