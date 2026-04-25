"""
Endpoints administrativos para verificar el estado del AD legacy vía SOAP
(ADWebService). Útil para diagnosticar si el EXE legacy procesó una sesión
y aprovisionó al usuario en AD.

Acceso: admin/developer.
"""
import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.user import User
from app.services import ad_soap_service as soap

logger = logging.getLogger(__name__)

bp = Blueprint('admin_ad_check', __name__, url_prefix='/api/admin/ad-check')


def _require_admin():
    user = User.query.get(get_jwt_identity())
    if not user or user.role not in ('admin', 'developer'):
        return None, (jsonify({'error': 'No autorizado'}), 403)
    return user, None


@bp.route('/ping', methods=['GET'])
@jwt_required()
def ping():
    """HelloWorld al SOAP ADWebService."""
    _, err = _require_admin()
    if err:
        return err
    try:
        return jsonify({'ok': True, 'response': soap.hello_world()})
    except Exception as e:
        logger.exception("SOAP ping failed")
        return jsonify({'ok': False, 'error': str(e)}), 502


@bp.route('/user/<username>', methods=['GET'])
@jwt_required()
def check_user(username):
    """
    Verificar si un usuario existe en AD y devolver su info.
    También intenta GetApplications para ver qué apps le asignaron.
    """
    _, err = _require_admin()
    if err:
        return err

    target = (username or '').strip()
    if not target:
        return jsonify({'error': 'username requerido'}), 400

    try:
        users = soap.get_users()
    except Exception as e:
        logger.exception("SOAP get_users failed")
        return jsonify({'ok': False, 'error': f'SOAP GetUsers: {e}'}), 502

    target_upper = target.upper()
    match = None
    for u in users:
        sam = (u.get('sam_account_name') or '').upper()
        name = (u.get('name') or '').upper()
        if sam == target_upper or name == target_upper:
            match = u
            break

    apps_result = None
    apps_error = None
    try:
        apps_result = soap.get_applications(target)
    except Exception as e:
        apps_error = str(e)

    return jsonify({
        'username': target,
        'exists': match is not None,
        'user': match,
        'applications': apps_result,
        'applications_error': apps_error,
        'total_users_in_ad': len(users),
    })


@bp.route('/overview', methods=['GET'])
@jwt_required()
def overview():
    """
    Snapshot general: workstations, certificaciones, cantidad de usuarios,
    usuarios expirados/completados pendientes de limpieza.
    """
    _, err = _require_admin()
    if err:
        return err

    result = {}

    try:
        result['workstations'] = soap.get_workstations()
    except Exception as e:
        result['workstations_error'] = str(e)

    try:
        result['certifications'] = soap.get_certifications()
    except Exception as e:
        result['certifications_error'] = str(e)

    try:
        users = soap.get_users()
        result['users_count'] = len(users)
        result['users_sample'] = [
            {
                'sam': u.get('sam_account_name'),
                'path': u.get('path'),
                'logon_workstations': u.get('logon_workstations'),
            }
            for u in users[:25]
        ]
    except Exception as e:
        result['users_error'] = str(e)

    return jsonify(result)


@bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    """
    Lista completa de usuarios AD con filtros opcionales:
      ?path_contains=ECM0054
      ?workstation=VDI-OF2016-1
    """
    _, err = _require_admin()
    if err:
        return err

    path_filter = (request.args.get('path_contains') or '').strip().upper()
    ws_filter = (request.args.get('workstation') or '').strip().upper()

    try:
        users = soap.get_users()
    except Exception as e:
        return jsonify({'error': str(e)}), 502

    filtered = []
    for u in users:
        path = (u.get('path') or '').upper()
        lws = (u.get('logon_workstations') or '').upper()
        if path_filter and path_filter not in path:
            continue
        if ws_filter and ws_filter not in lws:
            continue
        filtered.append(u)

    return jsonify({
        'total': len(users),
        'filtered': len(filtered),
        'users': filtered,
    })
