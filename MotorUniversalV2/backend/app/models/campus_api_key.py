"""Modelos de API Keys SSO multi-key por plantel (mayo 2026).

Reemplaza el esquema legacy 1:1 (columnas `api_key_*` en `campuses`) por una
relación 1:N: cada plantel puede tener varias API keys, cada una con su
descripción y con N "plantillas de asignación" (`CampusApiKeyAssignment`).

Cuando un candidato entra por SSO con esta key, se aplican TODAS las
plantillas: por cada examen configurado se hace `find_or_create` de un
`GroupExam` para el grupo resuelto (con la regla actual de `_resolve_and_attach_group`)
clonando la configuración del snapshot.
"""
from __future__ import annotations

import json
import secrets
from datetime import datetime
from typing import Optional

from app import db


class CampusApiKey(db.Model):
    """API key SSO de un plantel. Un plantel puede tener varias."""

    __tablename__ = 'campus_api_keys'

    id = db.Column(db.Integer, primary_key=True)
    campus_id = db.Column(
        db.Integer,
        db.ForeignKey('campuses.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )

    # Metadata visible al usuario
    description = db.Column(db.String(500), nullable=True)
    name = db.Column(db.String(200), nullable=True)  # opcional, alias corto

    # Secreto: argon2 + Fernet + prefix indexable
    api_key_hash = db.Column(db.String(255), nullable=False)
    api_key_encrypted = db.Column(db.Text, nullable=False)
    api_key_prefix = db.Column(db.String(16), nullable=False, index=True)

    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_by_id = db.Column(
        db.String(36),
        db.ForeignKey('users.id', ondelete='NO ACTION'),
        nullable=True,
    )
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Tracking de uso (incrementado en /generar_token)
    last_used_at = db.Column(db.DateTime, nullable=True)
    last_used_ip = db.Column(db.String(45), nullable=True)
    usage_count = db.Column(db.Integer, default=0, nullable=False)

    # Si la key se migró desde el esquema legacy 1:1 → True. Estas keys no
    # tienen `assignments` y se comportan como antes (find-or-create grupo,
    # sin asignación automática de exámenes).
    is_legacy = db.Column(db.Boolean, default=False, nullable=False)

    # Modo de asignación de exámenes para los candidatos que entran por la key:
    #   - 'platform' (default): se materializan las plantillas configuradas en
    #     la propia api key (CampusApiKeyAssignment) al recibir al candidato.
    #   - 'api': NO se aplican plantillas. El examen se decide por el/los
    #     estándar(es) (`estandar`) que mande la llamada a /generar_token; se
    #     asigna el examen activo más reciente de cada estándar con su config
    #     por defecto del editor. Excluyente con las plantillas.
    assignment_mode = db.Column(
        db.String(20), default='platform', nullable=False, server_default='platform'
    )

    # Relaciones
    campus = db.relationship('Campus', backref=db.backref('api_keys', lazy='dynamic', cascade='all, delete-orphan'))
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    assignments = db.relationship(
        'CampusApiKeyAssignment',
        backref='api_key',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )

    # ── crypto helpers ──────────────────────────────────────────────────

    @classmethod
    def generate_raw(cls) -> str:
        return f"evk_{secrets.token_urlsafe(36)}"

    def set_secret(self, raw_key: str) -> None:
        """Persiste hash + cifrado + prefix a partir de un raw key."""
        from argon2 import PasswordHasher
        from app.utils.sso_crypto import encrypt_api_key

        ph = PasswordHasher()
        self.api_key_hash = ph.hash(raw_key)
        self.api_key_encrypted = encrypt_api_key(raw_key)
        self.api_key_prefix = raw_key[:12]

    def verify(self, raw_key: str) -> bool:
        if not raw_key or not self.api_key_hash or not self.is_active:
            return False
        try:
            from argon2 import PasswordHasher
            from argon2.exceptions import VerifyMismatchError, InvalidHash
            ph = PasswordHasher()
            ph.verify(self.api_key_hash, raw_key)
            return True
        except (VerifyMismatchError, InvalidHash, Exception):
            return False

    def reveal(self) -> Optional[str]:
        if not self.api_key_encrypted or not self.is_active:
            return None
        from app.utils.sso_crypto import decrypt_api_key
        return decrypt_api_key(self.api_key_encrypted)

    def rotate(self) -> str:
        raw = self.generate_raw()
        self.set_secret(raw)
        return raw

    def revoke(self) -> None:
        self.is_active = False

    # ── tracking ────────────────────────────────────────────────────────

    def touch_usage(self, ip: Optional[str] = None) -> None:
        self.last_used_at = datetime.utcnow()
        if ip:
            self.last_used_ip = ip[:45]
        self.usage_count = (self.usage_count or 0) + 1

    # ── serialización ──────────────────────────────────────────────────

    def to_dict(self, include_assignments: bool = False, include_creator: bool = False) -> dict:
        data = {
            'id': self.id,
            'campus_id': self.campus_id,
            'description': self.description,
            'name': self.name,
            'api_key_prefix': self.api_key_prefix if self.is_active else None,
            'is_active': self.is_active,
            'is_legacy': self.is_legacy,
            'assignment_mode': (self.assignment_mode or 'platform'),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by_id': self.created_by_id,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'last_used_ip': self.last_used_ip,
            'usage_count': self.usage_count or 0,
            'assignment_count': self.assignments.count() if self.assignments else 0,
        }
        if include_creator and self.created_by:
            data['created_by'] = {
                'id': self.created_by.id,
                'username': self.created_by.username,
                'full_name': self.created_by.full_name,
            }
        if include_assignments:
            data['assignments'] = [
                a.to_dict(include_exam=True) for a in self.assignments.order_by(CampusApiKeyAssignment.id.asc())
            ]
        return data


class CampusApiKeyAssignment(db.Model):
    """Plantilla de asignación adjunta a un CampusApiKey.

    Cada fila representa "este examen, con esta config, se asignará al
    candidato que entre por la api key". Al consumir la api en
    /generar_token, por cada plantilla se hace find_or_create de un
    GroupExam para el grupo resuelto del candidato, clonando la config.
    """

    __tablename__ = 'campus_api_key_assignments'

    id = db.Column(db.Integer, primary_key=True)
    api_key_id = db.Column(
        db.Integer,
        db.ForeignKey('campus_api_keys.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    exam_id = db.Column(
        db.Integer,
        db.ForeignKey('exams.id', ondelete='NO ACTION'),
        nullable=False,
        index=True,
    )

    # ── Snapshot de configuración (mismos campos que GroupExam) ────────
    assignment_type = db.Column(db.String(20), default='all', nullable=False)  # 'all'|'selected'
    available_from = db.Column(db.DateTime, nullable=True)
    available_until = db.Column(db.DateTime, nullable=True)
    time_limit_minutes = db.Column(db.Integer, nullable=True)
    passing_score = db.Column(db.Integer, nullable=True)
    max_attempts = db.Column(db.Integer, default=1, nullable=False)
    max_disconnections = db.Column(db.Integer, default=3, nullable=False)
    exam_content_type = db.Column(db.String(30), default='questions_only', nullable=False)
    exam_questions_count = db.Column(db.Integer, nullable=True)
    exam_exercises_count = db.Column(db.Integer, nullable=True)
    simulator_questions_count = db.Column(db.Integer, nullable=True)
    simulator_exercises_count = db.Column(db.Integer, nullable=True)
    security_pin = db.Column(db.String(10), nullable=True)
    require_security_pin = db.Column(db.Boolean, default=False, nullable=False)
    validity_months = db.Column(db.Integer, nullable=True)

    # Tipo de certificado a emitir cuando el candidato apruebe este examen.
    # Decide si el sistema debe forzar la validación de CURP del candidato:
    #   - 'conocer' → obligatorio validar CURP (cert. oficial CONOCER).
    #   - 'eduit'   → certificado EDUIT (no requiere CURP).
    #   - 'badge'   → solo insignia digital (no requiere CURP).
    #   - 'none'    → sin certificado (no requiere CURP).
    # Default 'eduit' para que las plantillas existentes no fuercen CURP.
    certificate_type = db.Column(
        db.String(20), default='eduit', nullable=False, server_default='eduit'
    )

    # Listas JSON. Sin FK porque son snapshots: si el material/usuario se
    # borra, simplemente se ignora al materializar.
    # - members_snapshot: lista fija de user_ids que SIEMPRE se agregan al
    #   GroupExam (solo aplica si assignment_type='selected'). Los
    #   candidatos que entren por SSO se agregan ADEMÁS de esta lista.
    # - materials_snapshot: lista de study_material_id (override de materiales)
    members_snapshot = db.Column(db.Text, nullable=True)
    materials_snapshot = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('api_key_id', 'exam_id', name='uq_api_key_exam'),
    )

    exam = db.relationship('Exam', foreign_keys=[exam_id])

    # ── snapshot json helpers ──────────────────────────────────────────

    @property
    def members(self) -> list:
        if not self.members_snapshot:
            return []
        try:
            return json.loads(self.members_snapshot) or []
        except Exception:
            return []

    @members.setter
    def members(self, value):
        self.members_snapshot = json.dumps(list(value or []))

    @property
    def materials(self) -> list:
        if not self.materials_snapshot:
            return []
        try:
            return json.loads(self.materials_snapshot) or []
        except Exception:
            return []

    @materials.setter
    def materials(self, value):
        self.materials_snapshot = json.dumps(list(value or []))

    def to_dict(self, include_exam: bool = False) -> dict:
        data = {
            'id': self.id,
            'api_key_id': self.api_key_id,
            'exam_id': self.exam_id,
            'assignment_type': self.assignment_type,
            'available_from': self.available_from.isoformat() if self.available_from else None,
            'available_until': self.available_until.isoformat() if self.available_until else None,
            'time_limit_minutes': self.time_limit_minutes,
            'passing_score': self.passing_score,
            'max_attempts': self.max_attempts,
            'max_disconnections': self.max_disconnections,
            'exam_content_type': self.exam_content_type,
            'exam_questions_count': self.exam_questions_count,
            'exam_exercises_count': self.exam_exercises_count,
            'simulator_questions_count': self.simulator_questions_count,
            'simulator_exercises_count': self.simulator_exercises_count,
            'security_pin': self.security_pin,
            'require_security_pin': self.require_security_pin,
            'validity_months': self.validity_months,
            'certificate_type': (self.certificate_type or 'eduit'),
            'members': self.members,
            'materials': self.materials,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_exam and self.exam:
            data['exam'] = {
                'id': self.exam.id,
                'name': self.exam.name,
                'version': self.exam.version,
                'standard': self.exam.standard,
                'competency_standard_id': self.exam.competency_standard_id,
            }
        return data
