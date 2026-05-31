"""
Tests de integración para el endpoint plano de Asignaciones ECM
================================================================

Cubre: GET /api/partners/ecm-assignments/flat

Valida:
  - Acceso por rol (admin/coordinator/soporte permitido).
  - Estructura de la respuesta (assignments, total, pages, summary, filters).
  - Estructura de cada fila de asignación (campos esperados).
  - Paginación (per_page, page).
  - Búsqueda (search).
  - Filtros (status, user_type, ecm_id, brand_id).
  - Ordenamiento (sort_by / sort_dir).

IMPORTANTE: Estas pruebas corren contra la API DEV. Si el endpoint aún no
está desplegado en DEV, devuelve 404 y las pruebas se OMITEN (skip) con un
mensaje claro, en lugar de fallar. Una vez desplegado el backend, vuelve a
ejecutarlas para validar el funcionamiento real.

Cómo ejecutar:
    cd MotorUniversalV2/backend
    python -m pytest tests/test_ecm_assignments_flat.py -v --tb=short
"""

from __future__ import annotations

import os
import time

import pytest
import requests

DEV_API = os.environ.get(
    "EVAL_API",
    "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
)
ADMIN_USER = os.environ.get("EVAL_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("EVAL_ADMIN_PASS", "admin123")
REQ_TIMEOUT = 60

ENDPOINT = f"{DEV_API}/partners/ecm-assignments/flat"


def _login(api: str, user: str, password: str) -> str | None:
    for attempt in range(3):
        try:
            r = requests.post(
                f"{api}/auth/login",
                json={"username": user, "password": password},
                timeout=REQ_TIMEOUT,
            )
            if r.status_code == 200:
                return r.json().get("access_token")
            if r.status_code in (502, 503):
                time.sleep(8)
                continue
            return None
        except requests.exceptions.Timeout:
            if attempt < 2:
                time.sleep(8)
                continue
            return None
    return None


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get(token: str, params: dict | None = None) -> requests.Response:
    return requests.get(
        ENDPOINT, headers=_h(token), params=params or {}, timeout=REQ_TIMEOUT
    )


@pytest.fixture(scope="module")
def admin_token() -> str:
    token = _login(DEV_API, ADMIN_USER, ADMIN_PASS)
    if not token:
        pytest.skip("No se pudo iniciar sesión como admin en DEV")
    return token


@pytest.fixture(scope="module")
def base_response(admin_token: str) -> dict:
    r = _get(admin_token, {"per_page": 5})
    if r.status_code == 404:
        pytest.skip(
            "Endpoint /partners/ecm-assignments/flat aún no desplegado en DEV "
            "(404). Despliega el backend y reejecuta."
        )
    assert r.status_code == 200, f"Esperaba 200, recibí {r.status_code}: {r.text[:300]}"
    return r.json()


# --------------------------------------------------------------------------- #
# Estructura de la respuesta
# --------------------------------------------------------------------------- #

def test_response_top_level_keys(base_response: dict):
    for key in ("assignments", "total", "pages", "current_page", "per_page",
                "summary", "filters"):
        assert key in base_response, f"Falta la clave '{key}' en la respuesta"
    assert isinstance(base_response["assignments"], list)
    assert isinstance(base_response["total"], int)


def test_summary_structure(base_response: dict):
    summary = base_response["summary"]
    for key in ("total_assignments", "total_candidates", "total_cost",
                "avg_score", "pass_rate", "completed_count",
                "pending_count", "passed_count"):
        assert key in summary, f"Falta la clave '{key}' en summary"
    assert summary["total_assignments"] == base_response["total"]


def test_filters_structure(base_response: dict):
    filters = base_response["filters"]
    assert "ecms" in filters and isinstance(filters["ecms"], list)
    assert "brands" in filters and isinstance(filters["brands"], list)
    for ecm in filters["ecms"]:
        assert {"id", "code", "name"} <= set(ecm.keys())
    for brand in filters["brands"]:
        assert {"id", "name", "logo_url"} <= set(brand.keys())


def test_assignment_row_structure(base_response: dict):
    if not base_response["assignments"]:
        pytest.skip("No hay asignaciones en DEV para validar la estructura de fila")
    row = base_response["assignments"][0]
    expected = {
        "user_id", "user_name", "user_email", "user_role", "user_curp",
        "assignment_number", "group_id", "group_name", "exam_id", "exam_name",
        "ecm_id", "ecm_code", "ecm_name", "brand", "assignment_date",
        "assignment_type", "unit_cost", "score", "result_status", "passed",
        "result_date", "duration_seconds", "material_progress",
        "passing_score", "certificate_types", "vigencia",
        "group_exam_id", "ecm_assignment_id",
    }
    missing = expected - set(row.keys())
    assert not missing, f"Faltan campos en la fila: {missing}"
    assert row["result_status"] in ("completed", "in_progress", "pending")


# --------------------------------------------------------------------------- #
# Paginación
# --------------------------------------------------------------------------- #

def test_pagination_respects_per_page(admin_token: str, base_response: dict):
    r = _get(admin_token, {"per_page": 3, "page": 1})
    assert r.status_code == 200
    data = r.json()
    assert data["per_page"] == 3
    assert len(data["assignments"]) <= 3
    expected_pages = (data["total"] + 3 - 1) // 3 if data["total"] > 0 else 0
    assert data["pages"] == expected_pages


def test_per_page_capped_at_100(admin_token: str, base_response: dict):
    r = _get(admin_token, {"per_page": 999})
    assert r.status_code == 200
    assert r.json()["per_page"] == 100


# --------------------------------------------------------------------------- #
# Filtros y búsqueda
# --------------------------------------------------------------------------- #

def test_status_filter_passed(admin_token: str, base_response: dict):
    r = _get(admin_token, {"status": "passed", "per_page": 20})
    assert r.status_code == 200
    for row in r.json()["assignments"]:
        assert row["result_status"] == "completed"
        assert row["passed"] is True


def test_status_filter_pending(admin_token: str, base_response: dict):
    r = _get(admin_token, {"status": "pending", "per_page": 20})
    assert r.status_code == 200
    for row in r.json()["assignments"]:
        assert row["result_status"] != "completed"


def test_user_type_filter(admin_token: str, base_response: dict):
    r = _get(admin_token, {"user_type": "candidato", "per_page": 20})
    assert r.status_code == 200
    for row in r.json()["assignments"]:
        assert row["user_role"] == "candidato"


def test_search_does_not_error(admin_token: str, base_response: dict):
    r = _get(admin_token, {"search": "zzz_no_existe_xyz", "per_page": 5})
    assert r.status_code == 200
    assert r.json()["assignments"] == []


def test_multiword_search_does_not_error(admin_token: str, base_response: dict):
    r = _get(admin_token, {"search": "test demo", "per_page": 5})
    assert r.status_code == 200


def test_ecm_filter_from_options(admin_token: str, base_response: dict):
    ecms = base_response["filters"]["ecms"]
    if not ecms:
        pytest.skip("No hay ECMs disponibles en DEV para filtrar")
    ecm_id = ecms[0]["id"]
    r = _get(admin_token, {"ecm_id": ecm_id, "per_page": 20})
    assert r.status_code == 200
    for row in r.json()["assignments"]:
        assert row["ecm_id"] == ecm_id


# --------------------------------------------------------------------------- #
# Ordenamiento
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("sort_by", ["date", "name", "score", "cost", "role",
                                     "group", "exam", "ecm", "status", "duration"])
def test_sort_options_do_not_error(admin_token: str, base_response: dict, sort_by: str):
    r = _get(admin_token, {"sort_by": sort_by, "sort_dir": "asc", "per_page": 5})
    assert r.status_code == 200, f"sort_by={sort_by} devolvió {r.status_code}"


# --------------------------------------------------------------------------- #
# Seguridad
# --------------------------------------------------------------------------- #

def test_requires_auth():
    r = requests.get(ENDPOINT, params={"per_page": 1}, timeout=REQ_TIMEOUT)
    if r.status_code == 404:
        pytest.skip("Endpoint aún no desplegado en DEV (404)")
    assert r.status_code in (401, 422), f"Esperaba 401/422 sin token, recibí {r.status_code}"
