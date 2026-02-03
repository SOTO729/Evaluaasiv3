#!/bin/bash

# Startup script for Azure App Service
echo "🚀 Iniciando Evaluaasi Motor Universal V2..."

# Ejecutar migraciones personalizadas (agregar columnas pendientes)
if [ -f "migrate_db.py" ]; then
    echo "🔄 Ejecutando migraciones personalizadas..."
    python migrate_db.py || echo "⚠️  Migraciones personalizadas fallaron"
fi

# Crear tablas de materiales de estudio para grupos
if [ -f "create_group_study_materials.py" ]; then
    echo "🔄 Creando tablas de materiales de grupo..."
    python create_group_study_materials.py || echo "⚠️  Creación de tablas fallaron"
fi

# Agregar campos de configuración de grupo
if [ -f "add_group_config_fields.py" ]; then
    echo "🔄 Agregando campos de configuración de grupo..."
    python add_group_config_fields.py || echo "⚠️  Migración de configuración de grupo falló"
fi

# Ejecutar migraciones de Flask-Migrate si existen
if [ -d "migrations" ]; then
    echo "🔄 Ejecutando migraciones de Flask-Migrate..."
    python -m flask db upgrade || echo "⚠️  Migraciones fallaron o no se pudieron aplicar"
fi

# Iniciar Gunicorn
echo "✅ Iniciando Gunicorn..."
exec gunicorn --bind=0.0.0.0:8000 \
         --workers=2 \
         --timeout=1800 \
         --access-logfile=- \
         --error-logfile=- \
         --log-level=info \
         "run:app"
