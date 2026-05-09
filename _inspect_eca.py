import pymssql
c=pymssql.connect(server='evaluaasi-motorv2-sql.database.windows.net',user='evaluaasi_admin',password='EvalAasi2024_newpwd!',database='evaluaasi_dev')
cur=c.cursor(as_dict=True)
cur.execute("SELECT competency_standard_id FROM exams WHERE id=1249")
print('exam ecm:', cur.fetchall())
cur.execute("""SELECT user_id, competency_standard_id, assignment_number FROM ecm_candidate_assignments
WHERE user_id IN ('21d2c4b1-0262-4439-910d-8468b1f24919','95baaf90-0ebf-47bc-a63f-85436553ab62','e77cb1e4-f9a1-4025-938f-5b2c80c7e061')""")
print('eca:', cur.fetchall())
cur.execute("SELECT id, group_id, exam_id, is_active, assignment_type FROM group_exams WHERE id=24")
print('ge24:', cur.fetchall())
cur.execute("SELECT COUNT(*) AS n FROM group_exam_members WHERE group_exam_id=24")
print('gem24:', cur.fetchall())
cur.execute("SELECT COUNT(*) AS n FROM group_members WHERE group_id=187 AND status='active'")
print('gm187:', cur.fetchall())
