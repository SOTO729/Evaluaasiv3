import pymssql
SRV='evaluaasi-motorv2-sql.database.windows.net'
USR='evaluaasi_admin'
PWD='EvalAasi2024_newpwd!'
DB='evaluaasi_dev'

conn = pymssql.connect(server=SRV, user=USR, password=PWD, database=DB)
cur = conn.cursor(as_dict=True)

# State actual del GroupExam id=23 (ECM00EX en grupo 187)
cur.execute("SELECT id, group_id, exam_id, assignment_type, is_active FROM group_exams WHERE id=23")
print('BEFORE:', cur.fetchall())

# Cambiar a 'selected' temporalmente
cur.execute("UPDATE group_exams SET assignment_type='selected' WHERE id=23")
conn.commit()
cur.execute("SELECT id, group_id, exam_id, assignment_type FROM group_exams WHERE id=23")
print('AFTER:', cur.fetchall())

# Verificar membership de los 2 candidatos del Excel en el grupo 187
cur.execute("""
SELECT u.id, u.username, u.curp, u.first_name, gm.status
FROM users u
LEFT JOIN group_members gm ON gm.user_id=u.id AND gm.group_id=187
WHERE u.curp IN ('AACM100915HDFMLGA1','CUOA100521HDFRRLA7')
""")
print('MEMBERS:', cur.fetchall())

# Si hay registros en group_exam_members para esos users en exam 23, listarlos
cur.execute("""
SELECT gem.id, gem.group_exam_id, gem.user_id
FROM group_exam_members gem
WHERE gem.group_exam_id=23
""")
rows = cur.fetchall()
print(f'group_exam_members exam=23 count={len(rows)}')
for r in rows[:5]: print(r)

conn.close()
