"""
Tests de integración — Módulo de Sesiones (VM Sessions)
=======================================================

Cubre:
  A. Check-access: admin, candidato, responsable
  B. Available-slots: disponibilidad global con límite de 4
  C. Create session: admin, candidato (candidate_self), bloqueo leader_only
  D. Get sessions: filtros por rol, grupo, fecha
  E. Cancel session: candidato propia, responsable de su plantel, admin
  F. Update session status (admin/coordinator)
  G. Responsable-groups: lista de grupos con calendario habilitado
  H. Group-candidates: lista candidatos activos de un grupo
  I. Auto-distribute: genera propuesta para grupo leader_only
  J. Bulk-create: crear sesiones desde propuesta aceptada
  K. Límite global de 4 sesiones simultáneas
  L. Validaciones de error y edge cases

Ejecutar:
    cd backend && python -m pytest tests/test_vm_sessions.py -v --tb=short
    cd backend && python -m pytest tests/test_vm_sessions.py -v -k "check_access"
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timedelta

# ─── Configuración ──────────────────────────────────────────────────
API = os.getenv(
    "API_BASE_URL",
    "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
)
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "Admin123!")
TIMEOUT = 20

# Fechas futuras deterministas para tests
TOMORROW = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
DAY_AFTER = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d")
NEXT_WEEK = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
FAR_FUTURE = (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d")
PAST_DATE = "2020-01-01"


def _uid():
    return uuid.uuid4().hex[:8]


# ─── Fixtures ───────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def admin_headers():
    """JWT de admin para toda la sesión de tests."""
    r = requests.post(
        f"{API}/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"Login admin falló: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _director_fields(uid_str):
    """Campos mínimos de director para crear campus."""
    return {
        "director_name": "Dir",
        "director_first_surname": "Test",
        "director_second_surname": "X",
        "director_email": f"dir_{uid_str}@test.com",
        "director_phone": "5551234567",
        "director_gender": "M",
        "director_date_of_birth": "1985-01-01",
        "director_curp": f"CURP{uid_str}000000",
    }


@pytest.fixture(scope="session")
def test_partner(admin_headers):
    """Crear un partner de prueba."""
    name = f"TestPartner_{_uid()}"
    r = requests.post(
        f"{API}/partners",
        json={"name": name},
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r.status_code == 201, f"Create partner failed: {r.text}"
    pid = r.json()["partner"]["id"]
    yield pid


@pytest.fixture(scope="session")
def test_campus(admin_headers, test_partner):
    """Crear un campus y habilitar calendario de sesiones (leader_only)."""
    uid = _uid()
    payload = {
        "name": f"Campus_{uid}",
        "country": "Estados Unidos",
        "state_name": "Texas",
        "city": "Test City",
        **_director_fields(uid),
    }
    r = requests.post(
        f"{API}/partners/{test_partner}/campuses",
        json=payload,
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r.status_code == 201, f"Create campus failed: {r.text}"
    data = r.json()
    campus = data["campus"]
    campus["_director_user"] = data.get("director_user")

    # Paso 1: Asignar al director como responsable del campus
    r_assign = requests.post(
        f"{API}/partners/campuses/{campus['id']}/assign-responsable",
        json={"responsable_id": campus["_director_user"]["id"]},
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r_assign.status_code == 200, f"Assign responsable failed: {r_assign.text}"

    # Paso 2: Configurar calendario de sesiones
    r2 = requests.post(
        f"{API}/partners/campuses/{campus['id']}/configure",
        json={
            "enable_session_calendar": True,
            "session_scheduling_mode": "leader_only",
        },
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r2.status_code == 200, f"Configure campus session_calendar failed: {r2.text}"
    yield campus


@pytest.fixture(scope="session")
def test_campus_candidate_self(admin_headers, test_partner):
    """Crear un campus con modo candidate_self."""
    uid = _uid()
    payload = {
        "name": f"CampusSelf_{uid}",
        "country": "Estados Unidos",
        "state_name": "California",
        "city": "Test City 2",
        **_director_fields(uid),
    }
    r = requests.post(
        f"{API}/partners/{test_partner}/campuses",
        json=payload,
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r.status_code == 201, f"Create campus candidate_self failed: {r.text}"
    data = r.json()
    campus = data["campus"]
    campus["_director_user"] = data.get("director_user")

    # Paso 1: Asignar director como responsable
    r_assign = requests.post(
        f"{API}/partners/campuses/{campus['id']}/assign-responsable",
        json={"responsable_id": campus["_director_user"]["id"]},
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r_assign.status_code == 200, f"Assign responsable self failed: {r_assign.text}"

    # Paso 2: Configurar en modo candidate_self
    r2 = requests.post(
        f"{API}/partners/campuses/{campus['id']}/configure",
        json={
            "enable_session_calendar": True,
            "session_scheduling_mode": "candidate_self",
        },
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r2.status_code == 200, f"Configure campus candidate_self failed: {r2.text}"
    yield campus


@pytest.fixture(scope="session")
def test_group_leader(admin_headers, test_campus):
    """Crear un grupo y configurarlo en modo leader_only."""
    name = f"GrupoLeader_{_uid()}"
    r = requests.post(
        f"{API}/partners/campuses/{test_campus['id']}/groups",
        json={"name": name},
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r.status_code == 201, f"Create group leader failed: {r.text}"
    group = r.json()["group"]

    # Configurar override de sesiones
    r2 = requests.put(
        f"{API}/partners/groups/{group['id']}/config",
        json={
            "enable_session_calendar_override": True,
            "session_scheduling_mode_override": "leader_only",
        },
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r2.status_code == 200, f"Update group leader config failed: {r2.text}"
    yield group


@pytest.fixture(scope="session")
def test_group_self(admin_headers, test_campus_candidate_self):
    """Crear un grupo y configurarlo en modo candidate_self."""
    name = f"GrupoSelf_{_uid()}"
    r = requests.post(
        f"{API}/partners/campuses/{test_campus_candidate_self['id']}/groups",
        json={"name": name},
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r.status_code == 201, f"Create group self failed: {r.text}"
    group = r.json()["group"]

    r2 = requests.put(
        f"{API}/partners/groups/{group['id']}/config",
        json={
            "enable_session_calendar_override": True,
            "session_scheduling_mode_override": "candidate_self",
        },
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r2.status_code == 200, f"Update group self config failed: {r2.text}"
    yield group


def _register_and_login(username, role="candidato"):
    """Helper para registrar un usuario y devolver su info + headers."""
    r = requests.post(
        f"{API}/auth/register",
        json={
            "username": username,
            "email": f"{username}@test.com",
            "password": "Test1234!",
            "name": "Test",
            "first_surname": "User",
            "second_surname": "X",
        },
        timeout=TIMEOUT,
    )
    assert r.status_code in (200, 201), f"Register {username} failed: {r.text}"
    user_id = r.json()["user"]["id"]

    r2 = requests.post(
        f"{API}/auth/login",
        json={"username": username, "password": "Test1234!"},
        timeout=TIMEOUT,
    )
    assert r2.status_code == 200
    token = r2.json()["access_token"]
    return {
        "id": user_id,
        "username": username,
        "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    }


@pytest.fixture(scope="session")
def responsable_user(admin_headers, test_campus):
    """Usar el director auto-creado del campus (ya es responsable)."""
    director = test_campus.get("_director_user")
    assert director, "El campus debe tener un director auto-creado"

    # Login con el director (responsable)
    r = requests.post(
        f"{API}/auth/login",
        json={"username": director["username"], "password": director["temporary_password"]},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"Login responsable failed: {r.text}"
    token = r.json()["access_token"]
    return {
        "id": director["id"],
        "username": director["username"],
        "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        "campus_id": test_campus["id"],
    }


@pytest.fixture(scope="session")
def candidate_leader_group(admin_headers, test_group_leader):
    """Crear un candidato y agregarlo al grupo leader_only."""
    uname = f"cand_ldr_{_uid()}"
    info = _register_and_login(uname)
    # Agregar al grupo
    r = requests.post(
        f"{API}/partners/groups/{test_group_leader['id']}/members",
        json={"user_id": info["id"]},
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r.status_code in (200, 201), f"Add member to leader group failed: {r.text}"
    info["group_id"] = test_group_leader["id"]
    return info


@pytest.fixture(scope="session")
def candidate_self_group(admin_headers, test_group_self):
    """Crear un candidato y agregarlo al grupo candidate_self."""
    uname = f"cand_self_{_uid()}"
    info = _register_and_login(uname)
    r = requests.post(
        f"{API}/partners/groups/{test_group_self['id']}/members",
        json={"user_id": info["id"]},
        headers=admin_headers,
        timeout=TIMEOUT,
    )
    assert r.status_code in (200, 201), f"Add member to self group failed: {r.text}"
    info["group_id"] = test_group_self["id"]
    return info


@pytest.fixture(scope="session")
def extra_candidates_leader(admin_headers, test_group_leader):
    """Crear 3 candidatos extra en el grupo leader_only (para auto-distribute)."""
    candidates = []
    for i in range(3):
        uname = f"cand_ex_{_uid()}"
        info = _register_and_login(uname)
        r = requests.post(
            f"{API}/partners/groups/{test_group_leader['id']}/members",
            json={"user_id": info["id"]},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 201), f"Add extra candidate {i} failed: {r.text}"
        info["group_id"] = test_group_leader["id"]
        candidates.append(info)
    return candidates


# ═══════════════════════════════════════════════════════════════
# A. CHECK ACCESS
# ═══════════════════════════════════════════════════════════════

class TestCheckAccess:
    """Tests del endpoint GET /vm-sessions/check-access"""

    def test_admin_has_access(self, admin_headers):
        r = requests.get(f"{API}/vm-sessions/check-access", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["has_access"] is True
        assert data["role"] == "admin"
        assert data["scope"] == "all"

    def test_responsable_has_access(self, responsable_user, test_campus):
        r = requests.get(
            f"{API}/vm-sessions/check-access",
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["has_access"] is True
        assert data["role"] == "responsable"
        assert data["scope"] == "campus"
        assert data["campus_id"] == test_campus["id"]

    def test_candidate_leader_only_access(self, candidate_leader_group):
        r = requests.get(
            f"{API}/vm-sessions/check-access",
            headers=candidate_leader_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["has_access"] is True
        assert data["role"] == "candidato"
        assert data["scheduling_mode"] == "leader_only"
        assert data["can_self_schedule"] is False

    def test_candidate_self_schedule_access(self, candidate_self_group):
        r = requests.get(
            f"{API}/vm-sessions/check-access",
            headers=candidate_self_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["has_access"] is True
        assert data["scheduling_mode"] == "candidate_self"
        assert data["can_self_schedule"] is True

    def test_no_token_returns_401(self):
        r = requests.get(f"{API}/vm-sessions/check-access", timeout=TIMEOUT)
        assert r.status_code in (401, 422)


# ═══════════════════════════════════════════════════════════════
# B. AVAILABLE SLOTS
# ═══════════════════════════════════════════════════════════════

class TestAvailableSlots:
    """Tests del endpoint GET /vm-sessions/available-slots"""

    def test_get_slots_for_date(self, admin_headers):
        r = requests.get(
            f"{API}/vm-sessions/available-slots",
            params={"date": TOMORROW},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["date"] == TOMORROW
        assert "slots" in data
        assert len(data["slots"]) == 12  # 8:00-19:00
        for slot in data["slots"]:
            assert "hour" in slot
            assert "global_count" in slot
            assert "max_sessions" in slot
            assert slot["max_sessions"] == 4
            assert "remaining" in slot

    def test_missing_date_returns_400(self, admin_headers):
        r = requests.get(
            f"{API}/vm-sessions/available-slots",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_invalid_date_format(self, admin_headers):
        r = requests.get(
            f"{API}/vm-sessions/available-slots",
            params={"date": "not-a-date"},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_slots_show_global_count(self, admin_headers):
        """Verificar que global_count refleja sesiones existentes."""
        r = requests.get(
            f"{API}/vm-sessions/available-slots",
            params={"date": TOMORROW},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        for slot in r.json()["slots"]:
            assert slot["global_count"] >= 0
            assert slot["remaining"] == max(0, 4 - slot["global_count"])

    def test_responsable_sees_session_details(self, responsable_user):
        """Responsable debe ver detalles de sesiones en los slots (cuando existen)."""
        r = requests.get(
            f"{API}/vm-sessions/available-slots",
            params={"date": TOMORROW},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        # Solo verificar estructura, las sesiones pueden o no existir
        assert "slots" in r.json()


# ═══════════════════════════════════════════════════════════════
# C. CREATE SESSION
# ═══════════════════════════════════════════════════════════════

class TestCreateSession:
    """Tests del endpoint POST /vm-sessions/sessions"""

    def test_candidate_self_can_create(self, candidate_self_group):
        """Candidato en modo candidate_self puede agendar."""
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={"session_date": TOMORROW, "start_hour": 10},
            headers=candidate_self_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 201, f"Create failed: {r.text}"
        session = r.json()["session"]
        assert session["session_date"] == TOMORROW
        assert session["start_hour"] == 10
        assert session["status"] == "scheduled"
        assert session["user_id"] == candidate_self_group["id"]
        # Guardar ID para cleanup
        candidate_self_group["session_id"] = session["id"]

    def test_candidate_leader_only_blocked(self, candidate_leader_group):
        """Candidato en modo leader_only NO puede agendar."""
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={"session_date": TOMORROW, "start_hour": 11},
            headers=candidate_leader_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 403
        assert "responsable" in r.json()["error"].lower() or "líder" in r.json()["error"].lower()

    def test_responsable_creates_for_candidate(self, responsable_user, candidate_leader_group, test_group_leader):
        """Responsable puede agendar para candidato de su plantel."""
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={
                "session_date": TOMORROW,
                "start_hour": 12,
                "user_id": candidate_leader_group["id"],
                "group_id": test_group_leader["id"],
            },
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 201, f"Responsable create failed: {r.text}"
        session = r.json()["session"]
        assert session["user_id"] == candidate_leader_group["id"]
        assert session["start_hour"] == 12
        candidate_leader_group["session_id"] = session["id"]

    def test_admin_creates_with_campus(self, admin_headers, test_campus):
        """Admin puede crear sesión para un usuario especificando campus_id."""
        # Registrar un usuario temporal para evitar conflictos
        uname = f"adm_crt_{_uid()}"
        r_reg = requests.post(
            f"{API}/auth/register",
            json={
                "username": uname,
                "email": f"{uname}@test.com",
                "password": "Test1234!",
                "name": "AdminCreate",
                "first_surname": "Test",
                "second_surname": "X",
            },
            timeout=TIMEOUT,
        )
        assert r_reg.status_code in (200, 201)
        uid = r_reg.json()["user"]["id"]

        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={
                "session_date": TOMORROW,
                "start_hour": 14,
                "campus_id": test_campus["id"],
                "user_id": uid,
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 201, f"Admin create failed: {r.text}"

    def test_past_date_rejected(self, admin_headers, test_campus):
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={
                "session_date": PAST_DATE,
                "start_hour": 10,
                "campus_id": test_campus["id"],
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400
        assert "pasado" in r.json()["error"].lower()

    def test_missing_fields_rejected(self, admin_headers):
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_invalid_hour_rejected(self, admin_headers, test_campus):
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={
                "session_date": TOMORROW,
                "start_hour": 25,
                "campus_id": test_campus["id"],
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_duplicate_user_slot_rejected(self, candidate_self_group):
        """No se puede agendar dos veces en el mismo slot."""
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={"session_date": TOMORROW, "start_hour": 10},
            headers=candidate_self_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 409

    def test_responsable_missing_user_id(self, responsable_user):
        """Responsable sin user_id devuelve error."""
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={"session_date": TOMORROW, "start_hour": 15},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_no_auth_returns_401(self):
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={"session_date": TOMORROW, "start_hour": 10},
            timeout=TIMEOUT,
        )
        assert r.status_code in (401, 422)


# ═══════════════════════════════════════════════════════════════
# D. GET SESSIONS
# ═══════════════════════════════════════════════════════════════

class TestGetSessions:
    """Tests del endpoint GET /vm-sessions/sessions"""

    def test_admin_gets_all(self, admin_headers):
        r = requests.get(
            f"{API}/vm-sessions/sessions",
            params={"date_from": TOMORROW, "date_to": TOMORROW},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data
        assert "total" in data
        assert data["total"] >= 0

    def test_candidate_sees_own_sessions(self, candidate_self_group):
        r = requests.get(
            f"{API}/vm-sessions/sessions",
            params={"date_from": TOMORROW, "date_to": TOMORROW, "status": "scheduled"},
            headers=candidate_self_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        # Debe ver solo sus propias sesiones
        for s in data["sessions"]:
            assert s["user_id"] == candidate_self_group["id"]

    def test_responsable_sees_campus_sessions(self, responsable_user, test_group_leader):
        r = requests.get(
            f"{API}/vm-sessions/sessions",
            params={
                "date_from": TOMORROW,
                "date_to": TOMORROW,
                "group_id": test_group_leader["id"],
            },
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        # Todas las sesiones deben ser del grupo
        for s in data["sessions"]:
            assert s["group_id"] == test_group_leader["id"]

    def test_responsable_includes_user_info(self, responsable_user):
        """Responsable debe ver nombre del candidato en las sesiones."""
        r = requests.get(
            f"{API}/vm-sessions/sessions",
            params={"date_from": TOMORROW, "date_to": TOMORROW},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        sessions = r.json()["sessions"]
        for s in sessions:
            # include_user=True para responsable
            if s.get("user_name"):
                assert isinstance(s["user_name"], str)

    def test_filter_by_status(self, admin_headers):
        r = requests.get(
            f"{API}/vm-sessions/sessions",
            params={"status": "cancelled"},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        for s in r.json()["sessions"]:
            assert s["status"] == "cancelled"


# ═══════════════════════════════════════════════════════════════
# E. CANCEL SESSION
# ═══════════════════════════════════════════════════════════════

class TestCancelSession:
    """Tests del endpoint DELETE /vm-sessions/sessions/<id>"""

    def test_candidate_cancels_own(self, candidate_self_group):
        """Candidato puede cancelar su propia sesión."""
        sid = candidate_self_group.get("session_id")
        if not sid:
            pytest.skip("No session to cancel")
        r = requests.delete(
            f"{API}/vm-sessions/sessions/{sid}",
            json={"reason": "Test cancel"},
            headers=candidate_self_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        assert r.json()["session"]["status"] == "cancelled"

    def test_responsable_cancels_campus_session(self, responsable_user, candidate_leader_group):
        """Responsable puede cancelar sesiones de su plantel."""
        sid = candidate_leader_group.get("session_id")
        if not sid:
            pytest.skip("No session to cancel")
        r = requests.delete(
            f"{API}/vm-sessions/sessions/{sid}",
            json={"reason": "Leader cancelled"},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        assert r.json()["session"]["status"] == "cancelled"

    def test_cancel_nonexistent_returns_404(self, admin_headers):
        r = requests.delete(
            f"{API}/vm-sessions/sessions/999999",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 404

    def test_cancel_already_cancelled(self, admin_headers, candidate_self_group):
        """No se puede cancelar una sesión ya cancelada."""
        sid = candidate_self_group.get("session_id")
        if not sid:
            pytest.skip("No session")
        r = requests.delete(
            f"{API}/vm-sessions/sessions/{sid}",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════
# F. UPDATE SESSION STATUS (admin/coordinator)
# ═══════════════════════════════════════════════════════════════

class TestUpdateSessionStatus:
    """Tests del endpoint PATCH /vm-sessions/sessions/<id>/status"""

    def _create_session_for_temp_user(self, admin_headers, test_campus, date, hour):
        """Helper: registrar usuario temporal y crear sesión como admin."""
        uname = f"status_{_uid()}"
        r_reg = requests.post(
            f"{API}/auth/register",
            json={
                "username": uname,
                "email": f"{uname}@test.com",
                "password": "Test1234!",
                "name": "Status",
                "first_surname": "Test",
                "second_surname": "X",
            },
            timeout=TIMEOUT,
        )
        assert r_reg.status_code in (200, 201)
        uid = r_reg.json()["user"]["id"]
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={"session_date": date, "start_hour": hour, "campus_id": test_campus["id"], "user_id": uid},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 201, f"Create session for status test failed: {r.text}"
        return r.json()["session"]["id"]

    def test_admin_marks_completed(self, admin_headers, test_campus):
        """Admin crea una sesión y la marca como completed."""
        sid = self._create_session_for_temp_user(admin_headers, test_campus, DAY_AFTER, 8)

        r2 = requests.patch(
            f"{API}/vm-sessions/sessions/{sid}/status",
            json={"status": "completed"},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r2.status_code == 200
        assert r2.json()["session"]["status"] == "completed"

    def test_admin_marks_no_show(self, admin_headers, test_campus):
        sid = self._create_session_for_temp_user(admin_headers, test_campus, DAY_AFTER, 9)

        r2 = requests.patch(
            f"{API}/vm-sessions/sessions/{sid}/status",
            json={"status": "no_show"},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r2.status_code == 200
        assert r2.json()["session"]["status"] == "no_show"

    def test_candidato_cannot_update_status(self, candidate_self_group):
        r = requests.patch(
            f"{API}/vm-sessions/sessions/1/status",
            json={"status": "completed"},
            headers=candidate_self_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 403

    def test_invalid_transition(self, admin_headers, test_campus):
        """No se puede cambiar de completed a scheduled."""
        sid = self._create_session_for_temp_user(admin_headers, test_campus, DAY_AFTER, 16)
        # Marcar completed
        requests.patch(
            f"{API}/vm-sessions/sessions/{sid}/status",
            json={"status": "completed"},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        # Intentar volver a scheduled (inválido)
        r2 = requests.patch(
            f"{API}/vm-sessions/sessions/{sid}/status",
            json={"status": "scheduled"},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r2.status_code == 400


# ═══════════════════════════════════════════════════════════════
# G. RESPONSABLE-GROUPS
# ═══════════════════════════════════════════════════════════════

class TestResponsableGroups:
    """Tests del endpoint GET /vm-sessions/responsable-groups"""

    def test_responsable_gets_groups(self, responsable_user, test_group_leader):
        r = requests.get(
            f"{API}/vm-sessions/responsable-groups",
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert "groups" in data
        assert "campus_name" in data
        group_ids = [g["id"] for g in data["groups"]]
        assert test_group_leader["id"] in group_ids
        # Cada grupo debe tener campos requeridos
        for g in data["groups"]:
            assert "scheduling_mode" in g
            assert "member_count" in g
            assert g["member_count"] >= 0

    def test_admin_cannot_use_endpoint(self, admin_headers):
        """Solo responsable puede usar este endpoint."""
        r = requests.get(
            f"{API}/vm-sessions/responsable-groups",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 403

    def test_candidate_cannot_use_endpoint(self, candidate_self_group):
        r = requests.get(
            f"{API}/vm-sessions/responsable-groups",
            headers=candidate_self_group["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 403


# ═══════════════════════════════════════════════════════════════
# H. GROUP CANDIDATES
# ═══════════════════════════════════════════════════════════════

class TestGroupCandidates:
    """Tests del endpoint GET /vm-sessions/group-candidates"""

    def test_responsable_gets_candidates(self, responsable_user, test_group_leader, candidate_leader_group):
        r = requests.get(
            f"{API}/vm-sessions/group-candidates",
            params={"group_id": test_group_leader["id"]},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert "candidates" in data
        user_ids = [c["user_id"] for c in data["candidates"]]
        assert candidate_leader_group["id"] in user_ids
        for c in data["candidates"]:
            assert "name" in c
            assert "email" in c
            assert "has_scheduled_session" in c

    def test_missing_group_id(self, responsable_user):
        r = requests.get(
            f"{API}/vm-sessions/group-candidates",
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_wrong_campus_group(self, responsable_user, test_group_self):
        """Responsable no puede ver candidatos de grupo de otro campus."""
        r = requests.get(
            f"{API}/vm-sessions/group-candidates",
            params={"group_id": test_group_self["id"]},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════
# I. AUTO-DISTRIBUTE
# ═══════════════════════════════════════════════════════════════

class TestAutoDistribute:
    """Tests del endpoint POST /vm-sessions/auto-distribute"""

    def test_generates_proposal(self, responsable_user, test_group_leader, extra_candidates_leader):
        r = requests.post(
            f"{API}/vm-sessions/auto-distribute",
            json={
                "group_id": test_group_leader["id"],
                "date_from": TOMORROW,
                "date_to": NEXT_WEEK,
            },
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert "proposal" in data
        assert "total_candidates" in data
        assert "total_assigned" in data

        for p in data["proposal"]:
            assert "user_id" in p
            assert "user_name" in p
            assert "session_date" in p
            assert "start_hour" in p
            assert "hour_label" in p

        # Guardar propuesta para bulk-create test
        responsable_user["_proposal"] = data["proposal"]
        responsable_user["_proposal_group"] = test_group_leader["id"]

    def test_missing_group_id(self, responsable_user):
        r = requests.post(
            f"{API}/vm-sessions/auto-distribute",
            json={},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_candidate_self_mode_rejected(self, responsable_user, test_group_self):
        """No se puede auto-distribuir en modo candidate_self."""
        # responsable está en otro campus, así que será 404
        r = requests.post(
            f"{API}/vm-sessions/auto-distribute",
            json={"group_id": test_group_self["id"]},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        # 404 porque el grupo está en otro campus, o 400 si es accessible pero wrong mode
        assert r.status_code in (400, 404)

    def test_admin_cannot_use_endpoint(self, admin_headers, test_group_leader):
        r = requests.post(
            f"{API}/vm-sessions/auto-distribute",
            json={"group_id": test_group_leader["id"]},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 403

    def test_past_date_rejected(self, responsable_user, test_group_leader):
        r = requests.post(
            f"{API}/vm-sessions/auto-distribute",
            json={
                "group_id": test_group_leader["id"],
                "date_from": PAST_DATE,
            },
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════
# J. BULK CREATE
# ═══════════════════════════════════════════════════════════════

class TestBulkCreate:
    """Tests del endpoint POST /vm-sessions/bulk-create"""

    def test_create_from_proposal(self, responsable_user):
        """Aceptar la propuesta y crear sesiones masivas."""
        proposal = responsable_user.get("_proposal")
        group_id = responsable_user.get("_proposal_group")
        if not proposal or not group_id:
            pytest.skip("No proposal available")

        valid = [p for p in proposal if p.get("session_date") and p.get("start_hour") is not None]
        if not valid:
            pytest.skip("No valid proposals to create")

        r = requests.post(
            f"{API}/vm-sessions/bulk-create",
            json={
                "group_id": group_id,
                "sessions": [
                    {"user_id": p["user_id"], "session_date": p["session_date"], "start_hour": p["start_hour"]}
                    for p in valid
                ],
            },
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 201, f"Bulk create failed: {r.text}"
        data = r.json()
        assert "created" in data
        assert len(data["created"]) > 0
        assert "errors" in data
        # Guardar para cleanup verificación
        responsable_user["_bulk_created_ids"] = [s["id"] for s in data["created"]]

    def test_duplicate_bulk_rejected(self, responsable_user):
        """Crear las mismas sesiones de nuevo debe dar errores."""
        proposal = responsable_user.get("_proposal")
        group_id = responsable_user.get("_proposal_group")
        if not proposal or not group_id:
            pytest.skip("No proposal")

        valid = [p for p in proposal if p.get("session_date") and p.get("start_hour") is not None]
        if not valid:
            pytest.skip("No valid proposals")

        r = requests.post(
            f"{API}/vm-sessions/bulk-create",
            json={
                "group_id": group_id,
                "sessions": [
                    {"user_id": p["user_id"], "session_date": p["session_date"], "start_hour": p["start_hour"]}
                    for p in valid
                ],
            },
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 201  # Endpoint devuelve 201 con errores individuales
        data = r.json()
        assert len(data["errors"]) > 0  # Los duplicados deben reportarse como errores

    def test_missing_sessions_body(self, responsable_user, test_group_leader):
        r = requests.post(
            f"{API}/vm-sessions/bulk-create",
            json={"group_id": test_group_leader["id"]},
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_admin_cannot_use_endpoint(self, admin_headers, test_group_leader):
        r = requests.post(
            f"{API}/vm-sessions/bulk-create",
            json={
                "group_id": test_group_leader["id"],
                "sessions": [{"user_id": "x", "session_date": TOMORROW, "start_hour": 8}],
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 403


# ═══════════════════════════════════════════════════════════════
# K. GLOBAL LIMIT (4 concurrent sessions)
# ═══════════════════════════════════════════════════════════════

class TestGlobalLimit:
    """Verificar que el límite global de 4 sesiones por slot funciona."""

    def test_enforce_4_session_limit(self, admin_headers, test_campus):
        """Crear 4 sesiones en el mismo slot, la 5ta debe fallar."""
        hour = 18  # Usar hora alta para evitar colisiones con otros tests
        date_str = FAR_FUTURE  # Fecha lejana para evitar colisiones con datos previos
        created_ids = []

        for i in range(4):
            # Registrar usuario temporal
            uname = f"limit_{_uid()}"
            r = requests.post(
                f"{API}/auth/register",
                json={
                    "username": uname,
                    "email": f"{uname}@test.com",
                    "password": "Test1234!",
                    "name": f"Limit{i}",
                    "first_surname": "Test",
                    "second_surname": "X",
                },
                timeout=TIMEOUT,
            )
            assert r.status_code in (200, 201)
            uid = r.json()["user"]["id"]

            r2 = requests.post(
                f"{API}/vm-sessions/sessions",
                json={
                    "session_date": date_str,
                    "start_hour": hour,
                    "campus_id": test_campus["id"],
                    "user_id": uid,
                },
                headers=admin_headers,
                timeout=TIMEOUT,
            )
            assert r2.status_code == 201, f"Session {i+1} failed: {r2.text}"
            created_ids.append(r2.json()["session"]["id"])

        # 5ta sesión: debe fallar con 409
        uname_5 = f"limit5_{_uid()}"
        r = requests.post(
            f"{API}/auth/register",
            json={
                "username": uname_5,
                "email": f"{uname_5}@test.com",
                "password": "Test1234!",
                "name": "Limit5",
                "first_surname": "Test",
                "second_surname": "X",
            },
            timeout=TIMEOUT,
        )
        uid_5 = r.json()["user"]["id"]

        r5 = requests.post(
            f"{API}/vm-sessions/sessions",
            json={
                "session_date": date_str,
                "start_hour": hour,
                "campus_id": test_campus["id"],
                "user_id": uid_5,
            },
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r5.status_code == 409
        assert "límite" in r5.json()["error"].lower() or "limit" in r5.json()["error"].lower()

        # Verificar que available-slots refleja el slot lleno
        rs = requests.get(
            f"{API}/vm-sessions/available-slots",
            params={"date": date_str},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert rs.status_code == 200
        slot_18 = next(s for s in rs.json()["slots"] if s["hour"] == hour)
        assert slot_18["global_count"] == 4
        assert slot_18["remaining"] == 0
        assert slot_18["available"] is False

        # Cleanup: cancelar las 4 sesiones
        for sid in created_ids:
            requests.delete(
                f"{API}/vm-sessions/sessions/{sid}",
                json={"reason": "test cleanup"},
                headers=admin_headers,
                timeout=TIMEOUT,
            )


# ═══════════════════════════════════════════════════════════════
# L. EDGE CASES
# ═══════════════════════════════════════════════════════════════

class TestEdgeCases:
    """Casos borde y validaciones."""

    def test_no_body_returns_400(self, admin_headers):
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_responsable_wrong_campus_candidate(self, responsable_user, candidate_self_group):
        """Responsable no puede crear sesión para candidato de otro campus."""
        r = requests.post(
            f"{API}/vm-sessions/sessions",
            json={
                "session_date": TOMORROW,
                "start_hour": 8,
                "user_id": candidate_self_group["id"],
            },
            headers=responsable_user["headers"],
            timeout=TIMEOUT,
        )
        assert r.status_code in (400, 403)

    def test_available_slots_custom_hours(self, admin_headers):
        """Verificar que operating_hours_start/end funcionan."""
        r = requests.get(
            f"{API}/vm-sessions/available-slots",
            params={"date": TOMORROW, "operating_hours_start": 10, "operating_hours_end": 14},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        slots = r.json()["slots"]
        assert len(slots) == 4  # 10, 11, 12, 13
        hours = [s["hour"] for s in slots]
        assert hours == [10, 11, 12, 13]

    def test_sessions_date_filter_range(self, admin_headers):
        """Verificar que date_from y date_to filtran correctamente."""
        r = requests.get(
            f"{API}/vm-sessions/sessions",
            params={"date_from": TOMORROW, "date_to": TOMORROW},
            headers=admin_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        for s in r.json()["sessions"]:
            assert s["session_date"] == TOMORROW
