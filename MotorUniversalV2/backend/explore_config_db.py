"""Explorar todas las tablas de EvaluaasiConfig DB para encontrar info de Guacamole"""
import pymssql

conn = pymssql.connect(
    server='evaluaasi-general.database.windows.net',
    user='AdminGeneral',
    password='_N6I+fd:B0DeJ4rS76*wZ}]hP7Ur',
    database='EvaluaasiConfig'
)
c = conn.cursor()

# 1. All tables
c.execute("SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME")
print("=== ALL TABLES ===")
tables = c.fetchall()
for row in tables:
    print(f"  {row[0]}.{row[1]}")

# 2. Search for guacamole/connection related
print("\n=== SEARCHING FOR GUACAMOLE/CONNECTION INFO ===")
for schema, table in tables:
    c.execute(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='{schema}' AND TABLE_NAME='{table}'")
    cols = [r[0] for r in c.fetchall()]
    col_str = ", ".join(cols).lower()
    if any(kw in col_str for kw in ['guac', 'connection', 'remote', 'rdp', 'vnc', 'ip', 'hostname', 'url', 'server']):
        print(f"\n  >> {schema}.{table}: {', '.join(cols)}")
        c.execute(f"SELECT TOP 3 * FROM [{schema}].[{table}]")
        rows = c.fetchall()
        for r in rows:
            print(f"     {r}")

# 3. Check EquipoRegistrado (might have IPs)
print("\n=== dbo.EquipoRegistrado (sample) ===")
c.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='EquipoRegistrado'")
cols = [r[0] for r in c.fetchall()]
print(f"  Columns: {cols}")
c.execute("SELECT TOP 5 * FROM dbo.EquipoRegistrado")
for r in c.fetchall():
    print(f"  {r}")

# 4. Check if there's any table with connection strings, configs, or settings
print("\n=== LOOKING FOR CONFIG/SETTINGS TABLES ===")
for schema, table in tables:
    if any(kw in table.lower() for kw in ['config', 'setting', 'param', 'variable', 'connection']):
        print(f"\n  {schema}.{table}:")
        c.execute(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='{schema}' AND TABLE_NAME='{table}'")
        cols = [r[0] for r in c.fetchall()]
        print(f"  Columns: {cols}")
        c.execute(f"SELECT TOP 5 * FROM [{schema}].[{table}]")
        for r in c.fetchall():
            print(f"  {r}")

conn.close()
