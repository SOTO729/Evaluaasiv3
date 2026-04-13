"""Explorar EvaluacionesMotor DB del Motor V1"""
import pymssql

creds = [
    ('AdminGeneral', '_N6I+fd:B0DeJ4rS76*wZ}]hP7Ur'),
    ('evaluaasi_admin', 'EvalAasi2024_newpwd!'),
]

for user, pwd in creds:
    try:
        conn = pymssql.connect(
            server='evaluaasi-motoruniversal.database.windows.net',
            user=user,
            password=pwd,
            database='EvaluacionesMotor'
        )
        c = conn.cursor()
        c.execute("SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME")
        print(f'=== EvaluacionesMotor TABLES (user: {user}) ===')
        for row in c.fetchall():
            print(f'  {row[0]}.{row[1]}')

        # Look for guacamole or connection related
        c.execute("SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%guac%' OR TABLE_NAME LIKE '%connection%' OR TABLE_NAME LIKE '%remote%' OR TABLE_NAME LIKE '%config%' OR TABLE_NAME LIKE '%setting%'")
        print('\n=== GUAC/CONFIG TABLES ===')
        for row in c.fetchall():
            print(f'  {row[0]}.{row[1]}')

        conn.close()
        break
    except Exception as e:
        print(f'{user} failed: {e}')
