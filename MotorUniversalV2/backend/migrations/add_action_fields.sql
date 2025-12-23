-- Agregar campos nuevos a la tabla exercise_actions
-- Campos para manejo de errores y scoring
ALTER TABLE exercise_actions 
ADD COLUMN scoring_mode VARCHAR(20) DEFAULT 'exact';

ALTER TABLE exercise_actions 
ADD COLUMN on_error_action VARCHAR(20) DEFAULT 'next_step';

ALTER TABLE exercise_actions 
ADD COLUMN error_message TEXT;

ALTER TABLE exercise_actions 
ADD COLUMN max_attempts INT DEFAULT 3;

-- Campos para personalización de textbox
ALTER TABLE exercise_actions 
ADD COLUMN text_color VARCHAR(20) DEFAULT '#000000';

ALTER TABLE exercise_actions 
ADD COLUMN font_family VARCHAR(50) DEFAULT 'Arial';

-- Verificar columnas agregadas
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    COLUMN_DEFAULT,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'exercise_actions'
AND COLUMN_NAME IN (
    'scoring_mode', 
    'on_error_action', 
    'error_message', 
    'max_attempts',
    'text_color',
    'font_family'
)
ORDER BY COLUMN_NAME;
