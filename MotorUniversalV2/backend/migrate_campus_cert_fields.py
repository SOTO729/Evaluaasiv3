"""
Migración: agregar config_certificacion_id y config_etapa_id a la tabla campuses.
Ejecutar: python migrate_campus_cert_fields.py [--prod]
"""
import sys
import pymssql

DEV_CONFIG = {
    'server': 'evaluaasi-motorv2-sql.database.windows.net',
    'user': 'evaluaasi_admin',
    'password': 'EvalAasi2024_newpwd!',
    'database': 'evaluaasi_dev',
}

PROD_CONFIG = {
    'server': 'evaluaasi-motorv2-sql.database.windows.net',
    'user': 'evaluaasi_admin',
    'password': 'EvalAasi2024_newpwd!',
    'database': 'evaluaasi',
}


def run_migration(config, env_name):
    print(f"\n=== Migrando {env_name}: {config['database']} ===")
    conn = pymssql.connect(**config)
    cursor = conn.cursor()

    columns = [
        ('config_certificacion_id', 'INT NULL'),
        ('config_etapa_id', 'INT NULL'),
    ]

    for col_name, col_type in columns:
        cursor.execute(f"""
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'campuses' AND COLUMN_NAME = '{col_name}'
            )
            BEGIN
                ALTER TABLE campuses ADD {col_name} {col_type};
                SELECT 'ADDED' AS result;
            END
            ELSE
            BEGIN
                SELECT 'EXISTS' AS result;
            END
        """)
        result = cursor.fetchone()[0]
        print(f"  {col_name}: {result}")

    conn.commit()
    conn.close()
    print(f"  Migración {env_name} completada.")


if __name__ == '__main__':
    use_prod = '--prod' in sys.argv

    run_migration(DEV_CONFIG, 'DEV')

    if use_prod:
        confirm = input("\n¿Ejecutar en PRODUCCIÓN? (yes/no): ")
        if confirm.lower() == 'yes':
            run_migration(PROD_CONFIG, 'PROD')
        else:
            print("PROD cancelado.")
