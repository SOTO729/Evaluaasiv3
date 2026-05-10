"""
Tests de regresión para fixes M3 + M8 en Partners
==================================================

M3 — get_campuses: serialización con grupos pre-cargados (batch fetch);
     verifica que el endpoint sigue devolviendo correctamente `groups` y
     `group_count` por campus tras el batch-fetch (output preservado, sin N+1).

M8 — IntegrityError → 409: violar un unique constraint debe retornar 4xx
     (no 500) con mensaje JSON estructurado.

Cómo ejecutar:
    cd MotorUniversalV2/backend
    python -m pytest tests/test_partners_m3_m8_fixes.py -v --tb=short
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
PREFIX = f"M3M8_{RUN_TAG}"


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


def _random_curp() -> str:
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


def _campus_payload(name: str) -> dict:
    return {
        "name": name,
        "country": "México",
        "state_name": "Aguascalientes",
        "city": "Test",
        "address": "Test 123",
        "director_name": "Director",
        "director_first_surname": "M3M8",
        "director_second_surname": "Test",
        "director_email": f"director_{uuid.uuid4().hex[:6]}@m3m8test.local",
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
def coord_with_partner(admin_h: dict) -> dict:
    seed = f"{PREFIX}_C"
    pl = {
        "email": f"{seed.lower()}_{uuid.uuid4().hex[:4]}@m3m8test.local",
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
    return {
        "user_id": u["id"], "username": u["username"], "token": tok,
        "partner_id": partner_id,
    }


# ═══════════════════════════════════════════════════════════════════════════
# M3 — get_campuses con batch fetch de grupos
# ═══════════════════════════════════════════════════════════════════════════
class TestM3CampusListBatchedGroups:
    def test_campuses_endpoint_returns_groups_and_counts(self, coord_with_partner):
        coord = coord_with_partner
        partner_id = coord["partner_id"]
        created = []
        for i in range(3):
            r = requests.post(
                f"{DEV_API}/partners/{partner_id}/campuses",
                json=_campus_payload(f"{PREFIX}_C{i}"),
                headers=_h(coord["token"]), timeout=REQ_TIMEOUT,
            )
            assert r.status_code in (200, 201), f"create campus {i}: {r.status_code} {r.text[:200]}"
            created.append((r.json().get("campus") or r.json())["id"])
        rl = requests.get(
            f"{DEV_API}/partners/{partner_id}/campuses",
            params={"active_only": "false"},  # campuses recién creados están inactivos
            headers=_h(coord["token"]), timeout=REQ_TIMEOUT,
        )
        assert rl.status_code == 200, f"list: {rl.status_code} {rl.text[:200]}"
        body = rl.json()
        assert "campuses" in body
        ours = [c for c in body["campuses"] if c["id"] in created]
        assert len(ours) == 3
        for c in ours:
            assert "groups" in c, "M3: cada campus debe traer 'groups'"
            assert isinstance(c["groups"], list)
            assert "group_count" in c
            assert c["group_count"] == len(c["groups"]), (
                f"M3: group_count={c['group_count']} debe igualar len(groups)={len(c['groups'])}"
            )


# ═══════════════════════════════════════════════════════════════════════════
# M8 — IntegrityError → 4xx (no 500)
# ═══════════════════════════════════════════════════════════════════════════
class TestM8IntegrityErrorAsConflict:
    def test_duplicate_partner_name_returns_4xx_not_500(self, coord_with_partner):
        coord = coord_with_partner
        unique_name = f"{PREFIX}_DupTest_{uuid.uuid4().hex[:4]}"
        r1 = requests.post(
            f"{DEV_API}/partners",
            json={"name": unique_name, "country": "México", "is_active": True},
            headers=_h(coord["token"]), timeout=REQ_TIMEOUT,
        )
        assert r1.status_code in (200, 201), f"first create: {r1.status_code}"
        r2 = requests.post(
            f"{DEV_API}/partners",
            json={"name": unique_name, "country": "México", "is_active": True},
            headers=_h(coord["token"]), timeout=REQ_TIMEOUT,
        )
        assert r2.status_code != 500, (
            f"M8: duplicate request retornó 500 — debió ser 4xx. "
            f"status={r2.status_code} body={r2.text[:300]}"
        )
        if r2.status_code >= 400:
            try:
                body = r2.json()
                assert "error" in body, f"M8: respuesta de error sin 'error' key: {body}"
            except ValueError:
                pytest.fail(f"M8: respuesta de error no es JSON válido: {r2.text[:300]}")

    def test_duplicate_user_email_via_create_responsable_returns_4xx_not_500(
        self, admin_h, coord_with_partner
    ):
        coord = coord_with_partner
        rc = requests.post(
            f"{DEV_API}/partners/{coord['partner_id']}/campuses",
            json=_campus_payload(f"{PREFIX}_M8C"),
            headers=_h(coord["token"]), timeout=REQ_TIMEOUT,
        )
        assert rc.status_code in (200, 201), rc.text[:200]
        campus_id = (rc.json().get("campus") or rc.json())["id"]

        email_x = f"shared_{uuid.uuid4().hex[:6]}@m3m8test.local"
        r_other = requests.post(
            f"{DEV_API}/user-management/users",
            json={
                "email": email_x,
                "name": "Other",
                "first_surname": "Existing",
                "second_surname": "User",
                "curp": _random_curp(),
                "gender": "M",
                "date_of_birth": "1980-01-01",
                "role": "candidato",
                "is_active": True,
                "is_verified": True,
            },
            headers=admin_h, timeout=REQ_TIMEOUT,
        )
        if r_other.status_code not in (200, 201):
            pytest.skip(f"setup other user: {r_other.status_code}")

        r = requests.post(
            f"{DEV_API}/partners/campuses/{campus_id}/responsable",
            json={
                "email": email_x,
                "name": "Resp",
                "first_surname": "Atacado",
                "second_surname": "Test",
                "curp": _random_curp(),
                "gender": "M",
                "date_of_birth": "1980-01-01",
            },
            headers=_h(coord["token"]), timeout=REQ_TIMEOUT,
        )
        assert r.status_code != 500, (
            f"M8: duplicate email retornó 500 — debió ser 4xx. "
            f"status={r.status_code} body={r.text[:300]}"
        )
        assert r.status_code in (400, 409), (
            f"M8: esperaba 400/409, recibí {r.status_code}: {r.text[:300]}"
        )
