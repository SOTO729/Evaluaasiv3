#!/usr/bin/env python3
"""
Script para agregar la columna pause_on_disconnect a la tabla exams
"""
import os
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

# Get database URL from environment or use default
DATABASE_URL = os.getenv('DATABASE_URL', 'mssql+pymssql://evaluaasi_admin:EvalAasi2024_c949de16dad23b6d@evaluaasi-motorv2-sql.database.windows.net:1433/evaluaasi?charset=utf8')

def run_migration():
    print(f"Connecting to database...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if column already exists in exams table (SQL Server syntax)
        result = conn.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'exams' 
            AND COLUMN_NAME = 'pause_on_disconnect'
        """))
        
        if result.fetchone():
            print("Column 'pause_on_disconnect' already exists in exams table. Skipping.")
        else:
            # Add the column to exams (SQL Server syntax)
            print("Adding column 'pause_on_disconnect' to exams table...")
            conn.execute(text("""
                ALTER TABLE exams 
                ADD pause_on_disconnect BIT NOT NULL DEFAULT 1
            """))
            conn.commit()
            print("Column 'pause_on_disconnect' added to exams successfully!")
        
        print("Migration completed successfully!")

if __name__ == '__main__':
    run_migration()
