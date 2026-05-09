"""
Seed Office DEV: crea/asegura un escenario de prueba completo en la BD DEV
para validar el flujo Office (coordinador -> candidato -> agenda -> examen).

Idempotente: si los registros ya existen, los reutiliza/actualiza.

Uso:
    python seed_office_dev.py

Conexión: usa env var DEV_SQL_PWD (no se commitea); si no existe, falla.
"""
import os
import sys
import uuid
from datetime import date, datetime, timedelta

try:
    import pymssql
except ImportError:
    print("ERROR: instalar pymssql -> pip install pymssql", file=sys.stderr)
    sys.exit(2)

try:
    from argon2 import PasswordHasher
    _ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)
    def generate_password_hash(p):
        return _ph.hash(p)
except ImportError:
    print("ERROR: instalar argon2-cffi -> pip install argon2-cffi", file=sys.stderr)
    sys.exit(2)

PWD = os.environ.get("DEV_SQL_PWD")
if not PWD:
    print("ERROR: definir DEV_SQL_PWD", file=sys.stderr)
    sys.exit(2)

CONN = dict(
    server="evaluaasi-motorv2-sql.database.windows.net",
    database="evaluaasi_dev",
    user="evaluaasi_admin",
    password=PWD,
    timeout=30,
    login_timeout=30,
    tds_version="7.4",
)


def gen_uuid():
    return str(uuid.uuid4())


def upsert(cur, table, where, values):
    """Update si existe, insert si no. Retorna fila completa."""
    where_sql = " AND ".join([f"[{k}] = %s" for k in where])
    cur.execute(f"SELECT TOP 1 * FROM [{table}] WHERE {where_sql}", tuple(where.values()))
    row = cur.fetchone()
    if row:
        sets = ", ".join([f"[{k}] = %s" for k in values])
        params = list(values.values()) + list(where.values())
        cur.execute(f"UPDATE [{table}] SET {sets} WHERE {where_sql}", tuple(params))
        cur.execute(f"SELECT TOP 1 * FROM [{table}] WHERE {where_sql}", tuple(where.values()))
        return cur.fetchone()
    merged = {**where, **values}
    cols = ", ".join([f"[{k}]" for k in merged])
    placeholders = ", ".join(["%s"] * len(merged))
    cur.execute(f"INSERT INTO [{table}] ({cols}) VALUES ({placeholders})", tuple(merged.values()))
    cur.execute(f"SELECT TOP 1 * FROM [{table}] WHERE {where_sql}", tuple(where.values()))
    return cur.fetchone()


def main():
    conn = pymssql.connect(**CONN, as_dict=True)
    conn.autocommit(True)
    cur = conn.cursor()
    print(f"[ok] conectado a {CONN['server']}/{CONN['database']}")

    # 1) Coordinador (reusar admin si existe; si no, crear coord_office_dev)
    cur.execute("SELECT TOP 1 * FROM users WHERE username = 'admin'")
    admin = cur.fetchone()
    if not admin:
        print("ERROR: usuario admin no existe en DEV", file=sys.stderr)
        sys.exit(3)
    coordinator_id = admin["id"]
    print(f"[ok] coordinator_id (admin) = {coordinator_id}")

    # 2) Partner DEV Office Test
    cur.execute("SELECT TOP 1 * FROM partners WHERE name = 'DEV Office Test Partner'")
    partner = cur.fetchone()
    if not partner:
        # bigint identity
        cur.execute(
            "INSERT INTO partners (name, legal_name, country, coordinator_id, is_active, created_at, updated_at) "
            "VALUES (%s,%s,%s,%s,1,%s,%s)",
            ("DEV Office Test Partner", "DEV Office Test SA de CV", "México", coordinator_id, datetime.utcnow(), datetime.utcnow()),
        )
        cur.execute("SELECT TOP 1 * FROM partners WHERE name = 'DEV Office Test Partner'")
        partner = cur.fetchone()
    partner_id = partner["id"]
    print(f"[ok] partner_id = {partner_id}")

    # 3) Campus con flags Office
    cur.execute("SELECT TOP 1 * FROM campuses WHERE partner_id = %s AND name = %s", (partner_id, "Plantel Office DEV"))
    campus = cur.fetchone()
    campus_code = "DEV-OFC-001"
    if not campus:
        cur.execute(
            "INSERT INTO campuses (partner_id, name, code, country, state_name, city, "
            " coordinator_id, is_active, "
            " enable_office_exams, enable_office_simulators, "
            " office_version, office_exam_level, "
            " created_at, updated_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,1,1,1,%s,%s,%s,%s)",
            (partner_id, "Plantel Office DEV", campus_code, "México", "Ciudad de México", "CDMX",
             coordinator_id, "2016", "basico", datetime.utcnow(), datetime.utcnow()),
        )
        cur.execute("SELECT TOP 1 * FROM campuses WHERE code = %s", (campus_code,))
        campus = cur.fetchone()
    else:
        cur.execute(
            "UPDATE campuses SET enable_office_exams=1, enable_office_simulators=1, "
            "office_version=%s, office_exam_level=%s, is_active=1, coordinator_id=%s WHERE id=%s",
            ("2016", "basico", coordinator_id, campus["id"]),
        )
    campus_id = campus["id"]
    print(f"[ok] campus_id = {campus_id} (flags Office activos)")

    # 4) Candidato test.candidato / Test123!
    cur.execute("SELECT TOP 1 * FROM users WHERE username = 'test.candidato'")
    cand = cur.fetchone()
    if not cand:
        cand_id = gen_uuid()
        pwd_hash = generate_password_hash("Test123!")
        cur.execute(
            "INSERT INTO users (id, username, email, password_hash, role, is_active, is_verified, "
            " name, first_surname, second_surname, "
            " curp_verified, can_bulk_create_candidates, can_manage_groups, can_view_reports, "
            " can_approve_balance, enable_evaluation_report, enable_certificate, "
            " enable_conocer_certificate, enable_digital_badge, "
            " created_at, updated_at) "
            "VALUES (%s,%s,%s,%s,%s,1,1,%s,%s,%s, 0,0,0,1, 0,1,1,1,1, %s,%s)",
            (cand_id, "test.candidato", "test.candidato@evaluaasi.dev", pwd_hash, "candidato",
             "Test", "Candidato", "DEV", datetime.utcnow(), datetime.utcnow()),
        )
    else:
        cand_id = cand["id"]
        # Reset password por si acaso
        pwd_hash = generate_password_hash("Test123!")
        cur.execute("UPDATE users SET password_hash=%s, is_active=1, role='candidato' WHERE id=%s", (pwd_hash, cand_id))
    print(f"[ok] candidato test.candidato id={cand_id} pwd=Test123!")

    # 4b) Asociar candidato al partner (user_partners)
    cur.execute("SELECT user_id FROM user_partners WHERE user_id=%s AND partner_id=%s", (cand_id, partner_id))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO user_partners (user_id, partner_id, created_at) VALUES (%s,%s,%s)",
            (cand_id, partner_id, datetime.utcnow()),
        )

    # 5) CandidateGroup
    cur.execute("SELECT TOP 1 * FROM candidate_groups WHERE campus_id=%s AND name=%s", (campus_id, "Grupo Office DEV"))
    grp = cur.fetchone()
    if not grp:
        cur.execute(
            "INSERT INTO candidate_groups (campus_id, coordinator_id, name, code, is_active, "
            " enable_office_exams_override, enable_office_simulators_override, "
            " created_at, updated_at) "
            "VALUES (%s,%s,%s,%s,1,1,1,%s,%s)",
            (campus_id, coordinator_id, "Grupo Office DEV", "DEV-OFC-G1",
             datetime.utcnow(), datetime.utcnow()),
        )
        cur.execute("SELECT TOP 1 * FROM candidate_groups WHERE campus_id=%s AND name=%s", (campus_id, "Grupo Office DEV"))
        grp = cur.fetchone()
    group_id = grp["id"]
    print(f"[ok] group_id = {group_id}")

    # 6) GroupMember (candidato en el grupo)
    cur.execute("SELECT id FROM group_members WHERE group_id=%s AND user_id=%s", (group_id, cand_id))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO group_members (group_id, user_id, status, joined_at, updated_at) "
            "VALUES (%s,%s,'active',%s,%s)",
            (group_id, cand_id, datetime.utcnow(), datetime.utcnow()),
        )
    print(f"[ok] candidato agregado al grupo")

    # 7) VmSession para HOY (UTC) con ventana actual ±3h, Office Excel local
    now_utc = datetime.utcnow()
    today = now_utc.date()
    now_h = now_utc.hour
    start_h = max(0, now_h - 1)
    end_h = min(23, now_h + 3)

    cur.execute(
        "DELETE FROM vm_sessions WHERE user_id=%s AND session_date=%s",
        (cand_id, today),
    )
    cur.execute(
        "INSERT INTO vm_sessions (user_id, campus_id, group_id, session_date, start_hour, end_hour, "
        " session_type, is_local, office_app, office_version, level, status, created_at, updated_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,'examen',1,'excel','2016','basico','scheduled',%s,%s)",
        (cand_id, campus_id, group_id, today, start_h, end_h, datetime.utcnow(), datetime.utcnow()),
    )
    cur.execute(
        "SELECT TOP 1 id FROM vm_sessions WHERE user_id=%s AND session_date=%s ORDER BY id DESC",
        (cand_id, today),
    )
    vm_session_id = cur.fetchone()["id"]
    print(f"[ok] VmSession id={vm_session_id} fecha={today} horas={start_h}-{end_h} app=excel v=2016 nivel=basico")

    # 8) OfficeAppVersion catalogo (al menos 1 entrada para Excel 2016 Examen)
    cur.execute("SELECT TOP 1 id FROM office_app_versions WHERE app_name=%s", ("excel-2016-examen-basico",))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO office_app_versions (app_name, app_type, min_version, latest_version, "
            " download_url, is_active, updated_at) "
            "VALUES (%s,'examen','2.0.0','2.0.0',%s,1,%s)",
            ("excel-2016-examen-basico",
             "https://evaluaasimotorv2storage.blob.core.windows.net/evaluaasi-files/office-apps/EvaluaasiOfficeV2.exe",
             datetime.utcnow()),
        )
        print("[ok] OfficeAppVersion creado: excel-2016-examen-basico")
    else:
        print("[ok] OfficeAppVersion ya existe: excel-2016-examen-basico")

    print("\n=== RESUMEN ===")
    print(f"  Candidato:      test.candidato / Test123!  (id={cand_id})")
    print(f"  Partner:        {partner_id} (DEV Office Test Partner)")
    print(f"  Campus:         {campus_id} ({campus_code}) - flags Office activos")
    print(f"  Grupo:          {group_id} (DEV-OFC-G1)")
    print(f"  VmSession HOY:  id={vm_session_id}  {today} {start_h:02d}:00-{end_h:02d}:00  excel/2016/basico")
    print()
    print("Login en frontend DEV:")
    print("  https://orange-sky-01755e210.1.azurestaticapps.net/login")
    print("  user: test.candidato  pwd: Test123!")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
