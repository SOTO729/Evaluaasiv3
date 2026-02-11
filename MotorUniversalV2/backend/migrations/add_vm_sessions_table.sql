-- Migración: Crear tabla vm_sessions para agendar sesiones de máquinas virtuales
-- Fecha: 2025

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vm_sessions')
BEGIN
    CREATE TABLE vm_sessions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        campus_id INT NOT NULL,
        group_id INT NULL,
        session_date DATE NOT NULL,
        start_hour INT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
        status NVARCHAR(20) NOT NULL DEFAULT 'scheduled',
        notes NVARCHAR(MAX) NULL,
        created_by_id VARCHAR(36) NULL,
        cancelled_by_id VARCHAR(36) NULL,
        cancellation_reason NVARCHAR(500) NULL,
        cancelled_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT fk_vm_session_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_vm_session_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
        CONSTRAINT fk_vm_session_group FOREIGN KEY (group_id) REFERENCES candidate_groups(id),
        CONSTRAINT fk_vm_session_created_by FOREIGN KEY (created_by_id) REFERENCES users(id),
        CONSTRAINT fk_vm_session_cancelled_by FOREIGN KEY (cancelled_by_id) REFERENCES users(id),

        -- Restricción única: 1 sesión por campus + fecha + hora
        CONSTRAINT uq_vm_session_slot UNIQUE (campus_id, session_date, start_hour)
    );

    -- Índices para consultas frecuentes
    CREATE INDEX ix_vm_sessions_user_id ON vm_sessions(user_id);
    CREATE INDEX ix_vm_sessions_campus_date ON vm_sessions(campus_id, session_date);
    CREATE INDEX ix_vm_sessions_status ON vm_sessions(status);
    CREATE INDEX ix_vm_sessions_session_date ON vm_sessions(session_date);

    PRINT 'Tabla vm_sessions creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla vm_sessions ya existe';
END
GO
