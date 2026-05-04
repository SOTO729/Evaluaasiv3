"""
Servicio SCORM 1.2.

Funcionalidad:
- Validar y procesar paquetes SCORM (ZIP) subidos al blob.
- Parsear `imsmanifest.xml` para identificar el entry point lanzable.
- Extraer assets al contenedor `scorm-packages/<package_uuid>/...`.
- Política de seguridad: rechazar paths fuera del prefijo, tamaños extremos, archivos
  con extensiones potencialmente peligrosas.
"""
import io
import mimetypes
import os
import re
import uuid
import zipfile
from typing import Optional, Tuple
from xml.etree import ElementTree as ET

from app.utils.azure_storage import AzureStorageService


# Configuración (puede sobreescribirse por env)
SCORM_MAX_PACKAGE_BYTES = int(os.getenv('SCORM_MAX_PACKAGE_BYTES', str(2 * 1024 * 1024 * 1024)))  # 2 GB default
SCORM_MAX_FILE_COUNT = int(os.getenv('SCORM_MAX_FILE_COUNT', '10000'))

# Extensiones que NO se suben (binarios ejecutables, scripts servidor, etc.)
SCORM_BLOCKED_EXTENSIONS = {
    'exe', 'dll', 'bat', 'cmd', 'ps1', 'sh', 'msi', 'app',
    'php', 'asp', 'aspx', 'jsp', 'py', 'rb',
}

# Mapa de content-type para tipos comunes (mimetypes.guess_type también lo intenta)
SCORM_EXTRA_MIMES = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.xml': 'application/xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
}


def guess_content_type(filename: str) -> str:
    ext = os.path.splitext(filename.lower())[1]
    if ext in SCORM_EXTRA_MIMES:
        return SCORM_EXTRA_MIMES[ext]
    guess, _ = mimetypes.guess_type(filename)
    return guess or 'application/octet-stream'


def _is_safe_member_name(name: str) -> bool:
    """Evita path traversal y rutas absolutas."""
    if not name:
        return False
    if '\\' in name:
        # Rutas con backslash de Windows: normalizamos a forward slash
        name = name.replace('\\', '/')
    if name.startswith('/'):
        return False
    parts = name.split('/')
    if any(p in ('..',) for p in parts):
        return False
    if any(p.startswith(':') for p in parts):
        return False
    return True


def _normalize_member_name(name: str) -> str:
    return name.replace('\\', '/').lstrip('/')


def _ext_is_blocked(filename: str) -> bool:
    ext = os.path.splitext(filename.lower())[1].lstrip('.')
    return ext in SCORM_BLOCKED_EXTENSIONS


# Namespaces comunes en imsmanifest.xml
_NS = {
    'ims': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2',
    'imscp': 'http://www.imsglobal.org/xsd/imscp_v1p1',
    'adlcp': 'http://www.adlnet.org/xsd/adlcp_rootv1p2',
    'adlcp2004': 'http://www.adlnet.org/xsd/adlcp_v1p3',
}


def parse_manifest(manifest_bytes: bytes) -> Tuple[str, str, Optional[str], Optional[str]]:
    """Parsea imsmanifest.xml y extrae (entry_point_relative, version, title, organization).

    Lanza ValueError si el manifest es inválido o no se puede determinar el entry point.
    """
    try:
        root = ET.fromstring(manifest_bytes)
    except ET.ParseError as e:
        raise ValueError(f"imsmanifest.xml inválido: {e}")

    # Versión SCORM
    schema_version = None
    metadata = root.find('.//{*}metadata/{*}schemaversion')
    if metadata is not None and metadata.text:
        schema_version = metadata.text.strip()

    # Title (primera organización)
    title = None
    org = root.find('.//{*}organization')
    if org is not None:
        t = org.find('./{*}title')
        if t is not None and t.text:
            title = t.text.strip()
    organization_id = root.find('.//{*}organizations')
    org_id_attr = organization_id.get('default') if organization_id is not None else None

    # Localizar el primer item con identifierref → resource → href
    items = root.findall('.//{*}item[@identifierref]')
    resources = root.findall('.//{*}resource')
    res_by_id = {r.get('identifier'): r for r in resources}

    href = None
    for item in items:
        ref = item.get('identifierref')
        res = res_by_id.get(ref)
        if res is not None:
            # En SCORM 1.2 el atributo es href; algunos paquetes 2004 tienen href también
            h = res.get('href')
            if h:
                href = h
                break

    # Fallback: primer resource con scormtype=sco y href
    if not href:
        for r in resources:
            h = r.get('href')
            if not h:
                continue
            stype = r.get('{http://www.adlnet.org/xsd/adlcp_rootv1p2}scormtype') or \
                    r.get('{http://www.adlnet.org/xsd/adlcp_v1p3}scormType')
            if stype in ('sco', 'asset', None) and h:
                href = h
                break

    if not href:
        raise ValueError("No se pudo determinar el entry point (href) del manifiesto")

    return href, (schema_version or 'unknown'), title, org_id_attr


def extract_and_upload(
    zip_bytes: bytes,
    package_uuid: Optional[str] = None,
) -> dict:
    """Extrae el zip en memoria y sube cada archivo al blob.

    Returns dict: {prefix, base_url, manifest_path, entry_point, version, title, size_bytes, file_count}.
    """
    if not zip_bytes:
        raise ValueError("Paquete vacío")
    if len(zip_bytes) > SCORM_MAX_PACKAGE_BYTES:
        raise ValueError(f"Paquete excede {SCORM_MAX_PACKAGE_BYTES // (1024*1024)} MB")

    package_uuid = package_uuid or uuid.uuid4().hex
    prefix = f"{package_uuid}"

    storage = AzureStorageService()
    storage._ensure_scorm_container()

    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes), 'r')
    except zipfile.BadZipFile as e:
        raise ValueError(f"Archivo no es un ZIP válido: {e}")

    # 1) Buscar manifest a nivel raíz (o en una sola carpeta superior común)
    names = [n for n in zf.namelist() if not n.endswith('/')]
    if len(names) > SCORM_MAX_FILE_COUNT:
        raise ValueError(f"El paquete excede {SCORM_MAX_FILE_COUNT} archivos")

    # Detectar root_dir: si todos los nombres comparten un mismo prefijo, lo descontamos
    root_dir = ''
    if names:
        first = names[0].replace('\\', '/').split('/', 1)
        if len(first) == 2:
            candidate = first[0] + '/'
            if all((n.replace('\\', '/') + '/').startswith(candidate) for n in names):
                root_dir = candidate

    manifest_member = None
    for n in names:
        nn = _normalize_member_name(n)
        rel = nn[len(root_dir):] if root_dir and nn.startswith(root_dir) else nn
        if rel.lower() == 'imsmanifest.xml':
            manifest_member = n
            break

    if not manifest_member:
        raise ValueError("imsmanifest.xml no encontrado en la raíz del ZIP")

    manifest_bytes = zf.read(manifest_member)
    entry_point_raw, version, title, _org = parse_manifest(manifest_bytes)
    entry_point = _normalize_member_name(entry_point_raw)

    # 2) Subir archivos
    file_count = 0
    total_bytes = 0
    rejected = []

    for info in zf.infolist():
        if info.is_dir():
            continue
        member = info.filename
        if not _is_safe_member_name(member):
            rejected.append(member)
            continue
        if _ext_is_blocked(member):
            rejected.append(member)
            continue

        normalized = _normalize_member_name(member)
        # Quitar root_dir si aplica
        if root_dir and normalized.startswith(root_dir):
            relative = normalized[len(root_dir):]
        else:
            relative = normalized

        if not relative or relative.endswith('/'):
            continue

        try:
            data = zf.read(info)
        except Exception as e:
            raise ValueError(f"No se pudo leer {member}: {e}")

        total_bytes += len(data)
        if total_bytes > SCORM_MAX_PACKAGE_BYTES:
            raise ValueError("Paquete descomprimido excede el límite máximo")

        ct = guess_content_type(relative)
        blob_path = f"{prefix}/{relative}"
        url = storage.upload_scorm_asset(data, blob_path, ct)
        if not url:
            raise ValueError(f"Falló subida de {relative}")
        file_count += 1

    base_url = storage.scorm_base_url(prefix)
    return {
        'prefix': prefix,
        'base_url': base_url,
        'manifest_path': 'imsmanifest.xml',
        'entry_point': entry_point,
        'version': version,
        'title': title,
        'size_bytes': total_bytes,
        'file_count': file_count,
        'rejected_count': len(rejected),
    }


def is_scorm_completed(completion_status: Optional[str], success_status: Optional[str], lesson_status: Optional[str]) -> bool:
    """Política de completado MVP:

    - SCORM 1.2 reporta `cmi.core.lesson_status` con valores: passed, completed, failed, incomplete, browsed, not attempted.
    - Si reporta passed/completed → completado.
    - Si paquete reporta success_status='passed' → completado.
    - Si solo reporta completion_status='completed' (sin success_status) → completado.
    """
    ls = (lesson_status or '').strip().lower()
    if ls in ('passed', 'completed'):
        return True
    cs = (completion_status or '').strip().lower()
    ss = (success_status or '').strip().lower()
    if cs == 'completed' and ss in ('passed', '', 'unknown'):
        # Política indicada: si reporta score, exigimos passed; si no reporta, basta completion.
        return True
    return False
