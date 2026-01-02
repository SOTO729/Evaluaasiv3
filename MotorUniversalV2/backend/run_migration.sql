-- Add allowed element type columns to study_sessions table
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS allow_reading BOOLEAN DEFAULT TRUE;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS allow_video BOOLEAN DEFAULT TRUE;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS allow_downloadable BOOLEAN DEFAULT TRUE;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS allow_interactive BOOLEAN DEFAULT TRUE;
