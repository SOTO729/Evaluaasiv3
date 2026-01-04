#!/usr/bin/env python3
"""
Script para agregar la columna label_style a la tabla study_interactive_exercise_actions
"""
import os
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

# Get database URL from environment or use default
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://evaluaasi:evaluaasi_dev_2024@localhost:5432/evaluaasi_dev')

def run_migration():
    print(f"Connecting to database...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'study_interactive_exercise_actions' 
            AND column_name = 'label_style'
        """))
        
        if result.fetchone():
            print("Column 'label_style' already exists. Skipping.")
            return
        
        # Add the column
        print("Adding column 'label_style'...")
        conn.execute(text("""
            ALTER TABLE study_interactive_exercise_actions 
            ADD COLUMN label_style VARCHAR(20) DEFAULT 'text_with_shadow'
        """))
        conn.commit()
        print("Migration completed successfully!")

if __name__ == '__main__':
    run_migration()
