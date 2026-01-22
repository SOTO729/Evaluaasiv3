#!/usr/bin/env python3
"""Script para crear la tabla user_partners."""
import pymssql

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_c949de16dad23b6d',
    database='evaluaasi'
)
cursor = conn.cursor()

sql = """
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[user_partners]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[user_partners] (
        [user_id] VARCHAR(36) NOT NULL,
        [partner_id] INT NOT NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT [pk_user_partners] PRIMARY KEY ([user_id], [partner_id]),
        CONSTRAINT [fk_up_user] FOREIGN KEY ([user_id]) 
            REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
        CONSTRAINT [fk_up_partner] FOREIGN KEY ([partner_id]) 
            REFERENCES [dbo].[partners]([id]) ON DELETE CASCADE
    );
    
    CREATE INDEX [ix_user_partners_user_id] ON [dbo].[user_partners] ([user_id]);
    CREATE INDEX [ix_user_partners_partner_id] ON [dbo].[user_partners] ([partner_id]);
    PRINT 'Tabla user_partners creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla user_partners ya existe';
END
"""

try:
    cursor.execute(sql)
    conn.commit()
    print("✅ Tabla user_partners creada exitosamente")
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    conn.close()
