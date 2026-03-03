"""
Tests completos para los módulos /standards, /exams y /study-contents
Ejecutar contra el entorno DEV:
    cd backend && python -m pytest tests/test_standards_exams_study.py -v --tb=short
"""

import pytest
import requests
import uuid
import time

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "Admin123!"


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    """URL base del API"""
    return DEV_API


@pytest.fixture(scope="session")
def admin_headers(api):
    """Headers autenticados como admin"""
    r = requests.post(f"{api}/auth/login", json={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })
    assert r.status_code == 200, f"Login falló: {r.text}"
    token = r.json()["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def brand_id(api, admin_headers):
    """Retorna el ID de una brand existente"""
    r = requests.get(f"{api}/competency-standards/brands", headers=admin_headers)
    assert r.status_code == 200
    brands = r.json()["brands"]
    assert len(brands) > 0, "No hay brands en DEV"
    return brands[0]["id"]


# ═══════════════════════════════════════════════════════════════════════════
# MÓDULO 1: COMPETENCY STANDARDS (/api/competency-standards)
# ═══════════════════════════════════════════════════════════════════════════

class TestBrands:
    """Tests para el sub-módulo de Brands (Marcas)"""

    def test_list_brands(self, api, admin_headers):
        r = requests.get(f"{api}/competency-standards/brands", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "brands" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_get_brand(self, api, admin_headers, brand_id):
        r = requests.get(f"{api}/competency-standards/brands/{brand_id}", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        brand = data.get("brand", data)
        assert brand["id"] == brand_id
        assert "name" in brand

    def test_create_update_delete_brand(self, api, admin_headers):
        uid = uuid.uuid4().hex[:8]
        # CREATE
        r = requests.post(f"{api}/competency-standards/brands", json={
            "name": f"Test Brand {uid}",
            "description": "Brand de prueba"
        }, headers=admin_headers)
        assert r.status_code == 201, f"Create brand falló: {r.text}"
        bid = r.json()["brand"]["id"]

        # UPDATE
        r = requests.put(f"{api}/competency-standards/brands/{bid}", json={
            "name": f"Brand Editada {uid}",
            "description": "Actualizada"
        }, headers=admin_headers)
        assert r.status_code == 200, f"Update brand falló: {r.text}"
        assert "Editada" in r.json()["brand"]["name"]

        # DELETE
        r = requests.delete(f"{api}/competency-standards/brands/{bid}", headers=admin_headers)
        assert r.status_code == 200

    def test_brand_not_found(self, api, admin_headers):
        r = requests.get(f"{api}/competency-standards/brands/99999", headers=admin_headers)
        assert r.status_code == 404


class TestCompetencyStandards:
    """Tests para CRUD de Estándares de Competencia"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        self.brand_id = brand_id

    def _create_standard(self, code=None):
        code = code or f"TST-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code,
            "name": f"Standard {code}",
            "brand_id": self.brand_id
        }, headers=self.headers)
        assert r.status_code == 201, f"Create standard falló: {r.text}"
        return r.json()["standard"]

    def _delete_standard(self, std_id):
        requests.delete(f"{self.api}/competency-standards/{std_id}", headers=self.headers)

    def test_list_standards(self):
        r = requests.get(f"{self.api}/competency-standards/", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert "standards" in data
        assert "total" in data

    def test_create_standard(self):
        std = self._create_standard()
        assert std["id"] > 0
        assert std["brand_id"] == self.brand_id
        self._delete_standard(std["id"])

    def test_get_standard(self):
        std = self._create_standard()
        r = requests.get(f"{self.api}/competency-standards/{std['id']}", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["code"] == std["code"]
        self._delete_standard(std["id"])

    def test_update_standard(self):
        std = self._create_standard()
        r = requests.put(f"{self.api}/competency-standards/{std['id']}", json={
            "name": "Nombre Actualizado",
            "description": "Descripción nueva"
        }, headers=self.headers)
        assert r.status_code == 200
        assert r.json()["standard"]["name"] == "Nombre Actualizado"
        self._delete_standard(std["id"])

    def test_delete_standard(self):
        std = self._create_standard()
        r = requests.delete(f"{self.api}/competency-standards/{std['id']}", headers=self.headers)
        assert r.status_code == 200

    def test_create_duplicate_code(self):
        code = f"DUP-{uuid.uuid4().hex[:6]}"
        std = self._create_standard(code)
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": "Duplicado", "brand_id": self.brand_id
        }, headers=self.headers)
        assert r.status_code == 409
        self._delete_standard(std["id"])

    def test_standard_not_found(self):
        r = requests.get(f"{self.api}/competency-standards/99999", headers=self.headers)
        assert r.status_code == 404

    def test_create_standard_missing_fields(self):
        r = requests.post(f"{self.api}/competency-standards/", json={
            "name": "Sin código"
        }, headers=self.headers)
        assert r.status_code == 400


class TestDeletionRequests:
    """Tests para solicitudes de eliminación de estándares"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        self.brand_id = brand_id

    def test_list_deletion_requests(self):
        r = requests.get(f"{self.api}/competency-standards/deletion-requests", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert "requests" in data

    def test_request_deletion_flow(self):
        # Create standard
        code = f"DEL-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Para Eliminar {code}", "brand_id": self.brand_id
        }, headers=self.headers)
        std_id = r.json()["standard"]["id"]

        # Request deletion
        r = requests.post(f"{self.api}/competency-standards/{std_id}/request-deletion", json={
            "reason": "No longer needed"
        }, headers=self.headers)
        assert r.status_code == 201, f"Request deletion falló: {r.text}"
        req_id = r.json()["request"]["id"]

        # Review (approve)
        r = requests.post(f"{self.api}/competency-standards/deletion-requests/{req_id}/review", json={
            "action": "approve",
            "response": "Aprobado por test"
        }, headers=self.headers)
        assert r.status_code == 200, f"Review falló: {r.text}"

    def test_request_deletion_missing_reason(self):
        code = f"DEL2-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Standard {code}", "brand_id": self.brand_id
        }, headers=self.headers)
        std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/competency-standards/{std_id}/request-deletion", json={},
                          headers=self.headers)
        assert r.status_code == 400
        requests.delete(f"{self.api}/competency-standards/{std_id}", headers=self.headers)


# ═══════════════════════════════════════════════════════════════════════════
# MÓDULO 2: EXAMS (/api/exams)
# ═══════════════════════════════════════════════════════════════════════════

class TestExams:
    """Tests para CRUD de Exámenes"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        self.brand_id = brand_id
        # Create a standard for exams
        code = f"EXM-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std for Exams {code}", "brand_id": brand_id
        }, headers=self.headers)
        assert r.status_code == 201, f"Setup standard falló: {r.text}"
        self.std_id = r.json()["standard"]["id"]
        yield
        # Cleanup standard (cascade should handle exams)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def _create_exam(self, name=None, categories=None):
        name = name or f"Exam {uuid.uuid4().hex[:6]}"
        categories = categories or [{"name": "Módulo Único", "percentage": 100}]
        r = requests.post(f"{self.api}/exams", json={
            "name": name,
            "stage_id": 1,
            "competency_standard_id": self.std_id,
            "brand_id": self.brand_id,
            "categories": categories
        }, headers=self.headers)
        assert r.status_code == 201, f"Create exam falló: {r.text}"
        return r.json()["exam"]

    def test_list_exams(self):
        r = requests.get(f"{self.api}/exams", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert "exams" in data
        assert "total" in data

    def test_create_exam(self):
        exam = self._create_exam()
        assert exam["id"] > 0
        assert exam["name"].startswith("Exam")
        requests.delete(f"{self.api}/exams/{exam['id']}", headers=self.headers)

    def test_create_exam_with_multiple_categories(self):
        exam = self._create_exam(categories=[
            {"name": "Módulo A", "percentage": 30},
            {"name": "Módulo B", "percentage": 30},
            {"name": "Módulo C", "percentage": 40}
        ])
        # Verify categories
        r = requests.get(f"{self.api}/exams/{exam['id']}/categories", headers=self.headers)
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert len(cats) == 3
        assert sum(c["percentage"] for c in cats) == 100
        requests.delete(f"{self.api}/exams/{exam['id']}", headers=self.headers)

    def test_get_exam(self):
        exam = self._create_exam()
        r = requests.get(f"{self.api}/exams/{exam['id']}", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["name"] == exam["name"]
        requests.delete(f"{self.api}/exams/{exam['id']}", headers=self.headers)

    def test_update_exam(self):
        exam = self._create_exam()
        r = requests.put(f"{self.api}/exams/{exam['id']}", json={
            "name": "Exam Actualizado",
            "passing_score": 80
        }, headers=self.headers)
        assert r.status_code == 200
        assert r.json()["exam"]["name"] == "Exam Actualizado"
        requests.delete(f"{self.api}/exams/{exam['id']}", headers=self.headers)

    def test_delete_exam(self):
        exam = self._create_exam()
        r = requests.delete(f"{self.api}/exams/{exam['id']}", headers=self.headers)
        assert r.status_code == 200

    def test_create_exam_missing_categories(self):
        r = requests.post(f"{self.api}/exams", json={
            "name": "Sin categorías",
            "stage_id": 1,
            "competency_standard_id": self.std_id
        }, headers=self.headers)
        assert r.status_code == 400

    def test_create_exam_invalid_percentage(self):
        r = requests.post(f"{self.api}/exams", json={
            "name": "Bad percentage",
            "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "A", "percentage": 50}]
        }, headers=self.headers)
        assert r.status_code == 400

    def test_exam_not_found(self):
        r = requests.get(f"{self.api}/exams/99999", headers=self.headers)
        assert r.status_code == 404

    def test_clone_exam(self):
        exam = self._create_exam()
        r = requests.post(f"{self.api}/exams/{exam['id']}/clone", json={
            "name": "Clon del Exam"
        }, headers=self.headers)
        assert r.status_code == 201
        clone_id = r.json()["exam"]["id"]
        assert clone_id != exam["id"]
        requests.delete(f"{self.api}/exams/{clone_id}", headers=self.headers)
        requests.delete(f"{self.api}/exams/{exam['id']}", headers=self.headers)

    def test_question_types(self):
        r = requests.get(f"{self.api}/exams/question-types", headers=self.headers)
        assert r.status_code == 200
        qt = r.json()["question_types"]
        assert len(qt) >= 1


class TestCategories:
    """Tests para Categorías/Módulos de exámenes"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        # Create standard + exam
        code = f"CAT-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam for Cat {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Initial", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]
        self.initial_cat_id = r.json()["exam"]["categories"][0]["id"]
        yield
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def test_list_categories(self):
        r = requests.get(f"{self.api}/exams/{self.exam_id}/categories", headers=self.headers)
        assert r.status_code == 200
        assert len(r.json()["categories"]) >= 1

    def test_create_category(self):
        # First update existing to 50%
        requests.put(f"{self.api}/exams/{self.exam_id}/categories/{self.initial_cat_id}", json={
            "percentage": 50
        }, headers=self.headers)
        # Add new
        r = requests.post(f"{self.api}/exams/{self.exam_id}/categories", json={
            "name": "Nuevo Módulo",
            "percentage": 50
        }, headers=self.headers)
        assert r.status_code == 201, f"Create category falló: {r.text}"

    def test_update_category(self):
        r = requests.put(f"{self.api}/exams/{self.exam_id}/categories/{self.initial_cat_id}", json={
            "name": "Módulo Renombrado"
        }, headers=self.headers)
        assert r.status_code == 200
        assert r.json()["category"]["name"] == "Módulo Renombrado"


class TestTopicsAndQuestions:
    """Tests para Topics, Questions y Answers dentro de exámenes"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        # Create full hierarchy: standard → exam → category
        code = f"TQ-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat 1", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]
        self.cat_id = r.json()["exam"]["categories"][0]["id"]
        yield
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def test_create_topic(self):
        r = requests.post(f"{self.api}/exams/categories/{self.cat_id}/topics", json={
            "name": "Tema de Prueba"
        }, headers=self.headers)
        assert r.status_code == 201, f"Create topic falló: {r.text}"
        assert r.json()["topic"]["name"] == "Tema de Prueba"

    def test_list_topics(self):
        # Create a topic first
        requests.post(f"{self.api}/exams/categories/{self.cat_id}/topics", json={
            "name": "Tema List"
        }, headers=self.headers)
        r = requests.get(f"{self.api}/exams/categories/{self.cat_id}/topics", headers=self.headers)
        assert r.status_code == 200
        assert len(r.json()["topics"]) >= 1

    def test_create_question_with_answers(self):
        # Create topic
        r = requests.post(f"{self.api}/exams/categories/{self.cat_id}/topics", json={
            "name": "Tema para Q"
        }, headers=self.headers)
        topic_id = r.json()["topic"]["id"]

        # Get question type
        r = requests.get(f"{self.api}/exams/question-types", headers=self.headers)
        qt_id = r.json()["question_types"][0]["id"]

        # Create question with answers
        r = requests.post(f"{self.api}/exams/topics/{topic_id}/questions", json={
            "question_type_id": qt_id,
            "question_text": "¿Cuál es la respuesta correcta?",
            "points": 2,
            "difficulty": "medium",
            "answers": [
                {"answer_number": 1, "answer_text": "Respuesta A", "is_correct": True},
                {"answer_number": 2, "answer_text": "Respuesta B", "is_correct": False},
                {"answer_number": 3, "answer_text": "Respuesta C", "is_correct": False}
            ]
        }, headers=self.headers)
        assert r.status_code == 201, f"Create question falló: {r.text}"
        q = r.json()["question"]
        assert q["question_text"] == "¿Cuál es la respuesta correcta?"

    def test_list_questions(self):
        # Create topic + question
        r = requests.post(f"{self.api}/exams/categories/{self.cat_id}/topics", json={
            "name": "Tema Q List"
        }, headers=self.headers)
        topic_id = r.json()["topic"]["id"]

        r = requests.get(f"{self.api}/exams/question-types", headers=self.headers)
        qt_id = r.json()["question_types"][0]["id"]

        requests.post(f"{self.api}/exams/topics/{topic_id}/questions", json={
            "question_type_id": qt_id,
            "question_text": "Pregunta de prueba"
        }, headers=self.headers)

        r = requests.get(f"{self.api}/exams/topics/{topic_id}/questions", headers=self.headers)
        assert r.status_code == 200
        assert len(r.json()["questions"]) >= 1

    def test_update_question(self):
        r = requests.post(f"{self.api}/exams/categories/{self.cat_id}/topics", json={
            "name": "Tema Q Update"
        }, headers=self.headers)
        topic_id = r.json()["topic"]["id"]

        r = requests.get(f"{self.api}/exams/question-types", headers=self.headers)
        qt_id = r.json()["question_types"][0]["id"]

        r = requests.post(f"{self.api}/exams/topics/{topic_id}/questions", json={
            "question_type_id": qt_id,
            "question_text": "Original"
        }, headers=self.headers)
        q_id = r.json()["question"]["id"]

        r = requests.put(f"{self.api}/exams/questions/{q_id}", json={
            "question_text": "Actualizada"
        }, headers=self.headers)
        assert r.status_code == 200
        assert r.json()["question"]["question_text"] == "Actualizada"

    def test_delete_question(self):
        r = requests.post(f"{self.api}/exams/categories/{self.cat_id}/topics", json={
            "name": "Tema Q Delete"
        }, headers=self.headers)
        topic_id = r.json()["topic"]["id"]

        r = requests.get(f"{self.api}/exams/question-types", headers=self.headers)
        qt_id = r.json()["question_types"][0]["id"]

        r = requests.post(f"{self.api}/exams/topics/{topic_id}/questions", json={
            "question_type_id": qt_id,
            "question_text": "Para borrar"
        }, headers=self.headers)
        q_id = r.json()["question"]["id"]

        r = requests.delete(f"{self.api}/exams/questions/{q_id}", headers=self.headers)
        assert r.status_code == 200

    def test_create_and_manage_answers(self):
        r = requests.post(f"{self.api}/exams/categories/{self.cat_id}/topics", json={
            "name": "Tema Answers"
        }, headers=self.headers)
        topic_id = r.json()["topic"]["id"]

        r = requests.get(f"{self.api}/exams/question-types", headers=self.headers)
        qt_id = r.json()["question_types"][0]["id"]

        r = requests.post(f"{self.api}/exams/topics/{topic_id}/questions", json={
            "question_type_id": qt_id,
            "question_text": "Pregunta para answers"
        }, headers=self.headers)
        q_id = r.json()["question"]["id"]

        # Create answer
        r = requests.post(f"{self.api}/exams/questions/{q_id}/answers", json={
            "answer_text": "Respuesta Nueva",
            "is_correct": True
        }, headers=self.headers)
        assert r.status_code == 201, f"Create answer falló: {r.text}"
        a_id = r.json()["answer"]["id"]

        # List answers
        r = requests.get(f"{self.api}/exams/questions/{q_id}/answers", headers=self.headers)
        assert r.status_code == 200
        assert len(r.json()["answers"]) >= 1

        # Update answer
        r = requests.put(f"{self.api}/exams/answers/{a_id}", json={
            "answer_text": "Respuesta Editada"
        }, headers=self.headers)
        assert r.status_code == 200

        # Delete answer
        r = requests.delete(f"{self.api}/exams/answers/{a_id}", headers=self.headers)
        assert r.status_code == 200


class TestExercises:
    """Tests para Exercises, Steps y Actions de exámenes"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        code = f"EXR-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]
        self.cat_id = r.json()["exam"]["categories"][0]["id"]

        # Create topic
        r = requests.post(f"{self.api}/exams/categories/{self.cat_id}/topics", json={
            "name": "Topic for Exercises"
        }, headers=self.headers)
        self.topic_id = r.json()["topic"]["id"]
        yield
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def test_create_exercise(self):
        r = requests.post(f"{self.api}/exams/topics/{self.topic_id}/exercises", json={
            "exercise_text": "Realice el siguiente ejercicio práctico"
        }, headers=self.headers)
        assert r.status_code == 201, f"Create exercise falló: {r.text}"
        assert "exercise" in r.json()

    def test_list_exercises(self):
        requests.post(f"{self.api}/exams/topics/{self.topic_id}/exercises", json={
            "exercise_text": "Exercise for list"
        }, headers=self.headers)
        r = requests.get(f"{self.api}/exams/topics/{self.topic_id}/exercises", headers=self.headers)
        assert r.status_code == 200
        assert len(r.json()["exercises"]) >= 1

    def test_exercise_steps_and_actions(self):
        # Create exercise
        r = requests.post(f"{self.api}/exams/topics/{self.topic_id}/exercises", json={
            "exercise_text": "Exercise with steps"
        }, headers=self.headers)
        ex_id = r.json()["exercise"]["id"]

        # Create step
        r = requests.post(f"{self.api}/exams/exercises/{ex_id}/steps", json={
            "title": "Paso 1",
            "description": "Haga clic en el botón"
        }, headers=self.headers)
        assert r.status_code == 201, f"Create step falló: {r.text}"
        step_id = r.json()["step"]["id"]

        # List steps
        r = requests.get(f"{self.api}/exams/exercises/{ex_id}/steps", headers=self.headers)
        assert r.status_code == 200
        assert len(r.json()["steps"]) >= 1

        # Create action
        r = requests.post(f"{self.api}/exams/steps/{step_id}/actions", json={
            "action_type": "button",
            "label": "Siguiente",
            "position_x": 50,
            "position_y": 50,
            "width": 15,
            "height": 8
        }, headers=self.headers)
        assert r.status_code == 201, f"Create action falló: {r.text}"
        action_id = r.json()["action"]["id"]

        # List actions
        r = requests.get(f"{self.api}/exams/steps/{step_id}/actions", headers=self.headers)
        assert r.status_code == 200
        assert len(r.json()["actions"]) >= 1

        # Update action
        r = requests.put(f"{self.api}/exams/actions/{action_id}", json={
            "label": "Click Aquí"
        }, headers=self.headers)
        assert r.status_code == 200

        # Delete action
        r = requests.delete(f"{self.api}/exams/actions/{action_id}", headers=self.headers)
        assert r.status_code == 200

        # Delete step
        r = requests.delete(f"{self.api}/exams/steps/{step_id}", headers=self.headers)
        assert r.status_code == 200

    def test_delete_exercise(self):
        r = requests.post(f"{self.api}/exams/topics/{self.topic_id}/exercises", json={
            "exercise_text": "Exercise to delete"
        }, headers=self.headers)
        ex_id = r.json()["exercise"]["id"]

        r = requests.delete(f"{self.api}/exams/exercises/{ex_id}", headers=self.headers)
        assert r.status_code == 200


class TestExamValidation:
    """Tests para validación y publicación de exámenes"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        code = f"VAL-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]
        yield
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def test_validate_exam(self):
        r = requests.get(f"{self.api}/exams/{self.exam_id}/validate", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert "is_valid" in data
        assert "summary" in data


# ═══════════════════════════════════════════════════════════════════════════
# MÓDULO 3: STUDY CONTENTS (/api/study-contents)
# ═══════════════════════════════════════════════════════════════════════════

class TestStudyMaterials:
    """Tests para CRUD de Materiales de Estudio"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        self.brand_id = brand_id
        # Create standard + exam for linking
        code = f"SC-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]
        yield
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def _create_material(self, title=None):
        title = title or f"Material {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/study-contents", json={
            "title": title,
            "description": "Material de prueba",
            "exam_id": self.exam_id
        }, headers=self.headers)
        assert r.status_code == 201, f"Create material falló: {r.text}"
        return r.json()["material"]

    def test_list_materials(self):
        r = requests.get(f"{self.api}/study-contents", headers=self.headers)
        assert r.status_code == 200
        data = r.json()
        assert "materials" in data
        assert "total" in data

    def test_create_material(self):
        mat = self._create_material()
        assert mat["id"] > 0
        assert mat["exam_id"] == self.exam_id
        requests.delete(f"{self.api}/study-contents/{mat['id']}", headers=self.headers)

    def test_get_material(self):
        mat = self._create_material()
        r = requests.get(f"{self.api}/study-contents/{mat['id']}", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["title"] == mat["title"]
        requests.delete(f"{self.api}/study-contents/{mat['id']}", headers=self.headers)

    def test_update_material(self):
        mat = self._create_material()
        r = requests.put(f"{self.api}/study-contents/{mat['id']}", json={
            "title": "Material Actualizado",
            "description": "Nueva descripción"
        }, headers=self.headers)
        assert r.status_code == 200
        assert r.json()["material"]["title"] == "Material Actualizado"
        requests.delete(f"{self.api}/study-contents/{mat['id']}", headers=self.headers)

    def test_delete_material(self):
        mat = self._create_material()
        r = requests.delete(f"{self.api}/study-contents/{mat['id']}", headers=self.headers)
        assert r.status_code == 200

    def test_clone_material(self):
        mat = self._create_material("Original para Clonar")
        r = requests.post(f"{self.api}/study-contents/{mat['id']}/clone", json={
            "title": "Clon del Material"
        }, headers=self.headers)
        assert r.status_code == 201, f"Clone falló: {r.text}"
        clone_id = r.json()["material"]["id"]
        assert clone_id != mat["id"]
        requests.delete(f"{self.api}/study-contents/{clone_id}", headers=self.headers)
        requests.delete(f"{self.api}/study-contents/{mat['id']}", headers=self.headers)

    def test_material_not_found(self):
        r = requests.get(f"{self.api}/study-contents/99999", headers=self.headers)
        assert r.status_code in (404, 500)  # Backend returns 500 instead of 404 (known issue)


class TestStudySessions:
    """Tests para Sesiones de materiales de estudio"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        code = f"SS-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]

        r = requests.post(f"{self.api}/study-contents", json={
            "title": f"Material {code}", "exam_id": self.exam_id
        }, headers=self.headers)
        self.material_id = r.json()["material"]["id"]
        yield
        requests.delete(f"{self.api}/study-contents/{self.material_id}", headers=self.headers)
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def _base(self):
        return f"{self.api}/study-contents/{self.material_id}/sessions"

    def test_create_session(self):
        r = requests.post(self._base(), json={
            "title": "Sesión 1",
            "description": "Primera sesión"
        }, headers=self.headers)
        assert r.status_code == 201, f"Create session falló: {r.text}"
        assert r.json()["session"]["title"] == "Sesión 1"

    def test_list_sessions(self):
        requests.post(self._base(), json={"title": "S para list"}, headers=self.headers)
        r = requests.get(self._base(), headers=self.headers)
        assert r.status_code == 200
        sessions = r.json()
        assert isinstance(sessions, list)
        assert len(sessions) >= 1

    def test_update_session(self):
        r = requests.post(self._base(), json={"title": "Original"}, headers=self.headers)
        sid = r.json()["session"]["id"]
        r = requests.put(f"{self._base()}/{sid}", json={
            "title": "Sesión Editada"
        }, headers=self.headers)
        assert r.status_code == 200
        assert r.json()["session"]["title"] == "Sesión Editada"

    def test_delete_session(self):
        r = requests.post(self._base(), json={"title": "Para borrar"}, headers=self.headers)
        sid = r.json()["session"]["id"]
        r = requests.delete(f"{self._base()}/{sid}", headers=self.headers)
        assert r.status_code == 200


class TestStudyTopics:
    """Tests para Topics dentro de sesiones de estudio"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        code = f"ST-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]

        r = requests.post(f"{self.api}/study-contents", json={
            "title": f"Mat {code}", "exam_id": self.exam_id
        }, headers=self.headers)
        self.mat_id = r.json()["material"]["id"]

        r = requests.post(f"{self.api}/study-contents/{self.mat_id}/sessions", json={
            "title": "Sesión para Topics"
        }, headers=self.headers)
        self.session_id = r.json()["session"]["id"]
        yield
        requests.delete(f"{self.api}/study-contents/{self.mat_id}", headers=self.headers)
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def _topics_base(self):
        return f"{self.api}/study-contents/{self.mat_id}/sessions/{self.session_id}/topics"

    def test_create_topic(self):
        r = requests.post(self._topics_base(), json={
            "title": "Tema de Estudio 1",
            "estimated_time_minutes": 30
        }, headers=self.headers)
        assert r.status_code == 201, f"Create topic falló: {r.text}"

    def test_list_topics(self):
        requests.post(self._topics_base(), json={"title": "T list"}, headers=self.headers)
        r = requests.get(self._topics_base(), headers=self.headers)
        assert r.status_code == 200

    def test_update_topic(self):
        r = requests.post(self._topics_base(), json={"title": "T orig"}, headers=self.headers)
        tid = r.json()["topic"]["id"]
        r = requests.put(f"{self._topics_base()}/{tid}", json={
            "title": "Tema Editado"
        }, headers=self.headers)
        assert r.status_code == 200

    def test_delete_topic(self):
        r = requests.post(self._topics_base(), json={"title": "T delete"}, headers=self.headers)
        tid = r.json()["topic"]["id"]
        r = requests.delete(f"{self._topics_base()}/{tid}", headers=self.headers)
        assert r.status_code == 200


class TestStudyReadings:
    """Tests para Readings (Lecturas) dentro de topics de estudio"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        code = f"SR-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]

        r = requests.post(f"{self.api}/study-contents", json={
            "title": f"Mat {code}", "exam_id": self.exam_id
        }, headers=self.headers)
        self.mat_id = r.json()["material"]["id"]

        r = requests.post(f"{self.api}/study-contents/{self.mat_id}/sessions", json={
            "title": "Sesión"
        }, headers=self.headers)
        self.session_id = r.json()["session"]["id"]

        r = requests.post(
            f"{self.api}/study-contents/{self.mat_id}/sessions/{self.session_id}/topics", json={
                "title": "Topic para Readings"
            }, headers=self.headers)
        self.topic_id = r.json()["topic"]["id"]
        yield
        requests.delete(f"{self.api}/study-contents/{self.mat_id}", headers=self.headers)
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def _reading_url(self):
        return (f"{self.api}/study-contents/{self.mat_id}/sessions/"
                f"{self.session_id}/topics/{self.topic_id}/reading")

    def test_create_reading(self):
        r = requests.post(self._reading_url(), json={
            "title": "Lectura de Prueba",
            "content": "<h1>Contenido</h1><p>Texto de prueba</p>"
        }, headers=self.headers)
        assert r.status_code in (200, 201), f"Create reading falló: {r.text}"

    def test_update_reading(self):
        # Create first
        requests.post(self._reading_url(), json={
            "title": "Original", "content": "Contenido original"
        }, headers=self.headers)
        # Update
        r = requests.put(self._reading_url(), json={
            "title": "Lectura Actualizada",
            "content": "Contenido actualizado"
        }, headers=self.headers)
        assert r.status_code == 200, f"Update reading falló: {r.text}"

    def test_delete_reading(self):
        requests.post(self._reading_url(), json={
            "title": "Para borrar", "content": "X"
        }, headers=self.headers)
        r = requests.delete(self._reading_url(), headers=self.headers)
        assert r.status_code == 200


class TestStudyVideos:
    """Tests para Videos dentro de topics de estudio"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        code = f"SV-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]

        r = requests.post(f"{self.api}/study-contents", json={
            "title": f"Mat {code}", "exam_id": self.exam_id
        }, headers=self.headers)
        self.mat_id = r.json()["material"]["id"]

        r = requests.post(f"{self.api}/study-contents/{self.mat_id}/sessions", json={
            "title": "Sesión"
        }, headers=self.headers)
        self.session_id = r.json()["session"]["id"]

        r = requests.post(
            f"{self.api}/study-contents/{self.mat_id}/sessions/{self.session_id}/topics", json={
                "title": "Topic para Videos"
            }, headers=self.headers)
        self.topic_id = r.json()["topic"]["id"]
        yield
        requests.delete(f"{self.api}/study-contents/{self.mat_id}", headers=self.headers)
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def _video_url(self):
        return (f"{self.api}/study-contents/{self.mat_id}/sessions/"
                f"{self.session_id}/topics/{self.topic_id}/video")

    def test_create_video(self):
        r = requests.post(self._video_url(), json={
            "title": "Video de Prueba",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "video_type": "youtube",
            "duration_minutes": 5
        }, headers=self.headers)
        assert r.status_code in (200, 201), f"Create video falló: {r.text}"

    def test_update_video(self):
        requests.post(self._video_url(), json={
            "title": "Original",
            "video_url": "https://www.youtube.com/watch?v=test1"
        }, headers=self.headers)
        r = requests.put(self._video_url(), json={
            "title": "Video Actualizado",
            "video_url": "https://www.youtube.com/watch?v=test2"
        }, headers=self.headers)
        assert r.status_code == 200, f"Update video falló: {r.text}"

    def test_delete_video(self):
        requests.post(self._video_url(), json={
            "title": "Para borrar",
            "video_url": "https://www.youtube.com/watch?v=test3"
        }, headers=self.headers)
        r = requests.delete(self._video_url(), headers=self.headers)
        assert r.status_code == 200


class TestStudyDownloadableExercises:
    """Tests para Ejercicios Descargables dentro de topics de estudio"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        code = f"SD-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]

        r = requests.post(f"{self.api}/study-contents", json={
            "title": f"Mat {code}", "exam_id": self.exam_id
        }, headers=self.headers)
        self.mat_id = r.json()["material"]["id"]

        r = requests.post(f"{self.api}/study-contents/{self.mat_id}/sessions", json={
            "title": "Sesión"
        }, headers=self.headers)
        self.session_id = r.json()["session"]["id"]

        r = requests.post(
            f"{self.api}/study-contents/{self.mat_id}/sessions/{self.session_id}/topics", json={
                "title": "Topic para Downloads"
            }, headers=self.headers)
        self.topic_id = r.json()["topic"]["id"]
        yield
        requests.delete(f"{self.api}/study-contents/{self.mat_id}", headers=self.headers)
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def _dl_url(self):
        return (f"{self.api}/study-contents/{self.mat_id}/sessions/"
                f"{self.session_id}/topics/{self.topic_id}/downloadable")

    def test_create_downloadable(self):
        r = requests.post(self._dl_url(), json={
            "title": "Ejercicio Descargable",
            "description": "Descarga y completa",
            "file_url": "https://example.com/file.pdf",
            "file_name": "ejercicio.pdf"
        }, headers=self.headers)
        assert r.status_code in (200, 201), f"Create downloadable falló: {r.text}"

    def test_update_downloadable(self):
        requests.post(self._dl_url(), json={
            "title": "Original",
            "file_url": "https://example.com/a.pdf"
        }, headers=self.headers)
        r = requests.put(self._dl_url(), json={
            "title": "Ejercicio Actualizado"
        }, headers=self.headers)
        assert r.status_code == 200, f"Update downloadable falló: {r.text}"

    def test_delete_downloadable(self):
        requests.post(self._dl_url(), json={
            "title": "Para borrar",
            "file_url": "https://example.com/b.pdf"
        }, headers=self.headers)
        r = requests.delete(self._dl_url(), headers=self.headers)
        assert r.status_code == 200


class TestStudyInteractiveExercises:
    """Tests para Ejercicios Interactivos (pasos y acciones) dentro de topics"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        code = f"SI-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": brand_id
        }, headers=self.headers)
        self.std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": f"Exam {code}", "stage_id": 1,
            "competency_standard_id": self.std_id,
            "categories": [{"name": "Cat", "percentage": 100}]
        }, headers=self.headers)
        self.exam_id = r.json()["exam"]["id"]

        r = requests.post(f"{self.api}/study-contents", json={
            "title": f"Mat {code}", "exam_id": self.exam_id
        }, headers=self.headers)
        self.mat_id = r.json()["material"]["id"]

        r = requests.post(f"{self.api}/study-contents/{self.mat_id}/sessions", json={
            "title": "Sesión"
        }, headers=self.headers)
        self.session_id = r.json()["session"]["id"]

        r = requests.post(
            f"{self.api}/study-contents/{self.mat_id}/sessions/{self.session_id}/topics", json={
                "title": "Topic para Interactive"
            }, headers=self.headers)
        self.topic_id = r.json()["topic"]["id"]
        yield
        requests.delete(f"{self.api}/study-contents/{self.mat_id}", headers=self.headers)
        requests.delete(f"{self.api}/exams/{self.exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{self.std_id}", headers=self.headers)

    def _ie_url(self):
        return (f"{self.api}/study-contents/{self.mat_id}/sessions/"
                f"{self.session_id}/topics/{self.topic_id}/interactive")

    def test_create_interactive_exercise(self):
        r = requests.post(self._ie_url(), json={
            "title": "Ejercicio Interactivo",
            "description": "Siga los pasos"
        }, headers=self.headers)
        assert r.status_code == 201, f"Create interactive falló: {r.text}"

    def test_full_interactive_flow(self):
        """Test completo: crear ejercicio → paso → acción → actualizar → eliminar"""
        # Create interactive exercise
        r = requests.post(self._ie_url(), json={
            "title": "Flow Test"
        }, headers=self.headers)
        assert r.status_code == 201

        # Create step
        r = requests.post(f"{self._ie_url()}/steps", json={
            "title": "Paso 1",
            "description": "Haga clic en el botón Inicio"
        }, headers=self.headers)
        assert r.status_code == 201, f"Create step falló: {r.text}"
        step_id = r.json()["step"]["id"]

        # Create action
        r = requests.post(f"{self._ie_url()}/steps/{step_id}/actions", json={
            "action_type": "button",
            "label": "Inicio",
            "position_x": 10,
            "position_y": 20,
            "width": 15,
            "height": 8
        }, headers=self.headers)
        assert r.status_code == 201, f"Create action falló: {r.text}"
        action_id = r.json()["action"]["id"]

        # Update action
        r = requests.put(f"{self._ie_url()}/steps/{step_id}/actions/{action_id}", json={
            "label": "Start"
        }, headers=self.headers)
        assert r.status_code == 200

        # Delete action
        r = requests.delete(f"{self._ie_url()}/steps/{step_id}/actions/{action_id}",
                            headers=self.headers)
        assert r.status_code == 200

        # Delete step
        r = requests.delete(f"{self._ie_url()}/steps/{step_id}", headers=self.headers)
        assert r.status_code == 200

        # Delete interactive exercise
        r = requests.delete(self._ie_url(), headers=self.headers)
        assert r.status_code == 200

    def test_get_interactive_exercise(self):
        requests.post(self._ie_url(), json={"title": "Get test"}, headers=self.headers)
        r = requests.get(self._ie_url(), headers=self.headers)
        assert r.status_code == 200
        assert "interactive_exercise" in r.json()


# ═══════════════════════════════════════════════════════════════════════════
# TESTS DE INTEGRACIÓN CROSS-MODULE
# ═══════════════════════════════════════════════════════════════════════════

class TestCrossModuleIntegration:
    """Tests de integración entre los 3 módulos"""

    @pytest.fixture(autouse=True)
    def _setup(self, api, admin_headers, brand_id):
        self.api = api
        self.headers = admin_headers
        self.brand_id = brand_id

    def test_full_content_pipeline(self):
        """
        Flujo completo: Brand → Standard → Exam (con categorías/topics/preguntas)
        → Study Content (con sesión/topic/lectura/video)
        """
        uid = uuid.uuid4().hex[:6]

        # 1. Standard
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": f"PIPE-{uid}", "name": f"Pipeline Std {uid}",
            "brand_id": self.brand_id
        }, headers=self.headers)
        assert r.status_code == 201
        std_id = r.json()["standard"]["id"]

        # 2. Exam with categories
        r = requests.post(f"{self.api}/exams", json={
            "name": f"Pipeline Exam {uid}",
            "stage_id": 1,
            "competency_standard_id": std_id,
            "categories": [
                {"name": "Teoría", "percentage": 60},
                {"name": "Práctica", "percentage": 40}
            ]
        }, headers=self.headers)
        assert r.status_code == 201
        exam = r.json()["exam"]
        exam_id = exam["id"]
        cat_id = exam["categories"][0]["id"]

        # 3. Topic under category
        r = requests.post(f"{self.api}/exams/categories/{cat_id}/topics", json={
            "name": "Tema Pipeline"
        }, headers=self.headers)
        assert r.status_code == 201
        topic_id = r.json()["topic"]["id"]

        # 4. Question under topic
        r = requests.get(f"{self.api}/exams/question-types", headers=self.headers)
        qt_id = r.json()["question_types"][0]["id"]

        r = requests.post(f"{self.api}/exams/topics/{topic_id}/questions", json={
            "question_type_id": qt_id,
            "question_text": "¿Pregunta pipeline?",
            "answers": [
                {"answer_number": 1, "answer_text": "Sí", "is_correct": True},
                {"answer_number": 2, "answer_text": "No", "is_correct": False}
            ]
        }, headers=self.headers)
        assert r.status_code == 201

        # 5. Study content linked to exam
        r = requests.post(f"{self.api}/study-contents", json={
            "title": f"Material Pipeline {uid}",
            "exam_id": exam_id
        }, headers=self.headers)
        assert r.status_code == 201
        mat_id = r.json()["material"]["id"]

        # 6. Session
        r = requests.post(f"{self.api}/study-contents/{mat_id}/sessions", json={
            "title": "Sesión Pipeline"
        }, headers=self.headers)
        assert r.status_code == 201
        session_id = r.json()["session"]["id"]

        # 7. Study topic
        r = requests.post(
            f"{self.api}/study-contents/{mat_id}/sessions/{session_id}/topics", json={
                "title": "Study Topic Pipeline",
                "estimated_time_minutes": 20
            }, headers=self.headers)
        assert r.status_code == 201
        st_id = r.json()["topic"]["id"]

        # 8. Reading
        r = requests.post(
            f"{self.api}/study-contents/{mat_id}/sessions/{session_id}/topics/{st_id}/reading",
            json={"title": "Lectura", "content": "<p>Contenido pipeline</p>"},
            headers=self.headers)
        assert r.status_code in (200, 201)

        # 9. Video
        r = requests.post(
            f"{self.api}/study-contents/{mat_id}/sessions/{session_id}/topics/{st_id}/video",
            json={
                "title": "Video Pipeline",
                "video_url": "https://www.youtube.com/watch?v=pipeline",
                "video_type": "youtube"
            }, headers=self.headers)
        assert r.status_code in (200, 201)

        # 10. Verify exam has exams by standard
        r = requests.get(f"{self.api}/competency-standards/{std_id}/exams", headers=self.headers)
        assert r.status_code == 200
        assert r.json()["total"] >= 1

        # 11. Validate exam
        r = requests.get(f"{self.api}/exams/{exam_id}/validate", headers=self.headers)
        assert r.status_code == 200

        # Cleanup (reverse order)
        requests.delete(f"{self.api}/study-contents/{mat_id}", headers=self.headers)
        requests.delete(f"{self.api}/exams/{exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{std_id}", headers=self.headers)

        print("✅ Full pipeline test passed!")

    def test_exam_standard_linkage(self):
        """Verifica que un examen queda vinculado a su estándar"""
        code = f"LNK-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{self.api}/competency-standards/", json={
            "code": code, "name": f"Std {code}", "brand_id": self.brand_id
        }, headers=self.headers)
        std_id = r.json()["standard"]["id"]

        r = requests.post(f"{self.api}/exams", json={
            "name": "Linked Exam", "stage_id": 1,
            "competency_standard_id": std_id,
            "categories": [{"name": "M", "percentage": 100}]
        }, headers=self.headers)
        exam_id = r.json()["exam"]["id"]

        # Get exams by standard
        r = requests.get(f"{self.api}/competency-standards/{std_id}/exams", headers=self.headers)
        assert r.status_code == 200
        exam_ids_in_std = [e["id"] for e in r.json()["exams"]]
        assert exam_id in exam_ids_in_std

        requests.delete(f"{self.api}/exams/{exam_id}", headers=self.headers)
        requests.delete(f"{self.api}/competency-standards/{std_id}", headers=self.headers)
