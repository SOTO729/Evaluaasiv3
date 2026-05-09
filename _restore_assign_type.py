import pymssql
conn = pymssql.connect(server='evaluaasi-motorv2-sql.database.windows.net', user='evaluaasi_admin', password='EvalAasi2024_newpwd!', database='evaluaasi_dev')
cur = conn.cursor(as_dict=True)
cur.execute("UPDATE group_exams SET assignment_type='all' WHERE id=23")
conn.commit()
cur.execute("SELECT id, assignment_type FROM group_exams WHERE id=23")
print('RESTORED:', cur.fetchall())
conn.close()
