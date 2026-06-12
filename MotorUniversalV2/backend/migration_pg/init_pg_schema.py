"""
Inicializa el esquema en PostgreSQL usando los modelos SQLAlchemy + auto_migrate.

Uso:
    set TARGET_DATABASE_URL=postgresql://user:pass@host:5432/evaluaasi_dev
    python migration_pg/init_pg_schema.py

Crea todas las tablas con db.create_all() (la misma ruta que usa la app) y
después ejecuta las auto-migraciones para columnas/tablas que se agregan
dinámicamente. Es idempotente: correr de nuevo no duplica nada.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TARGET = os.environ.get('TARGET_DATABASE_URL')
if not TARGET or not TARGET.startswith('postgresql'):
    print('ERROR: define TARGET_DATABASE_URL con una URL postgresql://')
    sys.exit(1)

# La app lee DATABASE_URL; apuntarla al destino ANTES de importar
os.environ['DATABASE_URL'] = TARGET
os.environ['FLASK_ENV'] = 'development'

from app import create_app, db  # noqa: E402

app = create_app('development')

with app.app_context():
    print(f'Conectado a: {db.engine.url.render_as_string(hide_password=True)}')
    assert db.engine.name == 'postgresql', f'Dialecto inesperado: {db.engine.name}'

    print('1/2 db.create_all() ...')
    db.create_all()
    print('   OK')

    print('2/2 auto-migraciones (mismo orden que run.py) ...')
    import re
    import pathlib
    import app.auto_migrate as am

    run_py = pathlib.Path(__file__).resolve().parent.parent / 'run.py'
    seen = set()
    names = []
    for n in re.findall(r'check_and_\w+', run_py.read_text(encoding='utf-8')):
        if n not in seen:
            seen.add(n)
            names.append(n)
    print(f'   {len(names)} migraciones encontradas en run.py')
    for n in names:
        fn = getattr(am, n, None)
        if fn is None:
            print(f'   ⚠ {n}: no existe en auto_migrate')
            continue
        try:
            fn()
        except Exception as e:
            db.session.rollback()
            print(f'   ⚠ {n}: {e}')
    print('   OK')

    from sqlalchemy import inspect
    tables = inspect(db.engine).get_table_names()
    print(f'\nEsquema listo: {len(tables)} tablas en PostgreSQL')
