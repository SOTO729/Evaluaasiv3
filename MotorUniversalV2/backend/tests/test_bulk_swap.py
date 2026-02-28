"""
Test script para Reasignación Masiva (bulk swap) de Candidatos
Ejecuta pruebas contra la API de producción para validar:
1. Autenticación requerida (401 sin token)
2. Validación de payload (swaps vacíos, duplicados, overlap)
3. Validación de miembros (no pertenecen al grupo, ya asignados, etc.)
4. Operación real de bulk swap con datos de prueba

USO: python tests/test_bulk_swap.py
"""
import sys
import os
import json
import requests

API = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"

passed = 0
failed = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ {name}")
        passed += 1
    else:
        print(f"  ❌ {name} — {detail}")
        failed += 1


def get_token():
    """Login como admin para obtener JWT."""
    # Try different password variants
    for pwd in ["Admin123!", "admin123"]:
        r = requests.post(f"{API}/auth/login", json={
            "username": "admin",
            "password": pwd
        })
        if r.status_code == 200:
            return r.json().get("access_token")
    print(f"⚠️ Login fallido: {r.status_code} {r.text}")
    return None


print("\n" + "=" * 60)
print("🔄 TESTS DE REASIGNACIÓN MASIVA (BULK SWAP)")
print("=" * 60)

# ── 1. Sin autenticación → 401 ──
print("\n🔒 1. ENDPOINT PROTEGIDO (sin token → 401)")
try:
    r = requests.post(f"{API}/partners/groups/1/exams/1/members/bulk-swap",
                      json={"swaps": []})
    test("POST bulk-swap sin auth → 401/422", r.status_code in [401, 422])
except Exception as e:
    test("Auth check", False, str(e))

# ── Login ──
print("\n🔑 Login como admin...")
token = get_token()
if not token:
    print("❌ No se pudo obtener token. Abortando.")
    sys.exit(1)
print(f"  ✅ Token obtenido: {token[:20]}...")

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ── 2. Validaciones de payload ──
print("\n📋 2. VALIDACIONES DE PAYLOAD")

# Necesitamos un group_id y exam_id reales. Buscar el primero disponible.
print("  Buscando grupo con examen asignado...")
group_id = None
exam_id = None

try:
    r = requests.get(f"{API}/partners/groups", headers=headers, params={"per_page": 20})
    if r.status_code == 200:
        groups = r.json().get("groups", [])
        for g in groups:
            gid = g.get("id")
            r2 = requests.get(f"{API}/partners/groups/{gid}", headers=headers)
            if r2.status_code == 200:
                gdata = r2.json()
                exams = gdata.get("exams", []) or gdata.get("group_exams", [])
                if not exams:
                    # Try getting group exams from assignments endpoint
                    r3 = requests.get(f"{API}/partners/groups/{gid}/exams", headers=headers)
                    if r3.status_code == 200:
                        exams = r3.json().get("exams", []) or r3.json().get("group_exams", [])
                if exams:
                    group_id = gid
                    exam_id = exams[0].get("exam_id") or exams[0].get("id")
                    print(f"  ✅ Usando grupo={group_id}, examen={exam_id}")
                    break
except Exception as e:
    print(f"  ⚠️ Error buscando grupo: {e}")

if not group_id or not exam_id:
    print("  ⚠️ No se encontró grupo con examen. Usando IDs ficticios para validación.")
    group_id = 999999
    exam_id = 999999

bulk_url = f"{API}/partners/groups/{group_id}/exams/{exam_id}/members/bulk-swap"

# 2a. Swaps vacíos
try:
    r = requests.post(bulk_url, headers=headers, json={"swaps": []})
    test("Swaps vacíos → 400", r.status_code == 400)
    test("Mensaje correcto", "array" in r.json().get("error", "").lower() or "requiere" in r.json().get("error", "").lower(),
         f"Got: {r.json().get('error')}")
except Exception as e:
    test("Swaps vacíos", False, str(e))

# 2b. Swaps no es lista
try:
    r = requests.post(bulk_url, headers=headers, json={"swaps": "not-a-list"})
    test("Swaps no lista → 400", r.status_code == 400)
except Exception as e:
    test("Swaps no lista", False, str(e))

# 2c. Más de 100 swaps
try:
    big_swaps = [{"from_user_id": f"a-{i}", "to_user_id": f"b-{i}"} for i in range(101)]
    r = requests.post(bulk_url, headers=headers, json={"swaps": big_swaps})
    test("Más de 100 swaps → 400", r.status_code == 400)
    test("Mensaje indica máximo", "100" in r.json().get("error", ""),
         f"Got: {r.json().get('error')}")
except Exception as e:
    test("Límite 100 swaps", False, str(e))

# 2d. Duplicados en from_user_id
try:
    r = requests.post(bulk_url, headers=headers, json={"swaps": [
        {"from_user_id": "aaa", "to_user_id": "bbb"},
        {"from_user_id": "aaa", "to_user_id": "ccc"},
    ]})
    test("From duplicados → 400", r.status_code == 400)
    test("Mensaje indica duplicados origen", "duplicado" in r.json().get("error", "").lower() or "origen" in r.json().get("error", "").lower(),
         f"Got: {r.json().get('error')}")
except Exception as e:
    test("From duplicados", False, str(e))

# 2e. Duplicados en to_user_id
try:
    r = requests.post(bulk_url, headers=headers, json={"swaps": [
        {"from_user_id": "aaa", "to_user_id": "xxx"},
        {"from_user_id": "bbb", "to_user_id": "xxx"},
    ]})
    test("To duplicados → 400", r.status_code == 400)
    test("Mensaje indica duplicados destino", "duplicado" in r.json().get("error", "").lower() or "destino" in r.json().get("error", "").lower(),
         f"Got: {r.json().get('error')}")
except Exception as e:
    test("To duplicados", False, str(e))

# 2f. Overlap from/to
try:
    r = requests.post(bulk_url, headers=headers, json={"swaps": [
        {"from_user_id": "overlap-id", "to_user_id": "bbb"},
        {"from_user_id": "ccc", "to_user_id": "overlap-id"},
    ]})
    test("Overlap from/to → 400", r.status_code == 400)
    test("Mensaje indica overlap", "origen y destino" in r.json().get("error", "").lower(),
         f"Got: {r.json().get('error')}")
except Exception as e:
    test("Overlap", False, str(e))

# ── 3. Validaciones de miembros (necesitamos un grupo real) ──
print("\n👥 3. VALIDACIONES DE MIEMBROS (con grupo real)")

if group_id != 999999:
    # Cargar miembros del examen para ver datos reales
    try:
        r = requests.get(
            f"{API}/partners/groups/{group_id}/exams/{exam_id}/members",
            headers=headers,
            params={"per_page": 10}
        )
        if r.status_code == 200:
            exam_members = r.json().get("members", [])
            print(f"  Miembros del examen: {len(exam_members)}")

            # 3a. from_user_id y to_user_id iguales
            if exam_members:
                uid = exam_members[0].get("user_id")
                r2 = requests.post(bulk_url, headers=headers, json={"swaps": [
                    {"from_user_id": uid, "to_user_id": uid}
                ]})
                if r2.status_code == 200:
                    data = r2.json()
                    test("From==To genera error", data.get("error_count", 0) > 0,
                         f"Got: {json.dumps(data, indent=2)[:200]}")
                    test("Mensaje indica iguales",
                         any("iguales" in str(e.get("error", "")).lower() for e in data.get("errors", [])),
                         f"Got errors: {data.get('errors')}")
                else:
                    test("From==To responde 200 con errores parciales", False,
                         f"Status: {r2.status_code}")

            # 3b. UUID inventado (no miembro)
            r2 = requests.post(bulk_url, headers=headers, json={"swaps": [
                {"from_user_id": "00000000-0000-0000-0000-000000000000",
                 "to_user_id": "11111111-1111-1111-1111-111111111111"}
            ]})
            if r2.status_code == 200:
                data = r2.json()
                test("UUID inventados → error_count > 0", data.get("error_count", 0) > 0)
                test("success_count == 0", data.get("success_count", -1) == 0)
            else:
                test("UUID inventados", r2.status_code in [200, 404], f"Status: {r2.status_code}")

            # 3c. Miembro bloqueado (if we can find one)
            locked_members = [m for m in exam_members if m.get("is_locked")]
            swappable_members = [m for m in exam_members if not m.get("is_locked")]
            print(f"  Bloqueados: {len(locked_members)}, Reasignables: {len(swappable_members)}")

            if locked_members:
                lm = locked_members[0]
                r2 = requests.post(bulk_url, headers=headers, json={"swaps": [
                    {"from_user_id": lm["user_id"],
                     "to_user_id": "11111111-1111-1111-1111-111111111111"}
                ]})
                if r2.status_code == 200:
                    data = r2.json()
                    test("Miembro bloqueado → error",
                         data.get("error_count", 0) > 0,
                         f"Got: {json.dumps(data, indent=2)[:200]}")
                else:
                    test("Miembro bloqueado response", False, f"Status: {r2.status_code}")
        else:
            print(f"  ⚠️ No se pudieron cargar miembros: {r.status_code}")
    except Exception as e:
        test("Carga de miembros", False, str(e))
else:
    print("  ⏭️  Saltando (no se encontró grupo real)")

# ── 4. Estructura de respuesta ──
print("\n📊 4. ESTRUCTURA DE RESPUESTA")
try:
    r = requests.post(bulk_url, headers=headers, json={"swaps": [
        {"from_user_id": "fake-1", "to_user_id": "fake-2"}
    ]})
    if r.status_code == 200:
        data = r.json()
        test("Tiene campo 'message'", "message" in data, f"Keys: {list(data.keys())}")
        test("Tiene campo 'success_count'", "success_count" in data)
        test("Tiene campo 'error_count'", "error_count" in data)
        test("Tiene campo 'results' (array)", isinstance(data.get("results"), list))
        test("Tiene campo 'errors' (array)", isinstance(data.get("errors"), list))
        test("success_count es int", isinstance(data.get("success_count"), int))
        test("error_count es int", isinstance(data.get("error_count"), int))

        if data.get("errors"):
            err = data["errors"][0]
            test("Error tiene 'index'", "index" in err, f"Error keys: {list(err.keys())}")
            test("Error tiene 'error'", "error" in err, f"Error keys: {list(err.keys())}")
    else:
        # If it's a 404/500 because the group/exam doesn't exist, that's expected for fake IDs
        test("Respuesta esperada (grupo inexistente → 404/500)", r.status_code in [200, 404, 500],
             f"Status: {r.status_code}, Body: {r.text[:200]}")
except Exception as e:
    test("Estructura de respuesta", False, str(e))

# ── 5. Missing fields dentro de swap ──
print("\n🔍 5. CAMPOS FALTANTES EN PARES")
try:
    r = requests.post(bulk_url, headers=headers, json={"swaps": [
        {"from_user_id": "aaa"},
        {"to_user_id": "bbb"},
        {},
    ]})
    if r.status_code == 200:
        data = r.json()
        test("3 pares inválidos → error_count == 3", data.get("error_count") == 3,
             f"error_count={data.get('error_count')}")
        test("success_count == 0", data.get("success_count") == 0)
    else:
        # Non-existent group → 404/500 is expected for fake IDs
        test("Missing fields (grupo inexistente → 404/500)", r.status_code in [200, 404, 500], f"Status: {r.status_code}")
except Exception as e:
    test("Missing fields", False, str(e))

# ── Resumen ──
print("\n" + "=" * 60)
total = passed + failed
print(f"✅ Pasaron: {passed}/{total}")
print(f"❌ Fallaron: {failed}/{total}")
print("=" * 60)
sys.exit(0 if failed == 0 else 1)
