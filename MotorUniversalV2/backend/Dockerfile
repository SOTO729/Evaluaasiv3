# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema (gcc + Playwright/Chromium)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libexpat1 \
    libatspi2.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libdrm2 \
    libxcb1 \
    libxkbcommon0 \
    libasound2 \
    libcups2 \
    libpango-1.0-0 \
    libcairo2 \
    libxshmfence1 \
    libx11-xcb1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Instalar Chromium para Playwright
RUN playwright install chromium

# Copiar código
COPY . .

# Crear usuario no-root y dar acceso a cache de browsers
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /root
# Mover browsers a directorio accesible por appuser
RUN mv /root/.cache /home/appuser/.cache 2>/dev/null || true && chown -R appuser:appuser /home/appuser
USER appuser

# Variable de entorno para que Playwright encuentre los browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/home/appuser/.cache/ms-playwright

# Exponer puerto
EXPOSE 8000

# Comando de inicio
# --preload: carga la app UNA vez (migraciones no se repiten por worker)
# --worker-tmp-dir /dev/shm: heartbeat en RAM (evita falsos timeouts en containers)
# --timeout: tiempo máximo por request (default 120s, override con GUNICORN_TIMEOUT)
# --graceful-timeout: tiempo para cerrar workers limpiamente
CMD ["sh", "-c", "exec gunicorn --bind=0.0.0.0:8000 --workers=${GUNICORN_WORKERS:-2} --timeout=${GUNICORN_TIMEOUT:-120} --graceful-timeout=30 --keep-alive=5 --worker-tmp-dir=/dev/shm --preload --access-logfile=- --error-logfile=- --log-level=info run:app"]
