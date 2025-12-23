#!/usr/bin/env python3
"""
Auto-migración: Agregar columnas faltantes a exercise_actions si no existen
Este script se ejecuta automáticamente al iniciar el backend
"""
from app import db
from sqlalchemy import text, inspect

def check_and_add_columns():
    """Verificar y agregar columnas faltantes a exercise_actions"""
    print("🔍 Verificando esquema de exercise_actions...")
    
    # Columnas que deben existir
    required_columns = {
        'scoring_mode': "VARCHAR(20) DEFAULT 'exact'",
        'on_error_action': "VARCHAR(20) DEFAULT 'next_step'",
        'error_message': "TEXT",
        'max_attempts': "INT DEFAULT 3",
        'text_color': "VARCHAR(20) DEFAULT '#000000'",
        'font_family': "VARCHAR(50) DEFAULT 'Arial'"
    }
    
    try:
        # Obtener columnas existentes
        inspector = inspect(db.engine)
        existing_columns = [col['name'] for col in inspector.get_columns('exercise_actions')]
        
        added_count = 0
        skipped_count = 0
        
        for column_name, column_def in required_columns.items():
            if column_name not in existing_columns:
                print(f"  📝 Agregando columna: {column_name}...")
                try:
                    sql = f"ALTER TABLE exercise_actions ADD {column_name} {column_def}"
                    db.session.execute(text(sql))
                    db.session.commit()
                    print(f"     ✓ Columna {column_name} agregada")
                    added_count += 1
                except Exception as e:
                    if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                        print(f"     ⚠️  Columna {column_name} ya existe")
                        skipped_count += 1
                    else:
                        print(f"     ❌ Error al agregar {column_name}: {e}")
                        raise
            else:
                skipped_count += 1
        
        if added_count > 0:
            print(f"\n✅ Auto-migración completada: {added_count} columnas agregadas, {skipped_count} ya existían")
        else:
            print(f"✅ Esquema actualizado: todas las columnas ya existen ({skipped_count}/6)")
                
    except Exception as e:
        print(f"❌ Error en auto-migración: {e}")
        # No lanzar error para no impedir que el backend arranque
        pass
