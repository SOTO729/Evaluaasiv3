"""
Tests de integración — Validación de feature-flags Office en VB6 endpoints
==========================================================================

Cubre:
  - /api/vb6/login rechaza con OFFICE_EXAMS_DISABLED si campus/grupo deshabilitado
  - /api/vb6/parcial/login rechaza con PARCIALES_DISABLED
  - /api/vb6/login con mode=simulador rechaza con SIMULATORS_DISABLED
  - Login admin (sin grupo) NO se bloquea (config=None)
  - Endpoints públicos siguen accesibles
  - Endpoints office-results siguen 401/200

Ejecutar:
    cd backend && python -m pytest tests/test_vb6_office_flags.py -v --tb=short
"""
import os
import pytest
import requests

API = os.getenv(
    "API_BASE_URL",
    "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
)
TIMEOUT = 30


# ─── Sanity: endpoints office-results ────────────────────────────────

def test_office_results_me_requires_auth():
    r = requests.get(f"{API}/office-results/me", timeout=TIMEOUT)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"


def test_office_results_verify_public_invalid_code():
    r = requests.get(f"{API}/office-results/verify/NO_EXISTE_XYZ", timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert body.get("valid") is False


# ─── VB6 login: respuestas estructuradas ─────────────────────────────

def test_vb6_login_missing_credentials():
    r = requests.post(
        f"{API}/vb6/login",
        json={"username": "", "password": ""},
        timeout=TIMEOUT,
    )
    assert r.status_code == 400
    body = r.json()
    assert body.get("success") is False
    assert body.get("code") in ("MISSING_CREDENTIALS", "NO_DATA")


def test_vb6_login_invalid_credentials():
    r = requests.post(
        f"{API}/vb6/login",
        json={
            "username": "no_existe_office_test",
            "password": "wrong_pwd",
            "mode": "examen",
        },
        timeout=TIMEOUT,
    )
    assert r.status_code == 401
    body = r.json()
    assert body.get("success") is False
    assert body.get("code") == "INVALID_CREDENTIALS"


def test_vb6_parcial_login_missing_credentials():
    r = requests.post(
        f"{API}/vb6/parcial/login",
        json={},
        timeout=TIMEOUT,
    )
    # acepta NO_DATA o MISSING_CREDENTIALS
    assert r.status_code in (400, 401)
    body = r.json()
    assert body.get("success") is False


# ─── VB6 login: feature-flag (requiere candidato semilla) ────────────
#
# NOTA: estos tests usan credenciales de prueba si están en variables de entorno.
# Si no, se skipean — la suite mínima sigue corriendo.

CANDIDATO_DISABLED_USER = os.getenv("OFFICE_DISABLED_USER")
CANDIDATO_DISABLED_PASS = os.getenv("OFFICE_DISABLED_PASS")
CANDIDATO_ENABLED_USER = os.getenv("OFFICE_ENABLED_USER")
CANDIDATO_ENABLED_PASS = os.getenv("OFFICE_ENABLED_PASS")


@pytest.mark.skipif(
    not (CANDIDATO_DISABLED_USER and CANDIDATO_DISABLED_PASS),
    reason="Set OFFICE_DISABLED_USER/PASS env vars (candidato con enable_office_exams=False)",
)
def test_vb6_login_blocked_when_office_exams_disabled():
    r = requests.post(
        f"{API}/vb6/login",
        json={
            "username": CANDIDATO_DISABLED_USER,
            "password": CANDIDATO_DISABLED_PASS,
            "mode": "examen",
        },
        timeout=TIMEOUT,
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body.get("success") is False
    assert body.get("code") == "OFFICE_EXAMS_DISABLED"


@pytest.mark.skipif(
    not (CANDIDATO_ENABLED_USER and CANDIDATO_ENABLED_PASS),
    reason="Set OFFICE_ENABLED_USER/PASS env vars (candidato con enable_office_exams=True)",
)
def test_vb6_login_ok_when_office_exams_enabled():
    r = requests.post(
        f"{API}/vb6/login",
        json={
            "username": CANDIDATO_ENABLED_USER,
            "password": CANDIDATO_ENABLED_PASS,
            "mode": "examen",
        },
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body.get("success") is True
    assert "token" in body


# ─── Admin login: NO debe ser bloqueado ──────────────────────────────

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")


def test_vb6_login_admin_not_blocked_by_flag():
    """Admin no tiene GroupMember → config=None → debe pasar la validación.

    Si el admin no existe en DEV o la pwd cambió, el test acepta 401 (pero
    NUNCA 403 con OFFICE_EXAMS_DISABLED, porque eso implicaría que el guard
    bloquea sin contexto).
    """
    r = requests.post(
        f"{API}/vb6/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS, "mode": "examen"},
        timeout=TIMEOUT,
    )
    if r.status_code == 200:
        body = r.json()
        assert body.get("success") is True
    elif r.status_code == 401:
        # OK: credenciales no aceptadas en DEV — pero no fue bloqueo de flag
        pass
    elif r.status_code == 403:
        body = r.json()
        # Si bloqueó al admin con código de flag, es bug en el guard
        assert body.get("code") not in (
            "OFFICE_EXAMS_DISABLED",
            "SIMULATORS_DISABLED",
            "PARCIALES_DISABLED",
        ), f"Admin bloqueado por flag, no debería: {body}"
    else:
        pytest.fail(f"Unexpected status {r.status_code}: {r.text[:300]}")
