"""
Test de CURPs genéricos de extranjero — Validación y unicidad

Cubre:
  1. Crear usuario con CURP genérico masculino (XEXX010101HNEXXXA4) — OK
  2. Crear segundo usuario con mismo CURP genérico masculino — OK (no bloquea)
  3. Crear usuario con CURP genérico femenino (XEXX010101MNEXXXA8) — OK
  4. Crear segundo usuario con mismo CURP genérico femenino — OK (no bloquea)
  5. Actualizar usuario poniendo CURP genérico masculino ya usado — OK
  6. Actualizar usuario poniendo CURP genérico femenino ya usado — OK
  7. Crear usuario con CURP normal duplicado — bloqueado (400)
  8. Actualizar usuario poniendo CURP normal duplicado — bloqueado (400)
  9. Carga masiva preview con CURPs genéricos repetidos — todos "ready"
 10. Carga masiva ejecución con CURPs genéricos repetidos — todos creados

USO: python tests/test_foreign_curp.py [--dev]
"""
import sys
import os
import io
import json
import time
import uuid
import requests

# ── Configuración ──
if "--dev" in sys.argv:
    API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
    ENV_LABEL = "DEV"
else:
    API = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
    ENV_LABEL = "PROD"

FOREIGN_CURP_MALE = "XEXX010101HNEXXXA4"
FOREIGN_CURP_FEMALE = "XEXX010101MNEXXXA8"

passed = 0
failed = 0
created_user_ids = []
TEST_PREFIX = f"FCURP_{uuid.uuid4().hex[:6].upper()}"
REQ_TIMEOUT = 120


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ {name}")
        passed += 1
    else:
        print(f"  ❌ {name} — {detail}")
        failed += 1


def get_token(username="admin", password="Admin123!"):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=REQ_TIMEOUT)
    if r.status_code in (429, 423):
        wait = int(r.json().get("retry_after", 30))
        print(f"  ⏳ Rate limit, esperando {min(wait, 60)}s...")
        time.sleep(min(wait, 60))
        r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=REQ_TIMEOUT)
    if r.status_code == 200:
        return r.json().get("access_token")
    print(f"  ⚠️ Login fallido: {r.status_code} {r.text[:200]}")
    return None


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def create_user(token, suffix, gender="M", curp=None):
    """Crear un candidato de prueba. Retorna (status_code, response_json, user_id)."""
    payload = {
        "name": f"Test{suffix}",
        "first_surname": TEST_PREFIX,
        "second_surname": "X",
        "email": f"{TEST_PREFIX.lower()}_{suffix}@test.com",
        "gender": gender,
        "role": "candidato",
    }
    if curp:
        payload["curp"] = curp
    r = requests.post(f"{API}/user-management/users", json=payload,
                       headers=auth_headers(token), timeout=REQ_TIMEOUT)
    data = r.json() if r.status_code in (200, 201, 400, 409) else {}
    uid = data.get("user", {}).get("id") if r.status_code in (200, 201) else None
    if uid:
        created_user_ids.append(uid)
    return r.status_code, data, uid


def update_user(token, user_id, curp):
    """Actualizar el CURP de un usuario. Retorna (status_code, response_json)."""
    r = requests.put(f"{API}/user-management/users/{user_id}",
                     json={"curp": curp},
                     headers=auth_headers(token), timeout=REQ_TIMEOUT)
    data = r.json() if r.status_code in (200, 400) else {}
    return r.status_code, data


def make_excel_bytes(rows):
    """Crear un Excel en memoria con las columnas de carga masiva (sin CURP para forzar auto-asignación o con CURP)."""
    try:
        import openpyxl
    except ImportError:
        # Fallback: instalar openpyxl
        os.system(f"{sys.executable} -m pip install openpyxl -q")
        import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    headers = ["nombre", "primer_apellido", "segundo_apellido", "genero", "email", "curp"]
    ws.append(headers)
    ws.append(["(Nombre)", "(Primer apellido)", "(Segundo apellido)", "(M/F/O)", "(email)", "(CURP)"])  # Fila 2 = descripciones (template)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


# ══════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════
def main():
    global passed, failed
    print(f"\n{'='*60}")
    print(f"  TEST FOREIGN CURP — {ENV_LABEL} ({API[:60]}...)")
    print(f"  Prefijo prueba: {TEST_PREFIX}")
    print(f"{'='*60}\n")

    # Login
    token = get_token()
    if not token:
        print("❌ No se pudo obtener token de admin. Abortando.")
        sys.exit(1)

    # ── Test 1: Crear usuario con CURP genérico masculino ──
    print("── 1. Crear usuario con CURP genérico masculino ──")
    st1, d1, uid1 = create_user(token, "male1", gender="M", curp=FOREIGN_CURP_MALE)
    test("Crear con CURP masculino genérico", st1 in (200, 201), f"status={st1}, {d1}")

    # ── Test 2: Crear SEGUNDO usuario con mismo CURP genérico masculino ──
    print("── 2. Crear segundo usuario con mismo CURP genérico masculino ──")
    st2, d2, uid2 = create_user(token, "male2", gender="M", curp=FOREIGN_CURP_MALE)
    test("Segundo usuario con mismo CURP masculino genérico — permitido", st2 in (200, 201), f"status={st2}, {d2}")

    # ── Test 3: Crear usuario con CURP genérico femenino ──
    print("── 3. Crear usuario con CURP genérico femenino ──")
    st3, d3, uid3 = create_user(token, "fem1", gender="F", curp=FOREIGN_CURP_FEMALE)
    test("Crear con CURP femenino genérico", st3 in (200, 201), f"status={st3}, {d3}")

    # ── Test 4: Crear SEGUNDO usuario con mismo CURP genérico femenino ──
    print("── 4. Crear segundo usuario con mismo CURP genérico femenino ──")
    st4, d4, uid4 = create_user(token, "fem2", gender="F", curp=FOREIGN_CURP_FEMALE)
    test("Segundo usuario con mismo CURP femenino genérico — permitido", st4 in (200, 201), f"status={st4}, {d4}")

    # ── Test 5: Actualizar usuario poniendo CURP genérico masculino ya usado ──
    print("── 5. Actualizar usuario con CURP genérico masculino ya usado ──")
    if uid3:
        st5, d5 = update_user(token, uid3, FOREIGN_CURP_MALE)
        test("Update a CURP masculino genérico usado — permitido", st5 == 200, f"status={st5}, {d5}")
    else:
        test("Update a CURP masculino genérico (skip: no uid)", False, "uid3 no creado")

    # ── Test 6: Actualizar usuario poniendo CURP genérico femenino ya usado ──
    print("── 6. Actualizar usuario con CURP genérico femenino ya usado ──")
    if uid1:
        st6, d6 = update_user(token, uid1, FOREIGN_CURP_FEMALE)
        test("Update a CURP femenino genérico usado — permitido", st6 == 200, f"status={st6}, {d6}")
    else:
        test("Update a CURP femenino genérico (skip: no uid)", False, "uid1 no creado")

    # ── Test 7: Crear usuario con CURP normal duplicado — bloqueado ──
    print("── 7. Crear usuario con CURP normal duplicado — debe bloquear ──")
    normal_curp = f"GACE{uuid.uuid4().hex[:6].upper()}HDFABC09"[:18]
    st7a, _, uid7 = create_user(token, "norm1", gender="M", curp=normal_curp)
    test("Crear con CURP normal", st7a in (200, 201), f"status={st7a}")
    st7b, d7b, _ = create_user(token, "norm2", gender="M", curp=normal_curp)
    test("Duplicar CURP normal — bloqueado", st7b == 400, f"status={st7b}, {d7b}")

    # ── Test 8: Actualizar usuario poniendo CURP normal duplicado — bloqueado ──
    print("── 8. Actualizar con CURP normal duplicado — debe bloquear ──")
    if uid2 and uid7:
        st8, d8 = update_user(token, uid2, normal_curp)
        test("Update a CURP normal duplicado — bloqueado", st8 == 400, f"status={st8}, {d8}")
    else:
        test("Update CURP normal dup (skip)", False, "uids no disponibles")

    # ── Test 9: Carga masiva preview con CURPs genéricos repetidos ──
    print("── 9. Carga masiva preview con CURPs genéricos repetidos ──")
    excel_rows = [
        [f"Ana{TEST_PREFIX[:4]}", "Garcia", "Lopez", "F", f"{TEST_PREFIX.lower()}_b1@test.com", FOREIGN_CURP_FEMALE],
        [f"Beto{TEST_PREFIX[:4]}", "Perez", "Ruiz", "M", f"{TEST_PREFIX.lower()}_b2@test.com", FOREIGN_CURP_MALE],
        [f"Carla{TEST_PREFIX[:4]}", "Diaz", "Soto", "F", f"{TEST_PREFIX.lower()}_b3@test.com", FOREIGN_CURP_FEMALE],
        [f"David{TEST_PREFIX[:4]}", "Mora", "Rios", "M", f"{TEST_PREFIX.lower()}_b4@test.com", FOREIGN_CURP_MALE],
    ]
    excel_bytes = make_excel_bytes(excel_rows)

    r9 = requests.post(
        f"{API}/user-management/candidates/bulk-upload/preview",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test_foreign.xlsx", excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        timeout=REQ_TIMEOUT,
    )
    if r9.status_code == 200:
        preview = r9.json()
        ready_count = preview.get("summary", {}).get("ready", 0)
        name_matches = preview.get("summary", {}).get("name_matches", 0)
        total_ok = ready_count + name_matches
        errors = preview.get("summary", {}).get("errors", 0)
        skipped = preview.get("summary", {}).get("skipped", 0)
        test("Preview: 4 filas con CURPs genéricos repetidos → todas listas",
             total_ok == 4 and errors == 0,
             f"ready={ready_count}, name_matches={name_matches}, errors={errors}, skipped={skipped}")
    else:
        test("Preview bulk con CURPs genéricos", False, f"status={r9.status_code}, {r9.text[:200]}")

    # ── Test 10: Carga masiva ejecución con CURPs genéricos repetidos ──
    print("── 10. Carga masiva ejecución con CURPs genéricos repetidos ──")
    excel_bytes2 = make_excel_bytes(excel_rows)
    try:
        r10 = requests.post(
            f"{API}/user-management/candidates/bulk-upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test_foreign.xlsx", excel_bytes2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=240,
        )
        if r10.status_code in (200, 201):
            result = r10.json()
            created_count = result.get("summary", {}).get("created", 0)
            err_count = result.get("summary", {}).get("errors", 0)
            # Track created users for cleanup
            for u in result.get("details", {}).get("created", []):
                if u.get("user_id"):
                    created_user_ids.append(u["user_id"])

            test("Bulk upload: 4 usuarios con CURPs genéricos — todos creados",
                 created_count == 4 and err_count == 0,
                 f"created={created_count}, errors={err_count}")
        else:
            test("Bulk upload con CURPs genéricos", False, f"status={r10.status_code}, {r10.text[:300]}")
    except requests.exceptions.Timeout:
        test("Bulk upload con CURPs genéricos (timeout)", False, "Request timed out — el servidor tardó demasiado (probablemente por envío de emails)")

    # ── Limpieza ──
    print("\n── Limpieza ──")
    cleaned = 0
    for uid in created_user_ids:
        r = requests.delete(f"{API}/user-management/users/{uid}",
                            headers=auth_headers(token), timeout=REQ_TIMEOUT)
        if r.status_code in (200, 204, 404):
            cleaned += 1
    # Also clean by prefix
    r_search = requests.get(f"{API}/user-management/users?search={TEST_PREFIX}&per_page=100",
                            headers=auth_headers(token), timeout=REQ_TIMEOUT)
    if r_search.status_code == 200:
        users = r_search.json().get("users", [])
        for u in users:
            if TEST_PREFIX in (u.get("first_surname", "") or ""):
                r_del = requests.delete(f"{API}/user-management/users/{u['id']}",
                                        headers=auth_headers(token), timeout=REQ_TIMEOUT)
                if r_del.status_code in (200, 204, 404):
                    cleaned += 1
    print(f"  Limpiados: {cleaned} usuarios")

    # ── Resumen ──
    print(f"\n{'='*60}")
    print(f"  RESULTADO: {passed} pasaron, {failed} fallaron")
    print(f"{'='*60}\n")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
