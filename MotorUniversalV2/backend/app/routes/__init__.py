"""
Rutas de la API
"""
from app.routes.auth import bp as auth_bp
from app.routes.exams import bp as exams_bp
from app.routes.users import bp as users_bp
from app.routes.health import bp as health_bp
from app.routes.init import init_bp
from app.routes.reset import reset_bp
from app.routes.debug import debug_bp
from app.routes.partners import bp as partners_bp
from app.routes.user_management import bp as user_management_bp

__all__ = ['auth_bp', 'exams_bp', 'users_bp', 'health_bp', 'init_bp', 'reset_bp', 'debug_bp', 'partners_bp', 'user_management_bp']
