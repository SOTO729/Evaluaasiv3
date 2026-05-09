import pymssql
c = pymssql.connect(server='evaluaasi-motorv2-sql.database.windows.net', user='evaluaasi_admin', password='EvalAasi2024_newpwd!', database='evaluaasi_dev')
cur = c.cursor()
cur.execute("SELECT id, curp, locked_at, locked_by, attempts, last_error FROM curp_verification_queue WHERE status='processing'")
print("PROCESSING:")
for r in cur.fetchall(): print(r)
print('--- next pending ---')
cur.execute("SELECT TOP 5 id, curp, next_retry_at, attempts, locked_at FROM curp_verification_queue WHERE status='pending' ORDER BY next_retry_at")
for r in cur.fetchall(): print(r)
