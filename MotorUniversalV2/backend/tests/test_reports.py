"""
Tests del módulo de Reportes (Reports)
=======================================

Cubre:
  A. GET /partners/reports/filters — Opciones de filtros disponibles
  B. GET /partners/reports — Reporte paginado con filtros avanzados
  C. GET /partners/reports/export — Exportación a Excel con selección de columnas
  D. Validaciones de acceso y edge cases

Ejecutar:
    cd backend && python -m pytest tests/test_reports.py -v --tb=short
    cd backend && python -m pytest tests/test_reports.py -v -k "filters"
"""

import pytest
import requests

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


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
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


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
# B. REPORTES PAGINADOS
# ═══════════════════════════════════════════════════════════════════════════

class TestReports:
    """Tests para GET /partners/reports"""

    def test_reports_returns_200(self, api, headers):
        """El endpoint base debe responder con 200"""
        r = requests.get(f"{api}/partners/reports", headers=headers)
        assert r.status_code == 200

    def test_reports_response_structure(self, api, headers):
        """Debe tener rows, total, page, per_page, pages"""
        r = requests.get(f"{api}/partners/reports", headers=headers)
        data = r.json()
        for key in ("rows", "total", "page", "per_page", "pages"):
            assert key in data, f"Falta clave: {key}"
        assert isinstance(data["rows"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["page"], int)
        assert isinstance(data["per_page"], int)

    def test_reports_default_pagination(self, api, headers):
        """Por defecto debe paginar con page=1, per_page=50"""
        r = requests.get(f"{api}/partners/reports", headers=headers)
        data = r.json()
        assert data["page"] == 1
        assert data["per_page"] == 50

    def test_reports_custom_pagination(self, api, headers):
        """Debe respetar page y per_page customizados"""
        r = requests.get(f"{api}/partners/reports?page=1&per_page=5", headers=headers)
        data = r.json()
        assert data["page"] == 1
        assert data["per_page"] == 5
        assert len(data["rows"]) <= 5

    def test_reports_max_per_page(self, api, headers):
        """per_page no debe exceder 200"""
        r = requests.get(f"{api}/partners/reports?per_page=500", headers=headers)
        data = r.json()
        assert data["per_page"] <= 200

    def test_reports_row_structure(self, api, headers):
        """Cada fila debe tener las columnas esperadas"""
        r = requests.get(f"{api}/partners/reports?per_page=1", headers=headers)
        data = r.json()
        if data["rows"]:
            row = data["rows"][0]
            expected_fields = [
                "user_id", "full_name", "username", "role",
                "is_active", "partner_name", "campus_name",
                "group_name", "standard_code", "result",
            ]
            for field in expected_fields:
                assert field in row, f"Falta campo: {field}"

    def test_reports_filter_by_result_approved(self, api, headers):
        """Filtrar por resultado aprobado debe retornar solo 'Aprobado'"""
        r = requests.get(f"{api}/partners/reports?result=approved&per_page=10", headers=headers)
        data = r.json()
        for row in data["rows"]:
            if row.get("result"):
                assert row["result"] == "Aprobado", \
                    f"Se esperaba 'Aprobado', obtenido '{row['result']}'"

    def test_reports_filter_by_result_rejected(self, api, headers):
        """Filtrar por resultado reprobado debe retornar solo 'Reprobado'"""
        r = requests.get(f"{api}/partners/reports?result=rejected&per_page=10", headers=headers)
        data = r.json()
        for row in data["rows"]:
            if row.get("result"):
                assert row["result"] == "Reprobado", \
                    f"Se esperaba 'Reprobado', obtenido '{row['result']}'"

    def test_reports_filter_by_role(self, api, headers):
        """Filtrar por role=candidato debe retornar solo candidatos"""
        r = requests.get(f"{api}/partners/reports?role=candidato&per_page=10", headers=headers)
        data = r.json()
        for row in data["rows"]:
            assert row["role"] == "candidato", \
                f"Se esperaba role='candidato', obtenido '{row['role']}'"

    def test_reports_filter_by_active(self, api, headers):
        """Filtrar por is_active=1 debe retornar solo activos"""
        r = requests.get(f"{api}/partners/reports?is_active=1&per_page=10", headers=headers)
        data = r.json()
        for row in data["rows"]:
            assert row["is_active"] is True, \
                f"Se esperaba is_active=True, obtenido {row['is_active']}"

    def test_reports_filter_by_inactive(self, api, headers):
        """Filtrar por is_active=0 debe retornar solo inactivos"""
        r = requests.get(f"{api}/partners/reports?is_active=0&per_page=10", headers=headers)
        data = r.json()
        for row in data["rows"]:
            assert row["is_active"] is False, \
                f"Se esperaba is_active=False, obtenido {row['is_active']}"

    def test_reports_filter_by_campus(self, api, headers, filters_data):
        """Filtrar por campus_id debe retornar solo registros de ese plantel"""
        campuses = filters_data.get("campuses", [])
        if not campuses:
            pytest.skip("No hay planteles disponibles")
        campus = campuses[0]
        r = requests.get(f"{api}/partners/reports?campus_id={campus['id']}&per_page=10", headers=headers)
        data = r.json()
        assert r.status_code == 200
        for row in data["rows"]:
            assert row["campus_name"] == campus["name"], \
                f"Se esperaba plantel '{campus['name']}', obtenido '{row['campus_name']}'"

    def test_reports_filter_by_group(self, api, headers, filters_data):
        """Filtrar por group_id debe retornar solo registros de ese grupo"""
        groups = filters_data.get("groups", [])
        if not groups:
            pytest.skip("No hay grupos disponibles")
        group = groups[0]
        r = requests.get(f"{api}/partners/reports?group_id={group['id']}&per_page=10", headers=headers)
        data = r.json()
        assert r.status_code == 200
        for row in data["rows"]:
            assert row["group_name"] == group["name"], \
                f"Se esperaba grupo '{group['name']}', obtenido '{row['group_name']}'"

    def test_reports_search(self, api, headers):
        """Buscar por texto debe filtrar resultados"""
        # Primero obtener un nombre real del sistema
        r = requests.get(f"{api}/partners/reports?per_page=1", headers=headers)
        data = r.json()
        if not data["rows"]:
            pytest.skip("No hay datos de reporte")
        name = data["rows"][0]["full_name"]
        search_term = name.split()[0] if name else "admin"

        r2 = requests.get(f"{api}/partners/reports?search={search_term}&per_page=50", headers=headers)
        data2 = r2.json()
        assert r2.status_code == 200
        assert data2["total"] >= 1, \
            f"La búsqueda por '{search_term}' debe retornar al menos 1 resultado"

    def test_reports_filter_has_assignment(self, api, headers):
        """Filtrar por has_assignment=1 retorna usuarios con asignación ECM"""
        r = requests.get(f"{api}/partners/reports?has_assignment=1&per_page=10", headers=headers)
        data = r.json()
        assert r.status_code == 200
        for row in data["rows"]:
            assert row.get("standard_code"), \
                "Usuarios con asignación deben tener standard_code"

    def test_reports_filter_combined(self, api, headers):
        """Combinar múltiples filtros debe funcionar sin error"""
        r = requests.get(
            f"{api}/partners/reports?role=candidato&is_active=1&has_assignment=1&per_page=5",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["rows"], list)

    def test_reports_page_beyond_total(self, api, headers):
        """Pedir una página mayor al total no debe dar error"""
        r = requests.get(f"{api}/partners/reports?page=99999&per_page=10", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["rows"] == []

    def test_reports_requires_auth(self, api):
        """Sin token debe devolver 401"""
        r = requests.get(f"{api}/partners/reports")
        assert r.status_code in (401, 422), f"Esperado 401/422, obtenido {r.status_code}"

    def test_reports_score_fields(self, api, headers):
        """Score y score_1000 deben ser numéricos o null"""
        r = requests.get(f"{api}/partners/reports?has_assignment=1&per_page=20", headers=headers)
        data = r.json()
        for row in data["rows"]:
            score = row.get("score")
            score_1000 = row.get("score_1000")
            if score is not None:
                assert isinstance(score, (int, float)), f"score debe ser número, obtenido {type(score)}"
            if score_1000 is not None:
                assert isinstance(score_1000, (int, float)), f"score_1000 debe ser número, obtenido {type(score_1000)}"

    def test_reports_total_consistency(self, api, headers):
        """El total reportado debe ser consistente con pages"""
        r = requests.get(f"{api}/partners/reports?per_page=10", headers=headers)
        data = r.json()
        if data["total"] > 0:
            expected_pages = (data["total"] + data["per_page"] - 1) // data["per_page"]
            assert data["pages"] == expected_pages, \
                f"Pages inconsistente: total={data['total']}, per_page={data['per_page']}, pages={data['pages']}, expected={expected_pages}"


# ═══════════════════════════════════════════════════════════════════════════
# C. EXPORTACIÓN A EXCEL
# ═══════════════════════════════════════════════════════════════════════════

class TestReportExport:
    """Tests para GET /partners/reports/export"""

    def test_export_returns_excel(self, api, headers):
        """Debe retornar un archivo Excel válido"""
        r = requests.get(f"{api}/partners/reports/export", headers=headers)
        assert r.status_code == 200
        content_type = r.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "octet-stream" in content_type, \
            f"Content-Type inesperado: {content_type}"

    def test_export_has_content_disposition(self, api, headers):
        """Debe tener header de descarga"""
        r = requests.get(f"{api}/partners/reports/export", headers=headers)
        assert r.status_code == 200
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd, f"Falta Content-Disposition: {cd}"
        assert "Reporte_" in cd, f"Nombre de archivo no contiene 'Reporte_': {cd}"

    def test_export_has_content(self, api, headers):
        """El archivo no debe estar vacío"""
        r = requests.get(f"{api}/partners/reports/export", headers=headers)
        assert r.status_code == 200
        assert len(r.content) > 100, \
            f"Archivo Excel demasiado pequeño ({len(r.content)} bytes)"

    def test_export_with_selected_columns(self, api, headers):
        """Debe funcionar con columnas seleccionadas"""
        r = requests.get(
            f"{api}/partners/reports/export?columns=full_name,score,result",
            headers=headers
        )
        assert r.status_code == 200
        assert len(r.content) > 100

    def test_export_with_all_columns(self, api, headers):
        """Sin param columns debe incluir todas"""
        r_all = requests.get(f"{api}/partners/reports/export", headers=headers)
        r_few = requests.get(
            f"{api}/partners/reports/export?columns=full_name,email",
            headers=headers
        )
        assert r_all.status_code == 200
        assert r_few.status_code == 200
        # El archivo completo debe ser más grande que el de 2 columnas
        assert len(r_all.content) >= len(r_few.content), \
            "El archivo con todas las columnas debería ser ≥ al de 2 columnas"

    def test_export_with_filters(self, api, headers):
        """Debe aceptar filtros igual que el endpoint de datos"""
        r = requests.get(
            f"{api}/partners/reports/export?role=candidato&is_active=1&columns=full_name,role,result",
            headers=headers
        )
        assert r.status_code == 200
        assert len(r.content) > 50

    def test_export_with_invalid_columns(self, api, headers):
        """Columnas inválidas deben ignorarse y entregar todas"""
        r = requests.get(
            f"{api}/partners/reports/export?columns=invalid_col,fake_field",
            headers=headers
        )
        assert r.status_code == 200

    def test_export_requires_auth(self, api):
        """Sin token debe devolver 401"""
        r = requests.get(f"{api}/partners/reports/export")
        assert r.status_code in (401, 422)

    def test_export_xlsx_magic_bytes(self, api, headers):
        """Verificar que el contenido sea realmente un archivo XLSX (ZIP)"""
        r = requests.get(f"{api}/partners/reports/export", headers=headers)
        assert r.status_code == 200
        # XLSX es un ZIP, comienza con PK (0x50 0x4B)
        assert r.content[:2] == b'PK', \
            f"Magic bytes incorrectos: {r.content[:4].hex()}"


# ═══════════════════════════════════════════════════════════════════════════
# D. VALIDACIONES DE ACCESO Y EDGE CASES
# ═══════════════════════════════════════════════════════════════════════════

class TestReportAccess:
    """Tests de acceso y edge cases"""

    def test_candidato_cannot_access_filters(self, api):
        """Un candidato no debería poder acceder a reportes"""
        # Login como candidato (si existe)
        r = requests.post(f"{api}/auth/login", json={
            "username": "candidato_test",
            "password": "Test12345"
        })
        if r.status_code != 200:
            pytest.skip("No hay usuario candidato_test disponible")
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        r2 = requests.get(f"{api}/partners/reports/filters", headers=h)
        assert r2.status_code == 403, \
            f"Candidato no debería acceder a reportes, obtenido {r2.status_code}"

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
            f"{api}/partners/reports?search=ZZZZNONEXISTENT99999&per_page=5",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0
        assert data["rows"] == []

    def test_filter_by_partner(self, api, headers, filters_data):
        """Filtrar por partner_id específico funciona sin error"""
        partners = filters_data.get("partners", [])
        if not partners:
            pytest.skip("No hay partners disponibles")
        partner = partners[0]
        r = requests.get(f"{api}/partners/reports?partner_id={partner['id']}&per_page=5", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for row in data["rows"]:
            assert row["partner_name"] == partner["name"]

    def test_filter_by_standard(self, api, headers, filters_data):
        """Filtrar por standard_id específico funciona sin error"""
        standards = filters_data.get("standards", [])
        if not standards:
            pytest.skip("No hay estándares disponibles")
        std = standards[0]
        r = requests.get(f"{api}/partners/reports?standard_id={std['id']}&per_page=5", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for row in data["rows"]:
            if row.get("standard_code"):
                assert row["standard_code"] == std["code"]

    def test_gender_filter(self, api, headers):
        """Filtrar por género M/F funciona"""
        for gender in ("M", "F"):
            r = requests.get(f"{api}/partners/reports?gender={gender}&per_page=5", headers=headers)
            assert r.status_code == 200
            data = r.json()
            for row in data["rows"]:
                if row.get("gender"):
                    assert row["gender"] == gender, \
                        f"Esperado gender='{gender}', obtenido '{row['gender']}'"

    def test_curp_verified_filter(self, api, headers):
        """Filtrar por curp_verified=1 retorna solo verificados"""
        r = requests.get(f"{api}/partners/reports?curp_verified=1&per_page=10", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for row in data["rows"]:
            assert row["curp_verified"] is True

    def test_curp_not_verified_filter(self, api, headers):
        """Filtrar por curp_verified=0 retorna solo no verificados"""
        r = requests.get(f"{api}/partners/reports?curp_verified=0&per_page=10", headers=headers)
        assert r.status_code == 200
        data = r.json()
        for row in data["rows"]:
            assert row["curp_verified"] is False
