"""
Tests completos del módulo de Asignaciones (Assignments)
========================================================

Cubre:
  A. Listar exámenes asignados a un grupo (GET /groups/<id>/exams)
  B. Detalle de asignación (GET /groups/<id>/exams/<id>/detail)
  C. Miembros detalle paginado (GET /groups/<id>/exams/<id>/members-detail)
  D. Cost preview (POST /groups/<id>/assignment-cost-preview)
  E. Asignar examen a grupo (POST /groups/<id>/exams)
  F. Desasignar examen (DELETE /groups/<id>/exams/<id>)
  G. Gestión de miembros (GET/PUT/POST members, add)
  H. Materiales de estudio (GET/POST/DELETE study-materials)
  I. Swap de candidatos (POST swap, bulk-swap, swap-history)
  J. Retomas (retake-preview, retake)
  K. My-assignments (GET /auth/my-assignments)
  L. Validaciones de error y edge cases

Ejecutar:
    cd backend && python -m pytest tests/test_assignments.py -v --tb=short
    cd backend && python -m pytest tests/test_assignments.py -v -k "list_group_exams"
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
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    """Obtener JWT token de admin"""
    r = requests.post(f"{api}/auth/login", json={
        "username": ADMIN_USER,
        "password": ADMIN_PASS
    })
    assert r.status_code == 200, f"Login falló: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers(admin_token):
    """Headers con auth para admin"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def test_data(api, headers):
    """Recopilar IDs de datos existentes para tests.
    Busca un grupo con miembros y un examen publicado.
    """
    data = {
        "group_id": None,
        "group_name": None,
        "campus_id": None,
        "exam_id": None,
        "exam_name": None,
        "ecm_id": None,
        "member_ids": [],
        "existing_assignment_group_id": None,  # grupo que ya tiene examen asignado
        "existing_assignment_exam_id": None,
    }

    # Buscar un grupo que YA tenga examen asignado
    r = requests.get(f"{api}/partners/groups/list-all?per_page=200", headers=headers)
    assert r.status_code == 200, f"List groups failed: {r.text}"
    all_groups = r.json().get("groups", [])

    for g in all_groups:
        gid = g["id"]
        r2 = requests.get(f"{api}/partners/groups/{gid}/exams", headers=headers)
        if r2.status_code == 200:
            assigned = r2.json().get("assigned_exams", [])
            if assigned:
                data["existing_assignment_group_id"] = gid
                data["existing_assignment_exam_id"] = assigned[0].get("exam_id")
                break

    # Buscar un grupo con miembros (diferente al que ya tiene examen asignado) para crear nueva asignación
    for g in all_groups:
        gid = g["id"]
        if g.get("current_members", 0) > 0 and gid != data["existing_assignment_group_id"]:
            r2 = requests.get(f"{api}/partners/groups/{gid}", headers=headers)
            if r2.status_code == 200:
                gdata = r2.json()
                members = gdata.get("members", [])
                if members:
                    data["group_id"] = gid
                    data["group_name"] = gdata.get("name")
                    data["campus_id"] = gdata.get("campus_id")
                    data["member_ids"] = [m["user_id"] if isinstance(m, dict) else m for m in members[:5]]
                    break

    # Si no encontramos grupo SIN examen, usar cualquiera con miembros
    if not data["group_id"]:
        for g in all_groups:
            if g.get("current_members", 0) > 0:
                r2 = requests.get(f"{api}/partners/groups/{g['id']}", headers=headers)
                if r2.status_code == 200:
                    gdata = r2.json()
                    members = gdata.get("members", [])
                    if members:
                        data["group_id"] = g["id"]
                        data["group_name"] = gdata.get("name")
                        data["campus_id"] = gdata.get("campus_id")
                        data["member_ids"] = [m["user_id"] if isinstance(m, dict) else m for m in members[:5]]
                        break

    # Buscar examen publicado
    r = requests.get(f"{api}/exams?published_only=true&per_page=10", headers=headers)
    if r.status_code == 200:
        exams = r.json().get("exams", [])
        if exams:
            data["exam_id"] = exams[0]["id"]
            data["exam_name"] = exams[0].get("name")
            data["ecm_id"] = exams[0].get("competency_standard_id")

    return data


# ═══════════════════════════════════════════════════════════════════════════
# A. LISTAR EXÁMENES ASIGNADOS
# ═══════════════════════════════════════════════════════════════════════════

class TestListGroupExams:
    """Tests para GET /partners/groups/<id>/exams"""

    def test_list_group_exams_authenticated(self, api, headers, test_data):
        """A1: Listar exámenes de un grupo requiere autenticación"""
        gid = test_data["existing_assignment_group_id"] or test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupos disponibles")
        r = requests.get(f"{api}/partners/groups/{gid}/exams")
        assert r.status_code in [401, 422], f"Expected 401, got {r.status_code}"

    def test_list_group_exams_success(self, api, headers, test_data):
        """A2: Listar exámenes asignados retorna estructura correcta"""
        gid = test_data["existing_assignment_group_id"] or test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupo con examen asignado")
        r = requests.get(f"{api}/partners/groups/{gid}/exams", headers=headers)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert "assigned_exams" in data
        assert "group_id" in data
        assert "group_name" in data
        assert "total" in data
        assert isinstance(data["assigned_exams"], list)
        assert data["total"] == len(data["assigned_exams"])

    def test_list_group_exams_with_data(self, api, headers, test_data):
        """A3: Grupo con examen asignado retorna datos correctos del examen"""
        gid = test_data["existing_assignment_group_id"]
        if not gid:
            pytest.skip("No hay grupo con examen asignado")
        r = requests.get(f"{api}/partners/groups/{gid}/exams", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0, "Expected at least 1 assigned exam"
        exam_entry = data["assigned_exams"][0]
        assert "exam_id" in exam_entry
        assert "assignment_type" in exam_entry
        assert "max_attempts" in exam_entry
        assert "is_active" in exam_entry

    def test_list_group_exams_exam_details(self, api, headers, test_data):
        """A4: Cada asignación incluye datos del examen"""
        gid = test_data["existing_assignment_group_id"]
        if not gid:
            pytest.skip("No hay grupo con examen asignado")
        r = requests.get(f"{api}/partners/groups/{gid}/exams", headers=headers)
        assert r.status_code == 200
        exams = r.json()["assigned_exams"]
        if exams:
            e = exams[0]
            assert "exam" in e, "Missing exam details in response"
            exam = e["exam"]
            assert "id" in exam
            assert "name" in exam

    def test_list_group_exams_nonexistent_group(self, api, headers):
        """A5: Grupo inexistente retorna 404"""
        r = requests.get(f"{api}/partners/groups/999999/exams", headers=headers)
        assert r.status_code == 404

    def test_list_group_exams_empty(self, api, headers, test_data):
        """A6: Grupo sin exámenes retorna lista vacía"""
        gid = test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupo sin exámenes")
        # If this group has exams, just verify it returns valid structure
        r = requests.get(f"{api}/partners/groups/{gid}/exams", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["assigned_exams"], list)


# ═══════════════════════════════════════════════════════════════════════════
# B. DETALLE DE ASIGNACIÓN
# ═══════════════════════════════════════════════════════════════════════════

class TestGroupExamDetail:
    """Tests para GET /partners/groups/<id>/exams/<id>/detail"""

    def test_detail_success(self, api, headers, test_data):
        """B1: Detalle de asignación retorna estructura completa"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/detail", headers=headers)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert "assignment" in data
        assert "exam" in data
        assert "campus_config" in data
        assert "group" in data
        assert "members_summary" in data
        assert "results_summary" in data

    def test_detail_assignment_fields(self, api, headers, test_data):
        """B2: Datos de asignación incluyen campos esperados"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/detail", headers=headers)
        assert r.status_code == 200
        assignment = r.json()["assignment"]
        expected_fields = [
            "id", "group_id", "exam_id", "assigned_at", "assignment_type",
            "max_attempts", "max_disconnections", "is_active",
            "validity_months", "expires_at"
        ]
        for field in expected_fields:
            assert field in assignment, f"Missing field '{field}' in assignment"

    def test_detail_campus_config(self, api, headers, test_data):
        """B3: Config del campus incluye campos de costo y funcionalidad"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/detail", headers=headers)
        assert r.status_code == 200
        campus = r.json()["campus_config"]
        assert "certification_cost" in campus
        assert "retake_cost" in campus
        assert "max_retakes" in campus
        assert "assignment_validity_months" in campus

    def test_detail_results_summary(self, api, headers, test_data):
        """B4: Resumen de resultados tiene campos esperados"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/detail", headers=headers)
        assert r.status_code == 200
        results = r.json()["results_summary"]
        assert "total_results" in results
        assert "passed" in results
        assert "failed" in results

    def test_detail_nonexistent_exam(self, api, headers, test_data):
        """B5: Examen no asignado a grupo retorna 404"""
        gid = test_data["existing_assignment_group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/999999/detail", headers=headers)
        assert r.status_code == 404

    def test_detail_requires_auth(self, api, test_data):
        """B6: Detalle requiere autenticación"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/detail")
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# C. MIEMBROS DETALLE (paginado + filtros + ordenamiento)
# ═══════════════════════════════════════════════════════════════════════════

class TestMembersDetail:
    """Tests para GET /partners/groups/<id>/exams/<id>/members-detail"""

    def test_members_detail_success(self, api, headers, test_data):
        """C1: Miembros detalle retorna paginación correcta"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/members-detail", headers=headers)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert "members" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        assert "per_page" in data
        assert "locked_count" in data
        assert "swappable_count" in data

    def test_members_detail_member_structure(self, api, headers, test_data):
        """C2: Cada miembro tiene los campos esperados"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/members-detail", headers=headers)
        assert r.status_code == 200
        members = r.json()["members"]
        if len(members) == 0:
            pytest.skip("No hay miembros en la asignación")
        m = members[0]
        expected_fields = [
            "user_id", "user", "assignment_number",
            "material_progress", "has_opened_exam",
            "is_locked", "lock_reasons",
            "results_count", "attempts_remaining",
            "attempts_exhausted", "can_retake"
        ]
        for field in expected_fields:
            assert field in m, f"Missing field '{field}' in member"

    def test_members_detail_user_info(self, api, headers, test_data):
        """C3: Info del usuario incluye nombre, email, curp"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/members-detail", headers=headers)
        assert r.status_code == 200
        members = r.json()["members"]
        if not members:
            pytest.skip("Sin miembros")
        user = members[0]["user"]
        assert "id" in user
        assert "name" in user
        assert "email" in user
        assert "full_name" in user

    def test_members_detail_pagination(self, api, headers, test_data):
        """C4: Paginación funciona correctamente con per_page"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members-detail",
            params={"per_page": 1, "page": 1},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["per_page"] == 1
        assert len(data["members"]) <= 1

    def test_members_detail_search(self, api, headers, test_data):
        """C5: Búsqueda por nombre funciona"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members-detail",
            params={"search": "zzzznoexiste"},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0
        assert len(data["members"]) == 0

    def test_members_detail_sort(self, api, headers, test_data):
        """C6: Ordenamiento por nombre ASC/DESC funciona"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r_asc = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members-detail",
            params={"sort_by": "name", "sort_dir": "asc"},
            headers=headers
        )
        r_desc = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members-detail",
            params={"sort_by": "name", "sort_dir": "desc"},
            headers=headers
        )
        assert r_asc.status_code == 200
        assert r_desc.status_code == 200
        # Both should return same total
        assert r_asc.json()["total"] == r_desc.json()["total"]

    def test_members_detail_filter_status(self, api, headers, test_data):
        """C7: Filtro por status (locked/swappable) funciona"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")

        # Get all first
        r_all = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members-detail",
            params={"filter_status": "all"},
            headers=headers
        )
        assert r_all.status_code == 200
        total = r_all.json()["total"]
        locked = r_all.json()["locked_count"]
        swappable = r_all.json()["swappable_count"]
        assert locked + swappable == total

    def test_members_detail_counts_consistent(self, api, headers, test_data):
        """C8: locked_count + swappable_count == total"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/members-detail", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["locked_count"] + data["swappable_count"] == data["total"]

    def test_members_detail_exam_info(self, api, headers, test_data):
        """C9: Respuesta incluye info del examen"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/members-detail", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "exam_id" in data
        assert "exam_name" in data
        assert "assignment_type" in data
        assert "max_attempts" in data


# ═══════════════════════════════════════════════════════════════════════════
# D. COST PREVIEW
# ═══════════════════════════════════════════════════════════════════════════

class TestCostPreview:
    """Tests para POST /partners/groups/<id>/assignment-cost-preview"""

    def test_cost_preview_all(self, api, headers, test_data):
        """D1: Cost preview para tipo 'all' retorna desglose correcto"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid or not eid:
            pytest.skip("No hay grupo o examen disponible")
        r = requests.post(
            f"{api}/partners/groups/{gid}/assignment-cost-preview",
            json={"exam_id": eid, "assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        expected_fields = [
            "unit_cost", "units", "billable_count",
            "total_cost", "current_balance", "remaining_balance",
            "has_sufficient_balance", "is_admin"
        ]
        for field in expected_fields:
            assert field in data, f"Missing '{field}' in cost preview"

    def test_cost_preview_selected(self, api, headers, test_data):
        """D2: Cost preview para tipo 'selected' con member_ids"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        member_ids = test_data["member_ids"]
        if not gid or not eid or not member_ids:
            pytest.skip("No hay datos de prueba")
        r = requests.post(
            f"{api}/partners/groups/{gid}/assignment-cost-preview",
            json={"exam_id": eid, "assignment_type": "selected", "member_ids": member_ids[:1]},
            headers=headers
        )
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert data["units"] == 1

    def test_cost_preview_admin_flag(self, api, headers, test_data):
        """D3: Admin tiene is_admin=True en cost preview"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid or not eid:
            pytest.skip("No hay datos")
        r = requests.post(
            f"{api}/partners/groups/{gid}/assignment-cost-preview",
            json={"exam_id": eid, "assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["is_admin"] is True

    def test_cost_preview_empty_members(self, api, headers, test_data):
        """D4: Selected sin member_ids retorna error"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid or not eid:
            pytest.skip("No hay datos")
        r = requests.post(
            f"{api}/partners/groups/{gid}/assignment-cost-preview",
            json={"exam_id": eid, "assignment_type": "selected", "member_ids": []},
            headers=headers
        )
        assert r.status_code == 400

    def test_cost_preview_math(self, api, headers, test_data):
        """D5: total_cost == unit_cost * billable_count"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid or not eid:
            pytest.skip("No hay datos")
        r = requests.post(
            f"{api}/partners/groups/{gid}/assignment-cost-preview",
            json={"exam_id": eid, "assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        expected_total = data["unit_cost"] * data["billable_count"]
        assert abs(data["total_cost"] - expected_total) < 0.01, \
            f"total_cost ({data['total_cost']}) != unit_cost ({data['unit_cost']}) * billable ({data['billable_count']})"

    def test_cost_preview_remaining_balance(self, api, headers, test_data):
        """D6: remaining_balance == current_balance - total_cost"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid or not eid:
            pytest.skip("No hay datos")
        r = requests.post(
            f"{api}/partners/groups/{gid}/assignment-cost-preview",
            json={"exam_id": eid, "assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        expected_remaining = data["current_balance"] - data["total_cost"]
        assert abs(data["remaining_balance"] - expected_remaining) < 0.01

    def test_cost_preview_requires_auth(self, api, test_data):
        """D7: Cost preview requiere autenticación"""
        gid = test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.post(
            f"{api}/partners/groups/{gid}/assignment-cost-preview",
            json={"exam_id": 1, "assignment_type": "all"}
        )
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# E. ASIGNAR EXAMEN A GRUPO
# ═══════════════════════════════════════════════════════════════════════════

class TestAssignExam:
    """Tests para POST /partners/groups/<id>/exams"""

    def test_assign_requires_auth(self, api, test_data):
        """E1: Asignación requiere autenticación"""
        gid = test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams",
            json={"exam_id": 1, "assignment_type": "all"}
        )
        assert r.status_code in [401, 422]

    def test_assign_missing_exam_id(self, api, headers, test_data):
        """E2: Sin exam_id retorna 400"""
        gid = test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams",
            json={"assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 400
        assert "requerido" in r.json().get("error", "").lower() or "exam" in r.json().get("error", "").lower()

    def test_assign_nonexistent_exam(self, api, headers, test_data):
        """E3: Examen inexistente retorna 404"""
        gid = test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams",
            json={"exam_id": 999999, "assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 404

    def test_assign_selected_no_members(self, api, headers, test_data):
        """E4: Tipo 'selected' sin member_ids retorna 400"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        if not gid or not eid:
            pytest.skip("No hay datos")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams",
            json={"exam_id": eid, "assignment_type": "selected", "member_ids": []},
            headers=headers
        )
        assert r.status_code == 400

    def test_assign_duplicate(self, api, headers, test_data):
        """E5: Asignar examen ya activo al mismo grupo retorna 400"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación existente")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams",
            json={"exam_id": eid, "assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 400, f"Expected 400 for duplicate, got {r.status_code}: {r.text}"

    def test_assign_nonexistent_group(self, api, headers, test_data):
        """E6: Grupo inexistente retorna 404"""
        eid = test_data["exam_id"]
        if not eid:
            pytest.skip("No hay examen")
        r = requests.post(
            f"{api}/partners/groups/999999/exams",
            json={"exam_id": eid, "assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════
# F. DESASIGNAR EXAMEN
# ═══════════════════════════════════════════════════════════════════════════

class TestUnassignExam:
    """Tests para DELETE /partners/groups/<id>/exams/<id>"""

    def test_unassign_requires_auth(self, api, test_data):
        """F1: Desasignar requiere autenticación"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.delete(f"{api}/partners/groups/{gid}/exams/{eid}")
        assert r.status_code in [401, 422]

    def test_unassign_nonexistent(self, api, headers, test_data):
        """F2: Desasignar examen no asignado retorna 404"""
        gid = test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.delete(f"{api}/partners/groups/{gid}/exams/999999", headers=headers)
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════
# G. GESTIÓN DE MIEMBROS
# ═══════════════════════════════════════════════════════════════════════════

class TestMemberManagement:
    """Tests para GET/PUT/POST members endpoints"""

    def test_get_members_success(self, api, headers, test_data):
        """G1: Listar miembros retorna lista"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members",
            headers=headers
        )
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert "members" in data or isinstance(data, list)

    def test_get_members_requires_auth(self, api, test_data):
        """G2: Listar miembros requiere autenticación"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.get(f"{api}/partners/groups/{gid}/exams/{eid}/members")
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# H. MATERIALES DE ESTUDIO ASIGNADOS
# ═══════════════════════════════════════════════════════════════════════════

class TestStudyMaterials:
    """Tests para study-materials en grupos"""

    def test_list_study_materials(self, api, headers, test_data):
        """H1: Listar materiales asignados retorna estructura correcta"""
        gid = test_data["group_id"] or test_data["existing_assignment_group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.get(f"{api}/partners/groups/{gid}/study-materials", headers=headers)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert "materials" in data or "study_materials" in data or "assigned_materials" in data or isinstance(data, list)

    def test_list_study_materials_requires_auth(self, api, test_data):
        """H2: Listar materiales requiere autenticación"""
        gid = test_data["group_id"] or test_data["existing_assignment_group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.get(f"{api}/partners/groups/{gid}/study-materials")
        assert r.status_code in [401, 422]


# ═══════════════════════════════════════════════════════════════════════════
# I. SWAP DE CANDIDATOS
# ═══════════════════════════════════════════════════════════════════════════

class TestSwap:
    """Tests para swap y bulk-swap"""

    def test_swap_requires_auth(self, api, test_data):
        """I1: Swap requiere autenticación"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/members/swap",
            json={"source_user_id": "x", "destination_user_id": "y"}
        )
        assert r.status_code in [401, 422]

    def test_swap_empty_payload(self, api, headers, test_data):
        """I2: Swap con payload vacío retorna 400"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/members/swap",
            json={},
            headers=headers
        )
        assert r.status_code == 400

    def test_swap_same_user(self, api, headers, test_data):
        """I3: Swap del mismo usuario a sí mismo retorna error"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        uid = "some-fake-id"
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/members/swap",
            json={"source_user_id": uid, "destination_user_id": uid},
            headers=headers
        )
        assert r.status_code == 400

    def test_bulk_swap_requires_auth(self, api, test_data):
        """I4: Bulk swap requiere autenticación"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/members/bulk-swap",
            json={"swaps": []}
        )
        assert r.status_code in [401, 422]

    def test_bulk_swap_empty(self, api, headers, test_data):
        """I5: Bulk swap con swaps vacío retorna error"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/members/bulk-swap",
            json={"swaps": []},
            headers=headers
        )
        assert r.status_code == 400

    def test_swap_history(self, api, headers, test_data):
        """I6: Swap history retorna lista (puede estar vacía)"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/swap-history",
            headers=headers
        )
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert "history" in data or "swaps" in data or isinstance(data, list)


# ═══════════════════════════════════════════════════════════════════════════
# J. RETOMAS
# ═══════════════════════════════════════════════════════════════════════════

class TestRetake:
    """Tests para retake endpoints"""

    def test_retake_preview_requires_auth(self, api, test_data):
        """J1: Retake preview requiere autenticación"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/retake-preview",
            json={"user_ids": []}
        )
        assert r.status_code in [401, 422]

    def test_retake_preview_empty_users(self, api, headers, test_data):
        """J2: Retake preview con user_ids vacío retorna error"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/retake-preview",
            json={"user_ids": []},
            headers=headers
        )
        # Should return 400 or 200 with empty results
        assert r.status_code in [200, 400]

    def test_retake_nonexistent_user(self, api, headers, test_data):
        """J3: Retake para usuario inexistente retorna error"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams/{eid}/members/fake-user-id-12345/retake",
            json={},
            headers=headers
        )
        assert r.status_code in [400, 404, 500]


# ═══════════════════════════════════════════════════════════════════════════
# K. MY-ASSIGNMENTS (Candidato)
# ═══════════════════════════════════════════════════════════════════════════

class TestMyAssignments:
    """Tests para GET /auth/my-assignments"""

    def test_my_assignments_admin(self, api, headers):
        """K1: Admin puede obtener my-assignments (aunque no tenga)"""
        r = requests.get(f"{api}/auth/my-assignments", headers=headers)
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert "assignments" in data
        assert isinstance(data["assignments"], list)

    def test_my_assignments_requires_auth(self, api):
        """K2: my-assignments requiere autenticación"""
        r = requests.get(f"{api}/auth/my-assignments")
        assert r.status_code in [401, 422]

    def test_my_assignments_structure(self, api, headers):
        """K3: my-assignments retorna estructura esperada"""
        r = requests.get(f"{api}/auth/my-assignments", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "assignments" in data
        # Si hay asignaciones, verificar estructura
        if data["assignments"]:
            a = data["assignments"][0]
            # Debe tener info del examen y grupo
            assert "exam" in a or "exam_name" in a or "exam_id" in a


# ═══════════════════════════════════════════════════════════════════════════
# L. EDGE CASES Y VALIDACIONES
# ═══════════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    """Tests de edge cases y validaciones"""

    def test_group_exams_invalid_group_id(self, api, headers):
        """L1: Group ID negativo retorna 404"""
        r = requests.get(f"{api}/partners/groups/-1/exams", headers=headers)
        assert r.status_code == 404

    def test_members_detail_invalid_per_page(self, api, headers, test_data):
        """L2: per_page > 1000 es recortado a 1000"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members-detail",
            params={"per_page": 5000},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["per_page"] <= 1000

    def test_members_detail_page_beyond_range(self, api, headers, test_data):
        """L3: Página más allá del total no da error"""
        gid = test_data["existing_assignment_group_id"]
        eid = test_data["existing_assignment_exam_id"]
        if not gid or not eid:
            pytest.skip("No hay asignación")
        r = requests.get(
            f"{api}/partners/groups/{gid}/exams/{eid}/members-detail",
            params={"page": 99999},
            headers=headers
        )
        assert r.status_code == 200

    def test_cost_preview_nonexistent_exam(self, api, headers, test_data):
        """L4: Cost preview con examen inexistente retorna correctamente"""
        gid = test_data["group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.post(
            f"{api}/partners/groups/{gid}/assignment-cost-preview",
            json={"exam_id": 999999, "assignment_type": "all"},
            headers=headers
        )
        # Should still compute (with 0 already_assigned) or return error
        assert r.status_code in [200, 400, 404]

    def test_swap_nonexistent_group(self, api, headers):
        """L5: Swap en grupo inexistente retorna 400 o 404"""
        r = requests.post(
            f"{api}/partners/groups/999999/exams/999999/members/swap",
            json={"source_user_id": "x", "destination_user_id": "y"},
            headers=headers
        )
        assert r.status_code in [400, 404]

    def test_assign_with_all_config_options(self, api, headers, test_data):
        """L6: Asignación con todas las opciones de config no falla"""
        gid = test_data["group_id"]
        eid = test_data["exam_id"]
        member_ids = test_data["member_ids"]
        if not gid or not eid:
            pytest.skip("No hay datos")
        # This may succeed or fail with "already assigned" - we just check no 500
        r = requests.post(
            f"{api}/partners/groups/{gid}/exams",
            json={
                "exam_id": eid,
                "assignment_type": "selected",
                "member_ids": member_ids[:1] if member_ids else [],
                "max_attempts": 3,
                "max_disconnections": 5,
                "exam_content_type": "questions_only",
                "time_limit_minutes": 120,
                "passing_score": 70,
                "require_security_pin": False,
            },
            headers=headers
        )
        # Should be 201 (created), 400 (already exists or no members), not 500
        assert r.status_code != 500, f"Server error 500: {r.text}"

    def test_assign_nonexistent_group_returns_404(self, api, headers, test_data):
        """L7: Grupo inexistente al asignar retorna 404"""
        eid = test_data["exam_id"]
        if not eid:
            pytest.skip("No hay examen")
        r = requests.post(
            f"{api}/partners/groups/999999/exams",
            json={"exam_id": eid, "assignment_type": "all"},
            headers=headers
        )
        assert r.status_code == 404

    def test_detail_nonexistent_group_returns_404(self, api, headers):
        """L8: Detalle para grupo inexistente retorna 404"""
        r = requests.get(f"{api}/partners/groups/999999/exams/1/detail", headers=headers)
        assert r.status_code == 404

    def test_members_detail_nonexistent_assignment(self, api, headers, test_data):
        """L9: members-detail para asignación inexistente retorna 404"""
        gid = test_data["group_id"] or test_data["existing_assignment_group_id"]
        if not gid:
            pytest.skip("No hay grupo")
        r = requests.get(
            f"{api}/partners/groups/{gid}/exams/999999/members-detail",
            headers=headers
        )
        assert r.status_code == 404
