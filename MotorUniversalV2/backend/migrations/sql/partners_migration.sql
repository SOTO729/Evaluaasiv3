-- =============================================
-- Migración: Módulo de Partners (Coordinador)
-- Fecha: 2026-01-22
-- Descripción: Crear tablas para gestión de Partners,
--              Planteles (Campus), Grupos y Miembros
-- =============================================

-- =============================================
-- TABLA: partners
-- Empresas/organizaciones asociadas
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
    
    PRINT 'Tabla partners creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla partners ya existe';
END
GO

-- =============================================
-- TABLA: partner_state_presences
-- Presencia de partners en estados mexicanos
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
    
    PRINT 'Tabla partner_state_presences creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla partner_state_presences ya existe';
END
GO

-- =============================================
-- TABLA: campuses
-- Planteles/sucursales de los partners
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
    CREATE UNIQUE INDEX [ix_campuses_code] ON [dbo].[campuses] ([code]) WHERE [code] IS NOT NULL;
    
    PRINT 'Tabla campuses creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla campuses ya existe';
END
GO

-- =============================================
-- TABLA: candidate_groups
-- Grupos de candidatos dentro de cada plantel
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
    CREATE UNIQUE INDEX [ix_candidate_groups_code] ON [dbo].[candidate_groups] ([code]) WHERE [code] IS NOT NULL;
    
    PRINT 'Tabla candidate_groups creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla candidate_groups ya existe';
END
GO

-- =============================================
-- TABLA: group_members
-- Miembros (candidatos) de cada grupo
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[group_members]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[group_members] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [group_id] INT NOT NULL,
        [user_id] NVARCHAR(36) NOT NULL,  -- UUID del usuario
        [status] NVARCHAR(20) NOT NULL DEFAULT 'active',  -- active, inactive, completed, withdrawn
        [notes] NVARCHAR(MAX) NULL,
        [joined_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT [fk_member_group] FOREIGN KEY ([group_id]) 
            REFERENCES [dbo].[candidate_groups]([id]) ON DELETE CASCADE,
        CONSTRAINT [fk_member_user] FOREIGN KEY ([user_id]) 
            REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
        CONSTRAINT [uq_group_member] UNIQUE ([group_id], [user_id]),
        CONSTRAINT [chk_member_status] CHECK ([status] IN ('active', 'inactive', 'completed', 'withdrawn'))
    );
    
    CREATE INDEX [ix_group_members_group_id] ON [dbo].[group_members] ([group_id]);
    CREATE INDEX [ix_group_members_user_id] ON [dbo].[group_members] ([user_id]);
    CREATE INDEX [ix_group_members_status] ON [dbo].[group_members] ([status]);
    
    PRINT 'Tabla group_members creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla group_members ya existe';
END
GO

-- =============================================
-- Agregar columna campus_id a usuarios (opcional)
-- Para vincular usuarios a un plantel por defecto
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'campus_id')
BEGIN
    ALTER TABLE [dbo].[users] ADD [campus_id] INT NULL;
    
    ALTER TABLE [dbo].[users] ADD CONSTRAINT [fk_user_campus] 
        FOREIGN KEY ([campus_id]) REFERENCES [dbo].[campuses]([id]) ON DELETE SET NULL;
    
    CREATE INDEX [ix_users_campus_id] ON [dbo].[users] ([campus_id]);
    
    PRINT 'Columna campus_id agregada a tabla users';
END
ELSE
BEGIN
    PRINT 'Columna campus_id ya existe en tabla users';
END
GO

-- =============================================
-- Verificación final
-- =============================================
SELECT 
    t.name AS tabla,
    COUNT(c.name) AS columnas
FROM sys.tables t
INNER JOIN sys.columns c ON t.object_id = c.object_id
WHERE t.name IN ('partners', 'partner_state_presences', 'campuses', 'candidate_groups', 'group_members')
GROUP BY t.name
ORDER BY t.name;
GO

PRINT '========================================';
PRINT 'Migración de Partners completada';
PRINT '========================================';
