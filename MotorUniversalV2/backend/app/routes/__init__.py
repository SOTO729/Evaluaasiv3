"""
Rutas de la API
"""
from app.routes.auth import bp as auth_bp
from app.routes.exams import bp as exams_bp
from app.routes.users import bp as users_bp
from app.routes.health import bp as health_bp

__all__ = ['auth_bp', 'exams_bp', 'users_bp', 'health_bp']
