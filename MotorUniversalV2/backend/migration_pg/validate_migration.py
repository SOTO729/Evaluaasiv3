"""
Validación post-ETL: compara MSSQL (origen) vs PostgreSQL (destino).

Uso:
    set SOURCE_DATABASE_URL=mssql+pymssql://user:pass@server/evaluaasi_dev
    set TARGET_DATABASE_URL=postgresql://user:pass@host:5432/evaluaasi_dev
    python migration_pg/validate_migration.py [--sample N]

Por tabla: conteo de filas, suma/min/max de columnas numéricas y de fecha,
conteo de NULLs por columna, y muestreo aleatorio de N filas (default 5)
comparadas campo a campo. Imprime PASS/FAIL por tabla y resumen final.
Exit code 0 = todo PASS; 1 = al menos un FAIL.
"""
import os
import sys
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SOURCE = os.environ.get('SOURCE_DATABASE_URL')
TARGET = os.environ.get('TARGET_DATABASE_URL')
SAMPLE_N = int(sys.argv[sys.argv.index('--sample') + 1]) if '--sample' in sys.argv else 5

if not SOURCE or not TARGET:
    print('ERROR: define SOURCE_DATABASE_URL y TARGET_DATABASE_URL')
    sys.exit(1)

os.environ['DATABASE_URL'] = TARGET
os.environ['FLASK_ENV'] = 'development'

from app import create_app, db  # noqa: E402
from sqlalchemy import (  # noqa: E402
    create_engine, select, func, inspect as sa_inspect,
    Integer, Float, Numeric, DateTime, Date, Boolean, JSON as SA_JSON,
)

# --tables results,conocer_certificates → validar solo esas
ONLY_TABLES = None
if '--tables' in sys.argv:
    ONLY_TABLES = set(sys.argv[sys.argv.index('--tables') + 1].split(','))

app = create_app('development')
with app.app_context():
    sorted_tables = db.metadata.sorted_tables

src = create_engine(SOURCE, pool_pre_ping=True)
tgt = create_engine(TARGET, pool_pre_ping=True)

src_names = set(sa_inspect(src).get_table_names())
tgt_names = set(sa_inspect(tgt).get_table_names())
plan = [t for t in sorted_tables if t.name in src_names and t.name in tgt_names]
if ONLY_TABLES:
    plan = [t for t in plan if t.name in ONLY_TABLES]

failures = []
results = []


def norm(v):
    """Normalizar valores para comparación entre drivers."""
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, float):
        return round(v, 6)
    if hasattr(v, 'isoformat'):  # datetime/date — pymssql puede perder sub-segundos
        return v.isoformat()[:19]
    if isinstance(v, str):
        return v.rstrip()  # MSSQL CHAR padding
    return v


for t in plan:
    issues = []
    # Misma regla que el ETL: en columnas NOT NULL con default escalar, un NULL
    # en el origen equivale al default en el destino (drift de auto_migrate).
    fill_defaults = {
        col.name: col.default.arg
        for col in t.columns
        if not col.nullable and col.default is not None and getattr(col.default, 'is_scalar', False)
    }
    with src.connect() as sc, tgt.connect() as tc:
        n_src = sc.execute(select(func.count()).select_from(t)).scalar()
        n_tgt = tc.execute(select(func.count()).select_from(t)).scalar()
        if n_src != n_tgt:
            issues.append(f'conteo: origen={n_src} destino={n_tgt}')

        # Agregados por columna
        for col in t.columns:
            try:
                if isinstance(col.type, (Integer, Float, Numeric)) and not col.primary_key:
                    a = sc.execute(select(func.sum(col))).scalar()
                    b = tc.execute(select(func.sum(col))).scalar()
                    if (a is None) != (b is None) or (
                        a is not None and abs(float(a) - float(b)) > 0.01
                    ):
                        issues.append(f'sum({col.name}): {a} vs {b}')
                elif isinstance(col.type, (DateTime, Date)):
                    a = sc.execute(select(func.min(col), func.max(col))).first()
                    b = tc.execute(select(func.min(col), func.max(col))).first()
                    if tuple(map(norm, a)) != tuple(map(norm, b)):
                        issues.append(f'min/max({col.name}): {a} vs {b}')
                # NULLs por columna (omitir las que el ETL rellena por drift y
                # las JSON: SQL NULL y JSON null son equivalentes para la app,
                # el muestreo campo a campo las compara por valor deserializado)
                if col.name not in fill_defaults and not isinstance(col.type, SA_JSON):
                    a = sc.execute(select(func.count()).select_from(t).where(col.is_(None))).scalar()
                    b = tc.execute(select(func.count()).select_from(t).where(col.is_(None))).scalar()
                    if a != b:
                        issues.append(f'nulls({col.name}): {a} vs {b}')
            except Exception as e:
                issues.append(f'error comparando {col.name}: {e}')

        # Muestreo aleatorio campo a campo (por PK)
        pks = list(t.primary_key.columns)
        if n_src and len(pks) >= 1:
            try:
                ids = [r[0] for r in sc.execute(select(pks[0])).fetchall()]
                for pk_val in random.sample(ids, min(SAMPLE_N, len(ids))):
                    cond = pks[0] == pk_val
                    ra = sc.execute(select(t).where(cond)).mappings().first()
                    rb = tc.execute(select(t).where(cond)).mappings().first()
                    if rb is None:
                        issues.append(f'fila {pk_val} no existe en destino')
                        continue
                    for k in ra.keys():
                        va = ra[k]
                        if va is None and k in fill_defaults:
                            va = fill_defaults[k]
                        if norm(va) != norm(rb[k]):
                            issues.append(f'fila {pk_val} campo {k}: {ra[k]!r} vs {rb[k]!r}')
            except Exception as e:
                issues.append(f'error en muestreo: {e}')

    status = 'PASS' if not issues else 'FAIL'
    results.append((t.name, n_src, status))
    if issues:
        failures.append((t.name, issues))
        print(f'❌ {t.name} ({n_src} filas): FAIL')
        for i in issues[:10]:
            print(f'     - {i}')
    else:
        print(f'✅ {t.name} ({n_src} filas): PASS')

print('\n' + '=' * 60)
print(f'RESUMEN: {len(results) - len(failures)}/{len(results)} tablas PASS')
if failures:
    print(f'TABLAS CON FALLAS: {[f[0] for f in failures]}')
    sys.exit(1)
print('🎉 Validación 100% PASS — el corte puede proceder')
