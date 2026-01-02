"""Script para agregar columnas de dimensiones de video en Azure SQL"""
import pymssql

def add_columns():
    # Credenciales de Azure SQL
    server = 'evaluaasi-motorv2-sql.database.windows.net'
    user = 'evaluaasi_admin'
    password = 'EvalAasi2024_c949de16dad23b6d'
    database = 'evaluaasi'
    
    print(f"Conectando a {server}/{database}...")
    
    try:
        conn = pymssql.connect(
            server=server,
            user=user,
            password=password,
            database=database
        )
        cursor = conn.cursor()
        
        # Verificar si las columnas ya existen
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'study_videos' 
            AND COLUMN_NAME IN ('video_width', 'video_height')
        """)
        existing = [row[0] for row in cursor.fetchall()]
        print(f"Columnas existentes: {existing}")
        
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
