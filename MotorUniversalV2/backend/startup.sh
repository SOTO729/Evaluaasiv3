#!/bin/bash

# Startup script for Azure App Service
echo "🚀 Iniciando Evaluaasi Motor Universal V2..."

# Ejecutar migraciones personalizadas (agregar columnas pendientes)
if [ -f "migrate_db.py" ]; then
    echo "🔄 Ejecutando migraciones personalizadas..."
    python migrate_db.py || echo "⚠️  Migraciones personalizadas fallaron"
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
