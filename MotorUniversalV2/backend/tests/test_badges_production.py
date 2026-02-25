"""
Test script para Insignias Digitales Open Badges 3.0
Se ejecuta directamente contra la DB de producción para validar:
1. Tablas badge_templates e issued_badges existen
2. CRUD de plantillas
3. Emisión de badge
4. Verificación
5. Endpoints públicos OB3
"""
import sys
import os
import json
import uuid
import string
import random

# Configurar conexión a la DB
DB_SERVER = "evaluaasi-motorv2-sql.database.windows.net"
DB_NAME = "evaluaasi"
DB_USER = "evaluaasi_admin"
DB_PASS = "EvalAasi2024_newpwd!"

connection_string = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"SERVER={DB_SERVER};"
    f"DATABASE={DB_NAME};"
    f"UID={DB_USER};"
    f"PWD={DB_PASS};"
    f"Encrypt=yes;TrustServerCertificate=no;"
)

try:
    import pyodbc
except ImportError:
    print("Installing pyodbc...")
    os.system("pip install pyodbc -q")
    import pyodbc

import requests

API = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
SWA = "https://thankful-stone-07fbe5410.6.azurestaticapps.net"

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


print("\n" + "=" * 60)
print("🏅 TESTS DE INSIGNIAS DIGITALES — PRODUCCIÓN")
print("=" * 60)

# ── 1. DB Schema Tests ──
print("\n📊 1. VERIFICAR ESQUEMA DE BASE DE DATOS")
try:
    conn = pyodbc.connect(connection_string, timeout=10)
    cursor = conn.cursor()

    # badge_templates exists
    cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='badge_templates'")
    test("Tabla badge_templates existe", cursor.fetchone()[0] == 1)

    # issued_badges exists
    cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='issued_badges'")
    test("Tabla issued_badges existe", cursor.fetchone()[0] == 1)

    # Badge templates columns
    cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='badge_templates' ORDER BY ORDINAL_POSITION")
    cols = [r[0] for r in cursor.fetchall()]
    expected_cols = ['id', 'name', 'description', 'criteria_narrative', 'exam_id',
                     'competency_standard_id', 'badge_image_url', 'badge_image_blob_name',
                     'issuer_name', 'issuer_url', 'issuer_image_url', 'tags',
                     'expiry_months', 'is_active', 'created_by_id', 'created_at', 'updated_at']
    for c in expected_cols:
        test(f"  Columna badge_templates.{c}", c in cols, f"Columnas: {cols}")

    # Issued badges columns
    cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='issued_badges' ORDER BY ORDINAL_POSITION")
    cols2 = [r[0] for r in cursor.fetchall()]
    expected_cols2 = ['badge_uuid', 'badge_template_id', 'user_id', 'result_id',
                      'badge_code', 'credential_json', 'badge_image_url',
                      'issued_at', 'expires_at', 'status', 'share_count', 'verify_count']
    for c in expected_cols2:
        test(f"  Columna issued_badges.{c}", c in cols2, f"Columnas: {cols2}")

    # Indexes
    cursor.execute("""
        SELECT i.name 
        FROM sys.indexes i 
        JOIN sys.tables t ON i.object_id = t.object_id 
        WHERE t.name IN ('badge_templates', 'issued_badges') AND i.name IS NOT NULL
        ORDER BY i.name
    """)
    indexes = [r[0] for r in cursor.fetchall()]
    test("Índices creados", len(indexes) >= 5, f"Encontrados: {len(indexes)} — {indexes}")

except Exception as e:
    test("Conexión a DB", False, str(e))
    conn = None

# ── 2. CRUD Tests via DB ──
print("\n📝 2. CRUD DE PLANTILLAS (via DB directa)")
template_id = None
if conn:
    try:
        cursor = conn.cursor()
        
        # Insert template
        cursor.execute("""
            INSERT INTO badge_templates (name, description, criteria_narrative, issuer_name, is_active, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, 1, GETDATE(), GETDATE())
        """, ('TEST: Insignia de Prueba OB3', 'Plantilla de test automatizado', 
              'Aprobar evaluación con 80% mínimo', 'EduIT / Evaluaasi Test'))
        template_id = int(cursor.fetchone()[0])
        conn.commit()
        test("INSERT badge_template", template_id > 0, f"ID={template_id}")

        # Read
        cursor.execute("SELECT name, is_active FROM badge_templates WHERE id=?", template_id)
        row = cursor.fetchone()
        test("SELECT badge_template", row is not None and row[0] == 'TEST: Insignia de Prueba OB3')

        # Update
        cursor.execute("UPDATE badge_templates SET tags=? WHERE id=?", ('test,ob3,automático', template_id))
        conn.commit()
        cursor.execute("SELECT tags FROM badge_templates WHERE id=?", template_id)
        test("UPDATE badge_template", cursor.fetchone()[0] == 'test,ob3,automático')

    except Exception as e:
        test("CRUD badge_templates", False, str(e))

# ── 3. Issued badge Test via DB ──
print("\n🎖 3. EMISIÓN DE INSIGNIA (via DB directa)")
badge_uuid = str(uuid.uuid4())
badge_code = 'BD' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
issued_badge_id = None

if conn and template_id:
    try:
        cursor = conn.cursor()

        # Get any user ID for testing
        cursor.execute("SELECT TOP 1 id FROM users WHERE role='admin'")
        admin_row = cursor.fetchone()
        if not admin_row:
            cursor.execute("SELECT TOP 1 id FROM users")
            admin_row = cursor.fetchone()

        test_user_id = admin_row[0] if admin_row else 'test-user'

        # Build a dummy OB3 credential
        credential = {
            "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
            "id": f"{API}/badges/{badge_uuid}/credential.json",
            "type": ["VerifiableCredential", "OpenBadgeCredential"],
            "issuer": {
                "id": f"{API}/badges/issuer",
                "type": ["Profile"],
                "name": "EduIT / Evaluaasi Test"
            },
            "credentialSubject": {
                "type": ["AchievementSubject"],
                "achievement": {
                    "id": f"{API}/badges/templates/{template_id}/achievement",
                    "type": ["Achievement"],
                    "name": "TEST: Insignia de Prueba OB3"
                }
            }
        }

        cursor.execute("""
            INSERT INTO issued_badges 
            (badge_uuid, badge_template_id, user_id, badge_code, credential_json, issued_at, valid_from, status, share_count, verify_count)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE(), 'active', 0, 0)
        """, (badge_uuid, template_id, test_user_id, badge_code, json.dumps(credential)))
        issued_badge_id = int(cursor.fetchone()[0])
        conn.commit()
        test("INSERT issued_badge", issued_badge_id > 0, f"ID={issued_badge_id}, code={badge_code}")

        # Read back
        cursor.execute("SELECT badge_code, status, badge_uuid FROM issued_badges WHERE id=?", issued_badge_id)
        row = cursor.fetchone()
        test("SELECT issued_badge", row is not None and row[0] == badge_code and row[1] == 'active')

    except Exception as e:
        test("Emisión de badge", False, str(e))

# ── 4. API Tests — Public Endpoints ──
print("\n🌐 4. API ENDPOINTS PÚBLICOS")

# Issuer Profile
try:
    r = requests.get(f"{API}/badges/issuer", timeout=10)
    data = r.json()
    test("GET /badges/issuer — status 200", r.status_code == 200)
    test("  Issuer type=[Profile]", data.get('type') == ['Profile'])
    test("  Issuer name contiene EIA", 'ENTRENAMIENTO' in data.get('name', ''))
    test("  Issuer url=evaluaasi.com", 'evaluaasi.com' in data.get('url', ''))
except Exception as e:
    test("GET /badges/issuer", False, str(e))

# Verify badge — found
try:
    r = requests.get(f"{API}/badges/verify/{badge_code}", timeout=10)
    data = r.json()
    test(f"GET /badges/verify/{badge_code} — status 200", r.status_code == 200)
    test("  valid=True", data.get('valid') == True)
    test("  document_type=digital_badge", data.get('document_type') == 'digital_badge')
    test("  badge.name present", data.get('badge', {}).get('name') is not None)
    test("  badge.badge_uuid matches", data.get('badge', {}).get('badge_uuid') == badge_uuid)
except Exception as e:
    test(f"GET /badges/verify/{badge_code}", False, str(e))

# Verify badge — not found
try:
    r = requests.get(f"{API}/badges/verify/BDXXXXXXXXXX", timeout=10)
    test("GET /badges/verify/BDXXXXXXXXXX — 404", r.status_code == 404)
    test("  valid=False", r.json().get('valid') == False)
except Exception as e:
    test("Verify not found", False, str(e))

# Credential JSON-LD
try:
    r = requests.get(f"{API}/badges/{badge_uuid}/credential.json", timeout=10)
    data = r.json()
    test("GET /badges/<uuid>/credential.json — 200", r.status_code == 200)
    test("  @context present", '@context' in data)
    test("  type includes OpenBadgeCredential", 'OpenBadgeCredential' in data.get('type', []))
    test("  credentialSubject present", 'credentialSubject' in data)
except Exception as e:
    test("Credential JSON-LD", False, str(e))

# Credential for non-existent UUID
try:
    r = requests.get(f"{API}/badges/00000000-0000-0000-0000-000000000000/credential.json", timeout=10)
    test("Credential 404 for fake UUID", r.status_code == 404)
except Exception as e:
    test("Credential 404", False, str(e))

# ── 5. Verify via /verify endpoint (unified) ──
print("\n🔍 5. VERIFICACIÓN UNIFICADA (/api/verify)")

try:
    r = requests.get(f"{API}/verify/{badge_code}", timeout=10)
    data = r.json()
    test(f"GET /verify/{badge_code} — 200", r.status_code == 200)
    test("  valid=True", data.get('valid') == True)
    test("  document_type=digital_badge", data.get('document_type') == 'digital_badge')
    test("  badge object present", 'badge' in data)
    test("  certification object present", 'certification' in data)
except Exception as e:
    test(f"Unified verify {badge_code}", False, str(e))

# ── 6. Verify counter increments ──
print("\n📈 6. CONTADORES DE VERIFICACIÓN")
if conn:
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT verify_count FROM issued_badges WHERE id=?", issued_badge_id)
        count = cursor.fetchone()[0]
        # We made 2 verify calls (badge verify + unified verify), plus the credential.json call
        test(f"verify_count incrementado (>= 2)", count >= 2, f"count={count}")
    except Exception as e:
        test("Verify counter", False, str(e))

# ── 7. Frontend Tests ──
print("\n🖥 7. FRONTEND (SWA)")

try:
    r = requests.get(SWA, timeout=15)
    test("SWA carga correctamente", r.status_code == 200)
    test("  HTML contiene root div", 'id="root"' in r.text or 'id=root' in r.text)
except Exception as e:
    test("SWA check", False, str(e))

# Verify page should be accessible
try:
    r = requests.get(f"{SWA}/verify/{badge_code}", timeout=15)
    test(f"SWA /verify/{badge_code} accesible", r.status_code == 200)
except Exception as e:
    test("SWA verify page", False, str(e))

# Badges templates page (SPA, will return index.html)
try:
    r = requests.get(f"{SWA}/badges/templates", timeout=15)
    test("SWA /badges/templates accesible", r.status_code == 200)
except Exception as e:
    test("SWA badges page", False, str(e))

# ── 8. API Auth-required endpoints (without token, should return 401) ──
print("\n🔒 8. ENDPOINTS PROTEGIDOS (sin token → 401)")

try:
    r = requests.get(f"{API}/badges/templates", timeout=10)
    test("GET /badges/templates sin auth → 401", r.status_code == 401)
except Exception as e:
    test("Templates auth check", False, str(e))

try:
    r = requests.get(f"{API}/badges/my-badges", timeout=10)
    test("GET /badges/my-badges sin auth → 401", r.status_code == 401)
except Exception as e:
    test("My badges auth check", False, str(e))

try:
    r = requests.post(f"{API}/badges/issue", json={"result_id": "fake"}, timeout=10)
    test("POST /badges/issue sin auth → 401", r.status_code == 401)
except Exception as e:
    test("Issue auth check", False, str(e))

# ── 9. Share endpoint (public) ──
print("\n📤 9. SHARE ENDPOINT")
if issued_badge_id:
    try:
        r = requests.post(f"{API}/badges/{issued_badge_id}/share", timeout=10)
        data = r.json()
        test(f"POST /badges/{issued_badge_id}/share — 200", r.status_code == 200)
        test("  share_count > 0", data.get('share_count', 0) > 0)
    except Exception as e:
        test("Share endpoint", False, str(e))

# ── CLEANUP ──
print("\n🧹 LIMPIEZA")
if conn:
    try:
        cursor = conn.cursor()
        if issued_badge_id:
            cursor.execute("DELETE FROM issued_badges WHERE id=?", issued_badge_id)
        if template_id:
            cursor.execute("DELETE FROM badge_templates WHERE id=?", template_id)
        conn.commit()
        test("Datos de prueba eliminados", True)
    except Exception as e:
        test("Limpieza", False, str(e))
    finally:
        conn.close()

# ── SUMMARY ──
print("\n" + "=" * 60)
total = passed + failed
print(f"📋 RESULTADOS: {passed}/{total} tests pasaron")
if failed > 0:
    print(f"   ⚠️  {failed} tests fallaron")
else:
    print(f"   🎉 ¡Todos los tests pasaron!")
print("=" * 60 + "\n")

sys.exit(0 if failed == 0 else 1)
