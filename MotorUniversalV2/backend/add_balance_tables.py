"""
Script de migración para crear tablas del sistema de saldos y logs de actividad

Tablas creadas:
- coordinator_balances: Saldo actual de cada coordinador
- balance_requests: Solicitudes de saldo/beca
- balance_transactions: Historial de movimientos
- activity_logs: Log de actividad de usuarios
"""
import os
import sys

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text, inspect


def is_sqlite():
    """Detectar si estamos usando SQLite"""
    return 'sqlite' in str(db.engine.url)


def table_exists(table_name):
    """Verificar si una tabla existe usando el inspector de SQLAlchemy"""
    inspector = inspect(db.engine)
    return table_name in inspector.get_table_names()


def create_balance_tables():
    """Crear tablas para el sistema de saldos"""
    
    app = create_app(os.getenv('FLASK_ENV', 'development'))
    
    with app.app_context():
        try:
            print("[MIGRATION] Iniciando migración de tablas de saldos y actividad...")
            using_sqlite = is_sqlite()
            print(f"[MIGRATION] Usando {'SQLite (dev)' if using_sqlite else 'SQL Server (prod)'}")
            
            # =====================================================
            # TABLA: coordinator_balances
            # =====================================================
            if not table_exists('coordinator_balances'):
                print("[MIGRATION] Creando tabla coordinator_balances...")
                if using_sqlite:
                    create_sql = text("""
                        CREATE TABLE coordinator_balances (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            coordinator_id VARCHAR(36) NOT NULL UNIQUE,
                            current_balance DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_received DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_spent DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_scholarships DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    """)
                else:
                    create_sql = text("""
                        CREATE TABLE coordinator_balances (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            coordinator_id NVARCHAR(36) NOT NULL UNIQUE,
                            current_balance DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_received DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_spent DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_scholarships DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            created_at DATETIME DEFAULT GETDATE() NOT NULL,
                            updated_at DATETIME DEFAULT GETDATE() NOT NULL,
                            CONSTRAINT fk_coordinator_balance_user 
                                FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    """)
                db.session.execute(create_sql)
                db.session.commit()
                print("[MIGRATION] ✅ Tabla coordinator_balances creada")
            else:
                print("[MIGRATION] ⏭️ Tabla coordinator_balances ya existe")
            
            # =====================================================
            # TABLA: balance_requests
            # =====================================================
            if not table_exists('balance_requests'):
                print("[MIGRATION] Creando tabla balance_requests...")
                if using_sqlite:
                    create_sql = text("""
                        CREATE TABLE balance_requests (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            coordinator_id VARCHAR(36) NOT NULL,
                            campus_id INTEGER NULL,
                            group_id INTEGER NULL,
                            request_type VARCHAR(20) DEFAULT 'saldo' NOT NULL,
                            amount_requested DECIMAL(12,2) NOT NULL,
                            amount_approved DECIMAL(12,2) NULL,
                            justification TEXT NOT NULL,
                            status VARCHAR(30) DEFAULT 'pending' NOT NULL,
                            financiero_id VARCHAR(36) NULL,
                            financiero_notes TEXT NULL,
                            financiero_reviewed_at DATETIME NULL,
                            financiero_recommended_amount DECIMAL(12,2) NULL,
                            documentation_requested TEXT NULL,
                            documentation_provided INTEGER DEFAULT 0,
                            approved_by_id VARCHAR(36) NULL,
                            approver_notes TEXT NULL,
                            approved_at DATETIME NULL,
                            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            FOREIGN KEY (coordinator_id) REFERENCES users(id),
                            FOREIGN KEY (campus_id) REFERENCES campuses(id),
                            FOREIGN KEY (group_id) REFERENCES candidate_groups(id),
                            FOREIGN KEY (financiero_id) REFERENCES users(id),
                            FOREIGN KEY (approved_by_id) REFERENCES users(id)
                        )
                    """)
                else:
                        status NVARCHAR(30) DEFAULT 'pending' NOT NULL,
                        financiero_id NVARCHAR(36) NULL,
                        financiero_notes NVARCHAR(MAX) NULL,
                        financiero_recommended_amount DECIMAL(12,2) NULL,
                        financiero_reviewed_at DATETIME NULL,
                        documentation_requested NVARCHAR(MAX) NULL,
                        documentation_provided BIT DEFAULT 0,
                        approved_by_id NVARCHAR(36) NULL,
                        approver_notes NVARCHAR(MAX) NULL,
                        approved_at DATETIME NULL,
                        requested_at DATETIME DEFAULT GETDATE() NOT NULL,
                        updated_at DATETIME DEFAULT GETDATE() NOT NULL,
                        CONSTRAINT fk_balance_request_coordinator 
                            FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE,
                        CONSTRAINT fk_balance_request_campus 
                            FOREIGN KEY (campus_id) REFERENCES campuses(id),
                        CONSTRAINT fk_balance_request_group 
                            FOREIGN KEY (group_id) REFERENCES candidate_groups(id),
                        CONSTRAINT fk_balance_request_financiero 
                            FOREIGN KEY (financiero_id) REFERENCES users(id),
                        CONSTRAINT fk_balance_request_approver 
                            FOREIGN KEY (approved_by_id) REFERENCES users(id)
                    )
                """)
                db.session.execute(create_sql)
                db.session.commit()
                print("[MIGRATION] ✅ Tabla balance_requests creada")
                
                # Índices
                db.session.execute(text("CREATE INDEX idx_balance_requests_coordinator ON balance_requests(coordinator_id)"))
                db.session.execute(text("CREATE INDEX idx_balance_requests_status ON balance_requests(status)"))
                db.session.execute(text("CREATE INDEX idx_balance_requests_requested_at ON balance_requests(requested_at)"))
                db.session.commit()
                print("[MIGRATION] ✅ Índices de balance_requests creados")
            else:
                print("[MIGRATION] ⏭️ Tabla balance_requests ya existe")
            
            # =====================================================
            # TABLA: balance_transactions
            # =====================================================
            check_sql = text("""
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'balance_transactions'
            """)
            result = db.session.execute(check_sql)
            
            if not result.fetchone():
                print("[MIGRATION] Creando tabla balance_transactions...")
                create_sql = text("""
                    CREATE TABLE balance_transactions (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        coordinator_id NVARCHAR(36) NOT NULL,
                        transaction_type NVARCHAR(20) NOT NULL,
                        concept NVARCHAR(50) NOT NULL,
                        amount DECIMAL(12,2) NOT NULL,
                        balance_before DECIMAL(12,2) NOT NULL,
                        balance_after DECIMAL(12,2) NOT NULL,
                        reference_type NVARCHAR(50) NULL,
                        reference_id INT NULL,
                        notes NVARCHAR(MAX) NULL,
                        created_by_id NVARCHAR(36) NULL,
                        created_at DATETIME DEFAULT GETDATE() NOT NULL,
                        CONSTRAINT fk_balance_transaction_coordinator 
                            FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE,
                        CONSTRAINT fk_balance_transaction_created_by 
                            FOREIGN KEY (created_by_id) REFERENCES users(id)
                    )
                """)
                db.session.execute(create_sql)
                db.session.commit()
                print("[MIGRATION] ✅ Tabla balance_transactions creada")
                
                # Índices
                db.session.execute(text("CREATE INDEX idx_balance_transactions_coordinator ON balance_transactions(coordinator_id)"))
                db.session.execute(text("CREATE INDEX idx_balance_transactions_created_at ON balance_transactions(created_at)"))
                db.session.commit()
                print("[MIGRATION] ✅ Índices de balance_transactions creados")
            else:
                print("[MIGRATION] ⏭️ Tabla balance_transactions ya existe")
            
            # =====================================================
            # TABLA: activity_logs
            # =====================================================
            check_sql = text("""
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'activity_logs'
            """)
            result = db.session.execute(check_sql)
            
            if not result.fetchone():
                print("[MIGRATION] Creando tabla activity_logs...")
                create_sql = text("""
                    CREATE TABLE activity_logs (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        user_id NVARCHAR(36) NULL,
                        user_role NVARCHAR(20) NULL,
                        user_email NVARCHAR(255) NULL,
                        action_type NVARCHAR(50) NOT NULL,
                        entity_type NVARCHAR(50) NULL,
                        entity_id NVARCHAR(50) NULL,
                        entity_name NVARCHAR(255) NULL,
                        details NVARCHAR(MAX) NULL,
                        ip_address NVARCHAR(45) NULL,
                        user_agent NVARCHAR(500) NULL,
                        success BIT DEFAULT 1 NOT NULL,
                        error_message NVARCHAR(MAX) NULL,
                        created_at DATETIME DEFAULT GETDATE() NOT NULL
                    )
                """)
                db.session.execute(create_sql)
                db.session.commit()
                print("[MIGRATION] ✅ Tabla activity_logs creada")
                
                # Índices
                db.session.execute(text("CREATE INDEX idx_activity_logs_user ON activity_logs(user_id)"))
                db.session.execute(text("CREATE INDEX idx_activity_logs_action ON activity_logs(action_type)"))
                db.session.execute(text("CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at)"))
                db.session.execute(text("CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id)"))
                db.session.commit()
                print("[MIGRATION] ✅ Índices de activity_logs creados")
            else:
                print("[MIGRATION] ⏭️ Tabla activity_logs ya existe")
            
            print("[MIGRATION] ✅ Migración completada exitosamente")
            
        except Exception as e:
            db.session.rollback()
            print(f"[MIGRATION] ❌ Error en migración: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == '__main__':
    create_balance_tables()
