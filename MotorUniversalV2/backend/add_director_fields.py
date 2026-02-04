#!/usr/bin/env python3
"""
Script para agregar campos adicionales del Director del Plantel a la tabla campuses
Los campos son los mismos que tiene un candidato:
- director_name (ya existe - es el nombre completo, lo renombramos semánticamente)
- director_first_surname
- director_second_surname
- director_curp
- director_gender
- director_date_of_birth
- director_email (ya existe)
- director_phone (ya existe)
"""
import pymssql
import os

# Conexión directa a Azure SQL
conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi'
)

cursor = conn.cursor()

# Nuevos campos a agregar (director_name, director_email, director_phone ya existen)
# Cambiamos director_name para que sea solo nombres (como en candidato)
new_columns = [
    ("director_first_surname", "NVARCHAR(100)"),  # Primer apellido
    ("director_second_surname", "NVARCHAR(100)"),  # Segundo apellido
    ("director_curp", "NVARCHAR(18)"),  # CURP
    ("director_gender", "NVARCHAR(1)"),  # Género (M, F, O)
    ("director_date_of_birth", "DATE"),  # Fecha de nacimiento
]

print("=" * 60)
print("Agregando campos del Director (estilo candidato) a tabla campuses")
print("=" * 60)

for column_name, column_type in new_columns:
    try:
        # Verificar si la columna ya existe
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'campuses' AND COLUMN_NAME = %s
        """, (column_name,))
        
        exists = cursor.fetchone()[0] > 0
        
        if exists:
            print(f"  ⏭️  {column_name} ya existe, saltando...")
        else:
            cursor.execute(f"ALTER TABLE campuses ADD {column_name} {column_type}")
            conn.commit()
            print(f"  ✅ {column_name} ({column_type}) agregado exitosamente")
    except Exception as e:
        print(f"  ❌ Error con {column_name}: {str(e)}")
        conn.rollback()

print()
print("=" * 60)
print("Verificando estructura actual de director_* en campuses")
print("=" * 60)

cursor.execute("""
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'campuses' AND COLUMN_NAME LIKE 'director_%'
    ORDER BY COLUMN_NAME
""")

director_columns = cursor.fetchall()
print(f"\nColumnas director_* encontradas: {len(director_columns)}")
for col in director_columns:
    col_name, data_type, max_len, nullable = col
    type_str = f"{data_type}({max_len})" if max_len else data_type
    print(f"  - {col_name}: {type_str} (nullable: {nullable})")

cursor.close()
conn.close()

print()
print("✅ Migración completada")
