"""
Endpoints para que el candidato (y staff) consulte sus resultados de exámenes Office.

Estos resultados provienen de los EXEs VB6 (vía /api/vb6/* o /api/*.asmx).
Vive en MotorV2; NO toca BD legacy.
"""
import csv
import io
import logging
from datetime import datetime
from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.user import User
from app.models.partner import Campus, CandidateGroup, Partner
from app.models.office_exam import OfficeExamResult

logger = logging.getLogger(__name__)

bp = Blueprint('office_results', __name__)


# ─── Helpers de tenancy para auditoría ───────────────────────────────

STAFF_ROLES_FULL = {'admin', 'developer', 'gerente', 'financiero', 'soporte'}
STAFF_ROLES_SCOPED = {'coordinator', 'auxiliar', 'responsable',
                      'responsable_partner', 'responsable_estatal'}


def _scope_audit_query(query, user):
    """Aplica filtro multi-tenant según el rol del staff.

    - admin/developer/gerente/financiero/soporte: sin filtro.
    - coordinator/auxiliar: solo campus de sus partners (Campus.coordinator_id).
    - responsable: solo su campus_id.
    - responsable_partner: campus de los partners donde es responsable.
    - responsable_estatal: campus de sus partners filtrados por estado.

    Retorna (query_filtered, error_response_or_None).
    """
    role = user.role
    if role in STAFF_ROLES_FULL:
        return query, None

    if role == 'coordinator':
        campus_ids = [c.id for c in Campus.query.filter_by(coordinator_id=user.id).all()]
        return query.filter(OfficeExamResult.campus_id.in_(campus_ids or [-1])), None

    if role == 'auxiliar':
        coord_id = user.coordinator_id
        if not coord_id:
            return query.filter(OfficeExamResult.campus_id == -1), None
        campus_ids = [c.id for c in Campus.query.filter_by(coordinator_id=coord_id).all()]
        return query.filter(OfficeExamResult.campus_id.in_(campus_ids or [-1])), None

    if role == 'responsable':
        if not user.campus_id:
            return query.filter(OfficeExamResult.campus_id == -1), None
        return query.filter(OfficeExamResult.campus_id == user.campus_id), None

    if role in ('responsable_partner', 'responsable_estatal'):
        # Buscar partners donde el usuario es responsable
        partners = Partner.query.filter_by(coordinator_id=user.coordinator_id or user.id).all()
        partner_ids = [p.id for p in partners]
        if not partner_ids:
            return query.filter(OfficeExamResult.campus_id == -1), None
        campus_q = Campus.query.filter(Campus.partner_id.in_(partner_ids))
        if role == 'responsable_estatal' and getattr(user, 'state', None):
            campus_q = campus_q.filter(Campus.state == user.state)
        campus_ids = [c.id for c in campus_q.all()]
        return query.filter(OfficeExamResult.campus_id.in_(campus_ids or [-1])), None

    return None, (jsonify({'error': 'Permiso denegado'}), 403)


def _apply_audit_filters(query):
    """Aplica filtros desde request.args al query de auditoría."""
    args = request.args

    if args.get('status'):
        query = query.filter(OfficeExamResult.status == args['status'])
    if args.get('session_type'):
        query = query.filter(OfficeExamResult.session_type == args['session_type'])
    if args.get('office_app'):
        query = query.filter(OfficeExamResult.office_app == args['office_app'])
    if args.get('passed') in ('true', 'false'):
        query = query.filter(OfficeExamResult.passed == (args['passed'] == 'true'))
    if args.get('campus_id'):
        try:
            query = query.filter(OfficeExamResult.campus_id == int(args['campus_id']))
        except ValueError:
            pass
    if args.get('group_id'):
        try:
            query = query.filter(OfficeExamResult.group_id == int(args['group_id']))
        except ValueError:
            pass
    if args.get('user_id'):
        query = query.filter(OfficeExamResult.user_id == args['user_id'])

    if args.get('date_from'):
        try:
            d = datetime.fromisoformat(args['date_from'])
            query = query.filter(OfficeExamResult.created_at >= d)
        except ValueError:
            pass
    if args.get('date_to'):
        try:
            d = datetime.fromisoformat(args['date_to'])
            query = query.filter(OfficeExamResult.created_at <= d)
        except ValueError:
            pass

    if args.get('search'):
        term = f"%{args['search'].strip()}%"
        query = query.join(User, User.id == OfficeExamResult.user_id).filter(
            db.or_(
                User.username.ilike(term),
                User.email.ilike(term),
                User.full_name.ilike(term),
                OfficeExamResult.certificate_code.ilike(term),
            )
        )

    return query


@bp.route('/me', methods=['GET'])
@jwt_required()
def list_my_office_results():
    """Lista los resultados Office del candidato autenticado.

    Query params opcionales:
      - status: in_progress|completed|abandoned
      - session_type: examen|simulador|parcial
      - office_app: word|excel|powerpoint|access
      - limit: int (default 100, max 500)
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    q = OfficeExamResult.query.filter_by(user_id=str(user_id))

    status = request.args.get('status')
    if status:
        q = q.filter(OfficeExamResult.status == status)

    session_type = request.args.get('session_type')
    if session_type:
        q = q.filter(OfficeExamResult.session_type == session_type)

    office_app = request.args.get('office_app')
    if office_app:
        q = q.filter(OfficeExamResult.office_app == office_app)

    try:
        limit = min(int(request.args.get('limit', 100)), 500)
    except (TypeError, ValueError):
        limit = 100

    results = q.order_by(OfficeExamResult.created_at.desc()).limit(limit).all()

    # Resumen rápido
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    in_progress = sum(1 for r in results if r.status == 'in_progress')

    return jsonify({
        'results': [r.to_dict() for r in results],
        'total': total,
        'passed': passed,
        'in_progress': in_progress,
    }), 200


@bp.route('/<int:result_id>', methods=['GET'])
@jwt_required()
def get_office_result_detail(result_id):
    """Detalle de un resultado Office. Solo el dueño o staff (admin/coordinator/responsable)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    result = OfficeExamResult.query.get(result_id)
    if not result:
        return jsonify({'error': 'Resultado no encontrado'}), 404

    is_owner = result.user_id == str(user_id)
    is_staff = user.role in ('admin', 'developer', 'coordinator', 'responsable',
                             'responsable_partner', 'responsable_estatal', 'soporte', 'gerente')

    if not (is_owner or is_staff):
        return jsonify({'error': 'Permiso denegado'}), 403

    return jsonify({'result': result.to_dict(include_user=is_staff)}), 200


@bp.route('/verify/<string:certificate_code>', methods=['GET'])
def verify_office_certificate(certificate_code):
    """Verificación pública de un certificado Office por su código (OFC-YYYYMMDD-NNN).
    No requiere autenticación. Devuelve datos mínimos para validar autenticidad.
    """
    if not certificate_code or not certificate_code.strip():
        return jsonify({'valid': False, 'error': 'Código requerido'}), 400

    result = OfficeExamResult.query.filter_by(
        certificate_code=certificate_code.strip().upper()
    ).first()

    if not result or not result.passed:
        return jsonify({'valid': False}), 200

    payload = {
        'valid': True,
        'certificate_code': result.certificate_code,
        'office_app': result.office_app,
        'level': result.level,
        'session_type': result.session_type,
        'score': result.score,
        'passing_score': result.passing_score,
        'finished_at': result.finished_at.isoformat() if result.finished_at else None,
    }

    if result.user:
        payload['holder_name'] = result.user.full_name

    return jsonify(payload), 200


# ─── Auditoría staff ─────────────────────────────────────────────────

@bp.route('/audit', methods=['GET'])
@jwt_required()
def list_audit_office_results():
    """Lista resultados Office para staff con filtros y paginación.

    Query params:
      - status, session_type, office_app, passed (true/false)
      - campus_id, group_id, user_id
      - date_from, date_to (ISO 8601)
      - search (username/email/full_name/certificate_code)
      - page (default 1), per_page (default 50, max 200)

    Filtrado multi-tenant automático por rol.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    if user.role not in (STAFF_ROLES_FULL | STAFF_ROLES_SCOPED):
        return jsonify({'error': 'Permiso denegado'}), 403

    q = OfficeExamResult.query

    q, err = _scope_audit_query(q, user)
    if err is not None:
        return err

    q = _apply_audit_filters(q)
    q = q.order_by(OfficeExamResult.created_at.desc())

    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(max(1, int(request.args.get('per_page', 50))), 200)
    except ValueError:
        page = 1
        per_page = 50

    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    # Resumen sobre el query filtrado completo (sin paginación)
    base_q = OfficeExamResult.query
    base_q, _ = _scope_audit_query(base_q, user)
    base_q = _apply_audit_filters(base_q)
    total = base_q.count()
    passed_count = base_q.filter(OfficeExamResult.passed == True).count()  # noqa: E712
    in_progress_count = base_q.filter(OfficeExamResult.status == 'in_progress').count()

    return jsonify({
        'results': [r.to_dict(include_user=True) for r in pagination.items],
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
        'total': total,
        'summary': {
            'total': total,
            'passed': passed_count,
            'in_progress': in_progress_count,
        },
    }), 200


@bp.route('/audit/export.csv', methods=['GET'])
@jwt_required()
def export_audit_office_results_csv():
    """Exporta los resultados (con los mismos filtros que /audit) a CSV.

    Limita a 10,000 filas para evitar problemas de memoria.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    if user.role not in (STAFF_ROLES_FULL | STAFF_ROLES_SCOPED):
        return jsonify({'error': 'Permiso denegado'}), 403

    q = OfficeExamResult.query
    q, err = _scope_audit_query(q, user)
    if err is not None:
        return err
    q = _apply_audit_filters(q)
    q = q.order_by(OfficeExamResult.created_at.desc()).limit(10000)

    rows = q.all()

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow([
        'id', 'created_at', 'finished_at',
        'user_id', 'username', 'full_name', 'email',
        'office_app', 'level', 'session_type', 'parcial_session',
        'campus_id', 'group_id',
        'status', 'passed', 'score', 'passing_score',
        'duration_seconds', 'app_version', 'certificate_code',
    ])
    for r in rows:
        u = r.user
        writer.writerow([
            r.id,
            r.created_at.isoformat() if r.created_at else '',
            r.finished_at.isoformat() if r.finished_at else '',
            r.user_id,
            u.username if u else '',
            u.full_name if u else '',
            u.email if u else '',
            r.office_app or '',
            r.level or '',
            r.session_type or '',
            r.parcial_session_number or '',
            r.campus_id or '',
            r.group_id or '',
            r.status or '',
            'true' if r.passed else 'false',
            r.score if r.score is not None else '',
            r.passing_score,
            r.duration_seconds or '',
            r.app_version or '',
            r.certificate_code or '',
        ])

    csv_data = out.getvalue()
    out.close()

    fname = f"office-results-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{fname}"'},
    )
