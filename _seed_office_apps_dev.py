"""Seed/upsert OfficeAppVersion in DEV for the 3 Office 2019 exams.

Idempotent: usa MERGE-style upsert (delete-then-insert por app_name).
"""
import pymssql

SERVER = 'evaluaasi-motorv2-sql.database.windows.net'
USER = 'evaluaasi_admin'
PASSWORD = 'EvalAasi2024_newpwd!'
DATABASE = 'evaluaasi_dev'

BASE_URL = 'https://evaluaasimotorv2storage.blob.core.windows.net/vb6-downloads/dev'

# (app_name, app_type, min_version, latest_version, download_url, is_active)
ENTRIES = [
    ('examen_1', 'examen', '8.01.0014', '8.01.0014', f'{BASE_URL}/Examen_Word_2019v8.1.14.exe',       1),
    ('examen_2', 'examen', '8.01.0010', '8.01.0010', f'{BASE_URL}/Examen_Excel_2019v8.1.10.exe',      1),
    ('examen_3', 'examen', '8.01.0011', '8.01.0011', f'{BASE_URL}/Examen_PowerPoint_2019v8.1.11.exe', 1),
]

def main():
    conn = pymssql.connect(server=SERVER, user=USER, password=PASSWORD, database=DATABASE)
    cur = conn.cursor(as_dict=True)
    print(f'-- Connected to {DATABASE} --')
    for app_name, app_type, minv, latest, url, active in ENTRIES:
        cur.execute('SELECT id, min_version, latest_version, download_url FROM office_app_versions WHERE app_name=%s', (app_name,))
        existing = cur.fetchone()
        if existing:
            cur.execute(
                'UPDATE office_app_versions SET app_type=%s, min_version=%s, latest_version=%s, download_url=%s, is_active=%s WHERE app_name=%s',
                (app_type, minv, latest, url, active, app_name),
            )
            print(f'UPDATED  {app_name}  ({existing}) -> min={minv} latest={latest} url={url}')
        else:
            cur.execute(
                'INSERT INTO office_app_versions (app_name, app_type, min_version, latest_version, download_url, is_active) VALUES (%s,%s,%s,%s,%s,%s)',
                (app_name, app_type, minv, latest, url, active),
            )
            print(f'INSERTED {app_name} -> min={minv} latest={latest} url={url}')
    conn.commit()
    print('\n-- Final state for examen_* --')
    cur.execute("SELECT id, app_name, app_type, min_version, latest_version, download_url, is_active FROM office_app_versions WHERE app_type='examen' ORDER BY app_name")
    for row in cur.fetchall():
        print(f"  {row['id']:>3}  {row['app_name']:<30}  {row['app_type']:<10}  min={row['min_version']:<10} latest={row['latest_version']:<10}  active={row['is_active']}  url={row['download_url']}")
    conn.close()

if __name__ == '__main__':
    main()
