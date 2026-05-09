import pymssql, sys
mode = sys.argv[1] if len(sys.argv) > 1 else 'off'
conn = pymssql.connect(server='evaluaasi-motorv2-sql.database.windows.net', user='evaluaasi_admin', password='EvalAasi2024_newpwd!', database='evaluaasi_dev')
cur = conn.cursor(as_dict=True)
val = 0 if mode == 'off' else 1
cur.execute(f"UPDATE group_exams SET is_active={val} WHERE id=23")
conn.commit()
cur.execute("SELECT id, is_active FROM group_exams WHERE id=23")
print(f'group_exams.23 set is_active={val}:', cur.fetchall())
conn.close()
