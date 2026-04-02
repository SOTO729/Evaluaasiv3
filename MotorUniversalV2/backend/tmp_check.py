import pymssql
import uuid

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi_dev'
)
cursor = conn.cursor()

user_id = 'df9b0fd6-9416-4138-a5fe-e439eb1c69f5'

# Check existing results
print("=== Existing CANDDAT1 approved results ===")
cursor.execute("""
    SELECT r.id, r.exam_id, e.name, r.group_id, r.group_exam_id, r.eduit_certificate_code,
           cg.campus_id, cam.name as campus_name, cam.logo_url
    FROM results r
    JOIN exams e ON r.exam_id = e.id
    LEFT JOIN candidate_groups cg ON r.group_id = cg.id
    LEFT JOIN campuses cam ON cg.campus_id = cam.id
    WHERE r.user_id = %s AND r.result = 1
""", (user_id,))
for r in cursor.fetchall():
    logo = "SI" if r[8] else "NO"
    campus = r[7] or "(sin plantel)"
    print(f"  {r[2][:50]} | group_id={r[3]} | campus='{campus}' | logo={logo} | eduit={r[5]}")

# Update the existing huawei result to point to group 136 (Colegio de panama)
print("\n=== Updating huawei result to group 136 (Colegio de panama) ===")
cursor.execute("""
    UPDATE results SET group_id = 136, group_exam_id = 16
    WHERE id = 'ba4c8dde-c8e4-4657-979f-fb715f6e3499'
""")
conn.commit()
print("Updated huawei result: group_id=136, group_exam_id=16")

# Verify final state
print("\n=== Final CANDDAT1 approved results ===")
cursor.execute("""
    SELECT r.id, r.exam_id, e.name, r.group_id, r.group_exam_id, r.eduit_certificate_code,
           cg.campus_id, cam.name as campus_name, cam.logo_url
    FROM results r
    JOIN exams e ON r.exam_id = e.id
    LEFT JOIN candidate_groups cg ON r.group_id = cg.id
    LEFT JOIN campuses cam ON cg.campus_id = cam.id
    WHERE r.user_id = %s AND r.result = 1
    ORDER BY r.exam_id
""", (user_id,))
for r in cursor.fetchall():
    logo = "SI" if r[8] else "NO"
    campus = r[7] or "(sin plantel)"
    print(f"  {r[2][:50]} | group_id={r[3]} | campus='{campus}' | logo={logo} | eduit={r[5]}")

conn.close()

