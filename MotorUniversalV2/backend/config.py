"""
Configuración de la aplicación Flask
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuración base"""
    
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    
    # Connection Pooling para escalabilidad
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': int(os.getenv('DB_POOL_SIZE', 20)),
        'pool_recycle': int(os.getenv('DB_POOL_RECYCLE', 300)),
        'pool_pre_ping': True,
        'max_overflow': int(os.getenv('DB_MAX_OVERFLOW', 10)),
        'pool_timeout': int(os.getenv('DB_POOL_TIMEOUT', 30)),
    }
    
    # JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 900)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 2592000)))
    JWT_ALGORITHM = 'HS256'
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    
    # CORS - Incluir orígenes de producción
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 
        'http://localhost:5173,http://localhost:5174,https://thankful-stone-07fbe5410.6.azurestaticapps.net'
    ).split(',')
    CORS_SUPPORTS_CREDENTIALS = True
    
    # Redis
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    CACHE_TYPE = 'redis'
    CACHE_REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    CACHE_DEFAULT_TIMEOUT = 300
    
    # Azure Storage
    AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
    AZURE_STORAGE_CONTAINER = os.getenv('AZURE_STORAGE_CONTAINER', 'evaluaasi-files')
    
    # Azure Key Vault
    AZURE_KEY_VAULT_URL = os.getenv('AZURE_KEY_VAULT_URL', '')
    
    # Upload
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 2 * 1024 * 1024 * 1024))  # 2GB para videos
    ALLOWED_EXTENSIONS = set(os.getenv('ALLOWED_EXTENSIONS', 'png,jpg,jpeg,gif,pdf').split(','))
    
    # Pagination
    DEFAULT_PAGE_SIZE = int(os.getenv('DEFAULT_PAGE_SIZE', 20))
    MAX_PAGE_SIZE = int(os.getenv('MAX_PAGE_SIZE', 100))
    
    # Rate Limiting
    RATELIMIT_STORAGE_URL = os.getenv('RATELIMIT_STORAGE_URL', 'redis://localhost:6379/1')
    RATELIMIT_DEFAULT = "200 per day, 50 per hour"
    RATELIMIT_HEADERS_ENABLED = True
    
    # Swagger
    SWAGGER = {
        'title': 'Evaluaasi Motor Universal API',
        'version': '2.0.17',
        'description': 'API RESTful para gestión de exámenes',
        'termsOfService': '',
        'hide_top_bar': True,
    }


class DevelopmentConfig(Config):
    """Configuración de desarrollo"""
    DEBUG = True
    SQLALCHEMY_ECHO = True
    TESTING = False


class ProductionConfig(Config):
    """Configuración de producción"""
    DEBUG = False
    TESTING = False
    
    # En producción, asegurar que estas variables estén configuradas
    @classmethod
    def init_app(cls, app):
        assert os.getenv('SECRET_KEY'), "SECRET_KEY must be set in production"
        assert os.getenv('JWT_SECRET_KEY'), "JWT_SECRET_KEY must be set in production"
        assert os.getenv('DATABASE_URL'), "DATABASE_URL must be set in production"


class TestingConfig(Config):
    """Configuración de testing"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=60)
    WTF_CSRF_ENABLED = False


# Mapeo de configuraciones
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
