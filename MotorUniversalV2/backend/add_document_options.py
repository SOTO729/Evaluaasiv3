"""
Script para agregar columnas de opciones de documentos a la tabla users
"""
import os
import pymssql

# Obtener credenciales de la base de datos
DATABASE_URL = os.environ.get('DATABASE_URL', '')

# Parsear la URL de conexión
# Formato: mssql+pymssql://user:pass@host:port/dbname
if DATABASE_URL:
    # Extraer componentes
    import re
    match = re.match(r'mssql\+pymssql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', DATABASE_URL)
    if match:
        DB_USER = match.group(1)
        DB_PASS = match.group(2)
        DB_HOST = match.group(3)
        DB_PORT = int(match.group(4))
        DB_NAME = match.group(5)
    else:
        raise ValueError("No se pudo parsear DATABASE_URL")
else:
    raise ValueError("DATABASE_URL no está configurada")

def add_document_options_columns():
    """Agregar columnas de opciones de documentos"""
    conn = pymssql.connect(
        server=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME
    )
    cursor = conn.cursor()
    
    columns_to_add = [
        ('enable_evaluation_report', 'BIT', '1'),  # Default TRUE
        ('enable_certificate', 'BIT', '0'),  # Default FALSE
        ('enable_conocer_certificate', 'BIT', '0'),  # Default FALSE
        ('enable_digital_badge', 'BIT', '0'),  # Default FALSE
    ]
    
    for col_name, col_type, default_value in columns_to_add:
        try:
            # Verificar si la columna existe
            cursor.execute(f"""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'users' AND COLUMN_NAME = '{col_name}'
            """)
            exists = cursor.fetchone()[0] > 0
            
            if not exists:
                print(f"Agregando columna {col_name}...")
                cursor.execute(f"""
                    ALTER TABLE users 
                    ADD {col_name} {col_type} NOT NULL DEFAULT {default_value}
                """)
                conn.commit()
                print(f"  ✓ Columna {col_name} agregada exitosamente")
            else:
                print(f"  - Columna {col_name} ya existe")
                
        except Exception as e:
            print(f"  ✗ Error con columna {col_name}: {e}")
            conn.rollback()
    
    # Verificar las columnas
    print("\n=== Verificando columnas de opciones de documentos ===")
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME LIKE 'enable_%'
        ORDER BY COLUMN_NAME
    """)
    
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} (default: {row[2]})")
    
    cursor.close()
    conn.close()
    print("\n✓ Script completado")

if __name__ == '__main__':
    add_document_options_columns()
