"""
Servicio para SSO Tokenización API a nivel PLANTEL (Campus).

Flujo (mayo 2026):
  1. La institución llama POST /api/sso/generar_token con:
        - apikey:   API key del PLANTEL (no del partner)
        - matricula, nombre, apellido, email, curp, ...
        - grupo (opcional): código/nombre del CandidateGroup dentro del
          plantel. Si viene y existe → liga al alumno; si no existe → se
          crea ese grupo automáticamente y se liga. Si NO viene → se liga
          al grupo más recientemente creado del plantel; si no hay ninguno,
          se crea uno por defecto `"Grupo <nombre_plantel>"` y se liga.
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
import re
import secrets
import unicodedata
import uuid
from datetime import datetime, timedelta
from typing import Optional

from app import db
from app.models.user import User
from app.models.partner import Partner, Campus, CandidateGroup, GroupMember, user_partners
from app.models.sso_token import SsoToken
from app.models.activity_log import log_activity


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


def _slugify_group_code(text: str, max_len: int = 50) -> str:
    """Genera un código compatible con la columna `code` (≤50, sin acentos).

    Reglas: NFKD para quitar diacríticos, lowercase, espacios y caracteres no
    alfanuméricos → guion bajo, truncado a `max_len`. Si queda vacío devuelve
    `'grupo'`.
    """
    cleaned = unicodedata.normalize('NFKD', text or '')
    cleaned = ''.join(c for c in cleaned if not unicodedata.combining(c))
    cleaned = cleaned.lower().strip()
    cleaned = re.sub(r'[^a-z0-9]+', '_', cleaned).strip('_')
    cleaned = cleaned[:max_len].rstrip('_')
    return cleaned or 'grupo'


def _create_group_for_campus(
    campus: Campus,
    name: str,
    code: str,
    source: str,
) -> CandidateGroup:
    """Crea un CandidateGroup dentro del plantel con coordinator_id heredado
    del campus (visible para el coordinador y para responsables del plantel
    con permiso `can_manage_groups`). Registra activity_log para auditoría.
    """
    group = CandidateGroup(
        campus_id=campus.id,
        coordinator_id=campus.coordinator_id,
        name=name[:100],
        code=code[:50],
        is_active=True,
    )
    db.session.add(group)
    db.session.flush()
    log_activity(
        user=None,
        action_type='sso_auto_create_group',
        entity_type='candidate_group',
        entity_id=group.id,
        entity_name=group.name,
        details={
            'campus_id': campus.id,
            'campus_name': campus.name,
            'code': group.code,
            'source': source,  # 'requested' | 'default'
        },
        success=True,
    )
    return group


def _resolve_and_attach_group(
    user: User, campus: Campus, grupo: Optional[str]
) -> Optional[CandidateGroup]:
    """Resuelve el CandidateGroup donde se debe colocar al alumno SSO.

    Reglas:
      - Si `grupo` viene → busca por (campus_id, code=grupo). Si existe, liga.
        Si no existe, crea el grupo en el plantel y liga.
      - Si `grupo` NO viene → liga al grupo más reciente del plantel
        (ORDER BY created_at DESC). Si el plantel no tiene grupos, crea uno
        por defecto `"Grupo <nombre_plantel>"` y liga.

    Devuelve el grupo final (nunca None bajo flujo normal).
    """
    code = (grupo or '').strip()
    group: Optional[CandidateGroup] = None

    if code:
        group = (
            CandidateGroup.query
            .filter_by(campus_id=campus.id, code=code)
            .first()
        )
        if group is None:
            group = _create_group_for_campus(
                campus,
                name=code,
                code=code,
                source='requested',
            )
    else:
        group = (
            CandidateGroup.query
            .filter_by(campus_id=campus.id)
            .order_by(CandidateGroup.created_at.desc())
            .first()
        )
        if group is None:
            default_name = f"Grupo {campus.name}"
            default_code = _slugify_group_code(default_name)
            group = _create_group_for_campus(
                campus,
                name=default_name,
                code=default_code,
                source='default',
            )

    existing = (
        GroupMember.query
        .filter_by(group_id=group.id, user_id=user.id)
        .first()
    )
    if existing is None:
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
    email: Optional[str] = None,
    grupo: Optional[str] = None,
    curp: Optional[str] = None,
) -> User:
    """Crea o actualiza un candidato por (external_campus_id, external_id).

    El campo `apellido` es una cadena única: se separa internamente en
    `first_surname` (apellido paterno) y `second_surname` (apellido materno).

    Si se envía `curp` (opcional), se guarda en el usuario en mayúsculas. La
    validación contra RENAPO la realiza el flujo asincrónico habitual; aquí
    solo se persiste el valor provisto.

    El parámetro `grupo` es el código/nombre del CandidateGroup destino — ver
    `_resolve_and_attach_group` para la lógica completa (find-or-create +
    fallback al grupo más reciente del plantel o creación de uno por defecto).
    """
    matricula = (matricula or '').strip()
    nombre = (nombre or '').strip()
    primer_apellido, segundo_apellido = _split_apellido(apellido)
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
        _resolve_and_attach_group(user, campus, grupo)
    else:
        if nombre and nombre != user.name:
            user.name = nombre
        if primer_apellido and primer_apellido != user.first_surname:
            user.first_surname = primer_apellido
        if segundo_apellido is not None and segundo_apellido != user.second_surname:
            user.second_surname = segundo_apellido
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
        _resolve_and_attach_group(user, campus, grupo)

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
