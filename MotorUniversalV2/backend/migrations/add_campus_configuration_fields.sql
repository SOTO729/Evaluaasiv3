-- Migración: Agregar campos de configuración al modelo Campus
-- Fecha: 2024
-- Descripción: Agrega campos para configuración de Office, certificaciones, parciales, VMs, pagos y vigencia

-- Verificar y agregar columnas de configuración del plantel

-- Versión de Office
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'office_version')
BEGIN
    ALTER TABLE campuses ADD office_version VARCHAR(20) DEFAULT 'office_365';
    PRINT 'Columna office_version agregada';
END

-- Niveles de certificación
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'enable_tier_basic')
BEGIN
    ALTER TABLE campuses ADD enable_tier_basic BIT DEFAULT 0;
    PRINT 'Columna enable_tier_basic agregada';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'enable_tier_standard')
BEGIN
    ALTER TABLE campuses ADD enable_tier_standard BIT DEFAULT 1;
    PRINT 'Columna enable_tier_standard agregada';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'enable_tier_advanced')
BEGIN
    ALTER TABLE campuses ADD enable_tier_advanced BIT DEFAULT 0;
    PRINT 'Columna enable_tier_advanced agregada';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'enable_digital_badge')
BEGIN
    ALTER TABLE campuses ADD enable_digital_badge BIT DEFAULT 0;
    PRINT 'Columna enable_digital_badge agregada';
END

-- Evaluaciones parciales
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'enable_partial_evaluations')
BEGIN
    ALTER TABLE campuses ADD enable_partial_evaluations BIT DEFAULT 0;
    PRINT 'Columna enable_partial_evaluations agregada';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'enable_unscheduled_partials')
BEGIN
    ALTER TABLE campuses ADD enable_unscheduled_partials BIT DEFAULT 0;
    PRINT 'Columna enable_unscheduled_partials agregada';
END

-- Características adicionales
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'enable_virtual_machines')
BEGIN
    ALTER TABLE campuses ADD enable_virtual_machines BIT DEFAULT 0;
    PRINT 'Columna enable_virtual_machines agregada';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'enable_online_payments')
BEGIN
    ALTER TABLE campuses ADD enable_online_payments BIT DEFAULT 0;
    PRINT 'Columna enable_online_payments agregada';
END

-- Vigencia del plantel
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'license_start_date')
BEGIN
    ALTER TABLE campuses ADD license_start_date DATE;
    PRINT 'Columna license_start_date agregada';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'license_end_date')
BEGIN
    ALTER TABLE campuses ADD license_end_date DATE;
    PRINT 'Columna license_end_date agregada';
END

-- Costos
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'certification_cost')
BEGIN
    ALTER TABLE campuses ADD certification_cost DECIMAL(10,2) DEFAULT 0;
    PRINT 'Columna certification_cost agregada';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'retake_cost')
BEGIN
    ALTER TABLE campuses ADD retake_cost DECIMAL(10,2) DEFAULT 0;
    PRINT 'Columna retake_cost agregada';
END

-- Estado de configuración
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'configuration_completed')
BEGIN
    ALTER TABLE campuses ADD configuration_completed BIT DEFAULT 0;
    PRINT 'Columna configuration_completed agregada';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'campuses') AND name = 'configuration_completed_at')
BEGIN
    ALTER TABLE campuses ADD configuration_completed_at DATETIME;
    PRINT 'Columna configuration_completed_at agregada';
END

PRINT 'Migración completada exitosamente';
