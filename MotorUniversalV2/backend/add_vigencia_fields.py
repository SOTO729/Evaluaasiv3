"""
Migration: Add vigencia (validity) fields to GroupExam, GroupStudyMaterial, and EcmCandidateAssignment.

- validity_months: integer, months of validity from assigned_at
- expires_at: datetime, calculated expiration date (assigned_at + validity_months)
- extended_months: integer, additional months added by admin/coordinator (default 0)

The effective expiration is: assigned_at + validity_months + extended_months
"""

import pyodbc
import os

def run_migration():
    server = os.environ.get('DB_SERVER', 'evaluaasi-motorv2-sql.database.windows.net')
    database = os.environ.get('DB_NAME', 'evaluaasi')
    username = os.environ.get('DB_USER', 'evaluaasi_admin')
    password = os.environ.get('DB_PASSWORD', 'EvalAasi2024_newpwd!')
    
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    migrations = [
        # ===== GroupExam (group_exams) =====
        # validity_months: inherited from group/campus config at creation time
        ("group_exams", "validity_months", "ALTER TABLE group_exams ADD validity_months INT NULL"),
        # expires_at: pre-calculated expiration datetime
        ("group_exams", "expires_at", "ALTER TABLE group_exams ADD expires_at DATETIME2 NULL"),
        # extended_months: additional months granted by admin/coordinator
        ("group_exams", "extended_months", "ALTER TABLE group_exams ADD extended_months INT DEFAULT 0 NOT NULL"),
        
        # ===== EcmCandidateAssignment (ecm_candidate_assignments) =====
        # validity_months: snapshot of validity at assignment time
        ("ecm_candidate_assignments", "validity_months", "ALTER TABLE ecm_candidate_assignments ADD validity_months INT NULL"),
        # expires_at: pre-calculated expiration datetime
        ("ecm_candidate_assignments", "expires_at", "ALTER TABLE ecm_candidate_assignments ADD expires_at DATETIME2 NULL"),
        # extended_months: additional months granted by admin/coordinator
        ("ecm_candidate_assignments", "extended_months", "ALTER TABLE ecm_candidate_assignments ADD extended_months INT DEFAULT 0 NOT NULL"),
        
        # ===== GroupStudyMaterial (group_study_materials) =====
        # validity_months: inherited from group/campus config at creation time
        ("group_study_materials", "validity_months", "ALTER TABLE group_study_materials ADD validity_months INT NULL"),
        # expires_at: pre-calculated expiration datetime
        ("group_study_materials", "expires_at", "ALTER TABLE group_study_materials ADD expires_at DATETIME2 NULL"),
        # extended_months: additional months granted by admin/coordinator
        ("group_study_materials", "extended_months", "ALTER TABLE group_study_materials ADD extended_months INT DEFAULT 0 NOT NULL"),
    ]
    
    for table, column, sql in migrations:
        try:
            # Check if column exists
            cursor.execute(f"""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '{table}' AND COLUMN_NAME = '{column}'
            """)
            exists = cursor.fetchone()[0]
            
            if exists:
                print(f"  ✓ {table}.{column} already exists, skipping")
            else:
                cursor.execute(sql)
                conn.commit()
                print(f"  ✓ Added {table}.{column}")
        except Exception as e:
            print(f"  ✗ Error adding {table}.{column}: {e}")
            conn.rollback()
    
    # Now backfill existing assignments with calculated expires_at
    # For existing GroupExams: use the group's effective config
    print("\n--- Backfilling existing assignments ---")
    try:
        cursor.execute("""
            UPDATE ge
            SET ge.validity_months = COALESCE(cg.assignment_validity_months_override, c.assignment_validity_months, 12),
                ge.expires_at = DATEADD(
                    MONTH, 
                    COALESCE(cg.assignment_validity_months_override, c.assignment_validity_months, 12),
                    ge.assigned_at
                )
            FROM group_exams ge
            JOIN candidate_groups cg ON cg.id = ge.group_id
            LEFT JOIN campuses c ON c.id = cg.campus_id
            WHERE ge.validity_months IS NULL
        """)
        rows = cursor.rowcount
        conn.commit()
        print(f"  ✓ Backfilled {rows} group_exams with validity")
    except Exception as e:
        print(f"  ✗ Error backfilling group_exams: {e}")
        conn.rollback()
    
    # For existing EcmCandidateAssignment: use group_exam's validity or campus config
    try:
        cursor.execute("""
            UPDATE eca
            SET eca.validity_months = COALESCE(ge.validity_months, 
                                               COALESCE(cg.assignment_validity_months_override, c.assignment_validity_months, 12)),
                eca.expires_at = DATEADD(
                    MONTH, 
                    COALESCE(ge.validity_months, 
                             COALESCE(cg.assignment_validity_months_override, c.assignment_validity_months, 12)),
                    eca.assigned_at
                )
            FROM ecm_candidate_assignments eca
            LEFT JOIN group_exams ge ON ge.id = eca.group_exam_id
            LEFT JOIN candidate_groups cg ON cg.id = eca.group_id
            LEFT JOIN campuses c ON c.id = eca.campus_id
            WHERE eca.validity_months IS NULL
        """)
        rows = cursor.rowcount
        conn.commit()
        print(f"  ✓ Backfilled {rows} ecm_candidate_assignments with validity")
    except Exception as e:
        print(f"  ✗ Error backfilling ecm_candidate_assignments: {e}")
        conn.rollback()
    
    # For existing GroupStudyMaterial: use group config
    try:
        cursor.execute("""
            UPDATE gsm
            SET gsm.validity_months = COALESCE(cg.assignment_validity_months_override, c.assignment_validity_months, 12),
                gsm.expires_at = DATEADD(
                    MONTH, 
                    COALESCE(cg.assignment_validity_months_override, c.assignment_validity_months, 12),
                    gsm.assigned_at
                )
            FROM group_study_materials gsm
            JOIN candidate_groups cg ON cg.id = gsm.group_id
            LEFT JOIN campuses c ON c.id = cg.campus_id
            WHERE gsm.validity_months IS NULL
        """)
        rows = cursor.rowcount
        conn.commit()
        print(f"  ✓ Backfilled {rows} group_study_materials with validity")
    except Exception as e:
        print(f"  ✗ Error backfilling group_study_materials: {e}")
        conn.rollback()
    
    cursor.close()
    conn.close()
    print("\n✅ Migration completed!")


if __name__ == '__main__':
    run_migration()
