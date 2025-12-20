#!/bin/bash

# Startup script for Azure App Service
echo "🚀 Iniciando Evaluaasi Motor Universal V2..."

# Ejecutar migraciones si existen
if [ -d "migrations" ]; then
    echo "🔄 Ejecutando migraciones..."
    python -m flask db upgrade || echo "⚠️  Migraciones fallaron o no se pudieron aplicar"
fi

# Iniciar Gunicorn
echo "✅ Iniciando Gunicorn..."
exec gunicorn --bind=0.0.0.0:8000 \
         --workers=2 \
         --timeout=120 \
         --access-logfile=- \
         --error-logfile=- \
         --log-level=info \
         "run:app"
