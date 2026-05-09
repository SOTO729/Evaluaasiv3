"""
Modelo SsoToken — token de un solo uso para Single Sign-On vía API de Tokenización.

Flujo:
1. La institución (partner) llama a /api/sso/generar_token con su `apikey` y los
   datos del alumno. El backend crea/actualiza al `User` y emite un `SsoToken`
   asociado (TTL corto, single-use).
2. El alumno abre `https://app.evaluaasi.com/sso?token=<raw>`. El frontend
   intercambia el token por un par de JWT (access+refresh) en
   /api/auth/sso/exchange.
3. El SsoToken se marca como `consumed_at` y no puede reusarse.

Solo se almacena el SHA-256 del token (`token_hash`); el secreto en claro se
muestra una sola vez en la respuesta de /generar_token.
"""
from datetime import datetime, timedelta
from app import db


class SsoToken(db.Model):
    __tablename__ = 'sso_tokens'

    id = db.Column(db.Integer, primary_key=True)
    # SHA-256 hex (64 chars) del token en claro
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    # Mantenemos partner_id por compat de schema, pero el lookup primario es por campus
    partner_id = db.Column(db.Integer, db.ForeignKey('partners.id', ondelete='CASCADE'), nullable=True, index=True)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    consumed_at = db.Column(db.DateTime, nullable=True)
    issuer_ip = db.Column(db.String(45), nullable=True)

    # Relaciones (evitamos cascade conflictivos en MSSQL)
    user = db.relationship('User', foreign_keys=[user_id])
    partner = db.relationship('Partner', foreign_keys=[partner_id])
    campus = db.relationship('Campus', foreign_keys=[campus_id])

    def is_expired(self) -> bool:
        return datetime.utcnow() >= self.expires_at

    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    def is_valid(self) -> bool:
        return not self.is_consumed() and not self.is_expired()

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'partner_id': self.partner_id,
            'campus_id': self.campus_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'consumed_at': self.consumed_at.isoformat() if self.consumed_at else None,
            'issuer_ip': self.issuer_ip,
        }
