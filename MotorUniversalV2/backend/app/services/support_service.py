"""
Servicios de negocio para el módulo de soporte.
"""
from collections import defaultdict
from datetime import datetime
import os
import secrets
import smtplib
import ssl
import string
from typing import Any
from email.message import EmailMessage

from sqlalchemy import inspect

from app import db
from app.models import User
from app.models.result import Result
from app.models.partner import Campus, Partner, PartnerStatePresence


def _to_iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _support_user_to_dict(user: User) -> dict[str, Any]:
    full_name_parts = [user.name, user.first_surname, user.second_surname]
    full_name = " ".join([str(part).strip() for part in full_name_parts if part and str(part).strip()])

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "name": user.name,
        "first_surname": user.first_surname,
        "second_surname": user.second_surname,
        "full_name": full_name,
        "gender": user.gender,
        "role": user.role,
        "is_active": bool(user.is_active),
        "is_verified": bool(user.is_verified),
        "curp": user.curp,
        "phone": user.phone,
        "campus_id": user.campus_id,
        "subsystem_id": user.subsystem_id,
        "date_of_birth": _to_iso(getattr(user, "date_of_birth", None)),
        "created_at": _to_iso(user.created_at),
        "last_login": _to_iso(user.last_login),
    }


def _campus_to_support_dict(campus: Campus) -> dict[str, Any]:
    """Normaliza el modelo Campus al formato esperado por soporte."""
    country = getattr(campus, "country", None) or "México"
    location_parts = [campus.city, campus.state_name, country]
    location = ", ".join([part for part in location_parts if part])

    return {
        "id": campus.id,
        "name": campus.name,
        "partner_id": campus.partner_id,
        "partner_name": campus.partner.name if campus.partner else None,
        "state_name": campus.state_name,
        "city": campus.city,
        "country": country,
        "address": campus.address,
        "location": location or None,
        "is_active": bool(campus.is_active),
        "activation_status": getattr(campus, "activation_status", None),
    }


def _group_by_state(campuses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for campus in campuses:
        state_name = (campus.get("state_name") or "Sin estado").strip() or "Sin estado"
        grouped[state_name].append(campus)

    return [
        {
            "state_name": state_name,
            "total": len(items),
            "campuses": items,
        }
        for state_name, items in sorted(grouped.items(), key=lambda kv: kv[0].lower())
    ]


def get_support_campuses(state: str | None = None, active_only: bool | None = True) -> dict[str, Any]:
    """
    Obtiene campuses para el flujo de soporte.

    - Fuente principal: tabla `campuses`
    - Fallback: tabla `partner_state_presences` si `campuses` no existe
    """
    inspector = inspect(db.engine)
    has_campuses_table = inspector.has_table("campuses")

    if has_campuses_table:
        query = Campus.query.outerjoin(Partner)

        if active_only is True:
            query = query.filter(Campus.is_active == True)
        elif active_only is False:
            query = query.filter(Campus.is_active == False)

        if state:
            query = query.filter(Campus.state_name == state)

        campuses = query.order_by(Campus.state_name, Campus.name).all()
        payload = [_campus_to_support_dict(campus) for campus in campuses]
        grouped = _group_by_state(payload)

        if not payload:
            return {
                "message": "No hay campus disponibles",
                "source": "campuses",
                "total": 0,
                "campuses": [],
                "states": [],
            }

        return {
            "message": "Campus obtenidos correctamente",
            "source": "campuses",
            "total": len(payload),
            "campuses": payload,
            "states": grouped,
        }

    # Fallback: no existe tabla campuses.
    has_partner_states = inspector.has_table("partner_state_presences")
    if has_partner_states:
        rows = (
            db.session.query(PartnerStatePresence, Partner.name.label("partner_name"))
            .outerjoin(Partner, Partner.id == PartnerStatePresence.partner_id)
            .order_by(PartnerStatePresence.state_name)
            .all()
        )

        fallback_items: list[dict[str, Any]] = []
        for state_presence, partner_name in rows:
            if state and state_presence.state_name != state:
                continue

            fallback_items.append(
                {
                    "id": f"fallback-{state_presence.id}",
                    "name": f"Campus en {state_presence.state_name}",
                    "partner_id": state_presence.partner_id,
                    "partner_name": partner_name,
                    "state_name": state_presence.state_name,
                    "city": None,
                    "country": "México",
                    "address": None,
                    "location": state_presence.state_name,
                    "is_active": bool(state_presence.is_active),
                    "activation_status": None,
                }
            )

        if active_only is True:
            fallback_items = [item for item in fallback_items if item["is_active"]]
        elif active_only is False:
            fallback_items = [item for item in fallback_items if not item["is_active"]]

        return {
            "message": "No se encontró tabla campuses; se devolvió información relacionada por estado",
            "source": "partner_state_presences",
            "total": len(fallback_items),
            "campuses": fallback_items,
            "states": _group_by_state(fallback_items) if fallback_items else [],
        }

    return {
        "message": "No hay campus disponibles",
        "source": "none",
        "total": 0,
        "campuses": [],
        "states": [],
    }


def _generate_campus_code() -> str:
    """Genera código único de plantel."""
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(15))
        if not Campus.query.filter_by(code=code).first():
            return code


def create_support_campus(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Crea un campus desde el flujo de soporte.

    Campos mínimos:
    - partner_id
    - name
    - state_name (si country=Mexico)
    """
    partner_id = payload.get("partner_id")
    if partner_id is None:
        raise ValueError("partner_id es requerido")

    try:
        partner_id = int(partner_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("partner_id inválido") from exc

    partner = Partner.query.get(partner_id)
    if not partner:
        raise ValueError("partner no encontrado")

    name = (payload.get("name") or "").strip()
    if not name:
        raise ValueError("name es requerido")

    country = (payload.get("country") or "México").strip() or "México"
    state_name = (payload.get("state_name") or "").strip() or None
    if country == "México" and not state_name:
        raise ValueError("state_name es requerido para México")

    city = (payload.get("city") or "").strip() or None
    address = (payload.get("address") or "").strip() or None
    email = (payload.get("email") or "").strip() or None
    phone = (payload.get("phone") or "").strip() or None
    contact_name = (payload.get("contact_name") or "").strip() or None

    if not email:
        raise ValueError("email es requerido")
    if not phone:
        raise ValueError("phone es requerido")

    # Mantener coherencia con presencia por estado para ese partner.
    if state_name:
        presence = PartnerStatePresence.query.filter_by(
            partner_id=partner_id,
            state_name=state_name,
        ).first()
        if not presence:
            db.session.add(
                PartnerStatePresence(
                    partner_id=partner_id,
                    state_name=state_name,
                    is_active=True,
                )
            )

    campus = Campus(
        partner_id=partner_id,
        name=name,
        code=_generate_campus_code(),
        state_name=state_name,
        city=city,
        address=address,
        email=email,
        phone=phone,
        # Para no romper flujos que esperan datos de director.
        director_name=contact_name,
        director_email=email,
        director_phone=phone,
        is_active=False,
    )

    db.session.add(campus)
    db.session.commit()

    return {
        "message": "Campus creado correctamente",
        "campus": _campus_to_support_dict(campus),
    }


def get_support_partners() -> list[dict[str, Any]]:
    """Lista básica de partners para formularios de soporte."""
    inspector = inspect(db.engine)
    if not inspector.has_table("partners"):
        return []

    partners = Partner.query.filter(Partner.is_active == True).order_by(Partner.name).all()
    return [{"id": partner.id, "name": partner.name} for partner in partners]


def get_support_users(
    search: str | None = None,
    role: str | None = "candidato",
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any]:
    """Lista usuarios para el módulo de soporte con filtros de búsqueda."""
    inspector = inspect(db.engine)
    if not inspector.has_table("users"):
        return {
            "message": "No existe la tabla users en la base de datos activa",
            "source": "none",
            "users": [],
            "total": 0,
            "pages": 0,
            "current_page": 1,
        }

    query = User.query

    normalized_role = (role or "").strip()
    if normalized_role:
        query = query.filter(User.role == normalized_role)

    normalized_search = (search or "").strip()
    if normalized_search:
        search_term = f"%{normalized_search}%"
        query = query.filter(
            db.or_(
                User.name.ilike(search_term),
                User.first_surname.ilike(search_term),
                User.second_surname.ilike(search_term),
                User.email.ilike(search_term),
                User.curp.ilike(search_term),
                User.username.ilike(search_term),
            )
        )

    pagination = query.order_by(User.created_at.desc()).paginate(
        page=max(page, 1),
        per_page=max(min(per_page, 100), 1),
        error_out=False,
    )

    return {
        "message": "Usuarios obtenidos correctamente",
        "source": "users",
        "users": [_support_user_to_dict(user) for user in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": pagination.page,
    }


def get_support_calendar_sessions(
    month: str | None = None,
    partner_id: int | None = None,
    campus_id: int | None = None,
) -> dict[str, Any]:
    """
    Obtiene sesiones para calendario de soporte usando la tabla results.
    """
    inspector = inspect(db.engine)
    required_tables = ["results", "users"]
    missing_tables = [table for table in required_tables if not inspector.has_table(table)]
    if missing_tables:
        return {
            "message": f"No existen tablas requeridas en la BD activa: {', '.join(missing_tables)}",
            "source": "none",
            "month": month,
            "total": 0,
            "events": [],
        }

    query = db.session.query(
        Result,
        User,
        Campus.id.label("campus_id"),
        Campus.name.label("campus_name"),
        Partner.id.label("partner_id"),
        Partner.name.label("partner_name"),
    ).join(User, User.id == Result.user_id)

    has_campuses = inspector.has_table("campuses")
    has_partners = inspector.has_table("partners")

    if has_campuses:
        query = query.outerjoin(Campus, Campus.id == User.campus_id)
    if has_partners and has_campuses:
        query = query.outerjoin(Partner, Partner.id == Campus.partner_id)

    if month:
        normalized = month.strip()
        try:
            year_str, month_str = normalized.split("-")
            year_value = int(year_str)
            month_value = int(month_str)
            if month_value < 1 or month_value > 12:
                raise ValueError("Mes inválido")
            start_date = datetime(year_value, month_value, 1)
            if month_value == 12:
                end_date = datetime(year_value + 1, 1, 1)
            else:
                end_date = datetime(year_value, month_value + 1, 1)
            query = query.filter(Result.start_date >= start_date, Result.start_date < end_date)
        except Exception as exc:
            raise ValueError("Formato de mes inválido. Usa YYYY-MM") from exc

    if campus_id is not None and has_campuses:
        query = query.filter(Campus.id == campus_id)

    if partner_id is not None and has_partners and has_campuses:
        query = query.filter(Partner.id == partner_id)

    query = query.order_by(Result.start_date.asc())
    rows = query.limit(500).all()

    events: list[dict[str, Any]] = []
    for result, user, row_campus_id, row_campus_name, row_partner_id, row_partner_name in rows:
        user_name_parts = [user.name, user.first_surname, user.second_surname]
        user_name = " ".join([str(part).strip() for part in user_name_parts if part and str(part).strip()]) or user.username

        events.append(
            {
                "id": result.id,
                "result_id": result.id,
                "title": f"Examen {result.exam_id}",
                "session_type": "exam",
                "start_date": _to_iso(result.start_date),
                "end_date": _to_iso(result.end_date),
                "status": result.status,
                "score": result.score,
                "exam_id": result.exam_id,
                "user_id": user.id,
                "user_name": user_name,
                "campus_id": row_campus_id,
                "campus_name": row_campus_name,
                "partner_id": row_partner_id,
                "partner_name": row_partner_name,
            }
        )

    return {
        "message": "Sesiones obtenidas correctamente",
        "source": "results",
        "month": month,
        "total": len(events),
        "events": events,
    }


def _normalize_template_key(template: str | None) -> str:
    normalized = (template or "").strip().lower()
    replacements = {
        "reenvio": "reenvio",
        "reenvío": "reenvio",
        "confirmacion": "confirmacion",
        "confirmación": "confirmacion",
        "nuevo": "nuevo",
        "registro": "registro",
    }
    return replacements.get(normalized, normalized)


def _build_support_email_template(template: str, user: User | None) -> tuple[str, str]:
    full_name = " ".join(
        [
            str(part).strip()
            for part in [getattr(user, "name", None), getattr(user, "first_surname", None), getattr(user, "second_surname", None)]
            if part and str(part).strip()
        ]
    ) or (getattr(user, "username", None) or "usuario")

    templates: dict[str, tuple[str, str]] = {
        "nuevo": (
            "Bienvenido(a) a Evaluaasi",
            (
                f"Hola {full_name},\n\n"
                "Te damos la bienvenida a Evaluaasi. Tu cuenta ya está disponible para iniciar sesión.\n"
                "Si necesitas apoyo, responde a este correo para atenderte.\n\n"
                "Atentamente,\nEquipo de Soporte Evaluaasi"
            ),
        ),
        "registro": (
            "Confirmación de registro en Evaluaasi",
            (
                f"Hola {full_name},\n\n"
                "Confirmamos que tu registro fue procesado correctamente.\n"
                "Ya puedes ingresar a la plataforma con tus credenciales.\n\n"
                "Atentamente,\nEquipo de Soporte Evaluaasi"
            ),
        ),
        "reenvio": (
            "Reenvío de información de acceso",
            (
                f"Hola {full_name},\n\n"
                "Te compartimos nuevamente la información solicitada para tu acceso.\n"
                "Si presentas algún problema, comunícate con soporte.\n\n"
                "Atentamente,\nEquipo de Soporte Evaluaasi"
            ),
        ),
        "confirmacion": (
            "Confirmación de solicitud",
            (
                f"Hola {full_name},\n\n"
                "Hemos recibido y confirmado tu solicitud.\n"
                "Te notificaremos cualquier actualización por este medio.\n\n"
                "Atentamente,\nEquipo de Soporte Evaluaasi"
            ),
        ),
    }

    if template not in templates:
        raise ValueError("template inválido. Usa: nuevo, registro, reenvio, confirmacion")

    return templates[template]


def send_support_user_email(target: str, template: str) -> dict[str, Any]:
    target_value = (target or "").strip()
    if not target_value:
        raise ValueError("target es requerido")

    template_key = _normalize_template_key(template)
    subject: str
    body: str

    user = User.query.filter((User.email == target_value) | (User.username == target_value)).first()
    recipient_email = target_value
    if user:
        recipient_email = user.email or target_value

    if "@" not in recipient_email:
        raise ValueError("No se encontró un correo válido para el usuario indicado")

    subject, body = _build_support_email_template(template_key, user)

    mail_server = os.getenv("MAIL_SERVER", "").strip()
    mail_port = int(os.getenv("MAIL_PORT", "587"))
    mail_use_tls = os.getenv("MAIL_USE_TLS", "true").strip().lower() in {"1", "true", "yes"}
    mail_use_ssl = os.getenv("MAIL_USE_SSL", "false").strip().lower() in {"1", "true", "yes"}
    mail_username = os.getenv("MAIL_USERNAME", "").strip()
    mail_password = os.getenv("MAIL_PASSWORD", "").strip()
    mail_default_sender = os.getenv("MAIL_DEFAULT_SENDER", "").strip() or mail_username

    if not mail_server:
        raise ValueError("MAIL_SERVER no está configurado")
    if not mail_default_sender:
        raise ValueError("MAIL_DEFAULT_SENDER o MAIL_USERNAME no está configurado")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_default_sender
    msg["To"] = recipient_email
    msg.set_content(body)

    context = ssl.create_default_context()
    if mail_use_ssl:
        with smtplib.SMTP_SSL(mail_server, mail_port, context=context, timeout=20) as smtp:
            if mail_username and mail_password:
                smtp.login(mail_username, mail_password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(mail_server, mail_port, timeout=20) as smtp:
            if mail_use_tls:
                smtp.starttls(context=context)
            if mail_username and mail_password:
                smtp.login(mail_username, mail_password)
            smtp.send_message(msg)

    return {
        "message": "Correo enviado correctamente",
        "target": target_value,
        "recipient_email": recipient_email,
        "template": template_key,
        "subject": subject,
    }
