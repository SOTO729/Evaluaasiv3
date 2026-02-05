#!/usr/bin/env python3
"""
Auto-migración: Agregar columnas faltantes a exercise_actions y study_interactive_exercise_actions si no existen
Este script se ejecuta automáticamente al iniciar el backend
Compatible con PostgreSQL y SQL Server
"""
from app import db
from sqlalchemy import text, inspect

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
                # Vigencia
                'license_start_date': 'DATE',
                'license_end_date': 'DATE',
                # Costos
                'certification_cost': 'DECIMAL(10,2) DEFAULT 0',
                'retake_cost': 'DECIMAL(10,2) DEFAULT 0',
                # Estado de configuración
                'configuration_completed': 'BIT DEFAULT 0' if db_type == 'mssql' else 'BOOLEAN DEFAULT FALSE',
                'configuration_completed_at': 'DATETIME' if db_type == 'mssql' else 'TIMESTAMP',
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
