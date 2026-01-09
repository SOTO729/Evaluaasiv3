#!/usr/bin/env python3
"""
Script para agregar la columna type a las tablas exercises y questions
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
        # Check if column already exists in exercises table (SQL Server syntax)
        result = conn.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'exercises' 
            AND COLUMN_NAME = 'type'
        """))
        
        if result.fetchone():
            print("Column 'type' already exists in exercises table. Skipping.")
        else:
            # Add the column to exercises (SQL Server syntax)
            print("Adding column 'type' to exercises table...")
            conn.execute(text("""
                ALTER TABLE exercises 
                ADD type VARCHAR(20) NOT NULL DEFAULT 'exam'
            """))
            conn.commit()
            print("Column 'type' added to exercises successfully!")
        
        # Check if column already exists in questions table
        result = conn.execute(text("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'questions' 
            AND COLUMN_NAME = 'type'
        """))
        
        if result.fetchone():
            print("Column 'type' already exists in questions table. Skipping.")
        else:
            # Add the column to questions (SQL Server syntax)
            print("Adding column 'type' to questions table...")
            conn.execute(text("""
                ALTER TABLE questions 
                ADD type VARCHAR(20) NOT NULL DEFAULT 'exam'
            """))
            conn.commit()
            print("Column 'type' added to questions successfully!")
        
        print("Migration completed successfully!")

if __name__ == '__main__':
    run_migration()
