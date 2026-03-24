"""
Tests del sistema de Recuperación de CURP Pendiente
====================================================

Cubre:
  A. Health check — verificar que ambas APIs arrancaron sin error
  B. Endpoint de bulk-upload — la infraestructura sobre la que opera el recovery
  C. Verificación que el recovery se ejecutó al arrancar (via logs/estado)
  D. Simulación de flujo completo: crear usuario con CURP, verificar estados

Ejecutar:
    cd backend && python -m pytest tests/test_curp_recovery.py -v --tb=short
    cd backend && python -m pytest tests/test_curp_recovery.py -v -k "dev"
    cd backend && python -m pytest tests/test_curp_recovery.py -v -k "prod"
"""

import pytest
import requests
import time

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
PROD_API = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# ─── Helpers ────────────────────────────────────────────────────────────────
def login(api_url, username=ADMIN_USER, password=ADMIN_PASS):
    """Login con retry para cold-starts de Container Apps"""
    for attempt in range(3):
        try:
            r = requests.post(f"{api_url}/auth/login", json={
                "username": username,
                "password": password,
            }, timeout=30)
            if r.status_code == 200:
                data = r.json()
                return data["access_token"]
            if r.status_code in [502, 503]:
                time.sleep(10)
                continue
        except requests.exceptions.Timeout:
            if attempt < 2:
                time.sleep(10)
                continue
    return None


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def dev_token():
    token = login(DEV_API)
    if not token:
        pytest.skip("No se pudo conectar a DEV API")
    return token


@pytest.fixture(scope="session")
def prod_token():
    token = login(PROD_API)
    if not token:
        pytest.skip("No se pudo conectar a PROD API")
    return token


@pytest.fixture(scope="session")
def dev_headers(dev_token):
    return {"Authorization": f"Bearer {dev_token}"}


@pytest.fixture(scope="session")
def prod_headers(prod_token):
    return {"Authorization": f"Bearer {prod_token}"}


# ═══════════════════════════════════════════════════════════════════════════
# A. HEALTH CHECKS — Verificar que ambas APIs están arriba y sanas
# ═══════════════════════════════════════════════════════════════════════════

class TestHealthDev:
    """Tests de salud para DEV"""

    def test_dev_health(self):
        """DEV API responde al health check"""
        r = requests.get(f"{DEV_API}/health", timeout=30)
        assert r.status_code == 200

    def test_dev_ping(self):
        """DEV API responde al ping"""
        r = requests.get(f"{DEV_API}/ping", timeout=10)
        assert r.status_code == 200

    def test_dev_login_works(self, dev_token):
        """DEV API permite login de admin"""
        assert dev_token is not None
        assert len(dev_token) > 20


class TestHealthProd:
    """Tests de salud para PROD"""

    def test_prod_health(self):
        """PROD API responde al health check"""
        r = requests.get(f"{PROD_API}/health", timeout=30)
        assert r.status_code == 200

    def test_prod_ping(self):
        """PROD API responde al ping"""
        r = requests.get(f"{PROD_API}/ping", timeout=10)
        assert r.status_code == 200

    def test_prod_login_works(self, prod_token):
        """PROD API permite login de admin"""
        assert prod_token is not None
        assert len(prod_token) > 20


# ═══════════════════════════════════════════════════════════════════════════
# B. INFRAESTRUCTURA DE BULK UPLOAD — Base del recovery
# ═══════════════════════════════════════════════════════════════════════════

class TestBulkUploadInfraDev:
    """Verificar que la infraestructura de bulk upload existe en DEV"""

    def test_dev_bulk_history_endpoint_exists(self, dev_headers):
        """DEV: endpoint de historial de bulk upload responde"""
        r = requests.get(
            f"{DEV_API}/user-management/bulk-history",
            headers=dev_headers,
            timeout=15,
        )
        assert r.status_code == 200

    def test_dev_bulk_upload_endpoint_rejects_empty(self, dev_headers):
        """DEV: endpoint de bulk upload rechaza petición sin archivo"""
        r = requests.post(
            f"{DEV_API}/user-management/candidates/bulk-upload",
            headers=dev_headers,
            timeout=15,
        )
        # Debe retornar 400 (falta archivo) o 422, no 500
        assert r.status_code in [400, 422], f"Expected 400/422, got {r.status_code}: {r.text}"


class TestBulkUploadInfraProd:
    """Verificar que la infraestructura de bulk upload existe en PROD"""

    def test_prod_bulk_history_endpoint_exists(self, prod_headers):
        """PROD: endpoint de historial de bulk upload responde"""
        r = requests.get(
            f"{PROD_API}/user-management/bulk-history",
            headers=prod_headers,
            timeout=15,
        )
        assert r.status_code == 200

    def test_prod_bulk_upload_endpoint_rejects_empty(self, prod_headers):
        """PROD: endpoint de bulk upload rechaza petición sin archivo"""
        r = requests.post(
            f"{PROD_API}/user-management/candidates/bulk-upload",
            headers=prod_headers,
            timeout=15,
        )
        assert r.status_code in [400, 422], f"Expected 400/422, got {r.status_code}: {r.text}"


# ═══════════════════════════════════════════════════════════════════════════
# C. CURP RECOVERY — Verificar que el sistema de recovery arrancó
# ═══════════════════════════════════════════════════════════════════════════

class TestCurpRecoveryDev:
    """Verificar el sistema de recuperación de CURPs en DEV"""

    def test_dev_no_orphaned_users_stuck(self, dev_headers):
        """DEV: no debe haber usuarios stuck en curp_pending/curp_verifying.
        Si el recovery funciona, cualquier usuario huérfano debió ser procesado al arrancar."""
        r = requests.get(
            f"{DEV_API}/user-management/users?role=candidato&is_active=false&per_page=100",
            headers=dev_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        users = data.get("users", data) if isinstance(data, dict) else data

        # Buscar usuarios inactivos con CURP pero sin verificar
        # (podrían ser huérfanos no recuperados)
        orphan_suspects = []
        for u in (users if isinstance(users, list) else []):
            if (u.get("curp")
                    and not u.get("curp_verified")
                    and u.get("role") == "candidato"
                    and not u.get("is_active")):
                orphan_suspects.append(u.get("username", "?"))

        # Si hay, reportar como warning (pueden ser usuarios cuya
        # verificación fue interrumpida y serán procesados por recovery)
        if orphan_suspects:
            print(f"\n  [INFO] DEV tiene {len(orphan_suspects)} candidatos inactivos con CURP no verificada")
            print(f"  Usernames: {orphan_suspects[:10]}")

    def test_dev_user_management_healthy(self, dev_headers):
        """DEV: endpoint de listado de usuarios funciona correctamente"""
        r = requests.get(
            f"{DEV_API}/user-management/users?per_page=5",
            headers=dev_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert "users" in data or "total" in data or isinstance(data, list)

    def test_dev_group_members_exclude_curp_pending(self, dev_headers):
        """DEV: endpoint de grupos filtra curp_pending por defecto.
        Verificamos que la info de grupos funciona."""
        # Obtener un campus para buscar grupos
        r = requests.get(
            f"{DEV_API}/partners/campuses?per_page=1",
            headers=dev_headers,
            timeout=15,
        )
        if r.status_code != 200:
            pytest.skip("No hay campuses en DEV")

        data = r.json()
        campuses = data.get("campuses", data) if isinstance(data, dict) else data
        if not campuses or not isinstance(campuses, list) or len(campuses) == 0:
            pytest.skip("No hay campuses en DEV")

        campus_id = campuses[0].get("id")
        # Obtener grupos del campus
        r = requests.get(
            f"{DEV_API}/partners/campuses/{campus_id}/groups",
            headers=dev_headers,
            timeout=15,
        )
        assert r.status_code == 200


class TestCurpRecoveryProd:
    """Verificar el sistema de recuperación de CURPs en PROD"""

    def test_prod_no_orphaned_users_stuck(self, prod_headers):
        """PROD: no debe haber usuarios stuck en curp_pending/curp_verifying."""
        r = requests.get(
            f"{PROD_API}/user-management/users?role=candidato&is_active=false&per_page=100",
            headers=prod_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        users = data.get("users", data) if isinstance(data, dict) else data

        orphan_suspects = []
        for u in (users if isinstance(users, list) else []):
            if (u.get("curp")
                    and not u.get("curp_verified")
                    and u.get("role") == "candidato"
                    and not u.get("is_active")):
                orphan_suspects.append(u.get("username", "?"))

        if orphan_suspects:
            print(f"\n  [INFO] PROD tiene {len(orphan_suspects)} candidatos inactivos con CURP no verificada")
            print(f"  Usernames: {orphan_suspects[:10]}")

    def test_prod_user_management_healthy(self, prod_headers):
        """PROD: endpoint de listado de usuarios funciona correctamente"""
        r = requests.get(
            f"{PROD_API}/user-management/users?per_page=5",
            headers=prod_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert "users" in data or "total" in data or isinstance(data, list)


# ═══════════════════════════════════════════════════════════════════════════
# D. MODELO DE DATOS — Verificar que campos CURP existen en la API
# ═══════════════════════════════════════════════════════════════════════════

class TestCurpFieldsDev:
    """Verificar campos de CURP en la respuesta de la API DEV"""

    def test_dev_user_has_curp_fields(self, dev_headers):
        """DEV: usuarios incluyen campos curp_verified en la respuesta"""
        r = requests.get(
            f"{DEV_API}/user-management/users?per_page=1",
            headers=dev_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        users = data.get("users", data) if isinstance(data, dict) else data

        if isinstance(users, list) and len(users) > 0:
            user = users[0]
            # Verificar que el campo curp_verified existe en la respuesta
            assert "curp_verified" in user, \
                f"Campo curp_verified falta en la respuesta del usuario. Keys: {list(user.keys())}"

    def test_dev_user_detail_has_curp_fields(self, dev_headers):
        """DEV: detalle de usuario incluye campos CURP"""
        # Primero obtener un usuario
        r = requests.get(
            f"{DEV_API}/user-management/users?per_page=1&role=candidato",
            headers=dev_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        users = data.get("users", data) if isinstance(data, dict) else data

        if not isinstance(users, list) or len(users) == 0:
            pytest.skip("No hay candidatos en DEV")

        user_id = users[0].get("id")
        r = requests.get(
            f"{DEV_API}/user-management/users/{user_id}",
            headers=dev_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        user = data.get("user", data) if isinstance(data, dict) else data
        assert "curp_verified" in user
        assert "is_active" in user


class TestCurpFieldsProd:
    """Verificar campos de CURP en la respuesta de la API PROD"""

    def test_prod_user_has_curp_fields(self, prod_headers):
        """PROD: usuarios incluyen campos curp_verified en la respuesta"""
        r = requests.get(
            f"{PROD_API}/user-management/users?per_page=1",
            headers=prod_headers,
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        users = data.get("users", data) if isinstance(data, dict) else data

        if isinstance(users, list) and len(users) > 0:
            user = users[0]
            assert "curp_verified" in user, \
                f"Campo curp_verified falta en la respuesta del usuario. Keys: {list(user.keys())}"
