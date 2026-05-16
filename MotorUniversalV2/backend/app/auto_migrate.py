#!/usr/bin/env python3
"""
Auto-migración: Agregar columnas faltantes a exercise_actions y study_interactive_exercise_actions si no existen
Este script se ejecuta automáticamente al iniciar el backend
Compatible con PostgreSQL y SQL Server
"""
from app import db
from sqlalchemy import text, inspect
from datetime import datetime

def get_db_type():
    """Detectar el tipo de base de datos"""
    db_url = str(db.engine.url)
    if 'postgresql' in db_url or 'postgres' in db_url:
        return 'postgresql'
    elif 'mssql' in db_url or 'sqlserver' in db_url:
        return 'mssql'
    else:
        return 'sqlite'

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
    # Nota: drag_drop ahora usa la lógica de espacios en blanco (fill_blank_drag fue fusionado)
    required_types = [
        # column_grouping ha sido eliminado
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


def check_and_add_percentage_columns():
    """Verificar y agregar columnas de porcentaje a questions y exercises"""
    print("🔍 Verificando columnas de porcentaje...")
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        # Agregar percentage a questions
        if 'questions' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('questions')]
            if 'percentage' not in existing_columns:
                print("  📝 Agregando columna 'percentage' a 'questions'...")
                db.session.execute(text("ALTER TABLE questions ADD percentage FLOAT DEFAULT 0"))
                db.session.commit()
                print("     ✓ Columna 'percentage' agregada a 'questions'")
            else:
                print("  ✓ Columna 'percentage' ya existe en 'questions'")
        
        # Agregar percentage a exercises
        if 'exercises' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('exercises')]
            if 'percentage' not in existing_columns:
                print("  📝 Agregando columna 'percentage' a 'exercises'...")
                db.session.execute(text("ALTER TABLE exercises ADD percentage FLOAT DEFAULT 0"))
                db.session.commit()
                print("     ✓ Columna 'percentage' agregada a 'exercises'")
            else:
                print("  ✓ Columna 'percentage' ya existe en 'exercises'")
        
        # Agregar percentage a topics
        if 'topics' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('topics')]
            if 'percentage' not in existing_columns:
                print("  📝 Agregando columna 'percentage' a 'topics'...")
                db.session.execute(text("ALTER TABLE topics ADD percentage FLOAT DEFAULT 0"))
                db.session.commit()
                print("     ✓ Columna 'percentage' agregada a 'topics'")
            else:
                print("  ✓ Columna 'percentage' ya existe en 'topics'")
        
        print("✅ Verificación de columnas de porcentaje completada")
                
    except Exception as e:
        print(f"❌ Error en auto-migración de porcentajes: {e}")
        db.session.rollback()


def check_and_add_group_exam_columns():
    """Verificar y agregar columnas a group_exams y crear tabla group_exam_members"""
    print("🔍 Verificando esquema de group_exams...")
    
    db_type = get_db_type()
    print(f"  📊 Tipo de base de datos detectado: {db_type}")
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        # 1. Agregar columnas a group_exams si no existen
        if 'group_exams' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('group_exams')]
            
            # Lista de columnas a agregar (sintaxis compatible con PostgreSQL)
            if db_type == 'postgresql':
                columns_to_add = [
                    ('assignment_type', "VARCHAR(20) DEFAULT 'all' NOT NULL"),
                    ('time_limit_minutes', "INTEGER NULL"),
                    ('passing_score', "INTEGER NULL"),
                    ('max_attempts', "INTEGER DEFAULT 1 NOT NULL"),
                    ('max_disconnections', "INTEGER DEFAULT 3 NOT NULL"),
                    ('exam_content_type', "VARCHAR(30) DEFAULT 'questions_only' NOT NULL"),
                    ('exam_questions_count', "INTEGER NULL"),
                    ('exam_exercises_count', "INTEGER NULL"),
                    ('simulator_questions_count', "INTEGER NULL"),
                    ('simulator_exercises_count', "INTEGER NULL"),
                    ('security_pin', "VARCHAR(10) NULL"),
                    ('require_security_pin', "BOOLEAN DEFAULT FALSE NOT NULL"),
                ]
            else:
                columns_to_add = [
                    ('assignment_type', "NVARCHAR(20) DEFAULT 'all' NOT NULL"),
                    ('time_limit_minutes', "INT NULL"),
                    ('passing_score', "INT NULL"),
                    ('max_attempts', "INT DEFAULT 1 NOT NULL"),
                    ('max_disconnections', "INT DEFAULT 3 NOT NULL"),
                    ('exam_content_type', "NVARCHAR(30) DEFAULT 'questions_only' NOT NULL"),
                    ('exam_questions_count', "INT NULL"),
                    ('exam_exercises_count', "INT NULL"),
                    ('simulator_questions_count', "INT NULL"),
                    ('simulator_exercises_count', "INT NULL"),
                    ('security_pin', "NVARCHAR(10) NULL"),
                    ('require_security_pin', "BIT DEFAULT 0 NOT NULL"),
                ]
            
            for col_name, col_definition in columns_to_add:
                if col_name not in existing_columns:
                    print(f"  📝 Agregando columna '{col_name}' a 'group_exams'...")
                    try:
                        if db_type == 'postgresql':
                            db.session.execute(text(f"""
                                ALTER TABLE group_exams 
                                ADD COLUMN IF NOT EXISTS {col_name} {col_definition}
                            """))
                        else:
                            db.session.execute(text(f"""
                                ALTER TABLE group_exams 
                                ADD {col_name} {col_definition}
                            """))
                        db.session.commit()
                        print(f"     ✓ Columna '{col_name}' agregada a 'group_exams'")
                    except Exception as e:
                        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                            print(f"     ⚠️  Columna '{col_name}' ya existe")
                        else:
                            print(f"     ⚠️  Error agregando '{col_name}': {e}")
                            db.session.rollback()
                else:
                    print(f"  ✓ Columna '{col_name}' ya existe en 'group_exams'")
        
        # 2. Crear tabla group_exam_members si no existe
        if 'group_exam_members' not in tables:
            print("  📝 Creando tabla 'group_exam_members'...")
            try:
                if db_type == 'postgresql':
                    db.session.execute(text("""
                        CREATE TABLE IF NOT EXISTS group_exam_members (
                            id SERIAL PRIMARY KEY,
                            group_exam_id INTEGER NOT NULL,
                            user_id VARCHAR(36) NOT NULL,
                            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            CONSTRAINT fk_gem_group_exam FOREIGN KEY (group_exam_id) 
                                REFERENCES group_exams(id) ON DELETE CASCADE,
                            CONSTRAINT fk_gem_user FOREIGN KEY (user_id) 
                                REFERENCES users(id) ON DELETE CASCADE,
                            CONSTRAINT uq_gem_group_exam_user UNIQUE (group_exam_id, user_id)
                        )
                    """))
                else:
                    db.session.execute(text("""
                        CREATE TABLE group_exam_members (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            group_exam_id INT NOT NULL,
                            user_id NVARCHAR(36) NOT NULL,
                            assigned_at DATETIME DEFAULT GETDATE() NOT NULL,
                            CONSTRAINT fk_gem_group_exam FOREIGN KEY (group_exam_id) 
                                REFERENCES group_exams(id) ON DELETE CASCADE,
                            CONSTRAINT fk_gem_user FOREIGN KEY (user_id) 
                                REFERENCES users(id) ON DELETE CASCADE,
                            CONSTRAINT uq_gem_group_exam_user UNIQUE (group_exam_id, user_id)
                        )
                    """))
                db.session.commit()
                print("     ✓ Tabla 'group_exam_members' creada exitosamente")
            except Exception as e:
                if 'already exists' in str(e).lower():
                    print("     ⚠️  Tabla 'group_exam_members' ya existe")
                else:
                    print(f"     ⚠️  Error creando tabla: {e}")
                    db.session.rollback()
        else:
            print("  ✓ Tabla 'group_exam_members' ya existe")
        
        # 3. Crear tabla group_study_materials si no existe
        if 'group_study_materials' not in tables:
            print("  📝 Creando tabla 'group_study_materials'...")
            try:
                if db_type == 'postgresql':
                    db.session.execute(text("""
                        CREATE TABLE IF NOT EXISTS group_study_materials (
                            id SERIAL PRIMARY KEY,
                            group_id INTEGER NOT NULL,
                            study_material_id INTEGER NOT NULL,
                            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            assigned_by_id VARCHAR(36) NULL,
                            available_from TIMESTAMP NULL,
                            available_until TIMESTAMP NULL,
                            assignment_type VARCHAR(20) DEFAULT 'all' NOT NULL,
                            is_active BOOLEAN DEFAULT TRUE NOT NULL,
                            CONSTRAINT fk_gsm_group FOREIGN KEY (group_id) 
                                REFERENCES candidate_groups(id) ON DELETE CASCADE,
                            CONSTRAINT fk_gsm_material FOREIGN KEY (study_material_id) 
                                REFERENCES study_contents(id) ON DELETE CASCADE,
                            CONSTRAINT fk_gsm_user FOREIGN KEY (assigned_by_id) 
                                REFERENCES users(id),
                            CONSTRAINT uq_group_study_material UNIQUE (group_id, study_material_id)
                        )
                    """))
                else:
                    db.session.execute(text("""
                        CREATE TABLE group_study_materials (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            group_id INT NOT NULL,
                            study_material_id INT NOT NULL,
                            assigned_at DATETIME DEFAULT GETDATE() NOT NULL,
                            assigned_by_id NVARCHAR(36) NULL,
                            available_from DATETIME NULL,
                            available_until DATETIME NULL,
                            assignment_type NVARCHAR(20) DEFAULT 'all' NOT NULL,
                            is_active BIT DEFAULT 1 NOT NULL,
                            CONSTRAINT fk_gsm_group FOREIGN KEY (group_id) 
                                REFERENCES candidate_groups(id) ON DELETE CASCADE,
                            CONSTRAINT fk_gsm_material FOREIGN KEY (study_material_id) 
                                REFERENCES study_contents(id) ON DELETE CASCADE,
                            CONSTRAINT fk_gsm_user FOREIGN KEY (assigned_by_id) 
                                REFERENCES users(id),
                            CONSTRAINT uq_group_study_material UNIQUE (group_id, study_material_id)
                        )
                    """))
                db.session.commit()
                print("     ✓ Tabla 'group_study_materials' creada exitosamente")
            except Exception as e:
                if 'already exists' in str(e).lower():
                    print("     ⚠️  Tabla 'group_study_materials' ya existe")
                else:
                    print(f"     ⚠️  Error creando tabla: {e}")
                    db.session.rollback()
        else:
            print("  ✓ Tabla 'group_study_materials' ya existe")
        
        # 4. Crear tabla group_study_material_members si no existe
        if 'group_study_material_members' not in tables:
            print("  📝 Creando tabla 'group_study_material_members'...")
            try:
                if db_type == 'postgresql':
                    db.session.execute(text("""
                        CREATE TABLE IF NOT EXISTS group_study_material_members (
                            id SERIAL PRIMARY KEY,
                            group_study_material_id INTEGER NOT NULL,
                            user_id VARCHAR(36) NOT NULL,
                            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            CONSTRAINT fk_gsmm_group_material FOREIGN KEY (group_study_material_id) 
                                REFERENCES group_study_materials(id) ON DELETE CASCADE,
                            CONSTRAINT fk_gsmm_user FOREIGN KEY (user_id) 
                                REFERENCES users(id) ON DELETE CASCADE,
                            CONSTRAINT uq_group_study_material_member UNIQUE (group_study_material_id, user_id)
                        )
                    """))
                else:
                    db.session.execute(text("""
                        CREATE TABLE group_study_material_members (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            group_study_material_id INT NOT NULL,
                            user_id NVARCHAR(36) NOT NULL,
                            assigned_at DATETIME DEFAULT GETDATE() NOT NULL,
                            CONSTRAINT fk_gsmm_group_material FOREIGN KEY (group_study_material_id) 
                                REFERENCES group_study_materials(id) ON DELETE CASCADE,
                            CONSTRAINT fk_gsmm_user FOREIGN KEY (user_id) 
                                REFERENCES users(id) ON DELETE CASCADE,
                            CONSTRAINT uq_group_study_material_member UNIQUE (group_study_material_id, user_id)
                        )
                    """))
                db.session.commit()
                print("     ✓ Tabla 'group_study_material_members' creada exitosamente")
            except Exception as e:
                if 'already exists' in str(e).lower():
                    print("     ⚠️  Tabla 'group_study_material_members' ya existe")
                else:
                    print(f"     ⚠️  Error creando tabla: {e}")
                    db.session.rollback()
        else:
            print("  ✓ Tabla 'group_study_material_members' ya existe")
        
        print("✅ Verificación de esquema group_exams completada")
                
    except Exception as e:
        print(f"❌ Error en auto-migración de group_exams: {e}")
        db.session.rollback()


def check_and_add_campus_activation_columns():
    """Verificar y agregar columnas para activación de planteles y responsables"""
    print("🔍 Verificando esquema de usuarios y planteles (activación)...")
    
    db_type = get_db_type()
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        # ============== USUARIOS - Nuevos campos ==============
        if 'users' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('users')]
            
            # Campos nuevos para usuarios
            user_columns = {
                'date_of_birth': 'DATE',
                'can_bulk_create_candidates': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'can_manage_groups': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'can_view_reports': 'BIT DEFAULT 1' if db_type == 'mssql' else 'BOOLEAN DEFAULT TRUE',
                'last_seen': 'DATETIME' if db_type == 'mssql' else 'TIMESTAMP',
            }
            
            for column_name, column_def in user_columns.items():
                if column_name not in existing_columns:
                    print(f"  📝 [users] Agregando columna: {column_name}...")
                    try:
                        sql = f"ALTER TABLE users ADD {column_name} {column_def}"
                        db.session.execute(text(sql))
                        db.session.commit()
                        print(f"     ✓ Columna {column_name} agregada a users")
                    except Exception as e:
                        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                            print(f"     ⚠️  Columna {column_name} ya existe")
                        else:
                            print(f"     ❌ Error al agregar {column_name}: {e}")
                            db.session.rollback()
                else:
                    print(f"  ✓ Columna {column_name} ya existe en users")
        
        # ============== CAMPUSES - Nuevos campos de activación ==============
        if 'campuses' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('campuses')]
            
            # Campos nuevos para campuses
            campus_columns = {
                'responsable_id': 'NVARCHAR(36)' if db_type == 'mssql' else 'VARCHAR(36)',
                'activation_status': "NVARCHAR(20) DEFAULT 'pending'" if db_type == 'mssql' else "VARCHAR(20) DEFAULT 'pending'",
                'activated_at': 'DATETIME' if db_type == 'mssql' else 'TIMESTAMP',
                'coordinator_id': 'NVARCHAR(36)' if db_type == 'mssql' else 'VARCHAR(36)',
            }
            
            for column_name, column_def in campus_columns.items():
                if column_name not in existing_columns:
                    print(f"  📝 [campuses] Agregando columna: {column_name}...")
                    try:
                        sql = f"ALTER TABLE campuses ADD {column_name} {column_def}"
                        db.session.execute(text(sql))
                        db.session.commit()
                        print(f"     ✓ Columna {column_name} agregada a campuses")
                    except Exception as e:
                        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                            print(f"     ⚠️  Columna {column_name} ya existe")
                        else:
                            print(f"     ❌ Error al agregar {column_name}: {e}")
                            db.session.rollback()
                else:
                    print(f"  ✓ Columna {column_name} ya existe en campuses")
            
            # ============== CAMPUSES - Campos de configuración del plantel ==============
            existing_columns = [col['name'] for col in inspector.get_columns('campuses')]  # Refrescar
            
            campus_config_columns = {
                # Versión de Office
                'office_version': "NVARCHAR(20) DEFAULT 'office_365'" if db_type == 'mssql' else "VARCHAR(20) DEFAULT 'office_365'",
                'office_exam_level': "NVARCHAR(20) DEFAULT 'intermedio'" if db_type == 'mssql' else "VARCHAR(20) DEFAULT 'intermedio'",
                # Tiers de certificación
                'enable_tier_basic': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'enable_tier_standard': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'enable_tier_advanced': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'enable_digital_badge': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                # Evaluaciones parciales
                'enable_partial_evaluations': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'enable_unscheduled_partials': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                # Características adicionales
                'enable_virtual_machines': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'enable_online_payments': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                # PIN de seguridad diario
                'require_exam_pin': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'daily_exam_pin': 'NVARCHAR(4) NULL' if db_type == 'mssql' else 'VARCHAR(4) NULL',
                'daily_exam_pin_date': 'DATE NULL',
                # Vigencia
                'license_start_date': 'DATE',
                'license_end_date': 'DATE',
                'assignment_validity_months': 'INT DEFAULT 12',
                # Costos
                'certification_cost': 'DECIMAL(10,2) DEFAULT 0',
                'retake_cost': 'DECIMAL(10,2) DEFAULT 0',
                'max_retakes': 'INT DEFAULT 0',
                # Estado de configuración
                'configuration_completed': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'configuration_completed_at': 'DATETIME' if db_type == 'mssql' else 'TIMESTAMP',
                # Visibilidad de certificados para candidatos
                'enable_candidate_certificates': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                # Calendario de sesiones
                'enable_session_calendar': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'session_scheduling_mode': "NVARCHAR(20) DEFAULT 'leader_only'" if db_type == 'mssql' else "VARCHAR(20) DEFAULT 'leader_only'",
                # Mapeo a EvaluaasiConfig (VDI/AD/Guacamole)
                'config_subsistema_id': 'INT NULL',
                'config_plantel_id': 'INT NULL',
                'config_certificacion_id': 'INT NULL',
                'config_etapa_id': 'INT NULL',
                # Activo
                'is_active': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                # Branding
                'logo_url': 'NVARCHAR(500) NULL' if db_type == 'mssql' else 'VARCHAR(500) NULL',
                'primary_color': 'NVARCHAR(7) NULL' if db_type == 'mssql' else 'VARCHAR(7) NULL',
                'secondary_color': 'NVARCHAR(7) NULL' if db_type == 'mssql' else 'VARCHAR(7) NULL',
            }
            
            for column_name, column_def in campus_config_columns.items():
                if column_name not in existing_columns:
                    print(f"  📝 [campuses-config] Agregando columna: {column_name}...")
                    try:
                        sql = f"ALTER TABLE campuses ADD {column_name} {column_def}"
                        db.session.execute(text(sql))
                        db.session.commit()
                        print(f"     ✓ Columna {column_name} agregada a campuses")
                    except Exception as e:
                        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                            print(f"     ⚠️  Columna {column_name} ya existe")
                        else:
                            print(f"     ❌ Error al agregar {column_name}: {e}")
                            db.session.rollback()
                else:
                    print(f"  ✓ Columna {column_name} ya existe en campuses")
            
            # Agregar foreign key para responsable_id si no existe
            if 'responsable_id' not in existing_columns:
                try:
                    print("  📝 [campuses] Agregando foreign key para responsable_id...")
                    if db_type == 'mssql':
                        sql = """
                            ALTER TABLE campuses 
                            ADD CONSTRAINT fk_campus_responsable 
                            FOREIGN KEY (responsable_id) REFERENCES users(id) ON DELETE SET NULL
                        """
                    else:
                        sql = """
                            ALTER TABLE campuses 
                            ADD CONSTRAINT fk_campus_responsable 
                            FOREIGN KEY (responsable_id) REFERENCES users(id) ON DELETE SET NULL
                        """
                    db.session.execute(text(sql))
                    db.session.commit()
                    print("     ✓ Foreign key fk_campus_responsable agregado")
                except Exception as e:
                    if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                        print("     ⚠️  Foreign key ya existe")
                    else:
                        print(f"     ⚠️  Error al agregar foreign key (no crítico): {e}")
                        db.session.rollback()
        
        print("✅ Verificación de esquema activación de planteles completada")

        # ============== BACKFILL: campus.coordinator_id desde partner ==============
        if 'campuses' in tables:
            try:
                result = db.session.execute(text(
                    "SELECT COUNT(*) FROM campuses WHERE coordinator_id IS NULL"
                )).scalar()
                if result and result > 0:
                    print(f"  📝 [campuses] Backfill coordinator_id para {result} campuses sin coordinador...")
                    db.session.execute(text("""
                        UPDATE campuses SET coordinator_id = (
                            SELECT p.coordinator_id FROM partners p WHERE p.id = campuses.partner_id
                        ) WHERE coordinator_id IS NULL AND partner_id IS NOT NULL
                    """))
                    db.session.commit()
                    print(f"     ✓ Backfill completado")
            except Exception as e:
                print(f"     ⚠️  Error en backfill coordinator_id: {e}")
                db.session.rollback()
        
        # ============== CANDIDATE_GROUPS - Campo require_exam_pin_override ==============
        if 'candidate_groups' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('candidate_groups')]
            
            group_pin_columns = {
                'require_exam_pin_override': 'BIT NULL' if db_type == 'mssql' else 'BOOLEAN NULL',
            }
            
            for column_name, column_def in group_pin_columns.items():
                if column_name not in existing_columns:
                    print(f"  📝 [candidate_groups] Agregando columna: {column_name}...")
                    try:
                        sql = f"ALTER TABLE candidate_groups ADD {column_name} {column_def}"
                        db.session.execute(text(sql))
                        db.session.commit()
                        print(f"     ✓ Columna {column_name} agregada a candidate_groups")
                    except Exception as e:
                        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                            print(f"     ⚠️  Columna {column_name} ya existe")
                        else:
                            print(f"     ❌ Error al agregar {column_name}: {e}")
                            db.session.rollback()
                else:
                    print(f"  ✓ Columna {column_name} ya existe en candidate_groups")
                
    except Exception as e:
        print(f"❌ Error en auto-migración de activación de planteles: {e}")
        db.session.rollback()


def check_and_add_eduit_certificate_code():
    """Verificar y agregar columna eduit_certificate_code a results"""
    print("🔍 Verificando columna eduit_certificate_code en results...")
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'results' not in tables:
            print("  ⚠️  Tabla results no existe, saltando...")
            return
        
        existing_columns = [col['name'] for col in inspector.get_columns('results')]
        
        if 'eduit_certificate_code' not in existing_columns:
            print("  📝 Agregando columna eduit_certificate_code...")
            try:
                db_type = get_db_type()
                if db_type == 'mssql':
                    sql = "ALTER TABLE results ADD eduit_certificate_code VARCHAR(100)"
                else:
                    sql = "ALTER TABLE results ADD COLUMN eduit_certificate_code VARCHAR(100)"
                db.session.execute(text(sql))
                db.session.commit()
                print("  ✓ Columna eduit_certificate_code agregada a results")
                
                # Agregar unique constraint
                try:
                    if db_type == 'mssql':
                        sql = "CREATE UNIQUE INDEX uq_results_eduit_certificate_code ON results(eduit_certificate_code) WHERE eduit_certificate_code IS NOT NULL"
                    else:
                        sql = "CREATE UNIQUE INDEX uq_results_eduit_certificate_code ON results(eduit_certificate_code)"
                    db.session.execute(text(sql))
                    db.session.commit()
                    print("  ✓ Unique index agregado a eduit_certificate_code")
                except Exception as e:
                    if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                        print("  ⚠️  Unique index ya existe")
                    else:
                        print(f"  ⚠️  Error al agregar unique index: {e}")
                        db.session.rollback()
                        
            except Exception as e:
                if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                    print("  ⚠️  Columna eduit_certificate_code ya existe")
                else:
                    print(f"  ❌ Error al agregar eduit_certificate_code: {e}")
                    db.session.rollback()
        else:
            print("  ✓ Columna eduit_certificate_code ya existe en results")
        
        print("✅ Verificación de eduit_certificate_code completada")
                
    except Exception as e:
        print(f"❌ Error en auto-migración de eduit_certificate_code: {e}")
        db.session.rollback()


def check_and_create_campus_competency_standards_table():
    """Verificar y crear tabla campus_competency_standards si no existe"""
    print("🔍 Verificando tabla campus_competency_standards...")
    
    db_type = get_db_type()
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'campus_competency_standards' not in tables:
            print("  📝 Creando tabla campus_competency_standards...")
            
            if db_type == 'mssql':
                sql = """
                CREATE TABLE campus_competency_standards (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    campus_id INT NOT NULL,
                    competency_standard_id INT NOT NULL,
                    is_active BIT DEFAULT 1 NOT NULL,
                    created_at DATETIME2 DEFAULT GETDATE() NOT NULL,
                    created_by NVARCHAR(36),
                    CONSTRAINT fk_ccs_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE,
                    CONSTRAINT fk_ccs_standard FOREIGN KEY (competency_standard_id) REFERENCES competency_standards(id) ON DELETE CASCADE,
                    CONSTRAINT uq_campus_competency_standard UNIQUE (campus_id, competency_standard_id)
                )
                """
            else:
                sql = """
                CREATE TABLE campus_competency_standards (
                    id SERIAL PRIMARY KEY,
                    campus_id INTEGER NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
                    competency_standard_id INTEGER NOT NULL REFERENCES competency_standards(id) ON DELETE CASCADE,
                    is_active BOOLEAN DEFAULT TRUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    created_by VARCHAR(36) REFERENCES users(id),
                    UNIQUE (campus_id, competency_standard_id)
                )
                """
            
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✓ Tabla campus_competency_standards creada exitosamente")
            
            # Crear índices
            try:
                db.session.execute(text("CREATE INDEX idx_ccs_campus ON campus_competency_standards(campus_id)"))
                db.session.execute(text("CREATE INDEX idx_ccs_standard ON campus_competency_standards(competency_standard_id)"))
                db.session.commit()
                print("  ✓ Índices creados para campus_competency_standards")
            except Exception as e:
                print(f"  ⚠️  Error creando índices (pueden ya existir): {e}")
                db.session.rollback()
        else:
            print("  ✓ Tabla campus_competency_standards ya existe")
        
        print("✅ Verificación de campus_competency_standards completada")
                
    except Exception as e:
        print(f"❌ Error en auto-migración de campus_competency_standards: {e}")
        db.session.rollback()


def check_and_create_brands_table():
    """Verificar y crear tabla brands + agregar brand_id a competency_standards"""
    print("🔍 Verificando tabla brands y columna brand_id en competency_standards...")
    
    db_type = get_db_type()
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        # 1. Crear tabla brands si no existe
        if 'brands' not in tables:
            print("  📝 Creando tabla brands...")
            
            if db_type == 'mssql':
                sql = """
                CREATE TABLE brands (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    name NVARCHAR(100) NOT NULL UNIQUE,
                    logo_url NVARCHAR(500),
                    description NVARCHAR(MAX),
                    is_active BIT DEFAULT 1 NOT NULL,
                    display_order INT DEFAULT 0,
                    created_by NVARCHAR(36),
                    created_at DATETIME2 DEFAULT GETDATE() NOT NULL,
                    updated_by NVARCHAR(36),
                    updated_at DATETIME2 DEFAULT GETDATE()
                )
                """
            else:
                sql = """
                CREATE TABLE brands (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    logo_url VARCHAR(500),
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE NOT NULL,
                    display_order INTEGER DEFAULT 0,
                    created_by VARCHAR(36) REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_by VARCHAR(36) REFERENCES users(id),
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✓ Tabla brands creada exitosamente")
            
            # Insertar marcas predeterminadas
            print("  📝 Insertando marcas predeterminadas...")
            brands_data = [
                ('Microsoft', 'Certificaciones oficiales de Microsoft', 1),
                ('Huawei', 'Certificaciones oficiales de Huawei', 2),
                ('Abierto', 'Estándares de competencia abiertos/genéricos', 3),
            ]
            for name, description, order in brands_data:
                try:
                    if db_type == 'mssql':
                        insert_sql = f"INSERT INTO brands (name, description, display_order) VALUES ('{name}', '{description}', {order})"
                    else:
                        insert_sql = f"INSERT INTO brands (name, description, display_order) VALUES ('{name}', '{description}', {order})"
                    db.session.execute(text(insert_sql))
                except Exception as e:
                    print(f"  ⚠️  Marca {name} ya existe o error: {e}")
                    db.session.rollback()
            db.session.commit()
            print("  ✓ Marcas predeterminadas insertadas: Microsoft, Huawei, Abierto")
        else:
            print("  ✓ Tabla brands ya existe")
        
        # 2. Agregar brand_id a competency_standards si no existe
        if 'competency_standards' in tables:
            existing_columns = [col['name'] for col in inspector.get_columns('competency_standards')]
            
            if 'brand_id' not in existing_columns:
                print("  📝 Agregando columna brand_id a competency_standards...")
                try:
                    if db_type == 'mssql':
                        sql = "ALTER TABLE competency_standards ADD brand_id INT"
                    else:
                        sql = "ALTER TABLE competency_standards ADD COLUMN brand_id INTEGER REFERENCES brands(id)"
                    db.session.execute(text(sql))
                    db.session.commit()
                    print("  ✓ Columna brand_id agregada a competency_standards")
                    
                    # Agregar FK para MSSQL
                    if db_type == 'mssql':
                        try:
                            db.session.execute(text(
                                "ALTER TABLE competency_standards ADD CONSTRAINT fk_cs_brand FOREIGN KEY (brand_id) REFERENCES brands(id)"
                            ))
                            db.session.commit()
                            print("  ✓ Foreign key agregada para brand_id")
                        except Exception as e:
                            print(f"  ⚠️  Error agregando FK (puede ya existir): {e}")
                            db.session.rollback()
                except Exception as e:
                    if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                        print("  ⚠️  Columna brand_id ya existe")
                    else:
                        print(f"  ❌ Error agregando brand_id: {e}")
                        db.session.rollback()
            else:
                print("  ✓ Columna brand_id ya existe en competency_standards")
        
        print("✅ Verificación de brands completada")
                
    except Exception as e:
        print(f"❌ Error en auto-migración de brands: {e}")
        db.session.rollback()


def check_and_add_competency_standard_logo_column():
    """Verificar y agregar columna logo_url a competency_standards si no existe"""
    print("🔍 Verificando columna logo_url en competency_standards...")
    
    db_type = get_db_type()
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'competency_standards' not in tables:
            print("  ⚠️  Tabla competency_standards no existe, saltando...")
            return
        
        existing_columns = [col['name'] for col in inspector.get_columns('competency_standards')]
        
        if 'logo_url' not in existing_columns:
            print("  📝 Agregando columna logo_url...")
            if db_type == 'mssql':
                sql = "ALTER TABLE competency_standards ADD logo_url NVARCHAR(500) NULL"
            else:
                sql = "ALTER TABLE competency_standards ADD COLUMN logo_url VARCHAR(500)"
            
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✓ Columna logo_url agregada exitosamente")
        else:
            print("  ✓ Columna logo_url ya existe")
        
        print("✅ Verificación de logo_url en competency_standards completada")
                
    except Exception as e:
        print(f"❌ Error en auto-migración de logo_url: {e}")
        db.session.rollback()


def check_and_make_email_nullable():
    """
    Hacer la columna email nullable en users y quitar unique constraint.
    Esto permite tener candidatos sin email (regla de negocio: email opcional para candidatos,
    pero requerido para insignias digitales).
    """
    print("🔍 Verificando constraint de email en users...")
    
    db_type = get_db_type()
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'users' not in tables:
            print("  ⚠️  Tabla users no existe, saltando...")
            return
        
        # Verificar si email es nullable actualmente
        columns = inspector.get_columns('users')
        email_col = next((c for c in columns if c['name'] == 'email'), None)
        
        if not email_col:
            print("  ⚠️  Columna email no existe, saltando...")
            return
        
        # Verificar unique constraints (pymssql no soporta get_unique_constraints)
        try:
            unique_constraints = inspector.get_unique_constraints('users')
            email_unique = any(c for c in unique_constraints if 'email' in c.get('column_names', []))
        except NotImplementedError:
            # SQL Server con pymssql no soporta get_unique_constraints
            email_unique = False
        
        # También verificar índices únicos
        try:
            indexes = inspector.get_indexes('users')
            email_unique_index = any(i for i in indexes if i.get('unique') and 'email' in i.get('column_names', []))
        except NotImplementedError:
            email_unique_index = False
        
        changes_made = False
        
        # Quitar unique constraint si existe
        if email_unique or email_unique_index:
            print("  📝 Quitando unique constraint de email...")
            if db_type == 'mssql':
                # SQL Server: buscar y eliminar constraints
                # Primero eliminar default constraint si existe
                try:
                    db.session.execute(text("""
                        DECLARE @constraint_name NVARCHAR(255)
                        SELECT @constraint_name = name FROM sys.indexes 
                        WHERE object_id = OBJECT_ID('users') AND is_unique = 1 
                        AND name LIKE '%email%'
                        IF @constraint_name IS NOT NULL
                            EXEC('ALTER TABLE users DROP CONSTRAINT [' + @constraint_name + ']')
                    """))
                    db.session.commit()
                except Exception as e:
                    print(f"  ⚠️  No se pudo quitar constraint por índice: {e}")
                    db.session.rollback()
                
                # También eliminar unique constraint si es diferente
                try:
                    db.session.execute(text("""
                        DECLARE @constraint_name NVARCHAR(255)
                        SELECT @constraint_name = name FROM sys.key_constraints 
                        WHERE parent_object_id = OBJECT_ID('users') AND type = 'UQ'
                        AND name LIKE '%email%'
                        IF @constraint_name IS NOT NULL
                            EXEC('ALTER TABLE users DROP CONSTRAINT [' + @constraint_name + ']')
                    """))
                    db.session.commit()
                except Exception as e:
                    print(f"  ⚠️  No se pudo quitar unique constraint: {e}")
                    db.session.rollback()
            else:
                # PostgreSQL/SQLite
                try:
                    db.session.execute(text("DROP INDEX IF EXISTS ix_users_email"))
                    db.session.commit()
                except Exception as e:
                    print(f"  ⚠️  No se pudo quitar índice: {e}")
                    db.session.rollback()
            
            changes_made = True
        
        # Hacer nullable si no lo es
        if email_col.get('nullable') == False:
            print("  📝 Haciendo columna email nullable...")
            if db_type == 'mssql':
                db.session.execute(text("ALTER TABLE users ALTER COLUMN email NVARCHAR(255) NULL"))
            else:
                db.session.execute(text("ALTER TABLE users ALTER COLUMN email DROP NOT NULL"))
            db.session.commit()
            changes_made = True
        
        # Recrear índice no-único para performance
        if changes_made:
            print("  📝 Recreando índice no-único para email...")
            try:
                if db_type == 'mssql':
                    db.session.execute(text("""
                        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_users_email_nonunique' AND object_id = OBJECT_ID('users'))
                            CREATE INDEX ix_users_email_nonunique ON users(email)
                    """))
                else:
                    db.session.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email_nonunique ON users(email)"))
                db.session.commit()
            except Exception as e:
                print(f"  ⚠️  No se pudo crear índice: {e}")
                db.session.rollback()
        
        if changes_made:
            print("  ✓ Email ahora es nullable y sin unique constraint")
        else:
            print("  ✓ Email ya está configurado correctamente")
        
        print("✅ Verificación de email en users completada")
                
    except Exception as e:
        print(f"❌ Error en auto-migración de email: {e}")
        import traceback
        traceback.print_exc()
        db.session.rollback()


def check_and_add_balance_attachments_column():
    """Verificar y agregar columna attachments a balance_requests"""
    print("🔍 Verificando columna attachments en balance_requests...")
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'balance_requests' not in tables:
            print("  ⚠️  Tabla balance_requests no existe, saltando...")
            return
        
        columns = [col['name'] for col in inspector.get_columns('balance_requests')]
        
        if 'attachments' in columns:
            print("  ✓ Columna attachments ya existe")
            return
        
        print("  📝 Agregando columna attachments...")
        db.session.execute(text("""
            ALTER TABLE balance_requests 
            ADD COLUMN attachments TEXT NULL
        """))
        db.session.commit()
        print("  ✓ Columna attachments agregada exitosamente")
        
    except Exception as e:
        print(f"❌ Error agregando columna attachments: {e}")
        db.session.rollback()


def check_and_add_balance_requested_by_column():
    """Verificar y agregar columna requested_by_id a balance_requests (auxiliar puede solicitar en nombre del coordinador)"""
    print("🔍 Verificando columna requested_by_id en balance_requests...")
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        if 'balance_requests' not in tables:
            print("  ⚠️  Tabla balance_requests no existe, saltando...")
            return
        columns = [col['name'] for col in inspector.get_columns('balance_requests')]
        if 'requested_by_id' in columns:
            print("  ✓ Columna requested_by_id ya existe")
            return
        db_type = get_db_type()
        if db_type == 'mssql':
            sql_col = "ALTER TABLE balance_requests ADD requested_by_id NVARCHAR(36) NULL"
            sql_idx = "CREATE INDEX ix_balance_requests_requested_by_id ON balance_requests (requested_by_id)"
        else:
            sql_col = "ALTER TABLE balance_requests ADD COLUMN requested_by_id VARCHAR(36) NULL"
            sql_idx = "CREATE INDEX ix_balance_requests_requested_by_id ON balance_requests (requested_by_id)"
        db.session.execute(text(sql_col))
        db.session.commit()
        try:
            db.session.execute(text(sql_idx))
            db.session.commit()
        except Exception as e_idx:
            print(f"  ⚠️  Índice ya existe o falló: {e_idx}")
            db.session.rollback()
        print("  ✓ Columna requested_by_id agregada")
    except Exception as e:
        print(f"❌ Error agregando requested_by_id: {e}")
        db.session.rollback()


def check_and_add_exam_default_config_columns():
    """Verificar y agregar columnas de configuración de asignación por defecto en exams"""
    print("🔍 Verificando columnas de config de asignación en exams...")
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'exams' not in tables:
            print("  ⚠️  Tabla exams no existe, saltando...")
            return
        
        columns = [col['name'] for col in inspector.get_columns('exams')]
        
        exam_config_columns = {
            'default_max_attempts': 'INT DEFAULT 2',
            'default_max_disconnections': 'INT DEFAULT 3',
            'default_exam_content_type': "NVARCHAR(20) DEFAULT 'mixed'",
            'default_exam_questions_count': 'INT NULL',
            'default_exam_exercises_count': 'INT NULL',
            'default_simulator_questions_count': 'INT NULL',
            'default_simulator_exercises_count': 'INT NULL',
            'default_duration_minutes': 'INT NULL',
            'default_passing_score': 'INT NULL',
        }
        
        for col_name, col_def in exam_config_columns.items():
            if col_name not in columns:
                print(f"  📝 Agregando columna '{col_name}' a exams...")
                db.session.execute(text(f"""
                    ALTER TABLE exams ADD {col_name} {col_def}
                """))
                db.session.commit()
                print(f"  ✓ Columna '{col_name}' agregada a exams")
            else:
                print(f"  ✓ Columna '{col_name}' ya existe en exams")
        
        print("✅ Verificación de config de asignación en exams completada")
        
    except Exception as e:
        print(f"❌ Error en auto-migración de exams config: {e}")
        db.session.rollback()


def check_and_create_certificate_code_history_table():
    """Crear tabla certificate_code_history si no existe.
    Esta tabla almacena códigos de verificación anteriores para que
    los QR impresos sigan funcionando aunque se regeneren los certificados."""
    print("🔍 Verificando tabla certificate_code_history...")
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'certificate_code_history' in tables:
            print("  ✓ Tabla certificate_code_history ya existe")
            return
        
        db_type = get_db_type()
        
        if db_type == 'mssql':
            sql = """
                CREATE TABLE certificate_code_history (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    result_id VARCHAR(36) NOT NULL,
                    user_id VARCHAR(36) NOT NULL,
                    exam_id INT NOT NULL,
                    code VARCHAR(100) NOT NULL,
                    code_type VARCHAR(30) NOT NULL,
                    replaced_by_code VARCHAR(100) NULL,
                    score INT NULL,
                    result_value INT NULL,
                    competency_standard_id INT NULL,
                    start_date DATETIME NULL,
                    end_date DATETIME NULL,
                    created_at DATETIME DEFAULT GETDATE() NOT NULL,
                    archived_at DATETIME DEFAULT GETDATE() NOT NULL
                )
            """
        else:
            sql = """
                CREATE TABLE certificate_code_history (
                    id SERIAL PRIMARY KEY,
                    result_id VARCHAR(36) NOT NULL,
                    user_id VARCHAR(36) NOT NULL,
                    exam_id INT NOT NULL,
                    code VARCHAR(100) NOT NULL,
                    code_type VARCHAR(30) NOT NULL,
                    replaced_by_code VARCHAR(100) NULL,
                    score INT NULL,
                    result_value INT NULL,
                    competency_standard_id INT NULL,
                    start_date TIMESTAMP NULL,
                    end_date TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                    archived_at TIMESTAMP DEFAULT NOW() NOT NULL
                )
            """
        
        db.session.execute(text(sql))
        db.session.commit()
        print("  ✅ Tabla certificate_code_history creada")
        
        # Crear índices
        try:
            db.session.execute(text("CREATE UNIQUE INDEX ix_cert_code_hist_code ON certificate_code_history (code)"))
            db.session.execute(text("CREATE INDEX ix_cert_code_hist_result_id ON certificate_code_history (result_id)"))
            db.session.execute(text("CREATE INDEX ix_cert_code_hist_user_id ON certificate_code_history (user_id)"))
            db.session.commit()
            print("  ✅ Índices creados para certificate_code_history")
        except Exception as idx_err:
            print(f"  ⚠️ Error creando índices (pueden ya existir): {idx_err}")
            db.session.rollback()
        
    except Exception as e:
        print(f"❌ Error creando tabla certificate_code_history: {e}")
        db.session.rollback()


def check_and_create_bulk_upload_tables():
    """Crear tablas bulk_upload_batches y bulk_upload_members si no existen"""
    print("🔍 Verificando tablas de historial de altas masivas...")

    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        db_type = get_db_type()

        if 'bulk_upload_batches' not in tables:
            print("  📝 Creando tabla bulk_upload_batches...")
            if db_type == 'mssql':
                sql = """
                    CREATE TABLE bulk_upload_batches (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        uploaded_by_id NVARCHAR(36) NULL,
                        partner_id INT NULL,
                        campus_id INT NULL,
                        group_id INT NULL,
                        partner_name NVARCHAR(200) NULL,
                        campus_name NVARCHAR(200) NULL,
                        group_name NVARCHAR(100) NULL,
                        country NVARCHAR(100) NULL,
                        state_name NVARCHAR(100) NULL,
                        total_processed INT NOT NULL DEFAULT 0,
                        total_created INT NOT NULL DEFAULT 0,
                        total_existing_assigned INT NOT NULL DEFAULT 0,
                        total_errors INT NOT NULL DEFAULT 0,
                        total_skipped INT NOT NULL DEFAULT 0,
                        emails_sent INT NOT NULL DEFAULT 0,
                        emails_failed INT NOT NULL DEFAULT 0,
                        original_filename NVARCHAR(300) NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT fk_bulk_batch_uploaded_by FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE SET NULL,
                        CONSTRAINT fk_bulk_batch_partner FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
                        CONSTRAINT fk_bulk_batch_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE SET NULL,
                        CONSTRAINT fk_bulk_batch_group FOREIGN KEY (group_id) REFERENCES candidate_groups(id) ON DELETE SET NULL
                    )
                """
            else:
                sql = """
                    CREATE TABLE bulk_upload_batches (
                        id SERIAL PRIMARY KEY,
                        uploaded_by_id VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
                        partner_id INT NULL REFERENCES partners(id) ON DELETE SET NULL,
                        campus_id INT NULL REFERENCES campuses(id) ON DELETE SET NULL,
                        group_id INT NULL REFERENCES candidate_groups(id) ON DELETE SET NULL,
                        partner_name VARCHAR(200) NULL,
                        campus_name VARCHAR(200) NULL,
                        group_name VARCHAR(100) NULL,
                        country VARCHAR(100) NULL,
                        state_name VARCHAR(100) NULL,
                        total_processed INT NOT NULL DEFAULT 0,
                        total_created INT NOT NULL DEFAULT 0,
                        total_existing_assigned INT NOT NULL DEFAULT 0,
                        total_errors INT NOT NULL DEFAULT 0,
                        total_skipped INT NOT NULL DEFAULT 0,
                        emails_sent INT NOT NULL DEFAULT 0,
                        emails_failed INT NOT NULL DEFAULT 0,
                        original_filename VARCHAR(300) NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                """
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✅ Tabla bulk_upload_batches creada")

            # Índices
            try:
                db.session.execute(text("CREATE INDEX ix_bulk_upload_batches_uploaded_by ON bulk_upload_batches (uploaded_by_id)"))
                db.session.execute(text("CREATE INDEX ix_bulk_upload_batches_created ON bulk_upload_batches (created_at)"))
                db.session.commit()
                print("  ✅ Índices bulk_upload_batches creados")
            except Exception as idx_err:
                print(f"  ⚠️ Error creando índices batches: {idx_err}")
                db.session.rollback()
        else:
            print("  ✓ Tabla bulk_upload_batches ya existe")

        if 'bulk_upload_members' not in tables:
            print("  📝 Creando tabla bulk_upload_members...")
            if db_type == 'mssql':
                sql = """
                    CREATE TABLE bulk_upload_members (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        batch_id INT NOT NULL,
                        user_id NVARCHAR(36) NULL,
                        row_number INT NULL,
                        email NVARCHAR(255) NULL,
                        full_name NVARCHAR(300) NULL,
                        username NVARCHAR(100) NULL,
                        curp NVARCHAR(18) NULL,
                        gender NVARCHAR(1) NULL,
                        status NVARCHAR(20) NOT NULL DEFAULT 'created',
                        error_message NVARCHAR(500) NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT fk_bulk_member_batch FOREIGN KEY (batch_id) REFERENCES bulk_upload_batches(id) ON DELETE CASCADE,
                        CONSTRAINT fk_bulk_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                    )
                """
            else:
                sql = """
                    CREATE TABLE bulk_upload_members (
                        id SERIAL PRIMARY KEY,
                        batch_id INT NOT NULL REFERENCES bulk_upload_batches(id) ON DELETE CASCADE,
                        user_id VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
                        row_number INT NULL,
                        email VARCHAR(255) NULL,
                        full_name VARCHAR(300) NULL,
                        username VARCHAR(100) NULL,
                        curp VARCHAR(18) NULL,
                        gender VARCHAR(1) NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'created',
                        error_message VARCHAR(500) NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                """
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✅ Tabla bulk_upload_members creada")

            # Índices
            try:
                db.session.execute(text("CREATE INDEX ix_bulk_upload_members_batch ON bulk_upload_members (batch_id)"))
                db.session.execute(text("CREATE INDEX ix_bulk_upload_members_user ON bulk_upload_members (user_id)"))
                db.session.commit()
                print("  ✅ Índices bulk_upload_members creados")
            except Exception as idx_err:
                print(f"  ⚠️ Error creando índices members: {idx_err}")
                db.session.rollback()
        else:
            print("  ✓ Tabla bulk_upload_members ya existe")

    except Exception as e:
        print(f"❌ Error en auto-migración bulk_upload_tables: {e}")
        db.session.rollback()


def check_and_create_support_chat_tables():
    """Verificar y crear tablas del módulo de chat candidato-soporte."""
    print("🔍 Verificando tablas support chat...")

    try:
        from app.models.support_chat import (
            SupportConversation,
            SupportConversationParticipant,
            SupportConversationSatisfaction,
            SupportMessage,
            ChatMessageTemplate,
        )

        inspector = inspect(db.engine)
        existing_tables = set(inspector.get_table_names())
        required_tables = {
            "support_conversations",
            "support_conversation_participants",
            "support_conversation_satisfaction",
            "support_messages",
        }

        missing = required_tables - existing_tables
        if not missing:
            print("  ✓ Tablas support chat ya existen")
            conversation_columns = {
                column["name"] for column in inspector.get_columns("support_conversations")
            }

            if "assigned_coordinator_user_id" not in conversation_columns:
                try:
                    db_type = db.engine.url.drivername.lower()
                    if "mssql" in db_type:
                        db.session.execute(text(
                            "ALTER TABLE support_conversations ADD assigned_coordinator_user_id NVARCHAR(36) NULL"
                        ))
                    else:
                        db.session.execute(text(
                            "ALTER TABLE support_conversations ADD COLUMN assigned_coordinator_user_id VARCHAR(36)"
                        ))
                    db.session.commit()
                    print("  ✅ Columna assigned_coordinator_user_id agregada")
                except Exception as col_err:
                    print(f"  ⚠️ No se pudo agregar assigned_coordinator_user_id: {col_err}")
                    db.session.rollback()

            if "current_handler_role" not in conversation_columns:
                try:
                    db_type = db.engine.url.drivername.lower()
                    if "mssql" in db_type:
                        db.session.execute(text(
                            "ALTER TABLE support_conversations ADD current_handler_role NVARCHAR(20) NOT NULL DEFAULT 'support'"
                        ))
                    else:
                        db.session.execute(text(
                            "ALTER TABLE support_conversations ADD COLUMN current_handler_role VARCHAR(20) NOT NULL DEFAULT 'support'"
                        ))
                    db.session.commit()
                    print("  ✅ Columna current_handler_role agregada")
                except Exception as col_err:
                    print(f"  ⚠️ No se pudo agregar current_handler_role: {col_err}")
                    db.session.rollback()

            # Crear tabla de plantillas de mensajes si no existe
            if "chat_message_templates" not in existing_tables:
                try:
                    ChatMessageTemplate.__table__.create(bind=db.engine, checkfirst=True)
                    db.session.commit()
                    print("  ✅ Tabla chat_message_templates creada")
                except Exception as tpl_err:
                    print(f"  ⚠️ No se pudo crear chat_message_templates: {tpl_err}")
                    db.session.rollback()

            return

        print("  📝 Creando tablas support chat faltantes...")
        SupportConversation.__table__.create(bind=db.engine, checkfirst=True)
        SupportMessage.__table__.create(bind=db.engine, checkfirst=True)
        SupportConversationParticipant.__table__.create(bind=db.engine, checkfirst=True)
        SupportConversationSatisfaction.__table__.create(bind=db.engine, checkfirst=True)
        ChatMessageTemplate.__table__.create(bind=db.engine, checkfirst=True)
        db.session.commit()
        print("  ✅ Tablas support chat listas")

    except Exception as e:
        print(f"❌ Error creando tablas support chat: {e}")
        import traceback
        traceback.print_exc()
        db.session.rollback()


def _create_support_table_raw(table_name: str):
    """Crear tabla de support chat con SQL raw (fallback MSSQL/PostgreSQL)."""
    db_type = get_db_type()

    sql_map = {
        "support_conversations": """
            CREATE TABLE support_conversations (
                id INTEGER {identity} PRIMARY KEY,
                candidate_user_id VARCHAR(36) NOT NULL,
                created_by_user_id VARCHAR(36) NULL,
                assigned_support_user_id VARCHAR(36) NULL,
                subject VARCHAR(255) NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                priority VARCHAR(20) NOT NULL DEFAULT 'normal',
                created_at {datetime_type} NOT NULL DEFAULT {now},
                updated_at {datetime_type} NOT NULL DEFAULT {now},
                last_message_at {datetime_type} NOT NULL DEFAULT {now},
                FOREIGN KEY (candidate_user_id) REFERENCES users(id),
                FOREIGN KEY (created_by_user_id) REFERENCES users(id),
                FOREIGN KEY (assigned_support_user_id) REFERENCES users(id)
            )
        """,
        "support_messages": """
            CREATE TABLE support_messages (
                id INTEGER {identity} PRIMARY KEY,
                conversation_id INTEGER NOT NULL,
                sender_user_id VARCHAR(36) NULL,
                content TEXT NULL,
                message_type VARCHAR(20) NOT NULL DEFAULT 'text',
                attachment_url VARCHAR(500) NULL,
                attachment_name VARCHAR(255) NULL,
                attachment_mime_type VARCHAR(120) NULL,
                attachment_size_bytes BIGINT NULL,
                created_at {datetime_type} NOT NULL DEFAULT {now},
                edited_at {datetime_type} NULL,
                FOREIGN KEY (conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_user_id) REFERENCES users(id)
            )
        """,
        "support_conversation_participants": """
            CREATE TABLE support_conversation_participants (
                id INTEGER {identity} PRIMARY KEY,
                conversation_id INTEGER NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                participant_role VARCHAR(20) NOT NULL,
                joined_at {datetime_type} NOT NULL DEFAULT {now},
                last_read_at {datetime_type} NULL,
                last_read_message_id INTEGER NULL,
                FOREIGN KEY (conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (last_read_message_id) REFERENCES support_messages(id),
                UNIQUE (conversation_id, user_id)
            )
        """,
    }

    if db_type == 'mssql':
        params = {"identity": "IDENTITY(1,1)", "datetime_type": "DATETIME2", "now": "GETUTCDATE()"}
    elif db_type == 'postgresql':
        params = {"identity": "GENERATED BY DEFAULT AS IDENTITY", "datetime_type": "TIMESTAMP", "now": "(NOW() AT TIME ZONE 'UTC')"}
    else:
        params = {"identity": "AUTOINCREMENT", "datetime_type": "DATETIME", "now": "CURRENT_TIMESTAMP"}

    raw_sql = sql_map.get(table_name)
    if not raw_sql:
        print(f"  ❌ No hay SQL raw para tabla {table_name}")
        return

    try:
        formatted = raw_sql.format(**params)
        db.session.execute(text(formatted))
        db.session.commit()
        print(f"  ✅ Tabla {table_name} creada con SQL raw ({db_type})")
    except Exception as raw_err:
        db.session.rollback()
        err_str = str(raw_err).lower()
        if "already exists" in err_str or "there is already" in err_str:
            print(f"  ✓ Tabla {table_name} ya existe (detectado en SQL raw)")
        else:
            print(f"  ❌ SQL raw falló para {table_name}: {raw_err}")


# ---------------------------------------------------------------------------
# Responsable Estatal: add assigned_state column to users
# ---------------------------------------------------------------------------

def check_and_add_assigned_state_column():
    """Add assigned_state column to users table if it doesn't exist"""
    print("🔍 Verificando columna assigned_state en users...")
    try:
        inspector = inspect(db.engine)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]
        if 'assigned_state' not in existing_columns:
            print("  📝 Agregando columna assigned_state a users...")
            db.session.execute(text("ALTER TABLE users ADD assigned_state VARCHAR(50) NULL"))
            db.session.commit()
            print("  ✓ Columna assigned_state agregada")
        else:
            print("  ✓ Columna assigned_state ya existe")
    except Exception as e:
        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
            print("  ⚠️  Columna assigned_state ya existe")
        else:
            print(f"  ❌ Error: {e}")
            db.session.rollback()


def check_and_add_user_soft_delete_columns():
    """Agregar columnas is_deleted y deleted_at a users (soft-delete, UM-C3).

    Permite anonimizar usuarios preservando evidencia financiera y de
    certificación (payments, results, conocer_certificates, issued_badges,
    vouchers, activity_logs) requerida para auditoría y verificación pública.
    """
    print("🔍 Verificando columnas de soft-delete en users...")
    db_type = get_db_type()
    try:
        inspector = inspect(db.engine)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]
        cols = {
            'is_deleted': 'BIT NOT NULL DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN NOT NULL DEFAULT FALSE',
            'deleted_at': 'DATETIME NULL' if db_type == 'mssql' else 'TIMESTAMP NULL',
        }
        for col_name, col_def in cols.items():
            if col_name in existing_columns:
                print(f"  ✓ Columna {col_name} ya existe en users")
                continue
            print(f"  📝 Agregando columna {col_name} a users...")
            try:
                db.session.execute(text(f"ALTER TABLE users ADD {col_name} {col_def}"))
                db.session.commit()
                print(f"  ✓ Columna {col_name} agregada")
            except Exception as e:
                if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                    print(f"  ⚠️  Columna {col_name} ya existe")
                else:
                    print(f"  ❌ Error agregando {col_name}: {e}")
                    db.session.rollback()
        # Índice para acelerar filtros WHERE is_deleted = 0
        try:
            db.session.execute(text(
                "CREATE INDEX ix_users_is_deleted ON users(is_deleted)"
                if db_type != 'mssql' else
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_users_is_deleted' AND object_id = OBJECT_ID('users')) "
                "CREATE INDEX ix_users_is_deleted ON users(is_deleted)"
            ))
            db.session.commit()
        except Exception:
            db.session.rollback()
    except Exception as e:
        print(f"  ❌ Error en check_and_add_user_soft_delete_columns: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


def check_and_add_curp_giveup_column():
    """Agregar columna curp_renapo_giveup_at a users.

    Marca el momento en que el sistema deja de reintentar la validación
    RENAPO automáticamente (30 días desde creación o N rechazos).
    """
    print("🔍 Verificando columna curp_renapo_giveup_at en users...")
    db_type = get_db_type()
    try:
        inspector = inspect(db.engine)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]
        if 'curp_renapo_giveup_at' in existing_columns:
            print("  ✓ Columna curp_renapo_giveup_at ya existe")
            return
        col_def = 'DATETIME NULL' if db_type == 'mssql' else 'TIMESTAMP NULL'
        db.session.execute(text(f"ALTER TABLE users ADD curp_renapo_giveup_at {col_def}"))
        db.session.commit()
        print("  ✓ Columna curp_renapo_giveup_at agregada")
    except Exception as e:
        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
            print("  ⚠️  Columna curp_renapo_giveup_at ya existe")
        else:
            print(f"  ❌ Error en check_and_add_curp_giveup_column: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


def check_and_add_conocer_solicitud_email_columns():
    """Agregar columnas de snapshot del correo a conocer_solicitud_logs.

    Necesario para que el reporte del historial CONOCER pueda mostrar el
    asunto, cuerpo HTML, destinatarios To/Cc, adjuntos y snapshot de
    asignaciones que se enviaron a CONOCER.
    """
    print("🔍 Verificando columnas snapshot de correo en conocer_solicitud_logs...")
    db_type = get_db_type()
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        if 'conocer_solicitud_logs' not in tables:
            print("  ⚠️  Tabla conocer_solicitud_logs no existe aún (se creará por SQLAlchemy)")
            return
        existing = {col['name'] for col in inspector.get_columns('conocer_solicitud_logs')}
        # Mapeo columna -> definición SQL para MSSQL / otros
        columns = [
            ('email_subject', 'NVARCHAR(500) NULL' if db_type == 'mssql' else 'VARCHAR(500) NULL'),
            ('email_body_html', 'NVARCHAR(MAX) NULL' if db_type == 'mssql' else 'TEXT NULL'),
            ('email_to', 'NVARCHAR(500) NULL' if db_type == 'mssql' else 'VARCHAR(500) NULL'),
            ('email_cc', 'NVARCHAR(MAX) NULL' if db_type == 'mssql' else 'TEXT NULL'),
            ('email_attachments_meta', 'NVARCHAR(MAX) NULL' if db_type == 'mssql' else 'TEXT NULL'),
            ('email_assignments_snapshot', 'NVARCHAR(MAX) NULL' if db_type == 'mssql' else 'TEXT NULL'),
        ]
        for name, definition in columns:
            if name in existing:
                continue
            try:
                db.session.execute(text(f"ALTER TABLE conocer_solicitud_logs ADD {name} {definition}"))
                db.session.commit()
                print(f"  ✓ Columna {name} agregada")
            except Exception as e:
                msg = str(e).lower()
                if 'already exists' in msg or 'duplicate' in msg:
                    print(f"  ⚠️  Columna {name} ya existe")
                else:
                    print(f"  ❌ Error agregando {name}: {e}")
                try:
                    db.session.rollback()
                except Exception:
                    pass
    except Exception as e:
        print(f"  ❌ Error en check_and_add_conocer_solicitud_email_columns: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


def check_and_add_result_mode_column():
    """Agregar columna mode a results para distinguir exam vs simulator"""
    print("🔍 Verificando columna mode en results...")
    try:
        inspector = inspect(db.engine)
        existing_columns = [col['name'] for col in inspector.get_columns('results')]
        if 'mode' not in existing_columns:
            print("  📝 Agregando columna mode a results...")
            db.session.execute(text("ALTER TABLE results ADD mode VARCHAR(20) NULL"))
            db.session.commit()
            print("  ✓ Columna mode agregada a results")
        else:
            print("  ✓ Columna mode ya existe en results")
    except Exception as e:
        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
            print("  ⚠️  Columna mode ya existe en results")
        else:
            print(f"  ❌ Error: {e}")
            db.session.rollback()


def check_and_add_partner_config_subsistema():
    """Agregar columna config_subsistema_id a partners para mapeo a EvaluaasiConfig"""
    print("🔍 Verificando columna config_subsistema_id en partners...")
    try:
        inspector = inspect(db.engine)
        existing_columns = [col['name'] for col in inspector.get_columns('partners')]
        if 'config_subsistema_id' not in existing_columns:
            print("  📝 Agregando columna config_subsistema_id a partners...")
            db.session.execute(text("ALTER TABLE partners ADD config_subsistema_id INT NULL"))
            db.session.commit()
            print("  ✓ Columna config_subsistema_id agregada a partners")
        else:
            print("  ✓ Columna config_subsistema_id ya existe en partners")
    except Exception as e:
        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
            print("  ⚠️  Columna config_subsistema_id ya existe en partners")
        else:
            print(f"  ❌ Error: {e}")
            db.session.rollback()


# ---------------------------------------------------------------------------
# Office local sessions & VB6 integration tables
# ---------------------------------------------------------------------------

def check_and_create_office_tables():
    """Crear tablas para VB6 Office integration y agregar columnas Office a tablas existentes."""
    print("🔍 Verificando tablas y columnas Office local...")
    db_type = get_db_type()
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        # --- 1. Columnas nuevas en vm_sessions ---
        if 'vm_sessions' in tables:
            cols = [c['name'] for c in inspector.get_columns('vm_sessions')]
            vm_new_cols = {
                'is_local': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'office_app': 'VARCHAR(20) NULL',
                'office_version': 'VARCHAR(20) NULL',
                'level': 'VARCHAR(20) NULL',
                'parcial_units': 'VARCHAR(200) NULL',
                'end_hour': 'INT NULL',
            }
            for col_name, col_def in vm_new_cols.items():
                if col_name not in cols:
                    try:
                        db.session.execute(text(f"ALTER TABLE vm_sessions ADD {col_name} {col_def}"))
                        db.session.commit()
                        print(f"  ✓ vm_sessions.{col_name} agregada")
                    except Exception as e:
                        db.session.rollback()
                        if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                            print(f"  ❌ Error vm_sessions.{col_name}: {e}")
        
        # --- 2. Columnas nuevas en campuses ---
        if 'campuses' in tables:
            cols = [c['name'] for c in inspector.get_columns('campuses')]
            campus_new_cols = {
                'enable_office_exams': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'enable_office_simulators': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'office_exam_level': "NVARCHAR(20) DEFAULT 'intermedio'" if db_type == 'mssql' else "VARCHAR(20) DEFAULT 'intermedio'",
            }
            for col_name, col_def in campus_new_cols.items():
                if col_name not in cols:
                    try:
                        db.session.execute(text(f"ALTER TABLE campuses ADD {col_name} {col_def}"))
                        db.session.commit()
                        print(f"  ✓ campuses.{col_name} agregada")
                    except Exception as e:
                        db.session.rollback()
                        if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                            print(f"  ❌ Error campuses.{col_name}: {e}")
        
        # --- 3. Columnas nuevas en candidate_groups ---
        if 'candidate_groups' in tables:
            cols = [c['name'] for c in inspector.get_columns('candidate_groups')]
            group_new_cols = {
                'enable_office_exams_override': 'BIT NULL' if db_type == 'mssql' else 'BOOLEAN NULL',
                'enable_office_simulators_override': 'BIT NULL' if db_type == 'mssql' else 'BOOLEAN NULL',
                'office_exam_level_override': 'NVARCHAR(20) NULL' if db_type == 'mssql' else 'VARCHAR(20) NULL',
            }
            for col_name, col_def in group_new_cols.items():
                if col_name not in cols:
                    try:
                        db.session.execute(text(f"ALTER TABLE candidate_groups ADD {col_name} {col_def}"))
                        db.session.commit()
                        print(f"  ✓ candidate_groups.{col_name} agregada")
                    except Exception as e:
                        db.session.rollback()
                        if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                            print(f"  ❌ Error candidate_groups.{col_name}: {e}")
        
        # --- 4. Crear tabla office_exam_results ---
        if 'office_exam_results' not in tables:
            print("  📝 Creando tabla office_exam_results...")
            nvarchar = 'NVARCHAR' if db_type == 'mssql' else 'VARCHAR'
            ntext = 'NVARCHAR(MAX)' if db_type == 'mssql' else 'TEXT'
            bit = 'BIT' if db_type == 'mssql' else 'BOOLEAN'
            now_fn = 'GETUTCDATE()' if db_type == 'mssql' else "CURRENT_TIMESTAMP"
            
            sql = f"""
            CREATE TABLE office_exam_results (
                id {nvarchar}(36) NOT NULL PRIMARY KEY,
                user_id {nvarchar}(36) NOT NULL,
                vm_session_id INT NULL,
                campus_id INT NULL,
                group_id INT NULL,
                session_type VARCHAR(20) NOT NULL DEFAULT 'examen',
                office_app VARCHAR(20) NULL,
                office_version VARCHAR(20) NULL,
                level VARCHAR(20) NULL,
                score INT DEFAULT 0,
                passing_score INT DEFAULT 400,
                passed {bit} DEFAULT 0,
                total_questions INT DEFAULT 0,
                correct_answers INT DEFAULT 0,
                voucher_code VARCHAR(50) NULL,
                voucher_expired {bit} DEFAULT 0,
                answers_data {ntext} NULL,
                parcial_sessions_data {ntext} NULL,
                assigned_sessions VARCHAR(200) NULL,
                parcial_session_number INT NULL,
                calendario_id VARCHAR(100) NULL,
                app_version VARCHAR(50) NULL,
                ip_address VARCHAR(45) NULL,
                mac_address VARCHAR(50) NULL,
                pc_name VARCHAR(100) NULL,
                status VARCHAR(20) DEFAULT 'in_progress',
                duration_seconds INT NULL,
                started_at DATETIME NULL,
                finished_at DATETIME NULL,
                certificate_code VARCHAR(50) NULL,
                created_at DATETIME DEFAULT {now_fn},
                updated_at DATETIME DEFAULT {now_fn}
            )
            """
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✓ Tabla office_exam_results creada")
        
        # --- 5. Crear tabla vb6_session_tokens ---
        if 'vb6_session_tokens' not in tables:
            print("  📝 Creando tabla vb6_session_tokens...")
            nvarchar = 'NVARCHAR' if db_type == 'mssql' else 'VARCHAR'
            bit = 'BIT' if db_type == 'mssql' else 'BOOLEAN'
            now_fn = 'GETUTCDATE()' if db_type == 'mssql' else "CURRENT_TIMESTAMP"
            
            sql = f"""
            CREATE TABLE vb6_session_tokens (
                id {nvarchar}(36) NOT NULL PRIMARY KEY,
                user_id {nvarchar}(36) NOT NULL,
                vm_session_id INT NULL,
                session_type VARCHAR(20) NULL,
                ip_address VARCHAR(45) NULL,
                created_at DATETIME DEFAULT {now_fn},
                expires_at DATETIME NULL,
                is_active {bit} DEFAULT 1
            )
            """
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✓ Tabla vb6_session_tokens creada")
        
        # --- 6. Crear tabla office_app_versions ---
        if 'office_app_versions' not in tables:
            print("  📝 Creando tabla office_app_versions...")
            nvarchar = 'NVARCHAR' if db_type == 'mssql' else 'VARCHAR'
            bit = 'BIT' if db_type == 'mssql' else 'BOOLEAN'
            now_fn = 'GETUTCDATE()' if db_type == 'mssql' else "CURRENT_TIMESTAMP"
            
            sql = f"""
            CREATE TABLE office_app_versions (
                id INT IDENTITY(1,1) PRIMARY KEY,
                app_name VARCHAR(50) NOT NULL UNIQUE,
                app_type VARCHAR(20) NOT NULL DEFAULT 'examen',
                min_version VARCHAR(20) NULL,
                latest_version VARCHAR(20) NULL,
                download_url {nvarchar}(500) NULL,
                is_active {bit} DEFAULT 1,
                updated_at DATETIME DEFAULT {now_fn}
            )
            """ if db_type == 'mssql' else f"""
            CREATE TABLE office_app_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name VARCHAR(50) NOT NULL UNIQUE,
                app_type VARCHAR(20) NOT NULL DEFAULT 'examen',
                min_version VARCHAR(20) NULL,
                latest_version VARCHAR(20) NULL,
                download_url VARCHAR(500) NULL,
                is_active BOOLEAN DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✓ Tabla office_app_versions creada")
        
        # --- 7. Agregar group_exam_id a tablas existentes (asignación reemplaza voucher) ---
        try:
            cols_oer = [r[0].lower() for r in db.session.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='office_exam_results'"
                if db_type == 'mssql' else
                "PRAGMA table_info(office_exam_results)"
            )).fetchall()]
            if db_type != 'mssql':
                cols_oer = [r[1].lower() for r in db.session.execute(text("PRAGMA table_info(office_exam_results)")).fetchall()]
            
            if 'group_exam_id' not in cols_oer:
                db.session.execute(text("ALTER TABLE office_exam_results ADD group_exam_id INT NULL"))
                db.session.commit()
                print("  ✓ Columna group_exam_id agregada a office_exam_results")
        except Exception as e:
            db.session.rollback()
            if 'already' not in str(e).lower() and 'duplicate' not in str(e).lower():
                print(f"  ⚠ group_exam_id en office_exam_results: {e}")

        # Columna xml_blob_url para almacenar URL del XML respaldado en Azure Blob (UpXML2016)
        try:
            cols_oer2 = [r[0].lower() for r in db.session.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='office_exam_results'"
                if db_type == 'mssql' else
                "PRAGMA table_info(office_exam_results)"
            )).fetchall()]
            if db_type != 'mssql':
                cols_oer2 = [r[1].lower() for r in db.session.execute(text("PRAGMA table_info(office_exam_results)")).fetchall()]
            if 'xml_blob_url' not in cols_oer2:
                col_type = 'NVARCHAR(500)' if db_type == 'mssql' else 'TEXT'
                db.session.execute(text(f"ALTER TABLE office_exam_results ADD xml_blob_url {col_type} NULL"))
                db.session.commit()
                print("  ✓ Columna xml_blob_url agregada a office_exam_results")
            if 'badge_uuid' not in cols_oer2:
                col_type2 = 'NVARCHAR(36)' if db_type == 'mssql' else 'VARCHAR(36)'
                db.session.execute(text(f"ALTER TABLE office_exam_results ADD badge_uuid {col_type2} NULL"))
                db.session.commit()
                print("  ✓ Columna badge_uuid agregada a office_exam_results")
        except Exception as e:
            db.session.rollback()
            if 'already' not in str(e).lower() and 'duplicate' not in str(e).lower():
                print(f"  ⚠ xml_blob_url/badge_uuid en office_exam_results: {e}")

        try:
            cols_vb6 = [r[0].lower() for r in db.session.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='vb6_session_tokens'"
                if db_type == 'mssql' else
                "PRAGMA table_info(vb6_session_tokens)"
            )).fetchall()]
            if db_type != 'mssql':
                cols_vb6 = [r[1].lower() for r in db.session.execute(text("PRAGMA table_info(vb6_session_tokens)")).fetchall()]
            
            if 'group_exam_id' not in cols_vb6:
                db.session.execute(text("ALTER TABLE vb6_session_tokens ADD group_exam_id INT NULL"))
                db.session.commit()
                print("  ✓ Columna group_exam_id agregada a vb6_session_tokens")
        except Exception as e:
            db.session.rollback()
            if 'already' not in str(e).lower() and 'duplicate' not in str(e).lower():
                print(f"  ⚠ group_exam_id en vb6_session_tokens: {e}")

        print("✅ Verificación Office local completada")
        
    except Exception as e:
        print(f"❌ Error en migración Office: {e}")
        db.session.rollback()


# ---------------------------------------------------------------------------
# CURP recovery: detect and re-verify orphaned curp_pending users
# ---------------------------------------------------------------------------

_curp_recovery_launched = False


def check_and_recover_orphaned_curp_users():
    """Detect users stuck in curp_pending/curp_verifying state after a
    container restart and re-launch CURP verification in a background thread.

    Status-based approach (no time threshold):
      - curp_pending   = user was created but verification never started
      - curp_verifying = verification was in progress when container died
    Both statuses indicate the user needs (re-)verification."""
    global _curp_recovery_launched
    if _curp_recovery_launched:
        return
    _curp_recovery_launched = True

    try:
        from app.models.user import User
        from app.models.partner import GroupMember

        orphaned_users = (
            db.session.query(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .filter(
                User.curp_verified == False,
                User.curp.isnot(None),
                User.curp != '',
                User.curp.notin_(['XEXX010101HNEXXXA4', 'XEXX010101MNEXXXA8']),
                User.role == 'candidato',
                # Solo reanudar a los que quedaron a mitad de verificación.
                # Los 'curp_required' son responsabilidad del candidato — no se reanudan.
                GroupMember.status.in_(['curp_pending', 'curp_verifying']),
            )
            .distinct()
            .all()
        )

        if not orphaned_users:
            print("[CURP-RECOVERY] No orphaned curp_pending users found")
            return

        print(f"[CURP-RECOVERY] Found {len(orphaned_users)} orphaned users, launching recovery thread...")

        users_data = [
            {'username': u.username, 'curp': u.curp, 'user_id': u.id}
            for u in orphaned_users
        ]

        import threading
        from flask import current_app
        app_obj = current_app._get_current_object()

        from app.routes.user_management import _recover_orphaned_curp_users
        thread = threading.Thread(
            target=_recover_orphaned_curp_users,
            args=(app_obj, users_data),
            daemon=True,
        )
        thread.start()
        print(f"[CURP-RECOVERY] Recovery thread started for {len(users_data)} users")

    except Exception as e:
        print(f"[CURP-RECOVERY] Error during orphan detection: {e}")


def check_and_add_vm_session_ad_password():
    """Agregar columna ad_password a vm_sessions para almacenar contraseña AD generada"""
    print("🔍 Verificando columna ad_password en vm_sessions...")
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        if 'vm_sessions' not in tables:
            print("  ⚠️  Tabla vm_sessions no existe, saltando...")
            return
        existing_columns = [col['name'] for col in inspector.get_columns('vm_sessions')]
        if 'ad_password' not in existing_columns:
            print("  📝 Agregando columna ad_password a vm_sessions...")
            db.session.execute(text("ALTER TABLE vm_sessions ADD ad_password VARCHAR(64) NULL"))
            db.session.commit()
            print("  ✓ Columna ad_password agregada a vm_sessions")
        else:
            print("  ✓ Columna ad_password ya existe en vm_sessions")
    except Exception as e:
        if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
            print("  ⚠️  Columna ad_password ya existe en vm_sessions")
        else:
            print(f"  ❌ Error: {e}")
            db.session.rollback()


def check_and_fix_vm_session_unique_slot():
    """Reemplaza la unique constraint global por un índice único filtrado.

    El constraint original (user_id, session_date, start_hour) bloquea reagendar
    en el mismo slot incluso si la sesión previa fue cancelada. Lo sustituimos
    por un índice único FILTRADO sobre status='scheduled' (MSSQL) o por el
    UniqueConstraint normal en SQLite (con un cleanup periódico).
    """
    print("🔍 Verificando unicidad filtrada en vm_sessions...")
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        if 'vm_sessions' not in tables:
            print("  ⚠️  Tabla vm_sessions no existe, saltando...")
            return

        dialect = db.engine.dialect.name

        if dialect in ('mssql', 'mssql+pymssql'):
            # 1) Drop unique constraint si existe
            db.session.execute(text("""
                IF EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'uq_vm_session_user_slot'
                      AND object_id = OBJECT_ID('vm_sessions')
                )
                BEGIN
                    ALTER TABLE vm_sessions DROP CONSTRAINT uq_vm_session_user_slot
                END
            """))
            db.session.commit()
            print("  ✓ Constraint uq_vm_session_user_slot eliminada (si existía)")

            # 2) Crear índice único filtrado (solo scheduled)
            db.session.execute(text("""
                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'uq_vm_session_user_slot_active'
                      AND object_id = OBJECT_ID('vm_sessions')
                )
                BEGIN
                    CREATE UNIQUE INDEX uq_vm_session_user_slot_active
                    ON vm_sessions(user_id, session_date, start_hour)
                    WHERE status = 'scheduled'
                END
            """))
            db.session.commit()
            print("  ✓ Índice único filtrado uq_vm_session_user_slot_active listo")
        else:
            # SQLite: no soporta índices filtrados de la misma forma; dejamos
            # la app validar duplicados (ya lo hace en create_session).
            print(f"  ℹ️  Dialecto {dialect}: se omite cambio (validación a nivel app)")
    except Exception as e:
        print(f"  ❌ Error ajustando unicidad vm_sessions: {e}")
        db.session.rollback()


# ---------------------------------------------------------------------------
# SCORM 1.2: tablas study_scorm_packages / study_scorm_attempts y columna allow_scorm
# ---------------------------------------------------------------------------

def check_and_create_scorm_tables():
    """Crear tablas SCORM y agregar columna allow_scorm a study_topics si faltan."""
    print("🔍 Verificando tablas SCORM...")
    try:
        from app.models.study_scorm import StudyScormPackage, StudyScormAttempt

        inspector = inspect(db.engine)
        existing_tables = set(inspector.get_table_names())

        if 'study_scorm_packages' not in existing_tables:
            print("  📝 Creando tabla study_scorm_packages...")
            StudyScormPackage.__table__.create(bind=db.engine, checkfirst=True)
            db.session.commit()
            print("  ✅ Tabla study_scorm_packages creada")
        else:
            print("  ✓ Tabla study_scorm_packages ya existe")

        if 'study_scorm_attempts' not in existing_tables:
            print("  📝 Creando tabla study_scorm_attempts...")
            StudyScormAttempt.__table__.create(bind=db.engine, checkfirst=True)
            db.session.commit()
            print("  ✅ Tabla study_scorm_attempts creada")
        else:
            print("  ✓ Tabla study_scorm_attempts ya existe")

        # Columna allow_scorm en study_topics
        if 'study_topics' in existing_tables:
            topic_columns = {c['name'] for c in inspector.get_columns('study_topics')}
            if 'allow_scorm' not in topic_columns:
                db_type = get_db_type()
                try:
                    if db_type == 'mssql':
                        db.session.execute(text(
                            "ALTER TABLE study_topics ADD allow_scorm BIT NOT NULL DEFAULT 1"
                        ))
                    else:
                        db.session.execute(text(
                            "ALTER TABLE study_topics ADD COLUMN allow_scorm BOOLEAN NOT NULL DEFAULT 1"
                        ))
                    db.session.commit()
                    print("  ✅ Columna allow_scorm agregada a study_topics")
                except Exception as e:
                    db.session.rollback()
                    if 'already' in str(e).lower() or 'duplicate' in str(e).lower():
                        print("  ⚠️  allow_scorm ya existe en study_topics")
                    else:
                        print(f"  ❌ No se pudo agregar allow_scorm: {e}")
            else:
                print("  ✓ Columna allow_scorm ya existe en study_topics")
    except Exception as e:
        print(f"❌ Error en migración SCORM: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


# placeholder-sso

# ---------------------------------------------------------------------------
# Verificación CURP — cache + cola persistente (mayo 2026)
# ---------------------------------------------------------------------------

def check_and_create_curp_verification_tables():
    """Crea tablas curp_renapo_cache y curp_verification_queue.

    - curp_renapo_cache: respuestas RENAPO cacheadas (positivas 30d, negativas 1h)
    - curp_verification_queue: cola persistente para validación asíncrona con
      reintentos. Reemplaza los threads volátiles del flujo bulk-upload.
    """
    print("🔍 Verificando tablas de verificación CURP...")
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        db_type = get_db_type()

        # ── curp_renapo_cache ──
        if 'curp_renapo_cache' not in tables:
            print("  📝 Creando tabla curp_renapo_cache...")
            if db_type == 'mssql':
                sql = """
                    CREATE TABLE curp_renapo_cache (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        curp VARCHAR(18) NOT NULL UNIQUE,
                        valid BIT NOT NULL DEFAULT 0,
                        payload_json NVARCHAR(MAX) NULL,
                        error_message NVARCHAR(500) NULL,
                        cached_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        expires_at DATETIME2 NOT NULL,
                        hits INT NOT NULL DEFAULT 0
                    )
                """
            else:
                sql = """
                    CREATE TABLE curp_renapo_cache (
                        id SERIAL PRIMARY KEY,
                        curp VARCHAR(18) NOT NULL UNIQUE,
                        valid BOOLEAN NOT NULL DEFAULT FALSE,
                        payload_json TEXT NULL,
                        error_message VARCHAR(500) NULL,
                        cached_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        expires_at TIMESTAMP NOT NULL,
                        hits INT NOT NULL DEFAULT 0
                    )
                """
            db.session.execute(text(sql))
            db.session.commit()
            try:
                db.session.execute(text("CREATE INDEX ix_curp_cache_expires ON curp_renapo_cache (expires_at)"))
                db.session.commit()
            except Exception:
                db.session.rollback()
            print("  ✅ Tabla curp_renapo_cache creada")
        else:
            print("  ✓ Tabla curp_renapo_cache ya existe")

        # ── curp_verification_queue ──
        if 'curp_verification_queue' not in tables:
            print("  📝 Creando tabla curp_verification_queue...")
            if db_type == 'mssql':
                sql = """
                    CREATE TABLE curp_verification_queue (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        user_id VARCHAR(36) NOT NULL,
                        curp VARCHAR(18) NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'pending',
                        attempts INT NOT NULL DEFAULT 0,
                        circuit_open_retries INT NOT NULL DEFAULT 0,
                        last_error NVARCHAR(500) NULL,
                        batch_id INT NULL,
                        source VARCHAR(20) NOT NULL DEFAULT 'bulk',
                        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        next_retry_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        finished_at DATETIME2 NULL,
                        locked_at DATETIME2 NULL,
                        locked_by VARCHAR(80) NULL,
                        CONSTRAINT fk_curpq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        CONSTRAINT fk_curpq_batch FOREIGN KEY (batch_id) REFERENCES bulk_upload_batches(id) ON DELETE SET NULL
                    )
                """
            else:
                sql = """
                    CREATE TABLE curp_verification_queue (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        curp VARCHAR(18) NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'pending',
                        attempts INT NOT NULL DEFAULT 0,
                        circuit_open_retries INT NOT NULL DEFAULT 0,
                        last_error VARCHAR(500) NULL,
                        batch_id INT NULL REFERENCES bulk_upload_batches(id) ON DELETE SET NULL,
                        source VARCHAR(20) NOT NULL DEFAULT 'bulk',
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        next_retry_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        finished_at TIMESTAMP NULL,
                        locked_at TIMESTAMP NULL,
                        locked_by VARCHAR(80) NULL
                    )
                """
            db.session.execute(text(sql))
            db.session.commit()
            for idx_sql in [
                "CREATE INDEX ix_curpq_user ON curp_verification_queue (user_id)",
                "CREATE INDEX ix_curpq_status ON curp_verification_queue (status)",
                "CREATE INDEX ix_curpq_next_retry ON curp_verification_queue (next_retry_at)",
                "CREATE INDEX ix_curpq_batch ON curp_verification_queue (batch_id)",
            ]:
                try:
                    db.session.execute(text(idx_sql))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            print("  ✅ Tabla curp_verification_queue creada")
        else:
            print("  ✓ Tabla curp_verification_queue ya existe")

        # ── columna validation_email_sent_at en bulk_upload_batches ──
        try:
            cols = [c['name'] for c in inspector.get_columns('bulk_upload_batches')] if 'bulk_upload_batches' in tables else []
            if 'bulk_upload_batches' in tables and 'validation_email_sent_at' not in cols:
                if db_type == 'mssql':
                    db.session.execute(text(
                        "ALTER TABLE bulk_upload_batches ADD validation_email_sent_at DATETIME2 NULL"
                    ))
                else:
                    db.session.execute(text(
                        "ALTER TABLE bulk_upload_batches ADD COLUMN validation_email_sent_at TIMESTAMP NULL"
                    ))
                db.session.commit()
                print("  ✅ Columna validation_email_sent_at agregada a bulk_upload_batches")
        except Exception as col_err:
            print(f"  ⚠️ No se pudo agregar validation_email_sent_at: {col_err}")
            try:
                db.session.rollback()
            except Exception:
                pass

    except Exception as e:
        print(f"❌ Error en auto-migración curp_verification: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# CURP LOCAL DRAIN (abril 2026 — modo standby RENAPO)
# Cuando CURP_RENAPO_ENABLED=false, drena la cola de verificación pendiente
# aplicando validación LOCAL (formato + dígito verificador). Idempotente.
# Solo se ejecuta una vez por proceso.
# ---------------------------------------------------------------------------

_curp_local_drain_done = False


def drain_curp_queue_with_local_validation():
    """Procesa todos los usuarios con CURP no verificada aplicando validación
    LOCAL síncrona (formato + dígito). NO hace red. Solo corre si el flag
    CURP_RENAPO_ENABLED es falso (modo standby).

    Acciones:
      - Por cada User con curp_verified=False y CURP no genérica:
          * Si pasa validación local → curp_verified=True, GroupMembers con
            status en (curp_required, curp_pending, curp_verifying) → active.
          * Si falla → curp_verified=False, GroupMembers → curp_required.
      - Filas pendientes/en proceso en curp_verification_queue → 'done' o 'rejected'.
    """
    global _curp_local_drain_done
    if _curp_local_drain_done:
        return
    _curp_local_drain_done = True

    try:
        from app.services.curp_local_validator import is_renapo_enabled, validate_curp_local
        if is_renapo_enabled():
            print("[CURP-LOCAL-DRAIN] CURP_RENAPO_ENABLED=true — drain omitido (modo RENAPO)")
            return

        from app.models.user import User
        from app.models.partner import GroupMember
        try:
            from app.models.curp_verification import (
                CurpVerificationQueue, QUEUE_PENDING, QUEUE_PROCESSING,
                QUEUE_DONE, QUEUE_REJECTED,
            )
            queue_available = True
        except Exception:
            queue_available = False

        GENERIC = ('XEXX010101HNEXXXA4', 'XEXX010101MNEXXXA8')

        candidates = (
            User.query.filter(
                User.curp_verified == False,  # noqa: E712
                User.curp.isnot(None),
                User.curp != '',
                User.curp.notin_(GENERIC),
                User.role == 'candidato',
            ).all()
        )

        if not candidates:
            print("[CURP-LOCAL-DRAIN] No hay usuarios con CURP pendiente")
            return

        verified_count = 0
        rejected_count = 0
        for u in candidates:
            is_v, _err, _is_gf = validate_curp_local(u.curp)
            if is_v:
                u.curp_verified = True
                u.curp_verified_at = datetime.utcnow()
                for gm in GroupMember.query.filter_by(user_id=u.id).all():
                    if gm.status in ('curp_required', 'curp_pending', 'curp_verifying'):
                        gm.status = 'active'
                if queue_available:
                    CurpVerificationQueue.query.filter(
                        CurpVerificationQueue.user_id == u.id,
                        CurpVerificationQueue.status.in_([QUEUE_PENDING, QUEUE_PROCESSING]),
                    ).update({CurpVerificationQueue.status: QUEUE_DONE}, synchronize_session=False)
                verified_count += 1
            else:
                for gm in GroupMember.query.filter_by(user_id=u.id).all():
                    if gm.status in ('curp_pending', 'curp_verifying'):
                        gm.status = 'curp_required'
                if queue_available:
                    CurpVerificationQueue.query.filter(
                        CurpVerificationQueue.user_id == u.id,
                        CurpVerificationQueue.status.in_([QUEUE_PENDING, QUEUE_PROCESSING]),
                    ).update({CurpVerificationQueue.status: QUEUE_REJECTED}, synchronize_session=False)
                rejected_count += 1

        db.session.commit()
        print(f"[CURP-LOCAL-DRAIN] Verificados localmente: {verified_count} | "
              f"Rechazados (formato inválido): {rejected_count}")
    except Exception as e:
        print(f"❌ Error en drain_curp_queue_with_local_validation: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# SSO Tokenización (mayo 2026)
# ---------------------------------------------------------------------------

def check_and_create_sso_tokenization():
    """Migración para SSO Tokenización API a NIVEL PLANTEL (mayo 2026, rev2):
       - campuses: api_key_hash, api_key_encrypted, api_key_prefix, api_key_active,
                   api_key_created_at, api_key_created_by, share_api_key_with_responsable
       - users:    external_id, external_partner_id, external_campus_id, external_program
       - sso_tokens: agregar columna campus_id (partner_id queda nullable por compat)
       - partners: DROP de columnas api_key_* (la API key vive ahora en el plantel)
    """
    print("🔍 Verificando esquema SSO Tokenización (nivel plantel)...")
    try:
        db_type = get_db_type()
        inspector = inspect(db.engine)
        tables = set(inspector.get_table_names())

        # ── campuses ──────────────────────────────────────────────────────
        if 'campuses' in tables:
            cols = {c['name'] for c in inspector.get_columns('campuses')}
            campus_cols = [
                ('api_key_hash',                    'NVARCHAR(255) NULL',     'VARCHAR(255) NULL'),
                ('api_key_encrypted',               'NVARCHAR(MAX) NULL',     'TEXT NULL'),
                ('api_key_prefix',                  'NVARCHAR(16) NULL',      'VARCHAR(16) NULL'),
                ('api_key_active',                  'BIT NOT NULL DEFAULT 1', 'BOOLEAN NOT NULL DEFAULT TRUE'),
                ('api_key_created_at',              'DATETIME2 NULL',         'TIMESTAMP NULL'),
                ('api_key_created_by',              'NVARCHAR(36) NULL',      'VARCHAR(36) NULL'),
                ('share_api_key_with_responsable',  'BIT NOT NULL DEFAULT 0', 'BOOLEAN NOT NULL DEFAULT FALSE'),
                ('enable_sso_api',                  'BIT NOT NULL DEFAULT 0', 'BOOLEAN NOT NULL DEFAULT FALSE'),
            ]
            for name, mssql_def, generic_def in campus_cols:
                if name in cols:
                    continue
                col_def = mssql_def if db_type == 'mssql' else generic_def
                try:
                    db.session.execute(text(f"ALTER TABLE campuses ADD {name} {col_def}"))
                    db.session.commit()
                    print(f"  ✅ campuses.{name} agregada")
                except Exception as e:
                    db.session.rollback()
                    if 'already' in str(e).lower() or 'duplicate' in str(e).lower():
                        print(f"  ⚠️  campuses.{name} ya existe")
                    else:
                        print(f"  ❌ Error agregando campuses.{name}: {e}")
            # Índice por prefix
            try:
                if db_type == 'mssql':
                    db.session.execute(text(
                        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_campuses_api_key_prefix') "
                        "CREATE INDEX ix_campuses_api_key_prefix ON campuses(api_key_prefix)"
                    ))
                else:
                    db.session.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_campuses_api_key_prefix ON campuses(api_key_prefix)"
                    ))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                if 'already' not in str(e).lower():
                    print(f"  ⚠️ índice prefix campuses: {e}")

        # ── partners: DROP columnas api_key_* (ahora viven en campus) ────
        if 'partners' in tables and db_type == 'mssql':
            try:
                # 1) drop índice si existe
                db.session.execute(text(
                    "IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_partners_api_key_prefix') "
                    "DROP INDEX ix_partners_api_key_prefix ON partners"
                ))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"  ⚠️ drop index partners: {e}")
            for col in ('api_key_hash', 'api_key_prefix', 'api_key_active',
                        'api_key_created_at', 'api_key_created_by'):
                try:
                    # MSSQL no soporta IF EXISTS en ALTER ... DROP COLUMN, usar dinámico
                    db.session.execute(text(
                        f"IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('partners') AND name='{col}') "
                        f"BEGIN "
                        f"  DECLARE @df_{col} sysname; "
                        f"  SELECT @df_{col} = dc.name FROM sys.default_constraints dc "
                        f"    JOIN sys.columns c ON c.default_object_id = dc.object_id "
                        f"    WHERE c.object_id = OBJECT_ID('partners') AND c.name='{col}'; "
                        f"  IF @df_{col} IS NOT NULL EXEC('ALTER TABLE partners DROP CONSTRAINT ' + @df_{col}); "
                        f"  ALTER TABLE partners DROP COLUMN {col}; "
                        f"END"
                    ))
                    db.session.commit()
                    print(f"  ✅ partners.{col} eliminada")
                except Exception as e:
                    db.session.rollback()
                    print(f"  ⚠️ no se pudo eliminar partners.{col}: {e}")

        # ── users ─────────────────────────────────────────────────────────
        inspector = inspect(db.engine)
        if 'users' in tables:
            cols = {c['name'] for c in inspector.get_columns('users')}
            user_cols = [
                ('external_id',         'NVARCHAR(80) NULL',  'VARCHAR(80) NULL'),
                ('external_partner_id', 'INT NULL',           'INTEGER NULL'),
                ('external_campus_id',  'INT NULL',           'INTEGER NULL'),
                ('external_program',    'NVARCHAR(200) NULL', 'VARCHAR(200) NULL'),
            ]
            for name, mssql_def, generic_def in user_cols:
                if name in cols:
                    continue
                col_def = mssql_def if db_type == 'mssql' else generic_def
                try:
                    db.session.execute(text(f"ALTER TABLE users ADD {name} {col_def}"))
                    db.session.commit()
                    print(f"  ✅ users.{name} agregada")
                except Exception as e:
                    db.session.rollback()
                    if 'already' in str(e).lower() or 'duplicate' in str(e).lower():
                        print(f"  ⚠️  users.{name} ya existe")
                    else:
                        print(f"  ❌ Error agregando users.{name}: {e}")

            # FKs externos
            try:
                if db_type == 'mssql':
                    db.session.execute(text(
                        "IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='fk_users_external_partner') "
                        "ALTER TABLE users ADD CONSTRAINT fk_users_external_partner "
                        "FOREIGN KEY (external_partner_id) REFERENCES partners(id) ON DELETE SET NULL"
                    ))
                    db.session.execute(text(
                        "IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='fk_users_external_campus') "
                        "ALTER TABLE users ADD CONSTRAINT fk_users_external_campus "
                        "FOREIGN KEY (external_campus_id) REFERENCES campuses(id) ON DELETE SET NULL"
                    ))
                    db.session.commit()
            except Exception as e:
                db.session.rollback()
                if 'already' not in str(e).lower():
                    print(f"  ⚠️ FK external_*: {e}")

            # Índice único parcial (external_campus_id, external_id)
            try:
                if db_type == 'mssql':
                    db.session.execute(text(
                        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_users_external_campus') "
                        "CREATE UNIQUE INDEX ux_users_external_campus ON users(external_campus_id, external_id) "
                        "WHERE external_id IS NOT NULL"
                    ))
                else:
                    db.session.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ux_users_external_campus "
                        "ON users(external_campus_id, external_id) WHERE external_id IS NOT NULL"
                    ))
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                if 'already' not in str(e).lower():
                    print(f"  ⚠️ índice ux_users_external_campus: {e}")

        # ── tabla sso_tokens ──────────────────────────────────────────────
        inspector = inspect(db.engine)
        tables = set(inspector.get_table_names())
        if 'sso_tokens' not in tables:
            print("  📝 Creando tabla sso_tokens...")
            if db_type == 'mssql':
                users_id_type = 'VARCHAR(36)'
                try:
                    row = db.session.execute(text(
                        "SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_NAME='users' AND COLUMN_NAME='id'"
                    )).fetchone()
                    if row:
                        dt = str(row[0]).upper()
                        ln = int(row[1]) if row[1] else 36
                        users_id_type = f"{dt}({ln})"
                except Exception:
                    pass
                sql = f"""
                    CREATE TABLE sso_tokens (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        token_hash CHAR(64) NOT NULL UNIQUE,
                        user_id {users_id_type} NOT NULL,
                        partner_id INT NULL,
                        campus_id INT NULL,
                        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                        expires_at DATETIME2 NOT NULL,
                        consumed_at DATETIME2 NULL,
                        issuer_ip NVARCHAR(45) NULL,
                        CONSTRAINT fk_sso_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        CONSTRAINT fk_sso_tokens_partner FOREIGN KEY (partner_id) REFERENCES partners(id),
                        CONSTRAINT fk_sso_tokens_campus FOREIGN KEY (campus_id) REFERENCES campuses(id)
                    )
                """
            else:
                sql = """
                    CREATE TABLE sso_tokens (
                        id SERIAL PRIMARY KEY,
                        token_hash CHAR(64) NOT NULL UNIQUE,
                        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        partner_id INT NULL REFERENCES partners(id),
                        campus_id INT NULL REFERENCES campuses(id),
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        expires_at TIMESTAMP NOT NULL,
                        consumed_at TIMESTAMP NULL,
                        issuer_ip VARCHAR(45) NULL
                    )
                """
            db.session.execute(text(sql))
            db.session.commit()
            print("  ✅ Tabla sso_tokens creada")
            try:
                db.session.execute(text("CREATE INDEX ix_sso_tokens_partner ON sso_tokens(partner_id)"))
                db.session.execute(text("CREATE INDEX ix_sso_tokens_campus ON sso_tokens(campus_id)"))
                db.session.execute(text("CREATE INDEX ix_sso_tokens_user ON sso_tokens(user_id)"))
                db.session.execute(text("CREATE INDEX ix_sso_tokens_expires ON sso_tokens(expires_at)"))
                db.session.commit()
            except Exception as idx_err:
                db.session.rollback()
                print(f"  ⚠️ índices sso_tokens: {idx_err}")
        else:
            # tabla ya existe → asegurar columna campus_id y aflojar partner_id
            cols = {c['name'] for c in inspector.get_columns('sso_tokens')}
            if 'campus_id' not in cols:
                try:
                    if db_type == 'mssql':
                        db.session.execute(text("ALTER TABLE sso_tokens ADD campus_id INT NULL"))
                    else:
                        db.session.execute(text("ALTER TABLE sso_tokens ADD COLUMN campus_id INTEGER NULL"))
                    db.session.commit()
                    print("  ✅ sso_tokens.campus_id agregada")
                except Exception as e:
                    db.session.rollback()
                    print(f"  ⚠️ sso_tokens.campus_id: {e}")
            # FK + índice
            try:
                if db_type == 'mssql':
                    db.session.execute(text(
                        "IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='fk_sso_tokens_campus') "
                        "ALTER TABLE sso_tokens ADD CONSTRAINT fk_sso_tokens_campus "
                        "FOREIGN KEY (campus_id) REFERENCES campuses(id)"
                    ))
                    db.session.execute(text(
                        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_sso_tokens_campus') "
                        "CREATE INDEX ix_sso_tokens_campus ON sso_tokens(campus_id)"
                    ))
                    db.session.commit()
            except Exception as e:
                db.session.rollback()
                if 'already' not in str(e).lower():
                    print(f"  ⚠️ FK/IX sso_tokens.campus_id: {e}")
            # Aflojar partner_id a NULLABLE (puede fallar si tiene NOT NULL,
            # pero está bien continuar — los inserts nuevos siempre llenan partner_id)
            try:
                if db_type == 'mssql':
                    db.session.execute(text("ALTER TABLE sso_tokens ALTER COLUMN partner_id INT NULL"))
                    db.session.commit()
            except Exception as e:
                db.session.rollback()
                # No es crítico
                pass

    except Exception as e:
        print(f"❌ Error en migración SSO Tokenización: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass



def check_and_create_study_export_requests_table():
    """Crea la tabla study_export_requests (solicitudes de exportación SCORM)."""
    print("🔍 Verificando tabla study_export_requests...")
    try:
        from app.models.study_export import StudyExportRequest  # noqa: F401

        inspector = inspect(db.engine)
        existing = set(inspector.get_table_names())
        if 'study_export_requests' in existing:
            print("  ✓ Tabla study_export_requests ya existe")
            return

        db_type = get_db_type()
        if db_type == 'mssql':
            sql = """
                CREATE TABLE study_export_requests (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    material_id INT NOT NULL,
                    requested_by VARCHAR(36) NULL,
                    reason NVARCHAR(MAX) NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    reviewed_by VARCHAR(36) NULL,
                    reviewed_at DATETIME2 NULL,
                    review_notes NVARCHAR(MAX) NULL,
                    consumed_at DATETIME2 NULL,
                    consumed_filename NVARCHAR(500) NULL,
                    size_bytes BIGINT NULL,
                    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    CONSTRAINT fk_ser_material FOREIGN KEY (material_id)
                        REFERENCES study_contents(id) ON DELETE CASCADE,
                    CONSTRAINT fk_ser_requester FOREIGN KEY (requested_by)
                        REFERENCES users(id) ON DELETE SET NULL,
                    CONSTRAINT fk_ser_reviewer FOREIGN KEY (reviewed_by)
                        REFERENCES users(id) ON DELETE NO ACTION
                )
            """
        elif db_type == 'postgresql':
            sql = """
                CREATE TABLE study_export_requests (
                    id SERIAL PRIMARY KEY,
                    material_id INT NOT NULL REFERENCES study_contents(id) ON DELETE CASCADE,
                    requested_by VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
                    reason TEXT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    reviewed_by VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
                    reviewed_at TIMESTAMP NULL,
                    review_notes TEXT NULL,
                    consumed_at TIMESTAMP NULL,
                    consumed_filename VARCHAR(500) NULL,
                    size_bytes BIGINT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """
        else:
            # SQLite
            sql = """
                CREATE TABLE study_export_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    material_id INTEGER NOT NULL,
                    requested_by VARCHAR(36) NULL,
                    reason TEXT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    reviewed_by VARCHAR(36) NULL,
                    reviewed_at DATETIME NULL,
                    review_notes TEXT NULL,
                    consumed_at DATETIME NULL,
                    consumed_filename VARCHAR(500) NULL,
                    size_bytes BIGINT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (material_id) REFERENCES study_contents(id) ON DELETE CASCADE
                )
            """
        db.session.execute(text(sql))
        db.session.commit()
        print("  ✅ Tabla study_export_requests creada")
        for idx_sql in [
            "CREATE INDEX ix_ser_material ON study_export_requests (material_id)",
            "CREATE INDEX ix_ser_status   ON study_export_requests (status)",
            "CREATE INDEX ix_ser_requester ON study_export_requests (requested_by)",
        ]:
            try:
                db.session.execute(text(idx_sql))
                db.session.commit()
            except Exception:
                db.session.rollback()
    except Exception as e:
        print(f"❌ Error creando study_export_requests: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
