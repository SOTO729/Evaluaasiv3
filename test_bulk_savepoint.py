# -*- coding: utf-8 -*-
"""Smoke test del bulk-upload refactorizado con SAVEPOINT (enfoque B)."""
import io
import sys
import time
import json
import requests
from openpyxl import Workbook

API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN = ("admin", "admin123")
GROUP_ID = 188


def login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=60)
    r.raise_for_status()
    return r.json()["access_token"]


def make_excel(rows):
    wb = Workbook()
    ws = wb.active
    ws.append(["email", "nombre", "primer_apellido", "segundo_apellido", "genero", "curp"])
    for r in rows:
        ws.append([r.get("email", ""), r.get("nombre", ""), r.get("primer_apellido", ""),
                   r.get("segundo_apellido", ""), r.get("genero", ""), r.get("curp", "")])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


_DICC = "0123456789ABCDEFGHIJKLMN" + "\u00d1" + "OPQRSTUVWXYZ"


def _check_digit(curp17):
    s = 0.0
    for i, ch in enumerate(curp17):
        try:
            s += _DICC.index(ch) * (18 - i)
        except ValueError:
            return None
    d = 10 - (int(s) % 10)
    return 0 if d == 10 else d


def gen_valid_curp(seed_idx):
    initials_pool = "ABCDEFGHJKLMPQRSTUVWXYZ"
    a = initials_pool[seed_idx % len(initials_pool)]
    b = initials_pool[(seed_idx // 23) % len(initials_pool)]
    c = initials_pool[(seed_idx // (23 * 23)) % len(initials_pool)]
    d = initials_pool[(seed_idx // (23 * 23 * 23)) % len(initials_pool)]
    initials = a + b + c + d
    yy = f"{(seed_idx % 50) + 50:02d}"
    mm = "01"
    dd = "15"
    sex = "H"
    state = "DF"
    consonants = "BCD"
    homo_alpha = chr(65 + (seed_idx % 26))
    curp17 = initials + yy + mm + dd + sex + state + consonants + homo_alpha
    chk = _check_digit(curp17)
    return curp17 + str(chk)


def upload(token, group_id, rows):
    files = {"file": ("plantilla.xlsx", make_excel(rows),
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    data = {"group_id": str(group_id)}
    r = requests.post(
        f"{API}/user-management/candidates/bulk-upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files, data=data, timeout=600,
    )
    if r.headers.get("content-type", "").startswith("application/json"):
        return r.status_code, r.json()
    return r.status_code, {"raw": r.text}


def member_ids(token, group_id):
    r = requests.get(
        f"{API}/partners/groups/{group_id}/members",
        headers={"Authorization": f"Bearer {token}"},
        params={"per_page": 1000}, timeout=120,
    )
    r.raise_for_status()
    return {m["user_id"] for m in r.json().get("members", [])}


def extract_summary(body):
    if not isinstance(body, dict):
        return 0, 0, {}
    summary = body.get("summary", {})
    details = body.get("details", {})
    return summary.get("created", 0), summary.get("errors", 0), details


def main():
    print("Login admin...")
    tok = login(*ADMIN)
    ts = int(time.time())

    print("\n=== Caso 1: Fast path (5 filas validas) ===")
    rows1 = [
        {"email": f"sp{ts}c1r{i}@example.com",
         "nombre": f"NOMBREUNO{i}", "primer_apellido": f"APELLIDO{i}",
         "segundo_apellido": "STRESS", "genero": "M",
         "curp": gen_valid_curp(seed_idx=ts * 7 + i)}
        for i in range(5)
    ]
    before1 = member_ids(tok, GROUP_ID)
    code1, body1 = upload(tok, GROUP_ID, rows1)
    after1 = member_ids(tok, GROUP_ID)
    added1 = after1 - before1
    cr1, er1, det1 = extract_summary(body1)
    print(f"  HTTP={code1} | summary: created={cr1}, errors={er1}")
    print(f"  miembros nuevos en grupo (DB): {len(added1)}")
    if er1 > 0:
        print(f"  errores: {json.dumps(det1.get('errors', []), indent=2)[:500]}")
    skipped1 = len(det1.get('skipped', [])) + len(det1.get('existing_assigned', []))
    print(f"  skipped/existing: {skipped1}")
    assert code1 == 200, f"HTTP {code1}: {body1}"
    assert er1 == 0, f"errores inesperados: {det1.get('errors')}"
    assert cr1 == len(added1), f"created={cr1} pero +{len(added1)} miembros DB"
    assert cr1 >= 1, f"esperaba al menos 1 created, vi {cr1}"
    print(f"  OK Caso 1 - fast path commit creo {cr1} usuarios")

    print("\n=== Caso 2: Mezcla con CURPs malformadas (preview filtra) ===")
    rows2 = []
    for i in range(8):
        if i in (2, 4, 6):
            rows2.append({
                "email": f"sp{ts}c2bad{i}@example.com",
                "nombre": f"MALA{i}", "primer_apellido": "INVALIDA",
                "segundo_apellido": "TEST", "genero": "M",
                "curp": "XXXX900101HDFXX",
            })
        else:
            rows2.append({
                "email": f"sp{ts}c2ok{i}@example.com",
                "nombre": f"BUENO{i}", "primer_apellido": "VALIDO",
                "segundo_apellido": "TEST", "genero": "M",
                "curp": gen_valid_curp(seed_idx=ts * 11 + i),
            })
    before2 = member_ids(tok, GROUP_ID)
    code2, body2 = upload(tok, GROUP_ID, rows2)
    after2 = member_ids(tok, GROUP_ID)
    added2 = after2 - before2
    cr2, er2, det2 = extract_summary(body2)
    print(f"  HTTP={code2} | summary: created={cr2}, errors={er2}")
    print(f"  miembros nuevos en grupo (DB): {len(added2)}")
    skipped2 = len(det2.get('skipped', [])) + len(det2.get('existing_assigned', []))
    print(f"  skipped/existing: {skipped2}")
    assert code2 == 200, f"HTTP {code2}: {body2}"
    # Las 3 CURPs malformadas deben caer en errors o skipped (preview)
    bad_caught = er2 + skipped2
    assert bad_caught >= 3, f"esperaba >=3 invalidas detectadas (errors+skipped), vi {bad_caught}"
    assert cr2 == len(added2), f"created={cr2} pero +{len(added2)} miembros DB"
    print(f"  OK Caso 2 - validas={cr2}, invalidas detectadas={bad_caught}")

    print("\n=== Caso 3: Stress 60 filas validas ===")
    rows3 = [
        {"email": f"sp{ts}c3r{i}@example.com",
         "nombre": f"STRESS{i}", "primer_apellido": f"BIG{i}",
         "segundo_apellido": "LOAD", "genero": "M",
         "curp": gen_valid_curp(seed_idx=ts * 17 + i)}
        for i in range(60)
    ]
    before3 = member_ids(tok, GROUP_ID)
    code3, body3 = upload(tok, GROUP_ID, rows3)
    after3 = member_ids(tok, GROUP_ID)
    added3 = after3 - before3
    cr3, er3, det3 = extract_summary(body3)
    print(f"  HTTP={code3} | summary: created={cr3}, errors={er3}")
    print(f"  miembros nuevos en grupo (DB): {len(added3)}")
    if er3 > 0:
        print(f"  errores: {json.dumps(det3.get('errors', []), indent=2)[:500]}")
    skipped3 = len(det3.get('skipped', [])) + len(det3.get('existing_assigned', []))
    print(f"  skipped/existing: {skipped3}")
    assert code3 == 200, f"HTTP {code3}: {body3}"
    assert er3 == 0, f"errores inesperados: {det3.get('errors')}"
    assert cr3 == len(added3), f"created={cr3} pero +{len(added3)} miembros DB"
    assert cr3 >= 50, f"esperaba >=50 creados (de 60), vi {cr3}"
    print(f"  OK Caso 3 - Stress: created={cr3}, skipped/existing={skipped3}")

    print("\n========== TODOS LOS TESTS PASARON ==========")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n[ASSERTION FAILED] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
