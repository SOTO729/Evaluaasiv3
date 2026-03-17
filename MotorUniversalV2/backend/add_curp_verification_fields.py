"""
Script de migración para añadir campos de verificación CURP RENAPO
Ejecutar con: python add_curp_verification_fields.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from sqlalchemy import text, inspect


def add_curp_verification_fields():
    """Añadir campos de verificación CURP a la tabla users"""

    app = create_app()

    with app.app_context():
        print("=" * 60)
        print("MIGRACIÓN: Campos de verificación CURP RENAPO")
        print("=" * 60)

        inspector = inspect(db.engine)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]

        columns_to_add = {
            'curp_verified': 'BIT DEFAULT 0 NOT NULL',
            'curp_verified_at': 'DATETIME NULL',
            'curp_renapo_name': 'NVARCHAR(100) NULL',
            'curp_renapo_first_surname': 'NVARCHAR(100) NULL',
            'curp_renapo_second_surname': 'NVARCHAR(100) NULL',
        }

        added = 0
        for col_name, col_def in columns_to_add.items():
            if col_name not in existing_columns:
                print(f"  📝 Agregando columna: {col_name}...")
                try:
                    db.session.execute(text(
                        f"ALTER TABLE users ADD {col_name} {col_def}"
                    ))
                    db.session.commit()
                    print(f"     ✓ {col_name} agregada")
                    added += 1
                except Exception as e:
                    if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                        print(f"     ⚠️  {col_name} ya existe")
                    else:
                        print(f"     ❌ Error: {e}")
                        db.session.rollback()
            else:
                print(f"  ✓ {col_name} ya existe")

        if added > 0:
            print(f"\n✅ Migración completada: {added} columnas agregadas")
        else:
            print("\n✅ Todas las columnas ya existen")


if __name__ == '__main__':
    add_curp_verification_fields()
