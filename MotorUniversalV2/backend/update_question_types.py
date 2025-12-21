#!/usr/bin/env python3
"""
Script para actualizar la descripción del tipo de pregunta 'multiple_select'
"""
import pymssql

# Configuración de la base de datos
server = 'evaluaasi-motorv2-sql.database.windows.net'
database = 'evaluaasi'
username = 'evaluaasi_admin'
password = 'EvalAasi2024_c949de16dad23b6d'

try:
    # Conectar a la base de datos
    conn = pymssql.connect(server=server, user=username, password=password, database=database)
    cursor = conn.cursor()
    
    # Actualizar descripción de multiple_select
    cursor.execute("""
        UPDATE question_types 
        SET description = 'Selección múltiple (varias respuestas correctas)' 
        WHERE name = 'multiple_select'
    """)
    conn.commit()
    print('✓ Descripción de "multiple_select" actualizada')
    
    # Mostrar todos los tipos actualizados
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
