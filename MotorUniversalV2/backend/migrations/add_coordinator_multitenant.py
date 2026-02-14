"""
Migración: Agregar columnas coordinator_id para multi-tenancy de coordinadores

Agrega:
- partners.coordinator_id (VARCHAR(36), FK → users.id, nullable)
- users.coordinator_id (VARCHAR(36), FK → users.id, nullable)
- Índices en ambas columnas
"""
import os
import sys
import pymssql

# Configuración de conexión
DB_SERVER = os.getenv('DB_SERVER', 'evaluaasi-motorv2-sql.database.windows.net')
DB_USER = os.getenv('DB_USER', 'evaluaasi_admin')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'EvalAasi2024_newpwd!')
DB_NAME = os.getenv('DB_NAME', 'evaluaasi')


def run_migration():
    """Ejecutar la migración"""
    print(f"Conectando a {DB_SERVER}/{DB_NAME}...")
    
    conn = pymssql.connect(
        server=DB_SERVER,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        tds_version='7.3'
    )
    cursor = conn.cursor()
    
    try:
        # 1. Agregar coordinator_id a partners
        print("\n1. Verificando columna coordinator_id en partners...")
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'partners' AND COLUMN_NAME = 'coordinator_id'
        """)
        exists = cursor.fetchone()[0]
        
        if exists:
            print("   ✓ Columna partners.coordinator_id ya existe")
        else:
            print("   Agregando partners.coordinator_id...")
            cursor.execute("""
                ALTER TABLE partners 
                ADD coordinator_id VARCHAR(36) NULL
            """)
            conn.commit()
            
            # FK constraint
            cursor.execute("""
                ALTER TABLE partners 
                ADD CONSTRAINT FK_partners_coordinator 
                FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL
            """)
            conn.commit()
            
            # Índice
            cursor.execute("""
                CREATE NONCLUSTERED INDEX IX_partners_coordinator_id 
                ON partners(coordinator_id)
            """)
            conn.commit()
            print("   ✓ Columna partners.coordinator_id creada con FK e índice")
        
        # 2. Agregar coordinator_id a users
        print("\n2. Verificando columna coordinator_id en users...")
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'coordinator_id'
        """)
        exists = cursor.fetchone()[0]
        
        if exists:
            print("   ✓ Columna users.coordinator_id ya existe")
        else:
            print("   Agregando users.coordinator_id...")
            cursor.execute("""
                ALTER TABLE users 
                ADD coordinator_id VARCHAR(36) NULL
            """)
            conn.commit()
            
            # FK constraint (self-referencing)
            cursor.execute("""
                ALTER TABLE users 
                ADD CONSTRAINT FK_users_coordinator 
                FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE NO ACTION
            """)
            conn.commit()
            
            # Índice
            cursor.execute("""
                CREATE NONCLUSTERED INDEX IX_users_coordinator_id 
                ON users(coordinator_id)
            """)
            conn.commit()
            print("   ✓ Columna users.coordinator_id creada con FK e índice")
        
        # 3. Backfill: Asignar el coordinador existente como dueño de todos los datos
        print("\n3. Buscando coordinador existente para backfill...")
        cursor.execute("""
            SELECT id, username, name, first_surname 
            FROM users 
            WHERE role = 'coordinator' AND is_active = 1
        """)
        coordinators = cursor.fetchall()
        
        if coordinators:
            coord = coordinators[0]
            coord_id = coord[0]
            coord_name = f"{coord[2]} {coord[3]}"
            print(f"   Coordinador encontrado: {coord_name} (ID: {coord_id})")
            
            # Asignar todos los partners al coordinador
            cursor.execute("""
                UPDATE partners SET coordinator_id = %s 
                WHERE coordinator_id IS NULL
            """, (coord_id,))
            partners_updated = cursor.rowcount
            conn.commit()
            print(f"   ✓ {partners_updated} partners asignados al coordinador")
            
            # Asignar usuarios candidato/responsable/responsable_partner al coordinador
            cursor.execute("""
                UPDATE users SET coordinator_id = %s 
                WHERE role IN ('candidato', 'responsable', 'responsable_partner') 
                AND coordinator_id IS NULL
            """, (coord_id,))
            users_updated = cursor.rowcount
            conn.commit()
            print(f"   ✓ {users_updated} usuarios asignados al coordinador")
        else:
            print("   ⚠ No se encontró ningún coordinador activo. Omitiendo backfill.")
        
        print("\n✅ Migración completada exitosamente")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error en la migración: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    run_migration()
