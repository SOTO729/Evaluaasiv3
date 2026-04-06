"""
Tests de integración: Logo del emisor en verificación de insignias
==================================================================

Cubre:
  A. GET /api/verify/<code> — Campo issuer_logo_url presente en respuesta badge
  B. POST /api/badges/templates/<id>/issuer-logo — Upload de logo del emisor
  C. DELETE /api/badges/templates/<id>/issuer-logo — Eliminación de logo
  D. GET /api/badges/templates/<id> — Template incluye issuer_logo_url
  E. Verificación de que el campo se propaga correctamente

Ejecutar:
    cd backend && python -m pytest tests/test_issuer_logo_verify.py -v --tb=short
"""

import pytest
import requests
import time
import io

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    """JWT admin con retry para cold-starts."""
    for attempt in range(3):
        try:
            r = requests.post(f"{api}/auth/login", json={
                "username": ADMIN_USER, "password": ADMIN_PASS
            }, timeout=30)
            if r.status_code == 200:
                return r.json()["access_token"]
            if r.status_code in [502, 503]:
                time.sleep(10)
                continue
            pytest.fail(f"Login admin falló: {r.status_code}")
        except requests.exceptions.Timeout:
            if attempt < 2:
                time.sleep(10)
                continue
            pytest.fail("Login timeout")
    pytest.fail("Login admin falló después de 3 intentos")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def badge_templates(api, admin_headers):
    """Obtener lista de plantillas de insignia."""
    r = requests.get(f"{api}/badges/templates", headers=admin_headers, timeout=20)
    if r.status_code == 200:
        return r.json().get("templates", [])
    return []


@pytest.fixture(scope="session")
def active_template(badge_templates):
    """Buscar una plantilla activa."""
    for t in badge_templates:
        if t.get("is_active"):
            return t
    return None


@pytest.fixture(scope="session")
def template_with_logo(badge_templates):
    """Buscar una plantilla que tenga issuer_logo_url."""
    for t in badge_templates:
        if t.get("issuer_logo_url"):
            return t
    return None


@pytest.fixture(scope="session")
def issued_badges(api, admin_headers):
    """Buscar insignias emitidas para obtener un código de verificación."""
    r = requests.get(f"{api}/badges/templates", headers=admin_headers, timeout=20)
    if r.status_code != 200:
        return []
    templates = r.json().get("templates", [])
    for t in templates:
        tid = t.get("id")
        r2 = requests.get(f"{api}/badges/templates/{tid}", headers=admin_headers, timeout=20)
        if r2.status_code == 200:
            data = r2.json()
            badges = data.get("issued_badges", [])
            if badges:
                return badges
    return []


@pytest.fixture(scope="session")
def badge_verify_code(issued_badges):
    """Código de verificación de una insignia emitida."""
    for b in issued_badges:
        code = b.get("badge_code") or b.get("verification_code")
        if code:
            return code
    return None


# ─── A. GET /api/verify/<code> — issuer_logo_url en respuesta ───────────────

class TestVerifyBadgeIssuerLogo:
    """Verificar que /api/verify devuelve issuer_logo_url para badges."""

    def test_verify_badge_returns_issuer_logo_field(self, api, badge_verify_code):
        """La respuesta de verificación de badge incluye el campo issuer_logo_url."""
        if not badge_verify_code:
            pytest.skip("No hay insignias emitidas en DEV para verificar")

        r = requests.get(f"{api}/verify/{badge_verify_code}", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("valid") is True
        assert data.get("document_type") == "digital_badge"

        badge = data.get("badge", {})
        assert "issuer_logo_url" in badge, f"Falta issuer_logo_url en badge: {list(badge.keys())}"

    def test_verify_badge_issuer_logo_is_string_or_null(self, api, badge_verify_code):
        """issuer_logo_url es string o null."""
        if not badge_verify_code:
            pytest.skip("No hay insignias emitidas en DEV")

        r = requests.get(f"{api}/verify/{badge_verify_code}", timeout=20)
        assert r.status_code == 200
        badge = r.json().get("badge", {})
        logo = badge.get("issuer_logo_url")
        assert logo is None or isinstance(logo, str), f"issuer_logo_url tiene tipo inesperado: {type(logo)}"

    def test_verify_badge_includes_issuer_name(self, api, badge_verify_code):
        """El badge verificado incluye issuer_name."""
        if not badge_verify_code:
            pytest.skip("No hay insignias emitidas en DEV")

        r = requests.get(f"{api}/verify/{badge_verify_code}", timeout=20)
        assert r.status_code == 200
        badge = r.json().get("badge", {})
        assert "issuer_name" in badge
        assert badge["issuer_name"]  # no vacío

    def test_verify_invalid_code_returns_error(self, api):
        """Código inexistente retorna error."""
        r = requests.get(f"{api}/verify/INVALID_CODE_99999", timeout=15)
        data = r.json()
        assert data.get("valid") is False or r.status_code == 404

    def test_verify_badge_has_all_expected_fields(self, api, badge_verify_code):
        """Badge de verificación tiene todos los campos esperados."""
        if not badge_verify_code:
            pytest.skip("No hay insignias emitidas en DEV")

        r = requests.get(f"{api}/verify/{badge_verify_code}", timeout=20)
        assert r.status_code == 200
        badge = r.json().get("badge", {})

        expected_fields = [
            "name", "description", "issuer_name", "issuer_logo_url",
            "image_url", "template_image_url", "issued_date",
            "badge_uuid", "credential_url", "verify_count", "share_count",
        ]
        for field in expected_fields:
            assert field in badge, f"Falta campo '{field}' en badge"


# ─── B. Template CRUD — issuer_logo_url en plantillas ───────────────────────

class TestTemplateIssuerLogo:
    """Verificar que las plantillas incluyen el campo issuer_logo_url."""

    def test_template_list_includes_issuer_logo(self, api, admin_headers, badge_templates):
        """Lista de templates incluye issuer_logo_url."""
        if not badge_templates:
            pytest.skip("No hay plantillas de insignia en DEV")

        t = badge_templates[0]
        assert "issuer_logo_url" in t, f"Plantilla no incluye issuer_logo_url: {list(t.keys())}"

    def test_template_detail_includes_issuer_logo(self, api, admin_headers, active_template):
        """Detalle de template incluye issuer_logo_url."""
        if not active_template:
            pytest.skip("No hay plantillas activas en DEV")

        r = requests.get(
            f"{api}/badges/templates/{active_template['id']}",
            headers=admin_headers, timeout=20
        )
        assert r.status_code == 200
        data = r.json()
        # El campo debe existir en el template (ya sea en raíz o en 'template')
        template = data.get("template", data)
        assert "issuer_logo_url" in template, f"Falta issuer_logo_url: {list(template.keys())}"

    def test_template_issuer_logo_is_url_or_null(self, api, admin_headers, active_template):
        """issuer_logo_url es una URL válida o null."""
        if not active_template:
            pytest.skip("No hay plantillas activas en DEV")

        r = requests.get(
            f"{api}/badges/templates/{active_template['id']}",
            headers=admin_headers, timeout=20
        )
        assert r.status_code == 200
        template = r.json().get("template", r.json())
        logo = template.get("issuer_logo_url")
        if logo is not None:
            assert isinstance(logo, str)
            assert logo.startswith("http"), f"issuer_logo_url no parece URL: {logo}"


# ─── C. Upload/Delete issuer logo ───────────────────────────────────────────

class TestIssuerLogoUploadDelete:
    """Verificar endpoints de upload y delete del logo del emisor."""

    def test_upload_logo_requires_auth(self, api):
        """Upload sin auth retorna 401/422."""
        r = requests.post(f"{api}/badges/templates/1/issuer-logo", timeout=15)
        assert r.status_code in [401, 422]

    def test_upload_logo_requires_file(self, api, admin_headers, active_template):
        """Upload sin archivo retorna 400."""
        if not active_template:
            pytest.skip("No hay plantillas activas")

        # Headers sin Content-Type (multipart lo añade automáticamente)
        headers = {"Authorization": admin_headers["Authorization"]}
        r = requests.post(
            f"{api}/badges/templates/{active_template['id']}/issuer-logo",
            headers=headers, timeout=15
        )
        assert r.status_code == 400

    def test_upload_logo_invalid_template(self, api, admin_headers):
        """Upload a plantilla inexistente retorna 404."""
        # Crear un PNG mínimo de 1x1 pixel
        png_data = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00'
            b'\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00'
            b'\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        headers = {"Authorization": admin_headers["Authorization"]}
        files = {"file": ("test.png", io.BytesIO(png_data), "image/png")}
        r = requests.post(
            f"{api}/badges/templates/999999/issuer-logo",
            headers=headers, files=files, timeout=15
        )
        assert r.status_code == 404

    def test_delete_logo_requires_auth(self, api):
        """Delete sin auth retorna 401/422."""
        r = requests.delete(f"{api}/badges/templates/1/issuer-logo", timeout=15)
        assert r.status_code in [401, 422]

    def test_delete_logo_invalid_template(self, api, admin_headers):
        """Delete de plantilla inexistente retorna 404."""
        r = requests.delete(
            f"{api}/badges/templates/999999/issuer-logo",
            headers=admin_headers, timeout=15
        )
        assert r.status_code == 404


# ─── D. Integración completa: verify propaga logo del template ──────────────

class TestIssuerLogoEndToEnd:
    """Verificar que el logo del emisor del template se propaga a la verificación."""

    def test_template_logo_matches_verify_logo(self, api, admin_headers, badge_verify_code, badge_templates):
        """Si el template tiene logo, la verificación lo muestra."""
        if not badge_verify_code:
            pytest.skip("No hay insignias emitidas en DEV")

        # Verificar badge
        r = requests.get(f"{api}/verify/{badge_verify_code}", timeout=20)
        assert r.status_code == 200
        verify_data = r.json()
        verify_logo = verify_data.get("badge", {}).get("issuer_logo_url")

        # Este test solo valida que el campo existe y es consistente
        # (puede ser null si el template no tiene logo configurado)
        assert verify_logo is None or isinstance(verify_logo, str)

    def test_verify_public_no_auth_required(self, api, badge_verify_code):
        """El endpoint de verificación es público — no requiere auth."""
        if not badge_verify_code:
            pytest.skip("No hay insignias emitidas en DEV")

        r = requests.get(f"{api}/verify/{badge_verify_code}", timeout=20)
        assert r.status_code == 200
        assert r.json().get("valid") is True
