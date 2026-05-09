import pymssql
c=pymssql.connect(server='evaluaasi-motorv2-sql.database.windows.net',user='evaluaasi_admin',password='EvalAasi2024_newpwd!',database='evaluaasi_dev')
cur=c.cursor(as_dict=True)
cur.execute("SELECT id, username, email, role FROM users WHERE id='e16d6669-ed05-492f-8a52-e6b2994ac7de'")
print('coord:', cur.fetchall())
