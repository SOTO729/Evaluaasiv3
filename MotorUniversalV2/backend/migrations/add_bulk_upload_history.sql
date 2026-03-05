-- Migración: Crear tablas para Histórico de Altas Masivas
-- Compatible con SQL Server (MSSQL)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'bulk_upload_batches')
BEGIN
    CREATE TABLE bulk_upload_batches (
        id INT IDENTITY(1,1) PRIMARY KEY,
        uploaded_by_id VARCHAR(36) NULL,
        partner_id INT NULL,
        campus_id INT NULL,
        group_id INT NULL,
        partner_name NVARCHAR(200) NULL,
        campus_name NVARCHAR(200) NULL,
        group_name NVARCHAR(100) NULL,
        country NVARCHAR(100) NULL,
        state_name NVARCHAR(100) NULL,
        total_processed INT NOT NULL DEFAULT 0,
        total_created INT NOT NULL DEFAULT 0,
        total_existing_assigned INT NOT NULL DEFAULT 0,
        total_errors INT NOT NULL DEFAULT 0,
        total_skipped INT NOT NULL DEFAULT 0,
        emails_sent INT NOT NULL DEFAULT 0,
        emails_failed INT NOT NULL DEFAULT 0,
        original_filename NVARCHAR(300) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_bulk_batch_uploaded_by FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_bulk_batch_partner FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE NO ACTION,
        CONSTRAINT fk_bulk_batch_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE NO ACTION,
        CONSTRAINT fk_bulk_batch_group FOREIGN KEY (group_id) REFERENCES candidate_groups(id) ON DELETE NO ACTION
    );
    CREATE INDEX ix_bulk_upload_batches_uploaded_by ON bulk_upload_batches(uploaded_by_id);
    CREATE INDEX ix_bulk_upload_batches_created ON bulk_upload_batches(created_at);
    PRINT 'Tabla bulk_upload_batches creada';
END
ELSE
    PRINT 'Tabla bulk_upload_batches ya existe';
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'bulk_upload_members')
BEGIN
    CREATE TABLE bulk_upload_members (
        id INT IDENTITY(1,1) PRIMARY KEY,
        batch_id INT NOT NULL,
        user_id VARCHAR(36) NULL,
        row_number INT NULL,
        email NVARCHAR(255) NULL,
        full_name NVARCHAR(300) NULL,
        username NVARCHAR(100) NULL,
        curp NVARCHAR(18) NULL,
        gender NVARCHAR(1) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'created',
        error_message NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT fk_bulk_member_batch FOREIGN KEY (batch_id) REFERENCES bulk_upload_batches(id) ON DELETE CASCADE,
        CONSTRAINT fk_bulk_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX ix_bulk_upload_members_batch ON bulk_upload_members(batch_id);
    CREATE INDEX ix_bulk_upload_members_user ON bulk_upload_members(user_id);
    PRINT 'Tabla bulk_upload_members creada';
END
ELSE
    PRINT 'Tabla bulk_upload_members ya existe';
GO
