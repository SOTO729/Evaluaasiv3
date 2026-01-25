#!/usr/bin/env python3
"""
Script para agregar las columnas de comentarios a la tabla study_interactive_exercise_actions
en la base de datos de producción Azure SQL.
"""

import os
import pymssql

# Obtener la cadena de conexión de las variables de entorno o usar valores por defecto
DATABASE_URL = os.environ.get('DATABASE_URL', '')

# Parsear la URL de conexión o usar valores directos para Azure
# Formato: mssql+pymssql://user:password@server/database
if DATABASE_URL:
    # Extraer componentes de la URL
    import re
    match = re.match(r'mssql\+pymssql://([^:]+):([^@]+)@([^/]+)/(.+)', DATABASE_URL)
    if match:
        user, password, server, database = match.groups()
    else:
        # Valores por defecto para Azure
        server = 'evaluaasi-motorv2-sql.database.windows.net'
        database = 'evaluaasi'
        user = 'evaluaasi_admin'
        password = 'Ev4lu4asiP4ssword2024Xx'
else:
    # Valores por defecto para Azure
    server = 'evaluaasi-motorv2-sql.database.windows.net'
    database = 'evaluaasi'
    user = 'evaluaasi_admin'
    password = 'Ev4lu4asiP4ssword2024Xx'

print(f"Conectando a {server}/{database} como {user}...")

# Las columnas a agregar
columns_to_add = [
    ("comment_text", "NVARCHAR(MAX) NULL"),
    ("comment_bg_color", "NVARCHAR(20) NULL DEFAULT '#fef3c7'"),
    ("comment_text_color", "NVARCHAR(20) NULL DEFAULT '#92400e'"),
    ("comment_font_size", "INT NULL DEFAULT 14"),
    ("pointer_x", "FLOAT NULL"),
    ("pointer_y", "FLOAT NULL"),
]

try:
    # Conectar a Azure SQL
    conn = pymssql.connect(
        server=server,
        user=user,
        password=password,
        database=database,
        port=1433,
        tds_version='7.0'
    )
    cursor = conn.cursor()
    
    print("Conexión exitosa!")
    
    # Verificar qué columnas ya existen
    cursor.execute("""
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'study_interactive_exercise_actions'
    """)
    existing_columns = set(row[0] for row in cursor.fetchall())
    print(f"Columnas existentes: {len(existing_columns)}")
    
    # Agregar las columnas faltantes
    for column_name, column_type in columns_to_add:
        if column_name not in existing_columns:
            print(f"Agregando columna: {column_name}...")
            try:
                sql = f"ALTER TABLE study_interactive_exercise_actions ADD {column_name} {column_type}"
                cursor.execute(sql)
                conn.commit()
                print(f"  ✓ Columna {column_name} agregada exitosamente")
            except Exception as e:
                print(f"  ✗ Error al agregar {column_name}: {e}")
        else:
            print(f"  - Columna {column_name} ya existe, saltando...")
    
    print("\n¡Migración completada!")
    
    # Verificar las columnas finales
    cursor.execute("""
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'study_interactive_exercise_actions'
        ORDER BY COLUMN_NAME
    """)
    final_columns = [row[0] for row in cursor.fetchall()]
    print(f"\nColumnas finales en la tabla ({len(final_columns)}):")
    for col in final_columns:
        print(f"  - {col}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
