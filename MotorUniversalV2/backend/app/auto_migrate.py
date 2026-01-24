#!/usr/bin/env python3
"""
Auto-migración: Agregar columnas faltantes a exercise_actions y study_interactive_exercise_actions si no existen
Este script se ejecuta automáticamente al iniciar el backend
"""
from app import db
from sqlalchemy import text, inspect

def check_and_add_study_interactive_columns():
    """Verificar y agregar columnas faltantes a study_interactive_exercise_actions"""
    print("🔍 Verificando esquema de study_interactive_exercise_actions...")
    
    # Columnas que deben existir para study_interactive_exercise_actions
    required_columns = {
        'label_style': "VARCHAR(20) DEFAULT 'invisible'"
    }
    
    try:
        # Verificar si la tabla existe
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'study_interactive_exercise_actions' not in tables:
            print("  ⚠️  Tabla study_interactive_exercise_actions no existe, saltando...")
            return
        
        # Obtener columnas existentes
        existing_columns = [col['name'] for col in inspector.get_columns('study_interactive_exercise_actions')]
        
        added_count = 0
        skipped_count = 0
        
        for column_name, column_def in required_columns.items():
            if column_name not in existing_columns:
                print(f"  📝 [study_interactive] Agregando columna: {column_name}...")
                try:
                    sql = f"ALTER TABLE study_interactive_exercise_actions ADD {column_name} {column_def}"
                    db.session.execute(text(sql))
                    db.session.commit()
                    print(f"     ✓ Columna {column_name} agregada a study_interactive_exercise_actions")
                    added_count += 1
                except Exception as e:
                    if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                        print(f"     ⚠️  Columna {column_name} ya existe")
                        skipped_count += 1
                    else:
                        print(f"     ❌ Error al agregar {column_name}: {e}")
                        db.session.rollback()
            else:
                print(f"  ✓ Columna {column_name} ya existe en study_interactive_exercise_actions")
                skipped_count += 1
        
        if added_count > 0:
            print(f"\n✅ Auto-migración study_interactive completada: {added_count} columnas agregadas")
        else:
            print(f"✅ Esquema study_interactive actualizado: todas las columnas ya existen ({skipped_count}/{len(required_columns)})")
                
    except Exception as e:
        print(f"❌ Error en auto-migración study_interactive: {e}")
        db.session.rollback()

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
        'font_family': "VARCHAR(50) DEFAULT 'Arial'",
        'label_style': "VARCHAR(20) DEFAULT 'invisible'"
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


def check_and_add_answers_columns():
    """Verificar y agregar columnas faltantes a answers (para drag_drop y column_grouping)"""
    print("🔍 Verificando esquema de answers...")
    
    # Columnas que deben existir
    required_columns = {
        'correct_answer': "VARCHAR(100)"  # Para drag_drop: zona correcta, para column_grouping: columna correcta
    }
    
    try:
        # Verificar si la tabla existe
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'answers' not in tables:
            print("  ⚠️  Tabla answers no existe, saltando...")
            return
        
        # Obtener columnas existentes
        existing_columns = [col['name'] for col in inspector.get_columns('answers')]
        
        added_count = 0
        skipped_count = 0
        
        for column_name, column_def in required_columns.items():
            if column_name not in existing_columns:
                print(f"  📝 [answers] Agregando columna: {column_name}...")
                try:
                    sql = f"ALTER TABLE answers ADD {column_name} {column_def}"
                    db.session.execute(text(sql))
                    db.session.commit()
                    print(f"     ✓ Columna {column_name} agregada a answers")
                    added_count += 1
                except Exception as e:
                    if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                        print(f"     ⚠️  Columna {column_name} ya existe")
                        skipped_count += 1
                    else:
                        print(f"     ❌ Error al agregar {column_name}: {e}")
                        db.session.rollback()
            else:
                print(f"  ✓ Columna {column_name} ya existe en answers")
                skipped_count += 1
        
        if added_count > 0:
            print(f"\n✅ Auto-migración answers completada: {added_count} columnas agregadas")
        else:
            print(f"✅ Esquema answers actualizado: todas las columnas ya existen ({skipped_count}/{len(required_columns)})")
                
    except Exception as e:
        print(f"❌ Error en auto-migración answers: {e}")
        db.session.rollback()


def check_and_add_question_types():
    """Verificar y agregar tipos de pregunta faltantes"""
    print("🔍 Verificando tipos de pregunta...")
    
    # Tipos de pregunta que deben existir
    required_types = [
        {'name': 'column_grouping', 'description': 'Agrupamiento en columnas'},
        {'name': 'fill_blank_drag', 'description': 'Completar espacios arrastrando'}
    ]
    
    try:
        # Verificar si la tabla existe
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'question_types' not in tables:
            print("  ⚠️  Tabla question_types no existe, saltando...")
            return
        
        added_count = 0
        
        for qt in required_types:
            # Verificar si el tipo ya existe
            result = db.session.execute(
                text("SELECT id FROM question_types WHERE name = :name"),
                {'name': qt['name']}
            ).fetchone()
            
            if not result:
                print(f"  📝 Agregando tipo de pregunta: {qt['name']}...")
                try:
                    db.session.execute(
                        text("INSERT INTO question_types (name, description) VALUES (:name, :description)"),
                        {'name': qt['name'], 'description': qt['description']}
                    )
                    db.session.commit()
                    print(f"     ✓ Tipo {qt['name']} agregado")
                    added_count += 1
                except Exception as e:
                    print(f"     ❌ Error al agregar {qt['name']}: {e}")
                    db.session.rollback()
            else:
                print(f"  ✓ Tipo {qt['name']} ya existe (ID: {result[0]})")
        
        if added_count > 0:
            print(f"\n✅ Auto-migración question_types completada: {added_count} tipos agregados")
        else:
            print(f"✅ Tipos de pregunta actualizados: todos ya existen")
                
    except Exception as e:
        print(f"❌ Error en auto-migración question_types: {e}")
        db.session.rollback()
