"""
Blueprint para descargas de aplicaciones Office (EXEs VB6).

Endpoints:
  GET  /api/downloads/office-apps  — Lista apps disponibles para el candidato/responsable
  POST /api/downloads/office-apps  — (admin) Crear/actualizar registro de app
  PUT  /api/downloads/office-apps/<id> — (admin) Actualizar app
  DELETE /api/downloads/office-apps/<id> — (admin) Desactivar app
"""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.office_exam import OfficeAppVersion
from app.utils.azure_storage import AzureStorageService

logger = logging.getLogger(__name__)

bp = Blueprint('downloads', __name__)

# Extensiones permitidas para EXEs/instaladores Office
ALLOWED_EXTS = {'exe', 'msi', 'zip', 'rar', '7z'}
MAX_UPLOAD_MB = 200


def _admin_required(user):
    return user and user.role in ('admin', 'developer')


# ─── Public (authenticated) endpoints ───────────────────────────────

@bp.route('/office-apps', methods=['GET'])
@jwt_required()
def list_office_apps():
    """Lista las aplicaciones Office disponibles para descarga.
    Candidatos y responsables ven solo apps activas con download_url.
    Admins ven todas.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    if _admin_required(user):
        apps = OfficeAppVersion.query.order_by(OfficeAppVersion.app_name).all()
    else:
        apps = OfficeAppVersion.query.filter_by(is_active=True)\
            .filter(OfficeAppVersion.download_url.isnot(None))\
            .filter(OfficeAppVersion.download_url != '')\
            .order_by(OfficeAppVersion.app_name).all()

    return jsonify({
        'apps': [a.to_dict() for a in apps],
        'total': len(apps)
    }), 200


# ─── Admin endpoints ────────────────────────────────────────────────

@bp.route('/office-apps', methods=['POST'])
@jwt_required()
def create_office_app():
    """Crear o actualizar un registro de app Office."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _admin_required(user):
        return jsonify({'error': 'Permiso denegado'}), 403

    data = request.get_json()
    if not data or not data.get('app_name') or not data.get('app_type'):
        return jsonify({'error': 'app_name y app_type son requeridos'}), 400

    # Check if exists (upsert by app_name)
    existing = OfficeAppVersion.query.filter_by(app_name=data['app_name']).first()
    if existing:
        existing.app_type = data.get('app_type', existing.app_type)
        existing.latest_version = data.get('latest_version', existing.latest_version)
        existing.min_version = data.get('min_version', existing.min_version)
        existing.download_url = data.get('download_url', existing.download_url)
        existing.is_active = data.get('is_active', existing.is_active)
        db.session.commit()
        return jsonify({'app': existing.to_dict(), 'message': 'App actualizada'}), 200

    app_record = OfficeAppVersion(
        app_name=data['app_name'],
        app_type=data['app_type'],
        latest_version=data.get('latest_version'),
        min_version=data.get('min_version'),
        download_url=data.get('download_url'),
        is_active=data.get('is_active', True)
    )
    db.session.add(app_record)
    db.session.commit()

    return jsonify({'app': app_record.to_dict(), 'message': 'App creada'}), 201


@bp.route('/office-apps/<int:app_id>', methods=['PUT'])
@jwt_required()
def update_office_app(app_id):
    """Actualizar un registro de app Office."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _admin_required(user):
        return jsonify({'error': 'Permiso denegado'}), 403

    app_record = OfficeAppVersion.query.get(app_id)
    if not app_record:
        return jsonify({'error': 'App no encontrada'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No se recibieron datos'}), 400

    if 'app_name' in data:
        app_record.app_name = data['app_name']
    if 'app_type' in data:
        app_record.app_type = data['app_type']
    if 'latest_version' in data:
        app_record.latest_version = data['latest_version']
    if 'min_version' in data:
        app_record.min_version = data['min_version']
    if 'download_url' in data:
        app_record.download_url = data['download_url']
    if 'is_active' in data:
        app_record.is_active = data['is_active']

    db.session.commit()
    return jsonify({'app': app_record.to_dict(), 'message': 'App actualizada'}), 200


@bp.route('/office-apps/<int:app_id>', methods=['DELETE'])
@jwt_required()
def delete_office_app(app_id):
    """Desactivar (soft-delete) un registro de app Office."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _admin_required(user):
        return jsonify({'error': 'Permiso denegado'}), 403

    app_record = OfficeAppVersion.query.get(app_id)
    if not app_record:
        return jsonify({'error': 'App no encontrada'}), 404

    app_record.is_active = False
    db.session.commit()
    return jsonify({'message': 'App desactivada'}), 200


@bp.route('/office-apps/upload', methods=['POST'])
@jwt_required()
def upload_office_app_file():
    """Sube un archivo (EXE/MSI/ZIP) a Azure Blob y retorna la URL pública.
    No crea ni modifica registros — el frontend usa la URL para POST/PUT del catálogo.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not _admin_required(user):
        return jsonify({'error': 'Permiso denegado'}), 403

    if 'file' not in request.files:
        return jsonify({'error': 'Archivo requerido (campo "file")'}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Archivo vacío'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTS:
        return jsonify({
            'error': f'Extensión no permitida. Permitidas: {", ".join(sorted(ALLOWED_EXTS))}'
        }), 400

    # Validar tamaño (Flask ya respeta MAX_CONTENT_LENGTH; aquí damos mensaje claro)
    file.seek(0, 2)
    size_bytes = file.tell()
    file.seek(0)
    if size_bytes > MAX_UPLOAD_MB * 1024 * 1024:
        return jsonify({
            'error': f'Archivo excede {MAX_UPLOAD_MB} MB'
        }), 400

    try:
        storage = AzureStorageService()
        url = storage.upload_file(file, folder='office-apps')
        if not url:
            return jsonify({
                'error': 'No se pudo subir el archivo (Azure Storage no configurado)'
            }), 500
        return jsonify({
            'url': url,
            'filename': file.filename,
            'size_bytes': size_bytes,
        }), 200
    except Exception as e:
        logger.exception('Error subiendo Office app file')
        return jsonify({'error': f'Error en upload: {str(e)}'}), 500


@bp.route('/office-apps/version-check', methods=['GET', 'POST'])
def office_app_version_check():
    """Endpoint público para que un EXE consulte versión más reciente.

    Query/JSON:
      - app_name (required): nombre exacto registrado en OfficeAppVersion
      - current_version (optional): versión actual reportada por el EXE

    Response:
      - app_name, latest_version, min_version, download_url, is_active,
        update_required (bool), update_available (bool)

    Es público para que EXEs sin token puedan auto-actualizar; sólo expone
    metadatos de catálogo (no contiene credenciales ni contenido sensible).
    """
    payload = request.get_json(silent=True) if request.is_json else None
    args = payload or request.values
    app_name = (args.get('app_name') or '').strip()
    current_version = (args.get('current_version') or '').strip()

    if not app_name:
        return jsonify({'error': 'app_name requerido'}), 400

    rec = OfficeAppVersion.query.filter_by(app_name=app_name).first()
    if not rec:
        return jsonify({
            'app_name': app_name,
            'found': False,
            'latest_version': None,
            'min_version': None,
            'download_url': None,
            'is_active': True,
            'update_required': False,
            'update_available': False,
        }), 200

    def _ver_tuple(v):
        try:
            return tuple(int(p) for p in v.split('.') if p.isdigit())
        except Exception:
            return ()

    cur_t = _ver_tuple(current_version) if current_version else ()
    min_t = _ver_tuple(rec.min_version) if rec.min_version else ()
    latest_t = _ver_tuple(rec.latest_version) if rec.latest_version else ()

    update_required = bool(min_t and cur_t and cur_t < min_t) or (rec.is_active is False)
    update_available = bool(latest_t and cur_t and cur_t < latest_t)

    return jsonify({
        'app_name': rec.app_name,
        'found': True,
        'latest_version': rec.latest_version,
        'min_version': rec.min_version,
        'download_url': rec.download_url,
        'is_active': bool(rec.is_active),
        'update_required': update_required,
        'update_available': update_available,
        'current_version': current_version or None,
    }), 200


@bp.route('/office-apps/exam-version', methods=['GET'])
def office_apps_exam_version():
    """Versión vigente del XAE de un examen. Usado por EvaluaasiOfficeV2 (cliente .NET 4.5)
    para decidir si debe re-descargar el .xae desde Blob.

    Query:
      - app_id (required): id del Exam (legacy AplicacionId)

    Response: { version: "x.y.z" }

    Público — sólo expone número de versión (no contenido).
    """
    from app.models.exam import Exam
    app_id = request.args.get('app_id', type=int)
    if not app_id:
        return jsonify({'version': '0.0.0', 'found': False}), 200

    exam = Exam.query.get(app_id)
    if not exam:
        return jsonify({'version': '0.0.0', 'found': False, 'app_id': app_id}), 200

    return jsonify({
        'version': exam.version or '1.0.0',
        'found': True,
        'app_id': exam.id,
        'name': exam.name,
    }), 200
