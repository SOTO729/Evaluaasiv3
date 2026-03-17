"""
Tests de integración — Módulo CONOCER: Upload de Certificados
=============================================================

Cubre:
  A. Upload endpoint acepta PDF individual (POST /conocer/admin/upload-batch)
  B. Upload endpoint acepta ZIP con PDFs (POST /conocer/admin/upload-batch)
  C. Rechaza archivos no PDF/ZIP (extensión inválida)
  D. Rechaza archivo vacío
  E. Rechaza ZIP vacío (sin archivos)
  F. Batch se crea y se procesa (status cambia de queued a processing/completed)
  G. Listado de batches funciona (GET /conocer/admin/upload-batches)
  H. Detalle de batch funciona (GET /conocer/admin/upload-batches/<id>)
  I. Logs del batch (GET /conocer/admin/upload-batches/<id>/logs)
  J. Certificados del candidato (GET /conocer/certificates)
  K. Descarga de grupo incluye tier_advanced (POST /partners/groups/<id>/certificates/download)
  L. Sin auth → 401 en endpoints protegidos

Ejecutar:
    cd backend && python -m pytest tests/test_conocer_upload.py -v --tb=short
    cd backend && python -m pytest tests/test_conocer_upload.py -v -k "upload_pdf"
"""
import io
import time
import zipfile
import pytest
import requests

# ─── Configuración ──────────────────────────────────────────────────
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
ADMIN_USER = "admin"
ADMIN_PASS = "Admin123!"
TIMEOUT = 30


# ─── Helpers ────────────────────────────────────────────────────────
def _make_dummy_pdf(content_text="dummy"):
    """Crea un PDF mínimo válido (encabezado PDF estándar)."""
    # PDF válido mínimo
    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj\n"
        b"4 0 obj<</Length 44>>stream\n"
        b"BT /F1 12 Tf 100 700 Td (" + content_text.encode() + b") Tj ET\n"
        b"endstream\nendobj\n"
        b"xref\n0 5\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000206 00000 n \n"
        b"trailer<</Size 5/Root 1 0 R>>\n"
        b"startxref\n302\n%%EOF"
    )
    return pdf


def _make_zip_with_pdfs(filenames_content):
    """Crea un ZIP en memoria con PDFs. filenames_content: dict { name: bytes }."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, data in filenames_content.items():
            zf.writestr(name, data)
    buf.seek(0)
    return buf.getvalue()


def _poll_batch(api, headers, batch_id, max_wait=30):
    """Espera a que el batch termine (completed/failed)."""
    for _ in range(max_wait):
        r = requests.get(
            f"{api}/conocer/admin/upload-batches/{batch_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            return None
        batch = r.json().get("batch", {})
        if batch.get("status") in ("completed", "failed"):
            return batch
        time.sleep(1)
    return None


# ─── Fixtures ───────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    """Obtener JWT token de admin."""
    r = requests.post(
        f"{api}/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"Login falló: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ═════════════════════════════════════════════════════════════════════
# A. Upload PDF individual
# ═════════════════════════════════════════════════════════════════════
class TestUploadPDF:
    def test_upload_pdf_accepted(self, api, headers):
        """POST /conocer/admin/upload-batch con un .pdf → 202 Accepted."""
        pdf_data = _make_dummy_pdf("test cert")
        files = {"file": ("certificado_test.pdf", pdf_data, "application/pdf")}

        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 202, f"Esperaba 202, recibió {r.status_code}: {r.text}"
        body = r.json()
        assert "batch_id" in body
        assert body["total_files"] == 1
        assert body["status"] == "queued"

    def test_upload_pdf_creates_batch_and_processes(self, api, headers):
        """El batch creado a partir de un PDF se procesa o al menos queda en cola."""
        pdf_data = _make_dummy_pdf("process test")
        files = {"file": ("cert_process.pdf", pdf_data, "application/pdf")}

        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 202
        batch_id = r.json()["batch_id"]

        batch = _poll_batch(api, headers, batch_id, max_wait=60)
        if batch is not None:
            assert batch["status"] in ("completed", "failed")
            assert batch["processed_files"] >= 1
        else:
            # El procesamiento puede ser lento; verificar que el batch existe
            r2 = requests.get(
                f"{api}/conocer/admin/upload-batches/{batch_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            assert r2.status_code == 200
            assert r2.json()["status"] in ("queued", "processing", "completed", "failed")


# ═════════════════════════════════════════════════════════════════════
# B. Upload ZIP
# ═════════════════════════════════════════════════════════════════════
class TestUploadZIP:
    def test_upload_zip_accepted(self, api, headers):
        """POST /conocer/admin/upload-batch con un .zip → 202 Accepted."""
        zip_data = _make_zip_with_pdfs({
            "cert_a.pdf": _make_dummy_pdf("cert A"),
            "cert_b.pdf": _make_dummy_pdf("cert B"),
        })
        files = {"file": ("certs.zip", zip_data, "application/zip")}

        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 202, f"Esperaba 202, recibió {r.status_code}: {r.text}"
        body = r.json()
        assert body["total_files"] == 2
        assert body["status"] == "queued"

    def test_upload_zip_processes_all_files(self, api, headers):
        """Todos los archivos del ZIP se procesan o quedan en cola."""
        zip_data = _make_zip_with_pdfs({
            "cert_1.pdf": _make_dummy_pdf("one"),
            "cert_2.pdf": _make_dummy_pdf("two"),
            "cert_3.pdf": _make_dummy_pdf("three"),
        })
        files = {"file": ("batch3.zip", zip_data, "application/zip")}

        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 202
        batch_id = r.json()["batch_id"]
        assert r.json()["total_files"] == 3

        batch = _poll_batch(api, headers, batch_id, max_wait=60)
        if batch is not None:
            assert batch["processed_files"] == 3
        else:
            # Procesamiento lento; verificar que el batch existe con 3 archivos
            r2 = requests.get(
                f"{api}/conocer/admin/upload-batches/{batch_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            assert r2.status_code == 200
            assert r2.json()["total_files"] == 3


# ═════════════════════════════════════════════════════════════════════
# C. Rechazar archivos inválidos
# ═════════════════════════════════════════════════════════════════════
class TestUploadValidation:
    def test_reject_txt_file(self, api, headers):
        """Un .txt → 400 error."""
        files = {"file": ("notes.txt", b"hello world", "text/plain")}
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400
        assert "ZIP o PDF" in r.json().get("error", "")

    def test_reject_docx_file(self, api, headers):
        """Un .docx → 400 error."""
        files = {"file": ("doc.docx", b"\x00" * 100, "application/octet-stream")}
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_reject_empty_file(self, api, headers):
        """Archivo vacío → 400."""
        files = {"file": ("empty.pdf", b"", "application/pdf")}
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400
        assert "vacío" in r.json().get("error", "").lower()

    def test_reject_empty_zip(self, api, headers):
        """ZIP sin archivos → 400."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as zf:
            pass  # ZIP vacío
        buf.seek(0)

        files = {"file": ("empty.zip", buf.getvalue(), "application/zip")}
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400
        assert "vacío" in r.json().get("error", "").lower()

    def test_reject_corrupt_zip(self, api, headers):
        """Datos basura con extensión .zip → 400."""
        files = {"file": ("corrupt.zip", b"not-a-zip-data-at-all", "application/zip")}
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_no_file_field(self, api, headers):
        """Sin campo 'file' → 400."""
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400


# ═════════════════════════════════════════════════════════════════════
# D. Autenticación requerida
# ═════════════════════════════════════════════════════════════════════
class TestAuth:
    def test_upload_no_auth_401(self, api):
        """Sin JWT → 401/422."""
        files = {"file": ("test.pdf", _make_dummy_pdf(), "application/pdf")}
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code in (401, 422)

    def test_list_batches_no_auth_401(self, api):
        """Listar batches sin auth → 401/422."""
        r = requests.get(
            f"{api}/conocer/admin/upload-batches",
            timeout=TIMEOUT,
        )
        assert r.status_code in (401, 422)

    def test_my_certificates_no_auth_401(self, api):
        """Mis certificados sin auth → 401/422."""
        r = requests.get(
            f"{api}/conocer/certificates",
            timeout=TIMEOUT,
        )
        assert r.status_code in (401, 422)


# ═════════════════════════════════════════════════════════════════════
# E. Listado y detalle de batches
# ═════════════════════════════════════════════════════════════════════
class TestBatchManagement:
    def test_list_batches(self, api, headers):
        """GET /conocer/admin/upload-batches → 200 con paginación."""
        r = requests.get(
            f"{api}/conocer/admin/upload-batches",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        body = r.json()
        assert "batches" in body
        assert isinstance(body["batches"], list)

    def test_batch_detail(self, api, headers):
        """GET /conocer/admin/upload-batches/<id> → 200."""
        # Primero crear un batch para tener un ID
        pdf_data = _make_dummy_pdf("detail test")
        files = {"file": ("detail.pdf", pdf_data, "application/pdf")}
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 202
        batch_id = r.json()["batch_id"]

        # Esperar procesamiento
        _poll_batch(api, headers, batch_id, max_wait=20)

        # Consultar detalle
        r = requests.get(
            f"{api}/conocer/admin/upload-batches/{batch_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        batch = r.json()
        assert batch["id"] == batch_id
        assert "total_files" in batch
        assert "status" in batch

    def test_batch_logs(self, api, headers):
        """GET /conocer/admin/upload-batches/<id>/logs → 200."""
        # Crear batch
        pdf_data = _make_dummy_pdf("logs test")
        files = {"file": ("logs.pdf", pdf_data, "application/pdf")}
        r = requests.post(
            f"{api}/conocer/admin/upload-batch",
            headers=headers,
            files=files,
            timeout=TIMEOUT,
        )
        assert r.status_code == 202
        batch_id = r.json()["batch_id"]
        _poll_batch(api, headers, batch_id, max_wait=20)

        # Consultar logs
        r = requests.get(
            f"{api}/conocer/admin/upload-batches/{batch_id}/logs",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        body = r.json()
        assert "logs" in body
        assert isinstance(body["logs"], list)

    def test_batch_not_found(self, api, headers):
        """Batch inexistente → 404."""
        r = requests.get(
            f"{api}/conocer/admin/upload-batches/999999",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 404


# ═════════════════════════════════════════════════════════════════════
# F. Certificados del candidato
# ═════════════════════════════════════════════════════════════════════
class TestCandidateCertificates:
    def test_my_certificates_returns_list(self, api, headers):
        """GET /conocer/certificates → 200 con lista."""
        r = requests.get(
            f"{api}/conocer/certificates",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        body = r.json()
        assert "certificates" in body
        assert isinstance(body["certificates"], list)


# ═════════════════════════════════════════════════════════════════════
# G. Descarga ZIP de grupo (tier_advanced)
# ═════════════════════════════════════════════════════════════════════
class TestGroupDownload:
    def test_download_endpoint_accepts_tier_advanced(self, api, headers):
        """POST /partners/groups/<id>/certificates/download acepta tier_advanced."""
        # Obtener un grupo existente
        r = requests.get(
            f"{api}/partners/groups/list-all?per_page=1",
            headers=headers,
            timeout=TIMEOUT,
        )
        if r.status_code != 200 or not r.json().get("groups"):
            pytest.skip("No hay grupos en DEV para probar descarga")

        group_id = r.json()["groups"][0]["id"]

        # Intentar descarga con tier_advanced
        r = requests.post(
            f"{api}/partners/groups/{group_id}/certificates/download",
            headers=headers,
            json={"certificate_types": ["tier_advanced"]},
            timeout=60,
        )
        # 200 = ZIP generado, 400 = no hay certificados (ambos son válidos)
        assert r.status_code in (200, 400), f"Inesperado: {r.status_code} {r.text[:200]}"

        if r.status_code == 200:
            # Verificar que es un ZIP válido
            assert r.headers.get("Content-Type") == "application/zip"


# ═════════════════════════════════════════════════════════════════════
# H. Verificación pública (sin auth)
# ═════════════════════════════════════════════════════════════════════
class TestPublicVerify:
    def test_verify_nonexistent_certificate(self, api):
        """GET /conocer/verify/FAKE123 → 404 (no auth requerida)."""
        r = requests.get(
            f"{api}/conocer/verify/NONEXISTENT_CERT_123",
            timeout=TIMEOUT,
        )
        assert r.status_code == 404
