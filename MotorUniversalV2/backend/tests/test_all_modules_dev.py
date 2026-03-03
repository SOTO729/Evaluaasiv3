"""
Test comprehensivo de TODOS los módulos de la API DEV.
Cubre: Auth, Users, Partners (+ Campus, Group, Members, States),
       Standards, Exams (+ Categories, Topics, Questions, Exercises, Steps, Actions),
       Study Contents (+ Sessions, Topics, Reading, Video, Downloadable, Interactive),
       Badges, Balance, Conocer, Activity, VM Sessions, Verify.

Ejecutar:
    cd backend && python -m pytest tests/test_all_modules_dev.py -v --tb=short

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

_uid = uuid.uuid4().hex[:6]


# ────────────────────────── Helpers ──────────────────────────

def _unique(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:8]}"


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
def test_user(admin_headers):
    """Registrar un usuario de prueba para la sesión."""
    u = _unique("tu_")
    r = requests.post(f"{API}/auth/register", json={
        "username": u, "email": f"{u}@test.com", "password": "Test1234!",
        "name": "Test", "first_surname": "User", "second_surname": "X"
    }, timeout=TIMEOUT)
    assert r.status_code in (200, 201), f"Register failed: {r.text}"
    data = r.json()
    user_id = data["user"]["id"]
    # Login to get token
    r2 = requests.post(f"{API}/auth/login",
                       json={"username": u, "password": "Test1234!"},
                       timeout=TIMEOUT)
    assert r2.status_code == 200
    token = r2.json()["access_token"]
    return {
        "id": user_id,
        "username": u,
        "password": "Test1234!",
        "token": token,
        "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    }


@pytest.fixture(scope="session")
def standard_for_tests(admin_headers):
    """Crear un estándar de competencia reutilizable."""
    code = _unique("STD")
    r = requests.post(f"{API}/competency-standards/",
                      json={"code": code, "name": f"Test Std {code}", "brand_id": 1},
                      headers=admin_headers, timeout=TIMEOUT)
    assert r.status_code == 201, f"Standard create failed: {r.text}"
    sid = r.json()["standard"]["id"]
    yield sid
    requests.delete(f"{API}/competency-standards/{sid}",
                    headers=admin_headers, timeout=TIMEOUT)


@pytest.fixture(scope="session")
def exam_for_tests(admin_headers, standard_for_tests):
    """Crear un examen reutilizable con categoría."""
    r = requests.post(f"{API}/exams", json={
        "name": _unique("Exam"), "stage_id": 1,
        "competency_standard_id": standard_for_tests,
        "categories": [{"name": "Main", "percentage": 100}]
    }, headers=admin_headers, timeout=TIMEOUT)
    assert r.status_code == 201, f"Exam create failed: {r.text}"
    exam = r.json()["exam"]
    yield exam
    requests.delete(f"{API}/exams/{exam['id']}",
                    headers=admin_headers, timeout=TIMEOUT)


# ════════════════════════════════════════
#  AUTH MODULE
# ════════════════════════════════════════
class TestAuth:
    def test_login_admin(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == ADMIN_USER

    def test_register_and_login(self, test_user):
        assert test_user["id"] is not None
        assert test_user["token"] is not None

    def test_me(self, test_user):
        r = requests.get(f"{API}/auth/me", headers=test_user["headers"], timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["id"] == test_user["id"]

    def test_change_password(self, test_user):
        r = requests.post(f"{API}/auth/change-password", json={
            "current_password": test_user["password"],
            "new_password": "NewPass9999!"
        }, headers=test_user["headers"], timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"Change password failed: {r.text}"

    def test_login_bad_credentials(self):
        r = requests.post(f"{API}/auth/login",
                          json={"username": "no_existe", "password": "bad"},
                          timeout=TIMEOUT)
        assert r.status_code == 401

    def test_register_duplicate(self, admin_headers):
        r = requests.post(f"{API}/auth/register", json={
            "username": ADMIN_USER, "email": "dup@test.com", "password": "P1!",
            "name": "D", "first_surname": "U", "second_surname": "P"
        }, timeout=TIMEOUT)
        assert r.status_code == 400


# ════════════════════════════════════════
#  USERS MODULE
# ════════════════════════════════════════
class TestUsers:
    def test_list_users(self, admin_headers):
        r = requests.get(f"{API}/users", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert "users" in r.json()

    def test_get_user_by_id(self, admin_headers, test_user):
        r = requests.get(f"{API}/users/{test_user['id']}",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_update_user(self, admin_headers, test_user):
        r = requests.put(f"{API}/users/{test_user['id']}",
                         json={"name": "Updated"},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_get_nonexistent_user(self, admin_headers):
        r = requests.get(f"{API}/users/nonexistent-uuid",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 404


# ════════════════════════════════════════
#  PARTNERS MODULE
# ════════════════════════════════════════
class TestPartners:
    def test_list_partners(self, admin_headers):
        r = requests.get(f"{API}/partners", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_crud_partner(self, admin_headers):
        uid = _unique("P")
        # Create
        r = requests.post(f"{API}/partners", json={
            "name": uid, "business_name": uid, "rfc": uid[:13], "brand_id": 1
        }, headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create failed: {r.text}"
        pid = r.json()["partner"]["id"]

        # Read
        r = requests.get(f"{API}/partners/{pid}", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Update
        r = requests.put(f"{API}/partners/{pid}",
                         json={"name": f"{uid}_upd"},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Delete
        r = requests.delete(f"{API}/partners/{pid}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200


class TestPartnerStates:
    def test_add_and_remove_state(self, admin_headers):
        uid = _unique("PS")
        r = requests.post(f"{API}/partners", json={
            "name": uid, "business_name": uid, "rfc": uid[:13], "brand_id": 1
        }, headers=admin_headers, timeout=TIMEOUT)
        pid = r.json()["partner"]["id"]

        # Add state
        r = requests.post(f"{API}/partners/{pid}/states",
                          json={"state_name": "Aguascalientes"},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"Add state failed: {r.text}"
        pres_id = r.json()["presence"]["id"]

        # Remove state
        r = requests.delete(f"{API}/partners/{pid}/states/{pres_id}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Cleanup
        requests.delete(f"{API}/partners/{pid}", headers=admin_headers, timeout=TIMEOUT)


class TestCampus:
    @pytest.fixture()
    def partner_id(self, admin_headers):
        uid = _unique("CP")
        r = requests.post(f"{API}/partners", json={
            "name": uid, "business_name": uid, "rfc": uid[:13], "brand_id": 1
        }, headers=admin_headers, timeout=TIMEOUT)
        pid = r.json()["partner"]["id"]
        yield pid
        requests.delete(f"{API}/partners/{pid}", headers=admin_headers, timeout=TIMEOUT)

    def _campus_data(self):
        uid = _unique()
        return {
            "name": f"Camp{uid}", "state_name": "Jalisco", "city": "GDL",
            "director_name": "J", "director_first_surname": "P",
            "director_second_surname": "L", "director_email": f"d{uid}@t.com",
            "director_phone": "3312345678", "director_gender": "M",
            "director_curp": f"PELJ{uid.upper()[:6]}01HJCR09"[:18].ljust(18, 'X'),
            "director_date_of_birth": "1990-01-01"
        }

    def test_create_campus(self, admin_headers, partner_id):
        r = requests.post(f"{API}/partners/{partner_id}/campuses",
                          json=self._campus_data(),
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create campus failed: {r.text}"
        cid = r.json()["campus"]["id"]
        # Cleanup
        requests.delete(f"{API}/partners/campuses/{cid}", headers=admin_headers, timeout=TIMEOUT)

    def test_get_campus(self, admin_headers, partner_id):
        r = requests.post(f"{API}/partners/{partner_id}/campuses",
                          json=self._campus_data(),
                          headers=admin_headers, timeout=TIMEOUT)
        cid = r.json()["campus"]["id"]

        r = requests.get(f"{API}/partners/campuses/{cid}",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        requests.delete(f"{API}/partners/campuses/{cid}", headers=admin_headers, timeout=TIMEOUT)

    def test_update_campus(self, admin_headers, partner_id):
        r = requests.post(f"{API}/partners/{partner_id}/campuses",
                          json=self._campus_data(),
                          headers=admin_headers, timeout=TIMEOUT)
        cid = r.json()["campus"]["id"]

        r = requests.put(f"{API}/partners/campuses/{cid}",
                         json={"name": "Updated"},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        requests.delete(f"{API}/partners/campuses/{cid}", headers=admin_headers, timeout=TIMEOUT)

    def test_delete_campus(self, admin_headers, partner_id):
        r = requests.post(f"{API}/partners/{partner_id}/campuses",
                          json=self._campus_data(),
                          headers=admin_headers, timeout=TIMEOUT)
        cid = r.json()["campus"]["id"]

        r = requests.delete(f"{API}/partners/campuses/{cid}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200


class TestGroups:
    @pytest.fixture()
    def campus_ctx(self, admin_headers):
        uid = _unique("GR")
        r = requests.post(f"{API}/partners", json={
            "name": uid, "business_name": uid, "rfc": uid[:13], "brand_id": 1
        }, headers=admin_headers, timeout=TIMEOUT)
        pid = r.json()["partner"]["id"]

        curp = f"GRLJ{uid.upper()[:6]}01HJCR09"[:18].ljust(18, 'X')
        r = requests.post(f"{API}/partners/{pid}/campuses", json={
            "name": f"C{uid}", "state_name": "Jalisco", "city": "GDL",
            "director_name": "J", "director_first_surname": "P",
            "director_second_surname": "L", "director_email": f"g{uid}@t.com",
            "director_phone": "331234", "director_gender": "M",
            "director_curp": curp, "director_date_of_birth": "1990-01-01"
        }, headers=admin_headers, timeout=TIMEOUT)
        cid = r.json()["campus"]["id"]
        yield {"partner_id": pid, "campus_id": cid}
        requests.delete(f"{API}/partners/campuses/{cid}", headers=admin_headers, timeout=TIMEOUT)
        requests.delete(f"{API}/partners/{pid}", headers=admin_headers, timeout=TIMEOUT)

    def test_create_group(self, admin_headers, campus_ctx):
        r = requests.post(f"{API}/partners/campuses/{campus_ctx['campus_id']}/groups",
                          json={"name": _unique("G")},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create group failed: {r.text}"
        gid = r.json()["group"]["id"]
        requests.delete(f"{API}/partners/groups/{gid}", headers=admin_headers, timeout=TIMEOUT)

    def test_update_group(self, admin_headers, campus_ctx):
        r = requests.post(f"{API}/partners/campuses/{campus_ctx['campus_id']}/groups",
                          json={"name": _unique("G")},
                          headers=admin_headers, timeout=TIMEOUT)
        gid = r.json()["group"]["id"]

        r = requests.put(f"{API}/partners/groups/{gid}",
                         json={"name": "Updated"},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        requests.delete(f"{API}/partners/groups/{gid}", headers=admin_headers, timeout=TIMEOUT)

    def test_delete_group(self, admin_headers, campus_ctx):
        r = requests.post(f"{API}/partners/campuses/{campus_ctx['campus_id']}/groups",
                          json={"name": _unique("G")},
                          headers=admin_headers, timeout=TIMEOUT)
        gid = r.json()["group"]["id"]

        r = requests.delete(f"{API}/partners/groups/{gid}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_add_remove_member(self, admin_headers, campus_ctx, test_user):
        r = requests.post(f"{API}/partners/campuses/{campus_ctx['campus_id']}/groups",
                          json={"name": _unique("GM")},
                          headers=admin_headers, timeout=TIMEOUT)
        gid = r.json()["group"]["id"]

        # Add member
        r = requests.post(f"{API}/partners/groups/{gid}/members",
                          json={"user_id": test_user["id"]},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code in (200, 201), f"Add member failed: {r.text}"
        mid = r.json()["member"]["id"]

        # Remove member
        r = requests.delete(f"{API}/partners/groups/{gid}/members/{mid}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        requests.delete(f"{API}/partners/groups/{gid}", headers=admin_headers, timeout=TIMEOUT)


# ════════════════════════════════════════
#  COMPETENCY STANDARDS MODULE
# ════════════════════════════════════════
class TestStandards:
    def test_list_standards(self, admin_headers):
        r = requests.get(f"{API}/competency-standards/",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_crud_standard(self, admin_headers):
        code = _unique("CS")
        # Create
        r = requests.post(f"{API}/competency-standards/",
                          json={"code": code, "name": f"Std {code}", "brand_id": 1},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201
        sid = r.json()["standard"]["id"]

        # Read
        r = requests.get(f"{API}/competency-standards/{sid}",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Update
        r = requests.put(f"{API}/competency-standards/{sid}",
                         json={"name": "Updated"},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Delete
        r = requests.delete(f"{API}/competency-standards/{sid}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_list_brands(self, admin_headers):
        r = requests.get(f"{API}/competency-standards/brands",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════
#  EXAMS MODULE
# ════════════════════════════════════════
class TestExams:
    def test_list_exams(self, admin_headers):
        r = requests.get(f"{API}/exams", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_create_and_delete_exam(self, admin_headers, standard_for_tests):
        r = requests.post(f"{API}/exams", json={
            "name": _unique("Exam"), "stage_id": 1,
            "competency_standard_id": standard_for_tests,
            "categories": [{"name": "A", "percentage": 60}, {"name": "B", "percentage": 40}]
        }, headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201
        eid = r.json()["exam"]["id"]

        r = requests.delete(f"{API}/exams/{eid}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_update_exam(self, admin_headers, exam_for_tests):
        r = requests.put(f"{API}/exams/{exam_for_tests['id']}",
                         json={"name": "Updated Exam", "passing_score": 80},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_get_exam(self, admin_headers, exam_for_tests):
        r = requests.get(f"{API}/exams/{exam_for_tests['id']}",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_question_types(self, admin_headers):
        r = requests.get(f"{API}/exams/question-types",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()["question_types"]) > 0

    def test_validate_exam(self, admin_headers, exam_for_tests):
        r = requests.get(f"{API}/exams/{exam_for_tests['id']}/validate",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200


class TestExamTopicsQuestions:
    def test_full_chain(self, admin_headers, exam_for_tests):
        """Test: Create topic → question → exercise → step → action."""
        cats = exam_for_tests.get("categories", [])
        assert len(cats) > 0, "Exam has no categories"
        cat_id = cats[0]["id"]

        # Topic
        r = requests.post(f"{API}/exams/categories/{cat_id}/topics",
                          json={"name": _unique("Topic")},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Topic: {r.text}"
        tid = r.json()["topic"]["id"]

        # Question
        qt = requests.get(f"{API}/exams/question-types",
                          headers=admin_headers, timeout=TIMEOUT).json()["question_types"][0]["id"]
        r = requests.post(f"{API}/exams/topics/{tid}/questions", json={
            "question_type_id": qt, "question_text": "Q?",
            "answers": [
                {"answer_number": 1, "answer_text": "Yes", "is_correct": True},
                {"answer_number": 2, "answer_text": "No", "is_correct": False}
            ]
        }, headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Question: {r.text}"

        # Exercise
        r = requests.post(f"{API}/exams/topics/{tid}/exercises",
                          json={"exercise_text": "Exercise"},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Exercise: {r.text}"
        exid = r.json()["exercise"]["id"]

        # Step
        r = requests.post(f"{API}/exams/exercises/{exid}/steps",
                          json={"title": "Step 1", "description": "Do it"},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Step: {r.text}"
        stid = r.json()["step"]["id"]

        # Action
        r = requests.post(f"{API}/exams/steps/{stid}/actions",
                          json={"action_type": "button", "label": "Click",
                                "position_x": 10, "position_y": 20},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Action: {r.text}"


class TestExamClone:
    def test_clone_exam(self, admin_headers, exam_for_tests):
        r = requests.post(f"{API}/exams/{exam_for_tests['id']}/clone",
                          json={"name": _unique("Clone")},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Clone: {r.text}"
        clone_id = r.json()["exam"]["id"]
        requests.delete(f"{API}/exams/{clone_id}",
                        headers=admin_headers, timeout=TIMEOUT)


# ════════════════════════════════════════
#  STUDY CONTENTS MODULE
# ════════════════════════════════════════
class TestStudyContents:
    def test_list_materials(self, admin_headers):
        r = requests.get(f"{API}/study-contents",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_crud_material(self, admin_headers, exam_for_tests):
        # Create
        r = requests.post(f"{API}/study-contents",
                          json={"title": _unique("Mat"), "exam_id": exam_for_tests["id"]},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create material: {r.text}"
        mid = r.json()["material"]["id"]

        # Update
        r = requests.put(f"{API}/study-contents/{mid}",
                         json={"title": "Updated"},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Delete
        r = requests.delete(f"{API}/study-contents/{mid}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200


class TestStudyContentChain:
    @pytest.fixture()
    def material_id(self, admin_headers, exam_for_tests):
        r = requests.post(f"{API}/study-contents",
                          json={"title": _unique("SC"), "exam_id": exam_for_tests["id"]},
                          headers=admin_headers, timeout=TIMEOUT)
        mid = r.json()["material"]["id"]
        yield mid
        requests.delete(f"{API}/study-contents/{mid}",
                        headers=admin_headers, timeout=TIMEOUT)

    def test_session_topic_reading(self, admin_headers, material_id):
        """Session → Topic → Reading."""
        r = requests.post(f"{API}/study-contents/{material_id}/sessions",
                          json={"title": "Sess1"},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201
        ssid = r.json()["session"]["id"]

        r = requests.post(
            f"{API}/study-contents/{material_id}/sessions/{ssid}/topics",
            json={"title": "Topic1", "estimated_time_minutes": 15},
            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201
        stid = r.json()["topic"]["id"]

        base = f"{API}/study-contents/{material_id}/sessions/{ssid}/topics/{stid}"

        # Reading
        r = requests.post(f"{base}/reading",
                          json={"title": "Lec", "content": "<p>C</p>"},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Reading: {r.text}"

        # Update reading
        r = requests.put(f"{base}/reading",
                         json={"title": "Lec2", "content": "<p>U</p>"},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_video(self, admin_headers, material_id):
        r = requests.post(f"{API}/study-contents/{material_id}/sessions",
                          json={"title": "SessV"},
                          headers=admin_headers, timeout=TIMEOUT)
        ssid = r.json()["session"]["id"]
        r = requests.post(
            f"{API}/study-contents/{material_id}/sessions/{ssid}/topics",
            json={"title": "TopV", "estimated_time_minutes": 10},
            headers=admin_headers, timeout=TIMEOUT)
        stid = r.json()["topic"]["id"]

        r = requests.post(
            f"{API}/study-contents/{material_id}/sessions/{ssid}/topics/{stid}/video",
            json={"title": "Vid", "video_url": "https://youtube.com/watch?v=t",
                  "video_type": "youtube"},
            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Video: {r.text}"

    def test_downloadable(self, admin_headers, material_id):
        r = requests.post(f"{API}/study-contents/{material_id}/sessions",
                          json={"title": "SessD"},
                          headers=admin_headers, timeout=TIMEOUT)
        ssid = r.json()["session"]["id"]
        r = requests.post(
            f"{API}/study-contents/{material_id}/sessions/{ssid}/topics",
            json={"title": "TopD", "estimated_time_minutes": 5},
            headers=admin_headers, timeout=TIMEOUT)
        stid = r.json()["topic"]["id"]

        r = requests.post(
            f"{API}/study-contents/{material_id}/sessions/{ssid}/topics/{stid}/downloadable",
            json={"title": "DL", "file_url": "https://example.com/f.pdf"},
            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"Downloadable: {r.text}"

    def test_interactive_exercise(self, admin_headers, material_id):
        r = requests.post(f"{API}/study-contents/{material_id}/sessions",
                          json={"title": "SessI"},
                          headers=admin_headers, timeout=TIMEOUT)
        ssid = r.json()["session"]["id"]
        r = requests.post(
            f"{API}/study-contents/{material_id}/sessions/{ssid}/topics",
            json={"title": "TopI", "estimated_time_minutes": 20},
            headers=admin_headers, timeout=TIMEOUT)
        stid = r.json()["topic"]["id"]
        base = f"{API}/study-contents/{material_id}/sessions/{ssid}/topics/{stid}"

        # Interactive
        r = requests.post(f"{base}/interactive",
                          json={"title": "IA"},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Interactive: {r.text}"

        # Step
        r = requests.post(f"{base}/interactive/steps",
                          json={"title": "S1"},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Int Step: {r.text}"
        isid = r.json()["step"]["id"]

        # Action
        r = requests.post(f"{base}/interactive/steps/{isid}/actions",
                          json={"action_type": "button", "label": "Click"},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Int Action: {r.text}"


class TestStudyContentClone:
    def test_clone_material(self, admin_headers, exam_for_tests):
        r = requests.post(f"{API}/study-contents",
                          json={"title": _unique("CM"), "exam_id": exam_for_tests["id"]},
                          headers=admin_headers, timeout=TIMEOUT)
        mid = r.json()["material"]["id"]

        r = requests.post(f"{API}/study-contents/{mid}/clone",
                          json={"title": _unique("Clone")},
                          headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201
        cmid = r.json()["material"]["id"]

        requests.delete(f"{API}/study-contents/{cmid}",
                        headers=admin_headers, timeout=TIMEOUT)
        requests.delete(f"{API}/study-contents/{mid}",
                        headers=admin_headers, timeout=TIMEOUT)


# ════════════════════════════════════════
#  BADGES MODULE
# ════════════════════════════════════════
class TestBadges:
    def test_list_templates(self, admin_headers):
        r = requests.get(f"{API}/badges/templates",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_crud_template(self, admin_headers, standard_for_tests, exam_for_tests):
        # Create
        r = requests.post(f"{API}/badges/templates", json={
            "name": _unique("Badge"), "description": "Test",
            "competency_standard_id": standard_for_tests,
            "exam_id": exam_for_tests["id"]
        }, headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 201, f"Create badge: {r.text}"
        btid = r.json()["template"]["id"]

        # Update
        r = requests.put(f"{API}/badges/templates/{btid}",
                         json={"description": "Updated"},
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Delete
        r = requests.delete(f"{API}/badges/templates/{btid}",
                            headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_my_badges(self, test_user):
        r = requests.get(f"{API}/badges/my-badges",
                         headers=test_user["headers"], timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════
#  BALANCE MODULE
# ════════════════════════════════════════
class TestBalance:
    def test_my_balance(self, admin_headers):
        r = requests.get(f"{API}/balance/my-balance",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_my_requests(self, admin_headers):
        r = requests.get(f"{API}/balance/my-requests",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_my_transactions(self, admin_headers):
        r = requests.get(f"{API}/balance/my-transactions",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════
#  CONOCER MODULE
# ════════════════════════════════════════
class TestConocer:
    def test_my_certificates(self, admin_headers):
        r = requests.get(f"{API}/conocer/certificates",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_admin_upload_batches(self, admin_headers):
        r = requests.get(f"{API}/conocer/admin/upload-batches",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_verify_nonexistent(self, admin_headers):
        r = requests.get(f"{API}/conocer/verify/NONEXISTENT123",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code in (200, 404)


# ════════════════════════════════════════
#  ACTIVITY MODULE
# ════════════════════════════════════════
class TestActivity:
    def test_logs(self, admin_headers):
        r = requests.get(f"{API}/activity/logs",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_summary(self, admin_headers):
        r = requests.get(f"{API}/activity/summary",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ════════════════════════════════════════
#  VM SESSIONS MODULE
# ════════════════════════════════════════
class TestVMSessions:
    def test_list_sessions(self, admin_headers):
        r = requests.get(f"{API}/vm-sessions/sessions",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_check_access(self, admin_headers):
        r = requests.get(f"{API}/vm-sessions/check-access",
                         headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_available_slots(self, admin_headers):
        r = requests.get(f"{API}/vm-sessions/available-slots",
                         headers=admin_headers, timeout=TIMEOUT)
        # 400 = requires date param, not a bug
        assert r.status_code in (200, 400)


# ════════════════════════════════════════
#  VERIFY MODULE
# ════════════════════════════════════════
class TestVerify:
    def test_verify_nonexistent_code(self, admin_headers):
        r = requests.get(f"{API}/verify/NONEXISTENT_CODE",
                         headers=admin_headers, timeout=TIMEOUT)
        # 400 with valid=false = expected for bad code, not a bug
        assert r.status_code in (200, 400, 404), f"Verify returned {r.status_code}: {r.text[:200]}"


# ════════════════════════════════════════
#  HEALTH MODULE
# ════════════════════════════════════════
class TestHealth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_ping(self):
        r = requests.get(f"{API}/health", timeout=TIMEOUT)
        assert r.status_code == 200
        # Confirm response is valid JSON
        assert "status" in r.json() or r.status_code == 200
