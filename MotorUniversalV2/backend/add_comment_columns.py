"""Script para agregar columnas de comentario a la tabla study_interactive_exercise_actions"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Verificar si las columnas ya existen
        result = db.session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'study_interactive_exercise_actions' 
            AND column_name = 'comment_text'
        """))
        
        if result.fetchone():
            print("Las columnas ya existen")
        else:
            # Agregar columnas
            db.session.execute(text("ALTER TABLE study_interactive_exercise_actions ADD COLUMN IF NOT EXISTS comment_text TEXT"))
            db.session.execute(text("ALTER TABLE study_interactive_exercise_actions ADD COLUMN IF NOT EXISTS comment_bg_color VARCHAR(20) DEFAULT '#fef3c7'"))
            db.session.execute(text("ALTER TABLE study_interactive_exercise_actions ADD COLUMN IF NOT EXISTS comment_text_color VARCHAR(20) DEFAULT '#92400e'"))
            db.session.execute(text("ALTER TABLE study_interactive_exercise_actions ADD COLUMN IF NOT EXISTS comment_font_size INTEGER DEFAULT 14"))
            db.session.execute(text("ALTER TABLE study_interactive_exercise_actions ADD COLUMN IF NOT EXISTS pointer_x FLOAT"))
            db.session.execute(text("ALTER TABLE study_interactive_exercise_actions ADD COLUMN IF NOT EXISTS pointer_y FLOAT"))
            db.session.commit()
            print("Columnas agregadas exitosamente")
    except Exception as e:
        print(f"Error: {e}")
        db.session.rollback()
