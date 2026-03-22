"""
Tests del módulo de Branding del Plantel
=========================================

Cubre:
  A. PUT  /partners/mi-plantel/branding — Actualizar colores
     A1. Actualizar primary_color y secondary_color con HEX válido
     A2. Actualizar solo primary_color
     A3. Actualizar solo secondary_color
     A4. Color inválido retorna 400
     A5. Color sin # retorna 400
     A6. Color con letras inválidas retorna 400
     A7. Enviar null para resetear colores
     A8. Sin autenticación retorna 401/422
     A9. Sin rol responsable retorna 403

  B. POST /partners/mi-plantel/logo — Subir logo
     B1. Subir PNG válido responde 200 con logo_url
     B2. Sin archivo retorna 400
     B3. Archivo demasiado grande retorna 400
     B4. Extensión no permitida retorna 400
     B5. Sin autenticación retorna 401/422

  C. DELETE /partners/mi-plantel/logo — Eliminar logo
     C1. Eliminar logo responde 200
     C2. Eliminar sin logo existente aún responde 200
     C3. Sin autenticación retorna 401/422

  D. GET /partners/mi-plantel — Campos de branding en respuesta
     D1. Respuesta incluye logo_url, primary_color, secondary_color

Ejecutar:
    cd backend && python -m pytest tests/test_branding.py -v --tb=short
    cd backend && python -m pytest tests/test_branding.py -v -k "color"
"""

import io
import pytest
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

REQ_TIMEOUT = 120

# Session with retry for cold-starts
_session = requests.Session()
retries = Retry(total=3, backoff_factor=2, status_forcelist=[502, 503, 504],
                allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE"])
adapter = HTTPAdapter(max_retries=retries, pool_connections=5, pool_maxsize=5)
_session.mount("https://", adapter)
_session.mount("http://", adapter)


def api_request(method, url, **kwargs):
    kwargs.setdefault("timeout", REQ_TIMEOUT)
    return _session.request(method, url, **kwargs)


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    """Obtener JWT token de admin"""
    r = api_request("POST", f"{api}/auth/login", json={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })
    assert r.status_code == 200, f"Login admin falló: {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No se encontró token en respuesta: {data}"
    return token


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def responsable_token(api, admin_headers):
    """Crear un usuario responsable temporal y obtener su token"""
    import pyodbc
    import uuid

    prefix = f"BRTEST_{uuid.uuid4().hex[:6].upper()}"
    username = None
    user_id = None

    # Conectar a DB para asignar campus al responsable
    conn = pyodbc.connect(
        'DRIVER={ODBC Driver 18 for SQL Server};'
        'SERVER=evaluaasi-motorv2-sql.database.windows.net;'
        'DATABASE=evaluaasi_dev;'
        'UID=evaluaasi_admin;PWD=EvalAasi2024_newpwd!;'
        'Encrypt=yes;TrustServerCertificate=no',
        timeout=30
    )
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        # Buscar un campus activo que podamos usar
        cursor.execute("SELECT TOP 1 id FROM campuses WHERE is_active=1")
        row = cursor.fetchone()
        assert row, "No hay campuses activos en la DB"
        campus_id = row[0]

        # Crear usuario responsable directamente en DB para evitar validación CURP/RENAPO
        from argon2 import PasswordHasher
        ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16)
        user_id = str(uuid.uuid4())
        username = f"BRTEST{uuid.uuid4().hex[:6].upper()}"
        password = "TestBrand1234!"

        cursor.execute(
            "INSERT INTO users (id, username, name, first_surname, second_surname,"
            " email, role, campus_id, is_active, is_verified,"
            " password_hash, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, GETDATE(), GETDATE())",
            (
                user_id, username, "Test", "Branding", "Suite",
                f"{username.lower()}@branding.test", "responsable", campus_id,
                ph.hash(password)
            )
        )

        # Asignar como responsable del campus
        cursor.execute(
            "UPDATE campuses SET responsable_id=? WHERE id=?",
            (user_id, campus_id)
        )

        # Login con la contraseña
        r2 = api_request("POST", f"{api}/auth/login", json={
            "username": username,
            "password": password
        })
        assert r2.status_code == 200, f"Login responsable falló: {r2.text}"
        data2 = r2.json()
        token = data2.get("access_token") or data2.get("token")
        assert token, f"No token: {data2}"

        yield token

    finally:
        # Cleanup: revert campus responsable_id and deactivate user
        try:
            if user_id:
                cursor.execute("UPDATE campuses SET responsable_id=NULL WHERE responsable_id=?", (user_id,))
                cursor.execute("DELETE FROM users WHERE id=?", (user_id,))
        except Exception:
            pass
        cursor.close()
        conn.close()


@pytest.fixture(scope="session")
def resp_headers(responsable_token):
    return {"Authorization": f"Bearer {responsable_token}", "Content-Type": "application/json"}


# ═══════════════════════════════════════════════════════════════════════════
# A. ACTUALIZAR COLORES — PUT /partners/mi-plantel/branding
# ═══════════════════════════════════════════════════════════════════════════

class TestUpdateBranding:
    """Tests para PUT /partners/mi-plantel/branding"""

    def test_update_both_colors(self, api, resp_headers):
        """A1. Actualizar ambos colores con HEX válido"""
        payload = {"primary_color": "#e11d48", "secondary_color": "#be123c"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 200
        data = r.json()
        assert "campus" in data
        assert data["campus"]["primary_color"] == "#e11d48"
        assert data["campus"]["secondary_color"] == "#be123c"
        assert data["message"] == "Branding actualizado exitosamente"

    def test_update_primary_only(self, api, resp_headers):
        """A2. Actualizar solo color primario"""
        payload = {"primary_color": "#10b981"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 200
        assert r.json()["campus"]["primary_color"] == "#10b981"

    def test_update_secondary_only(self, api, resp_headers):
        """A3. Actualizar solo color secundario"""
        payload = {"secondary_color": "#059669"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 200
        assert r.json()["campus"]["secondary_color"] == "#059669"

    def test_invalid_hex_primary(self, api, resp_headers):
        """A4. Color HEX inválido retorna 400"""
        payload = {"primary_color": "not-a-color"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 400
        assert "inválido" in r.json()["error"].lower() or "formato" in r.json()["error"].lower()

    def test_hex_without_hash(self, api, resp_headers):
        """A5. Color sin # retorna 400"""
        payload = {"primary_color": "3b82f6"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 400

    def test_hex_invalid_chars(self, api, resp_headers):
        """A6. Color con caracteres inválidos retorna 400"""
        payload = {"primary_color": "#ZZZZZZ"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 400

    def test_hex_short_color(self, api, resp_headers):
        """A6b. Color corto (#FFF) retorna 400 — solo se acepta formato completo"""
        payload = {"primary_color": "#FFF"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 400

    def test_reset_colors_with_null(self, api, resp_headers):
        """A7. Enviar null resetea los colores"""
        payload = {"primary_color": None, "secondary_color": None}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 200
        campus = r.json()["campus"]
        assert campus["primary_color"] is None
        assert campus["secondary_color"] is None

    def test_reset_colors_with_empty_string(self, api, resp_headers):
        """A7b. Enviar string vacío también resetea"""
        payload = {"primary_color": "", "secondary_color": ""}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 200
        campus = r.json()["campus"]
        assert campus["primary_color"] is None
        assert campus["secondary_color"] is None

    def test_no_auth(self, api):
        """A8. Sin autenticación retorna 401 o 422"""
        payload = {"primary_color": "#3b82f6"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding", json=payload)
        assert r.status_code in [401, 422]

    def test_admin_forbidden(self, api, admin_headers):
        """A9. Admin (no responsable) retorna 403"""
        payload = {"primary_color": "#3b82f6"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=admin_headers)
        assert r.status_code == 403

    def test_uppercase_hex_accepted(self, api, resp_headers):
        """A10. HEX con mayúsculas es válido"""
        payload = {"primary_color": "#3B82F6"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 200
        assert r.json()["campus"]["primary_color"] == "#3B82F6"

    def test_lowercase_hex_accepted(self, api, resp_headers):
        """A11. HEX con minúsculas es válido"""
        payload = {"primary_color": "#3b82f6"}
        r = api_request("PUT", f"{api}/partners/mi-plantel/branding",
                        json=payload, headers=resp_headers)
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# B. SUBIR LOGO — POST /partners/mi-plantel/logo
# ═══════════════════════════════════════════════════════════════════════════

class TestUploadLogo:
    """Tests para POST /partners/mi-plantel/logo"""

    def _make_fake_png(self, size_bytes=1024):
        """Genera un archivo PNG mínimo válido"""
        # PNG header + minimal IHDR chunk
        png_header = b'\x89PNG\r\n\x1a\n'
        # Pad to requested size
        data = png_header + b'\x00' * (size_bytes - len(png_header))
        return io.BytesIO(data)

    def test_upload_png_success(self, api, responsable_token):
        """B1. Subir PNG válido responde 200"""
        headers = {"Authorization": f"Bearer {responsable_token}"}
        fake_png = self._make_fake_png(2048)
        files = {"logo": ("test_logo.png", fake_png, "image/png")}
        r = api_request("POST", f"{api}/partners/mi-plantel/logo",
                        files=files, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "logo_url" in data
        assert data["logo_url"].startswith("http")
        assert "campus" in data

    def test_upload_jpg_success(self, api, responsable_token):
        """B1b. Subir JPG válido responde 200"""
        headers = {"Authorization": f"Bearer {responsable_token}"}
        fake_jpg = io.BytesIO(b'\xFF\xD8\xFF\xE0' + b'\x00' * 2048)
        files = {"logo": ("test_logo.jpg", fake_jpg, "image/jpeg")}
        r = api_request("POST", f"{api}/partners/mi-plantel/logo",
                        files=files, headers=headers)
        assert r.status_code == 200

    def test_no_file(self, api, resp_headers):
        """B2. Sin archivo retorna 400"""
        r = api_request("POST", f"{api}/partners/mi-plantel/logo",
                        headers={"Authorization": resp_headers["Authorization"]})
        assert r.status_code == 400
        assert "archivo" in r.json()["error"].lower()

    def test_file_too_large(self, api, responsable_token):
        """B3. Archivo > 2MB retorna 400"""
        headers = {"Authorization": f"Bearer {responsable_token}"}
        big_file = io.BytesIO(b'\x89PNG\r\n\x1a\n' + b'\x00' * (3 * 1024 * 1024))
        files = {"logo": ("big_logo.png", big_file, "image/png")}
        r = api_request("POST", f"{api}/partners/mi-plantel/logo",
                        files=files, headers=headers)
        assert r.status_code == 400
        assert "2MB" in r.json()["error"] or "superar" in r.json()["error"].lower()

    def test_invalid_extension(self, api, responsable_token):
        """B4. Extensión .exe no permitida"""
        headers = {"Authorization": f"Bearer {responsable_token}"}
        fake = io.BytesIO(b'\x00' * 1024)
        files = {"logo": ("malware.exe", fake, "application/octet-stream")}
        r = api_request("POST", f"{api}/partners/mi-plantel/logo",
                        files=files, headers=headers)
        assert r.status_code == 400
        assert "formato" in r.json()["error"].lower() or "permitido" in r.json()["error"].lower()

    def test_invalid_extension_gif(self, api, responsable_token):
        """B4b. Extensión .gif no permitida"""
        headers = {"Authorization": f"Bearer {responsable_token}"}
        fake = io.BytesIO(b'GIF89a' + b'\x00' * 1024)
        files = {"logo": ("logo.gif", fake, "image/gif")}
        r = api_request("POST", f"{api}/partners/mi-plantel/logo",
                        files=files, headers=headers)
        assert r.status_code == 400

    def test_no_auth(self, api):
        """B5. Sin autenticación retorna 401/422"""
        fake = io.BytesIO(b'\x89PNG\r\n\x1a\n' + b'\x00' * 1024)
        files = {"logo": ("logo.png", fake, "image/png")}
        r = api_request("POST", f"{api}/partners/mi-plantel/logo", files=files)
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# C. ELIMINAR LOGO — DELETE /partners/mi-plantel/logo
# ═══════════════════════════════════════════════════════════════════════════

class TestDeleteLogo:
    """Tests para DELETE /partners/mi-plantel/logo"""

    def test_delete_logo_success(self, api, resp_headers):
        """C1. Eliminar logo responde 200"""
        r = api_request("DELETE", f"{api}/partners/mi-plantel/logo",
                        headers=resp_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["message"] == "Logo eliminado exitosamente"
        assert data["campus"]["logo_url"] is None

    def test_delete_logo_idempotent(self, api, resp_headers):
        """C2. Eliminar sin logo existente también responde 200"""
        # Llamar dos veces seguidas
        api_request("DELETE", f"{api}/partners/mi-plantel/logo",
                    headers=resp_headers)
        r = api_request("DELETE", f"{api}/partners/mi-plantel/logo",
                        headers=resp_headers)
        assert r.status_code == 200
        assert r.json()["campus"]["logo_url"] is None

    def test_no_auth(self, api):
        """C3. Sin autenticación retorna 401/422"""
        r = api_request("DELETE", f"{api}/partners/mi-plantel/logo")
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# D. GET MI-PLANTEL — Campos de branding incluidos
# ═══════════════════════════════════════════════════════════════════════════

class TestBrandingFieldsInMiPlantel:
    """Tests para GET /partners/mi-plantel — campos de branding"""

    def test_branding_fields_present(self, api, resp_headers):
        """D1. Respuesta de mi-plantel incluye campos de branding"""
        r = api_request("GET", f"{api}/partners/mi-plantel", headers=resp_headers)
        assert r.status_code == 200
        campus = r.json().get("campus", {})
        assert "logo_url" in campus
        assert "primary_color" in campus
        assert "secondary_color" in campus

    def test_branding_roundtrip(self, api, resp_headers):
        """D2. Actualizar colores y verificar en mi-plantel"""
        # Set colors
        api_request("PUT", f"{api}/partners/mi-plantel/branding",
                    json={"primary_color": "#8b5cf6", "secondary_color": "#7c3aed"},
                    headers=resp_headers)
        # Read back
        r = api_request("GET", f"{api}/partners/mi-plantel", headers=resp_headers)
        assert r.status_code == 200
        campus = r.json()["campus"]
        assert campus["primary_color"] == "#8b5cf6"
        assert campus["secondary_color"] == "#7c3aed"

        # Reset
        api_request("PUT", f"{api}/partners/mi-plantel/branding",
                    json={"primary_color": None, "secondary_color": None},
                    headers=resp_headers)


# ═══════════════════════════════════════════════════════════════════════════
# E. EXPORT EXCEL — Logo del plantel como encabezado
# ═══════════════════════════════════════════════════════════════════════════

class TestExportExcelBranding:
    """Tests para GET /partners/mi-plantel/evaluations/export — logo en Excel"""

    def test_export_excel_returns_xlsx(self, api, resp_headers):
        """E1. Export genera archivo xlsx válido"""
        r = api_request("GET", f"{api}/partners/mi-plantel/evaluations/export",
                        headers=resp_headers)
        # 200 con xlsx o 404 si no hay candidatos
        assert r.status_code in [200, 404]
        if r.status_code == 200:
            assert 'spreadsheetml' in r.headers.get('Content-Type', '')

    def test_export_excel_with_logo(self, api, resp_headers):
        """E2. Export con logo de plantel no rompe la generación"""
        # Subir un logo pequeño primero
        png_1x1 = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00'
            b'\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00'
            b'\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        upload_headers = {"Authorization": resp_headers["Authorization"]}
        import io
        files = {'logo': ('test.png', io.BytesIO(png_1x1), 'image/png')}
        api_request("POST", f"{api}/partners/mi-plantel/logo",
                    headers=upload_headers, files=files)

        # Ahora exportar — debe completar sin error
        r = api_request("GET", f"{api}/partners/mi-plantel/evaluations/export",
                        headers=resp_headers)
        assert r.status_code in [200, 404]

        # Cleanup: eliminar logo
        api_request("DELETE", f"{api}/partners/mi-plantel/logo",
                    headers=resp_headers)
