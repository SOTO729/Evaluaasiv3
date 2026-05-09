"""Recovery one-off: arregla candidatos atrapados por bug previo en bulk-upload.
- GroupMember.status 'curp_pending' -> 'active' (eran ocultos por filtro default).
- Encola verificación en curp_verification_queue para los que aún no estén.
Ejecutar en DEV (evaluaasi_dev) y en PROD (evaluaasi).
"""
import pymssql, sys, uuid
from datetime import datetime

DB = sys.argv[1] if len(sys.argv) > 1 else "evaluaasi_dev"
print(f"DB = {DB}")

conn = pymssql.connect(
    server="evaluaasi-motorv2-sql.database.windows.net",
    user="evaluaasi_admin",
    password="EvalAasi2024_newpwd!",
    database=DB,
    timeout=60,
)
cur = conn.cursor()

# 1) GroupMember curp_pending/curp_verifying -> active
cur.execute("SELECT COUNT(*) FROM group_members WHERE status IN ('curp_pending','curp_verifying')")
trapped = cur.fetchone()[0]
print(f"GroupMembers atrapados (curp_pending/verifying): {trapped}")

if trapped:
    cur.execute("UPDATE group_members SET status='active' WHERE status IN ('curp_pending','curp_verifying')")
    conn.commit()
    print(f"  -> {cur.rowcount} GroupMembers liberados a 'active'")

# 2) BulkUploadMember.status='created' pero no encolados (CURP no validada)
GENERIC = ("XEXX010101HNEXXXA4", "XEXX010101MNEXXXA8")
cur.execute("""
    SELECT bum.user_id, bum.curp, bum.batch_id
    FROM bulk_upload_members bum
    JOIN users u ON u.id = bum.user_id
    WHERE bum.status = 'created'
      AND bum.curp IS NOT NULL
      AND LEN(bum.curp) = 18
      AND ISNULL(u.curp_verified, 0) = 0
""")
candidates = cur.fetchall()
print(f"BulkUploadMembers 'created' con CURP no verificada: {len(candidates)}")

enqueued = 0
skipped = 0
for user_id, curp_val, batch_id in candidates:
    if curp_val in GENERIC:
        skipped += 1
        continue
    # Ya tiene fila pending/processing?
    cur.execute(
        "SELECT 1 FROM curp_verification_queue WHERE user_id=%s AND status IN ('pending','processing')",
        (user_id,),
    )
    if cur.fetchone():
        skipped += 1
        continue
    cur.execute("""
        INSERT INTO curp_verification_queue
            (user_id, curp, status, attempts, circuit_open_retries, batch_id, source, created_at, next_retry_at)
        VALUES (%s, %s, 'pending', 0, 0, %s, 'recovery', GETUTCDATE(), GETUTCDATE())
    """, (user_id, curp_val, batch_id))
    enqueued += 1

conn.commit()
print(f"Encolados: {enqueued}  Saltados: {skipped}")

# Reporte
cur.execute("SELECT COUNT(*) FROM curp_verification_queue WHERE status='pending'")
pending = cur.fetchone()[0]
print(f"Total filas pending en cola ahora: {pending}")

conn.close()
print("OK")
