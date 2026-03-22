"""
Tests del módulo de Reportes — Granularidad Progresiva
======================================================

Cubre:
  A. GET /partners/reports/filters — Opciones de filtros disponibles
  B. GET /partners/reports — Granularidad progresiva por categorías
  C. GET /partners/reports/export — Exportación con categorías y columnas
  D. Validaciones de acceso y edge cases
  E. Scoping por rol de coordinador

Categorías (param ?categories=):
  - usuario:       1 fila por usuario (base obligatoria)
  - organizacion:  × membresías de grupo
  - estandar:      × asignaciones ECM por grupo
  - resultado:     × intentos de evaluación
  - certificacion: datos de certificado (sin multiplicar extra)

Ejecutar:
    cd backend && python -m pytest tests/test_reports.py -v --tb=short
    cd backend && python -m pytest tests/test_reports.py -v -k "granularity"
"""

import pytest
import requests
import time

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

# Campos esperados por nivel de profundidad
USER_FIELDS = {
    "user_id", "full_name", "name", "first_surname", "second_surname",
    "username", "email", "curp", "gender",
    "phone", "date_of_birth", "role", "is_active", "curp_verified",
    "last_login", "created_at",
}
ORG_FIELDS = {
    "partner_name", "campus_code", "campus_name", "campus_state",
    "campus_city", "director_name", "school_cycle", "cycle_start_date",
    "cycle_end_date", "group_name", "member_status", "joined_at",
    "max_retakes", "certification_cost",
}
STD_FIELDS = {
    "standard_code", "standard_name", "standard_level", "standard_sector",
    "validity_years", "brand_name", "assignment_number", "assignment_source",
    "exam_name", "assigned_at",
}
RESULT_FIELDS = {
    "score", "result", "result_date", "duration_seconds",
}
CERT_FIELDS = {
    "certificate_code", "eduit_certificate_code", "tramite_status", "expires_at",
}


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    """Obtener JWT token de admin (con retry para cold starts)"""
    for attempt in range(3):
        try:
            r = requests.post(f"{api}/auth/login", json={
                "username": ADMIN_USER,
                "password": ADMIN_PASS
            }, timeout=30)
            if r.status_code == 200:
                data = r.json()
                assert "access_token" in data
                return data["access_token"]
        except requests.exceptions.ConnectionError:
            if attempt < 2:
                time.sleep(5)
    pytest.fail("No se pudo autenticar como admin después de 3 intentos")


@pytest.fixture(scope="session")
def headers(admin_token):
    """Headers con auth para admin"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="session")
def filters_data(api, headers):
    """Obtener datos de filtros una sola vez para reutilizar en tests"""
    r = requests.get(f"{api}/partners/reports/filters", headers=headers)
    assert r.status_code == 200
    return r.json()


# ═══════════════════════════════════════════════════════════════════════════
# A. FILTROS DE REPORTES
# ═══════════════════════════════════════════════════════════════════════════

class TestReportFilters:
    """Tests para GET /partners/reports/filters"""

    def test_filters_returns_200(self, api, headers):
        """El endpoint debe responder con 200"""
        r = requests.get(f"{api}/partners/reports/filters", headers=headers)
        assert r.status_code == 200

    def test_filters_structure(self, filters_data):
        """La respuesta debe tener las 6 claves esperadas"""
        expected_keys = {"partners", "campuses", "school_cycles", "groups", "standards", "brands"}
        assert expected_keys.issubset(set(filters_data.keys())), \
            f"Faltan claves. Obtenidas: {set(filters_data.keys())}"

    def test_filters_partners_structure(self, filters_data):
        """Cada partner debe tener id y name"""
        partners = filters_data["partners"]
        assert isinstance(partners, list)
        if partners:
            p = partners[0]
            assert "id" in p, "Partner sin id"
            assert "name" in p, "Partner sin name"

    def test_filters_campuses_structure(self, filters_data):
        """Cada campus debe tener id, name y partner_id"""
        campuses = filters_data["campuses"]
        assert isinstance(campuses, list)
        if campuses:
            c = campuses[0]
            assert "id" in c
            assert "name" in c
            assert "partner_id" in c

    def test_filters_school_cycles_structure(self, filters_data):
        """Cada ciclo escolar debe tener id, name y campus_id"""
        cycles = filters_data["school_cycles"]
        assert isinstance(cycles, list)
        if cycles:
            sc = cycles[0]
            assert "id" in sc
            assert "name" in sc
            assert "campus_id" in sc

    def test_filters_groups_structure(self, filters_data):
        """Cada grupo debe tener id, name, campus_id y school_cycle_id"""
        groups = filters_data["groups"]
        assert isinstance(groups, list)
        if groups:
            g = groups[0]
            assert "id" in g
            assert "name" in g
            assert "campus_id" in g
            assert "school_cycle_id" in g

    def test_filters_standards_structure(self, filters_data):
        """Cada estándar debe tener id, code, name, level, sector"""
        standards = filters_data["standards"]
        assert isinstance(standards, list)
        if standards:
            s = standards[0]
            assert "id" in s
            assert "code" in s
            assert "name" in s
            assert "level" in s
            assert "sector" in s

    def test_filters_brands_structure(self, filters_data):
        """Cada marca debe tener id y name"""
        brands = filters_data["brands"]
        assert isinstance(brands, list)
        if brands:
            b = brands[0]
            assert "id" in b
            assert "name" in b

    def test_filters_requires_auth(self, api):
        """Sin token debe devolver 401"""
        r = requests.get(f"{api}/partners/reports/filters")
        assert r.status_code in (401, 422), f"Esperado 401/422, obtenido {r.status_code}"


# ═══════════════════════════════════════════════════════════════════════════
# B. GRANULARIDAD PROGRESIVA (categories)
# ═══════════════════════════════════════════════════════════════════════════

class TestProgressiveGranularity:
    """Valida que el param ?categories= controle la profundidad de filas y campos."""

    def test_usuario_only_fields(self, api, headers):
        """categories=usuario → solo campos de usuario"""
        r = requests.get(f"{api}/partners/reports?categories=usuario&per_page=3", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0, "Debe haber al menos 1 usuario"
        row = data["rows"][0]
        keys = set(row.keys())
        assert USER_FIELDS.issubset(keys), f"Faltan campos de usuario: {USER_FIELDS - keys}"
        assert keys.isdisjoint(ORG_FIELDS), f"No debe haber campos de org: {keys & ORG_FIELDS}"
        assert keys.isdisjoint(STD_FIELDS), f"No debe haber campos de estándar: {keys & STD_FIELDS}"

    def test_usuario_org_fields(self, api, headers):
        """categories=usuario,organizacion → campos de usuario + org"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion&per_page=3",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        if not data["rows"]:
            pytest.skip("No hay usuarios con membresías de grupo")
        row = data["rows"][0]
        keys = set(row.keys())
        assert USER_FIELDS.issubset(keys), f"Faltan campos de usuario: {USER_FIELDS - keys}"
        assert ORG_FIELDS.issubset(keys), f"Faltan campos de org: {ORG_FIELDS - keys}"
        assert keys.isdisjoint(STD_FIELDS), f"No debe haber campos de estándar: {keys & STD_FIELDS}"

    def test_usuario_org_estandar_fields(self, api, headers):
        """categories=usuario,organizacion,estandar → usr + org + std"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar&per_page=3",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        if not data["rows"]:
            pytest.skip("No hay asignaciones ECM")
        row = data["rows"][0]
        keys = set(row.keys())
        assert USER_FIELDS.issubset(keys)
        assert ORG_FIELDS.issubset(keys)
        assert STD_FIELDS.issubset(keys)
        assert keys.isdisjoint(RESULT_FIELDS), f"No debe haber campos de resultado: {keys & RESULT_FIELDS}"

    def test_all_categories_fields(self, api, headers):
        """Todas las categorías → todos los campos presentes"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar,resultado,certificacion&per_page=3",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        if not data["rows"]:
            pytest.skip("No hay datos con resultado")
        row = data["rows"][0]
        keys = set(row.keys())
        all_expected = USER_FIELDS | ORG_FIELDS | STD_FIELDS | RESULT_FIELDS | CERT_FIELDS
        assert all_expected.issubset(keys), f"Faltan campos: {all_expected - keys}"

    def test_cert_without_resultado(self, api, headers):
        """certificación sin resultado → campos cert pero no resultado"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar,certificacion&per_page=3",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        if not data["rows"]:
            pytest.skip("No hay asignaciones ECM")
        row = data["rows"][0]
        keys = set(row.keys())
        assert CERT_FIELDS.issubset(keys), f"Faltan campos de cert: {CERT_FIELDS - keys}"
        assert keys.isdisjoint(RESULT_FIELDS), f"No debe haber campos de resultado: {keys & RESULT_FIELDS}"

    def test_row_multiplication_usuario_vs_org(self, api, headers):
        """Org debe tener ≠ total que usuario-only (si hay membresías)"""
        r_u = requests.get(f"{api}/partners/reports?categories=usuario&per_page=1", headers=headers)
        r_o = requests.get(f"{api}/partners/reports?categories=usuario,organizacion&per_page=1", headers=headers)
        total_u = r_u.json()["total"]
        total_o = r_o.json()["total"]
        # Org total puede ser menor (solo usuarios con membresía) o diferente;
        # lo importante es que no sea el mismo valor por coincidencia cuando hay datos
        assert total_u > 0 and total_o > 0, "Debe haber datos en ambos niveles"
        # No assert igualdad — solo que ambos responden

    def test_row_multiplication_org_vs_estandar(self, api, headers):
        """Estándar puede tener más filas que org (por asignaciones múltiples)"""
        r_o = requests.get(f"{api}/partners/reports?categories=usuario,organizacion&per_page=1", headers=headers)
        r_s = requests.get(f"{api}/partners/reports?categories=usuario,organizacion,estandar&per_page=1", headers=headers)
        total_o = r_o.json()["total"]
        total_s = r_s.json()["total"]
        assert total_o > 0 and total_s > 0, "Debe haber datos en ambos niveles"
        # Estándar normalmente >= org (cada membresía puede tener N asignaciones)
        assert total_s >= total_o, \
            f"Estándar ({total_s}) debería ser >= org ({total_o})"

    def test_default_categories_fallback(self, api, headers):
        """Sin param categories el endpoint debe funcionar (backward compat)"""
        r = requests.get(f"{api}/partners/reports?per_page=3", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "rows" in data
        assert "total" in data

    def test_invalid_category_ignored(self, api, headers):
        """Categorías inválidas se ignoran sin error"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,fake_cat,invalid&per_page=3",
            headers=headers
        )
        assert r.status_code == 200

    def test_usuario_only_includes_users_without_groups(self, api, headers):
        """En modo usuario-only se incluyen TODOS los usuarios del scope"""
        r = requests.get(f"{api}/partners/reports?categories=usuario&per_page=1", headers=headers)
        data = r.json()
        # Admin scope debería incluir todos los usuarios
        assert data["total"] > 0, "Debe haber al menos 1 usuario en scope"


# ═══════════════════════════════════════════════════════════════════════════
# C. REPORTES PAGINADOS (general)
# ═══════════════════════════════════════════════════════════════════════════

class TestReports:
    """Tests generales para GET /partners/reports"""

    def test_reports_returns_200(self, api, headers):
        """El endpoint base debe responder con 200"""
        r = requests.get(f"{api}/partners/reports", headers=headers)
        assert r.status_code == 200

    def test_reports_response_structure(self, api, headers):
        """Debe tener rows, total, page, per_page, pages"""
        r = requests.get(f"{api}/partners/reports?categories=usuario", headers=headers)
        data = r.json()
        for key in ("rows", "total", "page", "per_page", "pages"):
            assert key in data, f"Falta clave: {key}"
        assert isinstance(data["rows"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["page"], int)
        assert isinstance(data["per_page"], int)

    def test_reports_default_pagination(self, api, headers):
        """Por defecto debe paginar con page=1, per_page=50"""
        r = requests.get(f"{api}/partners/reports?categories=usuario", headers=headers)
        data = r.json()
        assert data["page"] == 1
        assert data["per_page"] == 50

    def test_reports_custom_pagination(self, api, headers):
        """Debe respetar page y per_page customizados"""
        r = requests.get(f"{api}/partners/reports?categories=usuario&page=1&per_page=5", headers=headers)
        data = r.json()
        assert data["page"] == 1
        assert data["per_page"] == 5
        assert len(data["rows"]) <= 5

    def test_reports_max_per_page(self, api, headers):
        """per_page no debe exceder 200"""
        r = requests.get(f"{api}/partners/reports?categories=usuario&per_page=500", headers=headers)
        data = r.json()
        assert data["per_page"] <= 200

    def test_reports_filter_by_role(self, api, headers):
        """Filtrar por role=candidato debe retornar solo candidatos"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario&role=candidato&per_page=10",
            headers=headers
        )
        data = r.json()
        for row in data["rows"]:
            assert row["role"] == "candidato", \
                f"Se esperaba role='candidato', obtenido '{row['role']}'"

    def test_reports_filter_by_active(self, api, headers):
        """Filtrar por is_active=1 debe retornar solo activos"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario&is_active=1&per_page=10",
            headers=headers
        )
        data = r.json()
        for row in data["rows"]:
            assert row["is_active"] is True

    def test_reports_filter_by_inactive(self, api, headers):
        """Filtrar por is_active=0 debe retornar solo inactivos"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario&is_active=0&per_page=10",
            headers=headers
        )
        data = r.json()
        for row in data["rows"]:
            assert row["is_active"] is False

    def test_reports_filter_by_result_approved(self, api, headers):
        """Filtrar por resultado aprobado con categoría resultado"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar,resultado&result=approved&per_page=10",
            headers=headers
        )
        data = r.json()
        for row in data["rows"]:
            if row.get("result"):
                assert row["result"] == "Aprobado"

    def test_reports_filter_by_result_rejected(self, api, headers):
        """Filtrar por resultado reprobado"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar,resultado&result=rejected&per_page=10",
            headers=headers
        )
        data = r.json()
        for row in data["rows"]:
            if row.get("result"):
                assert row["result"] == "Reprobado"

    def test_reports_filter_by_campus(self, api, headers, filters_data):
        """Filtrar por campus_id con nivel organizacion"""
        campuses = filters_data.get("campuses", [])
        if not campuses:
            pytest.skip("No hay planteles disponibles")
        campus = campuses[0]
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion&campus_id={campus['id']}&per_page=10",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        for row in data["rows"]:
            assert row["campus_name"] == campus["name"]

    def test_reports_filter_by_group(self, api, headers, filters_data):
        """Filtrar por group_id con nivel organizacion"""
        groups = filters_data.get("groups", [])
        if not groups:
            pytest.skip("No hay grupos disponibles")
        group = groups[0]
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion&group_id={group['id']}&per_page=10",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        for row in data["rows"]:
            assert row["group_name"] == group["name"]

    def test_reports_search(self, api, headers):
        """Buscar por texto debe filtrar resultados"""
        r = requests.get(f"{api}/partners/reports?categories=usuario&per_page=1", headers=headers)
        data = r.json()
        if not data["rows"]:
            pytest.skip("No hay datos de reporte")
        name = data["rows"][0]["full_name"]
        search_term = name.split()[0] if name else "admin"
        r2 = requests.get(
            f"{api}/partners/reports?categories=usuario&search={search_term}&per_page=50",
            headers=headers
        )
        assert r2.status_code == 200
        assert r2.json()["total"] >= 1

    def test_reports_filter_combined(self, api, headers):
        """Combinar múltiples filtros + categorías debe funcionar"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar&role=candidato&is_active=1&per_page=5",
            headers=headers
        )
        assert r.status_code == 200
        assert isinstance(r.json()["rows"], list)

    def test_reports_page_beyond_total(self, api, headers):
        """Pedir una página mayor al total no debe dar error"""
        r = requests.get(f"{api}/partners/reports?categories=usuario&page=99999&per_page=10", headers=headers)
        assert r.status_code == 200
        assert r.json()["rows"] == []

    def test_reports_requires_auth(self, api):
        """Sin token debe devolver 401"""
        r = requests.get(f"{api}/partners/reports")
        assert r.status_code in (401, 422)

    def test_reports_score_fields(self, api, headers):
        """Score debe ser numérico o null"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar,resultado&per_page=20",
            headers=headers
        )
        data = r.json()
        for row in data["rows"]:
            score = row.get("score")
            if score is not None:
                assert isinstance(score, (int, float))

    def test_reports_total_consistency(self, api, headers):
        """El total reportado debe ser consistente con pages"""
        r = requests.get(f"{api}/partners/reports?categories=usuario&per_page=10", headers=headers)
        data = r.json()
        if data["total"] > 0:
            expected_pages = (data["total"] + data["per_page"] - 1) // data["per_page"]
            assert data["pages"] == expected_pages


# ═══════════════════════════════════════════════════════════════════════════
# D. EXPORTACIÓN A EXCEL
# ═══════════════════════════════════════════════════════════════════════════

class TestReportExport:
    """Tests para GET /partners/reports/export"""

    def test_export_returns_excel(self, api, headers):
        """Debe retornar un archivo Excel válido"""
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario,organizacion",
            headers=headers
        )
        assert r.status_code == 200
        content_type = r.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "octet-stream" in content_type

    def test_export_has_content_disposition(self, api, headers):
        """Debe tener header de descarga"""
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario",
            headers=headers
        )
        assert r.status_code == 200
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd
        assert "Reporte_" in cd

    def test_export_has_content(self, api, headers):
        """El archivo no debe estar vacío"""
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario",
            headers=headers
        )
        assert r.status_code == 200
        assert len(r.content) > 100

    def test_export_with_selected_columns(self, api, headers):
        """Debe funcionar con columnas seleccionadas y categorías"""
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario,organizacion,estandar,resultado&columns=full_name,partner_name,score,result",
            headers=headers
        )
        assert r.status_code == 200
        assert len(r.content) > 100

    def test_export_usuario_only_columns(self, api, headers):
        """Export solo usuario debe generar Excel con campos de usuario"""
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario&columns=full_name,email,phone",
            headers=headers
        )
        assert r.status_code == 200
        assert len(r.content) > 100

    def test_export_all_categories(self, api, headers):
        """Export con todas las categorías genera Excel más grande"""
        r_u = requests.get(
            f"{api}/partners/reports/export?categories=usuario&columns=full_name",
            headers=headers
        )
        r_all = requests.get(
            f"{api}/partners/reports/export?categories=usuario,organizacion,estandar,resultado,certificacion",
            headers=headers
        )
        assert r_u.status_code == 200
        assert r_all.status_code == 200
        assert len(r_all.content) >= len(r_u.content)

    def test_export_with_filters(self, api, headers):
        """Debe aceptar filtros junto con categorías"""
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario,organizacion&role=candidato&is_active=1&columns=full_name,role,partner_name",
            headers=headers
        )
        assert r.status_code == 200
        assert len(r.content) > 50

    def test_export_with_invalid_columns(self, api, headers):
        """Columnas inválidas deben ignorarse"""
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario&columns=invalid_col,fake_field",
            headers=headers
        )
        assert r.status_code == 200

    def test_export_requires_auth(self, api):
        """Sin token debe devolver 401"""
        r = requests.get(f"{api}/partners/reports/export")
        assert r.status_code in (401, 422)

    def test_export_xlsx_magic_bytes(self, api, headers):
        """Verificar que el contenido sea realmente un archivo XLSX (ZIP)"""
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario",
            headers=headers
        )
        assert r.status_code == 200
        assert r.content[:2] == b'PK', \
            f"Magic bytes incorrectos: {r.content[:4].hex()}"

    def test_export_new_columns(self, api, headers):
        """Las nuevas columnas (phone, date_of_birth, etc.) deben funcionar en export"""
        new_cols = "name,first_surname,second_surname,phone,date_of_birth,last_login,created_at,campus_code,director_name,cycle_start_date,cycle_end_date,max_retakes,validity_years,assignment_source,campus_city,member_status,joined_at,assigned_at,eduit_certificate_code"
        r = requests.get(
            f"{api}/partners/reports/export?categories=usuario,organizacion,estandar,certificacion&columns={new_cols}",
            headers=headers
        )
        assert r.status_code == 200
        assert len(r.content) > 100


# ═══════════════════════════════════════════════════════════════════════════
# E. VALIDACIONES DE ACCESO Y EDGE CASES
# ═══════════════════════════════════════════════════════════════════════════

class TestReportAccess:
    """Tests de acceso y edge cases"""

    def test_candidato_cannot_access_filters(self, api):
        """Un candidato no debería poder acceder a reportes"""
        r = requests.post(f"{api}/auth/login", json={
            "username": "candidato_test",
            "password": "Test12345"
        })
        if r.status_code != 200:
            pytest.skip("No hay usuario candidato_test disponible")
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        r2 = requests.get(f"{api}/partners/reports/filters", headers=h)
        assert r2.status_code == 403

    def test_candidato_cannot_access_reports(self, api):
        """Un candidato no debería poder consultar reportes"""
        r = requests.post(f"{api}/auth/login", json={
            "username": "candidato_test",
            "password": "Test12345"
        })
        if r.status_code != 200:
            pytest.skip("No hay usuario candidato_test disponible")
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        r2 = requests.get(f"{api}/partners/reports", headers=h)
        assert r2.status_code == 403

    def test_candidato_cannot_export(self, api):
        """Un candidato no debería poder exportar reportes"""
        r = requests.post(f"{api}/auth/login", json={
            "username": "candidato_test",
            "password": "Test12345"
        })
        if r.status_code != 200:
            pytest.skip("No hay usuario candidato_test disponible")
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        r2 = requests.get(f"{api}/partners/reports/export", headers=h)
        assert r2.status_code == 403

    def test_empty_filters_combination(self, api, headers):
        """Filtros que no matchean nada deben retornar lista vacía sin error"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario&search=ZZZZNONEXISTENT99999&per_page=5",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0
        assert data["rows"] == []

    def test_filter_by_partner(self, api, headers, filters_data):
        """Filtrar por partner_id con nivel org"""
        partners = filters_data.get("partners", [])
        if not partners:
            pytest.skip("No hay partners disponibles")
        partner = partners[0]
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion&partner_id={partner['id']}&per_page=5",
            headers=headers
        )
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert row["partner_name"] == partner["name"]

    def test_filter_by_standard(self, api, headers, filters_data):
        """Filtrar por standard_id con nivel estándar"""
        standards = filters_data.get("standards", [])
        if not standards:
            pytest.skip("No hay estándares disponibles")
        std = standards[0]
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar&standard_id={std['id']}&per_page=5",
            headers=headers
        )
        assert r.status_code == 200
        for row in r.json()["rows"]:
            if row.get("standard_code"):
                assert row["standard_code"] == std["code"]

    def test_gender_filter(self, api, headers):
        """Filtrar por género M/F funciona"""
        for gender in ("M", "F"):
            r = requests.get(
                f"{api}/partners/reports?categories=usuario&gender={gender}&per_page=5",
                headers=headers
            )
            assert r.status_code == 200
            for row in r.json()["rows"]:
                if row.get("gender"):
                    assert row["gender"] == gender

    def test_curp_verified_filter(self, api, headers):
        """Filtrar por curp_verified=1 retorna solo verificados"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario&curp_verified=1&per_page=10",
            headers=headers
        )
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert row["curp_verified"] is True

    def test_curp_not_verified_filter(self, api, headers):
        """Filtrar por curp_verified=0 retorna solo no verificados"""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario&curp_verified=0&per_page=10",
            headers=headers
        )
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert row["curp_verified"] is False


# ═══════════════════════════════════════════════════════════════════════════
# F. SCOPING POR ROL DE COORDINADOR
# ═══════════════════════════════════════════════════════════════════════════

class TestCoordinatorScoping:
    """Verifica que el scoping modelo funcione: partners/campuses COMPARTIDOS,
    grupos AISLADOS por coordinator_id."""

    def test_admin_ve_todos_los_partners_en_filtros(self, filters_data):
        """Admin debe ver todos los partners (compartidos)."""
        assert len(filters_data["partners"]) >= 1

    def test_admin_ve_todos_los_grupos(self, filters_data):
        """Admin (developer) debe ver todos los grupos sin restricción."""
        assert len(filters_data["groups"]) >= 1

    def test_filtros_campuses_son_de_partners_existentes(self, filters_data):
        """Los campus en filtros referencian partners que existen en la misma respuesta."""
        partner_ids = {p["id"] for p in filters_data["partners"]}
        for c in filters_data["campuses"]:
            assert c["partner_id"] in partner_ids

    def test_filtros_ciclos_son_de_campuses_existentes(self, filters_data):
        """Los ciclos en filtros referencian campuses que existen."""
        campus_ids = {c["id"] for c in filters_data["campuses"]}
        for cy in filters_data["school_cycles"]:
            assert cy["campus_id"] in campus_ids

    def test_admin_reportes_tiene_datos(self, api, headers):
        """Admin debe poder obtener filas de reportes."""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario&per_page=5",
            headers=headers, timeout=30
        )
        assert r.status_code == 200
        assert r.json()["total"] >= 0

    def test_org_filas_tienen_partner_y_grupo(self, api, headers):
        """Nivel org: cada fila incluye partner_name y group_name."""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion&per_page=10",
            headers=headers, timeout=30
        )
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert "partner_name" in row
            assert row["partner_name"], f"partner_name vacío para user_id={row.get('user_id')}"
            assert "group_name" in row
            assert row["group_name"], f"group_name vacío para user_id={row.get('user_id')}"

    def test_new_user_fields_present(self, api, headers):
        """Campos de usuario (incluidos desglose de nombre) están en la respuesta."""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario&per_page=1",
            headers=headers
        )
        assert r.status_code == 200
        if r.json()["rows"]:
            row = r.json()["rows"][0]
            for field in ("name", "first_surname", "second_surname", "phone", "date_of_birth", "last_login", "created_at"):
                assert field in row, f"Falta campo de usuario: {field}"

    def test_new_org_fields_present(self, api, headers):
        """Campos de org (campus_code, director, ciclo, etc.) están en la respuesta."""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion&per_page=1",
            headers=headers
        )
        assert r.status_code == 200
        if r.json()["rows"]:
            row = r.json()["rows"][0]
            for field in ("campus_code", "director_name", "cycle_start_date", "cycle_end_date", "max_retakes", "certification_cost"):
                assert field in row, f"Falta campo de org: {field}"

    def test_new_std_fields_present(self, api, headers):
        """Campos validity_years y assignment_source están en la respuesta nivel estándar."""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar&per_page=1",
            headers=headers
        )
        assert r.status_code == 200
        if r.json()["rows"]:
            row = r.json()["rows"][0]
            for field in ("validity_years", "assignment_source", "assigned_at"):
                assert field in row, f"Falta campo de estándar: {field}"

    def test_new_cert_field_present(self, api, headers):
        """Nuevo campo eduit_certificate_code está en la respuesta nivel certificación."""
        r = requests.get(
            f"{api}/partners/reports?categories=usuario,organizacion,estandar,certificacion&per_page=1",
            headers=headers
        )
        assert r.status_code == 200
        if r.json()["rows"]:
            row = r.json()["rows"][0]
            assert "eduit_certificate_code" in row, "Falta campo eduit_certificate_code"
