#!/usr/bin/env python3
"""
Script para aplicar migración de nuevos campos a exercise_actions
"""
import os
import sys
import pymssql

def get_db_config():
    """Obtener configuración de base de datos desde DATABASE_URL"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("ERROR: Variable DATABASE_URL no encontrada")
        sys.exit(1)
    
    # Parsear: mssql+pymssql://user:password@host:port/database
    if database_url.startswith('mssql+pymssql://'):
        database_url = database_url.replace('mssql+pymssql://', '')
    
    # Separar credenciales y host
    auth_part, db_part = database_url.split('@')
    username, password = auth_part.split(':', 1)  # Split solo en el primer :
    
    # Separar host:port y database
    host_port, database = db_part.split('/')
    host, port = host_port.split(':')
    
    return {
        'server': host,
        'port': int(port),
        'user': username,
        'password': password,
        'database': database
    }

def run_migration():
    """Ejecutar migración SQL"""
    print("🔧 Iniciando migración de campos de exercise_actions...")
    
    config = get_db_config()
    print(f"📊 Conectando a: {config['server']}:{config['port']}/{config['database']}")
    
    # Leer script SQL
    script_path = os.path.join(os.path.dirname(__file__), 'migrations', 'add_action_fields.sql')
    with open(script_path, 'r') as f:
        sql_script = f.read()
    
    # Conectar y ejecutar
    conn = pymssql.connect(**config)
    cursor = conn.cursor()
    
    try:
        # Dividir por GO y ejecutar cada bloque
        statements = [s.strip() for s in sql_script.split('GO') if s.strip() and not s.strip().startswith('--')]
        
        for i, statement in enumerate(statements, 1):
            if statement:
                print(f"\n📝 Ejecutando statement {i}...")
                print(f"   {statement[:100]}...")
                cursor.execute(statement)
                conn.commit()
                print(f"   ✓ Completado")
        
        print("\n✅ Migración completada exitosamente!")
        
        # Verificar columnas
        print("\n📋 Verificando columnas agregadas...")
        cursor.execute("""
            SELECT 
                COLUMN_NAME, 
                DATA_TYPE, 
                COLUMN_DEFAULT,
                IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'exercise_actions'
            AND COLUMN_NAME IN (
                'scoring_mode', 
                'on_error_action', 
                'error_message', 
                'max_attempts',
                'text_color',
                'font_family'
            )
            ORDER BY COLUMN_NAME
        """)
        
        columns = cursor.fetchall()
        if columns:
            print("\nColumnas agregadas:")
            for col in columns:
                print(f"  ✓ {col[0]} ({col[1]}) - Default: {col[2] or 'NULL'} - Nullable: {col[3]}")
        else:
            print("  ⚠️  No se encontraron las columnas esperadas")
        
    except Exception as e:
        print(f"\n❌ Error durante la migración: {str(e)}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    run_migration()
