"""
Test: Después de un swap, el usuario origen debe seguir visible
en la tabla de members-detail con estado "Sin asignación".

Verifica que el endpoint members-detail muestra TODOS los miembros
del grupo (no solo los asignados al examen), para que al reasignar
una asignación el usuario origen no desaparezca.

USO: python tests/test_swap_visibility.py
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
print("👁️  TEST: VISIBILIDAD DE MIEMBROS TRAS REASIGNACIÓN (SWAP)")
print("=" * 60)

# ── Login ──
print("\n🔑 Login...")
token = get_token()
if not token:
    print("❌ No se pudo obtener token. Abortando.")
    sys.exit(1)
print(f"  ✅ Token obtenido")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Buscar grupo con examen asignado tipo 'selected' ──
print("\n🔍 Buscando grupo con examen asignado...")
group_id = None
exam_id = None
assignment_type = None

try:
    r = requests.get(f"{API}/partners/groups/list-all", headers=headers, params={"per_page": 50})
    if r.status_code == 200:
        groups = r.json().get("groups", [])
        for g in groups:
            gid = g.get("id")
            r2 = requests.get(f"{API}/partners/groups/{gid}/exams", headers=headers)
            if r2.status_code == 200:
                exams = r2.json().get("assigned_exams", []) or r2.json().get("exams", [])
                for ex in exams:
                    eid = ex.get("exam_id") or ex.get("id")
                    group_id = gid
                    exam_id = eid
                    assignment_type = ex.get("assignment_type", "unknown")
                    break
            if group_id:
                break
except Exception as e:
    print(f"  ⚠️ Error buscando grupo: {e}")

if not group_id or not exam_id:
    print("  ⚠️ No se encontró grupo con examen. Abortando.")
    sys.exit(1)

print(f"  ✅ Grupo={group_id}, Examen={exam_id}, Tipo asignación={assignment_type}")

detail_url = f"{API}/partners/groups/{group_id}/exams/{exam_id}/members-detail"

# ── Test 1: members-detail devuelve todos los miembros del grupo ──
print(f"\n📊 1. MIEMBROS TOTALES EN TABLA vs MIEMBROS DEL GRUPO")

# Get group members count
r_members = requests.get(
    f"{API}/partners/groups/{group_id}/members",
    headers=headers,
    params={"per_page": 1}
)
group_total_members = 0
if r_members.status_code == 200:
    group_total_members = r_members.json().get("total", 0)
    print(f"  Miembros del grupo (total): {group_total_members}")

# Get members-detail count
r_detail = requests.get(detail_url, headers=headers, params={"per_page": 1})
detail_total = 0
if r_detail.status_code == 200:
    detail_data = r_detail.json()
    detail_total = detail_data.get("total", 0)
    print(f"  Miembros en members-detail (total): {detail_total}")
    print(f"  Tipo de asignación: {detail_data.get('assignment_type')}")

test(
    "members-detail muestra TODOS los miembros del grupo",
    detail_total == group_total_members,
    f"Esperado: {group_total_members}, Obtenido: {detail_total}"
)


# ── Test 2: Verificar que se muestran miembros sin asignación ──
print(f"\n📊 2. MIEMBROS SIN ASIGNACIÓN VISIBLE")

r_detail_full = requests.get(detail_url, headers=headers, params={"per_page": 1000})
if r_detail_full.status_code == 200:
    members_list = r_detail_full.json().get("members", [])
    assigned_members = [m for m in members_list if m.get("assignment_number")]
    unassigned_members = [m for m in members_list if not m.get("assignment_number")]
    
    print(f"  Con asignación: {len(assigned_members)}")
    print(f"  Sin asignación: {len(unassigned_members)}")
    
    total_shown = len(members_list)
    test(
        "Miembros totales mostrados = miembros del grupo",
        total_shown == group_total_members,
        f"Mostrados: {total_shown}, En grupo: {group_total_members}"
    )
    
    # If there are unassigned members, verify their fields are correct
    if unassigned_members:
        sample = unassigned_members[0]
        test(
            "Miembro sin asignación tiene user_id",
            bool(sample.get("user_id")),
            f"user_id: {sample.get('user_id')}"
        )
        test(
            "Miembro sin asignación tiene datos de usuario",
            bool(sample.get("user", {}).get("full_name")),
            f"user: {sample.get('user')}"
        )
        test(
            "Miembro sin asignación: assignment_number es null",
            sample.get("assignment_number") is None,
            f"assignment_number: {sample.get('assignment_number')}"
        )
        test(
            "Miembro sin asignación: is_locked es False",
            sample.get("is_locked") is False,
            f"is_locked: {sample.get('is_locked')}"
        )
        print(f"  Ejemplo de miembro sin asignación: {sample.get('user', {}).get('full_name')}")
    else:
        print("  ℹ️  Todos los miembros tienen asignación (no se puede verificar 'Sin asignación' sin hacer swap)")
else:
    test("Obtener members-detail completo", False, f"Status: {r_detail_full.status_code}")


# ── Test 3: Filtro status funciona correctamente ──
print(f"\n📊 3. FILTROS DE ESTADO")

# All members = no filter
r_all = requests.get(detail_url, headers=headers, params={"per_page": 1, "filter_status": "all"})
r_locked = requests.get(detail_url, headers=headers, params={"per_page": 1, "filter_status": "locked"})
r_swappable = requests.get(detail_url, headers=headers, params={"per_page": 1, "filter_status": "swappable"})

if r_all.status_code == 200 and r_locked.status_code == 200 and r_swappable.status_code == 200:
    all_total = r_all.json().get("total", 0)
    locked_total = r_locked.json().get("total", 0)
    swappable_total = r_swappable.json().get("total", 0)
    
    print(f"  All: {all_total}, Locked: {locked_total}, Swappable: {swappable_total}")
    
    test(
        "locked + swappable == all",
        locked_total + swappable_total == all_total,
        f"{locked_total} + {swappable_total} = {locked_total + swappable_total} ≠ {all_total}"
    )

    test(
        "locked_count en respuesta coincide con filtro locked",
        r_all.json().get("locked_count", -1) == locked_total,
        f"locked_count={r_all.json().get('locked_count')}, locked filter total={locked_total}"
    )
    
    test(
        "swappable_count en respuesta coincide con filtro swappable",
        r_all.json().get("swappable_count", -1) == swappable_total,
        f"swappable_count={r_all.json().get('swappable_count')}, swappable filter total={swappable_total}"
    )


# ── Test 4: Estructura de miembro individual ──
print(f"\n📊 4. ESTRUCTURA DE DATOS DE MIEMBRO")

if r_detail_full.status_code == 200 and members_list:
    sample = members_list[0]
    required_fields = [
        'user_id', 'user', 'assignment_number', 'material_progress',
        'has_opened_exam', 'results_count', 'is_locked', 'lock_reasons'
    ]
    for field in required_fields:
        test(f"Campo '{field}' presente", field in sample, f"Keys: {list(sample.keys())}")


# ── Resumen ──
print("\n" + "=" * 60)
total = passed + failed
print(f"✅ Pasaron: {passed}/{total}")
print(f"❌ Fallaron: {failed}/{total}")
print("=" * 60)
sys.exit(0 if failed == 0 else 1)
