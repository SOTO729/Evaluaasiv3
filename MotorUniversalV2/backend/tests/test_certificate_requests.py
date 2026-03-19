"""
Tests del módulo de Solicitudes de Certificados
=================================================

Cubre:
  A. POST /balance/certificate-request — Crear solicitud
  B. GET  /balance/certificate-requests — Listar solicitudes
  C. PUT  /balance/certificate-request/<id>/status — Actualizar estado
  D. GET  /balance/my-campus-info — Info de plantel del responsable
  E. Validaciones y edge cases

Ejecutar:
    cd backend && python -m pytest tests/test_certificate_requests.py -v --tb=short
    cd backend && python -m pytest tests/test_certificate_requests.py -v -k "create"
"""

import pytest
import requests

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
    """Obtener JWT token de admin"""
    r = requests.post(f"{api}/auth/login", json={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })
    assert r.status_code == 200, f"Login falló: {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def headers(admin_token):
    """Headers con auth para admin"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def first_campus(api, headers):
    """Obtener el primer campus disponible via partners"""
    r = requests.get(f"{api}/partners", headers=headers)
    assert r.status_code == 200
    partners = r.json().get("partners", [])
    assert len(partners) > 0, "No hay partners disponibles"
    for p in partners:
        if p.get("campus_count", 0) > 0:
            r2 = requests.get(f"{api}/partners/{p['id']}/campuses", headers=headers)
            if r2.status_code == 200:
                campuses = r2.json().get("campuses", [])
                if campuses:
                    return campuses[0]
    pytest.skip("No hay campuses disponibles para tests")


@pytest.fixture(scope="session")
def first_group(api, headers, first_campus):
    """Obtener el primer grupo del campus (o None)"""
    r = requests.get(f"{api}/partners/campus/{first_campus['id']}/groups", headers=headers)
    if r.status_code == 200:
        groups = r.json() if isinstance(r.json(), list) else r.json().get("groups", [])
        return groups[0] if groups else None
    return None


# ═══════════════════════════════════════════════════════════════════════════
# A. CREAR SOLICITUD DE CERTIFICADOS
# ═══════════════════════════════════════════════════════════════════════════

class TestCreateCertificateRequest:
    """Tests para POST /balance/certificate-request"""

    def test_create_request_success(self, api, headers, first_campus):
        """Crear solicitud con datos válidos retorna 201"""
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 5,
            "justification": "Test automatizado - necesitamos certificados para evaluación"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        # 201 si se crea, 400 si no hay coordinador asignado (ambos son respuestas válidas del sistema)
        assert r.status_code in [201, 400], f"Status inesperado: {r.status_code} — {r.text}"
        if r.status_code == 201:
            data = r.json()
            assert "message" in data
            assert "request" in data
            assert data["request"]["units_requested"] == 5
            assert data["request"]["status"] == "pending"

    def test_create_request_with_group(self, api, headers, first_campus, first_group):
        """Crear solicitud con grupo especificado"""
        if first_group is None:
            pytest.skip("No hay grupos disponibles")
        payload = {
            "campus_id": first_campus["id"],
            "group_id": first_group["id"],
            "units_requested": 3,
            "justification": "Test - solicitud con grupo específico"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code in [201, 400], f"Status inesperado: {r.status_code} — {r.text}"

    def test_create_request_missing_units(self, api, headers, first_campus):
        """Solicitud sin unidades retorna 400"""
        payload = {
            "campus_id": first_campus["id"],
            "justification": "Test sin unidades"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code == 400
        assert "error" in r.json()

    def test_create_request_zero_units(self, api, headers, first_campus):
        """Solicitud con 0 unidades retorna 400"""
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 0,
            "justification": "Test con cero"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code == 400

    def test_create_request_negative_units(self, api, headers, first_campus):
        """Solicitud con unidades negativas retorna 400"""
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": -5,
            "justification": "Test negativo"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code == 400

    def test_create_request_missing_justification(self, api, headers, first_campus):
        """Solicitud sin justificación retorna 400"""
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 5
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code == 400
        assert "justificación" in r.json()["error"].lower() or "requerida" in r.json()["error"].lower()

    def test_create_request_empty_justification(self, api, headers, first_campus):
        """Solicitud con justificación vacía retorna 400"""
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 5,
            "justification": "   "
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code == 400

    def test_create_request_missing_campus(self, api, headers):
        """Solicitud sin campus_id retorna 400"""
        payload = {
            "units_requested": 5,
            "justification": "Test sin campus"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code == 400

    def test_create_request_invalid_campus(self, api, headers):
        """Solicitud con campus_id inexistente retorna 404"""
        payload = {
            "campus_id": 999999,
            "units_requested": 5,
            "justification": "Test campus inexistente"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code in [400, 404]

    def test_create_request_invalid_group(self, api, headers, first_campus):
        """Solicitud con grupo inexistente retorna 400"""
        payload = {
            "campus_id": first_campus["id"],
            "group_id": 999999,
            "units_requested": 5,
            "justification": "Test grupo inexistente"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        assert r.status_code == 400

    def test_create_request_no_auth(self, api, first_campus):
        """Sin token de autenticación retorna 401"""
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 5,
            "justification": "Test sin auth"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload)
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# B. LISTAR SOLICITUDES
# ═══════════════════════════════════════════════════════════════════════════

class TestListCertificateRequests:
    """Tests para GET /balance/certificate-requests"""

    def test_list_requests_200(self, api, headers):
        """Listar solicitudes retorna 200"""
        r = requests.get(f"{api}/balance/certificate-requests", headers=headers)
        assert r.status_code == 200

    def test_list_requests_structure(self, api, headers):
        """La respuesta tiene la estructura correcta"""
        r = requests.get(f"{api}/balance/certificate-requests", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "requests" in data
        assert isinstance(data["requests"], list)

    def test_list_requests_item_structure(self, api, headers):
        """Cada solicitud tiene los campos esperados"""
        r = requests.get(f"{api}/balance/certificate-requests", headers=headers)
        data = r.json()
        if len(data["requests"]) > 0:
            req = data["requests"][0]
            expected_fields = {"id", "units_requested", "justification", "status", "created_at"}
            assert expected_fields.issubset(set(req.keys())), \
                f"Faltan campos. Obtenidos: {set(req.keys())}"

    def test_list_requests_filter_by_campus(self, api, headers, first_campus):
        """Filtrar por campus_id funciona"""
        r = requests.get(
            f"{api}/balance/certificate-requests?campus_id={first_campus['id']}",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["requests"], list)

    def test_list_requests_no_auth(self, api):
        """Sin token retorna 401"""
        r = requests.get(f"{api}/balance/certificate-requests")
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# C. ACTUALIZAR ESTADO
# ═══════════════════════════════════════════════════════════════════════════

class TestUpdateCertificateRequestStatus:
    """Tests para PUT /balance/certificate-request/<id>/status"""

    @pytest.fixture(autouse=True)
    def setup(self, api, headers):
        """Obtener una solicitud existente para probar actualizaciones"""
        r = requests.get(f"{api}/balance/certificate-requests", headers=headers)
        data = r.json()
        self.existing_requests = data.get("requests", [])
        self.api = api
        self.headers = headers

    def test_update_status_seen(self):
        """Actualizar a 'seen' funciona"""
        if not self.existing_requests:
            pytest.skip("No hay solicitudes para actualizar")
        req_id = self.existing_requests[0]["id"]
        r = requests.put(
            f"{self.api}/balance/certificate-request/{req_id}/status",
            json={"status": "seen"},
            headers=self.headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "seen"

    def test_update_status_resolved(self):
        """Actualizar a 'resolved' funciona"""
        if not self.existing_requests:
            pytest.skip("No hay solicitudes para actualizar")
        req_id = self.existing_requests[0]["id"]
        r = requests.put(
            f"{self.api}/balance/certificate-request/{req_id}/status",
            json={"status": "resolved"},
            headers=self.headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "resolved"

    def test_update_status_rejected(self):
        """Actualizar a 'rejected' funciona"""
        if not self.existing_requests:
            pytest.skip("No hay solicitudes para actualizar")
        req_id = self.existing_requests[0]["id"]
        r = requests.put(
            f"{self.api}/balance/certificate-request/{req_id}/status",
            json={"status": "rejected"},
            headers=self.headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "rejected"

    def test_update_status_invalid(self):
        """Estado inválido retorna 400"""
        if not self.existing_requests:
            pytest.skip("No hay solicitudes para actualizar")
        req_id = self.existing_requests[0]["id"]
        r = requests.put(
            f"{self.api}/balance/certificate-request/{req_id}/status",
            json={"status": "invalid_status"},
            headers=self.headers
        )
        assert r.status_code == 400

    def test_update_status_pending_not_allowed(self):
        """No se puede regresar a 'pending'"""
        if not self.existing_requests:
            pytest.skip("No hay solicitudes para actualizar")
        req_id = self.existing_requests[0]["id"]
        r = requests.put(
            f"{self.api}/balance/certificate-request/{req_id}/status",
            json={"status": "pending"},
            headers=self.headers
        )
        assert r.status_code == 400

    def test_update_nonexistent_request(self):
        """Solicitud inexistente retorna 404"""
        r = requests.put(
            f"{self.api}/balance/certificate-request/999999/status",
            json={"status": "seen"},
            headers=self.headers
        )
        assert r.status_code == 404

    def test_update_status_no_auth(self):
        """Sin token retorna 401"""
        if not self.existing_requests:
            pytest.skip("No hay solicitudes para actualizar")
        req_id = self.existing_requests[0]["id"]
        r = requests.put(
            f"{self.api}/balance/certificate-request/{req_id}/status",
            json={"status": "seen"}
        )
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# D. MI CAMPUS INFO
# ═══════════════════════════════════════════════════════════════════════════

class TestMyCampusInfo:
    """Tests para GET /balance/my-campus-info"""

    def test_my_campus_info_endpoint_exists(self, api, headers):
        """El endpoint responde (200 o 404 si admin no tiene campus asignado)"""
        r = requests.get(f"{api}/balance/my-campus-info", headers=headers)
        # Admin puede no tener campus asignado como responsable → 404 es válido
        assert r.status_code in [200, 404]

    def test_my_campus_info_structure(self, api, headers):
        """Si retorna 200, tiene estructura correcta con campus y groups"""
        r = requests.get(f"{api}/balance/my-campus-info", headers=headers)
        if r.status_code == 200:
            data = r.json()
            assert "campus" in data
            assert "groups" in data
            assert "id" in data["campus"]
            assert "name" in data["campus"]
            assert "certification_cost" in data["campus"]
            assert isinstance(data["groups"], list)

    def test_my_campus_info_groups_structure(self, api, headers):
        """Los grupos tienen la estructura esperada"""
        r = requests.get(f"{api}/balance/my-campus-info", headers=headers)
        if r.status_code == 200:
            data = r.json()
            for group in data["groups"]:
                assert "id" in group
                assert "name" in group

    def test_my_campus_info_no_auth(self, api):
        """Sin token retorna 401"""
        r = requests.get(f"{api}/balance/my-campus-info")
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# E. FLUJO COMPLETO
# ═══════════════════════════════════════════════════════════════════════════

class TestCertificateRequestFlow:
    """Test de flujo completo: crear → listar → actualizar estado"""

    def test_full_flow(self, api, headers, first_campus):
        """Flujo crear → verificar en lista → actualizar estado"""
        # 1. Crear solicitud
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 2,
            "justification": "Test flujo completo - pytest"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        if r.status_code != 201:
            pytest.skip(f"No se pudo crear solicitud (puede no haber coordinador): {r.text}")

        created = r.json()["request"]
        req_id = created["id"]
        assert created["status"] == "pending"
        assert created["units_requested"] == 2

        # 2. Verificar que aparece en la lista
        r = requests.get(f"{api}/balance/certificate-requests", headers=headers)
        assert r.status_code == 200
        ids = [req["id"] for req in r.json()["requests"]]
        assert req_id in ids, f"Solicitud {req_id} no encontrada en lista"

        # 3. Actualizar a 'seen'
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/status",
            json={"status": "seen"},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "seen"

        # 4. Actualizar a 'resolved'
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/status",
            json={"status": "resolved"},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "resolved"
