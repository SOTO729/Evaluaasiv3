import pymssql
c=pymssql.connect(server="evaluaasi-motorv2-sql.database.windows.net",user="evaluaasi_admin",password="EvalAasi2024_newpwd!",database="evaluaasi_dev")
cur=c.cursor()
cur.execute("SELECT id, curp, status, attempts, circuit_open_retries, last_error, next_retry_at, locked_at FROM curp_verification_queue ORDER BY id")
for r in cur.fetchall(): print(r)
