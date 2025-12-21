#!/usr/bin/env python3
"""
Script para agregar el tipo de pregunta 'multiple_select'
"""
import pymssql
import os

# Configuración de la base de datos
server = 'evaluaasi-motorv2-sql.database.windows.net'
database = 'evaluaasi'
username = 'evaluaasi_admin'
password = 'EvalAasi2024_c949de16dad23b6d'

try:
    # Conectar a la base de datos
    conn = pymssql.connect(server=server, user=username, password=password, database=database)
    cursor = conn.cursor()
    
    # Verificar si ya existe
    cursor.execute("SELECT id, name, description FROM question_types WHERE name = 'multiple_select'")
    existing = cursor.fetchone()
    
    if existing:
        print(f'✓ El tipo "selección múltiple" ya existe:')
        print(f'  ID: {existing[0]}, Name: {existing[1]}, Description: {existing[2]}')
    else:
        # Insertar nuevo tipo
        cursor.execute(
            "INSERT INTO question_types (name, description) VALUES ('multiple_select', 'Selección múltiple (varias correctas)')"
        )
        conn.commit()
        
        # Obtener el ID insertado
        cursor.execute("SELECT id FROM question_types WHERE name = 'multiple_select'")
        new_id = cursor.fetchone()[0]
        print(f'✓ Tipo de pregunta "selección múltiple" agregado con ID: {new_id}')
    
    # Mostrar todos los tipos
    cursor.execute("SELECT id, name, description FROM question_types ORDER BY id")
    all_types = cursor.fetchall()
    print('\nTipos de pregunta disponibles:')
    for qt in all_types:
        print(f'  {qt[0]}: {qt[1]} - {qt[2]}')
    
    cursor.close()
    conn.close()
    print("\n✓ Operación completada exitosamente")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
