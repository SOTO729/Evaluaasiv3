import pymssql
import os

# Conexión a la base de datos
conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_c949de16dad23b6d',
    database='evaluaasi'
)

cursor = conn.cursor()

try:
    # Alterar la columna answer_number para permitir NULL
    print("Alterando columna answer_number para permitir NULL...")
    cursor.execute("""
        ALTER TABLE answers
        ALTER COLUMN answer_number INT NULL
    """)
    
    conn.commit()
    print("✓ Columna answer_number ahora permite NULL")
    
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
finally:
    cursor.close()
    conn.close()
