import pymssql, sys
db = sys.argv[1] if len(sys.argv)>1 else 'evaluaasi_dev'
c = pymssql.connect(server='evaluaasi-motorv2-sql.database.windows.net', user='evaluaasi_admin', password='EvalAasi2024_newpwd!', database=db)
cur = c.cursor()
cur.execute("UPDATE curp_verification_queue SET status='pending', locked_at=NULL, locked_by=NULL WHERE status='processing' AND locked_at < DATEADD(MINUTE, -5, GETUTCDATE())")
print('liberados:', cur.rowcount)
c.commit()
cur.execute("SELECT status, COUNT(*) FROM curp_verification_queue GROUP BY status")
for r in cur.fetchall(): print(r)
