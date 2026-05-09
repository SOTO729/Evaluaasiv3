"""
Smoke test bulk upload con plantilla del usuario.
Educare Pruebas → Plantel Nacional → Grupo Nacional 2
"""
import os, sys, time, json, requests

API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
XLSX = r"c:\Users\Diego\Downloads\ActiveDirectoryUsers (1)\plantilla_candidatos (2) (1).xlsx"

s = requests.Session()
s.headers.update({"User-Agent": "smoke/1.0"})

def login():
    r = s.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=60)
    r.raise_for_status()
    tok = r.json().get("access_token") or r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    print(f"login OK {r.status_code}")

def find_target():
    r = s.get(f"{API}/partners", timeout=60); r.raise_for_status()
    parts = r.json()
    if isinstance(parts, dict): parts = parts.get("data") or parts.get("partners") or []
    print(f"partners: {len(parts)}")
    target_partner = next((p for p in parts if "educare" in (p.get("name","").lower()) and "prueba" in p.get("name","").lower()), None)
    if not target_partner:
        for p in parts: print(" -", p.get("id"), p.get("name"))
        sys.exit("no partner Educare Pruebas")
    pid = target_partner["id"]
    print(f"partner: {pid} {target_partner['name']}")
    r = s.get(f"{API}/partners/{pid}/campuses", timeout=60); r.raise_for_status()
    camps = r.json()
    if isinstance(camps, dict): camps = camps.get("data") or camps.get("campuses") or []
    print(f"campuses: {len(camps)}")
    target_campus = next((c for c in camps if "nacional" in c.get("name","").lower()), None)
    if not target_campus:
        for c in camps: print(" -", c.get("id"), c.get("name"))
        sys.exit("no campus Nacional")
    cid = target_campus["id"]
    print(f"campus: {cid} {target_campus['name']}")
    r = s.get(f"{API}/partners/campuses/{cid}/groups", timeout=60); r.raise_for_status()
    grps = r.json()
    if isinstance(grps, dict): grps = grps.get("data") or grps.get("groups") or []
    print(f"groups: {len(grps)}")
    for g in grps: print(" -", g.get("id"), g.get("name"))
    target_group = next((g for g in grps if "nacional 2" in g.get("name","").lower()), None)
    if not target_group:
        sys.exit("no group Nacional 2")
    gid = target_group["id"]
    print(f"group: {gid} {target_group['name']}")
    return pid, cid, gid

def upload(group_id):
    if not os.path.exists(XLSX):
        sys.exit(f"missing {XLSX}")
    with open(XLSX, "rb") as f:
        r = s.post(
            f"{API}/user-management/candidates/bulk-upload",
            files={"file": (os.path.basename(XLSX), f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"group_id": str(group_id)},
            timeout=180,
        )
    print(f"upload status={r.status_code}")
    print(json.dumps(r.json(), indent=2, ensure_ascii=False)[:4000])
    return r.json()

def members(group_id):
    r = s.get(f"{API}/partners/groups/{group_id}/members?per_page=100", timeout=60)
    print(f"members status={r.status_code}")
    if r.status_code != 200:
        print(r.text[:500]); return
    data = r.json()
    print(f"total: {data.get('total') or data.get('pagination',{}).get('total')}")
    items = data.get("members") or data.get("data") or data.get("items") or []
    print(f"items in page: {len(items)}")
    for m in items[:10]:
        u = m.get("user", {}) if isinstance(m.get("user"), dict) else {}
        print(" -", m.get("status"), u.get("name"), u.get("first_surname"), u.get("curp"))

if __name__ == "__main__":
    login()
    pid, cid, gid = find_target()
    res = upload(gid)
    time.sleep(2)
    members(gid)
