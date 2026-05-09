import pymssql
SRV='evaluaasi-motorv2-sql.database.windows.net'
USR='evaluaasi_admin'
PWD='EvalAasi2024_newpwd!'
DB='evaluaasi_dev'
conn = pymssql.connect(server=SRV, user=USR, password=PWD, database=DB)
cur = conn.cursor(as_dict=True)

# Inspeccionar GroupExams en 187
cur.execute("""
SELECT ge.id, ge.group_id, ge.exam_id, ge.assignment_type, ge.is_active, e.name AS exam_name, e.competency_standard_id
FROM group_exams ge
JOIN exams e ON e.id = ge.exam_id
WHERE ge.group_id IN (187,188)
""")
print('GROUP_EXAMS:')
for r in cur.fetchall(): print(' ', r)

# Miembros del grupo 187
cur.execute("""
SELECT TOP 5 u.id, u.username, u.curp, gm.status
FROM group_members gm
JOIN users u ON u.id = gm.user_id
WHERE gm.group_id=187 AND gm.status='active'
""")
print('GROUP_187 MEMBERS:')
for r in cur.fetchall(): print(' ', r)

# Asignaciones ECM ya creadas para esos miembros, en grupo 187
cur.execute("""
SELECT TOP 10 eca.id, eca.assignment_number, eca.user_id, eca.competency_standard_id, eca.exam_id, eca.group_id, eca.expires_at, eca.assignment_source
FROM ecm_candidate_assignments eca
WHERE eca.group_id=187
""")
print('ECA in group 187:')
for r in cur.fetchall(): print(' ', r)

conn.close()
