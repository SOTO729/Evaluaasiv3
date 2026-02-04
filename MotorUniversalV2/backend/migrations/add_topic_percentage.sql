-- Migración para agregar porcentaje a temas
-- Fecha: 2026-02-04

-- Agregar columna percentage a topics si no existe
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('topics') AND name = 'percentage'
)
BEGIN
    ALTER TABLE topics ADD percentage FLOAT DEFAULT 0 NOT NULL;
    PRINT 'Columna percentage agregada a topics';
END
ELSE
BEGIN
    PRINT 'La columna percentage ya existe en topics';
END
GO
