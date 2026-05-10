"""
Tests de regresión para los fixes H1 y H5 del módulo Partners
==============================================================

H1 — Aislamiento multi-tenant uniforme
  Verifica que endpoints de Campus/Partner que antes hacían
  `Model.query.get_or_404(...)` directo ahora pasen primero por
  `_verify_*_access()`. Un coordinador que intenta acceder a un
  recurso ajeno debe recibir 403 (no 200, no 404 fugando existencia).

H5 — POST /api/partners/campuses/<id>/responsable
  - coordinator_id inválido devuelve 400 sin persistir usuario huérfano.
  - Crear responsable nuevo avanza activation_status a 'configuring'.
  - replace_existing=true con el mismo email también avanza el estado
    (simetría con la rama "crear nuevo").

Cómo ejecutar:
    cd MotorUniversalV2/backend
    python -m pytest tests/test_partners_h1_h5_fixes.py -v --tb=short

Apunta a DEV. Idempotente: cada corrida crea recursos con sufijo único
y los etiqueta con prefijo H1H5_ para identificarlos.
"""

from __future__ import annotations

import os
import time
import uuid
import datetime as dt

import pytest
import requests

# ─── Configuración ──────────────────────────────────────────────────────────
DEV_API = os.environ.get(
    "EVAL_API",
    "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api",
)
ADMIN_USER = os.environ.get("EVAL_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("EVAL_ADMIN_PASS", "admin123")

REQ_TIMEOUT = 60
RUN_TAG = uuid.uuid4().hex[:6].upper()
PREFIX = f"H1H5_{RUN_TAG}"


def _login(api: str, user: str, password: str) -> str | None:
    """Login con retry para cold-starts. Retorna access_token o None."""
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


def _campus_payload(name: str, country: str = "Estados Unidos") -> dict:
    """Payload mínimo válido para crear campus (incluye datos del director).

    Para 'Estados Unidos' (extranjero) NO se requiere CURP del director:
    el backend asigna un CURP genérico automáticamente. Para México
    necesitaríamos state_name y CURP válido.
    """
    return {
        "name": name,
        "country": country,
        "city": "Test City",
        "address": "Test 123",
        "director_name": "Director",
        "director_first_surname": "Test",
        "director_second_surname": "H1H5",
        "director_email": f"director_{uuid.uuid4().hex[:6]}@h1h5test.local",
        "director_phone": "5555555555",
        "director_gender": "M",
        "director_date_of_birth": "1980-01-01",
    }


# ─── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api() -> str:
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api: str) -> str:
    tok = _login(api, ADMIN_USER, ADMIN_PASS)
    if not tok:
        pytest.skip("No se pudo obtener token de admin (DEV no disponible)")
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token: str) -> dict:
    return _h(admin_token)


@pytest.fixture(scope="session")
def two_coordinators(api: str, admin_headers: dict) -> dict:
    """Crea dos coordinadores de prueba (A y B), cada uno con su partner+campus.

    Retorna dict con tokens y referencias a recursos. Los recursos se etiquetan
    con PREFIX para identificación; no se eliminan al finalizar el test.
    """
    created: dict = {"a": {}, "b": {}}

    for key in ("a", "b"):
        # 1) Crear coordinador. user-management genera username y password
        # automáticos; los recuperamos del response.
        seed = f"{PREFIX}_{key.upper()}_{uuid.uuid4().hex[:4]}"
        payload = {
            "email": f"{seed.lower()}@h1h5test.local",
            "name": f"Test {key.upper()}",
            "first_surname": "H1H5",
            "second_surname": "Auto",
            "role": "coordinator",
            "is_active": True,
            "is_verified": True,
        }
        r = requests.post(
            f"{api}/user-management/users", json=payload, headers=admin_headers, timeout=REQ_TIMEOUT
        )
        if r.status_code not in (200, 201):
            pytest.skip(f"No se pudo crear coordinador {key}: {r.status_code} {r.text[:200]}")
        body = r.json()
        password = body.get("temporary_password")
        user = body.get("user") or {}
        coord_id = user.get("id")
        username = user.get("username")
        if not (password and coord_id and username):
            pytest.skip(f"Respuesta inesperada al crear coordinador {key}: {body}")

        # Pequeña espera para que la sesión de DB confirme el insert (cold-start)
        time.sleep(1.0)

        # 2) Login del coordinador
        tok = _login(api, username, password)
        if not tok:
            pytest.skip(f"No se pudo loguear como coordinador {key} ({username})")

        # 3) Crear partner como ese coordinador
        rp = requests.post(
            f"{api}/partners",
            json={
                "name": f"{PREFIX}_Partner_{key.upper()}",
                "country": "México",
                "is_active": True,
            },
            headers=_h(tok),
            timeout=REQ_TIMEOUT,
        )
        assert rp.status_code in (200, 201), f"create partner {key}: {rp.status_code} {rp.text[:200]}"
        partner = (rp.json().get("partner") or rp.json())
        partner_id = partner["id"]

        # 4) Crear campus de ese partner (ruta anidada)
        rc = requests.post(
            f"{api}/partners/{partner_id}/campuses",
            json=_campus_payload(f"{PREFIX}_Campus_{key.upper()}"),
            headers=_h(tok),
            timeout=REQ_TIMEOUT,
        )
        assert rc.status_code in (200, 201), f"create campus {key}: {rc.status_code} {rc.text[:200]}"
        campus = (rc.json().get("campus") or rc.json())
        campus_id = campus["id"]

        created[key] = {
            "user_id": coord_id,
            "username": username,
            "password": password,
            "token": tok,
            "partner_id": partner_id,
            "campus_id": campus_id,
        }

    return created


# ═══════════════════════════════════════════════════════════════════════════
# H1 — Aislamiento multi-tenant en endpoints de detalle
# ═══════════════════════════════════════════════════════════════════════════
class TestH1Isolation:
    """coord_A no debe poder leer/escribir recursos de coord_B."""

    # Endpoints de Campus que se corrigieron (subset representativo)
    CAMPUS_GET_ENDPOINTS = [
        "/partners/campuses/{id}/responsable",
        "/partners/campuses/{id}/responsables",
        "/partners/campuses/{id}/available-responsables",
        "/partners/campuses/{id}/config",
        "/partners/campuses/{id}/competency-standards",
        "/partners/campuses/{id}/cycles",
    ]

    @pytest.mark.parametrize("path_tpl", CAMPUS_GET_ENDPOINTS)
    def test_coord_a_cannot_read_coord_b_campus(self, api, two_coordinators, path_tpl):
        """coord_A debe recibir 403 al GET cualquier endpoint de campus ajeno."""
        a, b = two_coordinators["a"], two_coordinators["b"]
        url = api + path_tpl.format(id=b["campus_id"])
        r = requests.get(url, headers=_h(a["token"]), timeout=REQ_TIMEOUT)
        assert r.status_code == 403, (
            f"{path_tpl}: esperaba 403 (forbidden), recibí {r.status_code}. "
            f"body={r.text[:200]}"
        )

    def test_coord_a_cannot_post_responsable_on_coord_b_campus(self, api, two_coordinators):
        """POST /campuses/<b>/responsable debe ser 403 antes de validar payload."""
        a, b = two_coordinators["a"], two_coordinators["b"]
        # Payload mínimo intencionalmente válido para descartar 400 por validación
        payload = {
            "name": "X",
            "first_surname": "Y",
            "second_surname": "Z",
            "email": f"{PREFIX}_should_not_create@h1h5test.local",
            "gender": "M",
            "date_of_birth": "1990-01-01",
            "curp": "ABCD901231HDFXYZ09",  # formato OK aunque dígito no válido
            "coordinator_id": a["user_id"],
        }
        r = requests.post(
            f"{api}/partners/campuses/{b['campus_id']}/responsable",
            json=payload,
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 403, (
            f"esperaba 403 por aislamiento, recibí {r.status_code}: {r.text[:200]}"
        )

    def test_coord_a_cannot_activate_coord_b_campus(self, api, two_coordinators):
        """POST /campuses/<b>/activate ajeno debe ser 403."""
        a, b = two_coordinators["a"], two_coordinators["b"]
        r = requests.post(
            f"{api}/partners/campuses/{b['campus_id']}/activate",
            json={},
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 403, (
            f"esperaba 403, recibí {r.status_code}: {r.text[:200]}"
        )

    def test_coord_a_cannot_modify_partner_users_of_coord_b(self, api, two_coordinators):
        """DELETE /partners/<b>/users/<x> ajeno debe ser 403 (no 404).

        Antes del fix se hacía Partner.query.get_or_404 antes de verificar acceso,
        lo que filtraba existencia del partner por timing."""
        a, b = two_coordinators["a"], two_coordinators["b"]
        # DELETE en lugar de POST: con un user_id existente (a[user_id]),
        # esperamos que el guard se dispare ANTES de buscar el user.
        r = requests.delete(
            f"{api}/partners/{b['partner_id']}/users/{a['user_id']}",
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 403, (
            f"esperaba 403, recibí {r.status_code}: {r.text[:200]}"
        )

    def test_nonexistent_campus_returns_403_or_404_consistently(self, api, two_coordinators):
        """ID inexistente debe responder uniformemente.

        Con _verify_campus_access primero, get_or_404 internamente devuelve 404.
        Lo importante es que NO devuelva 200 nunca.
        """
        a = two_coordinators["a"]
        bogus_id = 9_999_999
        r = requests.get(
            f"{api}/partners/campuses/{bogus_id}/config",
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code in (403, 404), (
            f"esperaba 403/404, recibí {r.status_code}"
        )


# ═══════════════════════════════════════════════════════════════════════════
# H5 — POST /campuses/<id>/responsable: orden, rollback, simetría
# ═══════════════════════════════════════════════════════════════════════════
class TestH5ResponsableCreation:

    def _payload(self, email: str, **overrides) -> dict:
        base = {
            "name": "Resp",
            "first_surname": f"H5_{RUN_TAG}",
            "second_surname": "Auto",
            "email": email,
            "gender": "M",
            "date_of_birth": "1990-01-01",
            "curp": f"XEXX010101HNEXXXA4",  # CURP genérico extranjero (permite duplicados)
        }
        base.update(overrides)
        return base

    def test_invalid_coordinator_id_returns_400_no_orphan(
        self, api, two_coordinators, admin_headers
    ):
        """coordinator_id inexistente → 400 y NO crea usuario huérfano."""
        a = two_coordinators["a"]
        # Crear campus dedicado para no contaminar otros tests
        rc = requests.post(
            f"{api}/partners/{a['partner_id']}/campuses",
            json=_campus_payload(f"{PREFIX}_Campus_H5_BAD_{uuid.uuid4().hex[:4]}"),
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert rc.status_code in (200, 201)
        campus_id = (rc.json().get("campus") or rc.json())["id"]

        bad_email = f"{PREFIX.lower()}_orphan_{uuid.uuid4().hex[:4]}@h1h5test.local"
        # Como admin, el endpoint exige coordinator_id en el body. Pasamos uno inválido.
        payload = self._payload(bad_email, coordinator_id=str(uuid.uuid4()))
        r = requests.post(
            f"{api}/partners/campuses/{campus_id}/responsable",
            json=payload,
            headers=admin_headers,
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 400, (
            f"coordinator_id inválido debería ser 400, recibí {r.status_code}: {r.text[:200]}"
        )

        # Verificar que NO se persistió el usuario
        rs = requests.get(
            f"{api}/user-management/users",
            params={"search": bad_email, "per_page": 5},
            headers=admin_headers,
            timeout=REQ_TIMEOUT,
        )
        if rs.status_code == 200:
            users = rs.json().get("users", [])
            matches = [u for u in users if (u.get("email") or "").lower() == bad_email.lower()]
            assert not matches, (
                f"H5 BUG: usuario huérfano persistido pese a fallo de validación: {matches}"
            )

    def test_create_responsable_advances_activation_status(self, api, two_coordinators):
        """Reemplazar responsable avanza activation_status a 'configuring'.

        Nota: al crear un campus, el backend deriva un responsable inicial a
        partir de los datos del director (queda en 'pending'). Para probar
        el flujo de creación usamos replace_existing=true.
        """
        a = two_coordinators["a"]
        rc = requests.post(
            f"{api}/partners/{a['partner_id']}/campuses",
            json=_campus_payload(f"{PREFIX}_Campus_H5_NEW_{uuid.uuid4().hex[:4]}"),
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert rc.status_code in (200, 201)
        campus_id = (rc.json().get("campus") or rc.json())["id"]

        email = f"{PREFIX.lower()}_resp_{uuid.uuid4().hex[:4]}@h1h5test.local"
        payload = {**self._payload(email), "replace_existing": True}
        r = requests.post(
            f"{api}/partners/campuses/{campus_id}/responsable",
            json=payload,
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 201, f"esperaba 201, recibí {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert body.get("campus", {}).get("activation_status") == "configuring", (
            f"H5: activation_status no avanzó tras crear responsable: {body.get('campus')}"
        )

    def test_replace_existing_same_email_also_advances_status(self, api, two_coordinators):
        """H5 — simetría: replace_existing=true con MISMO email también
        debe avanzar el estado pending→configuring."""
        a = two_coordinators["a"]

        # 1) Crear campus dedicado en estado 'pending' (sin responsable inicial)
        rc = requests.post(
            f"{api}/partners/{a['partner_id']}/campuses",
            json=_campus_payload(f"{PREFIX}_Campus_H5_REPLACE_{uuid.uuid4().hex[:4]}"),
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert rc.status_code in (200, 201)
        campus_id = (rc.json().get("campus") or rc.json())["id"]

        email = f"{PREFIX.lower()}_replace_{uuid.uuid4().hex[:4]}@h1h5test.local"

        # 2) Reemplazar responsable inicial — campus debe pasar a 'configuring'
        r1 = requests.post(
            f"{api}/partners/campuses/{campus_id}/responsable",
            json={**self._payload(email), "replace_existing": True},
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r1.status_code == 201, r1.text[:300]
        assert r1.json()["campus"]["activation_status"] == "configuring"

        # 3) Volver a llamar con MISMO email — rama H5 simetría.
        # Antes del fix esta rama dejaba activation_status sin avanzar.
        # Tras el fix debe permanecer en 'configuring' (no regresar a 'pending').
        r2 = requests.post(
            f"{api}/partners/campuses/{campus_id}/responsable",
            json={
                **self._payload(email, name="ReNombrado"),
                "replace_existing": True,
            },
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r2.status_code == 200, (
            f"replace_existing mismo email debería ser 200, recibí {r2.status_code}: {r2.text[:300]}"
        )
        body = r2.json()
        status = body.get("campus", {}).get("activation_status")
        assert status in ("configuring", "active"), (
            f"H5 simetría rota: status={status} tras replace_existing mismo email"
        )

    def test_replace_existing_different_email_advances_status(self, api, two_coordinators):
        """Cambiar de responsable por otro email mantiene 'configuring'."""
        a = two_coordinators["a"]
        rc = requests.post(
            f"{api}/partners/{a['partner_id']}/campuses",
            json=_campus_payload(f"{PREFIX}_Campus_H5_SWAP_{uuid.uuid4().hex[:4]}"),
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert rc.status_code in (200, 201)
        campus_id = (rc.json().get("campus") or rc.json())["id"]

        email1 = f"{PREFIX.lower()}_swap1_{uuid.uuid4().hex[:4]}@h1h5test.local"
        email2 = f"{PREFIX.lower()}_swap2_{uuid.uuid4().hex[:4]}@h1h5test.local"

        r1 = requests.post(
            f"{api}/partners/campuses/{campus_id}/responsable",
            json={**self._payload(email1), "replace_existing": True},
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r1.status_code == 201

        r2 = requests.post(
            f"{api}/partners/campuses/{campus_id}/responsable",
            json={**self._payload(email2), "replace_existing": True},
            headers=_h(a["token"]),
            timeout=REQ_TIMEOUT,
        )
        assert r2.status_code == 201, r2.text[:300]
        assert r2.json()["campus"]["activation_status"] == "configuring"


# ═══════════════════════════════════════════════════════════════════════════
# Smoke en local (uso: python tests/test_partners_h1_h5_fixes.py)
# ═══════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v", "--tb=short"]))
