#!/usr/bin/env python3
"""
Script para agregar la tabla group_exams a la base de datos
"""
import os
import sys

# Agregar el directorio del proyecto al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from config import Config

def run_migration():
    """Ejecuta la migración para crear la tabla group_exams"""
    
    database_url = Config.SQLALCHEMY_DATABASE_URI
    
    if not database_url:
        print("ERROR: DATABASE_URL no configurada")
        sys.exit(1)
    
    print(f"Conectando a la base de datos...")
    
    engine = create_engine(database_url)
    
    # SQL para crear la tabla group_exams
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS group_exams (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES candidate_groups(id) ON DELETE CASCADE,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        available_from TIMESTAMP WITH TIME ZONE,
        available_until TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(group_id, exam_id)
    );
    """
    
    # SQL para crear índices
    create_indexes_sql = """
    CREATE INDEX IF NOT EXISTS idx_group_exams_group_id ON group_exams(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_exams_exam_id ON group_exams(exam_id);
    CREATE INDEX IF NOT EXISTS idx_group_exams_is_active ON group_exams(is_active);
    """
    
    try:
        with engine.connect() as connection:
            # Verificar si la tabla ya existe
            result = connection.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'group_exams'
                );
            """))
            table_exists = result.scalar()
            
            if table_exists:
                print("✅ La tabla 'group_exams' ya existe")
            else:
                print("Creando tabla 'group_exams'...")
                connection.execute(text(create_table_sql))
                connection.commit()
                print("✅ Tabla 'group_exams' creada exitosamente")
            
            # Crear índices si no existen
            print("Verificando/creando índices...")
            connection.execute(text(create_indexes_sql))
            connection.commit()
            print("✅ Índices verificados/creados")
            
            # Verificar la estructura
            result = connection.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'group_exams'
                ORDER BY ordinal_position;
            """))
            columns = result.fetchall()
            
            print("\n📋 Estructura de la tabla group_exams:")
            for col in columns:
                print(f"   - {col[0]}: {col[1]}")
            
            print("\n✅ Migración completada exitosamente")
            
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
