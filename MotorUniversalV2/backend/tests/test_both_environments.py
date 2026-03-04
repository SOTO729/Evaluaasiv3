"""
Test comprehensivo de TODOS los módulos — DEV y PROD simultáneo.

Cubre:
  - Health, Auth, Users, Partners (+ Campus, Group, Members, States)
  - Standards, Exams (+ Categories, Topics, Questions, Exercises, Steps, Actions)
  - Study Contents (+ Sessions, Topics, Reading, Video, Downloadable, Interactive)
  - Badges, Balance, Conocer, Activity, VM Sessions, Verify
  - User Management (listado, stats, roles, campuses, partners, bulk-history)
  - Frontends (SPA, assets)

Ejecutar:
    cd backend && python -m pytest tests/test_both_environments.py -v --tb=short
    cd backend && python -m pytest tests/test_both_environments.py -v --tb=short -k "DEV"
    cd backend && python -m pytest tests/test_both_environments.py -v --tb=short -k "PROD"
"""

import os
import uuid
import pytest
import requests

# ─────────────── Entornos ───────────────
ENVS = {
    "DEV": {
        "api": "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
        "frontend": "https://dev.evaluaasi.com",
        "admin_user": "admin",
        "admin_pass": "Admin123!",
    },
    "PROD": {
        "api": "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
        "frontend": "https://app.evaluaasi.com",
        "admin_user": "admin",
        "admin_pass": "Admin123!",
    },
}

TIMEOUT = 25


# ─────────────── Helpers ───────────────
def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def _api(env_name):
    return ENVS[env_name]["api"]


def _login(env_name):
    """Login admin y devolver headers."""
    env = ENVS[env_name]
    r = requests.post(f"{env['api']}/auth/login",
                      json={"username": env["admin_user"], "password": env["admin_pass"]},
                      timeout=TIMEOUT)
    assert r.status_code == 200, f"[{env_name}] Login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}",
            "Content-Type": "application/json"}


# ─────────────── Fixtures paramétricos ───────────────
@pytest.fixture(params=["DEV", "PROD"], scope="session")
def env_name(request):
    return request.param


@pytest.fixture(scope="session")
def admin_headers_per_env():
    """Cache de headers de admin por entorno."""
    cache = {}
    for name in ENVS:
        try:
            cache[name] = _login(name)
        except Exception as e:
            cache[name] = None
            print(f"⚠️  No se pudo autenticar en {name}: {e}")
    return cache


@pytest.fixture()
def api(env_name):
    return _api(env_name)


@pytest.fixture()
def headers(env_name, admin_headers_per_env):
    h = admin_headers_per_env.get(env_name)
    if h is None:
        pytest.skip(f"No hay autenticación disponible para {env_name}")
    return h


@pytest.fixture()
def frontend_url(env_name):
    return ENVS[env_name]["frontend"]


# ─────────────── Fixtures de datos reutilizables ───────────────
_session_data = {}  # env_name → { test_user, partner_id, campus_id, group_id, standard_id, exam }


def _ensure_session_data(env_name, headers):
    """Crear datos de prueba una sola vez por entorno."""
    if env_name in _session_data:
        return _session_data[env_name]

    api = _api(env_name)
    data = {}

    # ── Test User ──
    u = _uid("tst_")
    r = requests.post(f"{api}/auth/register", json={
        "username": u, "email": f"{u}@test.com", "password": "Test1234!",
        "name": "TestBoth", "first_surname": "User", "second_surname": "X"
    }, timeout=TIMEOUT)
    if r.status_code in (200, 201):
        data["test_user_id"] = r.json()["user"]["id"]
        r2 = requests.post(f"{api}/auth/login",
                           json={"username": u, "password": "Test1234!"},
                           timeout=TIMEOUT)
        data["test_user_headers"] = {
            "Authorization": f"Bearer {r2.json()['access_token']}",
            "Content-Type": "application/json"
        } if r2.status_code == 200 else None
    else:
        data["test_user_id"] = None
        data["test_user_headers"] = None

    # ── Partner ──
    uid = _uid("PT")
    r = requests.post(f"{api}/partners", json={
        "name": uid, "business_name": uid, "rfc": uid[:13], "brand_id": 1
    }, headers=headers, timeout=TIMEOUT)
    data["partner_id"] = r.json()["partner"]["id"] if r.status_code == 201 else None

    # ── Campus ──
    if data["partner_id"]:
        curp = f"PELJ{uid.upper()[:6]}01HJCR09"[:18].ljust(18, 'X')
        r = requests.post(f"{api}/partners/{data['partner_id']}/campuses", json={
            "name": f"Camp{uid}", "state_name": "Jalisco", "city": "GDL",
            "director_name": "J", "director_first_surname": "P",
            "director_second_surname": "L", "director_email": f"d{uid}@t.com",
            "director_phone": "3312345678", "director_gender": "M",
            "director_curp": curp, "director_date_of_birth": "1990-01-01"
        }, headers=headers, timeout=TIMEOUT)
        data["campus_id"] = r.json()["campus"]["id"] if r.status_code == 201 else None
    else:
        data["campus_id"] = None

    # ── Group ──
    if data["campus_id"]:
        r = requests.post(f"{api}/partners/campuses/{data['campus_id']}/groups",
                          json={"name": _uid("G")},
                          headers=headers, timeout=TIMEOUT)
        data["group_id"] = r.json()["group"]["id"] if r.status_code == 201 else None
    else:
        data["group_id"] = None

    # ── Standard ──
    code = _uid("STD")
    r = requests.post(f"{api}/competency-standards/",
                      json={"code": code, "name": f"Std {code}", "brand_id": 1},
                      headers=headers, timeout=TIMEOUT)
    data["standard_id"] = r.json()["standard"]["id"] if r.status_code == 201 else None

    # ── Exam ──
    if data["standard_id"]:
        r = requests.post(f"{api}/exams", json={
            "name": _uid("Exam"), "stage_id": 1,
            "competency_standard_id": data["standard_id"],
            "categories": [{"name": "Main", "percentage": 100}]
        }, headers=headers, timeout=TIMEOUT)
        data["exam"] = r.json()["exam"] if r.status_code == 201 else None
    else:
        data["exam"] = None

    _session_data[env_name] = data
    return data


@pytest.fixture()
def session_data(env_name, headers):
    return _ensure_session_data(env_name, headers)


# ════════════════════════════════════════════════════════════
#  1. HEALTH
# ════════════════════════════════════════════════════════════
class TestHealth:
    def test_health_endpoint(self, api):
        r = requests.get(f"{api}/health", timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "healthy"
        assert body["database"] == "healthy"

    def test_api_version(self, api):
        r = requests.get(f"{api}/health", timeout=TIMEOUT)
        assert "version" in r.json()


# ════════════════════════════════════════════════════════════
#  2. FRONTEND SPA
# ════════════════════════════════════════════════════════════
class TestFrontend:
    def test_spa_loads(self, frontend_url):
        r = requests.get(frontend_url, timeout=TIMEOUT, allow_redirects=True)
        assert r.status_code == 200
        assert "<!DOCTYPE html>" in r.text or "<!doctype html>" in r.text.lower()

    def test_spa_has_js_bundle(self, frontend_url):
        r = requests.get(frontend_url, timeout=TIMEOUT)
        assert "assets/index-" in r.text, "No se encontró bundle JS en el HTML"

    def test_spa_fallback_route(self, frontend_url):
        """SPA devuelve index.html para rutas de React."""
        r = requests.get(f"{frontend_url}/user-management",
                         timeout=TIMEOUT, allow_redirects=True)
        assert r.status_code == 200
        assert "assets/index-" in r.text


# ════════════════════════════════════════════════════════════
#  3. AUTH
# ════════════════════════════════════════════════════════════
class TestAuth:
    def test_login_admin(self, api, headers):
        r = requests.get(f"{api}/auth/me", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["username"] == "admin"

    def test_login_bad_credentials(self, api):
        r = requests.post(f"{api}/auth/login",
                          json={"username": "noexiste", "password": "bad"},
                          timeout=TIMEOUT)
        assert r.status_code == 401

    def test_register_and_login(self, api, session_data):
        assert session_data["test_user_id"] is not None

    def test_me_with_token(self, api, session_data):
        h = session_data.get("test_user_headers")
        if not h:
            pytest.skip("No test user token")
        r = requests.get(f"{api}/auth/me", headers=h, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["id"] == session_data["test_user_id"]

    def test_register_duplicate(self, api):
        r = requests.post(f"{api}/auth/register", json={
            "username": "admin", "email": "dup@test.com", "password": "P1!",
            "name": "D", "first_surname": "U", "second_surname": "P"
        }, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_missing_fields(self, api):
        r = requests.post(f"{api}/auth/login", json={}, timeout=TIMEOUT)
        assert r.status_code in (400, 401, 422)


# ════════════════════════════════════════════════════════════
#  4. USERS
# ════════════════════════════════════════════════════════════
class TestUsers:
    def test_list_users(self, api, headers):
        r = requests.get(f"{api}/users", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert "users" in r.json()

    def test_get_user_by_id(self, api, headers, session_data):
        uid = session_data.get("test_user_id")
        if not uid:
            pytest.skip("No test user")
        r = requests.get(f"{api}/users/{uid}", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_update_user(self, api, headers, session_data):
        uid = session_data.get("test_user_id")
        if not uid:
            pytest.skip("No test user")
        r = requests.put(f"{api}/users/{uid}",
                         json={"name": "BothTest"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_nonexistent_user(self, api, headers):
        r = requests.get(f"{api}/users/nonexistent-uuid-here",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_unauthorized_access(self, api):
        r = requests.get(f"{api}/users", timeout=TIMEOUT)
        assert r.status_code == 401


# ════════════════════════════════════════════════════════════
#  5. PARTNERS
# ════════════════════════════════════════════════════════════
class TestPartners:
    def test_list_partners(self, api, headers):
        r = requests.get(f"{api}/partners", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_crud_partner(self, api, headers):
        uid = _uid("PP")
        # Create
        r = requests.post(f"{api}/partners", json={
            "name": uid, "business_name": uid, "rfc": uid[:13], "brand_id": 1
        }, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create: {r.text}"
        pid = r.json()["partner"]["id"]
        # Read
        r = requests.get(f"{api}/partners/{pid}", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Update
        r = requests.put(f"{api}/partners/{pid}",
                         json={"name": f"{uid}_upd"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Delete
        r = requests.delete(f"{api}/partners/{pid}",
                            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_add_and_remove_state(self, api, headers):
        uid = _uid("PS")
        r = requests.post(f"{api}/partners", json={
            "name": uid, "business_name": uid, "rfc": uid[:13], "brand_id": 1
        }, headers=headers, timeout=TIMEOUT)
        pid = r.json()["partner"]["id"]
        # Add state
        r = requests.post(f"{api}/partners/{pid}/states",
                          json={"state_name": "Aguascalientes"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"Add state: {r.text}"
        pres_id = r.json()["presence"]["id"]
        # Remove state
        r = requests.delete(f"{api}/partners/{pid}/states/{pres_id}",
                            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Cleanup
        requests.delete(f"{api}/partners/{pid}", headers=headers, timeout=TIMEOUT)


# ════════════════════════════════════════════════════════════
#  6. CAMPUS
# ════════════════════════════════════════════════════════════
class TestCampus:
    def test_create_get_update_delete(self, api, headers, session_data):
        pid = session_data.get("partner_id")
        if not pid:
            pytest.skip("No partner")
        uid = _uid("CC")
        curp = f"CCJL{uid.upper()[:6]}01HJCR09"[:18].ljust(18, 'X')
        # Create
        r = requests.post(f"{api}/partners/{pid}/campuses", json={
            "name": f"Camp{uid}", "state_name": "Sonora", "city": "HMO",
            "director_name": "A", "director_first_surname": "B",
            "director_second_surname": "C", "director_email": f"cc{uid}@t.com",
            "director_phone": "6621234567", "director_gender": "F",
            "director_curp": curp, "director_date_of_birth": "1985-06-15"
        }, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create campus: {r.text}"
        cid = r.json()["campus"]["id"]
        # Get
        r = requests.get(f"{api}/partners/campuses/{cid}",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Update
        r = requests.put(f"{api}/partners/campuses/{cid}",
                         json={"name": "Updated"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Delete
        r = requests.delete(f"{api}/partners/campuses/{cid}",
                            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════════════════════════
#  7. GROUPS
# ════════════════════════════════════════════════════════════
class TestGroups:
    def test_create_update_delete(self, api, headers, session_data):
        cid = session_data.get("campus_id")
        if not cid:
            pytest.skip("No campus")
        r = requests.post(f"{api}/partners/campuses/{cid}/groups",
                          json={"name": _uid("GG")},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create group: {r.text}"
        gid = r.json()["group"]["id"]
        # Update
        r = requests.put(f"{api}/partners/groups/{gid}",
                         json={"name": "GUpd"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Delete
        r = requests.delete(f"{api}/partners/groups/{gid}",
                            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_add_remove_member(self, api, headers, session_data):
        cid = session_data.get("campus_id")
        uid = session_data.get("test_user_id")
        if not cid or not uid:
            pytest.skip("No campus or user")
        r = requests.post(f"{api}/partners/campuses/{cid}/groups",
                          json={"name": _uid("GM")},
                          headers=headers, timeout=TIMEOUT)
        gid = r.json()["group"]["id"]
        # Add member
        r = requests.post(f"{api}/partners/groups/{gid}/members",
                          json={"user_id": uid},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"Add member: {r.text}"
        mid = r.json()["member"]["id"]
        # Remove
        r = requests.delete(f"{api}/partners/groups/{gid}/members/{mid}",
                            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        requests.delete(f"{api}/partners/groups/{gid}", headers=headers, timeout=TIMEOUT)


# ════════════════════════════════════════════════════════════
#  8. COMPETENCY STANDARDS
# ════════════════════════════════════════════════════════════
class TestStandards:
    def test_list_standards(self, api, headers):
        r = requests.get(f"{api}/competency-standards/",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_crud_standard(self, api, headers):
        code = _uid("CS")
        # Create
        r = requests.post(f"{api}/competency-standards/",
                          json={"code": code, "name": f"Std {code}", "brand_id": 1},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201
        sid = r.json()["standard"]["id"]
        # Read
        r = requests.get(f"{api}/competency-standards/{sid}",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Update
        r = requests.put(f"{api}/competency-standards/{sid}",
                         json={"name": "Updated"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Delete
        r = requests.delete(f"{api}/competency-standards/{sid}",
                            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_list_brands(self, api, headers):
        r = requests.get(f"{api}/competency-standards/brands",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════════════════════════
#  9. EXAMS
# ════════════════════════════════════════════════════════════
class TestExams:
    def test_list_exams(self, api, headers):
        r = requests.get(f"{api}/exams", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_create_and_delete(self, api, headers, session_data):
        sid = session_data.get("standard_id")
        if not sid:
            pytest.skip("No standard")
        r = requests.post(f"{api}/exams", json={
            "name": _uid("EX"), "stage_id": 1,
            "competency_standard_id": sid,
            "categories": [{"name": "A", "percentage": 60}, {"name": "B", "percentage": 40}]
        }, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201
        eid = r.json()["exam"]["id"]
        r = requests.delete(f"{api}/exams/{eid}", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_get_exam(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.get(f"{api}/exams/{e['id']}", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_update_exam(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.put(f"{api}/exams/{e['id']}",
                         json={"name": "Updated", "passing_score": 80},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_question_types(self, api, headers):
        r = requests.get(f"{api}/exams/question-types",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()["question_types"]) > 0

    def test_validate_exam(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.get(f"{api}/exams/{e['id']}/validate",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_clone_exam(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.post(f"{api}/exams/{e['id']}/clone",
                          json={"name": _uid("Clon")},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201
        cid = r.json()["exam"]["id"]
        requests.delete(f"{api}/exams/{cid}", headers=headers, timeout=TIMEOUT)


# ════════════════════════════════════════════════════════════
#  10. EXAM TOPICS / QUESTIONS / EXERCISES / STEPS / ACTIONS
# ════════════════════════════════════════════════════════════
class TestExamChain:
    def test_full_chain(self, api, headers, session_data):
        """Topic → Question → Exercise → Step → Action."""
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        cats = e.get("categories", [])
        assert len(cats) > 0, "Exam sin categorías"
        cat_id = cats[0]["id"]

        # Topic
        r = requests.post(f"{api}/exams/categories/{cat_id}/topics",
                          json={"name": _uid("Top")},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Topic: {r.text}"
        tid = r.json()["topic"]["id"]

        # Question
        qt = requests.get(f"{api}/exams/question-types",
                          headers=headers, timeout=TIMEOUT).json()["question_types"][0]["id"]
        r = requests.post(f"{api}/exams/topics/{tid}/questions", json={
            "question_type_id": qt, "question_text": "Q?",
            "answers": [
                {"answer_number": 1, "answer_text": "Sí", "is_correct": True},
                {"answer_number": 2, "answer_text": "No", "is_correct": False}
            ]
        }, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Question: {r.text}"

        # Exercise
        r = requests.post(f"{api}/exams/topics/{tid}/exercises",
                          json={"exercise_text": "Exercise"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Exercise: {r.text}"
        exid = r.json()["exercise"]["id"]

        # Step
        r = requests.post(f"{api}/exams/exercises/{exid}/steps",
                          json={"title": "Step 1", "description": "Do it"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Step: {r.text}"
        stid = r.json()["step"]["id"]

        # Action
        r = requests.post(f"{api}/exams/steps/{stid}/actions",
                          json={"action_type": "button", "label": "Click",
                                "position_x": 10, "position_y": 20},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Action: {r.text}"


# ════════════════════════════════════════════════════════════
#  11. STUDY CONTENTS
# ════════════════════════════════════════════════════════════
class TestStudyContents:
    def test_list_materials(self, api, headers):
        r = requests.get(f"{api}/study-contents", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_crud_material(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        # Create
        r = requests.post(f"{api}/study-contents",
                          json={"title": _uid("Mat"), "exam_id": e["id"]},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create material: {r.text}"
        mid = r.json()["material"]["id"]
        # Update
        r = requests.put(f"{api}/study-contents/{mid}",
                         json={"title": "Upd"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Delete
        r = requests.delete(f"{api}/study-contents/{mid}",
                            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_clone_material(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.post(f"{api}/study-contents",
                          json={"title": _uid("CM"), "exam_id": e["id"]},
                          headers=headers, timeout=TIMEOUT)
        mid = r.json()["material"]["id"]
        r = requests.post(f"{api}/study-contents/{mid}/clone",
                          json={"title": _uid("Clon")},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201
        cmid = r.json()["material"]["id"]
        requests.delete(f"{api}/study-contents/{cmid}", headers=headers, timeout=TIMEOUT)
        requests.delete(f"{api}/study-contents/{mid}", headers=headers, timeout=TIMEOUT)


class TestStudyContentChain:
    def test_session_topic_reading(self, api, headers, session_data):
        """Session → Topic → Reading content."""
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.post(f"{api}/study-contents",
                          json={"title": _uid("SR"), "exam_id": e["id"]},
                          headers=headers, timeout=TIMEOUT)
        mid = r.json()["material"]["id"]

        # Session
        r = requests.post(f"{api}/study-contents/{mid}/sessions",
                          json={"title": "Sess1"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201
        ssid = r.json()["session"]["id"]

        # Topic
        r = requests.post(
            f"{api}/study-contents/{mid}/sessions/{ssid}/topics",
            json={"title": "Top1", "estimated_time_minutes": 10},
            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201
        stid = r.json()["topic"]["id"]

        base = f"{api}/study-contents/{mid}/sessions/{ssid}/topics/{stid}"

        # Reading
        r = requests.post(f"{base}/reading",
                          json={"title": "Lec", "content": "<p>C</p>"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Reading: {r.text}"

        # Update reading
        r = requests.put(f"{base}/reading",
                         json={"title": "Lec2", "content": "<p>U</p>"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Cleanup
        requests.delete(f"{api}/study-contents/{mid}", headers=headers, timeout=TIMEOUT)

    def test_video(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.post(f"{api}/study-contents",
                          json={"title": _uid("SV"), "exam_id": e["id"]},
                          headers=headers, timeout=TIMEOUT)
        mid = r.json()["material"]["id"]
        r = requests.post(f"{api}/study-contents/{mid}/sessions",
                          json={"title": "SV"},
                          headers=headers, timeout=TIMEOUT)
        ssid = r.json()["session"]["id"]
        r = requests.post(
            f"{api}/study-contents/{mid}/sessions/{ssid}/topics",
            json={"title": "TV", "estimated_time_minutes": 5},
            headers=headers, timeout=TIMEOUT)
        stid = r.json()["topic"]["id"]

        r = requests.post(
            f"{api}/study-contents/{mid}/sessions/{ssid}/topics/{stid}/video",
            json={"title": "Vid", "video_url": "https://youtube.com/watch?v=t",
                  "video_type": "youtube"},
            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Video: {r.text}"
        requests.delete(f"{api}/study-contents/{mid}", headers=headers, timeout=TIMEOUT)

    def test_downloadable(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.post(f"{api}/study-contents",
                          json={"title": _uid("SD"), "exam_id": e["id"]},
                          headers=headers, timeout=TIMEOUT)
        mid = r.json()["material"]["id"]
        r = requests.post(f"{api}/study-contents/{mid}/sessions",
                          json={"title": "SD"},
                          headers=headers, timeout=TIMEOUT)
        ssid = r.json()["session"]["id"]
        r = requests.post(
            f"{api}/study-contents/{mid}/sessions/{ssid}/topics",
            json={"title": "TD", "estimated_time_minutes": 5},
            headers=headers, timeout=TIMEOUT)
        stid = r.json()["topic"]["id"]

        r = requests.post(
            f"{api}/study-contents/{mid}/sessions/{ssid}/topics/{stid}/downloadable",
            json={"title": "DL", "file_url": "https://example.com/f.pdf"},
            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Downloadable: {r.text}"
        requests.delete(f"{api}/study-contents/{mid}", headers=headers, timeout=TIMEOUT)

    def test_interactive_exercise(self, api, headers, session_data):
        e = session_data.get("exam")
        if not e:
            pytest.skip("No exam")
        r = requests.post(f"{api}/study-contents",
                          json={"title": _uid("SI"), "exam_id": e["id"]},
                          headers=headers, timeout=TIMEOUT)
        mid = r.json()["material"]["id"]
        r = requests.post(f"{api}/study-contents/{mid}/sessions",
                          json={"title": "SI"},
                          headers=headers, timeout=TIMEOUT)
        ssid = r.json()["session"]["id"]
        r = requests.post(
            f"{api}/study-contents/{mid}/sessions/{ssid}/topics",
            json={"title": "TI", "estimated_time_minutes": 15},
            headers=headers, timeout=TIMEOUT)
        stid = r.json()["topic"]["id"]
        base = f"{api}/study-contents/{mid}/sessions/{ssid}/topics/{stid}"

        # Interactive
        r = requests.post(f"{base}/interactive",
                          json={"title": "IA"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Interactive: {r.text}"

        # Step
        r = requests.post(f"{base}/interactive/steps",
                          json={"title": "S1"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Step: {r.text}"
        isid = r.json()["step"]["id"]

        # Action
        r = requests.post(f"{base}/interactive/steps/{isid}/actions",
                          json={"action_type": "button", "label": "Click"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Action: {r.text}"
        requests.delete(f"{api}/study-contents/{mid}", headers=headers, timeout=TIMEOUT)


# ════════════════════════════════════════════════════════════
#  12. BADGES
# ════════════════════════════════════════════════════════════
class TestBadges:
    def test_list_templates(self, api, headers):
        r = requests.get(f"{api}/badges/templates", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_crud_template(self, api, headers, session_data):
        sid = session_data.get("standard_id")
        e = session_data.get("exam")
        if not sid or not e:
            pytest.skip("No standard or exam")
        # Create
        r = requests.post(f"{api}/badges/templates", json={
            "name": _uid("BDG"), "description": "Test",
            "competency_standard_id": sid, "exam_id": e["id"]
        }, headers=headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create badge: {r.text}"
        btid = r.json()["template"]["id"]
        # Update
        r = requests.put(f"{api}/badges/templates/{btid}",
                         json={"description": "Upd"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        # Delete
        r = requests.delete(f"{api}/badges/templates/{btid}",
                            headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_my_badges(self, api, session_data):
        h = session_data.get("test_user_headers")
        if not h:
            pytest.skip("No test user")
        r = requests.get(f"{api}/badges/my-badges", headers=h, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════════════════════════
#  13. BALANCE
# ════════════════════════════════════════════════════════════
class TestBalance:
    def test_my_balance(self, api, headers):
        r = requests.get(f"{api}/balance/my-balance", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_my_requests(self, api, headers):
        r = requests.get(f"{api}/balance/my-requests", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_my_transactions(self, api, headers):
        r = requests.get(f"{api}/balance/my-transactions", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════════════════════════
#  14. CONOCER
# ════════════════════════════════════════════════════════════
class TestConocer:
    def test_my_certificates(self, api, headers):
        r = requests.get(f"{api}/conocer/certificates", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_admin_upload_batches(self, api, headers):
        r = requests.get(f"{api}/conocer/admin/upload-batches",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_verify_nonexistent(self, api, headers):
        r = requests.get(f"{api}/conocer/verify/NONEXISTENT123",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code in (200, 404)


# ════════════════════════════════════════════════════════════
#  15. ACTIVITY
# ════════════════════════════════════════════════════════════
class TestActivity:
    def test_logs(self, api, headers):
        r = requests.get(f"{api}/activity/logs", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_summary(self, api, headers):
        r = requests.get(f"{api}/activity/summary", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════════════════════════
#  16. VM SESSIONS
# ════════════════════════════════════════════════════════════
class TestVMSessions:
    def test_list_sessions(self, api, headers):
        r = requests.get(f"{api}/vm-sessions/sessions", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_check_access(self, api, headers):
        r = requests.get(f"{api}/vm-sessions/check-access", headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_available_slots(self, api, headers):
        r = requests.get(f"{api}/vm-sessions/available-slots", headers=headers, timeout=TIMEOUT)
        assert r.status_code in (200, 400)  # 400 = requires date param


# ════════════════════════════════════════════════════════════
#  17. VERIFY
# ════════════════════════════════════════════════════════════
class TestVerify:
    def test_verify_nonexistent(self, api, headers):
        r = requests.get(f"{api}/verify/NONEXISTENT_CODE",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code in (200, 400, 404)


# ════════════════════════════════════════════════════════════
#  18. USER MANAGEMENT
# ════════════════════════════════════════════════════════════
class TestUserManagement:
    UM = "/user-management"

    def test_list_users(self, api, headers):
        r = requests.get(f"{api}{self.UM}/users",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert "users" in body
        assert "total" in body

    def test_stats(self, api, headers):
        r = requests.get(f"{api}{self.UM}/stats",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_roles(self, api, headers):
        r = requests.get(f"{api}{self.UM}/roles",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_available_campuses(self, api, headers):
        r = requests.get(f"{api}{self.UM}/available-campuses",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_available_partners(self, api, headers):
        r = requests.get(f"{api}{self.UM}/available-partners",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_bulk_upload_template(self, api, headers):
        r = requests.get(f"{api}{self.UM}/candidates/bulk-upload/template",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")

    def test_create_get_update_user(self, api, headers, session_data):
        """Crear usuario vía user-management, consultar y actualizar."""
        u = _uid("um_")
        r = requests.post(f"{api}{self.UM}/users", json={
            "username": u, "email": f"{u}@test.com", "password": "Test1234!",
            "name": "UmTest", "first_surname": "A", "second_surname": "B",
            "role": "candidato"
        }, headers=headers, timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"Create user: {r.text}"
        body = r.json()
        uid = body.get("user", {}).get("id") or body.get("id")
        assert uid is not None

        # Get
        r = requests.get(f"{api}{self.UM}/users/{uid}",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Update
        r = requests.put(f"{api}{self.UM}/users/{uid}",
                         json={"name": "Updated"},
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_get_nonexistent_user(self, api, headers):
        r = requests.get(f"{api}{self.UM}/users/00000000-0000-0000-0000-000000000000",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_unauthorized_access(self, api):
        r = requests.get(f"{api}{self.UM}/users", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_stats_invalidate(self, api, headers):
        r = requests.post(f"{api}{self.UM}/stats/invalidate",
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_check_name_similarity(self, api, headers):
        r = requests.post(f"{api}{self.UM}/users/check-name-similarity",
                          json={"name": "Juan", "first_surname": "Pérez"},
                          headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════════════════════════
#  19. BULK UPLOAD HISTORY  (solo DEV — PROD no tiene deploy)
# ════════════════════════════════════════════════════════════
class TestBulkUploadHistory:
    UM = "/user-management"

    def test_list_bulk_history(self, api, headers, env_name):
        r = requests.get(f"{api}{self.UM}/bulk-history",
                         headers=headers, timeout=TIMEOUT)
        if env_name == "PROD":
            # PROD aún no tiene el endpoint desplegado
            if r.status_code == 404:
                pytest.skip("bulk-history no desplegado en PROD aún")
        assert r.status_code == 200, f"bulk-history list: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert "batches" in body
        assert "total" in body
        assert "page" in body
        assert "per_page" in body
        assert isinstance(body["batches"], list)

    def test_bulk_history_pagination(self, api, headers, env_name):
        r = requests.get(f"{api}{self.UM}/bulk-history?page=1&per_page=5",
                         headers=headers, timeout=TIMEOUT)
        if env_name == "PROD" and r.status_code == 404:
            pytest.skip("bulk-history no desplegado en PROD aún")
        assert r.status_code == 200
        body = r.json()
        assert body["per_page"] == 5

    def test_bulk_history_filter_partner(self, api, headers, env_name):
        r = requests.get(f"{api}{self.UM}/bulk-history?partner_id=999999",
                         headers=headers, timeout=TIMEOUT)
        if env_name == "PROD" and r.status_code == 404:
            pytest.skip("bulk-history no desplegado en PROD aún")
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_bulk_history_detail_nonexistent(self, api, headers, env_name):
        r = requests.get(f"{api}{self.UM}/bulk-history/999999",
                         headers=headers, timeout=TIMEOUT)
        if env_name == "PROD" and r.status_code == 404:
            pytest.skip("bulk-history no desplegado en PROD aún")
        assert r.status_code == 404

    def test_bulk_history_export_nonexistent(self, api, headers, env_name):
        r = requests.get(f"{api}{self.UM}/bulk-history/999999/export",
                         headers=headers, timeout=TIMEOUT)
        if env_name == "PROD" and r.status_code == 404:
            pytest.skip("bulk-history no desplegado en PROD aún")
        assert r.status_code == 404

    def test_bulk_history_unauthorized(self, api, env_name):
        r = requests.get(f"{api}{self.UM}/bulk-history", timeout=TIMEOUT)
        if env_name == "PROD" and r.status_code == 404:
            pytest.skip("bulk-history no desplegado en PROD aún")
        assert r.status_code == 401

    def test_bulk_history_detail_if_data_exists(self, api, headers, env_name):
        """Si hay batches, obtener detalle del primero."""
        r = requests.get(f"{api}{self.UM}/bulk-history?per_page=1",
                         headers=headers, timeout=TIMEOUT)
        if env_name == "PROD" and r.status_code == 404:
            pytest.skip("bulk-history no desplegado en PROD aún")
        assert r.status_code == 200
        batches = r.json().get("batches", [])
        if not batches:
            pytest.skip("No hay batches para probar detalle")
        batch_id = batches[0]["id"]

        # Detail
        r = requests.get(f"{api}{self.UM}/bulk-history/{batch_id}",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert "id" in body
        assert "total_processed" in body
        assert "members" in body
        assert isinstance(body["members"], list)

    def test_bulk_history_export_if_data_exists(self, api, headers, env_name):
        """Si hay batches, exportar Excel del primero."""
        r = requests.get(f"{api}{self.UM}/bulk-history?per_page=1",
                         headers=headers, timeout=TIMEOUT)
        if env_name == "PROD" and r.status_code == 404:
            pytest.skip("bulk-history no desplegado en PROD aún")
        assert r.status_code == 200
        batches = r.json().get("batches", [])
        if not batches:
            pytest.skip("No hay batches para probar export")
        batch_id = batches[0]["id"]

        # Export
        r = requests.get(f"{api}{self.UM}/bulk-history/{batch_id}/export",
                         headers=headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        assert len(r.content) > 100  # Mínimo un Excel válido


# ════════════════════════════════════════════════════════════
#  20. EXPORT CREDENTIALS
# ════════════════════════════════════════════════════════════
class TestExportCredentials:
    UM = "/user-management"

    def test_export_empty(self, api, headers):
        r = requests.post(f"{api}{self.UM}/export-credentials",
                          json={"user_ids": []},
                          headers=headers, timeout=TIMEOUT)
        # Puede ser 400 por IDs vacíos o 200 con Excel vacío
        assert r.status_code in (200, 400)

    def test_export_nonexistent_user(self, api, headers):
        r = requests.post(f"{api}{self.UM}/export-credentials",
                          json={"user_ids": ["00000000-0000-0000-0000-000000000000"]},
                          headers=headers, timeout=TIMEOUT)
        # Se espera 200 con Excel (aunque sin datos) o 400/404
        assert r.status_code in (200, 400, 404)


# ════════════════════════════════════════════════════════════
#  CLEANUP — Eliminar datos de prueba
# ════════════════════════════════════════════════════════════
def teardown_module(module):
    """Limpiar datos de prueba creados durante la sesión."""
    for env_name, data in _session_data.items():
        api = _api(env_name)
        try:
            h = _login(env_name)
        except Exception:
            continue

        # Delete in reverse dependency order
        if data.get("group_id"):
            requests.delete(f"{api}/partners/groups/{data['group_id']}",
                            headers=h, timeout=TIMEOUT)
        if data.get("campus_id"):
            requests.delete(f"{api}/partners/campuses/{data['campus_id']}",
                            headers=h, timeout=TIMEOUT)
        if data.get("partner_id"):
            requests.delete(f"{api}/partners/{data['partner_id']}",
                            headers=h, timeout=TIMEOUT)
        if data.get("exam"):
            requests.delete(f"{api}/exams/{data['exam']['id']}",
                            headers=h, timeout=TIMEOUT)
        if data.get("standard_id"):
            requests.delete(f"{api}/competency-standards/{data['standard_id']}",
                            headers=h, timeout=TIMEOUT)
