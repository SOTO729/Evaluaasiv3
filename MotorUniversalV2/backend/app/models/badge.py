"""
Modelos para Insignias Digitales (Open Badges 3.0)
"""
from datetime import datetime
from app import db


class BadgeTemplate(db.Model):
    """Plantilla de insignia digital — define el Achievement/BadgeClass"""
    __tablename__ = 'badge_templates'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    criteria_narrative = db.Column(db.Text)

    # Asociaciones opcionales
    exam_id = db.Column(db.Integer, db.ForeignKey('exams.id', ondelete='SET NULL'), nullable=True)
    competency_standard_id = db.Column(db.Integer, db.ForeignKey('competency_standards.id', ondelete='SET NULL'), nullable=True)

    # Imagen de la insignia
    badge_image_url = db.Column(db.String(500))
    badge_image_blob_name = db.Column(db.String(500))

    # Datos del emisor (Issuer)
    issuer_name = db.Column(db.String(255), nullable=False, default='ENTRENAMIENTO INFORMATICO AVANZADO S.A. DE C.V.')
    issuer_url = db.Column(db.String(500), default='https://evaluaasi.com')
    issuer_image_url = db.Column(db.String(500))

    # Metadata
    tags = db.Column(db.String(500))
    expiry_months = db.Column(db.Integer, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Auditoría
    created_by_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    issued_badges = db.relationship('IssuedBadge', backref='template', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'criteria_narrative': self.criteria_narrative,
            'exam_id': self.exam_id,
            'competency_standard_id': self.competency_standard_id,
            'badge_image_url': self.badge_image_url,
            'issuer_name': self.issuer_name,
            'issuer_url': self.issuer_url,
            'issuer_image_url': self.issuer_image_url,
            'tags': self.tags or '',
            'expiry_months': self.expiry_months,
            'is_active': self.is_active,
            'issued_count': self.issued_badges.count() if self.issued_badges else 0,
            'created_by_id': self.created_by_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class IssuedBadge(db.Model):
    """Insignia emitida a un candidato — OpenBadgeCredential assertion"""
    __tablename__ = 'issued_badges'

    id = db.Column(db.Integer, primary_key=True)
    badge_uuid = db.Column(db.String(36), unique=True, nullable=False, index=True)
    badge_template_id = db.Column(db.Integer, db.ForeignKey('badge_templates.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    result_id = db.Column(db.String(36), db.ForeignKey('results.id', ondelete='SET NULL'), nullable=True)

    badge_code = db.Column(db.String(12), unique=True, nullable=False, index=True)
    credential_json = db.Column(db.Text)  # JSON-LD completo del OpenBadgeCredential
    badge_image_url = db.Column(db.String(500))
    badge_image_blob_name = db.Column(db.String(500))

    issued_at = db.Column(db.DateTime, default=datetime.utcnow)
    valid_from = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='active', nullable=False)  # active, revoked, expired
    revocation_reason = db.Column(db.String(500))

    # Analytics
    share_count = db.Column(db.Integer, default=0, nullable=False)
    verify_count = db.Column(db.Integer, default=0, nullable=False)
    claimed_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self, include_credential=False):
        data = {
            'id': self.id,
            'badge_uuid': self.badge_uuid,
            'badge_template_id': self.badge_template_id,
            'user_id': self.user_id,
            'result_id': self.result_id,
            'badge_code': self.badge_code,
            'badge_image_url': self.badge_image_url,
            'issued_at': self.issued_at.isoformat() if self.issued_at else None,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'status': self.status,
            'share_count': self.share_count,
            'verify_count': self.verify_count,
            'claimed_at': self.claimed_at.isoformat() if self.claimed_at else None,
            'template': self.template.to_dict() if self.template else None,
        }
        if include_credential:
            data['credential_json'] = self.credential_json
        return data

    @property
    def verify_url(self):
        return f"https://thankful-stone-07fbe5410.6.azurestaticapps.net/verify/{self.badge_code}"

    @property
    def credential_url(self):
        return f"https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/badges/{self.badge_uuid}/credential.json"
