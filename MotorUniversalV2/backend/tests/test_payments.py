"""
Tests del módulo de Pagos en Línea (Mercado Pago)
==================================================

Cubre:
  A. POST /payments/checkout — Crear preferencia de pago
  B. GET  /payments/my-payments — Listar historial de pagos
  C. GET  /payments/status/<ref> — Consultar estado de un pago
  D. POST /payments/webhook — Recibir notificaciones IPN
  E. Validaciones y control de acceso

Ejecutar:
    cd backend && python -m pytest tests/test_payments.py -v --tb=short
"""

import pytest
import requests
import time

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"

# Responsable con campus online_payments=1 y certification_cost=200
RESPONSABLE_USER = "67SBAFMTQQ"
RESPONSABLE_PASS = "test123"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def responsable_token(api):
    """JWT del responsable con pagos en línea habilitados."""
    for attempt in range(3):
        try:
            r = requests.post(f"{api}/auth/login", json={
                "username": RESPONSABLE_USER,
                "password": RESPONSABLE_PASS
            }, timeout=30)
            if r.status_code == 200:
                data = r.json()
                assert "access_token" in data, f"No access_token: {data}"
                return data["access_token"]
            if r.status_code in [502, 503]:
                time.sleep(10)
                continue
            pytest.fail(f"Login responsable falló: {r.status_code} {r.text}")
        except requests.exceptions.Timeout:
            if attempt < 2:
                time.sleep(10)
                continue
            pytest.fail("Login timeout")
    pytest.fail("Login responsable falló después de 3 intentos")


@pytest.fixture(scope="session")
def admin_token(api):
    """JWT del admin."""
    for attempt in range(3):
        try:
            r = requests.post(f"{api}/auth/login", json={
                "username": ADMIN_USER,
                "password": ADMIN_PASS
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
    pytest.fail("Login admin falló")


@pytest.fixture(scope="session")
def resp_headers(responsable_token):
    return {
        "Authorization": f"Bearer {responsable_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


# ─── A. Verificar balance con enable_online_payments ─────────────────────────

class TestBalanceOnlinePayments:
    """Verificar que el endpoint de balance devuelve enable_online_payments."""

    def test_campus_balance_includes_online_payments_flag(self, api, resp_headers):
        r = requests.get(f"{api}/balance/my-campus-balance", headers=resp_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        campus = data.get("campus", {})
        assert "enable_online_payments" in campus, f"Falta enable_online_payments en campus: {campus}"
        assert campus["enable_online_payments"] is True, "enable_online_payments debería ser True"
        assert campus.get("certification_cost", 0) > 0, "certification_cost debería ser > 0"


# ─── B. POST /payments/checkout ──────────────────────────────────────────────

class TestCheckout:
    """Tests para creación de preferencia de pago."""

    def test_checkout_success(self, api, resp_headers):
        """Crear checkout con datos válidos."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": 3},
                          headers=resp_headers, timeout=20)
        assert r.status_code == 201, f"Esperaba 201, got {r.status_code}: {r.text}"
        data = r.json()
        assert "payment_id" in data
        assert "preference_id" in data
        assert "init_point" in data
        assert "sandbox_init_point" in data
        assert data["init_point"].startswith("https://")
        assert data["sandbox_init_point"].startswith("https://sandbox.")

    def test_checkout_one_unit(self, api, resp_headers):
        """Checkout con 1 unidad (mínimo)."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": 1},
                          headers=resp_headers, timeout=20)
        assert r.status_code == 201
        data = r.json()
        assert data["payment_id"] > 0

    def test_checkout_zero_units_fails(self, api, resp_headers):
        """No permite 0 unidades."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": 0},
                          headers=resp_headers, timeout=15)
        assert r.status_code == 400
        assert "error" in r.json()

    def test_checkout_negative_units_fails(self, api, resp_headers):
        """No permite unidades negativas."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": -5},
                          headers=resp_headers, timeout=15)
        assert r.status_code == 400

    def test_checkout_no_units_fails(self, api, resp_headers):
        """No permite body vacío."""
        r = requests.post(f"{api}/payments/checkout",
                          json={},
                          headers=resp_headers, timeout=15)
        assert r.status_code == 400

    def test_checkout_string_units_fails(self, api, resp_headers):
        """No permite unidades como string."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": "cinco"},
                          headers=resp_headers, timeout=15)
        assert r.status_code == 400

    def test_checkout_over_999_fails(self, api, resp_headers):
        """No permite más de 999 unidades."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": 1000},
                          headers=resp_headers, timeout=15)
        assert r.status_code == 400

    def test_checkout_without_auth_fails(self, api):
        """Sin JWT retorna error."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": 1}, timeout=15)
        assert r.status_code in [401, 404, 422]


# ─── C. GET /payments/my-payments ─────────────────────────────────────────────

class TestMyPayments:
    """Tests para historial de pagos."""

    def test_my_payments_returns_list(self, api, resp_headers):
        """Retorna lista paginada de pagos."""
        r = requests.get(f"{api}/payments/my-payments", headers=resp_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "payments" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert isinstance(data["payments"], list)
        assert data["total"] >= 1  # Al menos el pago de checkout_success

    def test_my_payments_contains_expected_fields(self, api, resp_headers):
        """Cada pago contiene los campos esperados."""
        r = requests.get(f"{api}/payments/my-payments", headers=resp_headers, timeout=15)
        assert r.status_code == 200
        payments = r.json()["payments"]
        assert len(payments) > 0
        p = payments[0]
        expected_fields = [
            "id", "user_id", "campus_id", "units", "unit_price", "total_amount",
            "mp_preference_id", "status", "status_label", "created_at"
        ]
        for field in expected_fields:
            assert field in p, f"Falta campo '{field}' en pago: {p.keys()}"

    def test_my_payments_pagination(self, api, resp_headers):
        """Paginación funciona con per_page=1."""
        r = requests.get(f"{api}/payments/my-payments?per_page=1&page=1",
                         headers=resp_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["payments"]) <= 1
        assert data["per_page"] == 1

    def test_my_payments_filter_by_status(self, api, resp_headers):
        """Filtrar por estado funciona."""
        r = requests.get(f"{api}/payments/my-payments?status=pending",
                         headers=resp_headers, timeout=15)
        assert r.status_code == 200
        for p in r.json()["payments"]:
            assert p["status"] == "pending"

    def test_my_payments_without_auth_fails(self, api):
        """Sin JWT retorna error."""
        r = requests.get(f"{api}/payments/my-payments", timeout=15)
        assert r.status_code in [401, 404, 422]


# ─── D. GET /payments/status/<ref> ───────────────────────────────────────────

class TestPaymentStatus:
    """Tests para consulta de estado por referencia."""

    @pytest.fixture(scope="class")
    def created_payment(self, api, resp_headers):
        """Crear un pago y retornar su external_reference."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": 1},
                          headers=resp_headers, timeout=20)
        assert r.status_code == 201
        pid = r.json()["payment_id"]
        # Obtener la referencia del pago recién creado
        r2 = requests.get(f"{api}/payments/my-payments?per_page=50",
                          headers=resp_headers, timeout=15)
        payments = r2.json()["payments"]
        payment = next((p for p in payments if p["id"] == pid), None)
        assert payment is not None, f"Pago {pid} no encontrado"
        return payment

    def test_status_by_reference(self, api, resp_headers, created_payment):
        """Consultar estado por external_reference."""
        ref = created_payment["mp_external_reference"]
        r = requests.get(f"{api}/payments/status/{ref}",
                         headers=resp_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == created_payment["id"]
        assert data["status"] == "pending"
        assert data["units"] == 1

    def test_status_unknown_reference_404(self, api, resp_headers):
        """Referencia inexistente retorna 404."""
        r = requests.get(f"{api}/payments/status/nonexistent-ref-12345",
                         headers=resp_headers, timeout=15)
        assert r.status_code == 404

    def test_status_without_auth_fails(self, api):
        """Sin JWT retorna error."""
        r = requests.get(f"{api}/payments/status/some-ref", timeout=15)
        assert r.status_code in [401, 404, 422]


# ─── E. POST /payments/webhook ───────────────────────────────────────────────

class TestWebhook:
    """Tests para el endpoint de webhook."""

    def test_webhook_accepts_payment_notification(self, api):
        """Webhook acepta notificaciones de tipo payment (aunque el pago no exista en MP)."""
        r = requests.post(
            f"{api}/payments/webhook?type=payment&data.id=999999999",
            json={},
            timeout=15
        )
        # Siempre retorna 200 (para evitar reintentos de MP)
        assert r.status_code == 200

    def test_webhook_ignores_non_payment_topics(self, api):
        """Webhook ignora notificaciones que no son de pago."""
        r = requests.post(
            f"{api}/payments/webhook?type=merchant_order&data.id=123",
            json={},
            timeout=15
        )
        assert r.status_code == 200
        assert r.json().get("status") in ["ok", "ignored"]

    def test_webhook_without_data_id(self, api):
        """Webhook sin data_id retorna ignored."""
        r = requests.post(
            f"{api}/payments/webhook",
            json={},
            timeout=15
        )
        assert r.status_code == 200
        assert r.json().get("status") == "ignored"

    def test_webhook_with_body_format(self, api):
        """Webhook acepta formato body JSON (webhooks v2)."""
        r = requests.post(
            f"{api}/payments/webhook",
            json={
                "type": "payment",
                "data": {"id": "888888888"},
                "action": "payment.created"
            },
            timeout=15
        )
        assert r.status_code == 200

    def test_webhook_no_auth_required(self, api):
        """Webhook no requiere JWT (es llamado por MP directamente)."""
        r = requests.post(
            f"{api}/payments/webhook?type=test&data.id=1",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        assert r.status_code == 200


# ─── F. Control de acceso ────────────────────────────────────────────────────

class TestAccessControl:
    """Verificar que solo responsables con pagos habilitados pueden pagar."""

    def test_admin_checkout_without_campus_id_fails(self, api, admin_headers):
        """Admin sin campus_id no puede crear checkout."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": 1},
                          headers=admin_headers, timeout=15)
        # Admin necesita pasar campus_id
        assert r.status_code in [400, 403, 404]

    def test_payment_amounts_correct(self, api, resp_headers):
        """Verificar que el monto total es correcto (units * unit_price)."""
        r = requests.post(f"{api}/payments/checkout",
                          json={"units": 5},
                          headers=resp_headers, timeout=20)
        assert r.status_code == 201
        pid = r.json()["payment_id"]

        r2 = requests.get(f"{api}/payments/my-payments?per_page=50",
                          headers=resp_headers, timeout=15)
        payments = r2.json()["payments"]
        payment = next((p for p in payments if p["id"] == pid), None)
        assert payment is not None
        assert payment["units"] == 5
        assert payment["unit_price"] == 200.0  # certification_cost del campus
        assert payment["total_amount"] == 1000.0  # 5 * 200
        assert payment["status"] == "pending"
        assert payment["credits_applied"] is False
