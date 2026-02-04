"""
Script para revisar y limpiar estados del partner kkkkkkk
"""
import os
import pymssql

# Connection string from Azure
db_url = os.environ.get('DATABASE_URL', 'mssql+pymssql://evaluaasi_admin:EvalAasi2024_newpwd!@evaluaasi-motorv2-sql.database.windows.net/evaluaasi')
parts = db_url.replace('mssql+pymssql://', '').split('@')
user_pass = parts[0].split(':')
host_db = parts[1].split('/')

conn = pymssql.connect(
    server=host_db[0],
    user=user_pass[0],
    password=user_pass[1],
    database=host_db[1]
)
cursor = conn.cursor()

# Buscar partner kkkkkkk
cursor.execute("SELECT id, name FROM partners WHERE LOWER(name) LIKE '%kkkk%'")
partner = cursor.fetchone()
if partner:
    partner_id, partner_name = partner
    print(f'Partner: ID={partner_id}, Name={partner_name}')
    print()
    
    # Ver estados registrados manualmente (en la tabla partner_state_presences)
    cursor.execute('SELECT id, state_name FROM partner_state_presences WHERE partner_id = %s', (partner_id,))
    presences = cursor.fetchall()
    print(f'Estados en partner_state_presences ({len(presences)}):')
    for p in presences:
        print(f'  - ID: {p[0]}, State: {p[1]}')
    print()
    
    # Ver planteles y sus estados
    cursor.execute('SELECT id, name, state_name FROM campuses WHERE partner_id = %s', (partner_id,))
    campuses = cursor.fetchall()
    print(f'Planteles ({len(campuses)}):')
    campus_states = set()
    for c in campuses:
        print(f'  - ID: {c[0]}, Name: {c[1]}, State: {c[2]}')
        if c[2]:
            campus_states.add(c[2])
    print()
    print(f'Estados únicos de planteles: {sorted(campus_states)}')
    
    # Identificar estados a eliminar
    states_to_keep = campus_states
    states_to_delete = [p for p in presences if p[1] not in states_to_keep]
    print()
    print(f'Estados a eliminar (no corresponden a ningún plantel): {[p[1] for p in states_to_delete]}')
    
    # Eliminar estados que no corresponden
    if states_to_delete:
        print()
        print('Eliminando estados que no corresponden...')
        for presence in states_to_delete:
            cursor.execute('DELETE FROM partner_state_presences WHERE id = %s', (presence[0],))
            print(f'  - Eliminado: {presence[1]} (ID: {presence[0]})')
        conn.commit()
        print('✅ Estados eliminados correctamente')
    else:
        print('No hay estados para eliminar')
else:
    print('Partner no encontrado')

conn.close()
