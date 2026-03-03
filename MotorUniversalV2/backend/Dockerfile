# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

# Crear usuario no-root
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Exponer puerto
EXPOSE 8000

# Comando de inicio
# --preload: carga la app UNA vez (migraciones no se repiten por worker)
# --worker-tmp-dir /dev/shm: heartbeat en RAM (evita falsos timeouts en containers)
# --timeout: tiempo máximo por request (default 120s, override con GUNICORN_TIMEOUT)
# --graceful-timeout: tiempo para cerrar workers limpiamente
CMD ["sh", "-c", "exec gunicorn --bind=0.0.0.0:8000 --workers=${GUNICORN_WORKERS:-2} --timeout=${GUNICORN_TIMEOUT:-120} --graceful-timeout=30 --keep-alive=5 --worker-tmp-dir=/dev/shm --preload --access-logfile=- --error-logfile=- --log-level=info run:app"]
