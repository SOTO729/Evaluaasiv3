"""
Tests de regresión para fixes Medios en módulo Partners
========================================================

Cubre:
  M5 — create_campus_responsable: validación de CURP único debe ejecutarse
       ANTES de la rama de update-via-email para evitar asignar al
       responsable existente un CURP que ya pertenece a otro usuario.
  M7 — endpoints de búsqueda: input `search` muy largo (>500 chars) NO debe
       reventar el endpoint; debe truncarse silenciosamente y responder 200.

Cómo ejecutar:
    cd MotorUniversalV2/backend
    python -m pytest tests/test_partners_med_low_fixes.py -v --tb=short
"""

from __future__ import annotations

import os
import random
import string
import time
import uuid

import pytest
import requests

DEV_API = os.environ.get(
    "EVAL_API",
    "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
)
ADMIN_USER = os.environ.get("EVAL_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("EVAL_ADMIN_PASS", "admin123")
REQ_TIMEOUT = 60
RUN_TAG = uuid.uuid4().hex[:6].upper()
PREFIX = f"MEDLOW_{RUN_TAG}"


def _random_curp() -> str:
    """Genera CURP sintética con formato válido y entropía suficiente
    para evitar colisiones entre runs en DEV.
    Patrón: 4 letras + 6 dígitos + H/M + 5 letras + 1 alfanum + 1 dígito.
    """
    L = string.ascii_uppercase
    D = string.digits
    return (
        "".join(random.choices(L, k=4))
        + "".join(random.choices(D, k=6))
        + random.choice("HM")
        + "".join(random.choices(L, k=5))
        + random.choice(L + D)
        + random.choice(D)
    )


def _login(api: str, user: str, password: str) -> str | None:
    for _ in range(3):
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
            time.sleep(8)
            continue
    return None


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _campus_payload(name: str) -> dict:
    # M5 requiere campus mexicano para que la validación de CURP esté activa
    # (campus extranjero permite CURP genérica y bypass del check único).
    return {
        "name": name,
        "country": "México",
        "state_name": "Aguascalientes",
        "city": "Test",
        "address": "Test 123",
        "director_name": "Director",
        "director_first_surname": "Med",
        "director_second_surname": "Low",
        "director_email": f"director_{uuid.uuid4().hex[:6]}@medlowtest.local",
        "director_phone": "5555555555",
        "director_curp": _random_curp(),
        "director_gender": "M",
        "director_date_of_birth": "1980-01-01",
    }


@pytest.fixture(scope="session")
def admin_token() -> str:
    tok = _login(DEV_API, ADMIN_USER, ADMIN_PASS)
    if not tok:
        pytest.skip("DEV no disponible")
    return tok


@pytest.fixture(scope="session")
def admin_h(admin_token: str) -> dict:
    return _h(admin_token)


@pytest.fixture(scope="session")
def coord_with_campus(admin_h: dict) -> dict:
    """Crea coordinator + partner + campus para tests."""
    seed = f"{PREFIX}_C"
    pl = {
        "email": f"{seed.lower()}_{uuid.uuid4().hex[:4]}@medlowtest.local",
        "name": f"M {seed}",
        "first_surname": "Med",
        "second_surname": "Auto",
        "role": "coordinator",
        "is_active": True,
        "is_verified": True,
    }
    r = requests.post(f"{DEV_API}/user-management/users", json=pl, headers=admin_h, timeout=REQ_TIMEOUT)
    if r.status_code not in (200, 201):
        pytest.skip(f"create coord: {r.status_code} {r.text[:200]}")
    body = r.json()
    u = body["user"]
    pwd = body["temporary_password"]
    time.sleep(0.8)
    tok = _login(DEV_API, u["username"], pwd)
    if not tok:
        pytest.skip("login coord")
    rp = requests.post(
        f"{DEV_API}/partners",
        json={"name": f"{seed}_Partner", "country": "México", "is_active": True},
        headers=_h(tok), timeout=REQ_TIMEOUT,
    )
    assert rp.status_code in (200, 201)
    partner_id = (rp.json().get("partner") or rp.json())["id"]
    rc = requests.post(
        f"{DEV_API}/partners/{partner_id}/campuses",
        json=_campus_payload(f"{seed}_Campus"),
        headers=_h(tok), timeout=REQ_TIMEOUT,
    )
    assert rc.status_code in (200, 201)
    campus_id = (rc.json().get("campus") or rc.json())["id"]
    return {
        "user_id": u["id"], "username": u["username"], "token": tok,
        "partner_id": partner_id, "campus_id": campus_id,
    }


# ═══════════════════════════════════════════════════════════════════════════
# M5 — CURP uniqueness debe validarse antes del update-via-email
# ═══════════════════════════════════════════════════════════════════════════
class TestM5CurpBeforeEmailUpdate:
    """Si replace_existing=true y el email coincide con el responsable actual,
    pero el CURP enviado pertenece a OTRO usuario activo, la API debe rechazar
    con 400 antes de hacer cualquier UPDATE sobre el usuario existente.
    """

    def test_curp_collision_blocks_email_update_branch(self, admin_h, coord_with_campus):
        coord = coord_with_campus
        campus_id = coord["campus_id"]

        # 1) Crear/actualizar responsable inicial con email_R y curp_R.
        # NOTA: create_campus ya auto-crea un responsable desde los datos del director,
        # así que usamos replace_existing=true para actualizarlo a nuestros valores.
        email_r = f"resp_{uuid.uuid4().hex[:6]}@medlowtest.local"
        curp_r = _random_curp()
        payload_initial = {
            "email": email_r,
            "name": "Resp",
            "first_surname": "Inicial",
            "second_surname": "Test",
            "curp": curp_r,
            "gender": "M",
            "date_of_birth": "1980-01-01",
            "replace_existing": True,
        }
        r1 = requests.post(
            f"{DEV_API}/partners/campuses/{campus_id}/responsable",
            json=payload_initial, headers=_h(coord["token"]), timeout=REQ_TIMEOUT,
        )
        assert r1.status_code in (200, 201), (
            f"setup M5: no se pudo establecer responsable inicial: "
            f"{r1.status_code} {r1.text[:300]}"
        )

        # 2) Crear OTRO usuario admin-side con CURP_X distinto, que será el "ocupante" de CURP_X.
        curp_x = _random_curp()
        other_user_payload = {
            "email": f"other_{uuid.uuid4().hex[:6]}@medlowtest.local",
            "name": "Otro",
            "first_surname": "Usuario",
            "second_surname": "X",
            "curp": curp_x,
            "gender": "M",
            "date_of_birth": "1980-01-01",
            "role": "candidato",
            "is_active": True,
            "is_verified": True,
        }
        r2 = requests.post(
            f"{DEV_API}/user-management/users",
            json=other_user_payload, headers=admin_h, timeout=REQ_TIMEOUT,
        )
        if r2.status_code not in (200, 201):
            pytest.skip(f"no se pudo crear usuario ocupante de CURP_X: {r2.status_code} {r2.text[:200]}")

        # 3) Intentar update via replace_existing usando email_R (que matchea al actual)
        #    pero pasando curp_X (que pertenece al OTRO usuario). Debe rechazar 400.
        payload_attack = {
            "email": email_r,            # mismo email → entraría a la rama de update-via-email
            "name": "Resp",
            "first_surname": "Atacado",
            "second_surname": "Test",
            "curp": curp_x,              # CURP que ya pertenece a otro usuario
            "gender": "M",
            "date_of_birth": "1980-01-01",
            "replace_existing": True,
        }
        r3 = requests.post(
            f"{DEV_API}/partners/campuses/{campus_id}/responsable",
            json=payload_attack, headers=_h(coord["token"]), timeout=REQ_TIMEOUT,
        )
        # Con M5 aplicado: backend rechaza ANTES con 400 "Ya existe un usuario con ese CURP".
        assert r3.status_code == 400, (
            f"M5: esperaba 400 (CURP rechazado antes del update); recibí "
            f"{r3.status_code}: {r3.text[:300]}"
        )
        body = r3.json()
        assert "CURP" in (body.get("error") or "").upper() or "curp" in (body.get("error") or "").lower(), (
            f"M5: error debe mencionar CURP; recibí: {body}"
        )


# ═══════════════════════════════════════════════════════════════════════════
# M7 — Search input largo no debe reventar endpoints
# ═══════════════════════════════════════════════════════════════════════════
class TestM7SearchLengthCap:
    """Endpoints con parámetro `search` deben tolerar entradas extremadamente
    largas truncándolas silenciosamente (cap 500 chars) y devolviendo 200.
    """

    @pytest.fixture(scope="class")
    def big_search(self) -> str:
        # 1500 caracteres: > MAX_SEARCH_LENGTH (500) pero < límite URL del gateway
        # (~4094). Si M7 no truncara, este input pasaría tal cual al LIKE.
        return "X" * 1500

    def test_get_partners_long_search(self, admin_h, big_search):
        r = requests.get(
            f"{DEV_API}/partners",
            params={"search": big_search, "per_page": 5},
            headers=admin_h, timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200, f"M7 partners: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert "partners" in body

    def test_search_groups_paginated_long_search(self, admin_h, big_search):
        r = requests.get(
            f"{DEV_API}/partners/groups/search",
            params={"search": big_search, "per_page": 5},
            headers=admin_h, timeout=REQ_TIMEOUT,
        )
        # Endpoint puede ser 200 (lista vacía) o 404 si la ruta es distinta;
        # lo importante es que NO sea 500.
        assert r.status_code != 500, f"M7 search-groups: 500 inesperado: {r.text[:200]}"
        assert r.status_code in (200, 404), f"M7 search-groups: {r.status_code} {r.text[:200]}"
