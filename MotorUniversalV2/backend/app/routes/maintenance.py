"""Rutas de mantenimiento — limpieza periódica.

Job 1: Marcar Vb6SessionToken expirados como is_active=False
Job 2: Marcar VmSession en estado 'in_progress' por más de N horas como 'abandoned'

Auth dual:
  - Header X-Cron-Token == env CRON_SECRET (para llamadas externas tipo Azure Logic Apps),
  - O JWT con rol admin/developer/gerente.

Es ADITIVO: no modifica nada del legacy ni borra registros, sólo cambia status/is_active.
"""

import os
from datetime import datetime, timedelta, date
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app import db
from app.models.user import User
from app.models.office_exam import Vb6SessionToken
from app.models.vm_session import VmSession

bp = Blueprint('maintenance', __name__, url_prefix='/api/maintenance')

ALLOWED_ROLES = {'admin', 'developer', 'gerente'}
VM_SESSION_TIMEOUT_HOURS = int(os.environ.get('VM_SESSION_TIMEOUT_HOURS', '4'))
SCHEDULED_OVERDUE_HOURS = int(os.environ.get('SCHEDULED_OVERDUE_HOURS', '12'))


def _authorize():
    """Devuelve (ok: bool, error_response_or_none)."""
    cron_token_header = request.headers.get('X-Cron-Token')
    cron_secret = os.environ.get('CRON_SECRET')
    if cron_token_header and cron_secret and cron_token_header == cron_secret:
        return True, None

    try:
        verify_jwt_in_request()
    except Exception:
        return False, (jsonify({'error': 'No autenticado'}), 401)

    user_id = get_jwt_identity()
    user = User.query.get(user_id) if user_id else None
    if not user or user.role not in ALLOWED_ROLES:
        return False, (jsonify({'error': 'Permiso denegado'}), 403)
    return True, None


def _cleanup_tokens(now):
    """Marca tokens vencidos como inactivos. Retorna (afectados, total_activos_antes)."""
    expired = Vb6SessionToken.query.filter(
        Vb6SessionToken.is_active == True,  # noqa: E712
        Vb6SessionToken.expires_at < now,
    ).all()
    for t in expired:
        t.is_active = False
    return len(expired)


def _timeout_vm_sessions(now):
    """Cierra sesiones in_progress que llevan demasiado tiempo abiertas
    y abandona sesiones scheduled cuya fecha+hora ya pasó hace mucho."""
    cutoff_in_progress = now - timedelta(hours=VM_SESSION_TIMEOUT_HOURS)
    in_progress_stale = VmSession.query.filter(
        VmSession.status == 'in_progress',
        VmSession.start_time < cutoff_in_progress,
    ).all() if hasattr(VmSession, 'start_time') else []

    timed_out = 0
    for s in in_progress_stale:
        s.status = 'abandoned'
        if hasattr(s, 'end_time') and not getattr(s, 'end_time', None):
            s.end_time = now
        timed_out += 1

    today = now.date()
    overdue_scheduled = VmSession.query.filter(
        VmSession.status == 'scheduled',
        VmSession.session_date < today,
    ).all()
    abandoned_scheduled = 0
    for s in overdue_scheduled:
        # Sólo abandonar si ya pasaron suficientes horas desde la fecha programada
        approx_dt = datetime.combine(s.session_date, datetime.min.time()).replace(
            hour=getattr(s, 'start_hour', 0) or 0,
        )
        if (now - approx_dt).total_seconds() >= SCHEDULED_OVERDUE_HOURS * 3600:
            s.status = 'abandoned'
            abandoned_scheduled += 1

    return timed_out, abandoned_scheduled


@bp.route('/cleanup', methods=['POST'])
def cleanup():
    ok, err = _authorize()
    if not ok:
        return err

    dry_run = request.args.get('dry_run', 'false').lower() == 'true'
    now = datetime.utcnow()

    try:
        tokens_count = _cleanup_tokens(now)
        timed_out, abandoned_scheduled = _timeout_vm_sessions(now)

        if dry_run:
            db.session.rollback()
        else:
            db.session.commit()

        return jsonify({
            'ok': True,
            'dry_run': dry_run,
            'now_utc': now.isoformat() + 'Z',
            'expired_tokens_deactivated': tokens_count,
            'in_progress_sessions_timed_out': timed_out,
            'overdue_scheduled_sessions_abandoned': abandoned_scheduled,
            'config': {
                'VM_SESSION_TIMEOUT_HOURS': VM_SESSION_TIMEOUT_HOURS,
                'SCHEDULED_OVERDUE_HOURS': SCHEDULED_OVERDUE_HOURS,
            },
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'error': str(e)}), 500


@bp.route('/cleanup/status', methods=['GET'])
def cleanup_status():
    """Lectura: cuántos registros estarían afectados sin modificar nada."""
    ok, err = _authorize()
    if not ok:
        return err

    now = datetime.utcnow()
    cutoff_in_progress = now - timedelta(hours=VM_SESSION_TIMEOUT_HOURS)

    expired_tokens = Vb6SessionToken.query.filter(
        Vb6SessionToken.is_active == True,  # noqa: E712
        Vb6SessionToken.expires_at < now,
    ).count()

    stale_in_progress = 0
    if hasattr(VmSession, 'start_time'):
        stale_in_progress = VmSession.query.filter(
            VmSession.status == 'in_progress',
            VmSession.start_time < cutoff_in_progress,
        ).count()

    today = now.date()
    overdue_scheduled = VmSession.query.filter(
        VmSession.status == 'scheduled',
        VmSession.session_date < today,
    ).count()

    return jsonify({
        'now_utc': now.isoformat() + 'Z',
        'expired_tokens_pending': expired_tokens,
        'stale_in_progress_sessions': stale_in_progress,
        'overdue_scheduled_sessions': overdue_scheduled,
        'config': {
            'VM_SESSION_TIMEOUT_HOURS': VM_SESSION_TIMEOUT_HOURS,
            'SCHEDULED_OVERDUE_HOURS': SCHEDULED_OVERDUE_HOURS,
        },
    }), 200


@bp.route('/blob-check', methods=['POST'])
def blob_check():
    """Sube un blob de prueba a Azure Storage para verificar conectividad
    desde el contenedor (útil para validar UpXML2016 → Azure Blob).
    """
    ok, err = _authorize()
    if not ok:
        return err

    try:
        from app.utils.azure_storage import azure_storage
        ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
        blob_name = f"office-xml/_diag/{ts}.txt"
        payload = f"diagnostic upload {ts}".encode('utf-8')
        url = azure_storage.upload_bytes(payload, blob_name, content_type='text/plain')
        return jsonify({
            'ok': bool(url),
            'blob_url': url,
            'container': azure_storage.container_name,
        }), 200 if url else 500
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500
