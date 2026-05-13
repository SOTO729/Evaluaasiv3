import pymssql

server = 'evaluaasi-motorv2-sql.database.windows.net'
user = 'evaluaasi_admin'
password = 'EvalAasi2024_newpwd!'
database = 'evaluaasi_dev'
coord_id = 'e16d6669-ed05-492f-8a52-e6b2994ac7de'

def run_query(query, params=None):
    with pymssql.connect(server, user, password, database) as conn:
        with conn.cursor(as_dict=True) as cursor:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor.fetchall()

print("--- 1. Testing Connection and getting Summary ---")
summary_query = f"""
SELECT role, COUNT(*) as count
FROM users u
WHERE u.is_deleted = 0
  AND (
    u.role = 'candidato'
    OR (
      u.role IN ('responsable','responsable_partner','responsable_estatal','auxiliar')
      AND (
        u.coordinator_id = '{coord_id}'
        OR u.campus_id IN (SELECT id FROM campuses WHERE coordinator_id = '{coord_id}')
        OR u.id IN (SELECT responsable_id FROM campuses WHERE coordinator_id = '{coord_id}' AND responsable_id IS NOT NULL)
      )
    )
  )
GROUP BY role;
"""
summary = run_query(summary_query)
for row in summary:
    print(row)

print("\n--- 2. Non-candidato Responsables/Auxiliares (Detailed) ---")
detail_query = f"""
SELECT u.id, u.username, u.role, u.coordinator_id, u.campus_id, u.is_active, u.email, u.name
FROM users u
WHERE u.is_deleted = 0
  AND u.role IN ('responsable','responsable_partner','responsable_estatal','auxiliar')
  AND (
    u.coordinator_id = '{coord_id}'
    OR u.campus_id IN (SELECT id FROM campuses WHERE coordinator_id = '{coord_id}')
    OR u.id IN (SELECT responsable_id FROM campuses WHERE coordinator_id = '{coord_id}' AND responsable_id IS NOT NULL)
  )
ORDER BY u.id DESC;
"""
details = run_query(detail_query)
print(f"Total visible responsables/auxiliares: {len(details)}")
for row in details[:20]:
    print(row)

print("\n--- 3. Comparison with old logic (only coordinator_id) ---")
old_logic_query = f"""
SELECT COUNT(*) as count FROM users 
WHERE role IN ('responsable','responsable_partner','responsable_estatal','auxiliar') 
  AND coordinator_id='{coord_id}' 
  AND is_deleted=0;
"""
old_count = run_query(old_logic_query)[0]['count']
print(f"Count with OLD logic (coordinator_id only): {old_count}")
print(f"Difference: {len(details) - old_count}")

