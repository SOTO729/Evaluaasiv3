"""Test downloadable upload on DEV"""
import requests
import io
import json

BASE = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"

# Login
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
token = r.json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

# List materials with details
r = requests.get(f"{BASE}/study-contents", headers=h, timeout=30)
data = r.json()
materials = data.get("materials", data if isinstance(data, list) else [])
print(f"Materials: {len(materials)}")

# Find material with sessions and topics
found = None
for m in materials[:10]:
    mid = m.get("id")
    title = m.get("title", "?")
    print(f"  Material {mid}: {title[:50]}")
    r2 = requests.get(f"{BASE}/study-contents/{mid}", headers=h, timeout=30)
    mat = r2.json()
    sessions = mat.get("sessions", [])
    for s in sessions[:5]:
        sid = s.get("id")
        topics = s.get("topics", [])
        for t in topics[:5]:
            tid = t.get("id")
            allow_dl = t.get("allow_downloadable", False)
            has_dl = t.get("downloadable_exercise") is not None
            print(f"    Session {sid} / Topic {tid}: allow_dl={allow_dl} has_dl={has_dl}")
            if not found:
                found = (mid, sid, tid)

if not found:
    # Create a material + session + topic for testing
    print("\nNo topics found. Creating test hierarchy...")
    r = requests.post(f"{BASE}/study-contents", headers=h, json={
        "title": "TEST: Material para probar descargables",
        "description": "Test", "is_published": False
    }, timeout=30)
    print(f"Create material: {r.status_code}")
    mid = r.json().get("id") or r.json().get("material", {}).get("id")
    
    r = requests.post(f"{BASE}/study-contents/{mid}/sessions", headers=h, json={
        "title": "TEST Session", "description": "Test"
    }, timeout=30)
    print(f"Create session: {r.status_code}")
    sdata = r.json()
    sid = sdata.get("id") or sdata.get("session", {}).get("id")
    
    r = requests.post(f"{BASE}/study-contents/{mid}/sessions/{sid}/topics", headers=h, json={
        "title": "TEST Topic", "allow_downloadable": True
    }, timeout=30)
    print(f"Create topic: {r.status_code}")
    tdata = r.json()
    tid = tdata.get("id") or tdata.get("topic", {}).get("id")
    found = (mid, sid, tid)

mid, sid, tid = found
print(f"\nTesting upload on: material={mid}, session={sid}, topic={tid}")

# Test 1: Upload a simple text file
print("\n=== TEST 1: Upload single file ===")
fake_file = io.BytesIO(b"Este es un archivo de prueba para ejercicio descargable.\nLinea 2.\nLinea 3.")
fake_file.name = "test_ejercicio.txt"

files = {"files": ("test_ejercicio.txt", fake_file, "text/plain")}
form_data = {"title": "TEST: Ejercicio descargable", "description": "Archivo de prueba"}

r = requests.post(
    f"{BASE}/study-contents/{mid}/sessions/{sid}/topics/{tid}/downloadable/upload",
    headers={"Authorization": f"Bearer {token}"},
    files=files,
    data=form_data,
    timeout=60
)
print(f"  Status: {r.status_code}")
print(f"  Response: {r.text[:500]}")

if r.status_code == 200:
    dl = r.json().get("downloadable_exercise", {})
    print(f"  File URL: {dl.get('file_url', 'N/A')[:100]}")
    print(f"  File Name: {dl.get('file_name', 'N/A')}")
    print(f"  File Size: {dl.get('file_size_bytes', 'N/A')}")

# Test 2: Upload multiple files (should create ZIP)
print("\n=== TEST 2: Upload multiple files (ZIP) ===")
file1 = io.BytesIO(b"Archivo 1 de prueba")
file2 = io.BytesIO(b"Archivo 2 de prueba")

files_multi = [
    ("files", ("archivo1.txt", file1, "text/plain")),
    ("files", ("archivo2.txt", file2, "text/plain")),
]
form_data2 = {"title": "TEST: Multi archivos ZIP", "description": "Dos archivos en ZIP"}

r = requests.post(
    f"{BASE}/study-contents/{mid}/sessions/{sid}/topics/{tid}/downloadable/upload",
    headers={"Authorization": f"Bearer {token}"},
    files=files_multi,
    data=form_data2,
    timeout=60
)
print(f"  Status: {r.status_code}")
print(f"  Response: {r.text[:500]}")

# Test 3: Upload larger binary file (simulate PDF)
print("\n=== TEST 3: Upload larger file (simulated PDF) ===")
large_content = b"%PDF-1.4 " + b"x" * 50000  # ~50KB fake PDF
fake_pdf = io.BytesIO(large_content)

files_pdf = {"files": ("documento.pdf", fake_pdf, "application/pdf")}
form_data3 = {"title": "TEST: PDF grande", "description": "Archivo PDF simulado"}

r = requests.post(
    f"{BASE}/study-contents/{mid}/sessions/{sid}/topics/{tid}/downloadable/upload",
    headers={"Authorization": f"Bearer {token}"},
    files=files_pdf,
    data=form_data3,
    timeout=60
)
print(f"  Status: {r.status_code}")
print(f"  Response: {r.text[:500]}")

print("\n=== DONE ===")
