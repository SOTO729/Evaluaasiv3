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
import time

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
    """Obtener JWT token de admin (con retry para cold-starts de Container Apps)"""
    for attempt in range(3):
        try:
            r = requests.post(f"{api}/auth/login", json={
                "username": ADMIN_USER,
                "password": ADMIN_PASS
            }, timeout=30)
            if r.status_code == 200:
                data = r.json()
                assert "access_token" in data
                return data["access_token"]
            if r.status_code in [502, 503]:
                time.sleep(10)
                continue
            pytest.fail(f"Login falló con status {r.status_code}: {r.text}")
        except requests.exceptions.Timeout:
            if attempt < 2:
                time.sleep(10)
                continue
            pytest.fail("Login timeout después de 3 intentos")
    pytest.fail("Login falló después de 3 intentos (502/503 persistente)")


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

    def test_update_status_rejected_by_coordinator(self):
        """Actualizar a 'rejected_by_coordinator' funciona"""
        if not self.existing_requests:
            pytest.skip("No hay solicitudes para actualizar")
        req_id = self.existing_requests[0]["id"]
        r = requests.put(
            f"{self.api}/balance/certificate-request/{req_id}/status",
            json={"status": "rejected_by_coordinator"},
            headers=self.headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "rejected_by_coordinator"

    def test_update_status_rejected_not_allowed(self):
        """'rejected' (sin sufijo) no está permitido via /status"""
        if not self.existing_requests:
            pytest.skip("No hay solicitudes para actualizar")
        req_id = self.existing_requests[0]["id"]
        r = requests.put(
            f"{self.api}/balance/certificate-request/{req_id}/status",
            json={"status": "rejected"},
            headers=self.headers
        )
        assert r.status_code == 400

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

# ═══════════════════════════════════════════════════════════════════════════
# F. REVIEW — VALIDACIONES DE ENDPOINT (no requieren solicitud previa)
# ═══════════════════════════════════════════════════════════════════════════

class TestReviewEndpointValidation:
    """Tests para PUT /balance/certificate-request/<id>/review — validaciones directas"""

    def test_review_nonexistent_request(self, api, headers):
        """Solicitud inexistente retorna 404"""
        r = requests.put(
            f"{api}/balance/certificate-request/999999/review",
            json={"action": "approve", "units": 1},
            headers=headers
        )
        assert r.status_code == 404

    def test_review_no_auth(self, api):
        """Sin token retorna 401"""
        r = requests.put(
            f"{api}/balance/certificate-request/999999/review",
            json={"action": "approve", "units": 5}
        )
        assert r.status_code in [401, 422]

    def test_review_no_action_on_existing(self, api, headers):
        """Enviar review sin acción a solicitud existente retorna 400"""
        # Buscar cualquier solicitud existente
        r = requests.get(f"{api}/balance/certificate-requests", headers=headers)
        reqs = r.json().get("requests", [])
        if not reqs:
            pytest.skip("No hay solicitudes existentes")
        req_id = reqs[0]["id"]
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/review",
            json={"notes": "algo"},
            headers=headers
        )
        assert r.status_code == 400

    def test_review_invalid_action_on_existing(self, api, headers):
        """Acción inválida en solicitud existente retorna 400"""
        r = requests.get(f"{api}/balance/certificate-requests", headers=headers)
        reqs = r.json().get("requests", [])
        if not reqs:
            pytest.skip("No hay solicitudes existentes")
        req_id = reqs[0]["id"]
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/review",
            json={"action": "cancel"},
            headers=headers
        )
        assert r.status_code == 400
        err = r.json().get("error", "").lower()
        assert "inválida" in err or "invalid" in err or "procesada" in err


# ═══════════════════════════════════════════════════════════════════════════
# F2. REVIEW — FLUJO CON SOLICITUD (requieren crear solicitud)
# ═══════════════════════════════════════════════════════════════════════════

class TestReviewCertificateRequest:
    """Tests para PUT /balance/certificate-request/<id>/review — requieren solicitud"""

    @pytest.fixture(autouse=True)
    def create_review_request(self, api, headers, first_campus):
        """Crear una solicitud fresca para cada test de review"""
        self.api = api
        self.headers = headers
        self.campus = first_campus
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 10,
            "justification": "Test review - pytest automatizado"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        if r.status_code != 201:
            pytest.skip(f"No se pudo crear solicitud para review (sin coordinador asignado): {r.text}")
        self.req_id = r.json()["request"]["id"]

    def test_review_reject(self):
        """Rechazar solicitud con notas"""
        r = requests.put(
            f"{self.api}/balance/certificate-request/{self.req_id}/review",
            json={"action": "reject", "notes": "No hay presupuesto suficiente"},
            headers=self.headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["request"]["status"] == "rejected_by_coordinator"
        assert "presupuesto" in (data["request"].get("coordinator_notes") or "").lower()

    def test_review_reject_without_notes(self):
        """Rechazar sin notas usa mensaje por defecto"""
        r = requests.put(
            f"{self.api}/balance/certificate-request/{self.req_id}/review",
            json={"action": "reject"},
            headers=self.headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["request"]["status"] == "rejected_by_coordinator"
        assert data["request"]["coordinator_notes"] is not None

    def test_review_modify_units(self):
        """Modificar unidades cambia coordinator_units y estado"""
        r = requests.put(
            f"{self.api}/balance/certificate-request/{self.req_id}/review",
            json={"action": "modify", "units": 7, "notes": "Ajustado a 7"},
            headers=self.headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["request"]["status"] == "modified"
        assert data["request"]["coordinator_units"] == 7
        assert "7" in (data["request"].get("coordinator_notes") or "")

    def test_review_modify_group(self):
        """Modificar grupo asigna coordinator_group_id"""
        r = requests.put(
            f"{self.api}/balance/certificate-request/{self.req_id}/review",
            json={"action": "modify", "units": 10, "group_id": None, "notes": "Sin grupo"},
            headers=self.headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["request"]["status"] == "modified"

    def test_review_approve(self):
        """Aprobar crea BalanceRequest y cambia a forwarded"""
        r = requests.put(
            f"{self.api}/balance/certificate-request/{self.req_id}/review",
            json={"action": "approve", "units": 10, "notes": "Aprobado por test"},
            headers=self.headers
        )
        # 200 si todo ok, 400 si costo campus=0
        assert r.status_code in [200, 400], f"Status inesperado: {r.status_code} — {r.text}"
        if r.status_code == 200:
            data = r.json()
            assert data["request"]["status"] == "forwarded"
            assert data["request"]["forwarded_request_id"] is not None
            assert "balance_request_id" in data

    def test_review_approve_sets_forwarded_at(self):
        """Aprobar registra forwarded_at"""
        r = requests.put(
            f"{self.api}/balance/certificate-request/{self.req_id}/review",
            json={"action": "approve", "units": 5},
            headers=self.headers
        )
        if r.status_code == 200:
            data = r.json()
            assert data["request"]["forwarded_at"] is not None

    def test_review_already_processed(self):
        """Solicitud rechazada por coordinador puede ser re-revisada (reconsiderada)"""
        # Primero rechazar
        requests.put(
            f"{self.api}/balance/certificate-request/{self.req_id}/review",
            json={"action": "reject", "notes": "Rechazada para test"},
            headers=self.headers
        )
        # El coordinador puede reconsiderar una solicitud rechazada por él mismo
        r = requests.put(
            f"{self.api}/balance/certificate-request/{self.req_id}/review",
            json={"action": "modify", "units": 5, "notes": "Reconsiderada"},
            headers=self.headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "modified"


# ═══════════════════════════════════════════════════════════════════════════
# G. FLUJO COMPLETO CON REVIEW
# ═══════════════════════════════════════════════════════════════════════════

class TestFullReviewFlow:
    """Test flujo completo: crear → seen → modify → approve"""

    def test_responsable_to_coordinator_to_approval(self, api, headers, first_campus):
        """Crear solicitud → mark seen → modify → approve → verify forwarded"""
        # 1. Crear solicitud
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 15,
            "justification": "Test flujo review completo"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        if r.status_code != 201:
            pytest.skip(f"No se pudo crear: {r.text}")
        req_id = r.json()["request"]["id"]
        assert r.json()["request"]["status"] == "pending"

        # 2. Marcar como vista
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/status",
            json={"status": "seen"},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "seen"

        # 3. Modificar unidades
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/review",
            json={"action": "modify", "units": 12, "notes": "Ajustado de 15 a 12"},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["request"]["status"] == "modified"
        assert r.json()["request"]["coordinator_units"] == 12

        # 4. Aprobar y enviar al flujo
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/review",
            json={"action": "approve", "units": 12, "notes": "Aprobado tras modificación"},
            headers=headers
        )
        if r.status_code == 200:
            data = r.json()
            assert data["request"]["status"] == "forwarded"
            assert data["request"]["forwarded_request_id"] is not None
            assert data["balance_request_id"] is not None
            # Verificar que la solicitud de balance se creó
            br_id = data["balance_request_id"]
            r2 = requests.get(f"{api}/balance/requests/{br_id}", headers=headers)
            if r2.status_code == 200:
                br = r2.json()
                assert br.get("status") in ["pending", "in_review"]
        else:
            # 400 si campus no tiene costo configurado
            assert r.status_code == 400

    def test_responsable_coordinator_reject_flow(self, api, headers, first_campus):
        """Crear solicitud → seen → reject → verify status"""
        # 1. Crear
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 3,
            "justification": "Test flujo rechazo"
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        if r.status_code != 201:
            pytest.skip(f"No se pudo crear: {r.text}")
        req_id = r.json()["request"]["id"]

        # 2. Marcar como vista
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/status",
            json={"status": "seen"},
            headers=headers
        )
        assert r.status_code == 200

        # 3. Rechazar
        r = requests.put(
            f"{api}/balance/certificate-request/{req_id}/review",
            json={"action": "reject", "notes": "Documentación incompleta"},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["request"]["status"] == "rejected_by_coordinator"
        assert "incompleta" in (data["request"]["coordinator_notes"] or "").lower()

        # 4. Verificar en lista
        r = requests.get(f"{api}/balance/certificate-requests", headers=headers)
        assert r.status_code == 200
        match = [req for req in r.json()["requests"] if req["id"] == req_id]
        assert len(match) == 1
        assert match[0]["status"] == "rejected_by_coordinator"

    def test_create_with_attachments_metadata(self, api, headers, first_campus):
        """Crear solicitud con metadatos de adjuntos preserva la info"""
        payload = {
            "campus_id": first_campus["id"],
            "units_requested": 5,
            "justification": "Test con adjuntos metadata",
            "attachments": [
                {"name": "documento.pdf", "url": "https://example.com/doc.pdf", "size": 1024},
                {"name": "imagen.png", "url": "https://example.com/img.png", "size": 2048},
            ]
        }
        r = requests.post(f"{api}/balance/certificate-request", json=payload, headers=headers)
        if r.status_code != 201:
            pytest.skip(f"No se pudo crear: {r.text}")
        data = r.json()["request"]
        attachments = data.get("attachments") or []
        assert len(attachments) == 2
        assert attachments[0]["name"] == "documento.pdf"
        assert attachments[1]["name"] == "imagen.png"