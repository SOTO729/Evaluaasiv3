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

logger = logging.getLogger(__name__)

bp = Blueprint('downloads', __name__)


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
