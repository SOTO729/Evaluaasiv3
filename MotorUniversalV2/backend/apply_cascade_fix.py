"""
Script para aplicar ON DELETE CASCADE a las foreign keys de ejercicios
"""
import os
import pymssql
from urllib.parse import urlparse, parse_qs

# Leer DATABASE_URL del entorno
database_url = os.getenv('DATABASE_URL')
if not database_url:
    print("ERROR: DATABASE_URL no encontrada")
    exit(1)

# Parsear la URL
# Formato: mssql+pymssql://user:pass@host:port/dbname?charset=utf8
url = database_url.replace('mssql+pymssql://', '')
parts = url.split('@')
user_pass = parts[0]
host_db = parts[1]

user, password = user_pass.split(':')
host_port_db = host_db.split('/')
host_port = host_port_db[0]
db_params = host_port_db[1].split('?')
database = db_params[0]
host, port = host_port.split(':')

print(f"Conectando a SQL Server...")
print(f"Host: {host}")
print(f"Database: {database}")
print(f"User: {user}")

try:
    # Conectar a SQL Server
    conn = pymssql.connect(
        server=host,
        user=user,
        password=password,
        database=database,
        port=int(port)
    )
    
    cursor = conn.cursor()
    
    print("\n=== APLICANDO FIX DE CASCADE DELETE ===\n")
    
    # Leer el script SQL
    with open('fix_cascade_delete.sql', 'r') as f:
        sql_script = f.read()
    
    # Separar por GO statements
    statements = [s.strip() for s in sql_script.split('GO') if s.strip() and not s.strip().startswith('--')]
    
    for i, statement in enumerate(statements, 1):
        if statement:
            print(f"\n[{i}/{len(statements)}] Ejecutando:")
            print(statement[:100] + "..." if len(statement) > 100 else statement)
            try:
                cursor.execute(statement)
                conn.commit()
                print("✓ Ejecutado exitosamente")
                
                # Si es la última query (SELECT), mostrar resultados
                if 'SELECT' in statement.upper() and i == len(statements):
                    rows = cursor.fetchall()
                    if rows:
                        print("\nResultados de verificación:")
                        print("-" * 80)
                        for row in rows:
                            print(f"Tabla: {row[0]}, Columna: {row[1]}, "
                                  f"Ref.Tabla: {row[2]}, Ref.Columna: {row[3]}, "
                                  f"Delete Action: {row[4]}")
                        print("-" * 80)
            except Exception as e:
                print(f"✗ Error: {str(e)}")
                if "does not exist" not in str(e):
                    raise
    
    cursor.close()
    conn.close()
    
    print("\n=== FIX APLICADO EXITOSAMENTE ===")
    print("Las foreign keys ahora tienen ON DELETE CASCADE configurado")
    
except Exception as e:
    print(f"\nERROR: {str(e)}")
    exit(1)
