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
    
    # Configurar CORS con opciones completas
    CORS(app, 
         origins=app.config['CORS_ORIGINS'],
         supports_credentials=app.config['CORS_SUPPORTS_CREDENTIALS'],
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
         expose_headers=['Content-Type', 'Authorization'])
    
    # Registrar blueprints con logging
    print("[INIT] Importando blueprints...")
    try:
        from app.routes import auth, exams, users, health, init, reset, debug
        print("[INIT] ✅ Blueprints principales importados")
    except Exception as e:
        print(f"[INIT] ❌ Error importando blueprints principales: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    try:
        from app.routes.study_contents import study_contents_bp
        print("[INIT] ✅ study_contents_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando study_contents_bp: {e}")
        raise
        
    try:
        from app.routes.conocer import conocer_bp
        print("[INIT] ✅ conocer_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando conocer_bp: {e}")
        raise
        
    try:
        from app.routes.standards import standards_bp
        print("[INIT] ✅ standards_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando standards_bp: {e}")
        raise
    
    print("[INIT] Registrando blueprints...")
    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    print("[INIT] ✅ auth registrado")
    app.register_blueprint(exams.bp, url_prefix='/api/exams')
    print("[INIT] ✅ exams registrado en /api/exams")
    app.register_blueprint(users.bp, url_prefix='/api/users')
    print("[INIT] ✅ users registrado")
    app.register_blueprint(health.bp, url_prefix='/api')
    print("[INIT] ✅ health registrado")
    app.register_blueprint(init.init_bp, url_prefix='/api')
    print("[INIT] ✅ init registrado")
    app.register_blueprint(reset.reset_bp, url_prefix='/api')
    print("[INIT] ✅ reset registrado")
    app.register_blueprint(debug.debug_bp, url_prefix='/api')
    print("[INIT] ✅ debug registrado")
    app.register_blueprint(study_contents_bp, url_prefix='/api/study-contents')
    print("[INIT] ✅ study-contents registrado")
    app.register_blueprint(conocer_bp, url_prefix='/api/conocer')
    print("[INIT] ✅ conocer registrado")
    app.register_blueprint(standards_bp, url_prefix='/api/competency-standards')
    print("[INIT] ✅ standards registrado")
    print("[INIT] ✅ Todos los blueprints registrados correctamente")
    
    # Verificar y agregar columna label_style si no existe
    with app.app_context():
        ensure_label_style_column(app)
    
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


def ensure_label_style_column(app):
    """Verificar y agregar la columna label_style si no existe"""
    from sqlalchemy import text
    try:
        # Verificar si la columna existe
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'study_interactive_exercise_actions' 
            AND COLUMN_NAME = 'label_style'
        """))
        exists = result.scalar()
        
        if exists == 0:
            print("[AUTO-MIGRATE] La columna label_style NO existe. Agregando...")
            db.session.execute(text("""
                ALTER TABLE study_interactive_exercise_actions 
                ADD label_style VARCHAR(20) DEFAULT 'invisible'
            """))
            db.session.commit()
            print("[AUTO-MIGRATE] Columna label_style agregada exitosamente")
        else:
            print("[AUTO-MIGRATE] Columna label_style ya existe")
    except Exception as e:
        db.session.rollback()
        print(f"[AUTO-MIGRATE] Error verificando/agregando label_style: {e}")
# Force reload at Sat Jan  3 16:25:57 UTC 2026
# Force deploy Sun Jan  4 21:04:10 UTC 2026
