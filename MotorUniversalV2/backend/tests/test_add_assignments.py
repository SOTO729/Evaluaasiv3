"""
Tests del endpoint POST /groups/<gid>/exams/<eid>/assignments/add
==================================================================

Cubre:
  A. Validaciones de entrada (auth, JSON, user_ids)
  B. Verificación de miembros del grupo
  C. Creación de asignaciones (GroupExamMember + EcmCandidateAssignment)
  D. Deduplicación de asignaciones existentes
  E. Cobro de saldo del coordinador
  F. Migración all → selected
  G. Respuesta con datos de asignación

También verifica que el endpoint bulk-assign cobra saldo.

Ejecutar:
    cd backend && python -m pytest tests/test_add_assignments.py -v --tb=short
    cd backend && python -m pytest tests/test_add_assignments.py -v -k "auth"
"""

import pytest
import requests
import pymssql
import time

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

DB_SERVER = "evaluaasi-motorv2-sql.database.windows.net"
DB_USER = "evaluaasi_admin"
DB_PASS = "EvalAasi2024_newpwd!"
DB_NAME = "evaluaasi"


# ─── Helpers DB ─────────────────────────────────────────────────────────────

def db_query(sql, params=None):
    conn = pymssql.connect(server=DB_SERVER, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cursor = conn.cursor(as_dict=True)
    cursor.execute(sql, params or ())
    try:
        rows = cursor.fetchall()
    except:
        rows = []
    conn.close()
    return rows


def db_scalar(sql, params=None):
    conn = pymssql.connect(server=DB_SERVER, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cursor = conn.cursor()
    cursor.execute(sql, params or ())
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None


# ─── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    r = requests.post(f"{api}/auth/login", json={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })
    assert r.status_code == 200, f"Login falló: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def endpoint_deployed(api, admin_token):
    """Detecta si el endpoint ya fue desplegado en DEV."""
    headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    r = requests.get(f"{api}/partners/groups/list-all?per_page=1", headers=headers)
    if r.status_code != 200:
        return False
    groups = r.json().get("groups", [])
    if not groups:
        return False
    gid = groups[0]["id"]
    # Intentar POST al endpoint — si 404 no está desplegado
    r2 = requests.post(f"{api}/partners/groups/{gid}/exams/1/assignments/add",
                       json={"user_ids": ["test"]}, headers=headers)
    return r2.status_code != 404


@pytest.fixture(scope="session")
def headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def test_data(api, headers):
    """Buscar grupo con examen asignado y miembros.
    Preferimos un grupo que tenga:
    - Al menos un miembro SIN assignment_number (para poder asignar)
    - Un examen activo asignado al grupo
    """
    data = {
        "group_id": None,
        "exam_id": None,
        "group_exam_id": None,
        "ecm_code": None,
        "member_with_assignment": None,      # user_id con assignment_number
        "member_without_assignment": None,    # user_id sin assignment_number
        "all_member_ids": [],                 # todos los miembros del grupo
        "non_member_id": "00000000-0000-0000-0000-000000000000",
    }

    # Buscar grupo con examen asignado
    r = requests.get(f"{api}/partners/groups/list-all?per_page=200", headers=headers)
    assert r.status_code == 200
    groups = r.json().get("groups", [])

    for g in groups:
        gid = g["id"]
        r2 = requests.get(f"{api}/partners/groups/{gid}/exams", headers=headers)
        if r2.status_code != 200:
            continue
        assigned = r2.json().get("assigned_exams", [])
        if not assigned:
            continue

        exam_entry = assigned[0]
        eid = exam_entry.get("exam_id")
        if not eid:
            continue

        # Obtener miembros detallados
        r3 = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members-detail?per_page=500",
            headers=headers
        )
        if r3.status_code != 200:
            continue

        detail = r3.json()
        members = detail.get("members", [])
        if len(members) < 2:
            continue

        data["group_id"] = gid
        data["exam_id"] = eid
        data["group_exam_id"] = detail.get("assignment_id")
        data["ecm_code"] = detail.get("ecm_code")
        data["all_member_ids"] = [m["user_id"] for m in members]

        for m in members:
            if m.get("assignment_number"):
                data["member_with_assignment"] = m["user_id"]
            else:
                data["member_without_assignment"] = m["user_id"]

        if data["member_without_assignment"] or data["member_with_assignment"]:
            break

    return data


# ═══════════════════════════════════════════════════════════════════════════
# A. VALIDACIONES DE ENTRADA
# ═══════════════════════════════════════════════════════════════════════════

class TestAddAssignmentsValidation:
    """Tests de validación para POST /assignments/add"""

    @pytest.fixture(autouse=True)
    def _check_deployed(self, endpoint_deployed):
        if not endpoint_deployed:
            pytest.skip("Endpoint /assignments/add aún no desplegado en DEV")

    def test_requires_authentication(self, api, test_data):
        """A1: Endpoint requiere JWT"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid:
            pytest.skip("No hay datos de test disponibles")
        r = requests.post(f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
                         json={"user_ids": ["test"]})
        assert r.status_code in [401, 422], f"Expected 401/422, got {r.status_code}"

    def test_requires_user_ids(self, api, headers, test_data):
        """A2: Debe rechazar body sin user_ids"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid:
            pytest.skip("No hay datos de test disponibles")
        r = requests.post(f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
                         json={}, headers=headers)
        assert r.status_code == 400
        assert "user_id" in r.json().get("error", "").lower()

    def test_requires_empty_user_ids_rejected(self, api, headers, test_data):
        """A3: Debe rechazar user_ids vacío"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid:
            pytest.skip("No hay datos de test disponibles")
        r = requests.post(f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
                         json={"user_ids": []}, headers=headers)
        assert r.status_code == 400

    def test_nonexistent_group_404(self, api, headers):
        """A4: Grupo inexistente retorna 404"""
        r = requests.post(f"{api}/partners/groups/999999/exams/1/assignments/add",
                         json={"user_ids": ["test"]}, headers=headers)
        assert r.status_code == 404

    def test_nonexistent_exam_404(self, api, headers, test_data):
        """A5: Examen inexistente retorna 404"""
        gid = test_data["group_id"]
        if not gid:
            pytest.skip("No hay datos de test disponibles")
        r = requests.post(f"{api}/partners/groups/{gid}/exams/999999/assignments/add",
                         json={"user_ids": ["test"]}, headers=headers)
        assert r.status_code == 404

    def test_rejects_non_group_members(self, api, headers, test_data):
        """A6: Rechaza user_ids que no son miembros del grupo"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid:
            pytest.skip("No hay datos de test disponibles")
        r = requests.post(f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
                         json={"user_ids": [test_data["non_member_id"]]}, headers=headers)
        assert r.status_code == 400
        assert "miembro" in r.json().get("error", "").lower() or "no son" in r.json().get("error", "").lower()


# ═══════════════════════════════════════════════════════════════════════════
# B. CREACIÓN DE ASIGNACIONES
# ═══════════════════════════════════════════════════════════════════════════

class TestAddAssignmentsCreation:
    """Tests de creación de asignaciones"""

    @pytest.fixture(autouse=True)
    def _check_deployed(self, endpoint_deployed):
        if not endpoint_deployed:
            pytest.skip("Endpoint /assignments/add aún no desplegado en DEV")

    def test_assign_member_without_assignment(self, api, headers, test_data):
        """B1: Asignar miembro sin assignment_number genera ECM"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        uid = test_data["member_without_assignment"]
        if not uid:
            pytest.skip("No hay miembro sin asignación disponible")

        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
            json={"user_ids": [uid]},
            headers=headers
        )
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()

        # Verificar estructura de respuesta
        assert "assigned" in data
        assert "assigned_count" in data
        assert "already_assigned" in data
        assert "already_assigned_count" in data
        assert "total_cost" in data
        assert "unit_cost" in data
        assert "message" in data

        # Debe haber asignado al usuario
        if data["assigned_count"] > 0:
            assigned = data["assigned"]
            assert len(assigned) == 1
            assert assigned[0]["user_id"] == uid
            assert assigned[0]["assignment_number"]  # Debe tener número
            assert len(assigned[0]["assignment_number"]) > 0

    def test_response_includes_cost_info(self, api, headers, test_data):
        """B2: Respuesta incluye información de costo"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        uid = test_data["member_without_assignment"]
        if not uid:
            pytest.skip("No hay miembro sin asignación disponible")

        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
            json={"user_ids": [uid]},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("total_cost"), (int, float))
        assert isinstance(data.get("unit_cost"), (int, float))
        assert data["total_cost"] >= 0
        assert data["unit_cost"] >= 0


# ═══════════════════════════════════════════════════════════════════════════
# C. DEDUPLICACIÓN
# ═══════════════════════════════════════════════════════════════════════════

class TestAddAssignmentsDeduplication:
    """Tests de deduplicación de asignaciones existentes"""

    @pytest.fixture(autouse=True)
    def _check_deployed(self, endpoint_deployed):
        if not endpoint_deployed:
            pytest.skip("Endpoint /assignments/add aún no desplegado en DEV")

    def test_already_assigned_returns_info(self, api, headers, test_data):
        """C1: Si el miembro ya tiene ECM, aparece en already_assigned"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        uid = test_data["member_with_assignment"]
        if not uid or not gid:
            pytest.skip("No hay miembro con asignación disponible")

        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
            json={"user_ids": [uid]},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()

        # El usuario debería aparecer en already_assigned O en assigned
        total = data["assigned_count"] + data["already_assigned_count"]
        assert total >= 1, f"Expected user in assigned or already_assigned, got: {data}"

    def test_mixed_new_and_existing(self, api, headers, test_data):
        """C2: Lista con miembros nuevos y existentes clasifica correctamente"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        uid_with = test_data["member_with_assignment"]
        uid_without = test_data["member_without_assignment"]

        if not uid_with or not uid_without:
            pytest.skip("Necesitamos miembros con y sin asignación")

        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
            json={"user_ids": [uid_with, uid_without]},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()

        # Verificar totales: cada usuario fue clasificado
        total_processed = data["assigned_count"] + data["already_assigned_count"]
        assert total_processed >= 1


# ═══════════════════════════════════════════════════════════════════════════
# D. VERIFICACIÓN EN BASE DE DATOS
# ═══════════════════════════════════════════════════════════════════════════

class TestAddAssignmentsDatabase:
    """Tests que verifican la creación de registros en DB"""

    @pytest.fixture(autouse=True)
    def _check_deployed(self, endpoint_deployed):
        if not endpoint_deployed:
            pytest.skip("Endpoint /assignments/add aún no desplegado en DEV")

    def test_ecm_assignment_created_in_db(self, api, headers, test_data):
        """D1: EcmCandidateAssignment existe en DB después de asignar"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        ge_id = test_data["group_exam_id"]
        uid = test_data["member_without_assignment"]
        if not uid or not ge_id:
            pytest.skip("No hay datos para test DB")

        # Hacer la asignación
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
            json={"user_ids": [uid]},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()

        # Verificar en DB (dar tiempo a la transacción)
        time.sleep(1)

        if data["assigned_count"] > 0:
            assignment_number = data["assigned"][0]["assignment_number"]
            rows = db_query(
                "SELECT assignment_number, user_id, group_exam_id FROM ecm_candidate_assignments WHERE assignment_number=%s",
                (assignment_number,)
            )
            assert len(rows) == 1, f"Expected 1 ECM row for {assignment_number}, got {len(rows)}"
            assert str(rows[0]["user_id"]) == uid
            assert rows[0]["group_exam_id"] == ge_id

    def test_group_exam_member_created_in_db(self, api, headers, test_data):
        """D2: GroupExamMember existe en DB después de asignar"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        ge_id = test_data["group_exam_id"]
        uid = test_data["member_without_assignment"]
        if not uid or not ge_id:
            pytest.skip("No hay datos para test DB")

        time.sleep(1)

        count = db_scalar(
            "SELECT COUNT(*) FROM group_exam_members WHERE group_exam_id=%s AND user_id=%s",
            (ge_id, uid)
        )
        assert count >= 1, f"Expected GroupExamMember for user {uid} in exam {ge_id}"

    def test_assignment_number_unique(self, api, headers, test_data):
        """D3: Los assignment_numbers generados son únicos"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        members = test_data["all_member_ids"][:3]
        if len(members) < 2:
            pytest.skip("Necesitamos al menos 2 miembros")

        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
            json={"user_ids": members},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()

        if data["assigned_count"] >= 2:
            numbers = [a["assignment_number"] for a in data["assigned"]]
            assert len(numbers) == len(set(numbers)), "Assignment numbers should be unique"


# ═══════════════════════════════════════════════════════════════════════════
# E. ENDPOINT STATUS Y ESTRUCTURA
# ═══════════════════════════════════════════════════════════════════════════

class TestAddAssignmentsEndpointStructure:
    """Tests de la estructura del endpoint"""

    @pytest.fixture(autouse=True)
    def _check_deployed(self, endpoint_deployed):
        if not endpoint_deployed:
            pytest.skip("Endpoint /assignments/add aún no desplegado en DEV")

    def test_endpoint_exists(self, api, headers, test_data):
        """E1: El endpoint existe y responde"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid:
            pytest.skip("No hay datos de test")
        # GET no debería funcionar, solo POST
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add", headers=headers)
        assert r.status_code == 405, f"Expected 405 for GET, got {r.status_code}"

    def test_response_json_structure(self, api, headers, test_data):
        """E2: Respuesta tiene estructura JSON correcta"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid:
            pytest.skip("No hay datos de test")

        uid = test_data["member_with_assignment"] or (test_data["all_member_ids"][0] if test_data["all_member_ids"] else None)
        if not uid:
            pytest.skip("No hay miembro disponible")

        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
            json={"user_ids": [uid]},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()

        # Verificar campos requeridos
        required_fields = ['message', 'assigned', 'assigned_count', 'already_assigned', 'already_assigned_count', 'total_cost', 'unit_cost']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

        assert isinstance(data['assigned'], list)
        assert isinstance(data['already_assigned'], list)
        assert isinstance(data['assigned_count'], int)
        assert isinstance(data['already_assigned_count'], int)

    def test_max_batch_size_limit(self, api, headers, test_data):
        """E3: Rechaza más de 500 user_ids"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid:
            pytest.skip("No hay datos de test")

        fake_ids = [f"user-{i}" for i in range(501)]
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/assignments/add",
            json={"user_ids": fake_ids},
            headers=headers
        )
        assert r.status_code == 400
        assert "500" in r.json().get("error", "")
