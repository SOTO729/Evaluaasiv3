"""
Script para ejecutar la migración de Partners en Azure SQL
"""
import pymssql
import sys

# Conexión a Azure SQL
conn_params = {
    'server': 'evaluaasi-motorv2-sql.database.windows.net',
    'user': 'evaluaasi_admin',
    'password': 'EvalAasi2024_c949de16dad23b6d',
    'database': 'evaluaasi',
    'port': 1433,
}

# SQL para crear las tablas
MIGRATION_SQL = """
-- =============================================
-- TABLA: partners
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[partners]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[partners] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [name] NVARCHAR(200) NOT NULL,
        [legal_name] NVARCHAR(300) NULL,
        [rfc] NVARCHAR(20) NULL,
        [email] NVARCHAR(254) NULL,
        [phone] NVARCHAR(20) NULL,
        [website] NVARCHAR(500) NULL,
        [logo_url] NVARCHAR(500) NULL,
        [is_active] BIT NOT NULL DEFAULT 1,
        [notes] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    
    CREATE INDEX [ix_partners_name] ON [dbo].[partners] ([name]);
    CREATE INDEX [ix_partners_is_active] ON [dbo].[partners] ([is_active]);
    
    PRINT 'Tabla partners creada';
END
ELSE
    PRINT 'Tabla partners ya existe';
"""

MIGRATION_SQL_2 = """
-- =============================================
-- TABLA: partner_state_presences
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[partner_state_presences]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[partner_state_presences] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [partner_id] INT NOT NULL,
        [state_name] NVARCHAR(50) NOT NULL,
        [regional_contact_name] NVARCHAR(200) NULL,
        [regional_contact_email] NVARCHAR(254) NULL,
        [regional_contact_phone] NVARCHAR(20) NULL,
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT [fk_partner_state_partner] FOREIGN KEY ([partner_id]) 
            REFERENCES [dbo].[partners]([id]) ON DELETE CASCADE,
        CONSTRAINT [uq_partner_state] UNIQUE ([partner_id], [state_name])
    );
    
    CREATE INDEX [ix_partner_state_partner_id] ON [dbo].[partner_state_presences] ([partner_id]);
    CREATE INDEX [ix_partner_state_state_name] ON [dbo].[partner_state_presences] ([state_name]);
    
    PRINT 'Tabla partner_state_presences creada';
END
ELSE
    PRINT 'Tabla partner_state_presences ya existe';
"""

MIGRATION_SQL_3 = """
-- =============================================
-- TABLA: campuses
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[campuses]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[campuses] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [partner_id] INT NOT NULL,
        [name] NVARCHAR(200) NOT NULL,
        [code] NVARCHAR(50) NULL,
        [state_name] NVARCHAR(50) NOT NULL,
        [city] NVARCHAR(100) NULL,
        [address] NVARCHAR(500) NULL,
        [postal_code] NVARCHAR(10) NULL,
        [email] NVARCHAR(254) NULL,
        [phone] NVARCHAR(20) NULL,
        [director_name] NVARCHAR(200) NULL,
        [director_email] NVARCHAR(254) NULL,
        [director_phone] NVARCHAR(20) NULL,
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT [fk_campus_partner] FOREIGN KEY ([partner_id]) 
            REFERENCES [dbo].[partners]([id]) ON DELETE CASCADE
    );
    
    CREATE INDEX [ix_campuses_partner_id] ON [dbo].[campuses] ([partner_id]);
    CREATE INDEX [ix_campuses_state_name] ON [dbo].[campuses] ([state_name]);
    CREATE INDEX [ix_campuses_is_active] ON [dbo].[campuses] ([is_active]);
    
    PRINT 'Tabla campuses creada';
END
ELSE
    PRINT 'Tabla campuses ya existe';
"""

MIGRATION_SQL_4 = """
-- =============================================
-- TABLA: candidate_groups
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[candidate_groups]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[candidate_groups] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [campus_id] INT NOT NULL,
        [name] NVARCHAR(200) NOT NULL,
        [code] NVARCHAR(50) NULL,
        [description] NVARCHAR(MAX) NULL,
        [start_date] DATE NULL,
        [end_date] DATE NULL,
        [max_members] INT NOT NULL DEFAULT 30,
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT [fk_group_campus] FOREIGN KEY ([campus_id]) 
            REFERENCES [dbo].[campuses]([id]) ON DELETE CASCADE
    );
    
    CREATE INDEX [ix_candidate_groups_campus_id] ON [dbo].[candidate_groups] ([campus_id]);
    CREATE INDEX [ix_candidate_groups_is_active] ON [dbo].[candidate_groups] ([is_active]);
    
    PRINT 'Tabla candidate_groups creada';
END
ELSE
    PRINT 'Tabla candidate_groups ya existe';
"""

MIGRATION_SQL_5 = """
-- =============================================
-- TABLA: group_members
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[group_members]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[group_members] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [group_id] INT NOT NULL,
        [user_id] NVARCHAR(36) NOT NULL,
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
    
    PRINT 'Tabla group_members creada';
END
ELSE
    PRINT 'Tabla group_members ya existe';
"""

def run_migration():
    print("Conectando a Azure SQL...")
    try:
        conn = pymssql.connect(**conn_params)
        cursor = conn.cursor()
        print("✅ Conexión exitosa")
        
        migrations = [
            ("partners", MIGRATION_SQL),
            ("partner_state_presences", MIGRATION_SQL_2),
            ("campuses", MIGRATION_SQL_3),
            ("candidate_groups", MIGRATION_SQL_4),
            ("group_members", MIGRATION_SQL_5),
        ]
        
        for name, sql in migrations:
            print(f"\n📦 Ejecutando migración: {name}...")
            try:
                cursor.execute(sql)
                conn.commit()
                print(f"   ✅ {name} completado")
            except Exception as e:
                print(f"   ⚠️ Error en {name}: {e}")
                conn.rollback()
        
        # Verificar tablas creadas
        print("\n📋 Verificando tablas creadas...")
        cursor.execute("""
            SELECT t.name, COUNT(c.name) as cols
            FROM sys.tables t
            INNER JOIN sys.columns c ON t.object_id = c.object_id
            WHERE t.name IN ('partners', 'partner_state_presences', 'campuses', 'candidate_groups', 'group_members')
            GROUP BY t.name
            ORDER BY t.name
        """)
        
        tables = cursor.fetchall()
        if tables:
            print("\n   Tabla                      | Columnas")
            print("   " + "-" * 40)
            for table in tables:
                print(f"   {table[0]:<28} | {table[1]}")
        else:
            print("   ⚠️ No se encontraron tablas")
        
        cursor.close()
        conn.close()
        print("\n✅ Migración completada exitosamente!")
        return True
        
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
