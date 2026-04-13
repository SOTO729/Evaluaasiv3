"""
Migración: Agregar campos config_subsistema_id y config_plantel_id a campuses.
Para mapear Campus de Evaluaasi V2 a SubsistemaId/PlantelId de EvaluaasiConfig.
"""
import pymssql
import sys

SERVERS = {
    'dev': {
        'server': 'evaluaasi-motorv2-sql.database.windows.net',
        'user': 'evaluaasi_admin',
        'password': 'EvalAasi2024_newpwd!',
        'database': 'evaluaasi_dev',
    },
    'prod': {
        'server': 'evaluaasi-motorv2-sql.database.windows.net',
        'user': 'evaluaasi_admin',
        'password': 'EvalAasi2024_newpwd!',
        'database': 'evaluaasi',
    },
}

STATEMENTS = [
    # config_subsistema_id
    """
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'campuses' AND COLUMN_NAME = 'config_subsistema_id'
    )
    ALTER TABLE campuses ADD config_subsistema_id INT NULL;
    """,
    # config_plantel_id
    """
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'campuses' AND COLUMN_NAME = 'config_plantel_id'
    )
    ALTER TABLE campuses ADD config_plantel_id INT NULL;
    """,
]


def run_migration(env='dev'):
    config = SERVERS[env]
    print(f"Conectando a {env}: {config['database']}@{config['server']}...")
    
    conn = pymssql.connect(**config)
    cursor = conn.cursor()
    
    for i, stmt in enumerate(STATEMENTS, 1):
        try:
            cursor.execute(stmt)
            conn.commit()
            print(f"  [{i}/{len(STATEMENTS)}] OK")
        except Exception as e:
            print(f"  [{i}/{len(STATEMENTS)}] Error: {e}")
            conn.rollback()
    
    # Verificar
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'campuses' 
        AND COLUMN_NAME IN ('config_subsistema_id', 'config_plantel_id')
        ORDER BY COLUMN_NAME
    """)
    cols = cursor.fetchall()
    print(f"\nColumnas verificadas: {[c[0] for c in cols]}")
    
    conn.close()
    print("Migración completada.")


if __name__ == '__main__':
    env = 'prod' if '--prod' in sys.argv else 'dev'
    run_migration(env)
