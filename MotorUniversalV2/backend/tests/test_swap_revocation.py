"""
Test: Revocación efectiva al reasignar número de asignación

Verifica que al hacer un swap:
1. El usuario origen PIERDE acceso al examen (GroupExamMember eliminado)
2. El usuario origen PIERDE su progreso de estudio (StudentTopicProgress y StudentContentProgress eliminados)
3. El usuario destino OBTIENE el número de asignación
4. El usuario destino OBTIENE acceso al examen (GroupExamMember creado)
5. El swap queda registrado en el historial
6. Después del swap se puede reasignar DE VUELTA al usuario original

USO: python tests/test_swap_revocation.py
"""
import sys
import requests
import json
import pymssql

API = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
DB_SERVER = "evaluaasi-motorv2-sql.database.windows.net"
DB_USER = "evaluaasi_admin"
DB_PASS = "EvalAasi2024_newpwd!"
DB_NAME = "evaluaasi"

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


def db_query(sql, params=None):
    """Ejecuta una consulta SQL directa contra Azure SQL."""
    conn = pymssql.connect(server=DB_SERVER, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cursor = conn.cursor(as_dict=True)
    cursor.execute(sql, params or ())
    try:
        rows = cursor.fetchall()
    except:
        rows = []
    conn.close()
    return rows


def db_scalar(sql, params=None):
    """Ejecuta una consulta que retorna un solo valor."""
    conn = pymssql.connect(server=DB_SERVER, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cursor = conn.cursor()
    cursor.execute(sql, params or ())
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None


print("\n" + "=" * 70)
print("🔒 TEST: REVOCACIÓN EFECTIVA AL REASIGNAR NÚMERO DE ASIGNACIÓN")
print("=" * 70)

# ── Login ──
print("\n🔑 Login...")
token = get_token()
if not token:
    print("❌ No se pudo obtener token. Abortando.")
    sys.exit(1)
print(f"  ✅ Token obtenido")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ── Buscar grupo con miembros asignados Y miembros sin asignación ──
print("\n🔍 Buscando grupo con candidatos reasignables...")
group_id = None
exam_id = None
swappable_src = None
swappable_dest = None

try:
    r = requests.get(f"{API}/partners/groups/list-all", headers=headers, params={"per_page": 50})
    if r.status_code == 200:
        groups = r.json().get("groups", [])
        for g in groups:
            if swappable_src:
                break
            gid = g.get("id")
            r2 = requests.get(f"{API}/partners/groups/{gid}/exams", headers=headers)
            if r2.status_code != 200:
                continue
            exams = r2.json().get("assigned_exams", []) or r2.json().get("exams", [])
            for ex in exams:
                eid = ex.get("exam_id") or ex.get("id")
                r3 = requests.get(
                    f"{API}/partners/groups/{gid}/exams/{eid}/members-detail",
                    headers=headers, params={"per_page": 500}
                )
                if r3.status_code != 200:
                    continue
                members = r3.json().get("members", [])
                with_assign = [m for m in members if m.get("assignment_number") and not m.get("is_locked")]
                without_assign = [m for m in members if not m.get("assignment_number")]
                if with_assign and without_assign:
                    group_id = gid
                    exam_id = eid
                    swappable_src = with_assign[0]
                    swappable_dest = without_assign[0]
                    break
except Exception as e:
    print(f"  ⚠️ Error buscando grupo: {e}")

if not group_id or not exam_id or not swappable_src or not swappable_dest:
    print("  ⚠️ No se encontró un grupo con candidatos reasignables (necesita al menos 1 con asignación no bloqueado + 1 sin asignación)")
    print("  Abortando tests de revocación.")
    sys.exit(0)

from_user_id = swappable_src["user_id"]
to_user_id = swappable_dest["user_id"]
from_name = swappable_src.get("user", {}).get("full_name", from_user_id)
to_name = swappable_dest.get("user", {}).get("full_name", to_user_id)
original_assignment = swappable_src.get("assignment_number")

print(f"  ✅ Grupo={group_id}, Examen={exam_id}")
print(f"  Origen: {from_name} (#{original_assignment})")
print(f"  Destino: {to_name} (sin asignación)")

swap_url = f"{API}/partners/groups/{group_id}/exams/{exam_id}/members/swap"
detail_url = f"{API}/partners/groups/{group_id}/exams/{exam_id}/members-detail"
history_url = f"{API}/partners/groups/{group_id}/exams/{exam_id}/swap-history"

# ── Pre-swap: verificar estado en DB ──
print("\n📊 1. ESTADO ANTES DEL SWAP (DB directa)")

# Obtener group_exam_id
ge_id = db_scalar(
    "SELECT id FROM group_exams WHERE group_id=%s AND exam_id=%s AND is_active=1",
    (group_id, exam_id)
)
test("group_exam existe", ge_id is not None, f"group_id={group_id}, exam_id={exam_id}")

# Verificar GEM del origen
origin_gem_count = db_scalar(
    "SELECT COUNT(*) FROM group_exam_members WHERE group_exam_id=%s AND user_id=%s",
    (ge_id, from_user_id)
)
print(f"  GEM del origen antes: {origin_gem_count}")

# Verificar GEM del destino
dest_gem_before = db_scalar(
    "SELECT COUNT(*) FROM group_exam_members WHERE group_exam_id=%s AND user_id=%s",
    (ge_id, to_user_id)
)
print(f"  GEM del destino antes: {dest_gem_before}")

# Verificar ECA del origen
origin_eca = db_query(
    "SELECT assignment_number, competency_standard_id FROM ecm_candidate_assignments WHERE user_id=%s AND group_exam_id=%s",
    (from_user_id, ge_id)
)
test("Origen tiene ECA antes del swap", len(origin_eca) > 0)
ecm_id = origin_eca[0]["competency_standard_id"] if origin_eca else None

# Contar progreso del origen (topic + content)
origin_topic_progress = 0
origin_content_progress = 0
if exam_id:
    # Obtener topic_ids del examen
    topic_rows = db_query("""
        SELECT DISTINCT st.id
        FROM study_topics st
        INNER JOIN study_sessions ss ON st.session_id = ss.id
        INNER JOIN study_material_exams sme ON ss.material_id = sme.study_material_id
        WHERE sme.exam_id = %s
    """, (exam_id,))
    exam_topic_ids = [r["id"] for r in topic_rows]
    
    if exam_topic_ids:
        placeholders = ','.join(['%s'] * len(exam_topic_ids))
        origin_topic_progress = db_scalar(
            f"SELECT COUNT(*) FROM student_topic_progress WHERE user_id=%s AND topic_id IN ({placeholders})",
            (from_user_id, *exam_topic_ids)
        ) or 0
        origin_content_progress = db_scalar(
            f"SELECT COUNT(*) FROM student_content_progress WHERE user_id=%s AND topic_id IN ({placeholders})",
            (from_user_id, *exam_topic_ids)
        ) or 0
    else:
        exam_topic_ids = []

print(f"  Progreso por tema del origen: {origin_topic_progress} registros")
print(f"  Progreso por contenido del origen: {origin_content_progress} registros")


# ══════════════════════════════════════════════
# ── EJECUTAR EL SWAP ──
# ══════════════════════════════════════════════
print(f"\n🔄 2. EJECUTAR SWAP: {from_name} → {to_name}")

r = requests.post(swap_url, headers=headers, json={
    "from_user_id": from_user_id,
    "to_user_id": to_user_id,
})
test("Swap retorna 200", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:300]}")

if r.status_code != 200:
    print("  ❌ Swap falló. No se pueden continuar las verificaciones.")
    print(f"  Respuesta: {r.text[:500]}")
    print("\n" + "=" * 70)
    total = passed + failed
    print(f"✅ Pasaron: {passed}/{total}")
    print(f"❌ Fallaron: {failed}/{total}")
    print("=" * 70)
    sys.exit(1)

swap_data = r.json()
test(
    "Swap retorna assignment_number transferido",
    swap_data.get("assignment_number") == original_assignment,
    f"Esperado: {original_assignment}, Obtenido: {swap_data.get('assignment_number')}"
)
print(f"  Respuesta: {json.dumps(swap_data, ensure_ascii=False)}")


# ── Post-swap: Verificar revocación en DB ──
print(f"\n📊 3. VERIFICAR REVOCACIÓN DEL ORIGEN (DB directa)")

# 3a. GEM del origen debe haber sido ELIMINADO
origin_gem_after = db_scalar(
    "SELECT COUNT(*) FROM group_exam_members WHERE group_exam_id=%s AND user_id=%s",
    (ge_id, from_user_id)
)
test(
    "GroupExamMember del origen ELIMINADO (revocado)",
    origin_gem_after == 0,
    f"Esperado: 0, Obtenido: {origin_gem_after}"
)

# 3b. Progreso de topics del origen debe haber sido ELIMINADO
if exam_topic_ids:
    placeholders = ','.join(['%s'] * len(exam_topic_ids))
    origin_tp_after = db_scalar(
        f"SELECT COUNT(*) FROM student_topic_progress WHERE user_id=%s AND topic_id IN ({placeholders})",
        (from_user_id, *exam_topic_ids)
    ) or 0
    test(
        "StudentTopicProgress del origen ELIMINADO",
        origin_tp_after == 0,
        f"Antes: {origin_topic_progress}, Después: {origin_tp_after}"
    )

    # 3c. Progreso de contenidos del origen debe haber sido ELIMINADO
    origin_cp_after = db_scalar(
        f"SELECT COUNT(*) FROM student_content_progress WHERE user_id=%s AND topic_id IN ({placeholders})",
        (from_user_id, *exam_topic_ids)
    ) or 0
    test(
        "StudentContentProgress del origen ELIMINADO",
        origin_cp_after == 0,
        f"Antes: {origin_content_progress}, Después: {origin_cp_after}"
    )
else:
    print("  ℹ️  No hay topics de estudio asociados al examen (no aplica limpieza de progreso)")


# ── Post-swap: Verificar que el destino obtuvo todo ── 
print(f"\n📊 4. VERIFICAR QUE EL DESTINO OBTUVO LA ASIGNACIÓN")

# 4a. GEM del destino debe existir
dest_gem_after = db_scalar(
    "SELECT COUNT(*) FROM group_exam_members WHERE group_exam_id=%s AND user_id=%s",
    (ge_id, to_user_id)
)
test(
    "GroupExamMember del destino EXISTE",
    dest_gem_after > 0,
    f"Count: {dest_gem_after}"
)

# 4b. ECA transferida al destino
dest_eca = db_query(
    "SELECT assignment_number FROM ecm_candidate_assignments WHERE user_id=%s AND competency_standard_id=%s",
    (to_user_id, ecm_id)
) if ecm_id else []
test(
    "ECA transferida al destino con assignment_number correcto",
    len(dest_eca) > 0 and dest_eca[0]["assignment_number"] == original_assignment,
    f"Esperado: {original_assignment}, Obtenido: {dest_eca[0]['assignment_number'] if dest_eca else 'NINGUNO'}"
)

# 4c. Origen ya NO tiene ECA
origin_eca_after = db_query(
    "SELECT assignment_number FROM ecm_candidate_assignments WHERE user_id=%s AND competency_standard_id=%s",
    (from_user_id, ecm_id)
) if ecm_id else []
test(
    "Origen NO tiene ECA después del swap",
    len(origin_eca_after) == 0,
    f"ECAs encontradas: {len(origin_eca_after)}"
)


# ── Verificar vía API members-detail ──
print(f"\n📊 5. VERIFICAR VÍA API members-detail")

r = requests.get(detail_url, headers=headers, params={"per_page": 500})
if r.status_code == 200:
    members = r.json().get("members", [])
    from_in_list = [m for m in members if m["user_id"] == from_user_id]
    to_in_list = [m for m in members if m["user_id"] == to_user_id]

    test("Origen sigue visible en la tabla", len(from_in_list) > 0)
    if from_in_list:
        test(
            "Origen ahora SIN assignment_number",
            from_in_list[0].get("assignment_number") is None,
            f"assignment_number: {from_in_list[0].get('assignment_number')}"
        )

    test("Destino visible en la tabla", len(to_in_list) > 0)
    if to_in_list:
        test(
            "Destino ahora CON assignment_number correcto",
            to_in_list[0].get("assignment_number") == original_assignment,
            f"Esperado: {original_assignment}, Obtenido: {to_in_list[0].get('assignment_number')}"
        )


# ── Verificar historial ──
print(f"\n📊 6. VERIFICAR HISTORIAL DE REASIGNACIÓN")

r = requests.get(history_url, headers=headers, params={
    "assignment_number": original_assignment
})
if r.status_code == 200:
    history_data = r.json()
    records = history_data.get("history", [])
    test(
        "Historial registra el swap",
        len(records) > 0,
        f"Registros: {len(records)}"
    )
    if records:
        last_record = records[0]  # Más reciente
        test(
            "Historial: from_user_id correcto",
            last_record.get("from_user_id") == from_user_id,
            f"Esperado: {from_user_id}, Obtenido: {last_record.get('from_user_id')}"
        )
        test(
            "Historial: to_user_id correcto",
            last_record.get("to_user_id") == to_user_id,
            f"Esperado: {to_user_id}, Obtenido: {last_record.get('to_user_id')}"
        )
        test(
            "Historial: assignment_number correcto",
            last_record.get("assignment_number") == original_assignment,
            f"Esperado: {original_assignment}, Obtenido: {last_record.get('assignment_number')}"
        )
else:
    test("Historial endpoint OK", False, f"Status: {r.status_code}")


# ══════════════════════════════════════════════
# ── SWAP DE VUELTA (revertir) ──
# ══════════════════════════════════════════════
print(f"\n🔄 7. SWAP DE VUELTA: {to_name} → {from_name}")

r = requests.post(swap_url, headers=headers, json={
    "from_user_id": to_user_id,
    "to_user_id": from_user_id,
})
test("Swap de vuelta retorna 200", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:300]}")

if r.status_code == 200:
    revert_data = r.json()
    test(
        "Swap de vuelta retorna assignment_number original",
        revert_data.get("assignment_number") == original_assignment,
        f"Esperado: {original_assignment}, Obtenido: {revert_data.get('assignment_number')}"
    )

    # Verificar que el origen recuperó todo
    origin_gem_restored = db_scalar(
        "SELECT COUNT(*) FROM group_exam_members WHERE group_exam_id=%s AND user_id=%s",
        (ge_id, from_user_id)
    )
    test(
        "Origen recupera GroupExamMember",
        origin_gem_restored > 0,
        f"Count: {origin_gem_restored}"
    )

    origin_eca_restored = db_query(
        "SELECT assignment_number FROM ecm_candidate_assignments WHERE user_id=%s AND competency_standard_id=%s",
        (from_user_id, ecm_id)
    ) if ecm_id else []
    test(
        "Origen recupera ECA con assignment_number original",
        len(origin_eca_restored) > 0 and origin_eca_restored[0]["assignment_number"] == original_assignment,
        f"ECAs: {origin_eca_restored}"
    )

    # Verificar que ahora el destino temporal perdió el acceso (revocación del swap de vuelta)
    dest_gem_revoked = db_scalar(
        "SELECT COUNT(*) FROM group_exam_members WHERE group_exam_id=%s AND user_id=%s",
        (ge_id, to_user_id)
    )
    test(
        "Destino temporal PIERDE GroupExamMember al revertir",
        dest_gem_revoked == 0,
        f"Count: {dest_gem_revoked}"
    )

    dest_eca_revoked = db_query(
        "SELECT assignment_number FROM ecm_candidate_assignments WHERE user_id=%s AND competency_standard_id=%s",
        (to_user_id, ecm_id)
    ) if ecm_id else []
    test(
        "Destino temporal PIERDE ECA al revertir",
        len(dest_eca_revoked) == 0,
        f"ECAs: {dest_eca_revoked}"
    )

    # Verificar en API
    r = requests.get(detail_url, headers=headers, params={"per_page": 500})
    if r.status_code == 200:
        members = r.json().get("members", [])
        from_member = next((m for m in members if m["user_id"] == from_user_id), None)
        to_member = next((m for m in members if m["user_id"] == to_user_id), None)

        if from_member:
            test(
                "Origen restaurado: tiene assignment_number",
                from_member.get("assignment_number") == original_assignment,
                f"Obtenido: {from_member.get('assignment_number')}"
            )
        if to_member:
            test(
                "Destino temporal: sin assignment_number",
                to_member.get("assignment_number") is None,
                f"Obtenido: {to_member.get('assignment_number')}"
            )

    # Verificar historial tiene 2 registros para este assignment_number
    r = requests.get(history_url, headers=headers, params={
        "assignment_number": original_assignment
    })
    if r.status_code == 200:
        records = r.json().get("history", [])
        recent_for_assignment = [rec for rec in records if rec.get("assignment_number") == original_assignment]
        test(
            "Historial tiene al menos 2 registros (ida + vuelta)",
            len(recent_for_assignment) >= 2,
            f"Registros: {len(recent_for_assignment)}"
        )
else:
    print(f"  ⚠️ Swap de vuelta falló: {r.text[:300]}")
    print("  ⚠️ ATENCIÓN: Los datos quedaron en estado intermedio (swap no revertido)")


# ══════════════════════════════════════════════
# ── RESUMEN ──
# ══════════════════════════════════════════════
print("\n" + "=" * 70)
total = passed + failed
if failed == 0:
    print(f"🎉 TODOS LOS TESTS PASARON: {passed}/{total}")
else:
    print(f"✅ Pasaron: {passed}/{total}")
    print(f"❌ Fallaron: {failed}/{total}")
print("=" * 70)
sys.exit(0 if failed == 0 else 1)
