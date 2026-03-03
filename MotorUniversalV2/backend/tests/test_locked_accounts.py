"""
Test de endpoints de cuentas bloqueadas (admin).
Cubre: GET /auth/admin/locked-accounts, POST /auth/admin/unlock-account, POST /auth/admin/unlock-all

Ejecutar:
    cd backend && python -m pytest tests/test_locked_accounts.py -v --tb=short

Env vars requeridos (o usa defaults DEV):
    API_BASE_URL, ADMIN_USER, ADMIN_PASS
"""
import os
import uuid
import pytest
import requests

API = os.getenv("API_BASE_URL",
    "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "Admin123!")
TIMEOUT = 20


def _unique(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:8]}"


# ────────────────────────── Fixtures ──────────────────────────

@pytest.fixture(scope="session")
def admin_headers():
    """Obtener token de admin para toda la sesión."""
    r = requests.post(f"{API}/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS},
                      timeout=TIMEOUT)
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def candidato_headers():
    """Crear y loguear un usuario candidato para probar restricciones de rol."""
    u = _unique("cand_lock_")
    # Registrar
    r = requests.post(f"{API}/auth/register", json={
        "username": u, "email": f"{u}@test.com", "password": "Test1234!",
        "name": "Candidato", "first_surname": "Lock", "second_surname": "Test"
    }, timeout=TIMEOUT)
    assert r.status_code in (200, 201), f"Register failed: {r.text}"
    # Login
    r2 = requests.post(f"{API}/auth/login",
                       json={"username": u, "password": "Test1234!"},
                       timeout=TIMEOUT)
    assert r2.status_code == 200
    token = r2.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ────────────────────────── Tests ──────────────────────────

class TestGetLockedAccounts:
    """Tests para GET /auth/admin/locked-accounts"""

    def test_admin_can_get_locked_accounts(self, admin_headers):
        """Admin puede ver cuentas bloqueadas."""
        r = requests.get(f"{API}/auth/admin/locked-accounts",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "locked_accounts" in data
        assert "failed_attempts" in data
        assert "config" in data
        # Verificar estructura de config
        config = data["config"]
        assert "max_attempts" in config
        assert "lockout_duration_seconds" in config
        assert "lockout_duration_minutes" in config
        assert config["max_attempts"] > 0
        assert config["lockout_duration_seconds"] > 0

    def test_locked_accounts_returns_lists(self, admin_headers):
        """Los campos locked_accounts y failed_attempts son listas."""
        r = requests.get(f"{API}/auth/admin/locked-accounts",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["locked_accounts"], list)
        assert isinstance(data["failed_attempts"], list)

    def test_candidato_cannot_get_locked_accounts(self, candidato_headers):
        """Candidato NO puede ver cuentas bloqueadas (rol no autorizado)."""
        r = requests.get(f"{API}/auth/admin/locked-accounts",
                         headers=candidato_headers, timeout=TIMEOUT)
        assert r.status_code == 403

    def test_unauthenticated_cannot_get_locked_accounts(self):
        """Sin token no se puede acceder."""
        r = requests.get(f"{API}/auth/admin/locked-accounts", timeout=TIMEOUT)
        assert r.status_code in (401, 422)


class TestUnlockAccount:
    """Tests para POST /auth/admin/unlock-account"""

    def test_admin_can_unlock_nonexistent(self, admin_headers):
        """Admin puede intentar desbloquear un usuario que no está bloqueado."""
        r = requests.post(f"{API}/auth/admin/unlock-account",
                          json={"username": "nonexistent_user_xyz@test.com"},
                          headers=admin_headers, timeout=TIMEOUT)
        # Unlock debería funcionar incluso si no hay nada que desbloquear
        assert r.status_code == 200

    def test_unlock_requires_username(self, admin_headers):
        """El campo username es requerido."""
        r = requests.post(f"{API}/auth/admin/unlock-account",
                          json={"username": ""},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_candidato_cannot_unlock(self, candidato_headers):
        """Candidato NO puede desbloquear cuentas."""
        r = requests.post(f"{API}/auth/admin/unlock-account",
                          json={"username": "test@test.com"},
                          headers=candidato_headers, timeout=TIMEOUT)
        assert r.status_code == 403

    def test_unauthenticated_cannot_unlock(self):
        """Sin token no se puede desbloquear."""
        r = requests.post(f"{API}/auth/admin/unlock-account",
                          json={"username": "test@test.com"},
                          timeout=TIMEOUT)
        assert r.status_code in (401, 422)


class TestUnlockAll:
    """Tests para POST /auth/admin/unlock-all"""

    def test_admin_can_unlock_all(self, admin_headers):
        """Admin puede ejecutar unlock-all."""
        r = requests.post(f"{API}/auth/admin/unlock-all",
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "unlocked_count" in data
        assert isinstance(data["unlocked_count"], int)

    def test_candidato_cannot_unlock_all(self, candidato_headers):
        """Candidato NO puede ejecutar unlock-all."""
        r = requests.post(f"{API}/auth/admin/unlock-all",
                          headers=candidato_headers, timeout=TIMEOUT)
        assert r.status_code == 403


class TestLockAndUnlockFlow:
    """Test e2e: generar bloqueo con intentos fallidos, verificar que aparece, desbloquear."""

    def test_lock_unlock_flow(self, admin_headers):
        """Flujo completo: crear usuario → fallar N intentos → verificar bloqueado → desbloquear."""
        u = _unique("locktest_")
        email = f"{u}@test.com"
        
        # 1. Registrar usuario
        r = requests.post(f"{API}/auth/register", json={
            "username": u, "email": email, "password": "Test1234!",
            "name": "Lock", "first_surname": "Test", "second_surname": "User"
        }, timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"Register failed: {r.text}"
        
        # 2. Hacer intentos fallidos de login (6 intentos para asegurar bloqueo)
        for i in range(6):
            r = requests.post(f"{API}/auth/login",
                              json={"username": u, "password": "WrongPassword!"},
                              timeout=TIMEOUT)
            # Después de MAX_FAILED_ATTEMPTS debería dar 429 (locked)
        
        # 3. Verificar que la última respuesta indica bloqueo
        assert r.status_code in (423, 429), f"Expected 423/429 (locked), got {r.status_code}: {r.text}"
        
        # 4. Verificar que aparece en la lista de bloqueados
        r = requests.get(f"{API}/auth/admin/locked-accounts",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        locked_usernames = [a["username"] for a in data["locked_accounts"]]
        assert u.lower() in [un.lower() for un in locked_usernames], \
            f"User {u} should be in locked accounts. Got: {locked_usernames}"
        
        # 5. Desbloquear
        r = requests.post(f"{API}/auth/admin/unlock-account",
                          json={"username": u},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        
        # 6. Verificar que ya no está bloqueado
        r = requests.get(f"{API}/auth/admin/locked-accounts",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        locked_usernames = [a["username"] for a in data["locked_accounts"]]
        assert u.lower() not in [un.lower() for un in locked_usernames], \
            f"User {u} should NOT be in locked accounts after unlock"
        
        # 7. Verificar que puede hacer login de nuevo
        r = requests.post(f"{API}/auth/login",
                          json={"username": u, "password": "Test1234!"},
                          timeout=TIMEOUT)
        assert r.status_code == 200, f"Login should work after unlock: {r.text}"
