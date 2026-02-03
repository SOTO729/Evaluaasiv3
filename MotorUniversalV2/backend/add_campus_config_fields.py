"""
Script para agregar campos de configuración de plantel
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text

app = create_app()

def add_campus_config_columns():
    """Agrega columnas de configuración a la tabla campuses"""
    
    columns_to_add = [
        # Versión de Office
        ("office_version", "VARCHAR(20) DEFAULT 'office_365'"),  # office_2016, office_2019, office_365
        
        # Tiers de certificación (múltiple selección)
        ("enable_tier_basic", "BOOLEAN DEFAULT FALSE"),  # Constancia de participación Eduit
        ("enable_tier_standard", "BOOLEAN DEFAULT FALSE"),  # Certificado Eduit oficial
        ("enable_tier_advanced", "BOOLEAN DEFAULT FALSE"),  # Certificado CONOCER
        ("enable_digital_badge", "BOOLEAN DEFAULT FALSE"),  # Insignia digital
        
        # Evaluaciones parciales
        ("enable_partial_evaluations", "BOOLEAN DEFAULT FALSE"),  # Habilitar evaluaciones parciales
        ("enable_unscheduled_partials", "BOOLEAN DEFAULT FALSE"),  # Parciales sin agendar (alumno selecciona)
        
        # Máquinas virtuales
        ("enable_virtual_machines", "BOOLEAN DEFAULT FALSE"),  # Usar VMs para exámenes
        
        # Pagos en línea
        ("enable_online_payments", "BOOLEAN DEFAULT FALSE"),  # Habilitar pagos en línea
        
        # Vigencia del plantel
        ("license_start_date", "DATE"),  # Fecha de inicio de vigencia
        ("license_end_date", "DATE"),  # Fecha de fin de vigencia
        
        # Costos
        ("certification_cost", "DECIMAL(10,2) DEFAULT 0"),  # Costo por certificación
        ("retake_cost", "DECIMAL(10,2) DEFAULT 0"),  # Costo por retoma
        
        # Configuración completada
        ("configuration_completed", "BOOLEAN DEFAULT FALSE"),
        ("configuration_completed_at", "TIMESTAMP"),
    ]
    
    with app.app_context():
        for column_name, column_type in columns_to_add:
            try:
                # Verificar si la columna ya existe
                check_sql = text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'campuses' 
                    AND column_name = :column_name
                """)
                result = db.session.execute(check_sql, {'column_name': column_name})
                
                if result.fetchone() is None:
                    # Agregar la columna
                    alter_sql = text(f"ALTER TABLE campuses ADD COLUMN {column_name} {column_type}")
                    db.session.execute(alter_sql)
                    db.session.commit()
                    print(f"✓ Columna '{column_name}' agregada exitosamente")
                else:
                    print(f"- Columna '{column_name}' ya existe")
                    
            except Exception as e:
                db.session.rollback()
                print(f"✗ Error agregando columna '{column_name}': {str(e)}")
        
        print("\n✓ Migración completada")

if __name__ == '__main__':
    add_campus_config_columns()
