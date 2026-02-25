"""
Rutas de Insignias Digitales — Open Badges 3.0

Endpoints:
  CRUD plantillas   → /api/badges/templates
  Emisión           → /api/badges/issue, /api/badges/issue-batch
  Mis insignias     → /api/badges/my-badges
  Público           → /api/badges/<uuid>/credential.json  (JSON-LD)
                    → /api/badges/issuer                   (Issuer Profile)
  Verificación      → /api/badges/verify/<code>
  Analytics         → POST /api/badges/<id>/share, /api/badges/<id>/verify-count
"""
from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.badge import BadgeTemplate, IssuedBadge
from app.models.user import User

bp = Blueprint('badges', __name__)


# ──────────────────────────────────────────────
# Helper: verificar roles permitidos
# ──────────────────────────────────────────────
def _require_roles(*allowed):
    uid = get_jwt_identity()
    user = User.query.get(str(uid))
    if not user or user.role not in allowed:
        abort(403, description='No tienes permisos para esta acción')
    return user


# ═══════════════════════════════════════════════
# PLANTILLAS (CRUD)
# ═══════════════════════════════════════════════

@bp.route('/templates', methods=['GET'])
@jwt_required()
def list_templates():
    """Listar plantillas de insignias (admin/editor/coordinator)"""
    _require_roles('admin', 'editor', 'coordinator')

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    active_only = request.args.get('active_only', 'false').lower() == 'true'

    query = BadgeTemplate.query
    if active_only:
        query = query.filter_by(is_active=True)
    if search:
        query = query.filter(BadgeTemplate.name.ilike(f'%{search}%'))

    query = query.order_by(BadgeTemplate.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'templates': [t.to_dict() for t in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })


@bp.route('/templates', methods=['POST'])
@jwt_required()
def create_template():
    """Crear nueva plantilla de insignia"""
    user = _require_roles('admin', 'editor', 'coordinator')
    data = request.get_json(silent=True) or {}

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'El nombre es requerido'}), 400

    # Normalize tags: accept string or list
    raw_tags = data.get('tags', '')
    if isinstance(raw_tags, list):
        raw_tags = ', '.join(str(t).strip() for t in raw_tags if str(t).strip())
    tags_str = (raw_tags or '').strip() or None

    # issuer_name is NOT NULL — use default if empty
    issuer_name = data.get('issuer_name', '').strip() if isinstance(data.get('issuer_name'), str) else ''
    if not issuer_name:
        issuer_name = 'ENTRENAMIENTO INFORMATICO AVANZADO S.A. DE C.V.'

    template = BadgeTemplate(
        name=name,
        description=data.get('description', '').strip() or None,
        criteria_narrative=data.get('criteria_narrative', '').strip() or None,
        exam_id=data.get('exam_id'),
        competency_standard_id=data.get('competency_standard_id'),
        issuer_name=issuer_name,
        issuer_url=data.get('issuer_url', '').strip() or None,
        issuer_image_url=data.get('issuer_image_url', '').strip() or None,
        tags=tags_str,
        expiry_months=data.get('expiry_months'),
        is_active=data.get('is_active', True),
        created_by_id=user.id,
    )
    db.session.add(template)
    db.session.commit()

    return jsonify({'message': 'Plantilla creada', 'template': template.to_dict()}), 201


@bp.route('/templates/<int:template_id>', methods=['GET'])
@jwt_required()
def get_template(template_id):
    """Obtener una plantilla por ID"""
    _require_roles('admin', 'editor', 'coordinator')
    template = BadgeTemplate.query.get_or_404(template_id)
    return jsonify({'template': template.to_dict()})


@bp.route('/templates/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_template(template_id):
    """Actualizar plantilla"""
    _require_roles('admin', 'editor', 'coordinator')
    template = BadgeTemplate.query.get_or_404(template_id)
    data = request.get_json(silent=True) or {}

    for field in ('name', 'description', 'criteria_narrative',
                  'issuer_url', 'issuer_image_url'):
        if field in data:
            val = data[field]
            if isinstance(val, str):
                setattr(template, field, val.strip() or None)
            else:
                setattr(template, field, val or None)

    # issuer_name is NOT NULL — never set to None
    if 'issuer_name' in data:
        val = data['issuer_name']
        val = val.strip() if isinstance(val, str) else ''
        template.issuer_name = val or 'ENTRENAMIENTO INFORMATICO AVANZADO S.A. DE C.V.'

    # tags: accept string or list
    if 'tags' in data:
        raw = data['tags']
        if isinstance(raw, list):
            raw = ', '.join(str(t).strip() for t in raw if str(t).strip())
        template.tags = (raw or '').strip() or None

    for int_field in ('exam_id', 'competency_standard_id', 'expiry_months'):
        if int_field in data:
            setattr(template, int_field, data[int_field])

    if 'is_active' in data:
        template.is_active = bool(data['is_active'])

    db.session.commit()
    return jsonify({'message': 'Plantilla actualizada', 'template': template.to_dict()})


@bp.route('/templates/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_template(template_id):
    """Eliminar plantilla (soft: desactivar)"""
    _require_roles('admin', 'editor')
    template = BadgeTemplate.query.get_or_404(template_id)
    template.is_active = False
    db.session.commit()
    return jsonify({'message': 'Plantilla desactivada'})


@bp.route('/templates/<int:template_id>/image', methods=['POST'])
@jwt_required()
def upload_template_image(template_id):
    """Subir imagen personalizada para la plantilla"""
    _require_roles('admin', 'editor', 'coordinator')
    template = BadgeTemplate.query.get_or_404(template_id)

    if 'image' not in request.files:
        return jsonify({'error': 'Se requiere un archivo de imagen'}), 400

    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'Archivo vacío'}), 400

    from app.utils.azure_storage import AzureStorageService
    storage = AzureStorageService()
    url = storage.upload_file(file, folder='badge-templates')
    if not url:
        return jsonify({'error': 'Error al subir la imagen'}), 500

    template.badge_image_url = url
    db.session.commit()

    return jsonify({'message': 'Imagen subida', 'image_url': url})


# ═══════════════════════════════════════════════
# EMISIÓN
# ═══════════════════════════════════════════════

@bp.route('/issue', methods=['POST'])
@jwt_required()
def issue_badge_manual():
    """Emitir insignia manualmente para un resultado"""
    _require_roles('admin', 'editor', 'coordinator')
    data = request.get_json(silent=True) or {}
    result_id = data.get('result_id')
    if not result_id:
        return jsonify({'error': 'result_id requerido'}), 400

    from app.models.exam import Result, Exam
    result = Result.query.get(str(result_id))
    if not result:
        return jsonify({'error': 'Resultado no encontrado'}), 404

    user = User.query.get(str(result.user_id))
    exam = Exam.query.get(result.exam_id)

    from app.services.badge_service import issue_badge_for_result
    badge = issue_badge_for_result(result, user, exam)
    if not badge:
        return jsonify({'error': 'No se pudo emitir la insignia (revise plantilla/resultado)'}), 400

    return jsonify({'message': 'Insignia emitida', 'badge': badge.to_dict(include_credential=True)}), 201


@bp.route('/issue-batch', methods=['POST'])
@jwt_required()
def issue_badge_batch():
    """Emitir insignias en lote"""
    _require_roles('admin', 'editor', 'coordinator')
    data = request.get_json(silent=True) or {}
    result_ids = data.get('result_ids', [])
    if not result_ids:
        return jsonify({'error': 'result_ids requerido'}), 400

    from app.services.badge_service import issue_badges_batch
    badges = issue_badges_batch(result_ids)

    return jsonify({
        'message': f'{len(badges)} insignias emitidas',
        'badges': [b.to_dict() for b in badges],
        'total_issued': len(badges),
    })


# ═══════════════════════════════════════════════
# MIS INSIGNIAS (candidato)
# ═══════════════════════════════════════════════

@bp.route('/my-badges', methods=['GET'])
@jwt_required()
def my_badges():
    """Obtener las insignias del usuario autenticado"""
    uid = get_jwt_identity()
    badges = IssuedBadge.query.filter_by(
        user_id=str(uid), status='active'
    ).order_by(IssuedBadge.issued_at.desc()).all()

    return jsonify({
        'badges': [b.to_dict(include_credential=False) for b in badges],
        'total': len(badges),
    })


@bp.route('/user/<user_id>', methods=['GET'])
@jwt_required()
def user_badges(user_id):
    """Obtener insignias de un usuario (admin/editor/coordinator)"""
    _require_roles('admin', 'editor', 'coordinator')
    badges = IssuedBadge.query.filter_by(
        user_id=str(user_id), status='active'
    ).order_by(IssuedBadge.issued_at.desc()).all()

    return jsonify({
        'badges': [b.to_dict() for b in badges],
        'total': len(badges),
    })


# ═══════════════════════════════════════════════
# ENDPOINTS PÚBLICOS (Open Badges 3.0)
# ═══════════════════════════════════════════════

@bp.route('/<badge_uuid>/credential.json', methods=['GET'])
def public_credential(badge_uuid):
    """
    Endpoint público de credencial OB3 JSON-LD.
    Hosted verification: los verificadores obtienen el JSON de aquí.
    """
    import json as _json
    badge = IssuedBadge.query.filter_by(badge_uuid=badge_uuid).first()
    if not badge:
        return jsonify({'error': 'Badge not found'}), 404

    if badge.status == 'revoked':
        return jsonify({'error': 'This credential has been revoked', 'reason': badge.revocation_reason}), 410

    # Incrementar contador de verificación
    badge.verify_count = (badge.verify_count or 0) + 1
    db.session.commit()

    credential = _json.loads(badge.credential_json) if badge.credential_json else {}
    response = jsonify(credential)
    response.headers['Content-Type'] = 'application/ld+json'
    return response


@bp.route('/issuer', methods=['GET'])
def issuer_profile():
    """Perfil del emisor (Issuer) conforme a OB3"""
    return jsonify({
        'id': request.url_root.rstrip('/') + '/api/badges/issuer',
        'type': ['Profile'],
        'name': 'ENTRENAMIENTO INFORMATICO AVANZADO S.A. DE C.V.',
        'url': 'https://evaluaasi.com',
        'description': 'Plataforma de evaluación y certificación de competencias laborales.',
        'email': 'soporte@evaluaasi.com',
    })


@bp.route('/verify/<code>', methods=['GET'])
def verify_badge(code):
    """Verificar insignia por código BD..."""
    badge = IssuedBadge.query.filter_by(badge_code=code).first()
    if not badge:
        return jsonify({'valid': False, 'error': 'Código no encontrado'}), 404

    badge.verify_count = (badge.verify_count or 0) + 1
    db.session.commit()

    template = BadgeTemplate.query.get(badge.badge_template_id)
    user = User.query.get(str(badge.user_id))

    # Nombre del candidato
    name_parts = [user.name or ''] if user else ['N/A']
    if user and user.first_surname:
        name_parts.append(user.first_surname)
    if user and user.second_surname:
        name_parts.append(user.second_surname)
    full_name = ' '.join(name_parts).strip() or 'N/A'

    # Fecha formateada
    meses = {
        1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
        5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
        9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
    }
    issued_date = badge.issued_at
    formatted_date = None
    if issued_date:
        formatted_date = f"{issued_date.day} de {meses[issued_date.month]} de {issued_date.year}"

    expires_date = None
    if badge.expires_at:
        expires_date = f"{badge.expires_at.day} de {meses[badge.expires_at.month]} de {badge.expires_at.year}"

    from datetime import datetime
    is_expired = badge.expires_at and badge.expires_at < datetime.utcnow()

    return jsonify({
        'valid': badge.status == 'active' and not is_expired,
        'document_type': 'digital_badge',
        'document_name': 'Insignia Digital',
        'verification_code': code,
        'status': 'expired' if is_expired else badge.status,
        'candidate': {
            'full_name': full_name,
        },
        'badge': {
            'name': template.name if template else 'N/A',
            'description': template.description if template else None,
            'issuer_name': template.issuer_name if template else 'EduIT / Evaluaasi',
            'image_url': badge.badge_image_url,
            'issued_date': formatted_date,
            'expires_date': expires_date,
            'badge_uuid': badge.badge_uuid,
            'credential_url': badge.credential_url,
            'verify_count': badge.verify_count,
            'share_count': badge.share_count,
        },
    })


# ═══════════════════════════════════════════════
# ANALYTICS & SHARE
# ═══════════════════════════════════════════════

@bp.route('/<int:badge_id>/share', methods=['POST'])
def track_share(badge_id):
    """Incrementar contador de compartido"""
    badge = IssuedBadge.query.get_or_404(badge_id)
    badge.share_count = (badge.share_count or 0) + 1
    db.session.commit()
    return jsonify({'share_count': badge.share_count})


@bp.route('/<int:badge_id>/claim', methods=['POST'])
@jwt_required()
def claim_badge(badge_id):
    """Marcar insignia como reclamada (claimed)"""
    uid = get_jwt_identity()
    badge = IssuedBadge.query.get_or_404(badge_id)
    if str(badge.user_id) != str(uid):
        abort(403)
    from datetime import datetime
    badge.claimed_at = badge.claimed_at or datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Insignia reclamada', 'claimed_at': str(badge.claimed_at)})


# ═══════════════════════════════════════════════
# REVOCACIÓN
# ═══════════════════════════════════════════════

@bp.route('/<int:badge_id>/revoke', methods=['POST'])
@jwt_required()
def revoke_badge(badge_id):
    """Revocar una insignia emitida"""
    _require_roles('admin', 'editor')
    badge = IssuedBadge.query.get_or_404(badge_id)
    data = request.get_json(silent=True) or {}

    badge.status = 'revoked'
    badge.revocation_reason = data.get('reason', 'Revocada por administrador')
    db.session.commit()

    return jsonify({'message': 'Insignia revocada', 'badge': badge.to_dict()})


# ═══════════════════════════════════════════════
# LINKEDIN SHARE URL
# ═══════════════════════════════════════════════

@bp.route('/<int:badge_id>/linkedin-url', methods=['GET'])
@jwt_required()
def linkedin_share_url(badge_id):
    """Generar URL para agregar insignia a perfil de LinkedIn"""
    badge = IssuedBadge.query.get_or_404(badge_id)
    template = BadgeTemplate.query.get(badge.badge_template_id)

    verify_url = badge.verify_url
    issued_year = badge.issued_at.year if badge.issued_at else ''
    issued_month = badge.issued_at.month if badge.issued_at else ''

    from urllib.parse import quote
    # LinkedIn Add to Profile URL
    params = {
        'name': quote(template.name if template else 'Insignia Digital'),
        'organizationName': quote(template.issuer_name or 'EduIT / Evaluaasi'),
        'issueYear': str(issued_year),
        'issueMonth': str(issued_month),
        'certUrl': quote(verify_url),
        'certId': badge.badge_code,
    }
    if badge.expires_at:
        params['expirationYear'] = str(badge.expires_at.year)
        params['expirationMonth'] = str(badge.expires_at.month)

    linkedin_url = 'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME'
    for k, v in params.items():
        linkedin_url += f'&{k}={v}'

    return jsonify({'linkedin_url': linkedin_url})


# ═══════════════════════════════════════════════
# GRUPO: insignias de un grupo
# ═══════════════════════════════════════════════

@bp.route('/group/<int:group_id>', methods=['GET'])
@jwt_required()
def group_badges(group_id):
    """Obtener insignias emitidas para miembros de un grupo"""
    _require_roles('admin', 'editor', 'coordinator')

    from app.models.partner import GroupMember
    member_ids = [m.user_id for m in GroupMember.query.filter_by(group_id=group_id).all()]
    if not member_ids:
        return jsonify({'badges': [], 'total': 0})

    badges = IssuedBadge.query.filter(
        IssuedBadge.user_id.in_(member_ids)
    ).order_by(IssuedBadge.issued_at.desc()).all()

    result_list = []
    for b in badges:
        d = b.to_dict()
        u = User.query.get(str(b.user_id))
        if u:
            d['candidate_name'] = f"{u.name or ''} {u.first_surname or ''} {u.second_surname or ''}".strip()
            d['candidate_email'] = u.email
        result_list.append(d)

    return jsonify({'badges': result_list, 'total': len(result_list)})
