"""Fix missing columns in PROD badge_templates table."""
import pymssql

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi'
)
cursor = conn.cursor()

# Check existing columns
cursor.execute("""
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'badge_templates'
    ORDER BY ORDINAL_POSITION
""")
existing = [r[0] for r in cursor.fetchall()]
print("Existing columns:", existing)

# Add missing columns
missing_cols = {
    'criteria_url': 'NVARCHAR(500) NULL',
}

for col, dtype in missing_cols.items():
    if col not in existing:
        try:
            cursor.execute(f"ALTER TABLE badge_templates ADD {col} {dtype}")
            conn.commit()
            print(f"  [OK] Added {col}")
        except Exception as e:
            conn.rollback()
            print(f"  [ERR] {col}: {e}")
    else:
        print(f"  [SKIP] {col} already exists")

conn.close()
print("Done.")
