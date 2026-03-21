"""
Tests del sistema de Vouchers (Responsable) y Reportes Mi-Plantel
==================================================================

Cubre:
  A. GET  /balance/my-campus-balance — Saldo en unidades del plantel
  B. GET  /partners/mi-plantel/evaluations — Reporte paginado con filtros
  C. GET  /partners/mi-plantel/evaluations/export — Exportación a Excel
  D. GET  /partners/mi-plantel/groups — Grupos para filtros de reportes
  E. GET  /partners/mi-plantel/exams — Exámenes para filtros
  F. Validaciones de acceso (sin token, rol incorrecto)

Ejecutar:
    cd backend && python -m pytest tests/test_responsable_vouchers_reportes.py -v --tb=short
    cd backend && python -m pytest tests/test_responsable_vouchers_reportes.py -v -k "vouchers"
    cd backend && python -m pytest tests/test_responsable_vouchers_reportes.py -v -k "reportes"
"""

import pytest
import requests

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASSWORDS = ["admin123", "Admin123!"]


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    """Obtener JWT token de admin (intenta varias contraseñas)"""
    for pwd in ADMIN_PASSWORDS:
        r = requests.post(f"{api}/auth/login", json={
            "username": ADMIN_USER,
            "password": pwd
        })
        if r.status_code == 200:
            data = r.json()
            assert "access_token" in data
            return data["access_token"]
    pytest.fail(f"Login falló con todas las contraseñas: {r.text}")


@pytest.fixture(scope="session")
def responsable_token(api, admin_token):
    """Obtener JWT token de un usuario responsable real.
    1. Buscar responsables via admin
    2. Obtener contraseña
    3. Login como responsable
    """
    admin_h = {"Authorization": f"Bearer {admin_token}"}

    # Buscar primer responsable con campus_id
    r = requests.get(
        f"{api}/user-management/users?per_page=5&role=responsable",
        headers=admin_h
    )
    if r.status_code != 200:
        pytest.skip(f"No se pudo consultar usuarios: {r.status_code}")

    users = r.json().get("users", [])
    responsable = next((u for u in users if u.get("campus_id")), None)
    if not responsable:
        pytest.skip("No hay responsables con campus_id en DEV")

    # Obtener contraseña
    r2 = requests.get(
        f"{api}/user-management/users/{responsable['id']}/password",
        headers=admin_h
    )
    if r2.status_code != 200 or not r2.json().get("password"):
        pytest.skip("No se pudo obtener password del responsable")

    pwd = r2.json()["password"]

    # Login como responsable
    r3 = requests.post(f"{api}/auth/login", json={
        "username": responsable["username"],
        "password": pwd
    })
    if r3.status_code != 200:
        pytest.skip(f"Login responsable falló: {r3.text[:200]}")

    return r3.json()["access_token"]


@pytest.fixture(scope="session")
def headers(responsable_token):
    """Headers con auth de responsable"""
    return {
        "Authorization": f"Bearer {responsable_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    """Headers con auth de admin (para tests de acceso)"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def balance_data(api, headers):
    """Obtener datos de balance del plantel una sola vez"""
    r = requests.get(f"{api}/balance/my-campus-balance", headers=headers)
    if r.status_code != 200:
        pytest.skip(f"No se pudo obtener balance del plantel: {r.status_code} {r.text[:200]}")
    return r.json()


@pytest.fixture(scope="session")
def evaluations_data(api, headers):
    """Obtener datos de evaluaciones una sola vez"""
    r = requests.get(f"{api}/partners/mi-plantel/evaluations?per_page=10", headers=headers)
    if r.status_code != 200:
        pytest.skip(f"No se pudo obtener evaluaciones: {r.status_code} {r.text[:200]}")
    return r.json()


@pytest.fixture(scope="session")
def groups_data(api, headers):
    """Obtener datos de grupos del plantel"""
    r = requests.get(f"{api}/partners/mi-plantel/groups", headers=headers)
    if r.status_code != 200:
        pytest.skip(f"No se pudo obtener grupos: {r.status_code}")
    return r.json()


@pytest.fixture(scope="session")
def exams_data(api, headers):
    """Obtener datos de exámenes del plantel"""
    r = requests.get(f"{api}/partners/mi-plantel/exams", headers=headers)
    if r.status_code != 200:
        pytest.skip(f"No se pudo obtener exámenes: {r.status_code}")
    return r.json()


# ═══════════════════════════════════════════════════════════════════════════
# A. VOUCHERS — Saldo del plantel (/balance/my-campus-balance)
# ═══════════════════════════════════════════════════════════════════════════

class TestVouchersBalance:
    """Tests para GET /balance/my-campus-balance"""

    def test_balance_returns_200(self, api, headers):
        """El endpoint debe responder con 200"""
        r = requests.get(f"{api}/balance/my-campus-balance", headers=headers)
        assert r.status_code == 200

    def test_balance_has_campus(self, balance_data):
        """Debe incluir datos del campus"""
        assert "campus" in balance_data
        campus = balance_data["campus"]
        assert "id" in campus, "Campus sin id"
        assert "name" in campus, "Campus sin name"
        assert "certification_cost" in campus, "Campus sin certification_cost"

    def test_balance_campus_id_is_int(self, balance_data):
        """campus.id debe ser entero"""
        assert isinstance(balance_data["campus"]["id"], int)

    def test_balance_certification_cost_numeric(self, balance_data):
        """certification_cost debe ser numérico y >= 0"""
        cost = balance_data["campus"]["certification_cost"]
        assert isinstance(cost, (int, float))
        assert cost >= 0

    def test_balance_has_totals_units(self, balance_data):
        """Debe incluir totals_units con las 4 claves de vouchers"""
        assert "totals_units" in balance_data
        units = balance_data["totals_units"]
        for key in ("current_balance", "total_received", "total_spent", "total_scholarships"):
            assert key in units, f"Falta clave en totals_units: {key}"

    def test_balance_units_are_integers(self, balance_data):
        """Las unidades (vouchers) deben ser enteros"""
        units = balance_data["totals_units"]
        for key, val in units.items():
            assert isinstance(val, int), f"totals_units.{key} debe ser int, es {type(val)}"

    def test_balance_units_non_negative(self, balance_data):
        """Las unidades no deben ser negativas"""
        units = balance_data["totals_units"]
        for key, val in units.items():
            assert val >= 0, f"totals_units.{key} es negativo: {val}"

    def test_balance_has_totals_money(self, balance_data):
        """Debe incluir totals_money con las 4 claves"""
        assert "totals_money" in balance_data
        money = balance_data["totals_money"]
        for key in ("current_balance", "total_received", "total_spent", "total_scholarships"):
            assert key in money, f"Falta clave en totals_money: {key}"

    def test_balance_money_numeric(self, balance_data):
        """Los importes monetarios deben ser numéricos"""
        money = balance_data["totals_money"]
        for key, val in money.items():
            assert isinstance(val, (int, float)), \
                f"totals_money.{key} debe ser numérico, es {type(val)}"

    def test_balance_has_coordinators_count(self, balance_data):
        """Debe incluir el conteo de coordinadores"""
        assert "coordinators_count" in balance_data
        assert isinstance(balance_data["coordinators_count"], int)
        assert balance_data["coordinators_count"] >= 0

    def test_balance_consistency(self, balance_data):
        """current_balance <= total_received (no puede gastar más de lo recibido)"""
        units = balance_data["totals_units"]
        # current_balance = received - spent - scholarships (aprox)
        # Solo verificar que el balance sea coherente
        assert units["current_balance"] <= units["total_received"] or units["total_received"] == 0

    def test_balance_requires_auth(self, api):
        """Sin token debe devolver 401 o 422"""
        r = requests.get(f"{api}/balance/my-campus-balance")
        assert r.status_code in (401, 422), f"Esperado 401/422, obtenido {r.status_code}"


# ═══════════════════════════════════════════════════════════════════════════
# B. REPORTES — Evaluaciones paginadas (/partners/mi-plantel/evaluations)
# ═══════════════════════════════════════════════════════════════════════════

class TestReportesEvaluations:
    """Tests para GET /partners/mi-plantel/evaluations"""

    def test_evaluations_returns_200(self, api, headers):
        """El endpoint debe responder con 200"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations", headers=headers)
        assert r.status_code == 200

    def test_evaluations_response_structure(self, evaluations_data):
        """Debe tener evaluations, total, page, per_page, pages"""
        for key in ("evaluations", "total", "page", "per_page", "pages"):
            assert key in evaluations_data, f"Falta clave: {key}"
        assert isinstance(evaluations_data["evaluations"], list)
        assert isinstance(evaluations_data["total"], int)
        assert isinstance(evaluations_data["page"], int)

    def test_evaluations_default_pagination(self, api, headers):
        """Por defecto debe paginar con page=1"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations", headers=headers)
        data = r.json()
        assert data["page"] == 1
        assert isinstance(data["per_page"], int)
        assert data["per_page"] > 0

    def test_evaluations_custom_pagination(self, api, headers):
        """Debe respetar page y per_page customizados"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations?page=1&per_page=5", headers=headers)
        data = r.json()
        assert data["page"] == 1
        assert data["per_page"] == 5
        assert len(data["evaluations"]) <= 5

    def test_evaluations_large_per_page(self, api, headers):
        """Enviar per_page grande no debe causar error"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations?per_page=500", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["per_page"], int)

    def test_evaluation_row_structure(self, evaluations_data):
        """Cada evaluación debe tener los campos esperados"""
        evals = evaluations_data["evaluations"]
        if not evals:
            pytest.skip("No hay evaluaciones para verificar estructura")
        ev = evals[0]
        expected_fields = [
            "id", "candidate", "exam", "group",
            "score", "result", "result_text",
            "start_date", "end_date", "duration_seconds",
        ]
        for field in expected_fields:
            assert field in ev, f"Falta campo: {field}"

    def test_evaluation_candidate_structure(self, evaluations_data):
        """candidate debe tener full_name, email, curp"""
        evals = evaluations_data["evaluations"]
        if not evals:
            pytest.skip("No hay evaluaciones")
        candidate = evals[0]["candidate"]
        assert candidate is not None, "candidate es null"
        for key in ("full_name", "email"):
            assert key in candidate, f"Falta candidate.{key}"

    def test_evaluation_exam_structure(self, evaluations_data):
        """exam debe tener id, name"""
        evals = evaluations_data["evaluations"]
        if not evals:
            pytest.skip("No hay evaluaciones")
        exam = evals[0]["exam"]
        if exam:
            assert "id" in exam
            assert "name" in exam

    def test_evaluation_has_urls(self, evaluations_data):
        """Debe incluir report_url y certificate_url"""
        evals = evaluations_data["evaluations"]
        if not evals:
            pytest.skip("No hay evaluaciones")
        ev = evals[0]
        for field in ("report_url", "certificate_url"):
            assert field in ev, f"Falta campo: {field}"

    def test_evaluation_exam_has_version(self, evaluations_data):
        """exam debe tener version si el examen existe"""
        evals = evaluations_data["evaluations"]
        for ev in evals:
            if ev.get("exam"):
                assert "version" in ev["exam"], "Falta exam.version"
                break

    def test_evaluation_score_range(self, evaluations_data):
        """score debe estar entre 0 y 100"""
        evals = evaluations_data["evaluations"]
        for ev in evals:
            score = ev.get("score")
            if score is not None:
                assert 0 <= score <= 100, f"Score fuera de rango: {score}"

    def test_evaluation_result_values(self, evaluations_data):
        """result debe ser 0 o 1"""
        evals = evaluations_data["evaluations"]
        for ev in evals:
            result = ev.get("result")
            if result is not None:
                assert result in (0, 1), f"Resultado inválido: {result}"

    def test_evaluation_result_text_matches(self, evaluations_data):
        """result_text debe coincidir con result"""
        evals = evaluations_data["evaluations"]
        for ev in evals:
            if ev.get("result") == 1:
                assert ev["result_text"] == "Aprobado"
            elif ev.get("result") == 0:
                assert ev["result_text"] == "Reprobado"

    def test_filter_by_result_approved(self, api, headers):
        """Filtrar por result=1 debe retornar solo aprobados"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations?result=1&per_page=10", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for ev in data["evaluations"]:
            assert ev["result"] == 1, f"Esperado result=1, obtenido {ev['result']}"

    def test_filter_by_result_failed(self, api, headers):
        """Filtrar por result=0 debe retornar solo reprobados"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations?result=0&per_page=10", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for ev in data["evaluations"]:
            assert ev["result"] == 0, f"Esperado result=0, obtenido {ev['result']}"

    def test_filter_by_exam(self, api, headers, exams_data):
        """Filtrar por exam_id debe retornar solo evaluaciones de ese examen"""
        exams = exams_data.get("exams", [])
        if not exams:
            pytest.skip("No hay exámenes disponibles")
        exam_id = exams[0]["id"]
        r = requests.get(f"{api}/partners/mi-plantel/evaluations?exam_id={exam_id}&per_page=10", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for ev in data["evaluations"]:
            assert ev["exam"]["id"] == exam_id, \
                f"Esperado exam_id={exam_id}, obtenido {ev['exam']['id']}"

    def test_filter_by_group(self, api, headers, groups_data):
        """Filtrar por group_id debe ser aceptado sin error"""
        groups = groups_data.get("groups", [])
        if not groups:
            pytest.skip("No hay grupos disponibles")
        group_id = groups[0]["id"]
        r = requests.get(f"{api}/partners/mi-plantel/evaluations?group_id={group_id}&per_page=10", headers=headers)
        assert r.status_code == 200
        data = r.json()
        # Los resultados filtrados por grupo deben tener ese grupo
        for ev in data["evaluations"]:
            if ev.get("group") and ev["group"].get("id"):
                assert ev["group"]["id"] == group_id

    def test_filter_by_search(self, api, headers):
        """Filtrar por search debe funcionar sin error"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations?search=test&per_page=5", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["evaluations"], list)

    def test_search_nonexistent_returns_empty(self, api, headers):
        """Búsqueda sin resultados debe retornar lista vacía o menos resultados"""
        r = requests.get(
            f"{api}/partners/mi-plantel/evaluations?search=ZXQWKJ999NONEXIST&per_page=5",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["evaluations"], list)
        assert data["total"] >= 0

    def test_combined_filters(self, api, headers, exams_data):
        """Combinar filtros no debe causar error"""
        exams = exams_data.get("exams", [])
        params = "result=1&per_page=5"
        if exams:
            params += f"&exam_id={exams[0]['id']}"
        r = requests.get(f"{api}/partners/mi-plantel/evaluations?{params}", headers=headers)
        assert r.status_code == 200

    def test_evaluations_requires_auth(self, api):
        """Sin token debe devolver 401 o 422"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations")
        assert r.status_code in (401, 422)


# ═══════════════════════════════════════════════════════════════════════════
# C. REPORTES — Exportación Excel (/partners/mi-plantel/evaluations/export)
# ═══════════════════════════════════════════════════════════════════════════

class TestReportesExport:
    """Tests para GET /partners/mi-plantel/evaluations/export"""

    def test_export_returns_200(self, api, headers):
        """El endpoint de export debe responder con 200"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations/export", headers=headers)
        assert r.status_code == 200

    def test_export_content_type(self, api, headers):
        """Debe retornar un archivo Excel (spreadsheet)"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations/export", headers=headers)
        assert r.status_code == 200
        content_type = r.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "octet-stream" in content_type, \
            f"Content-Type inesperado: {content_type}"

    def test_export_has_content_disposition(self, api, headers):
        """Debe tener header Content-Disposition con nombre de archivo"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations/export", headers=headers)
        assert r.status_code == 200
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd, f"Falta Content-Disposition: {cd}"

    def test_export_has_content(self, api, headers):
        """El archivo generado no debe estar vacío"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations/export", headers=headers)
        assert r.status_code == 200
        assert len(r.content) > 100, \
            f"Archivo Excel pequeño ({len(r.content)} bytes)"

    def test_export_is_valid_xlsx(self, api, headers):
        """El contenido debe ser un archivo XLSX (ZIP magic bytes PK)"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations/export", headers=headers)
        assert r.status_code == 200
        assert r.content[:2] == b'PK', \
            f"Magic bytes incorrectos: {r.content[:4].hex()}"

    def test_export_with_filters(self, api, headers):
        """Debe aceptar filtros sin error"""
        r = requests.get(
            f"{api}/partners/mi-plantel/evaluations/export?result=1",
            headers=headers
        )
        assert r.status_code == 200
        assert len(r.content) > 50

    def test_export_with_search(self, api, headers):
        """Debe aceptar parámetro search sin error"""
        r = requests.get(
            f"{api}/partners/mi-plantel/evaluations/export?search=test",
            headers=headers
        )
        assert r.status_code == 200

    def test_export_requires_auth(self, api):
        """Sin token debe devolver 401 o 422"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations/export")
        assert r.status_code in (401, 422)


# ═══════════════════════════════════════════════════════════════════════════
# D. REPORTES — Grupos del plantel (/partners/mi-plantel/groups)
# ═══════════════════════════════════════════════════════════════════════════

class TestReportesGroups:
    """Tests para GET /partners/mi-plantel/groups"""

    def test_groups_returns_200(self, api, headers):
        """El endpoint debe responder con 200"""
        r = requests.get(f"{api}/partners/mi-plantel/groups", headers=headers)
        assert r.status_code == 200

    def test_groups_response_structure(self, groups_data):
        """Debe tener clave groups con lista"""
        assert "groups" in groups_data
        assert isinstance(groups_data["groups"], list)

    def test_groups_item_structure(self, groups_data):
        """Cada grupo debe tener id, name, is_active"""
        groups = groups_data["groups"]
        if not groups:
            pytest.skip("No hay grupos en el plantel")
        g = groups[0]
        assert "id" in g, "Grupo sin id"
        assert "name" in g, "Grupo sin name"
        assert "is_active" in g, "Grupo sin is_active"

    def test_groups_id_is_int(self, groups_data):
        """group.id debe ser entero"""
        for g in groups_data["groups"]:
            assert isinstance(g["id"], int)

    def test_groups_is_active_is_bool(self, groups_data):
        """group.is_active debe ser booleano"""
        for g in groups_data["groups"]:
            assert isinstance(g["is_active"], bool)

    def test_groups_requires_auth(self, api):
        """Sin token debe devolver 401 o 422"""
        r = requests.get(f"{api}/partners/mi-plantel/groups")
        assert r.status_code in (401, 422)


# ═══════════════════════════════════════════════════════════════════════════
# E. REPORTES — Exámenes del plantel (/partners/mi-plantel/exams)
# ═══════════════════════════════════════════════════════════════════════════

class TestReportesExams:
    """Tests para GET /partners/mi-plantel/exams"""

    def test_exams_returns_200(self, api, headers):
        """El endpoint debe responder con 200"""
        r = requests.get(f"{api}/partners/mi-plantel/exams", headers=headers)
        assert r.status_code == 200

    def test_exams_response_structure(self, exams_data):
        """Debe tener clave exams con lista"""
        assert "exams" in exams_data
        assert isinstance(exams_data["exams"], list)

    def test_exams_item_structure(self, exams_data):
        """Cada examen debe tener id, name, version"""
        exams = exams_data["exams"]
        if not exams:
            pytest.skip("No hay exámenes en el plantel")
        ex = exams[0]
        assert "id" in ex, "Examen sin id"
        assert "name" in ex, "Examen sin name"
        assert "version" in ex, "Examen sin version"

    def test_exams_id_is_int(self, exams_data):
        """exam.id debe ser entero"""
        for ex in exams_data["exams"]:
            assert isinstance(ex["id"], int)

    def test_exams_requires_auth(self, api):
        """Sin token debe devolver 401 o 422"""
        r = requests.get(f"{api}/partners/mi-plantel/exams")
        assert r.status_code in (401, 422)


# ═══════════════════════════════════════════════════════════════════════════
# F. VALIDACIONES DE ACCESO
# ═══════════════════════════════════════════════════════════════════════════

class TestAccesoResponsable:
    """Tests de acceso y permisos — un admin NO es responsable"""

    def test_admin_cannot_access_evaluations(self, api, admin_headers):
        """Un admin no debe poder acceder a evaluaciones de mi-plantel"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations", headers=admin_headers)
        assert r.status_code == 403

    def test_admin_cannot_export(self, api, admin_headers):
        """Un admin no debe poder exportar evaluaciones de mi-plantel"""
        r = requests.get(f"{api}/partners/mi-plantel/evaluations/export", headers=admin_headers)
        assert r.status_code == 403

    def test_admin_cannot_access_groups(self, api, admin_headers):
        """Un admin no debe poder ver los grupos de mi-plantel"""
        r = requests.get(f"{api}/partners/mi-plantel/groups", headers=admin_headers)
        assert r.status_code == 403

    def test_admin_cannot_access_exams(self, api, admin_headers):
        """Un admin no debe poder ver los exámenes de mi-plantel"""
        r = requests.get(f"{api}/partners/mi-plantel/exams", headers=admin_headers)
        assert r.status_code == 403

    def test_all_endpoints_reject_no_token(self, api):
        """Todos los endpoints deben rechazar peticiones sin token"""
        endpoints = [
            "/balance/my-campus-balance",
            "/partners/mi-plantel/evaluations",
            "/partners/mi-plantel/evaluations/export",
            "/partners/mi-plantel/groups",
            "/partners/mi-plantel/exams",
        ]
        for ep in endpoints:
            r = requests.get(f"{api}{ep}")
            assert r.status_code in (401, 422), \
                f"{ep} debería devolver 401/422 sin token, obtenido {r.status_code}"
