#!/usr/bin/env python3
"""
Migración: Asignar coordinador a responsables existentes que no lo tienen.

- DEV: Asigna a "Oscar Correas" como coordinador
- PROD: Asigna a "coordinador de prueba" como coordinador

Uso:
  python assign_coordinator_migration.py --env dev
  python assign_coordinator_migration.py --env prod
  python assign_coordinator_migration.py --env dev --dry-run
"""
import pymssql
import argparse
import sys

DB_CONFIG = {
    'server': 'evaluaasi-motorv2-sql.database.windows.net',
    'user': 'evaluaasi_admin',
    'password': 'EvalAasi2024_newpwd!',
}

ENV_DB = {
    'dev': 'evaluaasi_dev',
    'prod': 'evaluaasi',
}

# Coordinadores a buscar por entorno
COORDINATOR_SEARCH = {
    'dev': {'name_like': 'OSCAR', 'surname_like': 'CORREAS'},
    'prod': {'name_like': 'coordinador', 'surname_like': 'prueba'},
}


def run_migration(env: str, dry_run: bool = False):
    db = ENV_DB.get(env)
    if not db:
        print(f"Entorno inválido: {env}. Use 'dev' o 'prod'.")
        sys.exit(1)

    search = COORDINATOR_SEARCH[env]
    conn = pymssql.connect(
        server=DB_CONFIG['server'],
        user=DB_CONFIG['user'],
        password=DB_CONFIG['password'],
        database=db,
    )
    cursor = conn.cursor(as_dict=True)

    print(f"\n{'=' * 60}")
    print(f"Migración: Asignar coordinador a responsables sin coordinador")
    print(f"Entorno: {env.upper()} | DB: {db}")
    if dry_run:
        print("MODO: DRY-RUN (sin cambios)")
    print(f"{'=' * 60}")

    # 1. Buscar coordinador
    cursor.execute(
        "SELECT id, name, first_surname, email, role FROM users "
        "WHERE role = 'coordinator' AND is_active = 1 "
        "AND LOWER(name) LIKE %s AND LOWER(first_surname) LIKE %s",
        (f"%{search['name_like'].lower()}%", f"%{search['surname_like'].lower()}%"),
    )
    coordinators = cursor.fetchall()

    if not coordinators:
        print("\n[ERROR] No se encontró coordinador con los criterios de búsqueda:")
        print(f"  name LIKE '%{search['name_like']}%'")
        print(f"  first_surname LIKE '%{search['surname_like']}%'")
        conn.close()
        sys.exit(1)

    coord = coordinators[0]
    print(f"\nCoordinador encontrado:")
    print(f"  ID: {coord['id']}")
    print(f"  Nombre: {coord['name']} {coord['first_surname']}")
    print(f"  Email: {coord['email']}")

    # 2. Buscar responsables sin coordinador
    cursor.execute(
        "SELECT id, name, first_surname, email, role FROM users "
        "WHERE role IN ('responsable', 'responsable_partner') "
        "AND coordinator_id IS NULL"
    )
    responsables = cursor.fetchall()

    print(f"\nResponsables sin coordinador: {len(responsables)}")
    for r in responsables:
        print(f"  - {r['name']} {r['first_surname']} ({r['email']}) [{r['role']}]")

    if not responsables:
        print("\nNo hay responsables por migrar.")
        conn.close()
        return

    # 3. Actualizar
    if not dry_run:
        cursor.execute(
            "UPDATE users SET coordinator_id = %s "
            "WHERE role IN ('responsable', 'responsable_partner') "
            "AND coordinator_id IS NULL",
            (coord['id'],),
        )
        affected = cursor.rowcount
        conn.commit()
        print(f"\n[OK] {affected} responsable(s) actualizado(s) con coordinator_id = {coord['id']}")
    else:
        print(f"\n[DRY-RUN] Se actualizarían {len(responsables)} responsable(s)")

    conn.close()
    print("\nMigración completada.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Asignar coordinador a responsables existentes')
    parser.add_argument('--env', required=True, choices=['dev', 'prod'], help='Entorno (dev/prod)')
    parser.add_argument('--dry-run', action='store_true', help='Solo mostrar qué se haría sin ejecutar')
    args = parser.parse_args()
    run_migration(args.env, args.dry_run)
