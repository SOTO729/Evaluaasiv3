"""
Migración: agregar columnas de VDI/workstation a vm_sessions.

Nuevas columnas:
  - session_type (simulador/examen/parcial)
  - workstation_id (EquipoId en EvaluaasiConfig)
  - workstation_name (nombre del VDI, ej: VDI-OF2016-1)
  - workstation_color (color hex para UI)
  - config_session_id (UUID referencia a dbo.Sesion en EvaluaasiConfig)

Ejecutar contra Azure SQL DEV:
    python migrate_vm_sessions_vdi.py

Ejecutar contra Azure SQL PROD:
    python migrate_vm_sessions_vdi.py --prod
"""
import sys
import pymssql

DEV_DB = 'evaluaasi_dev'
PROD_DB = 'evaluaasi'

SERVER = 'evaluaasi-motorv2-sql.database.windows.net'
USER = 'evaluaasi_admin'
PASSWORD = 'EvalAasi2024_newpwd!'

STATEMENTS = [
    # session_type
    """
    IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('vm_sessions') AND name = 'session_type'
    )
    BEGIN
        ALTER TABLE vm_sessions ADD session_type NVARCHAR(20) NOT NULL DEFAULT 'simulador';
        PRINT 'Columna session_type agregada';
    END
    ELSE
        PRINT 'Columna session_type ya existe';
    """,
    # workstation_id
    """
    IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('vm_sessions') AND name = 'workstation_id'
    )
    BEGIN
        ALTER TABLE vm_sessions ADD workstation_id INT NULL;
        PRINT 'Columna workstation_id agregada';
    END
    ELSE
        PRINT 'Columna workstation_id ya existe';
    """,
    # workstation_name
    """
    IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('vm_sessions') AND name = 'workstation_name'
    )
    BEGIN
        ALTER TABLE vm_sessions ADD workstation_name NVARCHAR(30) NULL;
        PRINT 'Columna workstation_name agregada';
    END
    ELSE
        PRINT 'Columna workstation_name ya existe';
    """,
    # workstation_color
    """
    IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('vm_sessions') AND name = 'workstation_color'
    )
    BEGIN
        ALTER TABLE vm_sessions ADD workstation_color NVARCHAR(7) NULL;
        PRINT 'Columna workstation_color agregada';
    END
    ELSE
        PRINT 'Columna workstation_color ya existe';
    """,
    # config_session_id
    """
    IF NOT EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID('vm_sessions') AND name = 'config_session_id'
    )
    BEGIN
        ALTER TABLE vm_sessions ADD config_session_id NVARCHAR(36) NULL;
        PRINT 'Columna config_session_id agregada';
    END
    ELSE
        PRINT 'Columna config_session_id ya existe';
    """,
    # Índice por workstation_id
    """
    IF NOT EXISTS (
        SELECT * FROM sys.indexes
        WHERE object_id = OBJECT_ID('vm_sessions') AND name = 'ix_vm_session_workstation'
    )
    BEGIN
        CREATE INDEX ix_vm_session_workstation ON vm_sessions(workstation_id);
        PRINT 'Índice ix_vm_session_workstation creado';
    END
    """,
    # Índice por config_session_id
    """
    IF NOT EXISTS (
        SELECT * FROM sys.indexes
        WHERE object_id = OBJECT_ID('vm_sessions') AND name = 'ix_vm_session_config_id'
    )
    BEGIN
        CREATE INDEX ix_vm_session_config_id ON vm_sessions(config_session_id)
            WHERE config_session_id IS NOT NULL;
        PRINT 'Índice ix_vm_session_config_id creado';
    END
    """,
]


def main():
    db_name = PROD_DB if '--prod' in sys.argv else DEV_DB
    env = 'PROD' if '--prod' in sys.argv else 'DEV'
    print(f'Conectando a {env}: {SERVER}/{db_name}...')

    conn = pymssql.connect(
        server=SERVER,
        user=USER,
        password=PASSWORD,
        database=db_name,
    )
    cursor = conn.cursor()

    try:
        for i, sql in enumerate(STATEMENTS, 1):
            cursor.execute(sql)
            conn.commit()
            print(f'  Sentencia {i}/{len(STATEMENTS)} ejecutada')
        print(f'Migración VDI completada en {env}.')
    except Exception as e:
        conn.rollback()
        print(f'Error: {e}')
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
