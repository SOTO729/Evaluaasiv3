"""
Script para crear la tabla group_study_materials en SQL Server
"""
from app import create_app
from app.models import db
from sqlalchemy import text

def create_tables():
    app = create_app()
    with app.app_context():
        print("=" * 60)
        print("CREANDO TABLAS PARA MATERIALES DE ESTUDIO DE GRUPOS")
        print("=" * 60)
        
        # Verificar tablas existentes
        result = db.session.execute(text("""
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
        """))
        tables = [row[0].lower() for row in result]
        
        print(f"\nTablas encontradas: {len(tables)}")
        
        # 1. Crear tabla group_study_materials
        if 'group_study_materials' not in tables:
            print("\n📝 Creando tabla 'group_study_materials'...")
            try:
                db.session.execute(text("""
                    CREATE TABLE group_study_materials (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        group_id INT NOT NULL,
                        study_material_id INT NOT NULL,
                        assigned_at DATETIME DEFAULT GETDATE() NOT NULL,
                        assigned_by_id VARCHAR(36) NULL,
                        available_from DATETIME NULL,
                        available_until DATETIME NULL,
                        assignment_type VARCHAR(20) DEFAULT 'all' NOT NULL,
                        is_active BIT DEFAULT 1 NOT NULL,
                        CONSTRAINT fk_gsm_group FOREIGN KEY (group_id) 
                            REFERENCES candidate_groups(id) ON DELETE CASCADE,
                        CONSTRAINT fk_gsm_material FOREIGN KEY (study_material_id) 
                            REFERENCES study_contents(id) ON DELETE CASCADE,
                        CONSTRAINT uq_group_study_material UNIQUE (group_id, study_material_id)
                    )
                """))
                db.session.commit()
                print("   ✅ Tabla 'group_study_materials' creada exitosamente")
            except Exception as e:
                if 'already exists' in str(e).lower():
                    print("   ⚠️  Tabla 'group_study_materials' ya existe")
                else:
                    print(f"   ❌ Error: {e}")
                    db.session.rollback()
        else:
            print("\n✅ Tabla 'group_study_materials' ya existe")
        
        # 2. Crear tabla group_study_material_members
        if 'group_study_material_members' not in tables:
            print("\n📝 Creando tabla 'group_study_material_members'...")
            try:
                db.session.execute(text("""
                    CREATE TABLE group_study_material_members (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        group_study_material_id INT NOT NULL,
                        user_id VARCHAR(36) NOT NULL,
                        assigned_at DATETIME DEFAULT GETDATE() NOT NULL,
                        CONSTRAINT fk_gsmm_material FOREIGN KEY (group_study_material_id) 
                            REFERENCES group_study_materials(id) ON DELETE CASCADE,
                        CONSTRAINT uq_group_study_material_member UNIQUE (group_study_material_id, user_id)
                    )
                """))
                db.session.commit()
                print("   ✅ Tabla 'group_study_material_members' creada exitosamente")
            except Exception as e:
                if 'already exists' in str(e).lower():
                    print("   ⚠️  Tabla 'group_study_material_members' ya existe")
                else:
                    print(f"   ❌ Error: {e}")
                    db.session.rollback()
        else:
            print("\n✅ Tabla 'group_study_material_members' ya existe")
        
        # Verificar tablas después
        result = db.session.execute(text("""
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE '%group_study%'
        """))
        new_tables = [row[0] for row in result]
        
        print("\n" + "=" * 60)
        print("TABLAS DE MATERIALES DE GRUPO:")
        for t in new_tables:
            print(f"  ✓ {t}")
        print("=" * 60)

if __name__ == '__main__':
    create_tables()
