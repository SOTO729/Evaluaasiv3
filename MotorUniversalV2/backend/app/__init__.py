"""
Factory de la aplicación Flask
"""
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_caching import Cache
from flasgger import Swagger
from config import config

# Inicializar extensiones
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cache = Cache()
swagger = Swagger()


def create_app(config_name='development'):
    """
    Factory para crear instancia de la aplicación
    
    Args:
        config_name: Nombre de la configuración ('development', 'production', 'testing')
    
    Returns:
        app: Instancia de Flask configurada
    """
    app = Flask(__name__)
    
    # Cargar configuración
    app.config.from_object(config[config_name])
    
    # Inicializar extensiones
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cache.init_app(app)
    swagger.init_app(app)
    
    # Configurar CORS
    CORS(app, 
         origins=app.config['CORS_ORIGINS'],
         supports_credentials=app.config['CORS_SUPPORTS_CREDENTIALS'])
    
    # Registrar blueprints
    from app.routes import auth, exams, users, health, init, reset, debug
    
    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    app.register_blueprint(exams.bp, url_prefix='/api/exams')
    app.register_blueprint(users.bp, url_prefix='/api/users')
    app.register_blueprint(health.bp, url_prefix='/api')
    app.register_blueprint(init.init_bp, url_prefix='/api')
    app.register_blueprint(reset.reset_bp, url_prefix='/api')
    app.register_blueprint(debug.debug_bp, url_prefix='/api')
    
    # Manejadores de errores
    register_error_handlers(app)
    
    # Callbacks JWT
    register_jwt_callbacks(app)
    
    # Shell context
    @app.shell_context_processor
    def make_shell_context():
        from app.models import User, Exam, Category, Topic, Question, Answer, Exercise
        return {
            'db': db,
            'User': User,
            'Exam': Exam,
            'Category': Category,
            'Topic': Topic,
            'Question': Question,
            'Answer': Answer,
            'Exercise': Exercise
        }
    
    return app


def register_error_handlers(app):
    """Registrar manejadores de errores globales"""
    
    @app.errorhandler(400)
    def bad_request(error):
        return {'error': 'Bad Request', 'message': str(error)}, 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return {'error': 'Unauthorized', 'message': 'Authentication required'}, 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return {'error': 'Forbidden', 'message': 'Insufficient permissions'}, 403
    
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not Found', 'message': 'Resource not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return {'error': 'Internal Server Error', 'message': 'An unexpected error occurred'}, 500


def register_jwt_callbacks(app):
    """Registrar callbacks para JWT"""
    
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {'error': 'Token Expired', 'message': 'The token has expired'}, 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return {'error': 'Invalid Token', 'message': str(error)}, 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return {'error': 'Authorization Required', 'message': 'Request does not contain an access token'}, 401
    
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return {'error': 'Token Revoked', 'message': 'The token has been revoked'}, 401
