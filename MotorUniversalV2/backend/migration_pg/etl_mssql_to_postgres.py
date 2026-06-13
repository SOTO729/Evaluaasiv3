"""
ETL idempotente: copia datos MSSQL → PostgreSQL usando la metadata de los modelos.

Uso:
    set SOURCE_DATABASE_URL=mssql+pymssql://user:pass@server/evaluaasi_dev
    set TARGET_DATABASE_URL=postgresql://user:pass@host:5432/evaluaasi_dev
    python migration_pg/etl_mssql_to_postgres.py [--truncate]

- Usa db.metadata.sorted_tables (orden por dependencias de FK).
- --truncate: vacía el destino (TRUNCATE ... CASCADE en orden inverso) antes de cargar;
  sin el flag, aborta si el destino tiene datos.
- Los tipos (Boolean BIT→boolean, JSON NVARCHAR→json, DateTime) los adapta SQLAlchemy
  porque ambos engines usan la MISMA metadata de los modelos.
- Al final ejecuta setval() en todas las secuencias de PKs Integer.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SOURCE = os.environ.get('SOURCE_DATABASE_URL')
TARGET = os.environ.get('TARGET_DATABASE_URL')
TRUNCATE = '--truncate' in sys.argv
CHUNK = 1000

if not SOURCE or not TARGET or not TARGET.startswith('postgresql'):
    print('ERROR: define SOURCE_DATABASE_URL (mssql) y TARGET_DATABASE_URL (postgresql)')
    sys.exit(1)

os.environ['DATABASE_URL'] = TARGET  # la app no se usa para conectar, solo importa modelos
os.environ['FLASK_ENV'] = 'development'

from app import create_app, db  # noqa: E402
from sqlalchemy import create_engine, select, func, text, Integer  # noqa: E402

app = create_app('development')

with app.app_context():
    metadata = db.metadata
    sorted_tables = metadata.sorted_tables

src_engine = create_engine(SOURCE, pool_pre_ping=True)
tgt_engine = create_engine(TARGET, pool_pre_ping=True)

print(f'Origen : {src_engine.url.render_as_string(hide_password=True)}')
print(f'Destino: {tgt_engine.url.render_as_string(hide_password=True)}')
print(f'Tablas en metadata: {len(sorted_tables)}')

# ── Tablas existentes en ambos lados ──────────────────────────────────────────
from sqlalchemy import inspect as sa_inspect  # noqa: E402
src_tables = set(sa_inspect(src_engine).get_table_names())
tgt_tables = set(sa_inspect(tgt_engine).get_table_names())

plan = [t for t in sorted_tables if t.name in src_tables and t.name in tgt_tables]
skipped_src = [t.name for t in sorted_tables if t.name not in src_tables]
skipped_tgt = [t.name for t in sorted_tables if t.name in src_tables and t.name not in tgt_tables]
if skipped_src:
    print(f'⚠ No existen en ORIGEN (se omiten): {skipped_src}')
if skipped_tgt:
    print(f'⚠ No existen en DESTINO (¡revisa el esquema!): {skipped_tgt}')

# ── Pre-chequeo / truncate ────────────────────────────────────────────────────
with tgt_engine.connect() as conn:
    non_empty = []
    for t in plan:
        cnt = conn.execute(select(func.count()).select_from(t)).scalar()
        if cnt:
            non_empty.append((t.name, cnt))
    if non_empty and not TRUNCATE:
        print(f'ERROR: el destino tiene datos en {len(non_empty)} tablas (ej. {non_empty[:3]}).')
        print('Corre con --truncate para vaciarlo primero.')
        sys.exit(2)

if TRUNCATE:
    print('TRUNCATE en destino (orden inverso de FKs)...')
    with tgt_engine.begin() as conn:
        for t in reversed(plan):
            conn.execute(text(f'TRUNCATE TABLE "{t.name}" CASCADE'))
    print('  OK')

# ── Carga ─────────────────────────────────────────────────────────────────────
# El esquema tiene ciclos de FK (users → campuses → partners → users), así que
# sorted_tables no garantiza un orden válido. Desactivamos la validación de FKs
# en la SESIÓN de carga con session_replication_role=replica (los datos vienen
# de una BD consistente; la validación real la hace validate_migration.py).
report = []
t0 = time.time()
with tgt_engine.connect() as conn:
    try:
        conn.execute(text('SET session_replication_role = replica'))
        conn.commit()
        print('FK enforcement desactivado en la sesión (session_replication_role=replica)')
    except Exception as e:
        print(f'ERROR: no se pudo desactivar FK enforcement: {e}')
        print('Opción: habilitarlo a nivel servidor temporalmente con')
        print('  az postgres flexible-server parameter set --resource-group evaluaasi-motorv2-rg \\')
        print('    --server-name evaluaasi-motorv2-pg --name session_replication_role --value replica')
        sys.exit(3)

    for t in plan:
        start = time.time()
        with src_engine.connect() as sconn:
            rows = sconn.execute(select(t)).mappings().all()
        total = len(rows)
        if total == 0:
            report.append((t.name, 0, 0.0))
            continue

        # Drift de esquema: columnas que en MSSQL traen NULL (se agregaron
        # nullables vía auto_migrate) pero el modelo declara NOT NULL con
        # default escalar → rellenar con el default del modelo.
        fill_defaults = {}
        for col in t.columns:
            if not col.nullable and col.default is not None and getattr(col.default, 'is_scalar', False):
                fill_defaults[col.name] = col.default.arg
        fills = 0

        trans = conn.begin()
        try:
            for i in range(0, total, CHUNK):
                chunk = [dict(r) for r in rows[i:i + CHUNK]]
                if fill_defaults:
                    for r in chunk:
                        for k, v in fill_defaults.items():
                            if r.get(k) is None:
                                r[k] = v
                                fills += 1
                conn.execute(t.insert(), chunk)
            trans.commit()
        except Exception:
            trans.rollback()
            raise
        dt = time.time() - start
        report.append((t.name, total, dt))
        extra = f' ({fills} NULLs rellenados con default del modelo)' if fills else ''
        print(f'  {t.name}: {total} filas en {dt:.1f}s{extra}')

    try:
        conn.execute(text('SET session_replication_role = DEFAULT'))
        conn.commit()
    except Exception:
        # Azure puede negar el reset explícito; es inofensivo: el parámetro es
        # de sesión y muere al cerrar la conexión.
        conn.rollback()

# ── setval de secuencias (PKs Integer autoincrement) ─────────────────────────
print('\nAjustando secuencias (setval)...')
seq_count = 0
with tgt_engine.begin() as conn:
    for t in plan:
        pks = list(t.primary_key.columns)
        if len(pks) == 1 and isinstance(pks[0].type, Integer) and pks[0].autoincrement is not False:
            col = pks[0].name
            seq = conn.execute(
                text("SELECT pg_get_serial_sequence(:tbl, :col)"),
                {'tbl': t.name, 'col': col}
            ).scalar()
            if seq:
                conn.execute(text(
                    f'SELECT setval(:seq, COALESCE((SELECT MAX("{col}") FROM "{t.name}"), 0) + 1, false)'
                ), {'seq': seq})
                seq_count += 1
print(f'  {seq_count} secuencias ajustadas')

total_rows = sum(r[1] for r in report)
print(f'\n✅ ETL completo: {total_rows} filas en {len(plan)} tablas, {time.time() - t0:.0f}s')
print('Siguiente paso: python migration_pg/validate_migration.py')
