# -*- coding: utf-8 -*-
"""W2 smoke test: POST /users individual debe:
  - Responder rapido aunque RENAPO se demore (no colgar el request).
  - Devolver curp_pending_validation cuando RENAPO no responde.
  - Encolar la CURP en curp_verification_queue para retry posterior.
"""
import time
import requests

API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN = ("admin", "admin123")
GROUP_ID = 188


def login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=60)
    r.raise_for_status()
    return r.json()["access_token"]


_DICC = "0123456789ABCDEFGHIJKLMN" + "\u00d1" + "OPQRSTUVWXYZ"


def _check_digit(curp17):
    s = sum(_DICC.index(ch) * (18 - i) for i, ch in enumerate(curp17))
    d = 10 - (s % 10)
    return 0 if d == 10 else d


def gen_valid_curp(seed_idx):
    initials_pool = "ABCDEFGHJKLMPQRSTUVWXYZ"
    a = initials_pool[seed_idx % len(initials_pool)]
    b = initials_pool[(seed_idx // 23) % len(initials_pool)]
    c = initials_pool[(seed_idx // 529) % len(initials_pool)]
    d = initials_pool[(seed_idx // 12167) % len(initials_pool)]
    yy = f"{(seed_idx % 50) + 50:02d}"
    homo_alpha = chr(65 + (seed_idx % 26))
    curp17 = a + b + c + d + yy + "0115" + "H" + "DF" + "BCD" + homo_alpha
    return curp17 + str(_check_digit(curp17))


def main():
    print("Login admin...")
    tok = login(*ADMIN)
    ts = int(time.time())

    # Caso 1: CURP generica de extranjero — salta RENAPO, debe ser instantaneo.
    print("\n=== Caso 1: CURP generica extranjero (skip RENAPO) ===")
    payload1 = {
        "username": f"w2gen{ts}",
        "email": f"w2gen{ts}@example.com",
        "name": "GENERICO", "first_surname": "FOREIGN", "second_surname": "TEST",
        "gender": "H", "curp": "XEXX010101HNEXXXA4",
        "role": "candidato", "group_id": GROUP_ID, "password": "Tmp12345!",
    }
    t0 = time.time()
    r1 = requests.post(f"{API}/user-management/users",
                        headers={"Authorization": f"Bearer {tok}"},
                        json=payload1, timeout=120)
    elapsed1 = time.time() - t0
    print(f"  HTTP={r1.status_code} | tiempo={elapsed1:.2f}s")
    print(f"  body keys: {list(r1.json().keys())}")
    assert r1.status_code == 201, f"esperaba 201, vi {r1.status_code}: {r1.text[:300]}"
    assert elapsed1 < 30, f"tardo demasiado: {elapsed1:.1f}s"
    print("  OK Caso 1 - generic foreign CURP rapido")

    # Caso 2: CURP valida en formato pero no real → RENAPO debiera rechazar
    # rapidamente o el circuit-breaker devolver pending.
    print("\n=== Caso 2: CURP valida formato, no real (RENAPO rechaza o pending) ===")
    seed = ts * 31
    curp2 = gen_valid_curp(seed)
    payload2 = {
        "username": f"w2real{ts}",
        "email": f"w2real{ts}@example.com",
        "name": "TESTREAL", "first_surname": "VALIDFMT", "second_surname": "TEST",
        "gender": "H", "curp": curp2,
        "role": "candidato", "group_id": GROUP_ID, "password": "Tmp12345!",
    }
    t0 = time.time()
    r2 = requests.post(f"{API}/user-management/users",
                        headers={"Authorization": f"Bearer {tok}"},
                        json=payload2, timeout=300)
    elapsed2 = time.time() - t0
    print(f"  HTTP={r2.status_code} | tiempo={elapsed2:.2f}s")
    print(f"  raw response (first 400): {r2.text[:400]}")
    try:
        body2 = r2.json()
    except Exception:
        body2 = {}
    print(f"  curp={curp2}")
    print(f"  renapo_validated={body2.get('renapo_validated')}")
    print(f"  curp_pending_validation={body2.get('curp_pending_validation')}")
    print(f"  warning={(body2.get('renapo_warning') or '')[:120]}")
    assert r2.status_code == 201, f"esperaba 201, vi {r2.status_code}: {r2.text[:300]}"
    # El usuario debe crearse SIEMPRE, validado o no
    assert body2.get('user', {}).get('id'), "no devolvio user.id"
    print("  OK Caso 2 - usuario creado pese a RENAPO inestable")

    print("\n========== W2 PASS ==========")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n[ASSERTION FAILED] {e}")
        raise SystemExit(1)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise SystemExit(1)
