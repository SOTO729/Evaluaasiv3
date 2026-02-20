"""
Migración: Balance por Grupo

Cambia el sistema de saldo de "global por coordinador" a "por grupo".
- Limpia todos los datos existentes de las 3 tablas de balance.
- Agrega columna group_id a coordinator_balances y balance_transactions.
- Reemplaza UNIQUE constraint de coordinator_id por (coordinator_id, group_id).
- Hace group_id NOT NULL en balance_requests.
"""
import pyodbc
import os
import sys

# Agregar el directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_connection():
    """Conectar directamente a Azure SQL"""
    server = 'evaluaasi-motorv2-sql.database.windows.net'
    database = 'evaluaasi'
    username = 'evaluaasi_admin'
    password = 'EvalAasi2024_newpwd!'
    
    conn_str = (
        f'DRIVER={{ODBC Driver 18 for SQL Server}};'
        f'SERVER={server};'
        f'DATABASE={database};'
        f'UID={username};'
        f'PWD={password};'
        f'Encrypt=yes;'
        f'TrustServerCertificate=no;'
    )
    return pyodbc.connect(conn_str)


def run_migration():
    conn = get_connection()
    cursor = conn.cursor()
    
    print("=" * 60)
    print("MIGRACIÓN: Balance por Grupo")
    print("=" * 60)
    
    try:
        # ===== PASO 1: Limpiar datos existentes =====
        print("\n[1/6] Limpiando datos existentes...")
        
        cursor.execute("SELECT COUNT(*) FROM balance_transactions")
        txn_count = cursor.fetchone()[0]
        print(f"  - balance_transactions: {txn_count} registros")
        
        cursor.execute("SELECT COUNT(*) FROM balance_requests")
        req_count = cursor.fetchone()[0]
        print(f"  - balance_requests: {req_count} registros")
        
        cursor.execute("SELECT COUNT(*) FROM coordinator_balances")
        bal_count = cursor.fetchone()[0]
        print(f"  - coordinator_balances: {bal_count} registros")
        
        # Eliminar en orden correcto (por dependencias FK)
        cursor.execute("DELETE FROM balance_transactions")
        cursor.execute("DELETE FROM balance_requests")
        cursor.execute("DELETE FROM coordinator_balances")
        conn.commit()
        print("  ✓ Datos eliminados exitosamente")
        
        # ===== PASO 2: Agregar group_id a coordinator_balances =====
        print("\n[2/6] Agregando group_id a coordinator_balances...")
        
        # Verificar si ya existe la columna
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'coordinator_balances' AND COLUMN_NAME = 'group_id'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                ALTER TABLE coordinator_balances 
                ADD group_id INT NOT NULL DEFAULT 0
            """)
            conn.commit()
            print("  ✓ Columna group_id agregada")
        else:
            print("  - Columna group_id ya existe")
        
        # ===== PASO 3: Quitar constraint UNIQUE de coordinator_id =====
        print("\n[3/6] Actualizando constraints de coordinator_balances...")
        
        # Encontrar y eliminar el constraint unique existente en coordinator_id
        cursor.execute("""
            SELECT tc.CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu 
                ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
            WHERE tc.TABLE_NAME = 'coordinator_balances' 
            AND tc.CONSTRAINT_TYPE = 'UNIQUE'
            AND ccu.COLUMN_NAME = 'coordinator_id'
        """)
        unique_constraints = cursor.fetchall()
        
        for row in unique_constraints:
            constraint_name = row[0]
            # Check if this constraint is on coordinator_id alone (not the composite one)
            cursor.execute(f"""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE
                WHERE CONSTRAINT_NAME = '{constraint_name}'
            """)
            col_count = cursor.fetchone()[0]
            if col_count == 1:  # Single column constraint on coordinator_id
                cursor.execute(f"ALTER TABLE coordinator_balances DROP CONSTRAINT [{constraint_name}]")
                print(f"  ✓ Eliminado constraint: {constraint_name}")
        
        conn.commit()
        
        # ===== PASO 4: Agregar FK y UNIQUE constraint nuevo =====
        print("\n[4/6] Agregando FK y constraint compuesto...")
        
        # Quitar el default 0 ya que las tablas están vacías
        cursor.execute("""
            SELECT dc.name 
            FROM sys.default_constraints dc
            JOIN sys.columns c ON dc.parent_column_id = c.column_id AND dc.parent_object_id = c.object_id
            WHERE c.name = 'group_id' AND OBJECT_NAME(dc.parent_object_id) = 'coordinator_balances'
        """)
        default_constraint = cursor.fetchone()
        if default_constraint:
            cursor.execute(f"ALTER TABLE coordinator_balances DROP CONSTRAINT [{default_constraint[0]}]")
            conn.commit()
        
        # Agregar FK a candidate_groups
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
            WHERE TABLE_NAME = 'coordinator_balances' 
            AND CONSTRAINT_NAME = 'fk_coordinator_balances_group'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                ALTER TABLE coordinator_balances 
                ADD CONSTRAINT fk_coordinator_balances_group
                FOREIGN KEY (group_id) REFERENCES candidate_groups(id) ON DELETE CASCADE
            """)
            print("  ✓ FK a candidate_groups agregada")
        
        # Agregar UNIQUE compuesto
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
            WHERE TABLE_NAME = 'coordinator_balances' 
            AND CONSTRAINT_NAME = 'uq_coordinator_group_balance'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                ALTER TABLE coordinator_balances 
                ADD CONSTRAINT uq_coordinator_group_balance
                UNIQUE (coordinator_id, group_id)
            """)
            print("  ✓ UNIQUE constraint (coordinator_id, group_id) agregado")
        
        conn.commit()
        
        # ===== PASO 5: Agregar group_id a balance_transactions =====
        print("\n[5/6] Agregando group_id a balance_transactions...")
        
        cursor.execute("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'balance_transactions' AND COLUMN_NAME = 'group_id'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                ALTER TABLE balance_transactions 
                ADD group_id INT NULL
            """)
            # FK con SET NULL para no perder transacciones si se borra un grupo
            cursor.execute("""
                ALTER TABLE balance_transactions 
                ADD CONSTRAINT fk_balance_transactions_group
                FOREIGN KEY (group_id) REFERENCES candidate_groups(id) ON DELETE SET NULL
            """)
            conn.commit()
            print("  ✓ Columna group_id y FK agregadas")
        else:
            print("  - Columna group_id ya existe")
        
        # ===== PASO 6: Hacer group_id NOT NULL en balance_requests =====
        print("\n[6/6] Haciendo group_id NOT NULL en balance_requests...")
        
        cursor.execute("""
            SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'balance_requests' AND COLUMN_NAME = 'group_id'
        """)
        result = cursor.fetchone()
        if result and result[0] == 'YES':
            # Primero eliminar FK si existe
            cursor.execute("""
                SELECT fk.name 
                FROM sys.foreign_keys fk
                JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
                WHERE OBJECT_NAME(fk.parent_object_id) = 'balance_requests' AND c.name = 'group_id'
            """)
            fk_row = cursor.fetchone()
            if fk_row:
                cursor.execute(f"ALTER TABLE balance_requests DROP CONSTRAINT [{fk_row[0]}]")
                conn.commit()
            
            cursor.execute("""
                ALTER TABLE balance_requests 
                ALTER COLUMN group_id INT NOT NULL
            """)
            
            # Recrear FK
            cursor.execute("""
                ALTER TABLE balance_requests 
                ADD CONSTRAINT fk_balance_requests_group
                FOREIGN KEY (group_id) REFERENCES candidate_groups(id)
            """)
            conn.commit()
            print("  ✓ group_id ahora es NOT NULL")
        else:
            print("  - group_id ya es NOT NULL")
        
        conn.commit()
        
        print("\n" + "=" * 60)
        print("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 60)
        print("\nResumen:")
        print(f"  - {txn_count} transacciones eliminadas")
        print(f"  - {req_count} solicitudes eliminadas")
        print(f"  - {bal_count} balances eliminados")
        print("  - coordinator_balances: ahora tiene group_id (UNIQUE con coordinator_id)")
        print("  - balance_transactions: ahora tiene group_id")
        print("  - balance_requests: group_id ahora es obligatorio")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    run_migration()
