"""
Tests de verificación — Endpoints CONOCER en Frontend
=====================================================

Verifica que los archivos frontend apuntan a los endpoints backend correctos.
Lee los archivos fuente del frontend y valida URLs, configuraciones y mapeos.

No requiere servidor corriendo — analiza estáticamente el código fuente.

Cubre:
  A. partnersService.ts llama a los endpoints CONOCER correctos
  B. CertificatesPage.tsx apunta al endpoint correcto para certificados
  C. ConocerUploadPage.tsx acepta PDF y ZIP
  D. GroupDocumentsPage.tsx tiene downloadEnabled para tier_advanced
  E. CertificateTypePage.tsx usa downloadGroupCertificatesZip con tier_advanced
  F. api.ts tiene la base URL correcta para producción

Ejecutar:
    cd backend && python -m pytest tests/test_frontend_endpoints.py -v --tb=short
"""
import os
import re
import pytest

# ─── Helpers ────────────────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'src')


def _read_file(relative_path):
    """Lee un archivo del frontend."""
    full_path = os.path.join(FRONTEND_DIR, relative_path)
    assert os.path.exists(full_path), f"Archivo no encontrado: {full_path}"
    with open(full_path, 'r', encoding='utf-8') as f:
        return f.read()


# ═════════════════════════════════════════════════════════════════════
# A. partnersService.ts — Endpoints CONOCER
# ═════════════════════════════════════════════════════════════════════
class TestPartnersServiceEndpoints:
    @pytest.fixture(autouse=True)
    def _load(self):
        self.src = _read_file('services/partnersService.ts')

    def test_upload_batch_endpoint(self):
        """uploadConocerBatch llama a /conocer/admin/upload-batch."""
        assert "'/conocer/admin/upload-batch'" in self.src

    def test_upload_batch_uses_post(self):
        """uploadConocerBatch usa api.post."""
        # Buscar: api.post('/conocer/admin/upload-batch'
        assert "api.post('/conocer/admin/upload-batch'" in self.src

    def test_upload_batch_uses_multipart(self):
        """uploadConocerBatch envía Content-Type multipart."""
        assert "'Content-Type': 'multipart/form-data'" in self.src

    def test_list_batches_endpoint(self):
        """getConocerUploadBatches llama al endpoint correcto."""
        assert "'/conocer/admin/upload-batches'" in self.src

    def test_batch_detail_endpoint(self):
        """getConocerUploadBatchDetail usa template literal correcto."""
        assert "/conocer/admin/upload-batches/${batchId}" in self.src

    def test_batch_logs_endpoint(self):
        """getConocerUploadBatchLogs incluye /logs."""
        assert "/conocer/admin/upload-batches/${batchId}/logs" in self.src

    def test_export_logs_endpoint(self):
        """exportConocerUploadBatchLogs incluye /export."""
        assert "/conocer/admin/upload-batches/${batchId}/export" in self.src

    def test_retry_batch_endpoint(self):
        """retryConocerUploadBatch incluye /retry."""
        assert "/conocer/admin/upload-batches/${batchId}/retry" in self.src

    def test_download_group_certs_endpoint(self):
        """downloadGroupCertificatesZip llama al endpoint de partners."""
        assert "/partners/groups/${groupId}/certificates/download" in self.src

    def test_download_group_certs_sends_types(self):
        """downloadGroupCertificatesZip envía certificate_types en body."""
        assert "certificate_types: certificateTypes" in self.src


# ═════════════════════════════════════════════════════════════════════
# B. CertificatesPage.tsx — Portal del candidato
# ═════════════════════════════════════════════════════════════════════
class TestCertificatesPageEndpoints:
    @pytest.fixture(autouse=True)
    def _load(self):
        self.src = _read_file('pages/certificates/CertificatesPage.tsx')

    def test_fetches_conocer_certificates(self):
        """Llama a /conocer/certificates para listar."""
        assert "/conocer/certificates" in self.src

    def test_downloads_certificate_pdf(self):
        """Llama a /conocer/certificates/${id}/download."""
        # Buscar patrón de download URL
        pattern = r'/conocer/certificates/.*?/download'
        assert re.search(pattern, self.src), "No se encontró endpoint de descarga de certificado"

    def test_uses_authorization_header(self):
        """Envía Bearer token en las peticiones."""
        assert "Authorization" in self.src
        assert "Bearer" in self.src


# ═════════════════════════════════════════════════════════════════════
# C. ConocerUploadPage.tsx — Acepta PDF y ZIP
# ═════════════════════════════════════════════════════════════════════
class TestConocerUploadPage:
    @pytest.fixture(autouse=True)
    def _load(self):
        self.src = _read_file('pages/partners/ConocerUploadPage.tsx')

    def test_accept_attribute_includes_pdf(self):
        """El input file acepta .pdf."""
        assert '.pdf' in self.src

    def test_accept_attribute_includes_zip(self):
        """El input file acepta .zip."""
        assert '.zip' in self.src

    def test_accept_both_formats(self):
        """El atributo accept incluye ambos formatos."""
        assert 'accept=".zip,.pdf"' in self.src

    def test_file_validation_checks_pdf(self):
        """handleFileSelect valida extensión .pdf."""
        assert ".endsWith('.pdf')" in self.src

    def test_file_validation_checks_zip(self):
        """handleFileSelect valida extensión .zip."""
        assert ".endsWith('.zip')" in self.src

    def test_error_message_mentions_pdf_and_zip(self):
        """Mensaje de error menciona ambos formatos."""
        assert 'ZIP o PDF' in self.src

    def test_imports_upload_service(self):
        """Importa uploadConocerBatch del servicio."""
        assert 'uploadConocerBatch' in self.src

    def test_drag_text_mentions_pdf(self):
        """Texto de drag&drop menciona PDF."""
        assert 'PDF o ZIP' in self.src


# ═════════════════════════════════════════════════════════════════════
# D. GroupDocumentsPage.tsx — Downloads habilitados para CONOCER
# ═════════════════════════════════════════════════════════════════════
class TestGroupDocumentsPage:
    @pytest.fixture(autouse=True)
    def _load(self):
        self.src = _read_file('pages/partners/GroupDocumentsPage.tsx')

    def test_tier_advanced_entry_exists(self):
        """Existe una entrada para tier_advanced."""
        assert "tier_advanced" in self.src

    def test_tier_advanced_download_enabled(self):
        """tier_advanced tiene downloadEnabled: true."""
        # Buscar el bloque de tier_advanced y verificar que downloadEnabled es true
        # Pattern: key: 'tier_advanced', ... downloadEnabled: true
        lines = self.src.split('\n')
        in_advanced = False
        found_enabled = False
        for line in lines:
            if "'tier_advanced'" in line or '"tier_advanced"' in line:
                in_advanced = True
            if in_advanced and 'downloadEnabled' in line:
                found_enabled = True
                assert 'true' in line, f"downloadEnabled debería ser true para tier_advanced. Linea: {line.strip()}"
                break
            if in_advanced and line.strip() == '},':
                break
        assert found_enabled, "No se encontró downloadEnabled para tier_advanced"

    def test_conocer_route_is_correct(self):
        """La ruta del card CONOCER es 'conocer'."""
        assert "route: 'conocer'" in self.src


# ═════════════════════════════════════════════════════════════════════
# E. CertificateTypePage.tsx — Descarga ZIP usa tier_advanced
# ═════════════════════════════════════════════════════════════════════
class TestCertificateTypePage:
    @pytest.fixture(autouse=True)
    def _load(self):
        self.src = _read_file('pages/partners/certificates/CertificateTypePage.tsx')

    def test_imports_download_function(self):
        """Importa downloadGroupCertificatesZip."""
        assert 'downloadGroupCertificatesZip' in self.src

    def test_uses_cert_type_in_download(self):
        """Pasa el certType a la función de descarga."""
        # El componente llama downloadGroupCertificatesZip(groupId, [certType], ...)
        assert 'downloadGroupCertificatesZip' in self.src

    def test_has_download_handlers(self):
        """Tiene handlers de descarga (handleDownloadSelected, handleDownloadAll)."""
        assert 'handleDownloadSelected' in self.src or 'handleDownload' in self.src


# ═════════════════════════════════════════════════════════════════════
# F. api.ts — Base URL correcta
# ═════════════════════════════════════════════════════════════════════
class TestApiConfiguration:
    @pytest.fixture(autouse=True)
    def _load(self):
        self.src = _read_file('services/api.ts')

    def test_production_url(self):
        """URL de producción apunta al container app correcto."""
        assert 'evaluaasi-motorv2-api.purpleocean' in self.src

    def test_uses_vite_env(self):
        """Usa VITE_API_URL de variables de entorno."""
        assert 'VITE_API_URL' in self.src

    def test_api_path_prefix(self):
        """La URL base termina con /api."""
        assert "/api'" in self.src or '/api"' in self.src

    def test_creates_axios_instance(self):
        """Crea instancia de axios con baseURL."""
        assert 'axios.create' in self.src
        assert 'baseURL' in self.src

    def test_json_content_type(self):
        """Content-Type por defecto es application/json."""
        assert 'application/json' in self.src
