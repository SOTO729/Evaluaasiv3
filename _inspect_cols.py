import pymssql
conn = pymssql.connect(server='evaluaasi-motorv2-sql.database.windows.net', user='evaluaasi_admin', password='EvalAasi2024_newpwd!', database='evaluaasi_dev')
cur = conn.cursor(as_dict=True)
cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='candidate_groups' AND COLUMN_NAME LIKE '%cost%' OR (TABLE_NAME='candidate_groups' AND COLUMN_NAME LIKE '%custom%')")
print('group_cols:', cur.fetchall())
cur.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='candidate_groups'")
print('all_cols:', [r['COLUMN_NAME'] for r in cur.fetchall()])
conn.close()
