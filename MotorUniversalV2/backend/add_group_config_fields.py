"""
Script para agregar campos de configuración a los grupos
Estos campos permiten personalizar la configuración heredada del campus a nivel de grupo
"""
import os
import sys

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text

def add_group_config_fields():
    """Agregar campos de configuración al modelo CandidateGroup"""
    
    app = create_app()
    
    with app.app_context():
        # Lista de columnas a agregar con sus tipos (SQL Server syntax)
        columns = [
            # Override de versión de Office
            ("office_version_override", "NVARCHAR(20) NULL"),
            
            # Override de tiers habilitados (NULL = usar config del campus)
            ("enable_tier_basic_override", "BIT NULL"),
            ("enable_tier_standard_override", "BIT NULL"),
            ("enable_tier_advanced_override", "BIT NULL"),
            ("enable_digital_badge_override", "BIT NULL"),
            
            # Override de evaluaciones parciales
            ("enable_partial_evaluations_override", "BIT NULL"),
            ("enable_unscheduled_partials_override", "BIT NULL"),
            
            # Override de máquinas virtuales
            ("enable_virtual_machines_override", "BIT NULL"),
            
            # Override de pagos en línea
            ("enable_online_payments_override", "BIT NULL"),
            
            # Override de costos (NULL = usar config del campus)
            ("certification_cost_override", "DECIMAL(10,2) NULL"),
            ("retake_cost_override", "DECIMAL(10,2) NULL"),
            
            # Vigencia específica del grupo (puede ser distinta al campus)
            ("group_start_date", "DATE NULL"),
            ("group_end_date", "DATE NULL"),
            
            # Flag para indicar si el grupo usa configuración personalizada
            ("use_custom_config", "BIT DEFAULT 0"),
        ]
        
        # Verificar y agregar columnas
        for column_name, column_type in columns:
            try:
                # Verificar si la columna ya existe
                check_sql = text("""
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'candidate_groups' 
                    AND COLUMN_NAME = :column_name
                """)
                result = db.session.execute(check_sql, {'column_name': column_name})
                
                if result.fetchone() is None:
                    # La columna no existe, agregarla (SQL Server syntax: ADD sin COLUMN)
                    alter_sql = text(f"ALTER TABLE candidate_groups ADD {column_name} {column_type}")
                    db.session.execute(alter_sql)
                    db.session.commit()
                    print(f"✅ Columna '{column_name}' agregada exitosamente")
                else:
                    print(f"ℹ️ Columna '{column_name}' ya existe")
                    
            except Exception as e:
                print(f"❌ Error agregando columna '{column_name}': {str(e)}")
                db.session.rollback()
                continue
        
        print("\n✅ Migración completada")

if __name__ == '__main__':
    add_group_config_fields()
