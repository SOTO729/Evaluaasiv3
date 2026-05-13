"""
Factory de la aplicación Flask
"""
import os
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
        from app.routes.standards import standards_bp, office_standards_bp
        print("[INIT] ✅ standards_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando standards_bp: {e}")
        raise
    
    try:
        from app.routes.partners import bp as partners_bp
        print("[INIT] ✅ partners_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando partners_bp: {e}")
        raise

    try:
        from app.routes.verify import bp as verify_bp
        print("[INIT] ✅ verify_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando verify_bp: {e}")
        raise

    try:
        from app.routes.balance import bp as balance_bp
        print("[INIT] ✅ balance_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando balance_bp: {e}")
        raise

    try:
        from app.routes.activity import bp as activity_bp
        print("[INIT] ✅ activity_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando activity_bp: {e}")
        raise

    try:
        from app.routes.badges import bp as badges_bp
        print("[INIT] ✅ badges_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando badges_bp: {e}")
        raise

    try:
        from app.routes.support import bp as support_bp
        print("[INIT] ✅ support_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando support_bp: {e}")
        raise
    
    try:
        from app.routes.support_chat import bp as support_chat_bp
        print("[INIT] ✅ support_chat_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando support_chat_bp: {e}")
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
    # SECURITY: init, reset y debug deshabilitados en producción
    # Estos blueprints contienen endpoints destructivos (drop_all, create_all)
    # Solo habilitar temporalmente durante mantenimiento con ENABLE_DEV_ENDPOINTS=true
    if os.environ.get('ENABLE_DEV_ENDPOINTS', 'false').lower() == 'true':
        app.register_blueprint(init.init_bp, url_prefix='/api')
        print("[INIT] ⚠️ init registrado (DEV MODE)")
        app.register_blueprint(reset.reset_bp, url_prefix='/api')
        print("[INIT] ⚠️ reset registrado (DEV MODE)")
        app.register_blueprint(debug.debug_bp, url_prefix='/api')
        print("[INIT] ⚠️ debug registrado (DEV MODE)")
    else:
        print("[INIT] 🔒 init/reset/debug DESHABILITADOS (producción)")
    app.register_blueprint(study_contents_bp, url_prefix='/api/study-contents')
    print("[INIT] ✅ study-contents registrado")
    app.register_blueprint(conocer_bp, url_prefix='/api/conocer')
    print("[INIT] ✅ conocer registrado")
    app.register_blueprint(standards_bp, url_prefix='/api/competency-standards')
    print("[INIT] ✅ standards registrado")
    app.register_blueprint(office_standards_bp, url_prefix='/api/standards')
    print("[INIT] ✅ office_standards registrado en /api/standards (legacy compat)")
    app.register_blueprint(partners_bp, url_prefix='/api/partners')
    print("[INIT] ✅ partners registrado")
    app.register_blueprint(verify_bp, url_prefix='/api/verify')
    print("[INIT] ✅ verify registrado (rutas públicas)")
    app.register_blueprint(balance_bp, url_prefix='/api/balance')
    print("[INIT] ✅ balance registrado (saldos y solicitudes)")
    app.register_blueprint(activity_bp, url_prefix='/api/activity')
    print("[INIT] ✅ activity registrado (logs de actividad)")
    app.register_blueprint(badges_bp, url_prefix='/api/badges')
    print("[INIT] ✅ badges registrado (insignias digitales)")

    # SCORM 1.2
    try:
        from app.routes.scorm import scorm_bp
        app.register_blueprint(scorm_bp, url_prefix='/api/scorm')
        print("[INIT] ✅ scorm registrado (SCORM 1.2 packages + attempts)")
    except Exception as e:
        print(f"[INIT] ❌ Error importando scorm_bp: {e}")
    
    from app.routes.badges import short_share_bp
    app.register_blueprint(short_share_bp)
    print("[INIT] ✅ short-share registrado (URL corta /s/<code>)")
    
    try:
        from app.routes.vm_sessions import bp as vm_sessions_bp
        print("[INIT] ✅ vm_sessions_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando vm_sessions_bp: {e}")
        raise
    
    app.register_blueprint(vm_sessions_bp, url_prefix='/api/vm-sessions')
    print("[INIT] ✅ vm-sessions registrado (máquinas virtuales)")
    app.register_blueprint(support_bp)
    print("[INIT] ✅ support registrado")
    app.register_blueprint(support_chat_bp)
    print("[INIT] ✅ support-chat registrado")
    
    # Importar y registrar user_management
    from app.routes.user_management import bp as user_management_bp
    app.register_blueprint(user_management_bp)
    print("[INIT] ✅ user-management registrado")

    # Mapeo admin de partners/campuses → EvaluaasiConfig (legacy)
    try:
        from app.routes.admin_config_mapping import bp as admin_config_mapping_bp
        app.register_blueprint(admin_config_mapping_bp)
        print("[INIT] ✅ admin-config-mapping registrado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando admin_config_mapping_bp: {e}")

    # Verificación admin del estado AD (SOAP ADWebService)
    try:
        from app.routes.admin_ad_check import bp as admin_ad_check_bp
        app.register_blueprint(admin_ad_check_bp)
        print("[INIT] ✅ admin-ad-check registrado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando admin_ad_check_bp: {e}")

    # Verificación admin del envío de email (SMTP)
    try:
        from app.routes.admin_email_check import bp as admin_email_check_bp
        app.register_blueprint(admin_email_check_bp)
        print("[INIT] ✅ admin-email-check registrado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando admin_email_check_bp: {e}")

    # Pagos en línea (Mercado Pago)
    try:
        from app.routes.payments import bp as payments_bp
        app.register_blueprint(payments_bp, url_prefix='/api/payments')
        print("[INIT] ✅ payments registrado (Mercado Pago)")
    except Exception as e:
        print(f"[INIT] ❌ Error importando payments_bp: {e}")
        raise
    
    # Downloads (EXEs Office para candidatos/responsables)
    try:
        from app.routes.downloads import bp as downloads_bp
        app.register_blueprint(downloads_bp, url_prefix='/api/downloads')
        print("[INIT] ✅ downloads registrado (descargas Office)")
    except Exception as e:
        print(f"[INIT] ❌ Error importando downloads_bp: {e}")
        raise

    # VB6 Office integration (REST API para apps VB6 legacy)
    try:
        from app.routes.vb6 import bp as vb6_bp
        app.register_blueprint(vb6_bp, url_prefix='/api/vb6')
        print("[INIT] ✅ vb6 registrado (integración Office VB6)")
    except Exception as e:
        print(f"[INIT] ❌ Error importando vb6_bp: {e}")
        raise
    
    # SOAP-compatible layer for VB6 legacy apps (same XML format as srvcsvls7-1)
    try:
        from app.routes.soap_compat import bp as soap_compat_bp
        app.register_blueprint(soap_compat_bp)  # sin prefix — EXEs llaman a /AdminTools.asmx directo
        print("[INIT] ✅ soap_compat registrado (capa SOAP para VB6)")
    except Exception as e:
        print(f"[INIT] ❌ Error importando soap_compat_bp: {e}")
        raise

    # Office Exam Results (consulta candidato/staff y verificación pública)
    try:
        from app.routes.office_results import bp as office_results_bp
        app.register_blueprint(office_results_bp, url_prefix='/api/office-results')
        print("[INIT] ✅ office_results registrado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando office_results_bp: {e}")
        raise

    # Maintenance (cleanup tokens vb6 + timeout vm_sessions)
    try:
        from app.routes.maintenance import bp as maintenance_bp
        app.register_blueprint(maintenance_bp)
        print("[INIT] ✅ maintenance registrado (cleanup jobs)")
    except Exception as e:
        print(f"[INIT] ❌ Error importando maintenance_bp: {e}")
        raise

    # SSO Tokenización API (mayo 2026)
    try:
        from app.routes.sso import bp as sso_bp
        app.register_blueprint(sso_bp, url_prefix='/api/sso')
        print("[INIT] ✅ sso registrado en /api/sso")
    except Exception as e:
        print(f"[INIT] ❌ Error importando sso_bp: {e}")
        raise

    print("[INIT] ✅ Todos los blueprints registrados correctamente")
    
    # Verificar y agregar columna label_style si no existe
    with app.app_context():
        ensure_sqlite_schema(app)
        ensure_label_style_column(app)
        try:
            from app.auto_migrate import check_and_create_support_chat_tables, check_and_create_bulk_upload_tables
            check_and_create_support_chat_tables()
            check_and_create_bulk_upload_tables()
        except Exception as e:
            print(f"[AUTO-MIGRATE] Error verificando tablas: {e}")

        # Office local sessions & VB6 integration tables
        try:
            from app.auto_migrate import check_and_create_office_tables
            check_and_create_office_tables()
        except Exception as e:
            print(f"[AUTO-MIGRATE] Error verificando tablas Office: {e}")

        # Add issuer_logo columns to badge_templates
        try:
            from sqlalchemy import inspect as sa_inspect, text
            inspector = sa_inspect(db.engine)
            if 'badge_templates' in inspector.get_table_names():
                cols = [c['name'] for c in inspector.get_columns('badge_templates')]
                for col_name, col_def in [('issuer_logo_url', 'NVARCHAR(500) NULL'), ('issuer_logo_blob_name', 'NVARCHAR(500) NULL')]:
                    if col_name not in cols:
                        db.session.execute(text(f"ALTER TABLE badge_templates ADD {col_name} {col_def}"))
                        db.session.commit()
                        print(f"[AUTO-MIGRATE] Added {col_name} to badge_templates")
        except Exception as e:
            db.session.rollback()
            if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                print(f"[AUTO-MIGRATE] Error adding issuer_logo columns: {e}")

        # Add candidate payment columns to payments table
        try:
            from sqlalchemy import inspect as sa_inspect, text
            inspector = sa_inspect(db.engine)
            if 'payments' in inspector.get_table_names():
                cols = [c['name'] for c in inspector.get_columns('payments')]
                for col_name, col_def in [
                    ('group_exam_id', 'INT NULL'),
                    ('payment_type', "VARCHAR(20) DEFAULT 'voucher' NOT NULL"),
                ]:
                    if col_name not in cols:
                        db.session.execute(text(f"ALTER TABLE payments ADD {col_name} {col_def}"))
                        db.session.commit()
                        print(f"[AUTO-MIGRATE] Added {col_name} to payments")
        except Exception as e:
            db.session.rollback()
            if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                print(f"[AUTO-MIGRATE] Error adding payment columns: {e}")

        # Recover orphaned curp_pending users from interrupted verifications
        try:
            from app.auto_migrate import check_and_recover_orphaned_curp_users
            check_and_recover_orphaned_curp_users()
        except Exception as e:
            print(f"[CURP-RECOVERY] Error checking for orphaned users: {e}")

        # CURP local drain: si CURP_RENAPO_ENABLED=false, valida localmente
        # los usuarios atascados en curp_pending/curp_verifying/curp_required.
        try:
            from app.auto_migrate import drain_curp_queue_with_local_validation
            drain_curp_queue_with_local_validation()
        except Exception as e:
            print(f"[CURP-LOCAL-DRAIN] Error en drain: {e}")

        # Tablas curp_renapo_cache y curp_verification_queue (mayo 2026)
        try:
            from app.auto_migrate import check_and_create_curp_verification_tables
            check_and_create_curp_verification_tables()
        except Exception as e:
            print(f"[AUTO-MIGRATE] Error creando tablas CURP verification: {e}")

        # SSO Tokenización (api_key partners + external_id users + sso_tokens)
        try:
            from app.auto_migrate import check_and_create_sso_tokenization
            check_and_create_sso_tokenization()
        except Exception as e:
            print(f"[AUTO-MIGRATE] Error verificando SSO Tokenización: {e}")

    # Arrancar worker de cola de verificación CURP (background thread)
    try:
        from app.services.curp_queue_worker import start_curp_worker
        start_curp_worker(app)
    except Exception as e:
        print(f"[CURP-WORKER] Error arrancando worker: {e}")

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
    
    # Actualizar last_seen en cada request autenticado (lightweight)
    @app.before_request
    def _update_last_seen():
        from flask import request as req
        auth_header = req.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return
        try:
            from flask_jwt_extended import decode_token
            from datetime import datetime
            token_data = decode_token(auth_header.split(' ', 1)[1])
            user_id = token_data.get('sub')
            if user_id:
                db.session.execute(
                    db.text("UPDATE users SET last_seen = :now WHERE id = :uid"),
                    {"now": datetime.utcnow(), "uid": user_id},
                )
                db.session.commit()
        except Exception:
            pass

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
    
    # Verificar y agregar columna pdf_status en results
    try:
        result = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'results' 
            AND COLUMN_NAME = 'pdf_status'
        """))
        exists = result.scalar()
        
        if exists == 0:
            print("[AUTO-MIGRATE] La columna pdf_status NO existe en results. Agregando...")
            db.session.execute(text("""
                ALTER TABLE results 
                ADD pdf_status VARCHAR(50) DEFAULT 'pending'
            """))
            db.session.commit()
            print("[AUTO-MIGRATE] Columna pdf_status agregada exitosamente a results")
        else:
            print("[AUTO-MIGRATE] Columna pdf_status ya existe en results")
    except Exception as e:
        db.session.rollback()
        print(f"[AUTO-MIGRATE] Error verificando/agregando pdf_status: {e}")


def ensure_sqlite_schema(app):
    """Crear tablas automáticamente en SQLite local si no existen."""
    from sqlalchemy import inspect

    try:
        if db.engine.dialect.name != 'sqlite':
            return

        inspector = inspect(db.engine)
        if 'users' in inspector.get_table_names():
            return

        print("[INIT] ⚠️  SQLite sin tablas detectado, creando schema...")
        db.create_all()
        print("[INIT] ✅ Schema SQLite creado")
    except Exception as e:
        db.session.rollback()
        print(f"[INIT] ❌ Error creando schema SQLite: {e}")

# Force reload at Sat Jan  3 16:25:57 UTC 2026
# Force deploy Sun Jan  4 21:04:10 UTC 2026
