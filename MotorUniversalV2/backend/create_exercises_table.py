"""
Script para crear la tabla de ejercicios
"""
import pymssql

def create_exercises_table():
    """Crea la tabla exercises en la base de datos"""
    
    # Credenciales de Azure SQL
    server = 'evaluaasi-motorv2-sql.database.windows.net'
    user = 'evaluaasi_admin'
    password = 'EvalAasi2024_c949de16dad23b6d'
    database = 'evaluaasi'
    
    # Conectar a la base de datos
    conn = pymssql.connect(
        server=server,
        user=user,
        password=password,
        database=database
    )
    
    cursor = conn.cursor()
    
    # Crear tabla exercises
    create_table_sql = """
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='exercises' AND xtype='U')
    CREATE TABLE exercises (
        id VARCHAR(36) PRIMARY KEY,
        topic_id INT NOT NULL,
        exercise_number INT NOT NULL,
        exercise_text TEXT NOT NULL,
        image_url VARCHAR(500),
        is_complete BIT NOT NULL DEFAULT 0,
        created_by VARCHAR(36) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETUTCDATE(),
        updated_by VARCHAR(36),
        updated_at DATETIME,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
    )
    """
    
    try:
        cursor.execute(create_table_sql)
        conn.commit()
        print("✓ Tabla 'exercises' creada exitosamente")
    except Exception as e:
        print(f"✗ Error al crear tabla 'exercises': {e}")
        conn.rollback()
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    print("Creando tabla de ejercicios...")
    create_exercises_table()
    print("Proceso completado")
