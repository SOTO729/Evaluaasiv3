import pymssql
c = pymssql.connect(server='evaluaasi-motorv2-sql.database.windows.net', user='evaluaasi_admin', password='EvalAasi2024_newpwd!', database='evaluaasi_dev')
cur = c.cursor()
cur.execute("SELECT status, COUNT(*) FROM curp_verification_queue GROUP BY status")
for r in cur.fetchall(): print(r)
print('---')
cur.execute("SELECT TOP 5 id, user_id, curp, status, attempts, circuit_open_retries, last_error FROM curp_verification_queue ORDER BY id DESC")
for r in cur.fetchall(): print(r)
