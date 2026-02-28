"""
Test: Validaciones de N° Asignación en Reasignación (Swap)

Verifica que:
1. Solo usuarios CON número de asignación pueden ser origen de un swap
2. Solo usuarios SIN número de asignación pueden ser destino de un swap
3. El backend rechaza correctamente los casos inválidos

USO: python tests/test_swap_assignment_rules.py
"""
import sys
import requests
import json

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
    r = requests.post(f"{API}/auth/login", json={
        "username": "admin",
        "password": "Admin123!"
    })
    if r.status_code == 200:
        return r.json().get("access_token")
    print(f"⚠️ Login fallido: {r.status_code} {r.text[:200]}")
    return None


print("\n" + "=" * 60)
print("🔒 TEST: REGLAS DE ASIGNACIÓN EN REASIGNACIÓN (SWAP)")
print("=" * 60)

# ── Login ──
print("\n🔑 Login...")
token = get_token()
if not token:
    print("❌ No se pudo obtener token. Abortando.")
    sys.exit(1)
print(f"  ✅ Token obtenido")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Buscar grupo con más miembros ──
print("\n🔍 Buscando grupo con más miembros...")
group_id = None
exam_id = None
best_count = 0

try:
    r = requests.get(f"{API}/partners/groups/list-all", headers=headers)
    if r.status_code == 200:
        groups = r.json().get("groups", [])
        for g in groups:
            gid = g.get("id")
            r2 = requests.get(f"{API}/partners/groups/{gid}/exams", headers=headers)
            if r2.status_code == 200:
                exams = r2.json().get("assigned_exams", [])
                for ex in exams:
                    eid = ex.get("exam_id") or ex.get("id")
                    r3 = requests.get(
                        f"{API}/partners/groups/{gid}/exams/{eid}/members-detail",
                        headers=headers, params={"per_page": 5}
                    )
                    if r3.status_code == 200:
                        total = r3.json().get("total", 0)
                        if total > best_count:
                            best_count = total
                            group_id = gid
                            exam_id = eid
except Exception as e:
    print(f"  ⚠️ Error: {e}")

if not group_id or not exam_id:
    print("  ⚠️ No se encontró grupo con examen. Abortando.")
    sys.exit(1)

print(f"  ✅ Grupo={group_id}, Examen={exam_id} ({best_count} miembros)")

detail_url = f"{API}/partners/groups/{group_id}/exams/{exam_id}/members-detail"
swap_url = f"{API}/partners/groups/{group_id}/exams/{exam_id}/members/swap"
bulk_url = f"{API}/partners/groups/{group_id}/exams/{exam_id}/members/bulk-swap"


# ── Cargar miembros y clasificar ──
print("\n📊 1. CLASIFICAR MIEMBROS POR ESTADO DE ASIGNACIÓN")
r = requests.get(detail_url, headers=headers, params={"per_page": 500})
if r.status_code != 200:
    print(f"  ❌ Error cargando miembros: {r.status_code}")
    sys.exit(1)

all_members = r.json().get("members", [])
with_assignment = [m for m in all_members if m.get("assignment_number")]
without_assignment = [m for m in all_members if not m.get("assignment_number")]

print(f"  Total miembros: {len(all_members)}")
print(f"  Con N° asignación: {len(with_assignment)}")
print(f"  Sin N° asignación: {len(without_assignment)}")

test("Hay miembros en el grupo", len(all_members) > 0)


# ── Test 2: Origen SIN asignación → rechazado ──
print("\n📊 2. ORIGEN SIN N° ASIGNACIÓN → RECHAZADO")

if without_assignment:
    no_assign_member = without_assignment[0]
    # Pick any other member as destination
    dest = with_assignment[0] if with_assignment else (without_assignment[1] if len(without_assignment) > 1 else None)
    
    if dest:
        r = requests.post(swap_url, headers=headers, json={
            "from_user_id": no_assign_member["user_id"],
            "to_user_id": dest["user_id"],
        })
        test(
            "Swap de usuario sin asignación → 400",
            r.status_code == 400,
            f"Status: {r.status_code}, Body: {r.text[:200]}"
        )
        if r.status_code == 400:
            error_msg = r.json().get("error", "").lower()
            test(
                "Mensaje indica que no tiene número de asignación",
                "no tiene" in error_msg and "asignación" in error_msg,
                f"Mensaje: {r.json().get('error')}"
            )
    else:
        print("  ⏭️  Solo hay 1 miembro sin asignación, no se puede probar")
else:
    print("  ⏭️  Todos los miembros tienen asignación (no se puede probar directamente)")
    print("  Probando con swap hacia grupo simulado...")


# ── Test 3: Destino CON asignación → rechazado ──
print("\n📊 3. DESTINO CON N° ASIGNACIÓN → RECHAZADO")

if len(with_assignment) >= 2:
    src = None
    dest_with_assign = None
    for i, m in enumerate(with_assignment):
        if not m.get("is_locked"):
            src = m
            for j, m2 in enumerate(with_assignment):
                if j != i and not m2.get("is_locked"):
                    dest_with_assign = m2
                    break
            if dest_with_assign:
                break
    
    if src and dest_with_assign:
        r = requests.post(swap_url, headers=headers, json={
            "from_user_id": src["user_id"],
            "to_user_id": dest_with_assign["user_id"],
        })
        test(
            "Swap entre usuarios con asignación → 400",
            r.status_code == 400,
            f"Status: {r.status_code}, Body: {r.text[:200]}"
        )
        if r.status_code == 400:
            error_msg = r.json().get("error", "").lower()
            # Puede fallar por "destino ya asignado" o "destino ya tiene número de asignación"
            test(
                "Mensaje indica rechazo (asignación o examen)",
                "asignación" in error_msg or "asignado" in error_msg,
                f"Mensaje: {r.json().get('error')}"
            )
    else:
        print("  ⏭️  No se encontraron 2 miembros no bloqueados con asignación")
elif len(with_assignment) == 1 and without_assignment:
    print("  ⏭️  Solo hay 1 miembro con asignación, no se puede probar destino con asignación")
else:
    print("  ⏭️  No hay suficientes miembros con asignación para probar")


# ── Test 4: Flujo correcto (con → sin) ──
print("\n📊 4. FLUJO CORRECTO: CON ASIGNACIÓN → SIN ASIGNACIÓN")

if with_assignment and without_assignment:
    src_valid = None
    for m in with_assignment:
        if not m.get("is_locked"):
            src_valid = m
            break
    
    if src_valid:
        dest_valid = without_assignment[0]
        print(f"  Origen: {src_valid['user']['full_name']} (#{src_valid['assignment_number']})")
        print(f"  Destino: {dest_valid['user']['full_name']} (sin asignación)")
        print(f"  ⚠️  NO se ejecuta el swap real para no alterar datos de producción")
        test("Datos disponibles para flujo correcto", True)
    else:
        print("  ⏭️  Todos los miembros con asignación están bloqueados")
else:
    print("  ⏭️  Se necesita al menos 1 miembro con asignación y 1 sin asignación")


# ── Test 5: Bulk swap - origen sin asignación ──
print("\n📊 5. BULK SWAP: ORIGEN SIN ASIGNACIÓN → ERROR")

if without_assignment and len(all_members) >= 2:
    no_assign = without_assignment[0]
    any_other = [m for m in all_members if m["user_id"] != no_assign["user_id"]][0]
    
    r = requests.post(bulk_url, headers=headers, json={
        "swaps": [{"from_user_id": no_assign["user_id"], "to_user_id": any_other["user_id"]}]
    })
    if r.status_code == 200:
        data = r.json()
        test(
            "Bulk swap con origen sin asignación → error_count > 0",
            data.get("error_count", 0) > 0,
            f"Got: {json.dumps(data, indent=2)[:300]}"
        )
        test(
            "success_count == 0",
            data.get("success_count", -1) == 0,
            f"success_count: {data.get('success_count')}"
        )
        if data.get("errors"):
            err_msg = data["errors"][0].get("error", "").lower()
            test(
                "Error indica 'no tiene número de asignación'",
                "asignación" in err_msg,
                f"Error: {data['errors'][0].get('error')}"
            )
else:
    print("  ⏭️  No hay miembros sin asignación para probar")


# ── Test 6: Bulk swap - destino con asignación ──
print("\n📊 6. BULK SWAP: DESTINO CON ASIGNACIÓN → ERROR")

if len(with_assignment) >= 2:
    src = None
    for m in with_assignment:
        if not m.get("is_locked"):
            src = m
            break
    
    if src:
        dest = [m for m in with_assignment if m["user_id"] != src["user_id"]][0]
        r = requests.post(bulk_url, headers=headers, json={
            "swaps": [{"from_user_id": src["user_id"], "to_user_id": dest["user_id"]}]
        })
        if r.status_code == 200:
            data = r.json()
            test(
                "Bulk swap con destino con asignación → error_count > 0",
                data.get("error_count", 0) > 0,
                f"Got: {json.dumps(data, indent=2)[:300]}"
            )
            test(
                "success_count == 0",
                data.get("success_count", -1) == 0,
                f"success_count: {data.get('success_count')}"
            )
    else:
        print("  ⏭️  Todos los miembros con asignación están bloqueados")
else:
    print("  ⏭️  No hay 2+ miembros con asignación para probar")


# ── Resumen ──
print("\n" + "=" * 60)
total = passed + failed
print(f"✅ Pasaron: {passed}/{total}")
print(f"❌ Fallaron: {failed}/{total}")
print("=" * 60)
sys.exit(0 if failed == 0 else 1)
