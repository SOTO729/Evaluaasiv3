import pymssql
import sys

def run_diagnostics(cursor, db_name):
    print(f"\n=== {db_name.upper()} ===")
    
    # 1. Get Coordinator Info
    cursor.execute("SELECT id, username, role, coordinator_id, campus_id, is_active, is_deleted FROM users WHERE username='UM2TUKZKQG'")
    coord = cursor.fetchone()
    if not coord:
        print(f"Coordinator UM2TUKZKQG not found in {db_name}.")
        return
    
    coord_id = coord[0]
    # Check if coord_id is a string (UUID) and wrap it in single quotes for SQL
    sql_coord_id = f"'{coord_id}'" if isinstance(coord_id, str) else str(coord_id)
    
    print(f"Coordinator found: ID={coord_id}, Username={coord[1]}, Role={coord[2]}, CampusID={coord[4]}")

    # 2. Get Campuses managed by this coordinator
    cursor.execute("SELECT id, name, coordinator_id, responsable_id FROM campuses WHERE coordinator_id=%s", (coord_id,))
    campuses = cursor.fetchall()
    print(f"\nCampuses managed by coordinator (coordinator_id={coord_id}):")
    for c in campuses:
        print(f"  - ID: {c[0]}, Name: {c[1]}, ResponsableID: {c[3]}")

    # 3. Exact Visibility Query
    visibility_query = """
    SELECT id, username, role, coordinator_id, campus_id, is_active, is_deleted
    FROM users
    WHERE is_deleted = 0
      AND role IN ('responsable','responsable_partner','responsable_estatal','auxiliar')
      AND (
         coordinator_id = %s
         OR campus_id IN (SELECT id FROM campuses WHERE coordinator_id=%s)
         OR id IN (SELECT responsable_id FROM campuses WHERE coordinator_id=%s AND responsable_id IS NOT NULL)
      )
    """
    cursor.execute(visibility_query, (coord_id, coord_id, coord_id))
    visible_users = cursor.fetchall()
    print(f"\nVisible users ({len(visible_users)} found):")
    for u in visible_users:
        print(f"  - ID: {u[0]}, Username: {u[1]}, Role: {u[2]}, CoordID: {u[3]}, CampusID: {u[4]}")

    # 4. Total count and Potential visibility
    count_query = """
    SELECT u.id, u.username, u.role, u.coordinator_id, u.campus_id, c.id AS campus_owned, c.coordinator_id AS campus_coord
    FROM users u
    LEFT JOIN campuses c ON c.id = u.campus_id
    WHERE u.role IN ('responsable','responsable_partner','responsable_estatal','auxiliar')
      AND u.is_deleted=0
      AND (c.coordinator_id = %s OR u.coordinator_id = %s)
    """
    cursor.execute(count_query, (coord_id, coord_id))
    potential_users = cursor.fetchall()
    print(f"\nPotential users via Campus connection or direct Coord link ({len(potential_users)} found):")
    for p in potential_users:
        print(f"  - ID: {p[0]}, Username: {p[1]}, Role: {p[2]}, CoordID: {p[3]}, CampusID: {p[4]}, CampusCoord: {p[6]}")

server = 'evaluaasi-motorv2-sql.database.windows.net'
user = 'evaluaasi_admin'
password = 'EvalAasi2024_newpwd!'

for db in ['evaluaasi_dev', 'evaluaasi']:
    try:
        conn = pymssql.connect(server, user, password, db)
        cursor = conn.cursor()
        run_diagnostics(cursor, db)
        conn.close()
    except Exception as e:
        print(f"\n=== {db.upper()} ===\nError connecting or running query: {e}")

