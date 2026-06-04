"""
Configuración global de pytest para el backend.

Neutraliza las conexiones a servicios externos (Azure Blob Storage) ANTES de
que se importen los módulos de la app. El `.env` local contiene placeholders
malformados (p. ej. `your-azure-storage-connection-string`) que harían fallar
`BlobServiceClient.from_connection_string` con `ValueError` al importar.

Como `load_dotenv()` usa `override=False`, basta con fijar estas variables a
cadena vacía aquí: el `.env` ya no podrá sobreescribirlas y el código de Azure
las tratará como "sin configurar" (modo no-op para tests).
"""
import os

# Forzar entorno de pruebas
os.environ.setdefault('FLASK_ENV', 'testing')
os.environ.setdefault('SECRET_KEY', 'test-secret')
os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret')

# Anular conexiones a Azure Storage (placeholders del .env romperían la importación)
os.environ['AZURE_STORAGE_CONNECTION_STRING'] = ''
os.environ['AZURE_VIDEO_STORAGE_CONNECTION_STRING'] = ''
