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
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
         expose_headers=['Content-Type', 'Authorization'],
         max_age=86400)
    
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
    app.register_blueprint(partners_bp, url_prefix='/api/partners')
    print("[INIT] ✅ partners registrado")
    app.register_blueprint(verify_bp, url_prefix='/api/verify')
    print("[INIT] ✅ verify registrado (rutas públicas)")
    app.register_blueprint(balance_bp, url_prefix='/api/balance')
    print("[INIT] ✅ balance registrado (saldos y solicitudes)")
    app.register_blueprint(activity_bp, url_prefix='/api/activity')
    print("[INIT] ✅ activity registrado (logs de actividad)")
    
    try:
        from app.routes.badges import bp as badges_bp
        print("[INIT] ✅ badges_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando badges_bp: {e}")
        raise
    
    app.register_blueprint(badges_bp, url_prefix='/api/badges')
    print("[INIT] ✅ badges registrado (insignias digitales OB3)")
    
    try:
        from app.routes.vm_sessions import bp as vm_sessions_bp
        print("[INIT] ✅ vm_sessions_bp importado")
    except Exception as e:
        print(f"[INIT] ❌ Error importando vm_sessions_bp: {e}")
        raise
    
    app.register_blueprint(vm_sessions_bp, url_prefix='/api/vm-sessions')
    print("[INIT] ✅ vm-sessions registrado (máquinas virtuales)")
    
    # Importar y registrar user_management
    from app.routes.user_management import bp as user_management_bp
    app.register_blueprint(user_management_bp)
    print("[INIT] ✅ user-management registrado")
    
    print("[INIT] ✅ Todos los blueprints registrados correctamente")
    
    # Verificar y agregar columna label_style si no existe
    with app.app_context():
        ensure_label_style_column(app)
    
    # Initialize CONOCER weekly scheduler
    try:
        from app.services.conocer_scheduler import init_scheduler
        init_scheduler(app)
        print("[INIT] ✅ CONOCER scheduler initialized")
    except Exception as e:
        print(f"[INIT] ⚠️ CONOCER scheduler failed to initialize: {e}")
    
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
    
    # Security headers
    @app.after_request
    def add_security_headers(response):
        """Agregar headers de seguridad a todas las respuestas"""
        # Prevenir MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        # Prevenir clickjacking
        response.headers['X-Frame-Options'] = 'DENY'
        # Prevenir XSS (legacy, pero útil para navegadores antiguos)
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # Forzar HTTPS (solo en producción)
        if not app.debug:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        # Referrer policy
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        # Permissions policy (deshabilitar APIs peligrosas)
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        return response
    
    print("[INIT] ✅ Security headers configurados")
    
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
    from sqlalchemy import text, inspect
    
    # Detectar tipo de base de datos
    db_url = str(db.engine.url)
    is_postgres = 'postgresql' in db_url or 'postgres' in db_url
    
    try:
        # Usar inspector de SQLAlchemy (más portable)
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'study_interactive_exercise_actions' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('study_interactive_exercise_actions')]
            
            if 'label_style' not in existing_columns:
                print("[AUTO-MIGRATE] La columna label_style NO existe. Agregando...")
                if is_postgres:
                    db.session.execute(text("""
                        ALTER TABLE study_interactive_exercise_actions 
                        ADD COLUMN IF NOT EXISTS label_style VARCHAR(20) DEFAULT 'invisible'
                    """))
                else:
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
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'results' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('results')]
            
            if 'pdf_status' not in existing_columns:
                print("[AUTO-MIGRATE] La columna pdf_status NO existe en results. Agregando...")
                if is_postgres:
                    db.session.execute(text("""
                        ALTER TABLE results 
                        ADD COLUMN IF NOT EXISTS pdf_status VARCHAR(50) DEFAULT 'pending'
                    """))
                else:
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
    
    # Verificar y crear tabla school_cycles
    _ensure_school_cycles_table()
    
    # Verificar y agregar columna school_cycle_id en candidate_groups
    _ensure_school_cycle_id_column()
    
    # Verificar y agregar columnas para activación de planteles
    _ensure_campus_activation_columns()
    
    # Verificar y agregar columna eduit_certificate_code en results
    _ensure_eduit_certificate_code_column()
    
    # Verificar y crear tabla campus_competency_standards
    _ensure_campus_competency_standards_table()
    
    # Verificar y crear tabla brands + brand_id en competency_standards
    _ensure_brands_table()
    
    # Verificar y agregar columna logo_url en competency_standards
    _ensure_competency_standard_logo_column()
    
    # Hacer email nullable para candidatos sin email
    _ensure_email_nullable()
    
    # Agregar columna attachments a balance_requests
    _ensure_balance_attachments_column()
    
    # Verificar y crear tabla ecm_candidate_assignments
    _ensure_ecm_candidate_assignments_table()
    
    # Agregar columnas de config de asignación por defecto a exams
    _ensure_exam_default_config_columns()

    # Crear tabla certificate_code_history para QR persistentes
    _ensure_certificate_code_history_table()


def _ensure_balance_attachments_column():
    """Agregar columna attachments a balance_requests"""
    from app.auto_migrate import check_and_add_balance_attachments_column
    
    try:
        print("[AUTO-MIGRATE] Ejecutando migración de attachments en balance_requests...")
        check_and_add_balance_attachments_column()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de attachments: {e}")


def _ensure_exam_default_config_columns():
    """Agregar columnas de configuración de asignación por defecto a exams"""
    from app.auto_migrate import check_and_add_exam_default_config_columns
    
    try:
        print("[AUTO-MIGRATE] Ejecutando migración de config de asignación en exams...")
        check_and_add_exam_default_config_columns()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de config de asignación: {e}")


def _ensure_email_nullable():
    """Hacer email nullable en users para permitir candidatos sin email"""
    from app.auto_migrate import check_and_make_email_nullable
    
    try:
        print("[AUTO-MIGRATE] Ejecutando migración de email nullable...")
        check_and_make_email_nullable()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de email nullable: {e}")


def _ensure_campus_competency_standards_table():
    """Verificar y crear tabla campus_competency_standards"""
    from app.auto_migrate import check_and_create_campus_competency_standards_table
    
    try:
        print("[AUTO-MIGRATE] Ejecutando migración de campus_competency_standards...")
        check_and_create_campus_competency_standards_table()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de campus_competency_standards: {e}")


def _ensure_brands_table():
    """Verificar y crear tabla brands + brand_id en competency_standards"""
    from app.auto_migrate import check_and_create_brands_table
    
    try:
        print("[AUTO-MIGRATE] Ejecutando migración de brands...")
        check_and_create_brands_table()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de brands: {e}")


def _ensure_competency_standard_logo_column():
    """Verificar y agregar columna logo_url en competency_standards"""
    from app.auto_migrate import check_and_add_competency_standard_logo_column
    
    try:
        print("[AUTO-MIGRATE] Ejecutando migración de logo_url (competency_standards)...")
        check_and_add_competency_standard_logo_column()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de logo_url: {e}")


def _ensure_eduit_certificate_code_column():
    """Verificar y agregar columna eduit_certificate_code en results"""
    from app.auto_migrate import check_and_add_eduit_certificate_code
    
    try:
        print("[AUTO-MIGRATE] Ejecutando migración de eduit_certificate_code...")
        check_and_add_eduit_certificate_code()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de eduit_certificate_code: {e}")


def _ensure_campus_activation_columns():
    """Verificar y agregar columnas para activación de planteles y responsables"""
    from sqlalchemy import text, inspect
    from app.auto_migrate import check_and_add_campus_activation_columns
    
    try:
        print("[AUTO-MIGRATE] Ejecutando migración de activación de planteles...")
        check_and_add_campus_activation_columns()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de activación de planteles: {e}")


def _ensure_school_cycles_table():
    """Verificar y crear tabla school_cycles si no existe (PostgreSQL y SQL Server compatible)"""
    from sqlalchemy import text, inspect
    
    # Detectar tipo de base de datos
    db_url = str(db.engine.url)
    is_postgres = 'postgresql' in db_url or 'postgres' in db_url
    
    try:
        print("[AUTO-MIGRATE] Verificando tabla school_cycles...")
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        exists = 'school_cycles' in tables
        print(f"[AUTO-MIGRATE] school_cycles existe: {exists}")
        
        if not exists:
            print(f"[AUTO-MIGRATE] Tabla school_cycles NO existe. Creando para {'PostgreSQL' if is_postgres else 'SQL Server'}...")
            if is_postgres:
                db.session.execute(text("""
                    CREATE TABLE IF NOT EXISTS school_cycles (
                        id SERIAL PRIMARY KEY,
                        campus_id INTEGER NOT NULL,
                        name VARCHAR(100) NOT NULL,
                        cycle_type VARCHAR(20) NOT NULL DEFAULT 'annual',
                        start_date DATE NOT NULL,
                        end_date DATE NOT NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        is_current BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT FK_school_cycles_campus FOREIGN KEY (campus_id) 
                            REFERENCES campuses(id) ON DELETE CASCADE
                    )
                """))
            else:
                db.session.execute(text("""
                    CREATE TABLE school_cycles (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        campus_id INT NOT NULL,
                        name NVARCHAR(100) NOT NULL,
                        cycle_type NVARCHAR(20) NOT NULL DEFAULT 'annual',
                        start_date DATE NOT NULL,
                        end_date DATE NOT NULL,
                        is_active BIT DEFAULT 1,
                        is_current BIT DEFAULT 0,
                        created_at DATETIME2 DEFAULT GETDATE(),
                        updated_at DATETIME2 DEFAULT GETDATE(),
                        CONSTRAINT FK_school_cycles_campus FOREIGN KEY (campus_id) 
                            REFERENCES campuses(id) ON DELETE CASCADE
                    )
                """))
            db.session.commit()
            print("[AUTO-MIGRATE] ✅ Tabla school_cycles creada exitosamente")
        else:
            print("[AUTO-MIGRATE] ✅ Tabla school_cycles ya existe")
    except Exception as e:
        db.session.rollback()
        print(f"[AUTO-MIGRATE] ❌ Error creando school_cycles: {e}")


def _ensure_school_cycle_id_column():
    """Verificar y agregar columna school_cycle_id en candidate_groups (PostgreSQL y SQL Server compatible)"""
    from sqlalchemy import text, inspect
    
    # Detectar tipo de base de datos
    db_url = str(db.engine.url)
    is_postgres = 'postgresql' in db_url or 'postgres' in db_url
    
    try:
        print("[AUTO-MIGRATE] Verificando columna school_cycle_id en candidate_groups...")
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'candidate_groups' not in tables:
            print("[AUTO-MIGRATE] ⚠️ Tabla candidate_groups no existe, saltando...")
            return
            
        existing_columns = [col['name'] for col in inspector.get_columns('candidate_groups')]
        exists = 'school_cycle_id' in existing_columns
        print(f"[AUTO-MIGRATE] school_cycle_id existe: {exists}")
        
        if not exists:
            print("[AUTO-MIGRATE] Columna school_cycle_id NO existe. Agregando...")
            if is_postgres:
                db.session.execute(text("""
                    ALTER TABLE candidate_groups 
                    ADD COLUMN IF NOT EXISTS school_cycle_id INTEGER NULL
                """))
            else:
                db.session.execute(text("""
                    ALTER TABLE candidate_groups 
                    ADD school_cycle_id INT NULL
                """))
            db.session.commit()
            
            # Agregar constraint FK en paso separado
            try:
                if is_postgres:
                    db.session.execute(text("""
                        ALTER TABLE candidate_groups
                        ADD CONSTRAINT FK_candidate_groups_school_cycle 
                        FOREIGN KEY (school_cycle_id) REFERENCES school_cycles(id)
                        ON DELETE SET NULL
                    """))
                else:
                    db.session.execute(text("""
                        ALTER TABLE candidate_groups
                        ADD CONSTRAINT FK_candidate_groups_school_cycle 
                        FOREIGN KEY (school_cycle_id) REFERENCES school_cycles(id)
                        ON DELETE SET NULL
                    """))
                db.session.commit()
                print("[AUTO-MIGRATE] ✅ FK constraint agregada a school_cycle_id")
            except Exception as fk_err:
                print(f"[AUTO-MIGRATE] ⚠️ FK constraint no agregada: {fk_err}")
            
            print("[AUTO-MIGRATE] ✅ Columna school_cycle_id agregada a candidate_groups")
        else:
            print("[AUTO-MIGRATE] ✅ Columna school_cycle_id ya existe en candidate_groups")
    except Exception as e:
        db.session.rollback()
        print(f"[AUTO-MIGRATE] ❌ Error agregando school_cycle_id: {e}")
        import traceback
        traceback.print_exc()

# Force reload at Sat Jan  3 16:25:57 UTC 2026
# Force deploy Tue Jan 28 03:10:00 UTC 2026


def _ensure_ecm_candidate_assignments_table():
    """Verificar y crear tabla ecm_candidate_assignments para asignaciones permanentes de ECM a candidatos"""
    from sqlalchemy import text, inspect
    
    try:
        inspector = inspect(db.engine)
        existing = inspector.get_table_names()
        
        if 'ecm_candidate_assignments' in existing:
            print("[AUTO-MIGRATE] ✅ Tabla ecm_candidate_assignments ya existe")
            return
        
        print("[AUTO-MIGRATE] Creando tabla ecm_candidate_assignments...")
        
        db.session.execute(text("""
            CREATE TABLE ecm_candidate_assignments (
                id INT IDENTITY(1,1) PRIMARY KEY,
                assignment_number NVARCHAR(12) NOT NULL,
                user_id NVARCHAR(36) NOT NULL,
                competency_standard_id INT NOT NULL,
                exam_id INT NOT NULL,
                campus_id INT NULL,
                group_id INT NULL,
                group_name NVARCHAR(200) NULL,
                group_exam_id INT NULL,
                assigned_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                assigned_by_id NVARCHAR(36) NULL,
                assignment_source NVARCHAR(20) NOT NULL DEFAULT 'bulk',
                
                CONSTRAINT uq_ecm_assignment_number UNIQUE (assignment_number),
                CONSTRAINT fk_ecm_assign_user FOREIGN KEY (user_id) REFERENCES users(id),
                CONSTRAINT fk_ecm_assign_standard FOREIGN KEY (competency_standard_id) REFERENCES competency_standards(id),
                CONSTRAINT fk_ecm_assign_exam FOREIGN KEY (exam_id) REFERENCES exams(id),
                CONSTRAINT fk_ecm_assign_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE SET NULL,
                CONSTRAINT fk_ecm_assign_by FOREIGN KEY (assigned_by_id) REFERENCES users(id)
            )
        """))
        
        db.session.execute(text("""
            CREATE INDEX ix_ecm_candidate_user_ecm 
            ON ecm_candidate_assignments (user_id, competency_standard_id)
        """))
        
        db.session.execute(text("""
            CREATE INDEX ix_ecm_candidate_assignment_number 
            ON ecm_candidate_assignments (assignment_number)
        """))
        
        db.session.execute(text("""
            CREATE INDEX ix_ecm_candidate_campus 
            ON ecm_candidate_assignments (campus_id)
        """))
        
        db.session.commit()
        print("[AUTO-MIGRATE] ✅ Tabla ecm_candidate_assignments creada exitosamente")
    except Exception as e:
        db.session.rollback()
        print(f"[AUTO-MIGRATE] ❌ Error creando ecm_candidate_assignments: {e}")


def _ensure_certificate_code_history_table():
    """Crear tabla certificate_code_history para mantener códigos QR anteriores válidos"""
    from app.auto_migrate import check_and_create_certificate_code_history_table

    try:
        print("[AUTO-MIGRATE] Ejecutando migración de certificate_code_history...")
        check_and_create_certificate_code_history_table()
    except Exception as e:
        print(f"[AUTO-MIGRATE] Error en migración de certificate_code_history: {e}")
        import traceback
        traceback.print_exc()
