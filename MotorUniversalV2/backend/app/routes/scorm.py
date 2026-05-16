"""Blueprint SCORM 1.2 — gestión de paquetes y attempts.

Endpoints (`/api/scorm/*`):
- POST   /packages/init                       Crear UploadSAS para que el cliente suba el .zip
- POST   /packages/finalize                   Indica al backend procesar el upload (extracción)
- GET    /packages/<id>                       Detalle del paquete
- DELETE /packages/<id>                       Borra paquete (assets + DB)
- POST   /topics/<topic_id>/attach/<package>  Asocia paquete a un topic
- POST   /topics/<topic_id>/detach            Desvincula paquete de un topic
- GET    /packages/<id>/launch                URL pública del entry_point + attempt
- GET    /packages/<id>/attempt               Lee el attempt del usuario actual
- POST   /packages/<id>/commit                Guarda CMI del runtime SCORM
"""
from datetime import datetime, timezone
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models.user import User
from app.models.study_content import StudyTopic
from app.models.study_scorm import StudyScormAttempt, StudyScormPackage
from app.services.scorm_service import is_scorm_completed
from app.utils.azure_storage import azure_storage


scorm_bp = Blueprint('scorm', __name__)


EDITOR_ROLES = {'admin', 'developer', 'editor', 'editor_invitado'}


def editor_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role not in EDITOR_ROLES:
            return jsonify({'error': 'Permiso denegado'}), 403
        return fn(*args, **kwargs)
    return wrapper


def _current_user() -> User | None:
    user_id = get_jwt_identity()
    return User.query.get(user_id)


# ────────────────────────────────────────────────────────────────────
# Editor endpoints
# ────────────────────────────────────────────────────────────────────

@scorm_bp.route('/packages/init', methods=['POST'])
@jwt_required()
@editor_required
def init_upload():
    """Devuelve un SAS URL de escritura para subir el ZIP directo al blob.

    Body: { filename: str, size_bytes?: int }
    """
    data = request.get_json(silent=True) or {}
    filename = (data.get('filename') or '').strip() or 'package.zip'
    sas = azure_storage.generate_scorm_upload_sas(filename, ttl_minutes=60)
    if not sas:
        return jsonify({'error': 'No se pudo generar SAS de upload'}), 500
    return jsonify(sas), 200


@scorm_bp.route('/packages/finalize', methods=['POST'])
@jwt_required()
@editor_required
def finalize_upload():
    """Procesa el ZIP subido al blob temporal y extrae los assets.

    Body: { upload_id: str, blob_name: str, title?: str, description?: str }
    """
    from app.services.scorm_service import extract_and_upload

    user = _current_user()
    payload = request.get_json(silent=True) or {}
    upload_id = (payload.get('upload_id') or '').strip()
    blob_name = (payload.get('blob_name') or '').strip()
    if not upload_id or not blob_name:
        return jsonify({'error': 'upload_id y blob_name son requeridos'}), 400

    # Descargar el ZIP del blob temporal
    blob_client = azure_storage.get_scorm_blob_client(blob_name)
    if not blob_client:
        return jsonify({'error': 'Storage no disponible'}), 500
    try:
        if not blob_client.exists():
            return jsonify({'error': 'El upload no se encontró en el blob'}), 404
        zip_bytes = blob_client.download_blob().readall()
    except Exception as e:
        return jsonify({'error': f'No se pudo leer el ZIP: {e}'}), 400

    # Extraer + subir
    try:
        result = extract_and_upload(zip_bytes, package_uuid=upload_id)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Error procesando paquete: {e}'}), 500

    # Borrar el ZIP temporal (el contenido ya está extraído)
    try:
        blob_client.delete_blob()
    except Exception:
        pass

    # Crear registro
    pkg = StudyScormPackage(
        version='1.2' if str(result.get('version', '')).startswith(('1.2', '1.2.')) else (result.get('version') or '1.2'),
        title=(payload.get('title') or result.get('title') or 'Paquete SCORM').strip()[:300],
        description=(payload.get('description') or '').strip() or None,
        blob_prefix=result['prefix'],
        blob_base_url=result['base_url'],
        manifest_path=result.get('manifest_path') or 'imsmanifest.xml',
        entry_point=result['entry_point'],
        size_bytes=result.get('size_bytes') or 0,
        file_count=result.get('file_count') or 0,
        uploaded_by=user.id if user else None,
    )
    db.session.add(pkg)
    db.session.commit()

    return jsonify(pkg.to_dict()), 201


@scorm_bp.route('/import/extract', methods=['POST'])
@jwt_required()
@editor_required
def import_extract():
    """Extrae un ZIP SCORM subido al blob y devuelve el árbol del manifest
    junto con el prefix/base_url donde quedaron los assets.

    NO crea registros en la base de datos: deja todo listo para que
    `/api/study-contents/from-scorm` decida cuántos `StudyScormPackage`
    crear y cómo armar la jerarquía Material → Sesión → Tema.

    Body: { upload_id: str, blob_name: str }

    Response: {
      prefix, base_url, manifest_path, default_entry_point, version, title,
      size_bytes, file_count, tree: [...]
    }
    """
    from app.services.scorm_service import extract_and_upload

    payload = request.get_json(silent=True) or {}
    upload_id = (payload.get('upload_id') or '').strip()
    blob_name = (payload.get('blob_name') or '').strip()
    if not upload_id or not blob_name:
        return jsonify({'error': 'upload_id y blob_name son requeridos'}), 400

    blob_client = azure_storage.get_scorm_blob_client(blob_name)
    if not blob_client:
        return jsonify({'error': 'Storage no disponible'}), 500
    try:
        if not blob_client.exists():
            return jsonify({'error': 'El upload no se encontró en el blob'}), 404
        zip_bytes = blob_client.download_blob().readall()
    except Exception as e:
        return jsonify({'error': f'No se pudo leer el ZIP: {e}'}), 400

    try:
        result = extract_and_upload(zip_bytes, package_uuid=upload_id)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Error procesando paquete: {e}'}), 500

    # Borrar el ZIP temporal
    try:
        blob_client.delete_blob()
    except Exception:
        pass

    return jsonify({
        'prefix': result['prefix'],
        'base_url': result['base_url'],
        'manifest_path': result.get('manifest_path') or 'imsmanifest.xml',
        'default_entry_point': result.get('entry_point'),
        'version': result.get('version'),
        'title': result.get('title'),
        'size_bytes': result.get('size_bytes'),
        'file_count': result.get('file_count'),
        'tree': result.get('tree') or [],
    }), 200


@scorm_bp.route('/packages/<int:package_id>', methods=['GET'])
@jwt_required()
def get_package(package_id: int):
    user = _current_user()
    pkg = StudyScormPackage.query.get(package_id)
    if not pkg:
        return jsonify({'error': 'Paquete no encontrado'}), 404
    include_attempt = user.id if user else None
    return jsonify(pkg.to_dict(include_attempt_for_user=include_attempt)), 200


@scorm_bp.route('/packages/<int:package_id>', methods=['DELETE'])
@jwt_required()
@editor_required
def delete_package(package_id: int):
    pkg = StudyScormPackage.query.get(package_id)
    if not pkg:
        return jsonify({'error': 'Paquete no encontrado'}), 404
    prefix = pkg.blob_prefix
    # Borrar attempts y registro primero
    StudyScormAttempt.query.filter_by(package_id=pkg.id).delete()
    db.session.delete(pkg)
    db.session.commit()
    # Luego borrar blobs
    try:
        azure_storage.delete_scorm_prefix(prefix)
    except Exception as e:
        print(f"[SCORM] Aviso: no se pudo borrar prefix {prefix}: {e}")
    return jsonify({'success': True}), 200


@scorm_bp.route('/topics/<int:topic_id>/attach/<int:package_id>', methods=['POST'])
@jwt_required()
@editor_required
def attach_to_topic(topic_id: int, package_id: int):
    topic = StudyTopic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Topic no encontrado'}), 404
    pkg = StudyScormPackage.query.get(package_id)
    if not pkg:
        return jsonify({'error': 'Paquete no encontrado'}), 404

    # Si el topic ya tiene un paquete distinto, lo desvinculamos primero
    existing = StudyScormPackage.query.filter_by(topic_id=topic_id).first()
    if existing and existing.id != pkg.id:
        existing.topic_id = None

    pkg.topic_id = topic_id
    db.session.commit()
    return jsonify(pkg.to_dict()), 200


@scorm_bp.route('/topics/<int:topic_id>/detach', methods=['POST'])
@jwt_required()
@editor_required
def detach_from_topic(topic_id: int):
    pkg = StudyScormPackage.query.filter_by(topic_id=topic_id).first()
    if not pkg:
        return jsonify({'success': True, 'detached': False}), 200
    pkg.topic_id = None
    db.session.commit()
    return jsonify({'success': True, 'detached': True, 'package_id': pkg.id}), 200


# ────────────────────────────────────────────────────────────────────
# Runtime endpoints (candidato)
# ────────────────────────────────────────────────────────────────────

@scorm_bp.route('/packages/<int:package_id>/launch', methods=['GET'])
@jwt_required()
def launch(package_id: int):
    user = _current_user()
    if not user:
        return jsonify({'error': 'No autorizado'}), 401
    pkg = StudyScormPackage.query.get(package_id)
    if not pkg:
        return jsonify({'error': 'Paquete no encontrado'}), 404
    attempt = _get_or_create_attempt(pkg.id, user.id)
    return jsonify({
        'package': pkg.to_dict(),
        'launch_url': pkg.launch_url,
        'attempt': attempt.to_dict() if attempt else None,
    }), 200


@scorm_bp.route('/packages/<int:package_id>/attempt', methods=['GET'])
@jwt_required()
def get_attempt(package_id: int):
    user = _current_user()
    if not user:
        return jsonify({'error': 'No autorizado'}), 401
    attempt = StudyScormAttempt.query.filter_by(package_id=package_id, user_id=user.id).first()
    if not attempt:
        return jsonify({'attempt': None}), 200
    return jsonify({'attempt': attempt.to_dict()}), 200


@scorm_bp.route('/packages/<int:package_id>/commit', methods=['POST'])
@jwt_required()
def commit_attempt(package_id: int):
    """Persiste el estado CMI del runtime.

    Body: {
      cmi: dict (snapshot completo opcional),
      lesson_status, completion_status, success_status,
      score: { raw, min, max, scaled },
      session_time, total_time, location, suspend_data,
      exit, finished?: bool
    }
    """
    user = _current_user()
    if not user:
        return jsonify({'error': 'No autorizado'}), 401
    pkg = StudyScormPackage.query.get(package_id)
    if not pkg:
        return jsonify({'error': 'Paquete no encontrado'}), 404

    payload = request.get_json(silent=True) or {}
    attempt = _get_or_create_attempt(pkg.id, user.id)

    # Campos de estado
    if 'lesson_status' in payload:
        attempt.lesson_status = (payload.get('lesson_status') or '')[:30] or None
    if 'completion_status' in payload:
        attempt.completion_status = (payload.get('completion_status') or '')[:30] or None
    if 'success_status' in payload:
        attempt.success_status = (payload.get('success_status') or '')[:30] or None

    score = payload.get('score') or {}
    if score:
        for src, dst in (('raw', 'score_raw'), ('min', 'score_min'), ('max', 'score_max'), ('scaled', 'score_scaled')):
            v = score.get(src)
            if v is None or v == '':
                continue
            try:
                setattr(attempt, dst, float(v))
            except (TypeError, ValueError):
                pass

    if 'session_time' in payload:
        attempt.session_time = (payload.get('session_time') or '')[:20] or None
    if 'total_time' in payload:
        attempt.total_time = (payload.get('total_time') or '')[:20] or None
    if 'location' in payload:
        attempt.location = (payload.get('location') or '')[:1000] or None
    if 'suspend_data' in payload:
        attempt.suspend_data = payload.get('suspend_data') or None
    if 'exit' in payload:
        attempt.exit_status = (payload.get('exit') or '')[:30] or None
    if 'cmi' in payload:
        try:
            import json as _json
            attempt.cmi_data = _json.dumps(payload.get('cmi'))[:1_000_000]
        except Exception:
            attempt.cmi_data = None

    attempt.last_commit_at = datetime.now(timezone.utc)
    if payload.get('finished'):
        attempt.finished_at = datetime.now(timezone.utc)

    attempt.is_completed = is_scorm_completed(
        attempt.completion_status, attempt.success_status, attempt.lesson_status
    )

    db.session.commit()
    return jsonify({'attempt': attempt.to_dict()}), 200


def _get_or_create_attempt(package_id: int, user_id: int) -> StudyScormAttempt:
    attempt = StudyScormAttempt.query.filter_by(package_id=package_id, user_id=user_id).first()
    if attempt:
        return attempt
    attempt = StudyScormAttempt(
        package_id=package_id,
        user_id=user_id,
        started_at=datetime.now(timezone.utc),
    )
    db.session.add(attempt)
    db.session.commit()
    return attempt
