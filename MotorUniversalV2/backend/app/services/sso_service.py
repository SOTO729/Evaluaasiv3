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
from app.models.partner import GroupExam, GroupExamMaterial, GroupExamMember
from app.models.campus_api_key import CampusApiKey, CampusApiKeyAssignment
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
) -> tuple[User, Optional[CandidateGroup]]:
    """Crea o actualiza un candidato por (external_campus_id, external_id).

    Devuelve `(user, resolved_group)`: el grupo es el `CandidateGroup` al que
    se ligó al alumno (find-or-create) y se usa para materializar las
    plantillas de asignación de la api key.

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
        resolved_group = _resolve_and_attach_group(user, campus, grupo)
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
        resolved_group = _resolve_and_attach_group(user, campus, grupo)

    db.session.commit()
    return user, resolved_group


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
    """Resuelve el plantel cuya api key matchea el raw secreto.

    Busca primero en la tabla nueva `campus_api_keys` (multi-key). Si no
    encuentra, hace fallback al esquema legacy 1:1 en `campuses` para
    seguir aceptando llaves que aún no se han migrado vía auto-migrate.
    """
    campus, _ = find_campus_and_api_key(raw_key)
    return campus


def find_campus_and_api_key(raw_key: str) -> tuple[Optional[Campus], Optional[CampusApiKey]]:
    """Igual que find_campus_by_api_key, pero devuelve también la fila
    `CampusApiKey` (o None si vino de la columna legacy del plantel).
    """
    if not raw_key or not raw_key.startswith('evk_') or len(raw_key) < 16:
        return None, None
    prefix = raw_key[:12]

    # 1) Nueva tabla multi-key
    api_candidates = (
        CampusApiKey.query
        .filter_by(api_key_prefix=prefix, is_active=True)
        .all()
    )
    for ak in api_candidates:
        try:
            if ak.verify(raw_key):
                campus = Campus.query.get(ak.campus_id)
                if campus is not None:
                    return campus, ak
        except Exception:
            continue

    # 2) Fallback legacy: columnas api_key_* en campuses
    legacy_candidates = (
        Campus.query
        .filter_by(api_key_prefix=prefix, api_key_active=True)
        .all()
    )
    for campus in legacy_candidates:
        try:
            if campus.verify_api_key(raw_key):
                return campus, None
        except Exception:
            continue

    return None, None


def _mark_pending_billing(
    api_key: CampusApiKey,
    user: User,
    group: CandidateGroup,
    group_exam: GroupExam,
    group_exam_member: 'GroupExamMember',
) -> bool:
    """Marca una asignación SSO como pendiente de cobro (cobro diferido).

    No debita saldo: solo evalúa las reglas y, si aplicarían, deja la fila
    `GroupExamMember.pending_billing=True`. El cobro real se ejecuta en
    `consume_pending_billing_for_exam()` cuando el candidato aplica un
    examen real (mode='exam'). Simulador y materiales NO cobran.

    Reglas:
      - Para exámenes con ECM solo se marca si el candidato NO tiene ya un
        EcmCandidateAssignment para ese ECM.
      - Si aplica ECM y no estaba asignado, se crea el EcmCandidateAssignment
        en este mismo momento (registro histórico, regla anti-duplicado).
      - unit_cost > 0 (group_override → campus.certification_cost). Si es 0
        no se marca (no se cobrará nada).
      - Coordinador resoluble (campus → partner). Si no, no se marca.

    Devuelve True si se marcó (cobro pendiente), False si quedó libre.
    """
    from flask import current_app
    from app.models import Campus, Partner
    from app.models.exam import Exam
    from app.models.partner import EcmCandidateAssignment

    try:
        campus = group.campus or Campus.query.get(group.campus_id)
        if not campus:
            return False

        coordinator_id = getattr(campus, 'coordinator_id', None)
        if not coordinator_id and getattr(campus, 'partner_id', None):
            partner = Partner.query.get(campus.partner_id)
            if partner:
                coordinator_id = getattr(partner, 'coordinator_id', None)
        if not coordinator_id:
            current_app.logger.warning(
                f"[SSO BILLING] No se pudo resolver coordinador para "
                f"campus={campus.id} (api_key={api_key.id}). No se marca."
            )
            return False

        unit_cost = 0.0
        try:
            if (
                getattr(group, 'use_custom_config', False)
                and getattr(group, 'certification_cost_override', None) is not None
            ):
                unit_cost = float(group.certification_cost_override)
            elif getattr(campus, 'certification_cost', None) is not None:
                unit_cost = float(campus.certification_cost or 0)
        except Exception:
            unit_cost = 0.0
        if unit_cost <= 0:
            return False

        exam = Exam.query.get(group_exam.exam_id)
        exam_name = exam.name if exam else f'exam_{group_exam.exam_id}'
        ecm_id = getattr(exam, 'competency_standard_id', None) if exam else None
        if ecm_id:
            existing_ecm = EcmCandidateAssignment.query.filter_by(
                user_id=user.id,
                competency_standard_id=ecm_id,
            ).first()
            if existing_ecm:
                return False  # ya tenía ECM, no se cobrará

            # Crear histórico ECM ahora para que próximas entradas SSO
            # no vuelvan a marcar el mismo estándar.
            try:
                validity_months = (
                    group_exam.validity_months
                    if getattr(group_exam, 'validity_months', None)
                    else 12
                )
                expires_at = group_exam.expires_at if getattr(group_exam, 'expires_at', None) else None
                db.session.add(EcmCandidateAssignment(
                    assignment_number=EcmCandidateAssignment.generate_assignment_number(),
                    user_id=user.id,
                    competency_standard_id=ecm_id,
                    exam_id=group_exam.exam_id,
                    campus_id=campus.id,
                    group_id=group.id,
                    group_name=group.name,
                    group_exam_id=group_exam.id,
                    assigned_by_id=api_key.created_by_id,
                    assignment_source='sso_apikey',
                    validity_months=validity_months,
                    expires_at=expires_at,
                ))
            except Exception as e:
                current_app.logger.error(
                    f"[SSO BILLING] Error creando EcmCandidateAssignment: {e}"
                )

        # Marcar pendiente de cobro (cobro real al aplicar el examen)
        group_exam_member.pending_billing = True

        log_activity(
            user=None,
            action_type='sso_apikey_pending_billing',
            entity_type='group_exam',
            entity_id=group_exam.id,
            entity_name=f"Marca pendiente SSO {exam_name}",
            details={
                'api_key_id': api_key.id,
                'campus_id': campus.id,
                'coordinator_id': coordinator_id,
                'user_id': user.id,
                'external_id': user.external_id,
                'exam_id': group_exam.exam_id,
                'unit_cost': unit_cost,
                'ecm_id': ecm_id,
            },
            success=True,
        )
        return True

    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"[SSO BILLING] Fallo inesperado al marcar: {e}")
        return False


def consume_pending_billing_for_exam(user_id: str, group_exam_id: int) -> bool:
    """Ejecuta el cobro diferido cuando el candidato aplica un examen real.

    Idempotente: si el `GroupExamMember(user_id, group_exam_id)` no existe
    o no tiene `pending_billing=True`, no hace nada. Si sí lo tiene, debita
    al saldo del coordinador (permite negativo, notifica por email al cruzar
    a negativo) y desmarca el flag.

    Diseñado para invocarse desde `save_exam_result` cuando `mode='exam'`.
    Nunca debe interrumpir el flujo de guardado: capturar excepciones en el
    sitio que lo invoca.

    Devuelve True si se cobró efectivamente, False si no había nada que
    cobrar o si falló.
    """
    from flask import current_app
    from app.models import Campus, Partner
    from app.models.exam import Exam
    from app.models.partner import GroupExamMember, GroupExam, CandidateGroup
    from app.models.balance import (
        CoordinatorBalance,
        create_balance_transaction,
    )

    try:
        gem = GroupExamMember.query.filter_by(
            group_exam_id=group_exam_id, user_id=user_id
        ).first()
        if not gem or not getattr(gem, 'pending_billing', False):
            return False

        group_exam = GroupExam.query.get(group_exam_id)
        if not group_exam:
            return False
        group = CandidateGroup.query.get(group_exam.group_id)
        if not group:
            return False
        campus = group.campus or Campus.query.get(group.campus_id)
        if not campus:
            return False

        coordinator_id = getattr(campus, 'coordinator_id', None)
        if not coordinator_id and getattr(campus, 'partner_id', None):
            partner = Partner.query.get(campus.partner_id)
            if partner:
                coordinator_id = getattr(partner, 'coordinator_id', None)
        if not coordinator_id:
            current_app.logger.warning(
                f"[SSO BILLING] consume: sin coordinador para campus={campus.id}"
            )
            return False

        unit_cost = 0.0
        try:
            if (
                getattr(group, 'use_custom_config', False)
                and getattr(group, 'certification_cost_override', None) is not None
            ):
                unit_cost = float(group.certification_cost_override)
            elif getattr(campus, 'certification_cost', None) is not None:
                unit_cost = float(campus.certification_cost or 0)
        except Exception:
            unit_cost = 0.0
        if unit_cost <= 0:
            # Nada que cobrar; desmarcar para no reintentar.
            gem.pending_billing = False
            db.session.commit()
            return False

        exam = Exam.query.get(group_exam.exam_id)
        exam_name = exam.name if exam else f'exam_{group_exam.exam_id}'

        balance = CoordinatorBalance.query.filter_by(
            coordinator_id=coordinator_id,
            campus_id=campus.id,
        ).first()
        balance_before = float(balance.current_balance) if balance and balance.current_balance is not None else 0.0

        notes = (
            f'SSO (cobro al aplicar): "{exam_name}" - candidato {user_id} '
            f'(grupo "{group.name}") - 1 x ${unit_cost:,.2f}'
        )
        try:
            create_balance_transaction(
                coordinator_id=coordinator_id,
                campus_id=campus.id,
                transaction_type='debit',
                concept='asignacion_certificacion',
                amount=unit_cost,
                group_id=group.id,
                reference_type='group_exam',
                reference_id=group_exam.id,
                notes=notes,
                created_by_id=coordinator_id,
            )
        except Exception as e:
            current_app.logger.error(
                f"[SSO BILLING] consume: error creando transacción: {e}"
            )
            return False

        gem.pending_billing = False
        db.session.commit()

        balance_after = balance_before - unit_cost
        if balance_before >= 0 and balance_after < 0:
            try:
                _notify_negative_balance(coordinator_id, campus, balance_after)
            except Exception as e:
                current_app.logger.warning(
                    f"[SSO BILLING] consume: no se pudo notificar negativo: {e}"
                )

        log_activity(
            user=None,
            action_type='sso_apikey_charge_consumed',
            entity_type='group_exam',
            entity_id=group_exam.id,
            entity_name=f"Cobro SSO consumido {exam_name}",
            details={
                'campus_id': campus.id,
                'coordinator_id': coordinator_id,
                'user_id': user_id,
                'exam_id': group_exam.exam_id,
                'unit_cost': unit_cost,
                'balance_before': balance_before,
                'balance_after': balance_after,
            },
            success=True,
        )
        return True

    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"[SSO BILLING] consume: fallo inesperado: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
        return False


def _notify_negative_balance(coordinator_id: str, campus: 'Campus', new_balance: float) -> None:
    """Envía email al coordinador avisando que su saldo cruzó a negativo
    por uso del SSO API. No interrumpe el flujo si falla."""
    from app.services.email_service import send_email

    coordinator = User.query.get(coordinator_id)
    if not coordinator or not coordinator.email:
        return

    subject = f'⚠️ Saldo negativo en plantel "{campus.name}"'
    full_name = getattr(coordinator, 'full_name', None) or coordinator.email
    html = f"""
    <p style="margin:0 0 16px;color:#1e293b;font-size:15px;">Hola <strong>{full_name}</strong>,</p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
      Te informamos que el saldo del plantel <strong>{campus.name}</strong> ha cruzado
      a <strong style="color:#dc2626;">${new_balance:,.2f}</strong> debido a asignaciones
      automáticas generadas por una API key SSO.
    </p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
      Por favor, solicita un abono de saldo desde tu portal de coordinador para
      saldar el saldo negativo y mantener disponibilidad continua del servicio.
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">— Sistema Evaluaasi</p>
    """
    try:
        send_email(
            to=coordinator.email,
            subject=subject,
            html=html,
        )
    except Exception:
        pass


def apply_api_key_assignments(
    api_key: CampusApiKey,
    user: User,
    group: CandidateGroup,
) -> list[GroupExam]:
    """Materializa las plantillas de la api key en GroupExams para el grupo
    resuelto del candidato.

    Para cada `CampusApiKeyAssignment`:
      1. Busca un GroupExam(group_id=group.id, exam_id=plantilla.exam_id).
         - Si no existe → lo crea clonando la config del snapshot.
         - Si existe → respeta la asignación existente (no la sobreescribe).
      2. Si `assignment_type='selected'`:
         - Agrega como GroupExamMember al `user` actual.
         - Y a cada user_id en `members_snapshot` (one-shot, solo al crearse).
      3. Si `materials_snapshot` tiene materiales y el GroupExam acaba de
         crearse, los registra como `GroupExamMaterial`.

    Devuelve la lista de GroupExam materializados (creados o ya existentes).
    Comitea cambios solo al final.
    """
    if api_key is None or not api_key.is_active:
        return []
    if api_key.is_legacy:
        # Legacy = sin asignaciones, comportamiento clásico
        return []

    from dateutil.relativedelta import relativedelta

    materialized: list[GroupExam] = []
    assignments = api_key.assignments.all()
    if not assignments:
        return []

    for plantilla in assignments:
        ge: Optional[GroupExam] = (
            GroupExam.query
            .filter_by(group_id=group.id, exam_id=plantilla.exam_id)
            .first()
        )
        just_created = False

        if ge is None:
            # ── Crear GroupExam con la config del snapshot ─────────────
            validity_months = plantilla.validity_months
            if validity_months is None:
                campus = group.campus if group.campus else Campus.query.get(group.campus_id)
                validity_months = (campus.assignment_validity_months if campus else None) or 12
            now = datetime.utcnow()
            ge = GroupExam(
                group_id=group.id,
                exam_id=plantilla.exam_id,
                assigned_at=now,
                assigned_by_id=api_key.created_by_id,
                available_from=plantilla.available_from,
                available_until=plantilla.available_until,
                assignment_type=plantilla.assignment_type or 'all',
                time_limit_minutes=plantilla.time_limit_minutes,
                passing_score=plantilla.passing_score,
                max_attempts=plantilla.max_attempts or 1,
                max_disconnections=plantilla.max_disconnections or 3,
                exam_content_type=plantilla.exam_content_type or 'questions_only',
                exam_questions_count=plantilla.exam_questions_count,
                exam_exercises_count=plantilla.exam_exercises_count,
                simulator_questions_count=plantilla.simulator_questions_count,
                simulator_exercises_count=plantilla.simulator_exercises_count,
                security_pin=plantilla.security_pin,
                require_security_pin=bool(plantilla.require_security_pin),
                is_active=True,
                validity_months=validity_months,
                expires_at=now + relativedelta(months=validity_months),
                extended_months=0,
            )
            db.session.add(ge)
            db.session.flush()
            just_created = True

            # Materiales personalizados snapshot (solo al crear)
            materials = plantilla.materials or []
            for mid in materials:
                try:
                    db.session.add(GroupExamMaterial(
                        group_exam_id=ge.id,
                        study_material_id=int(mid),
                        is_included=True,
                    ))
                except Exception:
                    continue

            # Miembros fijos del snapshot (solo al crear)
            if (plantilla.assignment_type or 'all') == 'selected':
                for uid in (plantilla.members or []):
                    if not uid:
                        continue
                    if GroupExamMember.query.filter_by(
                        group_exam_id=ge.id, user_id=uid
                    ).first():
                        continue
                    try:
                        db.session.add(GroupExamMember(
                            group_exam_id=ge.id, user_id=uid
                        ))
                    except Exception:
                        continue

            log_activity(
                user=None,
                action_type='sso_apikey_assignment_materialized',
                entity_type='group_exam',
                entity_id=ge.id,
                entity_name=f"GroupExam exam={plantilla.exam_id} group={group.id}",
                details={
                    'api_key_id': api_key.id,
                    'campus_id': api_key.campus_id,
                    'plantilla_id': plantilla.id,
                },
                success=True,
            )

        # ── Ledger por candidato + marca de cobro diferido ─────────────
        # Aseguramos GroupExamMember para el `user` actual (sin importar
        # assignment_type). Sirve como ledger anti-duplicado. Si ya existe
        # no marcamos pendiente (asumimos que ya pasó por este flujo).
        # Si no existe → 1) creamos el GEM, 2) lo marcamos como
        # pending_billing si corresponde (cobro al aplicar el examen real).
        existing_gem = GroupExamMember.query.filter_by(
            group_exam_id=ge.id, user_id=user.id
        ).first()
        if existing_gem is None:
            try:
                new_gem = GroupExamMember(
                    group_exam_id=ge.id, user_id=user.id
                )
                db.session.add(new_gem)
                db.session.flush()
                # Marca de cobro diferido (no debita ahora; al aplicar examen)
                try:
                    _mark_pending_billing(api_key, user, group, ge, new_gem)
                except Exception as e:
                    from flask import current_app
                    current_app.logger.error(
                        f"[SSO BILLING] error marcando pending: {e}"
                    )
            except Exception:
                pass

        materialized.append(ge)

    # ── Decisión CURP según tipo de certificado de las plantillas ──────
    # Si NINGUNA plantilla emite certificado CONOCER, el candidato creado
    # por SSO no se ve obligado a validar su CURP en sitio. Si al menos
    # una es CONOCER, se restablece el flujo normal de CURP.
    try:
        has_conocer = any(
            (getattr(p, 'certificate_type', 'eduit') or 'eduit').lower() == 'conocer'
            for p in assignments
        )
        if has_conocer:
            if getattr(user, 'skip_curp_validation', False):
                user.skip_curp_validation = False
        else:
            # Solo aplicamos el skip a candidatos llegados vía SSO (external_id
            # presente). No tocamos candidatos creados manualmente.
            if user.external_id and not getattr(user, 'skip_curp_validation', False):
                user.skip_curp_validation = True
    except Exception as e:
        from flask import current_app
        current_app.logger.warning(f'[SSO] error setting skip_curp_validation: {e}')

    db.session.commit()
    return materialized


def resolve_standards(codes: list[str]) -> tuple[list, list[str]]:
    """Dada una lista de códigos de estándar (ej. ['EC0217','EC0301']), resuelve
    cada uno a (CompetencyStandard, Exam más reciente activo+publicado).

    Devuelve (resueltos, errores):
      - resueltos: lista de tuplas (standard, exam) en el orden de entrada,
        sin duplicados por exam_id.
      - errores: lista de mensajes legibles por cada código que no se pudo
        resolver (no existe, inactivo o sin examen publicado).
    """
    from app.models.competency_standard import CompetencyStandard

    resolved: list = []
    errors: list[str] = []
    seen_exam_ids: set[int] = set()
    for raw_code in codes:
        code = (raw_code or '').strip().upper()
        if not code:
            continue
        std = (
            CompetencyStandard.query
            .filter(db.func.upper(CompetencyStandard.code) == code, CompetencyStandard.is_active == True)  # noqa: E712
            .first()
        )
        if std is None:
            errors.append(f"Estándar '{code}' no existe o está inactivo")
            continue
        exam = std.get_active_exam()
        if exam is None:
            errors.append(f"El estándar '{code}' no tiene examen publicado activo")
            continue
        if exam.id in seen_exam_ids:
            continue
        seen_exam_ids.add(exam.id)
        resolved.append((std, exam))
    return resolved, errors


def apply_standard_assignments(
    api_key: Optional[CampusApiKey],
    user: User,
    group: CandidateGroup,
    resolved_standards: list,
) -> list[GroupExam]:
    """Asigna directamente, vía API, los exámenes de los estándares resueltos
    (modo `assignment_mode='api'`). Excluyente con las plantillas.

    Por cada (standard, exam):
      1. find_or_create GroupExam(group_id, exam_id) usando la configuración
         por defecto del editor (campos `default_*` del examen).
      2. Garantiza GroupExamMember(user) como ledger y, si es nuevo, lo marca
         `pending_billing` (cobro diferido idéntico a las plantillas).

    El candidato NUNCA se ve obligado a validar CURP por esta vía: se fija
    `skip_curp_validation=True` (la CURP sigue siendo opcional).
    """
    from dateutil.relativedelta import relativedelta

    materialized: list[GroupExam] = []
    if not resolved_standards:
        return materialized

    campus = group.campus if group.campus else Campus.query.get(group.campus_id)
    default_validity = (campus.assignment_validity_months if campus else None) or 12
    created_by_id = api_key.created_by_id if api_key is not None else None

    for std, exam in resolved_standards:
        ge: Optional[GroupExam] = (
            GroupExam.query
            .filter_by(group_id=group.id, exam_id=exam.id)
            .first()
        )

        if ge is None:
            now = datetime.utcnow()
            validity_months = default_validity
            ge = GroupExam(
                group_id=group.id,
                exam_id=exam.id,
                assigned_at=now,
                assigned_by_id=created_by_id,
                assignment_type='selected',
                time_limit_minutes=(
                    exam.default_duration_minutes
                    if exam.default_duration_minutes is not None
                    else exam.duration_minutes
                ),
                passing_score=(
                    exam.default_passing_score
                    if exam.default_passing_score is not None
                    else exam.passing_score
                ),
                max_attempts=(exam.default_max_attempts or 2),
                max_disconnections=(exam.default_max_disconnections or 3),
                exam_content_type=(exam.default_exam_content_type or 'mixed'),
                exam_questions_count=exam.default_exam_questions_count,
                exam_exercises_count=exam.default_exam_exercises_count,
                simulator_questions_count=exam.default_simulator_questions_count,
                simulator_exercises_count=exam.default_simulator_exercises_count,
                require_security_pin=False,
                is_active=True,
                validity_months=validity_months,
                expires_at=now + relativedelta(months=validity_months),
                extended_months=0,
            )
            db.session.add(ge)
            db.session.flush()
            log_activity(
                user=None,
                action_type='sso_apikey_standard_materialized',
                entity_type='group_exam',
                entity_id=ge.id,
                entity_name=f"GroupExam estándar={std.code} exam={exam.id} group={group.id}",
                details={
                    'api_key_id': api_key.id if api_key else None,
                    'campus_id': campus.id if campus else None,
                    'standard_code': std.code,
                    'exam_id': exam.id,
                },
                success=True,
            )

        # Ledger por candidato + cobro diferido
        existing_gem = GroupExamMember.query.filter_by(
            group_exam_id=ge.id, user_id=user.id
        ).first()
        if existing_gem is None:
            try:
                new_gem = GroupExamMember(group_exam_id=ge.id, user_id=user.id)
                db.session.add(new_gem)
                db.session.flush()
                if api_key is not None:
                    try:
                        _mark_pending_billing(api_key, user, group, ge, new_gem)
                    except Exception as e:
                        from flask import current_app
                        current_app.logger.error(
                            f"[SSO BILLING] error marcando pending (estándar): {e}"
                        )
            except Exception:
                pass

        materialized.append(ge)

    # CURP opcional para candidatos asignados por estándar vía API.
    try:
        if user.external_id and not getattr(user, 'skip_curp_validation', False):
            user.skip_curp_validation = True
    except Exception as e:
        from flask import current_app
        current_app.logger.warning(f'[SSO] error setting skip_curp_validation (estándar): {e}')

    db.session.commit()
    return materialized