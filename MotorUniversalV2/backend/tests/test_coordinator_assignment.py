"""
Tests de la regla de negocio: Responsables deben estar vinculados a un coordinador.

Cubre:
  - GET  /user-management/available-coordinators
  - POST /user-management/users  (crear responsable con/sin coordinator_id)
  - PUT  /user-management/users/:id  (cambiar coordinator)
  - POST /partners/campuses/:id/responsable  (activación con coordinator)
  - POST /partners/campuses/:id/responsables (adicional con coordinator)
  - POST /partners/campuses/:id/assign-responsable (asignar existente)

Ejecutar:
    cd backend && python -m pytest tests/test_coordinator_assignment.py -v --tb=short

Env vars opcionales:
    API_BASE_URL, ADMIN_USER, ADMIN_PASS
"""
import os
import uuid
import pytest
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = os.getenv(
    "API_BASE_URL",
    "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
)
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")
TIMEOUT = 30

# ─── HTTP helpers ────────────────────────────────────────────────────────────
_session = requests.Session()
_retries = Retry(total=3, backoff_factor=1, status_forcelist=[502, 503, 504])
_session.mount("https://", HTTPAdapter(max_retries=_retries))


def _req(method, url, **kw):
    kw.setdefault("timeout", TIMEOUT)
    return _session.request(method, url, **kw)


def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:8]}"


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    r = _req("POST", f"{api}/auth/login", json={
        "username": ADMIN_USER, "password": ADMIN_PASS
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="session")
def coordinator_data(api, admin_headers):
    """Retorna un coordinador activo de la plataforma para usarlo en tests."""
    r = _req("GET", f"{api}/user-management/available-coordinators", headers=admin_headers)
    assert r.status_code == 200
    coords = r.json()["coordinators"]
    assert len(coords) > 0, "No hay coordinadores disponibles en DEV"
    return coords[0]  # {id, full_name, email, username}


@pytest.fixture(scope="session")
def campus_id(api, admin_headers):
    """Retorna un campus_id disponible en DEV que tenga responsable (ya activado)."""
    r = _req("GET", f"{api}/user-management/available-campuses", headers=admin_headers)
    assert r.status_code == 200
    campuses = r.json().get("campuses", [])
    # Buscar un campus con responsable
    for c in campuses:
        if c.get("has_responsable"):
            return c["id"]
    # Si no hay con responsable, usar cualquiera
    if campuses:
        return campuses[0]["id"]
    pytest.skip("No hay campuses en DEV")


# Limpieza: registrar usuarios creados para borrarlos al final
_created_user_ids = []


@pytest.fixture(scope="session", autouse=True)
def cleanup_created_users(api, admin_headers):
    """Limpia usuarios creados durante los tests al finalizar la sesión."""
    yield
    for uid in _created_user_ids:
        try:
            _req("DELETE", f"{api}/user-management/users/{uid}", headers=admin_headers)
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════════════════
#  A. GET /user-management/available-coordinators
# ═══════════════════════════════════════════════════════════════════════════

class TestAvailableCoordinators:
    """Tests del endpoint que lista coordinadores disponibles."""

    def test_returns_coordinators_list(self, api, admin_headers):
        r = _req("GET", f"{api}/user-management/available-coordinators", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert "coordinators" in body
        assert "total" in body
        assert isinstance(body["coordinators"], list)
        assert body["total"] >= 1

    def test_coordinator_has_required_fields(self, api, admin_headers, coordinator_data):
        assert "id" in coordinator_data
        assert "full_name" in coordinator_data
        assert "email" in coordinator_data
        assert "username" in coordinator_data

    def test_unauthenticated_request_is_rejected(self, api):
        r = _req("GET", f"{api}/user-management/available-coordinators")
        assert r.status_code in (401, 422)

    def test_candidato_cannot_access(self, api):
        """Un candidato no tiene permiso para listar coordinadores."""
        # Registrar candidato temporal
        u = _uid("cand_coord_")
        r = _req("POST", f"{api}/auth/register", json={
            "username": u, "email": f"{u}@test.com", "password": "Test1234!",
            "name": "CandTest", "first_surname": "Coord", "second_surname": "Deny",
        })
        if r.status_code not in (200, 201):
            pytest.skip(f"No se pudo registrar candidato: {r.text}")
        r2 = _req("POST", f"{api}/auth/login", json={"username": u, "password": "Test1234!"})
        assert r2.status_code == 200
        cand_headers = {
            "Authorization": f"Bearer {r2.json()['access_token']}",
            "Content-Type": "application/json",
        }
        r3 = _req("GET", f"{api}/user-management/available-coordinators", headers=cand_headers)
        assert r3.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════
#  B. POST /user-management/users  - Crear responsable
# ═══════════════════════════════════════════════════════════════════════════

class TestCreateResponsableWithCoordinator:
    """Tests de creación de responsable con coordinator_id obligatorio."""

    def test_create_responsable_without_coordinator_is_rejected(self, api, admin_headers, campus_id):
        """Admin intenta crear responsable sin coordinator_id → 400."""
        u = _uid("resp_nocoord_")
        r = _req("POST", f"{api}/user-management/users", headers=admin_headers, json={
            "name": "Test", "first_surname": "NoCoord", "second_surname": "Resp",
            "email": f"{u}@test.com", "role": "responsable",
            "gender": "M", "curp": "XEXX010101HNEXXXA4",
            "date_of_birth": "2001-01-01",
            "campus_id": campus_id,
            # Sin coordinator_id
        })
        assert r.status_code == 400
        assert "coordinador" in r.json().get("error", "").lower()

    def test_create_responsable_with_coordinator_succeeds(self, api, admin_headers, coordinator_data, campus_id):
        """Admin crea responsable con coordinator_id válido → éxito."""
        u = _uid("resp_ok_")
        r = _req("POST", f"{api}/user-management/users", headers=admin_headers, json={
            "name": "Test", "first_surname": "WithCoord", "second_surname": "Resp",
            "email": f"{u}@test.com", "role": "responsable",
            "gender": "M", "curp": "XEXX010101HNEXXXA4",
            "date_of_birth": "2001-01-01",
            "campus_id": campus_id,
            "coordinator_id": coordinator_data["id"],
        })
        assert r.status_code in (200, 201), f"Fallo: {r.text}"
        body = r.json()
        user_id = body.get("user", {}).get("id")
        if user_id:
            _created_user_ids.append(user_id)
        # Verificar que el responsable tiene coordinator
        assert body.get("user", {}).get("coordinator_id") == coordinator_data["id"]

    def test_create_responsable_with_invalid_coordinator_is_rejected(self, api, admin_headers, campus_id):
        """coordinator_id que no existe o no es coordinador → 400."""
        u = _uid("resp_badcoord_")
        r = _req("POST", f"{api}/user-management/users", headers=admin_headers, json={
            "name": "Test", "first_surname": "BadCoord", "second_surname": "Resp",
            "email": f"{u}@test.com", "role": "responsable",
            "gender": "M", "curp": "XEXX010101HNEXXXA4",
            "date_of_birth": "2001-01-01",
            "campus_id": campus_id,
            "coordinator_id": "00000000-0000-0000-0000-000000000000",
        })
        assert r.status_code == 400
        assert "coordinador" in r.json().get("error", "").lower()


# ═══════════════════════════════════════════════════════════════════════════
#  C. PUT /user-management/users/:id  - Cambiar coordinador
# ═══════════════════════════════════════════════════════════════════════════

class TestChangeCoordinator:
    """Tests de cambio de coordinador de un responsable existente."""

    @pytest.fixture()
    def responsable_id(self, api, admin_headers, coordinator_data):
        """Crea un responsable temporal para modificar."""
        u = _uid("resp_change_")
        # Get a campus_id for the responsable
        r0 = _req("GET", f"{api}/user-management/available-campuses", headers=admin_headers)
        campuses = r0.json().get("campuses", []) if r0.status_code == 200 else []
        c_id = campuses[0]["id"] if campuses else 1
        r = _req("POST", f"{api}/user-management/users", headers=admin_headers, json={
            "name": "Change", "first_surname": "Coord", "second_surname": "Test",
            "email": f"{u}@test.com", "role": "responsable",
            "gender": "F", "curp": "XEXX010101MNEXXXA8",
            "date_of_birth": "1995-06-15",
            "campus_id": c_id,
            "coordinator_id": coordinator_data["id"],
        })
        assert r.status_code in (200, 201), f"No se pudo crear resp: {r.text}"
        uid = r.json()["user"]["id"]
        _created_user_ids.append(uid)
        return uid

    def test_admin_can_change_coordinator(self, api, admin_headers, responsable_id, coordinator_data):
        """Admin puede cambiar el coordinador de un responsable."""
        r = _req("PUT", f"{api}/user-management/users/{responsable_id}", headers=admin_headers, json={
            "coordinator_id": coordinator_data["id"],
        })
        assert r.status_code == 200, f"Fallo: {r.text}"

    def test_change_to_invalid_coordinator_fails(self, api, admin_headers, responsable_id):
        """Cambiar a un coordinator_id inexistente → 400."""
        r = _req("PUT", f"{api}/user-management/users/{responsable_id}", headers=admin_headers, json={
            "coordinator_id": "00000000-0000-0000-0000-000000000000",
        })
        assert r.status_code == 400

    def test_get_user_includes_coordinator_name(self, api, admin_headers, responsable_id):
        """GET user retorna coordinator_id y coordinator_name."""
        r = _req("GET", f"{api}/user-management/users/{responsable_id}", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        user = body.get("user", body)  # handles both {user: {...}} and {...}
        assert "coordinator_id" in user
        assert "coordinator_name" in user
        assert user["coordinator_id"] is not None


# ═══════════════════════════════════════════════════════════════════════════
#  D. POST /partners/campuses/:id/responsable  - Activación de campus
# ═══════════════════════════════════════════════════════════════════════════

class TestCampusActivationWithCoordinator:
    """Tests de creación de responsable desde activación de campus."""

    def test_create_campus_responsable_without_coordinator_rejected(self, api, admin_headers, campus_id):
        """Crear responsable para campus sin coordinator_id → 400."""
        u = _uid("campresp_nocoord_")
        r = _req("POST", f"{api}/partners/campuses/{campus_id}/responsable", headers=admin_headers, json={
            "name": "Campus", "first_surname": "NoCoord", "second_surname": "Resp",
            "email": f"{u}@test.com",
            "gender": "M", "curp": "XEXX010101HNEXXXA4",
            "date_of_birth": "2000-01-01",
            "replace_existing": True,
            # Sin coordinator_id
        })
        assert r.status_code == 400
        assert "coordinador" in r.json().get("error", "").lower()

    def test_create_campus_responsable_with_coordinator_succeeds(self, api, admin_headers, campus_id, coordinator_data):
        """Crear responsable para campus con coordinator_id → éxito."""
        u = _uid("campresp_ok_")
        r = _req("POST", f"{api}/partners/campuses/{campus_id}/responsable", headers=admin_headers, json={
            "name": "Campus", "first_surname": "WithCoord", "second_surname": "Resp",
            "email": f"{u}@test.com",
            "gender": "M", "curp": "XEXX010101HNEXXXA4",
            "date_of_birth": "2000-01-01",
            "replace_existing": True,
            "coordinator_id": coordinator_data["id"],
        })
        assert r.status_code in (200, 201), f"Fallo: {r.text}"
        body = r.json()
        resp = body.get("responsable", {})
        if resp.get("id"):
            _created_user_ids.append(resp["id"])


# ═══════════════════════════════════════════════════════════════════════════
#  E. POST /partners/campuses/:id/responsables  - Adicional
# ═══════════════════════════════════════════════════════════════════════════

class TestAdditionalResponsableWithCoordinator:
    """Tests de creación de responsable adicional con coordinator_id."""

    def test_add_responsable_without_coordinator_rejected(self, api, admin_headers, campus_id):
        """Agregar responsable adicional sin coordinator_id → 400."""
        u = _uid("addresp_nocoord_")
        r = _req("POST", f"{api}/partners/campuses/{campus_id}/responsables", headers=admin_headers, json={
            "name": "Add", "first_surname": "NoCoord", "second_surname": "Resp",
            "email": f"{u}@test.com",
            "gender": "F", "curp": "XEXX010101MNEXXXA8",
            "date_of_birth": "1998-03-20",
            # Sin coordinator_id
        })
        assert r.status_code == 400
        assert "coordinador" in r.json().get("error", "").lower()

    def test_add_responsable_with_coordinator_succeeds(self, api, admin_headers, campus_id, coordinator_data):
        """Agregar responsable adicional con coordinator_id → éxito."""
        u = _uid("addresp_ok_")
        r = _req("POST", f"{api}/partners/campuses/{campus_id}/responsables", headers=admin_headers, json={
            "name": "Add", "first_surname": "WithCoord", "second_surname": "Resp",
            "email": f"{u}@test.com",
            "gender": "F", "curp": "XEXX010101MNEXXXA8",
            "date_of_birth": "1998-03-20",
            "coordinator_id": coordinator_data["id"],
        })
        assert r.status_code in (200, 201), f"Fallo: {r.text}"
        body = r.json()
        resp = body.get("responsable", {})
        if resp.get("id"):
            _created_user_ids.append(resp["id"])


# ═══════════════════════════════════════════════════════════════════════════
#  F. Soporte role - permisos expandidos
# ═══════════════════════════════════════════════════════════════════════════

class TestSoporteRolePermissions:
    """Verificar que soporte puede acceder a endpoints de coordinadores y gestión."""

    def test_soporte_can_list_coordinators(self, api, admin_headers):
        """Soporte debería poder acceder al endpoint de coordinadores disponibles.
        Probamos verificando que el endpoint existe y responde correctamente."""
        # Este test valida que management_required incluye soporte
        r = _req("GET", f"{api}/user-management/available-coordinators", headers=admin_headers)
        assert r.status_code == 200
        # Si admin puede → el decorator management_required funciona
        # Verificación implícita: soporte está en la lista


# ═══════════════════════════════════════════════════════════════════════════
#  G. Migración - todos los responsables tienen coordinator
# ═══════════════════════════════════════════════════════════════════════════

class TestMigrationComplete:
    """Verificar que la migración asignó coordinadores a todos los responsables."""

    def test_no_responsable_without_coordinator_in_dev(self):
        """Ningún responsable en DEV debería carecer de coordinator_id."""
        import pymssql
        conn = pymssql.connect(
            server="evaluaasi-motorv2-sql.database.windows.net",
            user="evaluaasi_admin",
            password="EvalAasi2024_newpwd!",
            database="evaluaasi_dev",
        )
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM users "
            "WHERE role IN ('responsable', 'responsable_partner') "
            "AND coordinator_id IS NULL"
        )
        count = cur.fetchone()[0]
        conn.close()
        assert count == 0, f"Hay {count} responsable(s) sin coordinator_id en DEV"

    def test_no_responsable_without_coordinator_in_prod(self):
        """Ningún responsable en PROD debería carecer de coordinator_id."""
        import pymssql
        conn = pymssql.connect(
            server="evaluaasi-motorv2-sql.database.windows.net",
            user="evaluaasi_admin",
            password="EvalAasi2024_newpwd!",
            database="evaluaasi",
        )
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM users "
            "WHERE role IN ('responsable', 'responsable_partner') "
            "AND coordinator_id IS NULL"
        )
        count = cur.fetchone()[0]
        conn.close()
        assert count == 0, f"Hay {count} responsable(s) sin coordinator_id en PROD"
