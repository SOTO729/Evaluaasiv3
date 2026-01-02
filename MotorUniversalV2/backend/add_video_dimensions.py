"""Script para agregar columnas de dimensiones de video"""
import os
from dotenv import load_dotenv
import pyodbc

load_dotenv()

def add_columns():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("No DATABASE_URL encontrada")
        return
    
    # Parsear connection string
    # Format: mssql+pyodbc://user:pass@server/db?driver=...
    import urllib.parse
    
    # Extraer componentes
    parts = database_url.replace('mssql+pyodbc://', '')
    user_pass, rest = parts.split('@', 1)
    user, password = user_pass.split(':', 1)
    password = urllib.parse.unquote(password)
    server_db, params = rest.split('?', 1) if '?' in rest else (rest, '')
    server, database = server_db.split('/', 1)
    
    # Construir connection string para pyodbc
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        "TrustServerCertificate=yes;"
    )
    
    print(f"Conectando a {server}/{database}...")
    
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        # Verificar si las columnas ya existen
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'study_videos' 
            AND COLUMN_NAME IN ('video_width', 'video_height')
        """)
        existing = [row[0] for row in cursor.fetchall()]
        
        if 'video_width' not in existing:
            print("Agregando columna video_width...")
            cursor.execute("ALTER TABLE study_videos ADD video_width INT NULL")
            conn.commit()
            print("✓ video_width agregada")
        else:
            print("✓ video_width ya existe")
        
        if 'video_height' not in existing:
            print("Agregando columna video_height...")
            cursor.execute("ALTER TABLE study_videos ADD video_height INT NULL")
            conn.commit()
            print("✓ video_height agregada")
        else:
            print("✓ video_height ya existe")
        
        print("\n¡Migración completada!")
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    add_columns()
