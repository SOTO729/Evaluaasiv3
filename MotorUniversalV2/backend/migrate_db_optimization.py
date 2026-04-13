"""
DB Optimization Migration — P0 + P1
Ejecutar contra evaluaasi_dev primero, luego evaluaasi (prod).

P0: Indexes en FK columns sin index, composite indexes, eliminar duplicados
P1: Indexes en columnas WHERE, agregar updated_at faltante
"""
import pymssql
import sys

DB_CONFIG = {
    'server': 'evaluaasi-motorv2-sql.database.windows.net',
    'user': 'evaluaasi_admin',
    'password': 'EvalAasi2024_newpwd!',
}

def run_migration(database):
    conn = pymssql.connect(**DB_CONFIG, database=database)
    cursor = conn.cursor()

    def safe_exec(sql, label):
        try:
            cursor.execute(sql)
            conn.commit()
            print(f"  [OK] {label}")
        except Exception as e:
            conn.rollback()
            msg = str(e)
            if 'already exists' in msg or 'ya existe' in msg or 'duplicate' in msg.lower():
                print(f"  [SKIP] {label} (already exists)")
            else:
                print(f"  [ERR] {label}: {msg}")

    # ═══════════════════════════════════════════════════════
    # P0 — STEP 1: Remove duplicate indexes
    # ═══════════════════════════════════════════════════════
    print("\n=== P0: REMOVING DUPLICATE INDEXES ===")

    duplicates_to_drop = [
        # (table, index_to_drop, reason)
        ("activity_logs", "ix_activity_logs_action_type", "dup of idx_activity_logs_action (action_type)"),
        ("activity_logs", "ix_activity_logs_user_id", "dup of idx_activity_logs_user (user_id)"),
        ("badge_templates", "ix_bt_cs_id", "dup of ix_badge_templates_competency_standard_id"),
        ("badge_templates", "ix_bt_exam_id", "dup of ix_badge_templates_exam_id"),
        ("balance_requests", "ix_balance_requests_coordinator_id", "dup of idx_balance_requests_coordinator"),
        ("balance_requests", "ix_balance_requests_status", "dup of idx_balance_requests_status"),
        ("balance_transactions", "ix_balance_transactions_coordinator_id", "dup of idx_balance_transactions_coordinator"),
        ("balance_transactions", "ix_balance_transactions_created_at", "dup of idx_balance_transactions_created_at"),
        ("group_exams", "ix_group_exams_exam_id", "dup of idx_group_exams_exam_id"),
        ("group_exams", "ix_group_exams_group_id", "dup of idx_group_exams_group_id"),
        ("issued_badges", "ix_issued_badges_status", "dup of ix_ib_status"),
        ("issued_badges", "ix_issued_badges_template_id", "dup of ix_ib_template_id"),
        ("partner_state_presences", "ix_partner_state_state_name", "dup of ix_partner_state_presences_state_name"),
        ("study_contents", "ix_study_contents_is_published", "dup of idx_study_contents_is_published"),
        ("users", "ix_users_campus_id", "dup of idx_users_campus_id"),
        ("users", "ix_users_curp", "dup of idx_users_curp"),
        ("users", "ix_users_is_active", "dup of idx_users_is_active"),
        ("users", "ix_users_role", "dup of idx_users_role"),
        ("users", "idx_users_username", "dup non-unique of ix_users_username (unique)"),
        ("ecm_candidate_assignments", "ix_eca_tramite_status", "dup of ix_ecm_assignments_tramite_status"),
    ]

    for table, idx_name, reason in duplicates_to_drop:
        safe_exec(
            f"IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='{idx_name}' AND object_id=OBJECT_ID('{table}')) "
            f"DROP INDEX [{idx_name}] ON [{table}]",
            f"Drop {idx_name} on {table} — {reason}"
        )

    # ═══════════════════════════════════════════════════════
    # P0 — STEP 2: Create missing FK indexes
    # ═══════════════════════════════════════════════════════
    print("\n=== P0: CREATING MISSING FK INDEXES ===")

    fk_indexes = [
        ("answers", "ix_answers_created_by", "created_by"),
        ("answers", "ix_answers_updated_by", "updated_by"),
        ("balance_transactions", "ix_balance_transactions_campus_id", "campus_id"),
        ("balance_transactions", "ix_balance_transactions_request_id", "request_id"),
        ("balance_transactions", "ix_balance_transactions_created_by_id", "created_by_id"),
        ("categories", "ix_categories_created_by", "created_by"),
        ("categories", "ix_categories_updated_by", "updated_by"),
        ("certificate_requests", "ix_cert_req_coordinator_group_id", "coordinator_group_id"),
        ("certificate_requests", "ix_cert_req_forwarded_request_id", "forwarded_request_id"),
        ("certificate_requests", "ix_cert_req_group_id", "group_id"),
        ("certificate_templates", "ix_cert_templates_created_by", "created_by"),
        ("certificate_templates", "ix_cert_templates_updated_by", "updated_by"),
        ("ecm_candidate_assignments", "ix_ecm_assignments_assigned_by_id", "assigned_by_id"),
        ("ecm_candidate_assignments", "ix_ecm_assignments_cs_id", "competency_standard_id"),
        ("exams", "ix_exams_created_by", "created_by"),
        ("exams", "ix_exams_updated_by", "updated_by"),
        ("exercises", "ix_exercises_created_by", "created_by"),
        ("exercise_actions", "ix_exercise_actions_step_id", "step_id"),
        ("questions", "ix_questions_question_type_id", "question_type_id"),
        ("questions", "ix_questions_created_by", "created_by"),
        ("topics", "ix_topics_created_by", "created_by"),
        ("topics", "ix_topics_updated_by", "updated_by"),
        ("vm_sessions", "ix_vm_sessions_cancelled_by_id", "cancelled_by_id"),
        ("vm_sessions", "ix_vm_sessions_created_by_id", "created_by_id"),
        ("vm_sessions", "ix_vm_sessions_group_id", "group_id"),
        ("bulk_upload_batches", "ix_bulk_batches_campus_id", "campus_id"),
        ("bulk_upload_batches", "ix_bulk_batches_group_id", "group_id"),
        ("bulk_upload_batches", "ix_bulk_batches_partner_id", "partner_id"),
        ("study_contents", "ix_study_contents_created_by", "created_by"),
        ("study_interactive_exercises", "ix_study_int_exercises_created_by", "created_by"),
        ("group_study_materials", "ix_gsm_assigned_by_id", "assigned_by_id"),
        ("conocer_upload_logs", "ix_upload_logs_matched_user_id", "matched_user_id"),
        ("competency_standards", "ix_cs_brand_id", "brand_id"),
        ("competency_standards", "ix_cs_created_by", "created_by"),
        ("brands", "ix_brands_created_by", "created_by"),
        ("study_interactive_exercise_steps", "ix_study_int_steps_exercise_id", "exercise_id"),
        ("study_interactive_exercise_actions", "ix_study_int_actions_step_id", "step_id"),
    ]

    for table, idx_name, col in fk_indexes:
        safe_exec(
            f"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='{idx_name}' AND object_id=OBJECT_ID('{table}')) "
            f"CREATE NONCLUSTERED INDEX [{idx_name}] ON [{table}] ([{col}])",
            f"Create {idx_name} on {table}({col})"
        )

    # ═══════════════════════════════════════════════════════
    # P0 — STEP 3: Create composite indexes
    # ═══════════════════════════════════════════════════════
    print("\n=== P0: CREATING COMPOSITE INDEXES ===")

    composite_indexes = [
        ("results", "ix_results_user_cs", "user_id, competency_standard_id"),
        ("balance_transactions", "ix_balance_trans_coord_created", "coordinator_id, created_at"),
        ("certificate_requests", "ix_cert_req_campus_status", "campus_id, status"),
        ("payments", "ix_payments_user_created", "user_id, created_at"),
        ("group_members", "ix_group_members_group_status", "group_id, status"),
        ("activity_logs", "ix_activity_logs_user_created", "user_id, created_at"),
    ]

    for table, idx_name, cols in composite_indexes:
        safe_exec(
            f"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='{idx_name}' AND object_id=OBJECT_ID('{table}')) "
            f"CREATE NONCLUSTERED INDEX [{idx_name}] ON [{table}] ([{cols.replace(', ', '], [')}])",
            f"Create composite {idx_name} on {table}({cols})"
        )

    # ═══════════════════════════════════════════════════════
    # P1 — STEP 4: Indexes on WHERE columns
    # ═══════════════════════════════════════════════════════
    print("\n=== P1: CREATING WHERE COLUMN INDEXES ===")

    where_indexes = [
        ("results", "ix_results_pdf_status", "pdf_status"),
        ("vouchers", "ix_vouchers_status", "status"),
        ("vouchers", "ix_vouchers_is_active", "is_active"),
        ("badge_templates", "ix_badge_templates_is_active", "is_active"),
        ("payments", "ix_payments_created_at", "created_at"),
        ("users", "ix_users_last_seen", "last_seen"),
        ("users", "ix_users_assigned_state", "assigned_state"),
        ("deletion_requests", "ix_deletion_req_requested_by", "requested_by"),
        ("deletion_requests", "ix_deletion_req_reviewed_by", "reviewed_by"),
        ("activity_logs", "ix_activity_logs_entity_type", "entity_type"),
    ]

    for table, idx_name, col in where_indexes:
        safe_exec(
            f"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='{idx_name}' AND object_id=OBJECT_ID('{table}')) "
            f"CREATE NONCLUSTERED INDEX [{idx_name}] ON [{table}] ([{col}])",
            f"Create {idx_name} on {table}({col})"
        )

    # ═══════════════════════════════════════════════════════
    # P1 — STEP 5: Add updated_at to tables that lack it
    # ═══════════════════════════════════════════════════════
    print("\n=== P1: ADDING MISSING updated_at COLUMNS ===")

    tables_need_updated_at = ["vouchers", "group_members"]

    for table in tables_need_updated_at:
        safe_exec(
            f"IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('{table}') AND name='updated_at') "
            f"ALTER TABLE [{table}] ADD updated_at DATETIME2 NULL DEFAULT GETUTCDATE()",
            f"Add updated_at to {table}"
        )

    # ═══════════════════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════════════════
    print("\n=== SUMMARY ===")
    cursor.execute("""
        SELECT COUNT(*) FROM sys.indexes WHERE object_id IN 
        (SELECT object_id FROM sys.tables WHERE is_ms_shipped=0) AND type > 0
    """)
    count = cursor.fetchone()[0]
    print(f"Total indexes in {database}: {count}")

    conn.close()
    print(f"\nMigration for {database} complete.")


if __name__ == '__main__':
    db = sys.argv[1] if len(sys.argv) > 1 else 'evaluaasi_dev'
    print(f"Running optimization migration on: {db}")
    run_migration(db)
