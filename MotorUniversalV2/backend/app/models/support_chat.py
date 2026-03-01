"""Modelos para chat candidato-soporte."""
from datetime import datetime

from app import db


class SupportConversation(db.Model):
    """Conversación entre candidato y soporte."""

    __tablename__ = "support_conversations"

    id = db.Column(db.Integer, primary_key=True)
    candidate_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_support_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
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
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    participant_role = db.Column(db.String(20), nullable=False)

    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_read_at = db.Column(db.DateTime, nullable=True)
    last_read_message_id = db.Column(
        db.Integer,
        db.ForeignKey("support_messages.id", ondelete="SET NULL"),
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
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    content = db.Column(db.Text, nullable=True)
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
