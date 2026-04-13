"""Quick test downloadable upload on PROD"""
import requests, io

BASE = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
token = r.json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

r = requests.get(f"{BASE}/study-contents", headers=h, timeout=30)
data = r.json()
materials = data.get("materials", data if isinstance(data, list) else [])
print(f"PROD Materials: {len(materials)}")

found = None
for m in materials[:10]:
    mid = m.get("id")
    r2 = requests.get(f"{BASE}/study-contents/{mid}", headers=h, timeout=30)
    mat = r2.json()
    for s in mat.get("sessions", []):
        for t in s.get("topics", []):
            if not found:
                found = (mid, s["id"], t["id"])
                print(f"  Using: mat={mid}, sess={s['id']}, topic={t['id']}")

if found:
    mid, sid, tid = found
    fake = io.BytesIO(b"Test PROD upload file content")
    r = requests.post(
        f"{BASE}/study-contents/{mid}/sessions/{sid}/topics/{tid}/downloadable/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"files": ("test_prod.txt", fake, "text/plain")},
        data={"title": "TEST PROD upload", "description": "Test"},
        timeout=60
    )
    print(f"Upload status: {r.status_code}")
    print(f"Response: {r.text[:300]}")
else:
    print("No materials with topics found in PROD")
