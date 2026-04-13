"""Diagnostic script for blank study progress report - Colegio de Panama."""
import pymssql

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi_dev'
)
c = conn.cursor()

# 1. Find the campus
c.execute("SELECT id, name, partner_id, coordinator_id FROM campuses WHERE name LIKE '%panama%' OR name LIKE '%Panam%'")
rows = c.fetchall()
print('=== CAMPUSES ===')
for r in rows:
    print(f'  id={r[0]}, name={r[1]}, partner_id={r[2]}, coordinator_id={r[3]}')

if not rows:
    print('No campus found!')
    conn.close()
    exit()

campus_id = rows[0][0]

# 2. Groups for this campus
c.execute(f'SELECT id, name, coordinator_id, school_cycle_id, is_active FROM candidate_groups WHERE campus_id={campus_id}')
groups = c.fetchall()
print(f'\n=== GROUPS for campus {campus_id} ===')
for r in groups:
    print(f'  id={r[0]}, name={r[1]}, coordinator_id={r[2]}, cycle={r[3]}, active={r[4]}')

group_ids = [r[0] for r in groups]
if not group_ids:
    print('No groups!')
    conn.close()
    exit()

gids = ','.join(str(x) for x in group_ids)

# 3. Group members
c.execute(f"SELECT group_id, COUNT(*) as cnt, status FROM group_members WHERE group_id IN ({gids}) GROUP BY group_id, status")
print(f'\n=== GROUP MEMBERS ===')
for r in c.fetchall():
    print(f'  group_id={r[0]}, count={r[1]}, status={r[2]}')

# 4. GroupStudyMaterial assignments
c.execute(f"""SELECT gsm.id, gsm.group_id, gsm.study_material_id, gsm.is_active, sc.title 
FROM group_study_materials gsm 
JOIN study_contents sc ON sc.id = gsm.study_material_id 
WHERE gsm.group_id IN ({gids})""")
gsm_rows = c.fetchall()
print(f'\n=== GROUP STUDY MATERIALS ===')
for r in gsm_rows:
    print(f'  gsm_id={r[0]}, group_id={r[1]}, material_id={r[2]}, is_active={r[3]}, title={r[4]}')

if not gsm_rows:
    print('  NO MATERIALS ASSIGNED TO ANY GROUP!')
    conn.close()
    exit()

mat_ids = list(set(str(r[2]) for r in gsm_rows))
mids = ','.join(mat_ids)

# 5. Sessions and topics
c.execute(f"SELECT ss.id, ss.material_id, ss.title, ss.session_number FROM study_sessions ss WHERE ss.material_id IN ({mids}) ORDER BY ss.material_id, ss.session_number")
sessions = c.fetchall()
print(f'\n=== SESSIONS ({len(sessions)}) ===')
for r in sessions:
    print(f'  session_id={r[0]}, material_id={r[1]}, title={r[2]}, num={r[3]}')

if not sessions:
    print('  NO SESSIONS FOUND FOR MATERIALS!')
    conn.close()
    exit()

sids = ','.join(str(r[0]) for r in sessions)
c.execute(f"SELECT st.id, st.session_id, st.title, st.[order] FROM study_topics st WHERE st.session_id IN ({sids}) ORDER BY st.session_id, st.[order]")
topics = c.fetchall()
print(f'\n=== TOPICS ({len(topics)}) ===')
for r in topics[:10]:
    print(f'  topic_id={r[0]}, session_id={r[1]}, title={r[2]}, order={r[3]}')
if len(topics) > 10:
    print(f'  ... and {len(topics)-10} more')

if not topics:
    print('  NO TOPICS FOUND!')
    conn.close()
    exit()

# 6. StudentTopicProgress
tids = ','.join(str(r[0]) for r in topics)
c.execute(f"SELECT COUNT(*) FROM student_topic_progress WHERE topic_id IN ({tids})")
prog_count = c.fetchone()[0]
print(f'\n=== STUDENT TOPIC PROGRESS RECORDS: {prog_count} ===')

if prog_count > 0:
    c.execute(f"""SELECT TOP 10 stp.user_id, u.name, u.first_surname, stp.topic_id, stp.progress_percentage, stp.is_completed, stp.total_contents, stp.completed_contents 
    FROM student_topic_progress stp 
    JOIN users u ON u.id = stp.user_id
    WHERE stp.topic_id IN ({tids})
    ORDER BY stp.progress_percentage DESC""")
    for r in c.fetchall():
        print(f'  user={r[0]} ({r[1]} {r[2]}), topic={r[3]}, progress={r[4]}%, completed={r[5]}, total={r[6]}, done={r[7]}')

# 7. Check if those users are group members
c.execute(f"""SELECT DISTINCT stp.user_id, u.name, u.first_surname, gm.group_id, gm.status
FROM student_topic_progress stp
JOIN users u ON u.id = stp.user_id
LEFT JOIN group_members gm ON gm.user_id = stp.user_id AND gm.group_id IN ({gids})
WHERE stp.topic_id IN ({tids})""")
print(f'\n=== USERS WITH PROGRESS - GROUP MEMBERSHIP ===')
for r in c.fetchall():
    print(f'  user={r[0]} ({r[1]} {r[2]}), group_id={r[3]}, member_status={r[4]}')

conn.close()
print('\nDone.')
