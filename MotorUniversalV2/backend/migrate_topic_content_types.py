"""Migration to add allow_* columns to study_topics table"""
import pymssql
import os

# Database connection details
server = "evaluaasi-motorv2-sql.database.windows.net"
database = "evaluaasi"
username = "evaluaasi_admin"
password = "EvalAasi2024_c949de16dad23b6d"

try:
    conn = pymssql.connect(server=server, user=username, password=password, database=database)
    cursor = conn.cursor()
    
    # Add new columns to study_topics table
    columns_to_add = [
        ("allow_reading", "BIT", "1"),
        ("allow_video", "BIT", "1"),
        ("allow_downloadable", "BIT", "1"),
        ("allow_interactive", "BIT", "1"),
    ]
    
    for col_name, col_type, default_value in columns_to_add:
        try:
            cursor.execute(f"""
                IF NOT EXISTS (
                    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'study_topics' AND COLUMN_NAME = '{col_name}'
                )
                BEGIN
                    ALTER TABLE study_topics ADD {col_name} {col_type} DEFAULT {default_value}
                END
            """)
            print(f"✓ Column {col_name} added/verified in study_topics")
        except Exception as e:
            print(f"✗ Error with column {col_name}: {e}")
    
    conn.commit()
    print("\n✓ Migration completed successfully!")
    
except Exception as e:
    print(f"✗ Connection error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
