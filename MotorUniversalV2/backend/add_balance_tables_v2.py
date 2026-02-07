"""
Script de migración para crear tablas del sistema de saldos y logs de actividad
Soporta SQLite (desarrollo) y SQL Server (producción)

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
            db_type = 'SQLite (dev)' if using_sqlite else 'SQL Server (prod)'
            print(f"[MIGRATION] Usando {db_type}")
            
            # =====================================================
            # TABLA: coordinator_balances
            # =====================================================
            if not table_exists('coordinator_balances'):
                print("[MIGRATION] Creando tabla coordinator_balances...")
                if using_sqlite:
                    sql = """
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
                    """
                else:
                    sql = """
                        CREATE TABLE coordinator_balances (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            coordinator_id VARCHAR(36) NOT NULL UNIQUE,
                            current_balance DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_received DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_spent DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            total_scholarships DECIMAL(12,2) DEFAULT 0 NOT NULL,
                            created_at DATETIME DEFAULT GETDATE() NOT NULL,
                            updated_at DATETIME DEFAULT GETDATE() NOT NULL,
                            CONSTRAINT fk_coordinator_balance_user 
                                FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    """
                db.session.execute(text(sql))
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
                    sql = """
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
                    """
                else:
                    sql = """
                        CREATE TABLE balance_requests (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            coordinator_id VARCHAR(36) NOT NULL,
                            campus_id INT NULL,
                            group_id INT NULL,
                            request_type NVARCHAR(20) DEFAULT 'saldo' NOT NULL,
                            amount_requested DECIMAL(12,2) NOT NULL,
                            amount_approved DECIMAL(12,2) NULL,
                            justification NVARCHAR(MAX) NOT NULL,
                            status NVARCHAR(30) DEFAULT 'pending' NOT NULL,
                            financiero_id VARCHAR(36) NULL,
                            financiero_notes NVARCHAR(MAX) NULL,
                            financiero_recommended_amount DECIMAL(12,2) NULL,
                            financiero_reviewed_at DATETIME NULL,
                            documentation_requested NVARCHAR(MAX) NULL,
                            documentation_provided BIT DEFAULT 0,
                            approved_by_id VARCHAR(36) NULL,
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
                    """
                db.session.execute(text(sql))
                db.session.commit()
                
                # Índices
                db.session.execute(text("CREATE INDEX idx_balance_requests_coordinator ON balance_requests(coordinator_id)"))
                db.session.execute(text("CREATE INDEX idx_balance_requests_status ON balance_requests(status)"))
                db.session.execute(text("CREATE INDEX idx_balance_requests_requested_at ON balance_requests(requested_at)"))
                db.session.commit()
                print("[MIGRATION] ✅ Tabla balance_requests creada con índices")
            else:
                print("[MIGRATION] ⏭️ Tabla balance_requests ya existe")
            
            # =====================================================
            # TABLA: balance_transactions
            # =====================================================
            if not table_exists('balance_transactions'):
                print("[MIGRATION] Creando tabla balance_transactions...")
                if using_sqlite:
                    sql = """
                        CREATE TABLE balance_transactions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            coordinator_id VARCHAR(36) NOT NULL,
                            request_id INTEGER NULL,
                            transaction_type VARCHAR(20) NOT NULL,
                            concept VARCHAR(50) NOT NULL,
                            amount DECIMAL(12,2) NOT NULL,
                            balance_before DECIMAL(12,2) NOT NULL,
                            balance_after DECIMAL(12,2) NOT NULL,
                            campus_id INTEGER NULL,
                            group_id INTEGER NULL,
                            is_scholarship INTEGER DEFAULT 0,
                            description TEXT NULL,
                            reference_type VARCHAR(50) NULL,
                            reference_id INTEGER NULL,
                            notes TEXT NULL,
                            created_by_id VARCHAR(36) NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            FOREIGN KEY (coordinator_id) REFERENCES users(id),
                            FOREIGN KEY (request_id) REFERENCES balance_requests(id),
                            FOREIGN KEY (campus_id) REFERENCES campuses(id),
                            FOREIGN KEY (group_id) REFERENCES candidate_groups(id),
                            FOREIGN KEY (created_by_id) REFERENCES users(id)
                        )
                    """
                else:
                    sql = """
                        CREATE TABLE balance_transactions (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            coordinator_id VARCHAR(36) NOT NULL,
                            request_id INT NULL,
                            transaction_type NVARCHAR(20) NOT NULL,
                            concept NVARCHAR(50) NOT NULL,
                            amount DECIMAL(12,2) NOT NULL,
                            balance_before DECIMAL(12,2) NOT NULL,
                            balance_after DECIMAL(12,2) NOT NULL,
                            campus_id INT NULL,
                            group_id INT NULL,
                            is_scholarship BIT DEFAULT 0,
                            description NVARCHAR(500) NULL,
                            reference_type NVARCHAR(50) NULL,
                            reference_id INT NULL,
                            notes NVARCHAR(MAX) NULL,
                            created_by_id VARCHAR(36) NULL,
                            created_at DATETIME DEFAULT GETDATE() NOT NULL,
                            CONSTRAINT fk_balance_transaction_coordinator 
                                FOREIGN KEY (coordinator_id) REFERENCES users(id),
                            CONSTRAINT fk_balance_transaction_request 
                                FOREIGN KEY (request_id) REFERENCES balance_requests(id),
                            CONSTRAINT fk_balance_transaction_campus 
                                FOREIGN KEY (campus_id) REFERENCES campuses(id),
                            CONSTRAINT fk_balance_transaction_group 
                                FOREIGN KEY (group_id) REFERENCES candidate_groups(id),
                            CONSTRAINT fk_balance_transaction_creator 
                                FOREIGN KEY (created_by_id) REFERENCES users(id)
                        )
                    """
                db.session.execute(text(sql))
                db.session.commit()
                
                # Índices
                db.session.execute(text("CREATE INDEX idx_balance_transactions_coordinator ON balance_transactions(coordinator_id)"))
                db.session.execute(text("CREATE INDEX idx_balance_transactions_created_at ON balance_transactions(created_at)"))
                db.session.commit()
                print("[MIGRATION] ✅ Tabla balance_transactions creada con índices")
            else:
                print("[MIGRATION] ⏭️ Tabla balance_transactions ya existe")
            
            # =====================================================
            # TABLA: activity_logs
            # =====================================================
            if not table_exists('activity_logs'):
                print("[MIGRATION] Creando tabla activity_logs...")
                if using_sqlite:
                    sql = """
                        CREATE TABLE activity_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id VARCHAR(36) NULL,
                            user_role VARCHAR(30) NULL,
                            user_email VARCHAR(255) NULL,
                            action_type VARCHAR(50) NOT NULL,
                            entity_type VARCHAR(50) NULL,
                            entity_id VARCHAR(50) NULL,
                            entity_name VARCHAR(255) NULL,
                            details TEXT NULL,
                            ip_address VARCHAR(50) NULL,
                            user_agent TEXT NULL,
                            success INTEGER DEFAULT 1,
                            error_message TEXT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    """
                else:
                    sql = """
                        CREATE TABLE activity_logs (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            user_id VARCHAR(36) NULL,
                            user_role NVARCHAR(30) NULL,
                            user_email NVARCHAR(255) NULL,
                            action_type NVARCHAR(50) NOT NULL,
                            entity_type NVARCHAR(50) NULL,
                            entity_id NVARCHAR(50) NULL,
                            entity_name NVARCHAR(255) NULL,
                            details NVARCHAR(MAX) NULL,
                            ip_address NVARCHAR(50) NULL,
                            user_agent NVARCHAR(500) NULL,
                            success BIT DEFAULT 1,
                            error_message NVARCHAR(MAX) NULL,
                            created_at DATETIME DEFAULT GETDATE() NOT NULL,
                            CONSTRAINT fk_activity_log_user 
                                FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    """
                db.session.execute(text(sql))
                db.session.commit()
                
                # Índices
                db.session.execute(text("CREATE INDEX idx_activity_logs_user ON activity_logs(user_id)"))
                db.session.execute(text("CREATE INDEX idx_activity_logs_action ON activity_logs(action_type)"))
                db.session.execute(text("CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at)"))
                db.session.commit()
                print("[MIGRATION] ✅ Tabla activity_logs creada con índices")
            else:
                print("[MIGRATION] ⏭️ Tabla activity_logs ya existe")
            
            print("[MIGRATION] ✅ Migración completada exitosamente")
            return True
            
        except Exception as e:
            print(f"[MIGRATION] ❌ Error durante la migración: {e}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            return False


if __name__ == '__main__':
    success = create_balance_tables()
    sys.exit(0 if success else 1)
