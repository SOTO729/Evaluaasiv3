-- Migración para agregar campo report_url a la tabla results
-- Ejecutar directamente en PostgreSQL si no se puede usar Alembic

-- Agregar columna report_url
ALTER TABLE results ADD COLUMN IF NOT EXISTS report_url VARCHAR(500);

-- Opcional: Agregar índice para búsquedas
-- CREATE INDEX IF NOT EXISTS idx_results_report_url ON results(report_url) WHERE report_url IS NOT NULL;
