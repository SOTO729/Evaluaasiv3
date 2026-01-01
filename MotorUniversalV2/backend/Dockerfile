# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema incluyendo FFmpeg para compresión de video
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    ffmpeg \
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

# Comando de inicio - timeout de 30 minutos para procesamiento de videos grandes
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "1800", "--access-logfile", "-", "--error-logfile", "-", "run:app"]
