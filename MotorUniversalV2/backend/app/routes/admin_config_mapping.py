"""
Endpoints administrativos para mapear partners/campuses de Evaluaasi V2
hacia los IDs reales de EvaluaasiConfig (legacy AD/Guacamole).

Acceso restringido a roles admin/developer.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.user import User
from app.models.partner import Partner, Campus
from app.services.evaluaasi_config_service import get_config_connection

bp = Blueprint('admin_config_mapping', __name__, url_prefix='/api/admin/config-mapping')


def _require_admin():
    user = User.query.get(get_jwt_identity())
    if not user or user.role not in ('admin', 'developer'):
        return None, (jsonify({'error': 'No autorizado'}), 403)
    return user, None


@bp.route('/missing', methods=['GET'])
@jwt_required()
def list_missing():
    """Lista partners y campuses sin mapeo a EvaluaasiConfig."""
    _, err = _require_admin()
    if err:
        return err

    partners = Partner.query.filter(Partner.config_subsistema_id.is_(None)).all()
    campuses = Campus.query.filter(
        (Campus.config_plantel_id.is_(None)) |
        (Campus.config_certificacion_id.is_(None)) |
        (Campus.config_etapa_id.is_(None))
    ).all()

    return jsonify({
        'partners_missing': [
            {
                'id': p.id,
                'name': p.name,
                'config_subsistema_id': p.config_subsistema_id,
            } for p in partners
        ],
        'campuses_missing': [
            {
                'id': c.id,
                'name': c.name,
                'partner_id': c.partner_id,
                'partner_name': c.partner.name if c.partner else None,
                'partner_config_subsistema_id': c.partner.config_subsistema_id if c.partner else None,
                'config_plantel_id': c.config_plantel_id,
                'config_certificacion_id': c.config_certificacion_id,
                'config_etapa_id': c.config_etapa_id,
            } for c in campuses
        ],
    })


@bp.route('/all', methods=['GET'])
@jwt_required()
def list_all():
    """Lista todos los partners/campuses con su mapeo actual."""
    _, err = _require_admin()
    if err:
        return err

    partners = Partner.query.order_by(Partner.id).all()
    campuses = Campus.query.order_by(Campus.partner_id, Campus.id).all()

    return jsonify({
        'partners': [
            {
                'id': p.id,
                'name': p.name,
                'config_subsistema_id': p.config_subsistema_id,
            } for p in partners
        ],
        'campuses': [
            {
                'id': c.id,
                'name': c.name,
                'partner_id': c.partner_id,
                'partner_name': c.partner.name if c.partner else None,
                'config_plantel_id': c.config_plantel_id,
                'config_certificacion_id': c.config_certificacion_id,
                'config_etapa_id': c.config_etapa_id,
            } for c in campuses
        ],
    })


@bp.route('/legacy-subsistemas', methods=['GET'])
@jwt_required()
def list_legacy_subsistemas():
    """Devuelve el catálogo de SubsistemaId disponibles en EvaluaasiConfig."""
    _, err = _require_admin()
    if err:
        return err

    try:
        with get_config_connection() as conn:
            cur = conn.cursor(as_dict=True)
            cur.execute(
                "SELECT SubsistemaId, Nombre, Abreviatura, Activo "
                "FROM dbo.Subsistemas ORDER BY SubsistemaId"
            )
            rows = cur.fetchall()
        return jsonify({
            'subsistemas': [
                {
                    'id': r['SubsistemaId'],
                    'nombre': r['Nombre'],
                    'abreviatura': r['Abreviatura'],
                    'activo': bool(r['Activo']) if r['Activo'] is not None else None,
                } for r in rows
            ]
        })
    except Exception as e:
        return jsonify({'error': f'No se pudo consultar EvaluaasiConfig: {e}'}), 502


@bp.route('/legacy-planteles', methods=['GET'])
@jwt_required()
def list_legacy_planteles():
    """
    Devuelve los PlantelId distintos usados en dbo.Sesion para un SubsistemaId dado.
    EvaluaasiConfig no tiene catálogo formal de planteles; los IDs se observan a
    través del histórico de sesiones.
    Query: ?subsistema_id=14
    """
    _, err = _require_admin()
    if err:
        return err

    try:
        sub_id = int(request.args.get('subsistema_id', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'subsistema_id inválido'}), 400
    if not sub_id:
        return jsonify({'error': 'subsistema_id requerido'}), 400

    try:
        with get_config_connection() as conn:
            cur = conn.cursor(as_dict=True)
            cur.execute(
                "SELECT PlantelId, COUNT(*) AS sesiones, MAX(FechaCreacion) AS ultima "
                "FROM dbo.Sesion WHERE SubsistemaId=%s "
                "GROUP BY PlantelId ORDER BY PlantelId",
                (sub_id,),
            )
            rows = cur.fetchall()
        return jsonify({
            'subsistema_id': sub_id,
            'planteles': [
                {
                    'id': r['PlantelId'],
                    'sesiones': r['sesiones'],
                    'ultima_sesion': r['ultima'].isoformat() if r['ultima'] else None,
                } for r in rows
            ]
        })
    except Exception as e:
        return jsonify({'error': f'No se pudo consultar EvaluaasiConfig: {e}'}), 502


@bp.route('/legacy-certificaciones', methods=['GET'])
@jwt_required()
def list_legacy_certificaciones():
    """
    Devuelve los pares (CertificacionId, EtapaId) usados históricamente en dbo.Sesion,
    opcionalmente filtrados por subsistema_id/plantel_id.
    """
    _, err = _require_admin()
    if err:
        return err

    sub_id = request.args.get('subsistema_id', type=int)
    plantel_id = request.args.get('plantel_id', type=int)

    where = []
    params = []
    if sub_id:
        where.append('SubsistemaId=%s')
        params.append(sub_id)
    if plantel_id:
        where.append('PlantelId=%s')
        params.append(plantel_id)
    where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''

    try:
        with get_config_connection() as conn:
            cur = conn.cursor(as_dict=True)
            cur.execute(
                f"SELECT CertificacionId, EtapaId, COUNT(*) AS sesiones "
                f"FROM dbo.Sesion {where_sql} "
                f"GROUP BY CertificacionId, EtapaId ORDER BY CertificacionId, EtapaId",
                tuple(params),
            )
            rows = cur.fetchall()
        return jsonify({
            'filtros': {'subsistema_id': sub_id, 'plantel_id': plantel_id},
            'certificaciones': [
                {
                    'certificacion_id': r['CertificacionId'],
                    'etapa_id': r['EtapaId'],
                    'sesiones': r['sesiones'],
                } for r in rows
            ]
        })
    except Exception as e:
        return jsonify({'error': f'No se pudo consultar EvaluaasiConfig: {e}'}), 502


def _validate_subsistema(sub_id):
    """Valida que SubsistemaId exista en dbo.Subsistemas."""
    if sub_id is None:
        return True
    try:
        with get_config_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT 1 FROM dbo.Subsistemas WHERE SubsistemaId=%s", (int(sub_id),)
            )
            return cur.fetchone() is not None
    except Exception:
        return False


@bp.route('/partner/<int:partner_id>', methods=['PUT'])
@jwt_required()
def set_partner_mapping(partner_id):
    """Asigna config_subsistema_id a un partner. Body: {subsistema_id: int|null}."""
    _, err = _require_admin()
    if err:
        return err

    partner = Partner.query.get(partner_id)
    if not partner:
        return jsonify({'error': 'Partner no encontrado'}), 404

    data = request.get_json(silent=True) or {}
    sub_id = data.get('subsistema_id')

    if sub_id is not None:
        try:
            sub_id = int(sub_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'subsistema_id debe ser entero'}), 400
        if not _validate_subsistema(sub_id):
            return jsonify({
                'error': f'SubsistemaId={sub_id} no existe en dbo.Subsistemas'
            }), 400

    partner.config_subsistema_id = sub_id
    db.session.commit()

    return jsonify({
        'id': partner.id,
        'name': partner.name,
        'config_subsistema_id': partner.config_subsistema_id,
    })


@bp.route('/campus/<int:campus_id>', methods=['PUT'])
@jwt_required()
def set_campus_mapping(campus_id):
    """
    Asigna mapeo legacy a un campus.
    Body: {plantel_id?: int|null, certificacion_id?: int|null, etapa_id?: int|null}
    Solo se actualizan los campos presentes en el body.
    """
    _, err = _require_admin()
    if err:
        return err

    campus = Campus.query.get(campus_id)
    if not campus:
        return jsonify({'error': 'Campus no encontrado'}), 404

    data = request.get_json(silent=True) or {}

    def _coerce(field):
        if field not in data:
            return False, None
        val = data.get(field)
        if val is None or val == '':
            return True, None
        try:
            return True, int(val)
        except (TypeError, ValueError):
            raise ValueError(f'{field} debe ser entero o null')

    try:
        present_plantel, plantel_id = _coerce('plantel_id')
        present_cert,    cert_id    = _coerce('certificacion_id')
        present_etapa,   etapa_id   = _coerce('etapa_id')
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    if present_plantel:
        campus.config_plantel_id = plantel_id
    if present_cert:
        campus.config_certificacion_id = cert_id
    if present_etapa:
        campus.config_etapa_id = etapa_id

    db.session.commit()

    return jsonify({
        'id': campus.id,
        'name': campus.name,
        'partner_id': campus.partner_id,
        'config_plantel_id': campus.config_plantel_id,
        'config_certificacion_id': campus.config_certificacion_id,
        'config_etapa_id': campus.config_etapa_id,
    })
