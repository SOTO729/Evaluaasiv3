"""
Servicio para SSO Tokenización API a nivel PLANTEL (Campus).

Flujo (mayo 2026):
  1. La institución llama POST /api/sso/generar_token con:
        - apikey:   API key del PLANTEL (no del partner)
        - matricula, nombre, primer_apellido, segundo_apellido, email, ...
        - grupo_codigo (opcional): si viene, se liga al CandidateGroup con ese
          código dentro del plantel.
  2. Si NO existe usuario con (external_campus_id, external_id) → se crea
     candidato con coordinator_id heredado del campus, campus_id, partner_id
     (vía m:m).
  3. Si EXISTE → solo se actualizan datos no destructivos.
  4. Se emite un SsoToken opaco single-use (TTL 5 min). Solo se persiste
     SHA-256 del token; la API key del plantel se cifra con Fernet para que un
     usuario autorizado pueda revelarla bajo demanda.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

from app import db
from app.models.user import User
from app.models.partner import Partner, Campus, CandidateGroup, GroupMember, user_partners
from app.models.sso_token import SsoToken


SSO_TOKEN_TTL_MINUTES = 5
SSO_TOKEN_BYTES = 48  # token_urlsafe(48) ≈ 64 chars URL-safe


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def _generate_unique_username(matricula: str, campus_id: int) -> str:
    base = f"sso_{campus_id}_{matricula}".lower()[:90]
    candidate = base
    suffix = 1
    while User.query.filter_by(username=candidate).first() is not None:
        suffix += 1
        candidate = f"{base}_{suffix}"[:100]
    return candidate


def _attach_to_group_if_any(user: User, campus: Campus, grupo_codigo: Optional[str]) -> Optional[CandidateGroup]:
    """Liga al usuario al CandidateGroup con el código indicado dentro del
    plantel. Devuelve el grupo si se pudo ligar, None si no.
    """
    if not grupo_codigo:
        return None
    code = (grupo_codigo or '').strip()
    if not code:
        return None
    group = (
        CandidateGroup.query
        .filter_by(campus_id=campus.id, code=code)
        .first()
    )
    if group is None:
        return None
    existing = (
        GroupMember.query
        .filter_by(group_id=group.id, user_id=user.id)
        .first()
    )
    if existing:
        return group
    member = GroupMember(group_id=group.id, user_id=user.id, status='active')
    db.session.add(member)
    return group


def _split_apellido(apellido: Optional[str]):
    """Convierte un apellido completo (cadena única) en (paterno, materno).

    Regla: la última palabra es el apellido materno; el resto (puede contener
    espacios) es el apellido paterno. Una sola palabra → todo a paterno y
    materno = None.
    """
    cleaned = ' '.join((apellido or '').split())
    if not cleaned:
        return '', None
    partes = cleaned.rsplit(' ', 1)
    if len(partes) == 2:
        return partes[0].strip(), (partes[1].strip() or None)
    return cleaned, None


def upsert_candidate_from_sso(
    campus: Campus,
    matricula: str,
    nombre: str,
    apellido: str,
    programa: Optional[str] = None,
    email: Optional[str] = None,
    grupo_codigo: Optional[str] = None,
    curp: Optional[str] = None,
) -> User:
    """Crea o actualiza un candidato por (external_campus_id, external_id).

    El campo `apellido` es una cadena única: se separa internamente en
    `first_surname` (apellido paterno) y `second_surname` (apellido materno).

    Si se envía `curp` (opcional), se guarda en el usuario en mayúsculas. La
    validación contra RENAPO la realiza el flujo asincrónico habitual; aquí
    solo se persiste el valor provisto.
    """
    matricula = (matricula or '').strip()
    nombre = (nombre or '').strip()
    primer_apellido, segundo_apellido = _split_apellido(apellido)
    programa = (programa or '').strip() or None
    email = (email or '').strip().lower() or None
    curp = (curp or '').strip().upper() or None

    user: Optional[User] = (
        User.query
        .filter_by(external_campus_id=campus.id, external_id=matricula)
        .first()
    )

    if user is None:
        user = User(
            id=str(uuid.uuid4()),
            username=_generate_unique_username(matricula, campus.id),
            email=email,
            name=nombre or 'SSO',
            first_surname=primer_apellido or 'SSO',
            second_surname=segundo_apellido,
            role='candidato',
            is_active=True,
            is_verified=True,
            external_id=matricula,
            external_campus_id=campus.id,
            external_partner_id=campus.partner_id,
            external_program=programa,
            campus_id=campus.id,
            coordinator_id=campus.coordinator_id,
            curp=curp,
        )
        user.set_password(secrets.token_urlsafe(32))
        db.session.add(user)
        db.session.flush()
        try:
            db.session.execute(
                user_partners.insert().values(user_id=user.id, partner_id=campus.partner_id)
            )
        except Exception:
            db.session.rollback()
            user = User.query.filter_by(
                external_campus_id=campus.id, external_id=matricula
            ).first()
            if user is None:
                raise
        _attach_to_group_if_any(user, campus, grupo_codigo)
    else:
        if nombre and nombre != user.name:
            user.name = nombre
        if primer_apellido and primer_apellido != user.first_surname:
            user.first_surname = primer_apellido
        if segundo_apellido is not None and segundo_apellido != user.second_surname:
            user.second_surname = segundo_apellido
        if programa is not None and programa != user.external_program:
            user.external_program = programa
        if email and email != (user.email or '').lower():
            other = User.query.filter(
                User.email == email, User.id != user.id
            ).first()
            if other is None:
                user.email = email
        if curp and curp != (user.curp or '').upper():
            # Solo sobreescribimos si aún no está verificado contra RENAPO,
            # para no pisar un CURP ya validado por un valor de tercero.
            if not bool(getattr(user, 'curp_verified', False)):
                user.curp = curp
        if user.campus_id != campus.id:
            user.campus_id = campus.id
        if campus.coordinator_id and user.coordinator_id != campus.coordinator_id:
            user.coordinator_id = campus.coordinator_id
        if user.external_partner_id != campus.partner_id:
            user.external_partner_id = campus.partner_id
        existing_link = db.session.execute(
            user_partners.select().where(
                (user_partners.c.user_id == user.id)
                & (user_partners.c.partner_id == campus.partner_id)
            )
        ).first()
        if existing_link is None:
            db.session.execute(
                user_partners.insert().values(user_id=user.id, partner_id=campus.partner_id)
            )
        _attach_to_group_if_any(user, campus, grupo_codigo)

    db.session.commit()
    return user


def issue_sso_token(user: User, campus: Campus, issuer_ip: Optional[str] = None) -> str:
    """Crea un SsoToken nuevo y devuelve el secreto en claro UNA sola vez."""
    raw = secrets.token_urlsafe(SSO_TOKEN_BYTES)
    token = SsoToken(
        token_hash=_hash_token(raw),
        user_id=user.id,
        partner_id=campus.partner_id,
        campus_id=campus.id,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(minutes=SSO_TOKEN_TTL_MINUTES),
        issuer_ip=issuer_ip[:45] if issuer_ip else None,
    )
    db.session.add(token)
    db.session.commit()
    return raw


def consume_sso_token(raw_token: str) -> Optional[User]:
    """Valida un SsoToken: si está vivo y no consumido, lo marca y retorna User."""
    if not raw_token or len(raw_token) < 20:
        return None
    h = _hash_token(raw_token)
    token: Optional[SsoToken] = SsoToken.query.filter_by(token_hash=h).first()
    if token is None or not token.is_valid():
        return None
    token.consumed_at = datetime.utcnow()
    db.session.commit()
    return token.user


def find_campus_by_api_key(raw_key: str) -> Optional[Campus]:
    """Busca el plantel cuya api_key_prefix matchea y verifica argon2 hash."""
    if not raw_key or not raw_key.startswith('evk_') or len(raw_key) < 16:
        return None
    prefix = raw_key[:12]
    candidates = (
        Campus.query
        .filter_by(api_key_prefix=prefix, api_key_active=True)
        .all()
    )
    for campus in candidates:
        try:
            if campus.verify_api_key(raw_key):
                return campus
        except Exception:
            continue
    return None
