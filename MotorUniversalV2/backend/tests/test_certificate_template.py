"""
Test de Plantilla de Certificado – Editor ECM
Ejecuta contra la API de producción para validar:
1. DB schema (tabla certificate_templates)
2. Autenticación + Login
3. GET plantilla (antes de subir)
4. POST subir PDF
5. POST subir imagen (PNG) → conversión a PDF
6. POST reemplazar plantilla (?replace=true)
7. PUT actualizar posiciones
8. GET plantilla (después de guardar)
9. Validación de vista previa
10. DELETE eliminar
11. Errores / edge-cases
"""
import sys
import os
import io
import json
import struct
import zlib

# ─── Configuración ───────────────────────────────────────────
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
    print("Instalando pyodbc...")
    os.system("pip install pyodbc -q")
    import pyodbc

import requests

API = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"

# ─── Helpers ─────────────────────────────────────────────────
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


def make_minimal_pdf():
    """Genera un PDF válido mínimo de 200x200 pts."""
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n198\n%%EOF"
    )


def make_minimal_png(width=300, height=200):
    """Genera un PNG válido mínimo (rojo sólido) sin dependencias externas."""
    def crc32(data):
        return struct.pack('>I', zlib.crc32(data) & 0xFFFFFFFF)

    def make_chunk(chunk_type, data):
        return struct.pack('>I', len(data)) + chunk_type + data + crc32(chunk_type + data)

    # Header
    png = b'\x89PNG\r\n\x1a\n'
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    png += make_chunk(b'IHDR', ihdr_data)
    # IDAT
    raw_row = b'\x00' + b'\xff\x00\x00' * width  # filter-byte + RGB
    raw = b''.join([raw_row] * height)
    compressed = zlib.compress(raw)
    png += make_chunk(b'IDAT', compressed)
    # IEND
    png += make_chunk(b'IEND', b'')
    return png


def get_auth_token():
    """Login como admin y devolver access_token."""
    r = requests.post(f"{API}/auth/login", json={
        "username": "admin",
        "password": "Admin123!"
    }, timeout=15)
    if r.status_code == 200:
        return r.json().get("access_token")
    return None


# ─── Variables de test ───────────────────────────────────────
STANDARD_ID = 13  # ECM de prueba
token = None
template_after_upload = None

print("\n" + "=" * 60)
print("📜 TESTS DE PLANTILLA DE CERTIFICADO — PRODUCCIÓN")
print("=" * 60)

# ══════════════════════════════════════════════════════════════
# 1. DB SCHEMA
# ══════════════════════════════════════════════════════════════
print("\n📊 1. VERIFICAR ESQUEMA DE BASE DE DATOS")
try:
    conn = pyodbc.connect(connection_string, timeout=10)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='certificate_templates'"
    )
    test("Tabla certificate_templates existe", cursor.fetchone()[0] == 1)

    cursor.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_NAME='certificate_templates' ORDER BY ORDINAL_POSITION"
    )
    cols = [r[0] for r in cursor.fetchall()]
    expected = [
        'id', 'competency_standard_id', 'template_blob_url',
        'pdf_width', 'pdf_height', 'config',
        'created_by', 'created_at', 'updated_by', 'updated_at'
    ]
    for c in expected:
        test(f"  Columna certificate_templates.{c}", c in cols, f"Columnas: {cols}")

    conn.close()
except Exception as e:
    test("Conectar a DB", False, str(e))

# ══════════════════════════════════════════════════════════════
# 2. AUTENTICACIÓN
# ══════════════════════════════════════════════════════════════
print("\n🔐 2. AUTENTICACIÓN")
try:
    token = get_auth_token()
    test("Login admin exitoso", token is not None)
except Exception as e:
    test("Login admin", False, str(e))

if not token:
    print("\n⛔ No se pudo autenticar. Abortando tests de API.")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}"}

# ══════════════════════════════════════════════════════════════
# 3. LIMPIEZA PREVIA (eliminar plantilla si existe)
# ══════════════════════════════════════════════════════════════
print("\n🧹 3. LIMPIEZA PREVIA")
try:
    r = requests.get(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, timeout=15
    )
    if r.status_code == 200 and r.json().get("has_template"):
        dr = requests.delete(
            f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
            headers=headers, timeout=15
        )
        test("Eliminar plantilla preexistente", dr.status_code == 200, f"Status: {dr.status_code}")
    else:
        test("Sin plantilla preexistente (OK)", True)
except Exception as e:
    test("Limpieza previa", False, str(e))

# ══════════════════════════════════════════════════════════════
# 4. GET SIN PLANTILLA
# ══════════════════════════════════════════════════════════════
print("\n📥 4. GET PLANTILLA (sin plantilla)")
try:
    r = requests.get(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, timeout=15
    )
    test("GET status 200", r.status_code == 200)
    data = r.json()
    test("has_template = false", data.get("has_template") == False)
    test("template = null", data.get("template") is None)
except Exception as e:
    test("GET sin plantilla", False, str(e))

# ══════════════════════════════════════════════════════════════
# 5. POST SUBIR PDF
# ══════════════════════════════════════════════════════════════
print("\n📤 5. POST SUBIR PLANTILLA (PDF)")
try:
    pdf_bytes = make_minimal_pdf()
    files = {"file": ("test_template.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    r = requests.post(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, files=files, timeout=30
    )
    test("POST PDF status 201", r.status_code == 201, f"Status: {r.status_code} — {r.text[:200]}")

    if r.status_code == 201:
        data = r.json()
        template_after_upload = data.get("template")
        test("Respuesta tiene template", template_after_upload is not None)
        test("template_blob_url presente", bool(template_after_upload.get("template_blob_url")), )
        test("pdf_width ≈ 200", abs(template_after_upload.get("pdf_width", 0) - 200) < 5)
        test("pdf_height ≈ 200", abs(template_after_upload.get("pdf_height", 0) - 200) < 5)

        cfg = template_after_upload.get("config", {})
        test("config.name_field presente", "name_field" in cfg)
        test("config.cert_name_field presente", "cert_name_field" in cfg)
        test("config.qr_field presente", "qr_field" in cfg)
        test("name_field tiene x, y, width, height",
             all(k in cfg.get("name_field", {}) for k in ["x", "y", "width", "height"]))
        test("qr_field tiene size, background",
             all(k in cfg.get("qr_field", {}) for k in ["size", "background"]))
except Exception as e:
    test("POST subir PDF", False, str(e))

# ══════════════════════════════════════════════════════════════
# 6. POST SUBIR DUPLICADO (sin replace → 409)
# ══════════════════════════════════════════════════════════════
print("\n🚫 6. POST DUPLICADO (sin replace)")
try:
    pdf_bytes = make_minimal_pdf()
    files = {"file": ("dup.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    r = requests.post(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, files=files, timeout=30
    )
    test("POST duplicado → 409", r.status_code == 409, f"Status: {r.status_code}")
except Exception as e:
    test("POST duplicado", False, str(e))

# ══════════════════════════════════════════════════════════════
# 7. POST REEMPLAZAR CON IMAGEN (PNG, ?replace=true)
# ══════════════════════════════════════════════════════════════
print("\n🖼️  7. POST REEMPLAZAR CON IMAGEN (PNG → PDF)")
try:
    png_bytes = make_minimal_png(400, 300)
    files = {"file": ("test_image.png", io.BytesIO(png_bytes), "image/png")}
    r = requests.post(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template?replace=true",
        headers=headers, files=files, timeout=30
    )
    test("POST replace PNG status 200", r.status_code == 200, f"Status: {r.status_code} — {r.text[:300]}")

    if r.status_code == 200:
        data = r.json()
        tpl = data.get("template", {})
        test("blob_url termina en .pdf (convertido)", tpl.get("template_blob_url", "").endswith(".pdf"))
        test("pdf_width > 0", tpl.get("pdf_width", 0) > 0)
        test("pdf_height > 0", tpl.get("pdf_height", 0) > 0)
        # La imagen era 400x300. ratio = min(1, 1500/400) = 1 → dims ≈ 400x300
        test("Dimensiones razonables", tpl.get("pdf_width", 0) > 100 and tpl.get("pdf_height", 0) > 100)
        template_after_upload = tpl
except Exception as e:
    test("POST reemplazar con imagen", False, str(e))

# ══════════════════════════════════════════════════════════════
# 8. PUT ACTUALIZAR POSICIONES
# ══════════════════════════════════════════════════════════════
print("\n✏️  8. PUT ACTUALIZAR POSICIONES")
new_config = {
    "name_field": {
        "x": 50.0, "y": 120.0, "width": 300.0, "height": 40.0,
        "maxFontSize": 28, "color": "#2d3748"
    },
    "cert_name_field": {
        "x": 50.0, "y": 80.0, "width": 300.0, "height": 25.0,
        "maxFontSize": 16, "color": "#4a5568"
    },
    "qr_field": {
        "x": 15.0, "y": 15.0, "size": 45.0,
        "background": "white", "showCode": True, "showText": False
    }
}
try:
    r = requests.put(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, json={"config": new_config}, timeout=15
    )
    test("PUT status 200", r.status_code == 200, f"Status: {r.status_code} — {r.text[:200]}")

    if r.status_code == 200:
        data = r.json()
        cfg = data.get("template", {}).get("config", {})
        test("name_field.x = 50", abs(cfg.get("name_field", {}).get("x", 0) - 50) < 0.5)
        test("name_field.color = #2d3748", cfg.get("name_field", {}).get("color") == "#2d3748")
        test("qr_field.size = 45", abs(cfg.get("qr_field", {}).get("size", 0) - 45) < 0.5)
        test("qr_field.background = white", cfg.get("qr_field", {}).get("background") == "white")
        test("qr_field.showText = false", cfg.get("qr_field", {}).get("showText") == False)
except Exception as e:
    test("PUT actualizar posiciones", False, str(e))

# ══════════════════════════════════════════════════════════════
# 9. GET PLANTILLA (debe reflejar cambios)
# ══════════════════════════════════════════════════════════════
print("\n📥 9. GET PLANTILLA (con cambios)")
try:
    r = requests.get(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, timeout=15
    )
    test("GET status 200", r.status_code == 200)
    data = r.json()
    test("has_template = true", data.get("has_template") == True)

    tpl = data.get("template", {})
    test("template.id presente", tpl.get("id") is not None)
    cfg = tpl.get("config", {})
    test("Posiciones guardadas correctamente (name_field.x=50)",
         abs(cfg.get("name_field", {}).get("x", 0) - 50) < 0.5)
except Exception as e:
    test("GET con cambios", False, str(e))

# ══════════════════════════════════════════════════════════════
# 10. VISTA PREVIA (preview endpoint)
# ══════════════════════════════════════════════════════════════
print("\n👁️  10. VISTA PREVIA")
try:
    r = requests.get(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template/preview",
        headers=headers, timeout=30,
        allow_redirects=True
    )
    # La preview puede devolver PDF o redirigir
    test("Preview status OK (200/302)", r.status_code in [200, 302], f"Status: {r.status_code}")
    if r.status_code == 200:
        ct = r.headers.get("Content-Type", "")
        test("Preview Content-Type es PDF", "pdf" in ct.lower(), f"Content-Type: {ct}")
except Exception as e:
    test("Vista previa", False, str(e))

# ══════════════════════════════════════════════════════════════
# 11. VALIDACIONES DE ERROR
# ══════════════════════════════════════════════════════════════
print("\n⚠️  11. VALIDACIONES DE ERROR")

# Sin archivo
try:
    r = requests.post(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template?replace=true",
        headers=headers, timeout=15
    )
    test("POST sin archivo → 400", r.status_code == 400, f"Status: {r.status_code}")
except Exception as e:
    test("POST sin archivo", False, str(e))

# Formato inválido
try:
    files = {"file": ("bad.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = requests.post(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template?replace=true",
        headers=headers, files=files, timeout=15
    )
    test("POST formato inválido (.txt) → 400", r.status_code == 400, f"Status: {r.status_code}")
except Exception as e:
    test("POST formato inválido", False, str(e))

# PUT con config incompleta
try:
    r = requests.put(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, json={"config": {"name_field": {"x": 10}}}, timeout=15
    )
    # Podría devolver 400 o aceptar parcial — verificar que responda algo manejable
    test("PUT config incompleta responde (no 500)",
         r.status_code != 500, f"Status: {r.status_code}")
except Exception as e:
    test("PUT config incompleta", False, str(e))

# Sin autenticación
try:
    r = requests.get(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        timeout=15
    )
    test("GET sin auth → 401", r.status_code == 401, f"Status: {r.status_code}")
except Exception as e:
    test("GET sin auth", False, str(e))

# ECM inexistente
try:
    r = requests.get(
        f"{API}/competency-standards/99999/certificate-template",
        headers=headers, timeout=15
    )
    test("GET ECM inexistente → 404", r.status_code == 404, f"Status: {r.status_code}")
except Exception as e:
    test("GET ECM inexistente", False, str(e))

# ══════════════════════════════════════════════════════════════
# 12. DELETE PLANTILLA
# ══════════════════════════════════════════════════════════════
print("\n🗑️  12. DELETE PLANTILLA")
try:
    r = requests.delete(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, timeout=15
    )
    test("DELETE status 200", r.status_code == 200, f"Status: {r.status_code}")

    # Verificar que se eliminó
    r2 = requests.get(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, timeout=15
    )
    test("Plantilla eliminada (has_template=false)",
         r2.status_code == 200 and r2.json().get("has_template") == False)
except Exception as e:
    test("DELETE plantilla", False, str(e))

# DELETE sin plantilla
try:
    r = requests.delete(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, timeout=15
    )
    test("DELETE sin plantilla → 404", r.status_code == 404, f"Status: {r.status_code}")
except Exception as e:
    test("DELETE sin plantilla", False, str(e))

# ══════════════════════════════════════════════════════════════
# 13. RE-SUBIR PARA DEJAR EN ESTADO FUNCIONAL
# ══════════════════════════════════════════════════════════════
print("\n🔄 13. RE-SUBIR PLANTILLA (dejar ECM con plantilla)")
try:
    pdf_bytes = make_minimal_pdf()
    files = {"file": ("final_template.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    r = requests.post(
        f"{API}/competency-standards/{STANDARD_ID}/certificate-template",
        headers=headers, files=files, timeout=30
    )
    test("Re-subir PDF → 201", r.status_code == 201, f"Status: {r.status_code}")
except Exception as e:
    test("Re-subir plantilla", False, str(e))

# ══════════════════════════════════════════════════════════════
# RESUMEN
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
total = passed + failed
print(f"📊 RESULTADOS: {passed}/{total} pasaron, {failed} fallaron")
if failed == 0:
    print("🎉 ¡TODOS LOS TESTS PASARON!")
else:
    print(f"⚠️  {failed} test(s) fallaron.")
print("=" * 60 + "\n")

sys.exit(0 if failed == 0 else 1)
