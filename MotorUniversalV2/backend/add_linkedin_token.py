"""Add linkedin_token column to users table"""
import pyodbc
import os

def get_connection(database):
    server = os.environ.get('DB_SERVER', 'evaluaasi-motorv2-sql.database.windows.net')
    user = os.environ.get('DB_USER', 'evaluaasi_admin')
    password = os.environ.get('DB_PASSWORD', 'EvalAasi2024_newpwd!')
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server};DATABASE={database};"
        f"UID={user};PWD={password};"
        f"TrustServerCertificate=yes"
    )
    return pyodbc.connect(conn_str)

def add_column(database):
    conn = get_connection(database)
    cursor = conn.cursor()
    # Check if column exists
    cursor.execute("""
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'linkedin_token'
    """)
    if cursor.fetchone()[0] == 0:
        cursor.execute("ALTER TABLE users ADD linkedin_token NVARCHAR(2000) NULL")
        conn.commit()
        print(f"[{database}] linkedin_token column added")
    else:
        print(f"[{database}] linkedin_token column already exists")
    conn.close()

if __name__ == '__main__':
    for db_name in ['evaluaasi_dev', 'evaluaasi']:
        try:
            add_column(db_name)
        except Exception as e:
            print(f"[{db_name}] Error: {e}")
