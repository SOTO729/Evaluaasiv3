"""
Migración: Agregar índices faltantes a columnas frecuentemente consultadas.
Hallazgos B1-B13 de la auditoría de rendimiento 2026-03-23.

Uso:
    python migrate_add_indexes.py [dev|prod]
    Default: dev
"""
import pymssql
import sys

ENV = sys.argv[1] if len(sys.argv) > 1 else 'dev'

DB_CONFIG = {
    'dev': {
        'server': 'evaluaasi-motorv2-sql.database.windows.net',
        'user': 'evaluaasi_admin',
        'password': 'EvalAasi2024_newpwd!',
        'database': 'evaluaasi_dev',
    },
    'prod': {
        'server': 'evaluaasi-motorv2-sql.database.windows.net',
        'user': 'evaluaasi_admin',
        'password': 'EvalAasi2024_newpwd!',
        'database': 'evaluaasi',
    }
}

INDEXES = [
    # B1: GroupMember - ya tiene UniqueConstraint(group_id, user_id) que crea índice,
    #     pero agregar índice individual en group_id para queries que solo filtran por grupo
    ("ix_group_members_group_id", "group_members", "group_id"),
    ("ix_group_members_user_id", "group_members", "user_id"),
    ("ix_group_members_status", "group_members", "status"),

    # B2: User.role
    ("ix_users_role", "users", "role"),

    # B3: User.is_active
    ("ix_users_is_active", "users", "is_active"),

    # B4: User.campus_id
    ("ix_users_campus_id", "users", "campus_id"),

    # B5: Campus.partner_id
    ("ix_campuses_partner_id", "campuses", "partner_id"),

    # B6: CandidateGroup.campus_id
    ("ix_candidate_groups_campus_id", "candidate_groups", "campus_id"),

    # B7: GroupExam.group_id
    ("ix_group_exams_group_id", "group_exams", "group_id"),

    # B8: GroupExamMember - ya tiene UniqueConstraint, agregar individuales
    ("ix_group_exam_members_group_exam_id", "group_exam_members", "group_exam_id"),
    ("ix_group_exam_members_user_id", "group_exam_members", "user_id"),

    # B9: BalanceRequest
    ("ix_balance_requests_coordinator_id", "balance_requests", "coordinator_id"),
    ("ix_balance_requests_status", "balance_requests", "status"),
    ("ix_balance_requests_campus_id", "balance_requests", "campus_id"),

    # B10: User.curp
    ("ix_users_curp", "users", "curp"),

    # B11: ActivityLog.user_id
    ("ix_activity_logs_user_id", "activity_logs", "user_id"),

    # B12: ActivityLog.action_type
    ("ix_activity_logs_action_type", "activity_logs", "action_type"),

    # B13: EcmCandidateAssignment.group_exam_id
    ("ix_ecm_candidate_assignments_group_exam_id", "ecm_candidate_assignments", "group_exam_id"),
]


def run_migration():
    cfg = DB_CONFIG[ENV]
    print(f"Conectando a {ENV}: {cfg['database']}@{cfg['server']}...")
    conn = pymssql.connect(**cfg)
    cursor = conn.cursor()

    created = 0
    skipped = 0
    errors = 0

    for idx_name, table, column in INDEXES:
        try:
            # Verificar si el índice ya existe
            cursor.execute("""
                SELECT 1 FROM sys.indexes
                WHERE name = %s AND object_id = OBJECT_ID(%s)
            """, (idx_name, table))
            if cursor.fetchone():
                print(f"  SKIP  {idx_name} (ya existe)")
                skipped += 1
                continue

            # Verificar si la tabla y columna existen
            cursor.execute("""
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = %s AND COLUMN_NAME = %s
            """, (table, column))
            if not cursor.fetchone():
                print(f"  SKIP  {idx_name} (tabla/columna no existe: {table}.{column})")
                skipped += 1
                continue

            # Crear índice
            sql = f"CREATE NONCLUSTERED INDEX [{idx_name}] ON [{table}] ([{column}])"
            cursor.execute(sql)
            conn.commit()
            print(f"  OK    {idx_name} ON {table}({column})")
            created += 1

        except Exception as e:
            print(f"  ERROR {idx_name}: {e}")
            conn.rollback()
            errors += 1

    cursor.close()
    conn.close()

    print(f"\nResultado: {created} creados, {skipped} omitidos, {errors} errores")
    return errors == 0


if __name__ == '__main__':
    success = run_migration()
    sys.exit(0 if success else 1)
