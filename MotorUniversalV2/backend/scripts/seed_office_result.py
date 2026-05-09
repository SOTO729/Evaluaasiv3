"""Crea (idempotente) un OfficeExamResult completado para test.candidato
para validar el flujo end-to-end: PDF + tabla MisExamenesOffice."""
import os, sys, uuid, json
from datetime import datetime, timedelta

import pymssql

pwd = os.environ.get('DEV_SQL_PWD')
if not pwd:
    print("falta DEV_SQL_PWD", file=sys.stderr); sys.exit(2)

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password=pwd,
    database='evaluaasi_dev',
    tds_version='7.4',
)
cur = conn.cursor()
USER_ID = '8f156906-d6ec-4553-8178-809b173c7f24'
CAMPUS_ID = 159
GROUP_ID = 184

cur.execute("SELECT TOP 1 id FROM office_exam_results WHERE user_id=%s AND status='completed'", (USER_ID,))
row = cur.fetchone()
if row:
    print(f"[ok] resultado ya existe id={row[0]}")
    sys.exit(0)

rid = str(uuid.uuid4())
now = datetime.utcnow()
started = now - timedelta(minutes=45)
finished = now - timedelta(minutes=5)
cur.execute(
    """
    INSERT INTO office_exam_results
      (id, user_id, vm_session_id, campus_id, group_id, session_type,
       office_app, office_version, level, score, passing_score, passed,
       total_questions, correct_answers, status, duration_seconds,
       started_at, finished_at, created_at, certificate_code, app_version)
    VALUES (%s, %s, NULL, %s, %s, 'examen',
       'excel', '2016', 'basico', 820, 400, 1,
       30, 25, 'completed', 2400,
       %s, %s, %s, %s, '2.0.0')
    """,
    (rid, USER_ID, CAMPUS_ID, GROUP_ID, started, finished, now, f"OFC-{rid[:8].upper()}")
)
conn.commit()
print(f"[ok] OfficeExamResult creado id={rid}")
print(f"     score=820/1000 passed=True app=excel level=basico")
