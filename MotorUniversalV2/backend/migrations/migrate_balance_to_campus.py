"""
Migración: Saldos de nivel GRUPO → nivel PLANTEL (campus)

Cambios:
1. coordinator_balances: group_id → campus_id (merge duplicados sumando saldos)
2. balance_transactions: agregar campus_id (derivar de group → campus)
3. balance_requests: group_id pasa a nullable

Ejecutar: python migrations/migrate_balance_to_campus.py [prod|dev]
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pyodbc

# Credenciales
DB_SERVER = 'evaluaasi-motorv2-sql.database.windows.net'
DB_USER = 'evaluaasi_admin'
DB_PASS = 'EvalAasi2024_newpwd!'

def get_conn(env):
    db_name = 'evaluaasi' if env == 'prod' else 'evaluaasi_dev'
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={DB_SERVER};DATABASE={db_name};"
        f"UID={DB_USER};PWD={DB_PASS};"
        f"Encrypt=yes;TrustServerCertificate=no;"
    )
    return pyodbc.connect(conn_str)


def run_migration(env):
    print(f"\n{'='*60}")
    print(f"  Migración Balance grupo→campus  [{env.upper()}]")
    print(f"{'='*60}\n")
    
    conn = get_conn(env)
    cursor = conn.cursor()
    
    # ============================================================
    # PASO 0: Verificar estado actual
    # ============================================================
    print("[0] Verificando estado actual...")
    
    # Check if campus_id already exists in coordinator_balances
    cursor.execute("""
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'coordinator_balances' AND COLUMN_NAME = 'campus_id'
    """)
    campus_col_exists = cursor.fetchone()[0] > 0
    
    if campus_col_exists:
        # Check if group_id still exists
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'coordinator_balances' AND COLUMN_NAME = 'group_id'
        """)
        group_col_exists = cursor.fetchone()[0] > 0
        if not group_col_exists:
            print("    ✅ Migración ya aplicada (campus_id existe, group_id eliminado). Nada que hacer.")
            conn.close()
            return
        else:
            print("    ⚠️  campus_id existe pero group_id aún está. Continuando migración...")
    
    cursor.execute("SELECT COUNT(*) FROM coordinator_balances")
    bal_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM balance_transactions")
    txn_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM balance_requests")
    req_count = cursor.fetchone()[0]
    print(f"    Balances: {bal_count}, Transacciones: {txn_count}, Solicitudes: {req_count}")
    
    # ============================================================
    # PASO 1: coordinator_balances — agregar campus_id, migrar datos
    # ============================================================
    print("\n[1] coordinator_balances → agregar campus_id...")
    
    if not campus_col_exists:
        cursor.execute("""
            ALTER TABLE coordinator_balances 
            ADD campus_id INT NULL
        """)
        conn.commit()
        print("    ✅ Columna campus_id agregada")
    
    # Poblar campus_id desde grupo → campus
    cursor.execute("""
        UPDATE cb
        SET cb.campus_id = cg.campus_id
        FROM coordinator_balances cb
        INNER JOIN candidate_groups cg ON cb.group_id = cg.id
        WHERE cb.campus_id IS NULL
    """)
    updated = cursor.rowcount
    conn.commit()
    print(f"    ✅ {updated} registros actualizados con campus_id desde grupo")
    
    # Verificar si quedaron registros sin campus_id
    cursor.execute("SELECT COUNT(*) FROM coordinator_balances WHERE campus_id IS NULL")
    null_count = cursor.fetchone()[0]
    if null_count > 0:
        print(f"    ⚠️  {null_count} registros sin campus_id (grupo eliminado). Eliminando...")
        cursor.execute("DELETE FROM coordinator_balances WHERE campus_id IS NULL")
        conn.commit()
    
    # Mostrar datos antes de merge
    cursor.execute("""
        SELECT coordinator_id, campus_id, COUNT(*) as cnt, 
               SUM(CAST(current_balance AS FLOAT)) as total_balance
        FROM coordinator_balances 
        GROUP BY coordinator_id, campus_id
        HAVING COUNT(*) > 1
    """)
    duplicates = cursor.fetchall()
    if duplicates:
        print(f"\n    🔄 Mergeando {len(duplicates)} pares duplicados (mismo coordinador+campus)...")
        for dup in duplicates:
            coord_id, campus_id, cnt, total = dup
            print(f"       coord={coord_id[:12]}... campus={campus_id}: {cnt} registros → sumando ${total:.2f}")
        
        # Merge: mantener el registro con menor id, sumar los demás
        cursor.execute("""
            ;WITH Ranked AS (
                SELECT id, coordinator_id, campus_id, current_balance, 
                       total_received, total_spent, total_scholarships,
                       ROW_NUMBER() OVER(PARTITION BY coordinator_id, campus_id ORDER BY id) as rn
                FROM coordinator_balances
            ),
            Sums AS (
                SELECT coordinator_id, campus_id,
                       SUM(CAST(current_balance AS DECIMAL(12,2))) as sum_balance,
                       SUM(CAST(total_received AS DECIMAL(12,2))) as sum_received,
                       SUM(CAST(total_spent AS DECIMAL(12,2))) as sum_spent,
                       SUM(CAST(total_scholarships AS DECIMAL(12,2))) as sum_scholarships
                FROM coordinator_balances
                GROUP BY coordinator_id, campus_id
            )
            UPDATE cb
            SET cb.current_balance = s.sum_balance,
                cb.total_received = s.sum_received,
                cb.total_spent = s.sum_spent,
                cb.total_scholarships = s.sum_scholarships
            FROM coordinator_balances cb
            INNER JOIN Ranked r ON cb.id = r.id AND r.rn = 1
            INNER JOIN Sums s ON cb.coordinator_id = s.coordinator_id AND cb.campus_id = s.campus_id
        """)
        conn.commit()
        
        # Eliminar duplicados (mantener solo rn=1)
        cursor.execute("""
            ;WITH Ranked AS (
                SELECT id, ROW_NUMBER() OVER(PARTITION BY coordinator_id, campus_id ORDER BY id) as rn
                FROM coordinator_balances
            )
            DELETE FROM coordinator_balances WHERE id IN (
                SELECT id FROM Ranked WHERE rn > 1
            )
        """)
        deleted = cursor.rowcount
        conn.commit()
        print(f"    ✅ {deleted} registros duplicados eliminados (saldos sumados al primero)")
    else:
        print("    ✅ No hay duplicados que mergear")
    
    # ============================================================
    # PASO 2: Eliminar constraint antiguo, crear nuevo
    # ============================================================
    print("\n[2] Actualizando constraints en coordinator_balances...")
    
    # Drop old unique constraint (check both key_constraints and indexes)
    cursor.execute("""
        SELECT name FROM sys.key_constraints 
        WHERE type = 'UQ' AND parent_object_id = OBJECT_ID('coordinator_balances')
        AND name LIKE '%coordinator_group%'
    """)
    old_uq = cursor.fetchone()
    if old_uq:
        cursor.execute(f"ALTER TABLE coordinator_balances DROP CONSTRAINT [{old_uq[0]}]")
        conn.commit()
        print(f"    ✅ Constraint {old_uq[0]} eliminado")
    else:
        # Also check unique indexes (may be stored as index rather than constraint)
        cursor.execute("""
            SELECT i.name 
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE i.object_id = OBJECT_ID('coordinator_balances')
            AND i.is_unique = 1
            AND c.name = 'group_id'
        """)
        old_idx = cursor.fetchone()
        if old_idx:
            cursor.execute(f"DROP INDEX [{old_idx[0]}] ON coordinator_balances")
            conn.commit()
            print(f"    ✅ Unique index {old_idx[0]} eliminado")
        else:
            print("    ℹ️  No se encontró constraint/index único de group_id")
    
    # Drop FK to candidate_groups on coordinator_balances.group_id
    cursor.execute("""
        SELECT fk.name 
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
        WHERE fk.parent_object_id = OBJECT_ID('coordinator_balances')
        AND c.name = 'group_id'
    """)
    old_fk = cursor.fetchone()
    if old_fk:
        cursor.execute(f"ALTER TABLE coordinator_balances DROP CONSTRAINT [{old_fk[0]}]")
        conn.commit()
        print(f"    ✅ FK {old_fk[0]} eliminado")
    
    # Drop group_id column
    cursor.execute("""
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'coordinator_balances' AND COLUMN_NAME = 'group_id'
    """)
    if cursor.fetchone()[0] > 0:
        cursor.execute("ALTER TABLE coordinator_balances DROP COLUMN group_id")
        conn.commit()
        print("    ✅ Columna group_id eliminada")
    
    # Make campus_id NOT NULL
    cursor.execute("""
        ALTER TABLE coordinator_balances 
        ALTER COLUMN campus_id INT NOT NULL
    """)
    conn.commit()
    
    # Add FK to campuses
    cursor.execute("""
        SELECT COUNT(*) FROM sys.foreign_keys 
        WHERE name = 'fk_coordinator_balances_campus'
    """)
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            ALTER TABLE coordinator_balances 
            ADD CONSTRAINT fk_coordinator_balances_campus 
            FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE
        """)
        conn.commit()
        print("    ✅ FK campus_id → campuses.id creado")
    
    # Add unique constraint
    cursor.execute("""
        SELECT COUNT(*) FROM sys.key_constraints 
        WHERE name = 'uq_coordinator_campus_balance'
    """)
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            ALTER TABLE coordinator_balances 
            ADD CONSTRAINT uq_coordinator_campus_balance 
            UNIQUE (coordinator_id, campus_id)
        """)
        conn.commit()
        print("    ✅ Unique constraint (coordinator_id, campus_id) creado")
    
    # ============================================================
    # PASO 3: balance_transactions — agregar campus_id
    # ============================================================
    print("\n[3] balance_transactions → agregar campus_id...")
    
    cursor.execute("""
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'balance_transactions' AND COLUMN_NAME = 'campus_id'
    """)
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            ALTER TABLE balance_transactions 
            ADD campus_id INT NULL
        """)
        conn.commit()
        print("    ✅ Columna campus_id agregada")
        
        # Poblar desde grupo → campus
        cursor.execute("""
            UPDATE bt
            SET bt.campus_id = cg.campus_id
            FROM balance_transactions bt
            INNER JOIN candidate_groups cg ON bt.group_id = cg.id
            WHERE bt.campus_id IS NULL AND bt.group_id IS NOT NULL
        """)
        updated = cursor.rowcount
        conn.commit()
        print(f"    ✅ {updated} transacciones actualizadas con campus_id")
        
        # Add FK
        cursor.execute("""
            ALTER TABLE balance_transactions 
            ADD CONSTRAINT fk_balance_transactions_campus 
            FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE SET NULL
        """)
        conn.commit()
        print("    ✅ FK campus_id → campuses.id creado")
    else:
        print("    ✅ Columna campus_id ya existe")
    
    # ============================================================
    # PASO 4: balance_requests — hacer group_id nullable
    # ============================================================
    print("\n[4] balance_requests → group_id nullable...")
    
    # Check current nullability
    cursor.execute("""
        SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'balance_requests' AND COLUMN_NAME = 'group_id'
    """)
    row = cursor.fetchone()
    if row and row[0] == 'NO':
        # Need to drop FK first if exists
        cursor.execute("""
            SELECT fk.name 
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
            WHERE fk.parent_object_id = OBJECT_ID('balance_requests')
            AND c.name = 'group_id'
        """)
        fk = cursor.fetchone()
        if fk:
            cursor.execute(f"ALTER TABLE balance_requests DROP CONSTRAINT [{fk[0]}]")
            conn.commit()
        
        cursor.execute("""
            ALTER TABLE balance_requests 
            ALTER COLUMN group_id INT NULL
        """)
        conn.commit()
        
        # Re-add FK with SET NULL
        cursor.execute("""
            ALTER TABLE balance_requests 
            ADD CONSTRAINT fk_balance_requests_group 
            FOREIGN KEY (group_id) REFERENCES candidate_groups(id) ON DELETE SET NULL
        """)
        conn.commit()
        print("    ✅ group_id ahora es nullable")
    else:
        print("    ✅ group_id ya es nullable")
    
    # Make campus_id NOT NULL in balance_requests
    cursor.execute("""
        SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'balance_requests' AND COLUMN_NAME = 'campus_id'
    """)
    row = cursor.fetchone()
    if row and row[0] == 'YES':
        # First ensure all rows have campus_id
        cursor.execute("""
            UPDATE br
            SET br.campus_id = cg.campus_id
            FROM balance_requests br
            INNER JOIN candidate_groups cg ON br.group_id = cg.id
            WHERE br.campus_id IS NULL AND br.group_id IS NOT NULL
        """)
        updated = cursor.rowcount
        if updated > 0:
            print(f"    ✅ {updated} solicitudes sin campus_id actualizadas desde grupo")
        conn.commit()
        
        # Check for remaining NULLs
        cursor.execute("SELECT COUNT(*) FROM balance_requests WHERE campus_id IS NULL")
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            print(f"    ⚠️  {null_count} solicitudes sin campus_id. No se puede hacer NOT NULL aún.")
        else:
            # Drop FK on campus_id if exists
            cursor.execute("""
                SELECT fk.name 
                FROM sys.foreign_keys fk
                INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
                WHERE fk.parent_object_id = OBJECT_ID('balance_requests')
                AND c.name = 'campus_id'
            """)
            fk = cursor.fetchone()
            if fk:
                cursor.execute(f"ALTER TABLE balance_requests DROP CONSTRAINT [{fk[0]}]")
                conn.commit()
            
            cursor.execute("""
                ALTER TABLE balance_requests 
                ALTER COLUMN campus_id INT NOT NULL
            """)
            conn.commit()
            
            # Re-add FK
            cursor.execute("""
                ALTER TABLE balance_requests 
                ADD CONSTRAINT fk_balance_requests_campus 
                FOREIGN KEY (campus_id) REFERENCES campuses(id)
            """)
            conn.commit()
            print("    ✅ campus_id ahora es NOT NULL")
    else:
        print("    ✅ campus_id ya es NOT NULL")
    
    # ============================================================
    # PASO 5: Verificar resultado final
    # ============================================================
    print(f"\n[5] Verificación final...")
    
    cursor.execute("SELECT COUNT(*) FROM coordinator_balances")
    bal_count = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT coordinator_id, campus_id, 
               CAST(current_balance AS FLOAT) as balance,
               CAST(total_received AS FLOAT) as received,
               CAST(total_spent AS FLOAT) as spent
        FROM coordinator_balances
        ORDER BY coordinator_id, campus_id
    """)
    rows = cursor.fetchall()
    print(f"    coordinator_balances: {bal_count} registros")
    for r in rows:
        print(f"      coord={r[0][:12]}... campus={r[1]}: balance=${r[2]:.2f}, received=${r[3]:.2f}, spent=${r[4]:.2f}")
    
    # Verify columns
    cursor.execute("""
        SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'coordinator_balances'
        ORDER BY ORDINAL_POSITION
    """)
    print("\n    Columnas coordinator_balances:")
    for col in cursor.fetchall():
        print(f"      {col[0]}: {col[2]} {'NULL' if col[1]=='YES' else 'NOT NULL'}")
    
    cursor.execute("""
        SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'balance_transactions' AND COLUMN_NAME IN ('campus_id', 'group_id')
    """)
    print("\n    balance_transactions (campus_id / group_id):")
    for col in cursor.fetchall():
        print(f"      {col[0]}: {col[2]} {'NULL' if col[1]=='YES' else 'NOT NULL'}")
    
    cursor.execute("""
        SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'balance_requests' AND COLUMN_NAME IN ('campus_id', 'group_id')
    """)
    print("\n    balance_requests (campus_id / group_id):")
    for col in cursor.fetchall():
        print(f"      {col[0]}: {col[2]} {'NULL' if col[1]=='YES' else 'NOT NULL'}")
    
    conn.close()
    print(f"\n{'='*60}")
    print(f"  ✅ MIGRACIÓN COMPLETADA [{env.upper()}]")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('dev', 'prod'):
        print("Uso: python migrations/migrate_balance_to_campus.py [dev|prod]")
        sys.exit(1)
    
    env = sys.argv[1]
    
    if env == 'prod':
        confirm = input("⚠️  ¿Ejecutar en PRODUCCIÓN? (escribir 'si'): ")
        if confirm.strip().lower() != 'si':
            print("Cancelado")
            sys.exit(0)
    
    run_migration(env)
