"""
Rutas para flujo de soporte.
"""
from functools import wraps

from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import User
from app.services.support_service import (
    get_support_calendar_sessions,
    create_support_campus,
    get_support_campuses,
    get_support_partners,
    get_support_users,
    send_support_user_email,
)

bp = Blueprint("support", __name__, url_prefix="/api/support")
SUPPORT_ROLES = {"soporte", "admin", "developer"}


def support_user_required(func_handler):
    @wraps(func_handler)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or not user.is_active:
            return jsonify({"error": "No autorizado"}), 401
        if user.role not in SUPPORT_ROLES:
            return jsonify({"error": "Insufficient permissions"}), 403
        g.current_user = user
        return func_handler(*args, **kwargs)

    return wrapper


def _parse_active_only(value: str | None) -> bool | None:
    if value is None:
        return True

    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes"}:
        return True
    if normalized in {"0", "false", "no"}:
        return False
    return None


@bp.route("/campuses", methods=["GET"])
@support_user_required
def list_support_campuses():
    """
    Obtener campuses para la vista de soporte.

    Query params:
    - state: filtrar por estado exacto
    - active_only: true|false|all
    """
    try:
        state = request.args.get("state")
        active_only = _parse_active_only(request.args.get("active_only"))
        data = get_support_campuses(state=state, active_only=active_only)
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc), "message": "No se pudieron obtener los campuses"}), 500


@bp.route("/partners", methods=["GET"])
@support_user_required
def list_support_partners():
    """Obtener partners activos para el formulario de soporte."""
    try:
        return jsonify({"partners": get_support_partners()}), 200
    except Exception as exc:
        return jsonify({"error": str(exc), "message": "No se pudieron obtener los partners"}), 500


@bp.route("/users", methods=["GET"])
@support_user_required
def list_support_users():
    """Obtener usuarios para el módulo de soporte."""
    try:
        search = request.args.get("search")
        role = request.args.get("role", "candidato")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        return jsonify(get_support_users(search=search, role=role, page=page, per_page=per_page)), 200
    except Exception as exc:
        return jsonify({"error": str(exc), "message": "No se pudieron obtener los usuarios"}), 500


@bp.route("/calendar/sessions", methods=["GET"])
@support_user_required
def list_support_calendar_sessions():
    """Obtener sesiones para calendario de soporte."""
    try:
        month = request.args.get("month")
        partner_id = request.args.get("partner_id", type=int)
        campus_id = request.args.get("campus_id", type=int)
        return jsonify(
            get_support_calendar_sessions(
                month=month,
                partner_id=partner_id,
                campus_id=campus_id,
            )
        ), 200
    except ValueError as exc:
        return jsonify({"error": str(exc), "message": "Parámetros inválidos para calendario"}), 400
    except Exception as exc:
        return jsonify({"error": str(exc), "message": "No se pudieron obtener las sesiones"}), 500


@bp.route("/campuses", methods=["POST"])
@support_user_required
def create_campus():
    """
    Crear campus desde flujo de soporte.
    """
    try:
        payload = request.get_json(silent=True) or {}
        data = create_support_campus(payload)
        return jsonify(data), 201
    except ValueError as exc:
        return jsonify({"error": str(exc), "message": "Datos inválidos para crear campus"}), 400
    except Exception as exc:
        return jsonify({"error": str(exc), "message": "No se pudo crear el campus"}), 500


@bp.route("/users/send-email", methods=["POST"])
@support_user_required
def send_support_email():
    """
    Enviar correo de soporte a un usuario.
    """
    try:
        payload = request.get_json(silent=True) or {}
        target = payload.get("target")
        template = payload.get("template")
        result = send_support_user_email(target=target, template=template)
        return jsonify(result), 200
    except ValueError as exc:
        return jsonify({"error": str(exc), "message": "Datos inválidos para envío de correo"}), 400
    except Exception as exc:
        return jsonify({"error": str(exc), "message": "No se pudo enviar el correo"}), 500
