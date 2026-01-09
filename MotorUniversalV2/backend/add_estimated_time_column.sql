-- Script para agregar la columna estimated_time_minutes a la tabla study_topics
-- Ejecutar en Azure Portal > PostgreSQL > Query editor
-- O mediante psql/pgAdmin conectado a la base de datos

-- Verificar si la columna ya existe antes de agregarla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'study_topics' 
        AND column_name = 'estimated_time_minutes'
    ) THEN
        ALTER TABLE study_topics ADD COLUMN estimated_time_minutes INTEGER;
        RAISE NOTICE 'Columna estimated_time_minutes agregada exitosamente a study_topics';
    ELSE
        RAISE NOTICE 'La columna estimated_time_minutes ya existe en study_topics';
    END IF;
END $$;

-- Verificar que la columna se agregó correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'study_topics' 
AND column_name = 'estimated_time_minutes';
