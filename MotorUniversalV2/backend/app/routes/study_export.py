"""
Blueprint para solicitudes de exportación SCORM de materiales de estudio.

Reglas:
- Solicitan: editor, editor_invitado. Admin/developer pueden exportar
  directamente sin pasar por aprobación (creando una solicitud auto-aprobada).
- Aprueban / rechazan: admin, developer, gerente.
- Cada solicitud aprobada permite UNA descarga. Al descargar, status pasa a
  'consumed'. Para una nueva descarga del mismo material se requiere otra
  solicitud aprobada.
- Si ya existe una solicitud 'pending' o 'approved' (no consumida) para el
  mismo material+editor, no se permite crear otra.
"""
from datetime import datetime, timezone
from functools import wraps

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models.user import User
from app.models.study_content import StudyMaterial
from app.models.study_export import StudyExportRequest
from app.services.study_export_service import build_scorm_zip, suggested_filename


bp = Blueprint('study_export', __name__)

REQUESTER_ROLES = {'admin', 'developer', 'editor', 'editor_invitado'}
APPROVER_ROLES = {'admin', 'developer', 'gerente'}


def _current_user() -> User | None:
    uid = get_jwt_identity()
    return User.query.get(uid) if uid else None


def _requester_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method == 'OPTIONS':
            return fn(*args, **kwargs)
        u = _current_user()
        if not u or u.role not in REQUESTER_ROLES:
            return jsonify({'error': 'Permiso denegado'}), 403
        return fn(*args, **kwargs)
    return wrapper


def _approver_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method == 'OPTIONS':
            return fn(*args, **kwargs)
        u = _current_user()
        if not u or u.role not in APPROVER_ROLES:
            return jsonify({'error': 'Permiso denegado'}), 403
        return fn(*args, **kwargs)
    return wrapper


# ── Notificaciones ──────────────────────────────────────────────────────

def _notify_approvers_new_request(req: StudyExportRequest, material: StudyMaterial, requester: User):
    """Notifica por correo a todos los admin + gerente activos."""
    try:
        from app.services.email_service import send_email
    except Exception:
        return
    try:
        approvers = User.query.filter(
            User.role.in_(['admin', 'developer', 'gerente']),
            User.is_active.is_(True) if hasattr(User, 'is_active') else True,
        ).all()
    except Exception:
        approvers = User.query.filter(User.role.in_(['admin', 'developer', 'gerente'])).all()

    approver_emails = [u.email for u in approvers if u.email]
    if not approver_emails:
        return

    reason_html = f'<p><strong>Motivo:</strong><br>{(req.reason or "—")}</p>' if req.reason else ''
    requester_name = (
        getattr(requester, 'full_name', None) or requester.username
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#0f172a">Nueva solicitud de exportación SCORM</h2>
      <p>El editor <strong>{requester_name}</strong> ({requester.email or requester.username})
      solicita exportar el siguiente material de estudio a un paquete SCORM:</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0">
        <strong style="font-size:16px;color:#0c4a6e">{material.title}</strong>
        <div style="color:#475569;font-size:13px;margin-top:4px">ID: {material.id}</div>
      </div>
      {reason_html}
      <p>Ingresa al panel de auditoría para aprobar o rechazar la solicitud.</p>
      <p style="margin-top:24px;color:#94a3b8;font-size:12px">
        Cada autorización permite una sola descarga. Para descargar el mismo
        material nuevamente, el editor deberá solicitar otra autorización.
      </p>
    </div>
    """.strip()
    for email in approver_emails:
        try:
            send_email(
                to=email,
                subject=f"[Evaluaasi] Solicitud de exportación SCORM: {material.title}",
                html=html_body,
            )
        except Exception:
            pass


def _notify_requester_resolution(req: StudyExportRequest, material: StudyMaterial, approver: User, approved: bool):
    try:
        from app.services.email_service import send_email
    except Exception:
        return
    requester = User.query.get(req.requested_by) if req.requested_by else None
    if not requester or not requester.email:
        return
    approver_name = (
        getattr(approver, 'full_name', None) or approver.username
    )
    if approved:
        subj = f"[Evaluaasi] Aprobada: exportación SCORM '{material.title}'"
        body = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#059669">Exportación SCORM aprobada</h2>
          <p>Tu solicitud para exportar el material <strong>{material.title}</strong>
          ha sido aprobada por <strong>{approver_name}</strong>.</p>
          <p>Ingresa al material en la plataforma y descarga el paquete SCORM.</p>
          <p style="background:#fef3c7;border-left:4px solid #f59e0b;padding:10px 14px;border-radius:4px">
            ⚠️ Esta autorización es válida para <strong>una sola descarga</strong>.
            Para descargar el mismo material nuevamente, deberás solicitar otra autorización.
          </p>
        </div>
        """.strip()
    else:
        notes = req.review_notes or '—'
        subj = f"[Evaluaasi] Rechazada: exportación SCORM '{material.title}'"
        body = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#dc2626">Exportación SCORM rechazada</h2>
          <p>Tu solicitud para exportar el material <strong>{material.title}</strong>
          fue rechazada por <strong>{approver_name}</strong>.</p>
          <p><strong>Motivo:</strong><br>{notes}</p>
        </div>
        """.strip()
    try:
        send_email(to=requester.email, subject=subj, html=body)
    except Exception:
        pass


# ── Helpers ────────────────────────────────────────────────────────────

def _latest_active_request(material_id: int) -> StudyExportRequest | None:
    """Solicitud no consumida ni rechazada (pending o approved)."""
    return (
        StudyExportRequest.query
        .filter_by(material_id=material_id)
        .filter(StudyExportRequest.status.in_(['pending', 'approved']))
        .order_by(StudyExportRequest.created_at.desc())
        .first()
    )


# ── ENDPOINTS ──────────────────────────────────────────────────────────

@bp.route('/study-contents/<int:material_id>/export/status', methods=['GET', 'OPTIONS'])
@jwt_required()
@_requester_required
def export_status(material_id: int):
    """Devuelve el estado actual de exportación del material para el editor."""
    if request.method == 'OPTIONS':
        return '', 200
    mat = StudyMaterial.query.get(material_id)
    if not mat:
        return jsonify({'error': 'Material no encontrado'}), 404
    req = _latest_active_request(material_id)
    return jsonify({
        'material_id': material_id,
        'has_active_request': req is not None,
        'request': req.to_dict() if req else None,
    }), 200


@bp.route('/study-contents/<int:material_id>/export/request', methods=['POST', 'OPTIONS'])
@jwt_required()
@_requester_required
def create_export_request(material_id: int):
    if request.method == 'OPTIONS':
        return '', 200
    mat = StudyMaterial.query.get(material_id)
    if not mat:
        return jsonify({'error': 'Material no encontrado'}), 404

    user = _current_user()
    data = request.get_json(silent=True) or {}
    reason = (data.get('reason') or '').strip() or None

    existing = _latest_active_request(material_id)
    if existing:
        return jsonify({
            'error': (
                'Ya existe una solicitud activa para este material.'
                if existing.status == 'pending'
                else 'Este material ya tiene una autorización vigente; descárgalo o consume la autorización actual antes de solicitar otra.'
            ),
            'request': existing.to_dict(),
        }), 409

    # Admin / developer: solicitud auto-aprobada para mantener trazabilidad.
    auto_approve = user.role in ('admin', 'developer')
    now = datetime.now(timezone.utc)
    req = StudyExportRequest(
        material_id=material_id,
        requested_by=user.id,
        reason=reason,
        status='approved' if auto_approve else 'pending',
        reviewed_by=user.id if auto_approve else None,
        reviewed_at=now if auto_approve else None,
        review_notes='Auto-aprobada (admin)' if auto_approve else None,
    )
    db.session.add(req)
    db.session.commit()

    if not auto_approve:
        try:
            _notify_approvers_new_request(req, mat, user)
        except Exception as e:
            print(f"[study_export] Error notificando approvers: {e}")

    return jsonify({
        'message': 'Solicitud creada' if not auto_approve else 'Exportación auto-aprobada',
        'request': req.to_dict(include_material=True),
    }), 201


@bp.route('/study-export-requests', methods=['GET', 'OPTIONS'])
@jwt_required()
@_approver_required
def list_requests():
    if request.method == 'OPTIONS':
        return '', 200
    status = (request.args.get('status') or '').strip().lower() or None
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('per_page', 20))))
    except (TypeError, ValueError):
        page, per_page = 1, 20

    q = StudyExportRequest.query
    if status and status != 'all':
        if status == 'active':
            q = q.filter(StudyExportRequest.status.in_(['pending', 'approved']))
        else:
            q = q.filter(StudyExportRequest.status == status)
    q = q.order_by(StudyExportRequest.created_at.desc())
    total = q.count()
    items = q.limit(per_page).offset((page - 1) * per_page).all()
    return jsonify({
        'requests': [r.to_dict(include_material=True) for r in items],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page if per_page else 1,
    }), 200


@bp.route('/study-export-requests/<int:request_id>', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_request_detail(request_id: int):
    if request.method == 'OPTIONS':
        return '', 200
    user = _current_user()
    if not user:
        return jsonify({'error': 'No autorizado'}), 401
    req = StudyExportRequest.query.get(request_id)
    if not req:
        return jsonify({'error': 'Solicitud no encontrada'}), 404
    if user.role not in APPROVER_ROLES and req.requested_by != user.id:
        return jsonify({'error': 'Permiso denegado'}), 403
    return jsonify(req.to_dict(include_material=True)), 200


@bp.route('/study-export-requests/<int:request_id>/approve', methods=['POST', 'OPTIONS'])
@jwt_required()
@_approver_required
def approve_request(request_id: int):
    if request.method == 'OPTIONS':
        return '', 200
    req = StudyExportRequest.query.get(request_id)
    if not req:
        return jsonify({'error': 'Solicitud no encontrada'}), 404
    if req.status != 'pending':
        return jsonify({'error': f'No se puede aprobar una solicitud en estado {req.status}'}), 400
    user = _current_user()
    data = request.get_json(silent=True) or {}
    notes = (data.get('notes') or '').strip() or None
    req.status = 'approved'
    req.reviewed_by = user.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_notes = notes
    db.session.commit()

    mat = StudyMaterial.query.get(req.material_id)
    if mat:
        try:
            _notify_requester_resolution(req, mat, user, approved=True)
        except Exception as e:
            print(f"[study_export] Error notificando aprobación: {e}")

    return jsonify({'message': 'Solicitud aprobada', 'request': req.to_dict(include_material=True)}), 200


@bp.route('/study-export-requests/<int:request_id>/reject', methods=['POST', 'OPTIONS'])
@jwt_required()
@_approver_required
def reject_request(request_id: int):
    if request.method == 'OPTIONS':
        return '', 200
    req = StudyExportRequest.query.get(request_id)
    if not req:
        return jsonify({'error': 'Solicitud no encontrada'}), 404
    if req.status != 'pending':
        return jsonify({'error': f'No se puede rechazar una solicitud en estado {req.status}'}), 400
    user = _current_user()
    data = request.get_json(silent=True) or {}
    notes = (data.get('notes') or '').strip() or None
    req.status = 'rejected'
    req.reviewed_by = user.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_notes = notes
    db.session.commit()

    mat = StudyMaterial.query.get(req.material_id)
    if mat:
        try:
            _notify_requester_resolution(req, mat, user, approved=False)
        except Exception as e:
            print(f"[study_export] Error notificando rechazo: {e}")

    return jsonify({'message': 'Solicitud rechazada', 'request': req.to_dict(include_material=True)}), 200


@bp.route('/study-contents/<int:material_id>/export/download', methods=['GET', 'OPTIONS'])
@jwt_required()
@_requester_required
def download_export(material_id: int):
    """Descarga el ZIP SCORM consumiendo la autorización vigente."""
    if request.method == 'OPTIONS':
        return '', 200
    mat = StudyMaterial.query.get(material_id)
    if not mat:
        return jsonify({'error': 'Material no encontrado'}), 404
    user = _current_user()
    # Buscar la última solicitud APROBADA y no consumida.
    req = (
        StudyExportRequest.query
        .filter_by(material_id=material_id, status='approved')
        .order_by(StudyExportRequest.created_at.desc())
        .first()
    )
    if not req:
        return jsonify({'error': 'No hay autorización vigente para descargar este material'}), 403

    # Construir ZIP.
    try:
        buf, file_count = build_scorm_zip(mat)
    except Exception as e:
        return jsonify({'error': f'No se pudo generar el paquete SCORM: {e}'}), 500
    size = buf.getbuffer().nbytes
    filename = suggested_filename(mat)

    # Consumir la autorización ANTES de servir (idempotente: si el cliente
    # reintenta, ya no podrá descargar de nuevo).
    req.status = 'consumed'
    req.consumed_at = datetime.now(timezone.utc)
    req.consumed_filename = filename
    req.size_bytes = size
    db.session.commit()

    response = send_file(
        buf,
        mimetype='application/zip',
        as_attachment=True,
        download_name=filename,
    )
    response.headers['X-Export-Request-Id'] = str(req.id)
    response.headers['X-Export-File-Count'] = str(file_count)
    return response


@bp.route('/study-export-requests/stats', methods=['GET', 'OPTIONS'])
@jwt_required()
@_approver_required
def stats():
    if request.method == 'OPTIONS':
        return '', 200
    rows = db.session.execute(
        db.text("SELECT status, COUNT(*) FROM study_export_requests GROUP BY status")
    ).fetchall()
    counts = {row[0]: row[1] for row in rows}
    return jsonify({
        'pending':  counts.get('pending', 0),
        'approved': counts.get('approved', 0),
        'rejected': counts.get('rejected', 0),
        'consumed': counts.get('consumed', 0),
        'total':    sum(counts.values()),
    }), 200
