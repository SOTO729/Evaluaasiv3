"""Rutas REST para chat candidato-soporte."""
from datetime import datetime
from functools import wraps
import os

from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func

from app import db
from app.models import User
from app.models.support_chat import (
    SupportConversation,
    SupportConversationParticipant,
    SupportConversationSatisfaction,
    SupportMessage,
)


bp = Blueprint("support_chat", __name__, url_prefix="/api/support/chat")

SUPPORT_ROLES = {"soporte", "admin", "developer"}
COORDINATOR_ROLES = {"coordinator"}
ALLOWED_CONVERSATION_STATUSES = {"open", "resolved", "closed"}
ALLOWED_PRIORITIES = {"low", "normal", "high"}
ALLOWED_SATISFACTION_RATINGS = {1, 2, 3, 4, 5}
ALLOWED_TRANSFER_TARGETS = {"support", "coordinator"}

MAX_MESSAGE_LENGTH = int(os.getenv("SUPPORT_CHAT_MAX_MESSAGE_LENGTH", "4000"))
MAX_SUBJECT_LENGTH = int(os.getenv("SUPPORT_CHAT_MAX_SUBJECT_LENGTH", "255"))
MAX_ATTACHMENT_BYTES = int(os.getenv("SUPPORT_CHAT_ATTACHMENT_MAX_BYTES", str(10 * 1024 * 1024)))
ALLOWED_ATTACHMENT_MIMES = {
    part.strip().lower()
    for part in os.getenv(
        "SUPPORT_CHAT_ATTACHMENT_MIMES",
        "application/pdf,image/png,image/jpeg,text/plain",
    ).split(",")
    if part.strip()
}


def _is_support_like(user: User) -> bool:
    return bool(user and user.role in SUPPORT_ROLES)


def _is_coordinator_like(user: User) -> bool:
    return bool(user and user.role in COORDINATOR_ROLES)


def _is_staff_like(user: User) -> bool:
    return _is_support_like(user) or _is_coordinator_like(user)


def _serialize_message(message: SupportMessage) -> dict:
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_user_id": message.sender_user_id,
        "content": message.content,
        "message_type": message.message_type,
        "attachment": {
            "url": message.attachment_url,
            "name": message.attachment_name,
            "mime_type": message.attachment_mime_type,
            "size_bytes": message.attachment_size_bytes,
        }
        if message.attachment_url
        else None,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "edited_at": message.edited_at.isoformat() if message.edited_at else None,
    }


def _serialize_satisfaction(satisfaction: SupportConversationSatisfaction | None) -> dict | None:
    if not satisfaction:
        return None

    return {
        "id": satisfaction.id,
        "conversation_id": satisfaction.conversation_id,
        "submitted_by_user_id": satisfaction.submitted_by_user_id,
        "rating": satisfaction.rating,
        "comment": satisfaction.comment,
        "submitted_at": satisfaction.submitted_at.isoformat() if satisfaction.submitted_at else None,
        "updated_at": satisfaction.updated_at.isoformat() if satisfaction.updated_at else None,
    }


def _serialize_user_summary(user: User | None) -> dict | None:
    if not user:
        return None

    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "curp": user.curp,
        "phone": user.phone,
        "role": user.role,
        "last_seen": user.last_seen.isoformat() if getattr(user, 'last_seen', None) else None,
    }


def _ensure_participant(conversation_id: int, user: User, participant_role: str | None = None):
    participant = SupportConversationParticipant.query.filter_by(
        conversation_id=conversation_id,
        user_id=user.id,
    ).first()
    if participant:
        return participant

    role = participant_role or (
        "support" if _is_support_like(user) else "coordinator" if _is_coordinator_like(user) else "candidate"
    )
    participant = SupportConversationParticipant(
        conversation_id=conversation_id,
        user_id=user.id,
        participant_role=role,
    )
    db.session.add(participant)
    db.session.flush()
    return participant


def _conversation_for_user_or_403(conversation_id: int, current_user: User):
    conversation = db.session.get(SupportConversation, conversation_id)
    if not conversation:
        return None, (jsonify({"error": "Conversación no encontrada"}), 404)

    if _is_support_like(current_user):
        return conversation, None

    participant = SupportConversationParticipant.query.filter_by(
        conversation_id=conversation.id,
        user_id=current_user.id,
    ).first()
    if participant:
        return conversation, None

    if conversation.candidate_user_id == current_user.id:
        return conversation, None

    return None, (jsonify({"error": "No autorizado para esta conversación"}), 403)


def _unread_count(conversation_id: int, current_user_id: str, last_read_at):
    query = SupportMessage.query.filter(
        SupportMessage.conversation_id == conversation_id,
        SupportMessage.sender_user_id != current_user_id,
    )
    if last_read_at:
        query = query.filter(SupportMessage.created_at > last_read_at)
    return query.count()


def _serialize_conversation_basic(conversation: SupportConversation) -> dict:
    has_satisfaction = conversation.satisfaction is not None
    survey_pending = conversation.status in {"resolved", "closed"} and not has_satisfaction
    candidate = db.session.get(User, conversation.candidate_user_id)
    assigned_support_user = (
        db.session.get(User, conversation.assigned_support_user_id)
        if conversation.assigned_support_user_id
        else None
    )
    assigned_coordinator_user = (
        db.session.get(User, conversation.assigned_coordinator_user_id)
        if conversation.assigned_coordinator_user_id
        else None
    )
    return {
        "id": conversation.id,
        "candidate_user_id": conversation.candidate_user_id,
        "candidate": _serialize_user_summary(candidate),
        "assigned_support_user_id": conversation.assigned_support_user_id,
        "assigned_support_user": _serialize_user_summary(assigned_support_user),
        "assigned_coordinator_user_id": conversation.assigned_coordinator_user_id,
        "assigned_coordinator_user": _serialize_user_summary(assigned_coordinator_user),
        "current_handler_role": conversation.current_handler_role,
        "subject": conversation.subject,
        "status": conversation.status,
        "priority": conversation.priority,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
        "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
        "satisfaction": _serialize_satisfaction(conversation.satisfaction),
        "survey_pending": survey_pending,
    }


def chat_user_required(func_handler):
    @wraps(func_handler)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user or not user.is_active:
            return jsonify({"error": "No autorizado"}), 401
        if user.role not in SUPPORT_ROLES and user.role not in COORDINATOR_ROLES and user.role != "candidato":
            return jsonify({"error": "Rol no permitido para chat"}), 403
        g.current_user = user
        return func_handler(*args, **kwargs)

    return wrapper


@bp.route("/unread-count", methods=["GET"])
@chat_user_required
def get_unread_count():
    """Devuelve el total de mensajes no leídos del usuario actual."""
    current_user = g.current_user

    query = SupportConversation.query.filter(
        SupportConversation.status.in_(["open", "resolved"])
    )

    if _is_support_like(current_user):
        pass  # ve todas
    elif _is_coordinator_like(current_user):
        query = query.filter(SupportConversation.assigned_coordinator_user_id == current_user.id)
    else:
        query = query.filter(SupportConversation.candidate_user_id == current_user.id)

    total_unread = 0
    for conv in query.all():
        participant = SupportConversationParticipant.query.filter_by(
            conversation_id=conv.id,
            user_id=current_user.id,
        ).first()
        total_unread += _unread_count(conv.id, current_user.id, participant.last_read_at if participant else None)

    return jsonify({"unread_count": total_unread})


@bp.route("/conversations", methods=["POST"])
@chat_user_required
def create_conversation():
    current_user = g.current_user
    data = request.get_json(silent=True) or {}

    subject = (data.get("subject") or "").strip() or None
    if subject and len(subject) > MAX_SUBJECT_LENGTH:
        return jsonify({"error": f"subject excede {MAX_SUBJECT_LENGTH} caracteres"}), 400

    status = (data.get("status") or "open").strip().lower()
    priority = (data.get("priority") or "normal").strip().lower()
    if status not in ALLOWED_CONVERSATION_STATUSES:
        return jsonify({"error": "status inválido"}), 400
    if priority not in ALLOWED_PRIORITIES:
        return jsonify({"error": "priority inválido"}), 400

    if _is_support_like(current_user):
        candidate_user_id = data.get("candidate_user_id")
        if not candidate_user_id:
            return jsonify({"error": "candidate_user_id es requerido"}), 400
    else:
        candidate_user_id = current_user.id

    candidate = db.session.get(User, candidate_user_id)
    if not candidate or candidate.role not in ("candidato", "responsable"):
        return jsonify({"error": "candidate_user_id inválido"}), 400

    assigned_support_user_id = data.get("assigned_support_user_id")
    if assigned_support_user_id:
        support_user = db.session.get(User, assigned_support_user_id)
        if not support_user or not _is_support_like(support_user):
            return jsonify({"error": "assigned_support_user_id inválido"}), 400

    conversation = SupportConversation(
        candidate_user_id=candidate_user_id,
        created_by_user_id=current_user.id,
        assigned_support_user_id=assigned_support_user_id,
        current_handler_role="support",
        subject=subject,
        status=status,
        priority=priority,
        last_message_at=datetime.utcnow(),
    )
    db.session.add(conversation)
    db.session.flush()

    _ensure_participant(conversation.id, candidate, "candidate")

    if _is_support_like(current_user):
        _ensure_participant(conversation.id, current_user, "support")

    if assigned_support_user_id and assigned_support_user_id != current_user.id:
        _ensure_participant(conversation.id, support_user, "support")

    db.session.commit()

    return (
        jsonify(
            {
                "id": conversation.id,
                "candidate_user_id": conversation.candidate_user_id,
                "candidate": _serialize_user_summary(candidate),
                "assigned_support_user_id": conversation.assigned_support_user_id,
                "assigned_coordinator_user_id": conversation.assigned_coordinator_user_id,
                "current_handler_role": conversation.current_handler_role,
                "subject": conversation.subject,
                "status": conversation.status,
                "priority": conversation.priority,
                "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
            }
        ),
        201,
    )


@bp.route("/conversations", methods=["GET"])
@chat_user_required
def list_conversations():
    current_user = g.current_user
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)

    status = (request.args.get("status") or "").strip().lower()
    if status and status not in ALLOWED_CONVERSATION_STATUSES:
        return jsonify({"error": "status inválido"}), 400

    query = SupportConversation.query

    if status:
        query = query.filter(SupportConversation.status == status)

    if _is_support_like(current_user):
        assigned_to_me = (request.args.get("assigned_to_me") or "false").lower() in {"1", "true", "yes"}
        if assigned_to_me:
            query = query.filter(SupportConversation.assigned_support_user_id == current_user.id)
    elif _is_coordinator_like(current_user):
        query = query.filter(SupportConversation.assigned_coordinator_user_id == current_user.id)
    else:
        query = query.filter(SupportConversation.candidate_user_id == current_user.id)

    paginated = query.order_by(SupportConversation.last_message_at.desc()).paginate(
        page=page,
        per_page=per_page,
        error_out=False,
    )

    items = []
    for conv in paginated.items:
        participant = SupportConversationParticipant.query.filter_by(
            conversation_id=conv.id,
            user_id=current_user.id,
        ).first()
        last_message = conv.messages.first()
        unread = _unread_count(conv.id, current_user.id, participant.last_read_at if participant else None)

        item = _serialize_conversation_basic(conv)
        item["last_message"] = _serialize_message(last_message) if last_message else None
        item["unread_count"] = unread
        items.append(item)

    return jsonify(
        {
            "conversations": items,
            "page": page,
            "per_page": per_page,
            "total": paginated.total,
            "pages": paginated.pages,
        }
    )


@bp.route("/conversations/<int:conversation_id>/messages", methods=["POST"])
@chat_user_required
def send_message(conversation_id: int):
    current_user = g.current_user
    conversation, error_response = _conversation_for_user_or_403(conversation_id, current_user)
    if error_response:
        return error_response

    if conversation.status == "closed":
        return jsonify({"error": "La conversación está cerrada"}), 409

    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    if content and len(content) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": f"content excede {MAX_MESSAGE_LENGTH} caracteres"}), 400

    attachment = data.get("attachment") or None
    if attachment and not isinstance(attachment, dict):
        return jsonify({"error": "attachment debe ser un objeto"}), 400

    attachment_url = None
    attachment_name = None
    attachment_mime_type = None
    attachment_size_bytes = None

    if attachment:
        attachment_url = (attachment.get("url") or "").strip()
        attachment_name = (attachment.get("name") or "").strip() or None
        attachment_mime_type = (attachment.get("mime_type") or "").strip().lower() or None
        attachment_size_bytes = attachment.get("size_bytes")

        if not attachment_url:
            return jsonify({"error": "attachment.url es requerido"}), 400

        if attachment_mime_type and attachment_mime_type not in ALLOWED_ATTACHMENT_MIMES:
            return jsonify({"error": "attachment.mime_type no permitido"}), 400

        if attachment_size_bytes is not None:
            try:
                attachment_size_bytes = int(attachment_size_bytes)
            except (TypeError, ValueError):
                return jsonify({"error": "attachment.size_bytes inválido"}), 400
            if attachment_size_bytes < 0 or attachment_size_bytes > MAX_ATTACHMENT_BYTES:
                return jsonify({"error": "attachment.size_bytes fuera de límite"}), 400

    if not content and not attachment_url:
        return jsonify({"error": "content o attachment es requerido"}), 400

    participant = SupportConversationParticipant.query.filter_by(
        conversation_id=conversation.id,
        user_id=current_user.id,
    ).first()

    if not participant:
        if _is_staff_like(current_user):
            participant = _ensure_participant(conversation.id, current_user, "support")
        else:
            return jsonify({"error": "No autorizado para enviar mensajes en esta conversación"}), 403

    message = SupportMessage(
        conversation_id=conversation.id,
        sender_user_id=current_user.id,
        content=content or None,
        message_type="attachment" if attachment_url and not content else "text",
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        attachment_mime_type=attachment_mime_type,
        attachment_size_bytes=attachment_size_bytes,
    )

    db.session.add(message)

    now = datetime.utcnow()
    conversation.last_message_at = now
    conversation.updated_at = now
    if _is_support_like(current_user) and not conversation.assigned_support_user_id:
        conversation.assigned_support_user_id = current_user.id
        conversation.current_handler_role = "support"
    if _is_coordinator_like(current_user):
        conversation.assigned_coordinator_user_id = current_user.id
        conversation.current_handler_role = "coordinator"

    db.session.commit()

    return jsonify({"message": _serialize_message(message)}), 201


@bp.route("/conversations/<int:conversation_id>/messages", methods=["GET"])
@chat_user_required
def get_history(conversation_id: int):
    current_user = g.current_user
    conversation, error_response = _conversation_for_user_or_403(conversation_id, current_user)
    if error_response:
        return error_response

    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 50, type=int), 1), 200)

    query = SupportMessage.query.filter_by(conversation_id=conversation.id).order_by(SupportMessage.id.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    ordered_messages = list(reversed(paginated.items))

    return jsonify(
        {
            "conversation_id": conversation.id,
            "messages": [_serialize_message(item) for item in ordered_messages],
            "page": page,
            "per_page": per_page,
            "total": paginated.total,
            "pages": paginated.pages,
        }
    )


@bp.route("/conversations/<int:conversation_id>/read", methods=["POST"])
@chat_user_required
def mark_read(conversation_id: int):
    current_user = g.current_user
    conversation, error_response = _conversation_for_user_or_403(conversation_id, current_user)
    if error_response:
        return error_response

    participant = SupportConversationParticipant.query.filter_by(
        conversation_id=conversation.id,
        user_id=current_user.id,
    ).first()

    if not participant and _is_staff_like(current_user):
        participant = _ensure_participant(conversation.id, current_user, "support")
    elif not participant:
        return jsonify({"error": "No autorizado para actualizar lectura"}), 403

    data = request.get_json(silent=True) or {}
    last_message_id = data.get("last_message_id")

    if last_message_id is not None:
        msg = SupportMessage.query.filter_by(
            id=last_message_id,
            conversation_id=conversation.id,
        ).first()
        if not msg:
            return jsonify({"error": "last_message_id inválido"}), 400
        participant.last_read_message_id = msg.id
        participant.last_read_at = msg.created_at
    else:
        latest_message = (
            SupportMessage.query.with_entities(func.max(SupportMessage.created_at))
            .filter(SupportMessage.conversation_id == conversation.id)
            .scalar()
        )
        participant.last_read_at = latest_message or datetime.utcnow()

    db.session.commit()

    unread = _unread_count(conversation.id, current_user.id, participant.last_read_at)
    return jsonify(
        {
            "conversation_id": conversation.id,
            "last_read_at": participant.last_read_at.isoformat() if participant.last_read_at else None,
            "last_read_message_id": participant.last_read_message_id,
            "unread_count": unread,
        }
    )


@bp.route("/conversations/<int:conversation_id>/status", methods=["PATCH"])
@chat_user_required
def update_conversation_status(conversation_id: int):
    current_user = g.current_user
    conversation, error_response = _conversation_for_user_or_403(conversation_id, current_user)
    if error_response:
        return error_response

    data = request.get_json(silent=True) or {}
    target_status = (data.get("status") or "").strip().lower()
    if target_status not in ALLOWED_CONVERSATION_STATUSES:
        return jsonify({"error": "status inválido"}), 400

    if _is_staff_like(current_user):
        allowed_statuses = ALLOWED_CONVERSATION_STATUSES
    else:
        # El candidato puede resolver o reabrir su conversación, pero no cerrarla.
        allowed_statuses = {"open", "resolved"}

    if target_status not in allowed_statuses:
        return jsonify({"error": "No autorizado para establecer ese estado"}), 403

    conversation.status = target_status
    conversation.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"conversation": _serialize_conversation_basic(conversation)}), 200


@bp.route("/conversations/<int:conversation_id>/satisfaction", methods=["GET"])
@chat_user_required
def get_conversation_satisfaction(conversation_id: int):
    current_user = g.current_user
    conversation, error_response = _conversation_for_user_or_403(conversation_id, current_user)
    if error_response:
        return error_response

    return jsonify(
        {
            "conversation_id": conversation.id,
            "survey_pending": conversation.status in {"resolved", "closed"} and conversation.satisfaction is None,
            "satisfaction": _serialize_satisfaction(conversation.satisfaction),
        }
    ), 200


@bp.route("/conversations/<int:conversation_id>/satisfaction", methods=["POST"])
@chat_user_required
def submit_conversation_satisfaction(conversation_id: int):
    current_user = g.current_user
    conversation, error_response = _conversation_for_user_or_403(conversation_id, current_user)
    if error_response:
        return error_response

    if _is_staff_like(current_user):
        return jsonify({"error": "Solo el candidato puede responder la encuesta"}), 403

    if conversation.candidate_user_id != current_user.id:
        return jsonify({"error": "Solo el candidato de la conversación puede responder"}), 403

    if conversation.status not in {"resolved", "closed"}:
        return jsonify({"error": "La encuesta solo se habilita cuando la conversación está resuelta o cerrada"}), 409

    data = request.get_json(silent=True) or {}
    rating = data.get("rating")
    comment = (data.get("comment") or "").strip() or None

    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return jsonify({"error": "rating inválido"}), 400

    if rating not in ALLOWED_SATISFACTION_RATINGS:
        return jsonify({"error": "rating debe estar entre 1 y 5"}), 400

    satisfaction = conversation.satisfaction
    now = datetime.utcnow()

    if satisfaction is None:
        satisfaction = SupportConversationSatisfaction(
            conversation_id=conversation.id,
            submitted_by_user_id=current_user.id,
            rating=rating,
            comment=comment,
            submitted_at=now,
        )
        db.session.add(satisfaction)
    else:
        satisfaction.rating = rating
        satisfaction.comment = comment
        satisfaction.submitted_by_user_id = current_user.id
        satisfaction.updated_at = now

    conversation.updated_at = now
    db.session.commit()

    return jsonify(
        {
            "conversation": _serialize_conversation_basic(conversation),
            "satisfaction": _serialize_satisfaction(satisfaction),
        }
    ), 200


@bp.route("/conversations/<int:conversation_id>/transfer", methods=["POST"])
@chat_user_required
def transfer_conversation(conversation_id: int):
    current_user = g.current_user
    conversation, error_response = _conversation_for_user_or_403(conversation_id, current_user)
    if error_response:
        return error_response

    if not _is_staff_like(current_user):
        return jsonify({"error": "Solo soporte o coordinador pueden transferir conversaciones"}), 403

    data = request.get_json(silent=True) or {}
    target_role = (data.get("target_role") or "").strip().lower()
    target_user_id = (data.get("target_user_id") or "").strip() or None

    if target_role not in ALLOWED_TRANSFER_TARGETS:
        return jsonify({"error": "target_role inválido"}), 400

    now = datetime.utcnow()
    actor_name = current_user.full_name or current_user.username or "Usuario"

    if target_role == "coordinator":
        if not _is_support_like(current_user):
            return jsonify({"error": "Solo soporte puede derivar la conversación a coordinador"}), 403
        if not target_user_id:
            return jsonify({"error": "target_user_id es requerido para coordinador"}), 400

        target_user = db.session.get(User, target_user_id)
        if not target_user or not _is_coordinator_like(target_user):
            return jsonify({"error": "target_user_id inválido para coordinador"}), 400

        conversation.assigned_coordinator_user_id = target_user.id
        conversation.current_handler_role = "coordinator"
        if not conversation.assigned_support_user_id:
            conversation.assigned_support_user_id = current_user.id

        _ensure_participant(conversation.id, target_user, "coordinator")
        system_text = (
            f"El equipo de soporte te dirigio con el coordinador "
            f"{target_user.full_name or target_user.username or 'Coordinador'}."
        )
    else:
        if not _is_coordinator_like(current_user):
            return jsonify({"error": "Solo coordinador puede regresar la conversación a soporte"}), 403

        target_user = db.session.get(User, target_user_id) if target_user_id else None
        if target_user_id and (not target_user or not _is_support_like(target_user)):
            return jsonify({"error": "target_user_id inválido para soporte"}), 400

        if target_user:
            conversation.assigned_support_user_id = target_user.id
            _ensure_participant(conversation.id, target_user, "support")

        conversation.assigned_coordinator_user_id = None
        conversation.current_handler_role = "support"
        system_text = (
            f"El coordinador {actor_name} regreso esta conversación al equipo de soporte."
        )

    conversation.updated_at = now
    conversation.last_message_at = now

    system_message = SupportMessage(
        conversation_id=conversation.id,
        sender_user_id=current_user.id,
        content=system_text,
        message_type="system",
    )
    db.session.add(system_message)
    db.session.commit()

    return jsonify(
        {
            "conversation": _serialize_conversation_basic(conversation),
            "message": _serialize_message(system_message),
        }
    ), 200
