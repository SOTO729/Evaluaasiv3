"""
Migración: crear tabla payments para pagos en línea vía Mercado Pago.

Ejecutar contra Azure SQL DEV:
    python migrate_payments_table.py

Ejecutar contra Azure SQL PROD:
    python migrate_payments_table.py --prod
"""
import sys
import pymssql

DEV_DB = 'evaluaasi_dev'
PROD_DB = 'evaluaasi'

SERVER = 'evaluaasi-motorv2-sql.database.windows.net'
USER = 'evaluaasi_admin'
PASSWORD = 'EvalAasi2024_newpwd!'

SQL = """
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'payments')
BEGIN
    CREATE TABLE payments (
        id INT IDENTITY(1,1) PRIMARY KEY,

        -- Quién paga
        user_id VARCHAR(36) NOT NULL,
        campus_id INT NOT NULL,

        -- Qué se paga
        units INT NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,

        -- Mercado Pago
        mp_preference_id NVARCHAR(100) NULL,
        mp_payment_id NVARCHAR(100) NULL,
        mp_status NVARCHAR(30) NULL,
        mp_status_detail NVARCHAR(100) NULL,
        mp_payment_method NVARCHAR(50) NULL,
        mp_payment_type NVARCHAR(30) NULL,
        mp_external_reference NVARCHAR(100) NULL,

        -- Estado interno
        status NVARCHAR(30) NOT NULL DEFAULT 'pending',

        -- Acreditación de vouchers
        credits_applied BIT NOT NULL DEFAULT 0,
        credits_applied_at DATETIME2 NULL,

        -- Datos extra del webhook
        webhook_data NVARCHAR(MAX) NULL,

        -- Timestamps
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        -- Foreign keys
        CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_payments_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE
    );

    -- Índices
    CREATE INDEX ix_payments_mp_payment_id ON payments(mp_payment_id);
    CREATE UNIQUE INDEX ix_payments_mp_external_reference ON payments(mp_external_reference) WHERE mp_external_reference IS NOT NULL;
    CREATE INDEX ix_payments_status ON payments(status);
    CREATE INDEX ix_payments_user_id ON payments(user_id);
    CREATE INDEX ix_payments_campus_id ON payments(campus_id);

    PRINT 'Tabla payments creada exitosamente';
END
ELSE
    PRINT 'Tabla payments ya existe';
"""


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
        cursor.execute(SQL)
        conn.commit()
        # Leer mensajes PRINT
        while cursor.nextset():
            pass
        print(f'Migración completada en {env}.')
    except Exception as e:
        conn.rollback()
        print(f'Error: {e}')
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
