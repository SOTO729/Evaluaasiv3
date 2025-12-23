-- Script para agregar ON DELETE CASCADE a las foreign keys de ejercicios
-- Base de datos: SQL Server (Azure SQL Database)
-- Ejecutar esto en la base de datos de producción

-- 1. Eliminar constraint existente de exercise_steps.exercise_id
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_exercise_steps_exercises')
BEGIN
    ALTER TABLE exercise_steps DROP CONSTRAINT FK_exercise_steps_exercises;
END
GO

-- Recrear constraint con CASCADE
ALTER TABLE exercise_steps
ADD CONSTRAINT FK_exercise_steps_exercises
FOREIGN KEY (exercise_id) 
REFERENCES exercises(id) 
ON DELETE CASCADE;
GO

-- 2. Eliminar constraint existente de exercise_actions.step_id
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_exercise_actions_exercise_steps')
BEGIN
    ALTER TABLE exercise_actions DROP CONSTRAINT FK_exercise_actions_exercise_steps;
END
GO

-- Recrear constraint con CASCADE
ALTER TABLE exercise_actions
ADD CONSTRAINT FK_exercise_actions_exercise_steps
FOREIGN KEY (step_id)
REFERENCES exercise_steps(id)
ON DELETE CASCADE;
GO

-- Verificar que los constraints se crearon correctamente
SELECT 
    OBJECT_NAME(f.parent_object_id) AS TableName,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
    OBJECT_NAME(f.referenced_object_id) AS ReferencedTable,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferencedColumn,
    f.delete_referential_action_desc AS DeleteAction
FROM sys.foreign_keys AS f
INNER JOIN sys.foreign_key_columns AS fc 
    ON f.object_id = fc.constraint_object_id
WHERE OBJECT_NAME(f.parent_object_id) IN ('exercise_steps', 'exercise_actions')
ORDER BY TableName;

