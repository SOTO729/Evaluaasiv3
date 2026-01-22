#!/usr/bin/env python3
"""Script para crear la tabla group_members con el tipo correcto."""
import pymssql

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_c949de16dad23b6d',
    database='evaluaasi'
)
cursor = conn.cursor()

sql = """
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[group_members]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[group_members] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [group_id] INT NOT NULL,
        [user_id] VARCHAR(36) NOT NULL,
        [status] NVARCHAR(20) NOT NULL DEFAULT 'active',
        [notes] NVARCHAR(MAX) NULL,
        [joined_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT [fk_member_group] FOREIGN KEY ([group_id]) 
            REFERENCES [dbo].[candidate_groups]([id]) ON DELETE CASCADE,
        CONSTRAINT [fk_member_user] FOREIGN KEY ([user_id]) 
            REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
        CONSTRAINT [uq_group_member] UNIQUE ([group_id], [user_id])
    );
    
    CREATE INDEX [ix_group_members_group_id] ON [dbo].[group_members] ([group_id]);
    CREATE INDEX [ix_group_members_user_id] ON [dbo].[group_members] ([user_id]);
    CREATE INDEX [ix_group_members_status] ON [dbo].[group_members] ([status]);
    PRINT 'Tabla group_members creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla group_members ya existe';
END
"""

try:
    cursor.execute(sql)
    conn.commit()
    print("✅ Tabla group_members creada exitosamente")
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    conn.close()
