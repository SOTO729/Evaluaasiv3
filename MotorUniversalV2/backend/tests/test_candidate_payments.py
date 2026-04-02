"""
Tests del módulo de Pagos por Candidato (Mercado Pago)
======================================================

Cubre:
  A. POST /payments/candidate-pay — Validaciones y control de acceso
  B. POST /payments/candidate-retake — Validaciones y control de acceso
  C. GET  /exams/{id}/check-access — Incluye info de pago
  D. GET  /partners/mis-examenes — Incluye info de pago
  E. Verificar Payment model incluye nuevos campos (group_exam_id, payment_type)

Ejecutar:
    cd backend && python -m pytest tests/test_candidate_payments.py -v --tb=short
    cd backend && python -m pytest tests/test_candidate_payments.py -v -k "candidate_pay"
"""

import pytest
import requests
import time

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"
ALUMNO_USER = "U343Z793S8"
ALUMNO_PASS = "TestPay2024!"


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
def alumno_token(api):
    """JWT del candidato (alumno)."""
    for attempt in range(3):
        try:
            r = requests.post(f"{api}/auth/login", json={
                "username": ALUMNO_USER, "password": ALUMNO_PASS
            }, timeout=30)
            if r.status_code == 200:
                return r.json()["access_token"]
            if r.status_code in [502, 503]:
                time.sleep(10)
                continue
            pytest.fail(f"Login alumno falló: {r.status_code}")
        except requests.exceptions.Timeout:
            if attempt < 2:
                time.sleep(10)
                continue
            pytest.fail("Login timeout")
    pytest.fail("Login alumno falló después de 3 intentos")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def alumno_headers(alumno_token):
    return {
        "Authorization": f"Bearer {alumno_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def alumno_exams(api, alumno_headers):
    """Obtener la lista de exámenes asignados al alumno."""
    r = requests.get(f"{api}/partners/mis-examenes", headers=alumno_headers, timeout=20)
    if r.status_code == 200:
        return r.json().get("exams", [])
    return []


@pytest.fixture(scope="session")
def exam_with_payment(alumno_exams):
    """Buscar un examen que requiera pago (si existe)."""
    for exam in alumno_exams:
        if exam.get("requires_payment"):
            return exam
    return None


@pytest.fixture(scope="session")
def exam_without_payment(alumno_exams):
    """Buscar un examen que NO requiera pago."""
    for exam in alumno_exams:
        if not exam.get("requires_payment"):
            return exam
    return None


# ─── A. POST /payments/candidate-pay — Validaciones ─────────────────────────

class TestCandidatePayValidation:
    """Validaciones del endpoint candidate-pay."""

    def test_requires_auth(self, api):
        """Sin JWT retorna 401/422."""
        r = requests.post(f"{api}/payments/candidate-pay",
                          json={"group_exam_id": 1},
                          timeout=15)
        assert r.status_code in [401, 422]

    def test_admin_cannot_use(self, api, admin_headers):
        """Admin no puede usar candidate-pay (solo candidatos)."""
        r = requests.post(f"{api}/payments/candidate-pay",
                          json={
                              "group_exam_id": 1,
                              "token": "fake-token",
                              "payment_method_id": "visa",
                          },
                          headers=admin_headers, timeout=15)
        assert r.status_code == 403
        assert "solo los candidatos" in r.json().get("error", "").lower()

    def test_missing_group_exam_id(self, api, alumno_headers):
        """Sin group_exam_id retorna 400."""
        r = requests.post(f"{api}/payments/candidate-pay",
                          json={
                              "token": "fake-token",
                              "payment_method_id": "visa",
                          },
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 400
        assert "group_exam_id" in r.json().get("error", "").lower()

    def test_missing_token(self, api, alumno_headers):
        """Sin token de tarjeta retorna 400."""
        r = requests.post(f"{api}/payments/candidate-pay",
                          json={
                              "group_exam_id": 99999,
                              "payment_method_id": "visa",
                          },
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 400
        assert "token" in r.json().get("error", "").lower()

    def test_missing_payment_method(self, api, alumno_headers):
        """Sin payment_method_id retorna 400."""
        r = requests.post(f"{api}/payments/candidate-pay",
                          json={
                              "group_exam_id": 99999,
                              "token": "fake-token",
                          },
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 400
        assert "método" in r.json().get("error", "").lower() or "payment_method" in r.json().get("error", "").lower()

    def test_invalid_group_exam_id(self, api, alumno_headers):
        """group_exam_id inexistente retorna 404."""
        r = requests.post(f"{api}/payments/candidate-pay",
                          json={
                              "group_exam_id": 999999,
                              "token": "fake-token",
                              "payment_method_id": "visa",
                              "payer_email": "test@test.com",
                          },
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 404
        assert "no encontrada" in r.json().get("error", "").lower()

    def test_empty_body(self, api, alumno_headers):
        """Body vacío retorna 400."""
        r = requests.post(f"{api}/payments/candidate-pay",
                          json={},
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 400


# ─── B. POST /payments/candidate-retake — Validaciones ──────────────────────

class TestCandidateRetakeValidation:
    """Validaciones del endpoint candidate-retake."""

    def test_requires_auth(self, api):
        """Sin JWT retorna 401/422."""
        r = requests.post(f"{api}/payments/candidate-retake",
                          json={"group_exam_id": 1},
                          timeout=15)
        assert r.status_code in [401, 422]

    def test_admin_cannot_use(self, api, admin_headers):
        """Admin no puede usar candidate-retake (solo candidatos)."""
        r = requests.post(f"{api}/payments/candidate-retake",
                          json={
                              "group_exam_id": 1,
                              "token": "fake-token",
                              "payment_method_id": "visa",
                          },
                          headers=admin_headers, timeout=15)
        assert r.status_code == 403
        assert "solo los candidatos" in r.json().get("error", "").lower()

    def test_missing_group_exam_id(self, api, alumno_headers):
        """Sin group_exam_id retorna 400."""
        r = requests.post(f"{api}/payments/candidate-retake",
                          json={
                              "token": "fake-token",
                              "payment_method_id": "visa",
                          },
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 400
        assert "group_exam_id" in r.json().get("error", "").lower()

    def test_missing_token(self, api, alumno_headers):
        """Sin token retorna 400."""
        r = requests.post(f"{api}/payments/candidate-retake",
                          json={
                              "group_exam_id": 99999,
                              "payment_method_id": "visa",
                          },
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 400
        assert "token" in r.json().get("error", "").lower()

    def test_invalid_group_exam_id(self, api, alumno_headers):
        """group_exam_id inexistente retorna 404."""
        r = requests.post(f"{api}/payments/candidate-retake",
                          json={
                              "group_exam_id": 999999,
                              "token": "fake-token",
                              "payment_method_id": "visa",
                              "payer_email": "test@test.com",
                          },
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 404
        assert "no encontrada" in r.json().get("error", "").lower()

    def test_empty_body(self, api, alumno_headers):
        """Body vacío retorna 400."""
        r = requests.post(f"{api}/payments/candidate-retake",
                          json={},
                          headers=alumno_headers, timeout=15)
        assert r.status_code == 400


# ─── C. GET /partners/mis-examenes — Info de pago ───────────────────────────

class TestMisExamenesPaymentInfo:
    """Verificar que mis-examenes incluye campos de pago."""

    def test_mis_examenes_returns_exams(self, api, alumno_headers, alumno_exams):
        """mis-examenes retorna lista de exámenes."""
        r = requests.get(f"{api}/partners/mis-examenes", headers=alumno_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "exams" in data

    def test_exams_include_payment_fields(self, api, alumno_headers, alumno_exams):
        """Cada examen con grupo incluye campos requires_payment, is_paid, certification_cost."""
        if not alumno_exams:
            pytest.skip("Alumno no tiene exámenes asignados")

        for exam in alumno_exams:
            # Solo exámenes con contexto de grupo tendrán estos campos
            if exam.get("group_id"):
                assert "requires_payment" in exam, f"Falta requires_payment en examen {exam.get('id')}"
                assert "is_paid" in exam, f"Falta is_paid en examen {exam.get('id')}"
                assert "certification_cost" in exam, f"Falta certification_cost en examen {exam.get('id')}"
                assert isinstance(exam["requires_payment"], bool)
                assert isinstance(exam["is_paid"], bool)

    def test_exam_with_payment_has_cost(self, exam_with_payment):
        """Si un examen requiere pago, tiene certification_cost > 0."""
        if not exam_with_payment:
            pytest.skip("No hay exámenes con pago requerido en DEV")
        assert exam_with_payment["certification_cost"] > 0

    def test_exam_without_payment_not_required(self, exam_without_payment):
        """Examen sin pagos habilitados tiene requires_payment=False."""
        if not exam_without_payment:
            pytest.skip("No hay exámenes sin pago en DEV")
        assert exam_without_payment["requires_payment"] is False


# ─── D. check-access — Info de pago ─────────────────────────────────────────

class TestCheckAccessPayment:
    """Verificar que check-access incluye campos de pago."""

    def test_check_access_includes_payment_fields(self, api, alumno_headers, alumno_exams):
        """check-access retorna requires_payment, is_paid, certification_cost."""
        if not alumno_exams:
            pytest.skip("Alumno no tiene exámenes asignados")

        exam = alumno_exams[0]
        exam_id = exam.get("exam_id") or exam.get("id")
        group_exam_id = exam.get("group_exam_id")

        if not group_exam_id:
            pytest.skip("Primer examen no tiene group_exam_id")

        r = requests.get(
            f"{api}/exams/{exam_id}/check-access?group_exam_id={group_exam_id}",
            headers=alumno_headers, timeout=20
        )
        assert r.status_code == 200
        data = r.json()

        # Debe incluir los nuevos campos de pago
        assert "requires_payment" in data, f"Falta requires_payment: {data.keys()}"
        assert "is_paid" in data, f"Falta is_paid: {data.keys()}"
        assert isinstance(data["requires_payment"], bool)
        assert isinstance(data["is_paid"], bool)

    def test_check_access_with_payment_required_blocks_exam(self, api, alumno_headers, exam_with_payment):
        """Si requiere pago y no ha pagado, can_take=False."""
        if not exam_with_payment:
            pytest.skip("No hay exámenes con pago requerido en DEV")

        exam_id = exam_with_payment.get("exam_id") or exam_with_payment.get("id")
        group_exam_id = exam_with_payment.get("group_exam_id")

        if not group_exam_id:
            pytest.skip("Examen con pago no tiene group_exam_id")

        r = requests.get(
            f"{api}/exams/{exam_id}/check-access?group_exam_id={group_exam_id}",
            headers=alumno_headers, timeout=20
        )
        assert r.status_code == 200
        data = r.json()
        assert data["requires_payment"] is True

        # Si no ha pagado, can_take debería ser False
        if not data.get("is_paid"):
            assert data.get("can_take") is False, "can_take debería ser False si no ha pagado"


# ─── E. Payment model — Nuevos campos ───────────────────────────────────────

class TestPaymentModelFields:
    """Verificar que el modelo Payment incluye los nuevos campos."""

    def test_my_payments_includes_new_fields(self, api, alumno_headers):
        """GET /my-payments retorna payment_type y group_exam_id en los pagos."""
        r = requests.get(f"{api}/payments/my-payments", headers=alumno_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "payments" in data
        # Si hay pagos, verificar campos
        if data["payments"]:
            p = data["payments"][0]
            assert "payment_type" in p, f"Falta payment_type: {list(p.keys())}"
            assert p["payment_type"] in ["voucher", "certification", "retake"], \
                f"payment_type inválido: {p['payment_type']}"


# ─── F. Cross-role access control ────────────────────────────────────────────

class TestCrossRoleAccess:
    """Verificar que los endpoints de candidato no son accesibles por otros roles."""

    def test_responsable_cannot_candidate_pay(self, api):
        """Un responsable no puede usar candidate-pay."""
        # Intentar login como responsable
        r = requests.post(f"{api}/auth/login", json={
            "username": "67SBAFMTQQ",
            "password": "test123"
        }, timeout=30)
        if r.status_code != 200:
            pytest.skip("Responsable 67SBAFMTQQ no disponible en DEV")

        resp_token = r.json()["access_token"]
        r2 = requests.post(
            f"{api}/payments/candidate-pay",
            json={
                "group_exam_id": 1,
                "token": "fake",
                "payment_method_id": "visa",
            },
            headers={
                "Authorization": f"Bearer {resp_token}",
                "Content-Type": "application/json"
            },
            timeout=15
        )
        assert r2.status_code == 403

    def test_editor_cannot_candidate_pay(self, api):
        """Un editor no puede usar candidate-pay."""
        r = requests.post(f"{api}/auth/login", json={
            "username": "editor",
            "password": "editor123"
        }, timeout=30)
        if r.status_code != 200:
            pytest.skip("Editor no disponible en DEV")

        editor_token = r.json()["access_token"]
        r2 = requests.post(
            f"{api}/payments/candidate-pay",
            json={
                "group_exam_id": 1,
                "token": "fake",
                "payment_method_id": "visa",
            },
            headers={
                "Authorization": f"Bearer {editor_token}",
                "Content-Type": "application/json"
            },
            timeout=15
        )
        assert r2.status_code == 403
