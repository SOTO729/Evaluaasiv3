"""Modelos para chat candidato-soporte."""
from datetime import datetime

from app import db


class SupportConversation(db.Model):
    """Conversación entre candidato y soporte."""

    __tablename__ = "support_conversations"

    id = db.Column(db.Integer, primary_key=True)
    candidate_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    created_by_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="NO ACTION"),
        nullable=True,
        index=True,
    )
    assigned_support_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="NO ACTION"),
        nullable=True,
        index=True,
    )
    assigned_coordinator_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    current_handler_role = db.Column(db.String(20), nullable=False, default="support", index=True)
    subject = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="open", index=True)
    priority = db.Column(db.String(20), nullable=False, default="normal")

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_message_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    messages = db.relationship(
        "SupportMessage",
        backref="conversation",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by="SupportMessage.id.desc()",
    )
    participants = db.relationship(
        "SupportConversationParticipant",
        backref="conversation",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    satisfaction = db.relationship(
        "SupportConversationSatisfaction",
        backref="conversation",
        uselist=False,
        lazy="joined",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        db.Index("ix_support_conversations_candidate_status", "candidate_user_id", "status"),
    )


class SupportConversationParticipant(db.Model):
    """Estado de lectura por usuario dentro de una conversación."""

    __tablename__ = "support_conversation_participants"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer,
        db.ForeignKey("support_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="NO ACTION"),
        nullable=False,
        index=True,
    )
    participant_role = db.Column(db.String(20), nullable=False)

    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_read_at = db.Column(db.DateTime, nullable=True)
    last_read_message_id = db.Column(
        db.Integer,
        db.ForeignKey("support_messages.id", ondelete="NO ACTION"),
        nullable=True,
    )

    __table_args__ = (
        db.UniqueConstraint("conversation_id", "user_id", name="uq_support_conversation_user"),
        db.Index("ix_support_participants_user_conversation", "user_id", "conversation_id"),
    )


class SupportMessage(db.Model):
    """Mensaje de conversación."""

    __tablename__ = "support_messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer,
        db.ForeignKey("support_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="NO ACTION"),
        nullable=True,
        index=True,
    )

    content = db.Column(db.UnicodeText, nullable=True)
    message_type = db.Column(db.String(20), nullable=False, default="text")

    attachment_url = db.Column(db.String(500), nullable=True)
    attachment_name = db.Column(db.String(255), nullable=True)
    attachment_mime_type = db.Column(db.String(120), nullable=True)
    attachment_size_bytes = db.Column(db.BigInteger, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    edited_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.Index("ix_support_messages_conversation_created", "conversation_id", "created_at"),
    )


class SupportConversationSatisfaction(db.Model):
    """Encuesta de satisfacción enviada por el candidato al cerrar una conversación."""

    __tablename__ = "support_conversation_satisfaction"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer,
        db.ForeignKey("support_conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    submitted_by_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.UnicodeText, nullable=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_support_satisfaction_rating"),
    )


class ChatMessageTemplate(db.Model):
    """Plantilla de mensaje reutilizable para chat de soporte."""

    __tablename__ = "chat_message_templates"

    id = db.Column(db.Integer, primary_key=True)
    owner_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.UnicodeText, nullable=False)
    is_global = db.Column(db.Boolean, nullable=False, default=False, index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
