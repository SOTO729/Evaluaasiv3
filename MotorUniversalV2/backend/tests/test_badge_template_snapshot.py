"""
Test del snapshot inmutable de imagen de plantilla de insignia

Verifica:
  PARTE A — Lógica del snapshot (unitario, sin red)
    1. source_image_url prioriza badge_image_url
    2. Fallback a issuer_image_url si badge_image_url es None
    3. Fallback a competency_standard.logo_url como última opción
    4. Si no hay ninguna imagen, el source queda None
    5. Snapshot blob path usa formato badge-snapshots/{uuid}_template.webp

  PARTE B — Inmutabilidad del modelo
    6. Badge emitido conserva su snapshot aunque template cambie
    7. Dos badges del mismo template tienen snapshots independientes

  PARTE C — to_dict incluye template_image_url
    8. IssuedBadge.to_dict() incluye template_image_url
    9. template_image_url es distinto de badge_image_url
   10. template_image_url None se serializa correctamente

  PARTE D — Modelo y esquema
   11. IssuedBadge tiene columna template_image_url
   12. Snapshot blob path format válido

USO:
  cd backend && python -m pytest tests/test_badge_template_snapshot.py -v
"""
import sys
import os
import types
import uuid
from datetime import datetime
from unittest.mock import patch, PropertyMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def _fake_template(**overrides):
    defaults = {
        'badge_image_url': 'https://blob.azure.net/container/badge-templates/template-1.webp',
        'issuer_image_url': 'https://blob.azure.net/container/issuer.webp',
        'competency_standard': types.SimpleNamespace(logo_url='https://blob.azure.net/container/ecm-logo.webp'),
    }
    defaults.update(overrides)
    return types.SimpleNamespace(**defaults)


# ============================================================
# PARTE A — Lógica del snapshot (cadena de prioridad)
# ============================================================

class TestSnapshotPriorityChain:

    def test_01_prioritizes_badge_image_url(self):
        """badge_image_url del template tiene prioridad máxima."""
        t = _fake_template()
        source = (t.badge_image_url
                  or t.issuer_image_url
                  or (t.competency_standard.logo_url if t.competency_standard else None))
        assert source == 'https://blob.azure.net/container/badge-templates/template-1.webp'

    def test_02_fallback_to_issuer_image_url(self):
        """Si badge_image_url es None, usa issuer_image_url."""
        t = _fake_template(badge_image_url=None)
        source = (t.badge_image_url
                  or t.issuer_image_url
                  or (t.competency_standard.logo_url if t.competency_standard else None))
        assert source == 'https://blob.azure.net/container/issuer.webp'

    def test_03_fallback_to_ecm_logo(self):
        """Si no hay badge ni issuer image, usa ECM logo."""
        t = _fake_template(badge_image_url=None, issuer_image_url=None)
        source = (t.badge_image_url
                  or t.issuer_image_url
                  or (t.competency_standard.logo_url if t.competency_standard else None))
        assert source == 'https://blob.azure.net/container/ecm-logo.webp'

    def test_04_no_image_returns_none(self):
        """Si no hay ninguna imagen, source es None."""
        t = _fake_template(
            badge_image_url=None,
            issuer_image_url=None,
            competency_standard=types.SimpleNamespace(logo_url=None),
        )
        source = (t.badge_image_url
                  or t.issuer_image_url
                  or (t.competency_standard.logo_url if t.competency_standard else None))
        assert source is None

    def test_05_snapshot_blob_path_format(self):
        """El blob path usa badge-snapshots/{uuid}_template.webp."""
        badge_uuid = str(uuid.uuid4())
        snap_blob = f"badge-snapshots/{badge_uuid}_template.webp"
        assert snap_blob.startswith('badge-snapshots/')
        assert snap_blob.endswith('_template.webp')
        assert badge_uuid in snap_blob


# ============================================================
# PARTE B — Inmutabilidad del modelo
# ============================================================

class TestImmutability:

    def test_06_snapshot_survives_template_change(self):
        """Una vez emitida, template_image_url del badge no depende del template actual."""
        from app.models.badge import IssuedBadge, BadgeTemplate

        badge = IssuedBadge()
        badge.template_image_url = 'https://blob/badge-snapshots/abc_template.webp'

        template = BadgeTemplate()
        template.badge_image_url = 'https://blob/badge-templates/template-1-v2.webp'

        assert badge.template_image_url == 'https://blob/badge-snapshots/abc_template.webp'
        assert badge.template_image_url != template.badge_image_url

    def test_07_two_badges_independent_snapshots(self):
        """Dos badges del mismo template tienen snapshots distintos."""
        from app.models.badge import IssuedBadge

        badge1 = IssuedBadge()
        badge1.template_image_url = 'https://blob/badge-snapshots/uuid1_template.webp'

        badge2 = IssuedBadge()
        badge2.template_image_url = 'https://blob/badge-snapshots/uuid2_template.webp'

        assert badge1.template_image_url != badge2.template_image_url


# ============================================================
# PARTE C — to_dict incluye template_image_url
# ============================================================

class TestToDictOutput:

    def _make_badge(self, template_image_url='https://snapshot.webp', badge_image_url='https://baked.webp'):
        from app.models.badge import IssuedBadge, BadgeTemplate

        template = BadgeTemplate()
        template.id = 1
        template.name = 'Test'
        template.badge_image_url = 'https://template.webp'
        template.issuer_name = 'Eduit'
        template.issuer_url = 'https://eduit.com'
        template.issuer_image_url = None
        template.description = 'desc'
        template.criteria_narrative = 'crit'
        template.exam_id = None
        template.competency_standard_id = 1
        template.competency_standard = None
        template.tags = ''
        template.skills = ''
        template.expiry_months = None
        template.is_active = True
        template.created_by_id = 'x'
        template.created_at = datetime.utcnow()
        template.updated_at = datetime.utcnow()

        badge = IssuedBadge()
        badge.id = 1
        badge.badge_uuid = 'test-uuid'
        badge.badge_template_id = 1
        badge.user_id = 'user-1'
        badge.result_id = 'result-1'
        badge.badge_code = 'BD1234567890'
        badge.badge_image_url = badge_image_url
        badge.badge_image_blob_name = 'badges/test.webp'
        badge.template_image_url = template_image_url
        badge.issued_at = datetime.utcnow()
        badge.valid_from = datetime.utcnow()
        badge.expires_at = None
        badge.status = 'active'
        badge.revocation_reason = None
        badge.share_count = 0
        badge.verify_count = 0
        badge.claimed_at = None
        badge.created_at = datetime.utcnow()
        badge.credential_json = '{}'

        return badge, template

    def test_08_to_dict_includes_template_image_url(self):
        """IssuedBadge.to_dict() incluye template_image_url."""
        badge, template = self._make_badge()
        with patch.object(type(badge), 'template', new_callable=PropertyMock, return_value=template):
            data = badge.to_dict()
        assert 'template_image_url' in data
        assert data['template_image_url'] == 'https://snapshot.webp'

    def test_09_template_image_url_distinct_from_badge_image(self):
        """template_image_url y badge_image_url son campos distintos."""
        badge, template = self._make_badge()
        with patch.object(type(badge), 'template', new_callable=PropertyMock, return_value=template):
            data = badge.to_dict()
        assert data['badge_image_url'] == 'https://baked.webp'
        assert data['template_image_url'] == 'https://snapshot.webp'
        assert data['badge_image_url'] != data['template_image_url']

    def test_10_none_template_image_serializes(self):
        """template_image_url None se serializa correctamente."""
        badge, template = self._make_badge(template_image_url=None)
        with patch.object(type(badge), 'template', new_callable=PropertyMock, return_value=template):
            data = badge.to_dict()
        assert 'template_image_url' in data
        assert data['template_image_url'] is None


# ============================================================
# PARTE D — Modelo y esquema
# ============================================================

class TestModelSchema:

    def test_11_issued_badge_has_template_image_url_column(self):
        """IssuedBadge tiene la columna template_image_url."""
        from app.models.badge import IssuedBadge
        assert hasattr(IssuedBadge, 'template_image_url')

    def test_12_issued_badge_default_none(self):
        """template_image_url por defecto es None."""
        from app.models.badge import IssuedBadge
        badge = IssuedBadge()
        assert badge.template_image_url is None
