-- Migración: Eliminar constraint UNIQUE de la columna curp
-- Razón: SQL Server no permite múltiples NULL en columnas UNIQUE
--        y los usuarios tipo "editor" no requieren CURP

-- Primero identificar el nombre del constraint
-- Luego eliminarlo

-- Buscar el constraint
-- SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.users') AND is_unique = 1;

-- Eliminar el constraint UNIQUE de curp
-- El nombre del constraint puede variar, usamos el patrón común
DECLARE @constraintName NVARCHAR(256)
SELECT @constraintName = name 
FROM sys.indexes 
WHERE object_id = OBJECT_ID('dbo.users') 
  AND is_unique = 1 
  AND name LIKE '%curp%' OR name = 'UQ__users__2CDDD1944F2CC5EB';

IF @constraintName IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(MAX) = 'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(@constraintName);
    EXEC sp_executesql @sql;
    PRINT 'Constraint eliminado: ' + @constraintName;
END
ELSE
BEGIN
    -- Intentar eliminar por nombre conocido del error
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ__users__2CDDD1944F2CC5EB')
    BEGIN
        ALTER TABLE dbo.users DROP CONSTRAINT [UQ__users__2CDDD1944F2CC5EB];
        PRINT 'Constraint UQ__users__2CDDD1944F2CC5EB eliminado';
    END
END
GO
