"""
Migración: Re-firmar badges existentes con Ed25519

Recorre todos los IssuedBadge con credential_json que no tengan
campo 'proof' y los firma con la clave privada configurada.

USO:
  cd backend && python scripts/resign_badges_ed25519.py
"""
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app, db
from app.models.badge import IssuedBadge
from app.services.badge_service import sign_credential

app = create_app()

with app.app_context():
    badges = IssuedBadge.query.filter(
        IssuedBadge.credential_json.isnot(None),
        IssuedBadge.status != 'revoked',
    ).all()

    signed = 0
    skipped = 0
    errors = 0

    for badge in badges:
        try:
            cred = json.loads(badge.credential_json)
            if 'proof' in cred:
                skipped += 1
                continue

            cred = sign_credential(cred)
            if 'proof' not in cred:
                print(f"  ⚠ Badge {badge.badge_code}: key not configured, stopping.")
                break

            badge.credential_json = json.dumps(cred, ensure_ascii=False)
            signed += 1
        except Exception as e:
            print(f"  ✗ Badge {badge.badge_code}: {e}")
            errors += 1

    if signed > 0:
        db.session.commit()

    print(f"\n✅ Re-firmados: {signed}")
    print(f"⏭  Ya firmados (skip): {skipped}")
    print(f"✗  Errores: {errors}")
    print(f"   Total procesados: {len(badges)}")
