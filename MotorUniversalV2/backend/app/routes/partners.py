"""
Rutas para gestión de Partners, Planteles y Grupos
Solo accesibles por coordinadores y admins
"""
from flask import Blueprint, request, jsonify, g
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import (
    Partner, PartnerStatePresence, Campus, CandidateGroup, GroupMember,
    User, MEXICAN_STATES
)

bp = Blueprint('partners', __name__, url_prefix='/api/partners')


def coordinator_required(f):
    """Decorador que requiere rol de coordinador o admin"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'No autorizado'}), 401
        if user.role not in ['admin', 'coordinator']:
            return jsonify({'error': 'Acceso denegado. Se requiere rol de coordinador'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


# ============== ESTADOS MEXICANOS ==============

@bp.route('/mexican-states', methods=['GET'])
@jwt_required()
def get_mexican_states():
    """Obtener lista de estados mexicanos"""
    return jsonify({'states': MEXICAN_STATES})


# ============== PARTNERS ==============

@bp.route('', methods=['GET'])
@jwt_required()
@coordinator_required
def get_partners():
    """Listar todos los partners"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '')
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        
        query = Partner.query
        
        if active_only:
            query = query.filter(Partner.is_active == True)
            
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    Partner.name.ilike(search_term),
                    Partner.legal_name.ilike(search_term),
                    Partner.rfc.ilike(search_term)
                )
            )
        
        query = query.order_by(Partner.name)
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'partners': [p.to_dict(include_states=True) for p in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:partner_id>', methods=['GET'])
@jwt_required()
@coordinator_required
def get_partner(partner_id):
    """Obtener detalle de un partner"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        return jsonify({
            'partner': partner.to_dict(include_states=True, include_campuses=True)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('', methods=['POST'])
@jwt_required()
@coordinator_required
def create_partner():
    """Crear un nuevo partner"""
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'El nombre es requerido'}), 400
        
        # Verificar RFC único si se proporciona
        if data.get('rfc'):
            existing = Partner.query.filter_by(rfc=data['rfc']).first()
            if existing:
                return jsonify({'error': 'Ya existe un partner con ese RFC'}), 400
        
        partner = Partner(
            name=data['name'],
            legal_name=data.get('legal_name'),
            rfc=data.get('rfc'),
            email=data.get('email'),
            phone=data.get('phone'),
            website=data.get('website'),
            logo_url=data.get('logo_url'),
            notes=data.get('notes'),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(partner)
        db.session.commit()
        
        return jsonify({
            'message': 'Partner creado exitosamente',
            'partner': partner.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:partner_id>', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_partner(partner_id):
    """Actualizar un partner"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        data = request.get_json()
        
        # Verificar RFC único si cambia
        if data.get('rfc') and data['rfc'] != partner.rfc:
            existing = Partner.query.filter_by(rfc=data['rfc']).first()
            if existing:
                return jsonify({'error': 'Ya existe un partner con ese RFC'}), 400
        
        # Actualizar campos
        for field in ['name', 'legal_name', 'rfc', 'email', 'phone', 'website', 'logo_url', 'notes', 'is_active']:
            if field in data:
                setattr(partner, field, data[field])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Partner actualizado exitosamente',
            'partner': partner.to_dict(include_states=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:partner_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def delete_partner(partner_id):
    """Eliminar un partner (soft delete)"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        partner.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Partner desactivado exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== PRESENCIA EN ESTADOS ==============

@bp.route('/<int:partner_id>/states', methods=['GET'])
@jwt_required()
@coordinator_required
def get_partner_states(partner_id):
    """Obtener estados donde tiene presencia un partner"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        presences = PartnerStatePresence.query.filter_by(partner_id=partner_id).all()
        
        return jsonify({
            'partner_id': partner_id,
            'partner_name': partner.name,
            'states': [p.to_dict() for p in presences]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:partner_id>/states', methods=['POST'])
@jwt_required()
@coordinator_required
def add_partner_state(partner_id):
    """Agregar presencia en un estado"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        data = request.get_json()
        
        state_name = data.get('state_name')
        if not state_name:
            return jsonify({'error': 'El nombre del estado es requerido'}), 400
            
        if state_name not in MEXICAN_STATES:
            return jsonify({'error': 'Estado no válido'}), 400
        
        # Verificar si ya existe
        existing = PartnerStatePresence.query.filter_by(
            partner_id=partner_id,
            state_name=state_name
        ).first()
        
        if existing:
            return jsonify({'error': 'El partner ya tiene presencia en ese estado'}), 400
        
        presence = PartnerStatePresence(
            partner_id=partner_id,
            state_name=state_name,
            regional_contact_name=data.get('regional_contact_name'),
            regional_contact_email=data.get('regional_contact_email'),
            regional_contact_phone=data.get('regional_contact_phone')
        )
        
        db.session.add(presence)
        db.session.commit()
        
        return jsonify({
            'message': f'Presencia en {state_name} agregada',
            'presence': presence.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:partner_id>/states/<int:presence_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def remove_partner_state(partner_id, presence_id):
    """Eliminar presencia en un estado"""
    try:
        presence = PartnerStatePresence.query.filter_by(
            id=presence_id,
            partner_id=partner_id
        ).first_or_404()
        
        state_name = presence.state_name
        db.session.delete(presence)
        db.session.commit()
        
        return jsonify({'message': f'Presencia en {state_name} eliminada'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== PLANTELES (CAMPUSES) ==============

@bp.route('/<int:partner_id>/campuses', methods=['GET'])
@jwt_required()
@coordinator_required
def get_campuses(partner_id):
    """Listar planteles de un partner"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        
        state_filter = request.args.get('state')
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        
        query = Campus.query.filter_by(partner_id=partner_id)
        
        if active_only:
            query = query.filter(Campus.is_active == True)
            
        if state_filter:
            query = query.filter(Campus.state_name == state_filter)
        
        campuses = query.order_by(Campus.state_name, Campus.name).all()
        
        return jsonify({
            'partner_id': partner_id,
            'partner_name': partner.name,
            'campuses': [c.to_dict(include_groups=True) for c in campuses],
            'total': len(campuses)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:partner_id>/campuses', methods=['POST'])
@jwt_required()
@coordinator_required
def create_campus(partner_id):
    """Crear un nuevo plantel"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'El nombre es requerido'}), 400
            
        if not data.get('state_name'):
            return jsonify({'error': 'El estado es requerido'}), 400
            
        if data['state_name'] not in MEXICAN_STATES:
            return jsonify({'error': 'Estado no válido'}), 400
        
        state_name = data['state_name']
        state_auto_created = False
        
        # Verificar si el partner ya tiene presencia en ese estado
        # Si no, crearla automáticamente
        existing_presence = PartnerStatePresence.query.filter_by(
            partner_id=partner_id,
            state_name=state_name
        ).first()
        
        if not existing_presence:
            # Crear automáticamente la presencia en el estado
            new_presence = PartnerStatePresence(
                partner_id=partner_id,
                state_name=state_name,
                is_active=True
            )
            db.session.add(new_presence)
            state_auto_created = True
        
        campus = Campus(
            partner_id=partner_id,
            name=data['name'],
            code=data.get('code'),
            state_name=state_name,
            city=data.get('city'),
            address=data.get('address'),
            postal_code=data.get('postal_code'),
            email=data.get('email'),
            phone=data.get('phone'),
            director_name=data.get('director_name'),
            director_email=data.get('director_email'),
            director_phone=data.get('director_phone'),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(campus)
        db.session.commit()
        
        # Obtener los estados actualizados del partner
        updated_states = [p.to_dict() for p in partner.state_presences.all()]
        
        message = 'Plantel creado exitosamente'
        if state_auto_created:
            message += f'. Se registró automáticamente la presencia en {state_name}'
        
        return jsonify({
            'message': message,
            'campus': campus.to_dict(),
            'state_auto_created': state_auto_created,
            'partner_states': updated_states
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>', methods=['GET'])
@jwt_required()
@coordinator_required
def get_campus(campus_id):
    """Obtener detalle de un plantel"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        return jsonify({
            'campus': campus.to_dict(include_groups=True, include_partner=True)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_campus(campus_id):
    """Actualizar un plantel"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        data = request.get_json()
        
        if data.get('state_name') and data['state_name'] not in MEXICAN_STATES:
            return jsonify({'error': 'Estado no válido'}), 400
        
        # Actualizar campos
        for field in ['name', 'code', 'state_name', 'city', 'address', 'postal_code',
                      'email', 'phone', 'director_name', 'director_email', 'director_phone', 'is_active']:
            if field in data:
                setattr(campus, field, data[field])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Plantel actualizado exitosamente',
            'campus': campus.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def delete_campus(campus_id):
    """Eliminar un plantel (soft delete)"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        campus.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Plantel desactivado exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== GRUPOS ==============

@bp.route('/campuses/<int:campus_id>/groups', methods=['GET'])
@jwt_required()
@coordinator_required
def get_groups(campus_id):
    """Listar grupos de un plantel"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        
        query = CandidateGroup.query.filter_by(campus_id=campus_id)
        
        if active_only:
            query = query.filter(CandidateGroup.is_active == True)
        
        groups = query.order_by(CandidateGroup.name).all()
        
        return jsonify({
            'campus_id': campus_id,
            'campus_name': campus.name,
            'groups': [g.to_dict(include_members=True) for g in groups],
            'total': len(groups)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/groups', methods=['POST'])
@jwt_required()
@coordinator_required
def create_group(campus_id):
    """Crear un nuevo grupo"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'El nombre es requerido'}), 400
        
        group = CandidateGroup(
            campus_id=campus_id,
            name=data['name'],
            code=data.get('code'),
            description=data.get('description'),
            start_date=data.get('start_date'),
            end_date=data.get('end_date'),
            max_members=data.get('max_members', 50),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(group)
        db.session.commit()
        
        return jsonify({
            'message': 'Grupo creado exitosamente',
            'group': group.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group(group_id):
    """Obtener detalle de un grupo"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        return jsonify({
            'group': group.to_dict(include_members=True, include_campus=True)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_group(group_id):
    """Actualizar un grupo"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        data = request.get_json()
        
        # Actualizar campos
        for field in ['name', 'code', 'description', 'start_date', 'end_date', 'max_members', 'is_active']:
            if field in data:
                setattr(group, field, data[field])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Grupo actualizado exitosamente',
            'group': group.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def delete_group(group_id):
    """Eliminar un grupo (soft delete)"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        group.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Grupo desactivado exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== MIEMBROS DE GRUPO ==============

@bp.route('/groups/<int:group_id>/members', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group_members(group_id):
    """Listar miembros de un grupo"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        
        status_filter = request.args.get('status')
        
        query = GroupMember.query.filter_by(group_id=group_id)
        
        if status_filter:
            query = query.filter(GroupMember.status == status_filter)
        
        members = query.all()
        
        return jsonify({
            'group_id': group_id,
            'group_name': group.name,
            'members': [m.to_dict(include_user=True) for m in members],
            'total': len(members),
            'max_members': group.max_members
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/members', methods=['POST'])
@jwt_required()
@coordinator_required
def add_group_member(group_id):
    """Agregar un candidato al grupo"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        data = request.get_json()
        
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'error': 'El ID del usuario es requerido'}), 400
        
        # Verificar que el usuario existe y es candidato
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
            
        if user.role != 'candidato':
            return jsonify({'error': 'Solo se pueden agregar usuarios con rol candidato'}), 400
        
        # Verificar que no esté ya en el grupo
        existing = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
        if existing:
            return jsonify({'error': 'El usuario ya es miembro de este grupo'}), 400
        
        # Verificar capacidad
        current_count = GroupMember.query.filter_by(group_id=group_id).count()
        if current_count >= group.max_members:
            return jsonify({'error': 'El grupo ha alcanzado su capacidad máxima'}), 400
        
        member = GroupMember(
            group_id=group_id,
            user_id=user_id,
            status=data.get('status', 'active'),
            notes=data.get('notes')
        )
        
        db.session.add(member)
        db.session.commit()
        
        return jsonify({
            'message': 'Miembro agregado exitosamente',
            'member': member.to_dict(include_user=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/members/bulk', methods=['POST'])
@jwt_required()
@coordinator_required
def add_group_members_bulk(group_id):
    """Agregar múltiples candidatos al grupo"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        data = request.get_json()
        
        user_ids = data.get('user_ids', [])
        if not user_ids:
            return jsonify({'error': 'Se requiere al menos un ID de usuario'}), 400
        
        added = []
        errors = []
        
        current_count = GroupMember.query.filter_by(group_id=group_id).count()
        
        for user_id in user_ids:
            # Verificar capacidad
            if current_count >= group.max_members:
                errors.append({'user_id': user_id, 'error': 'Capacidad máxima alcanzada'})
                continue
            
            user = User.query.get(user_id)
            if not user:
                errors.append({'user_id': user_id, 'error': 'Usuario no encontrado'})
                continue
                
            if user.role != 'candidato':
                errors.append({'user_id': user_id, 'error': 'No es candidato'})
                continue
            
            existing = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
            if existing:
                errors.append({'user_id': user_id, 'error': 'Ya es miembro'})
                continue
            
            member = GroupMember(
                group_id=group_id,
                user_id=user_id,
                status='active'
            )
            db.session.add(member)
            added.append(user_id)
            current_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'{len(added)} miembros agregados',
            'added': added,
            'errors': errors
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/members/<int:member_id>', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_group_member(group_id, member_id):
    """Actualizar estado de un miembro"""
    try:
        member = GroupMember.query.filter_by(id=member_id, group_id=group_id).first_or_404()
        data = request.get_json()
        
        if 'status' in data:
            if data['status'] not in ['active', 'inactive', 'completed', 'withdrawn']:
                return jsonify({'error': 'Estado no válido'}), 400
            member.status = data['status']
            
        if 'notes' in data:
            member.notes = data['notes']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Miembro actualizado',
            'member': member.to_dict(include_user=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def remove_group_member(group_id, member_id):
    """Eliminar un miembro del grupo"""
    try:
        member = GroupMember.query.filter_by(id=member_id, group_id=group_id).first_or_404()
        
        db.session.delete(member)
        db.session.commit()
        
        return jsonify({'message': 'Miembro eliminado del grupo'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== BÚSQUEDA DE CANDIDATOS ==============

@bp.route('/candidates/search', methods=['GET'])
@jwt_required()
@coordinator_required
def search_candidates():
    """Buscar candidatos para agregar a grupos"""
    try:
        search = request.args.get('search', '')
        exclude_group_id = request.args.get('exclude_group_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = User.query.filter(
            User.role == 'candidato',
            User.is_active == True
        )
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    User.name.ilike(search_term),
                    User.first_surname.ilike(search_term),
                    User.second_surname.ilike(search_term),
                    User.email.ilike(search_term),
                    User.curp.ilike(search_term)
                )
            )
        
        # Excluir candidatos que ya están en un grupo específico
        if exclude_group_id:
            existing_members = db.session.query(GroupMember.user_id).filter(
                GroupMember.group_id == exclude_group_id
            ).subquery()
            query = query.filter(~User.id.in_(existing_members))
        
        query = query.order_by(User.first_surname, User.name)
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        candidates = []
        for user in pagination.items:
            candidates.append({
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'first_surname': user.first_surname,
                'second_surname': user.second_surname,
                'full_name': f"{user.name} {user.first_surname} {user.second_surname or ''}".strip(),
                'curp': user.curp,
                'phone': user.phone,
            })
        
        return jsonify({
            'candidates': candidates,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== DASHBOARD / ESTADÍSTICAS ==============

@bp.route('/dashboard', methods=['GET'])
@jwt_required()
@coordinator_required
def get_dashboard():
    """Obtener estadísticas generales para coordinador"""
    try:
        total_partners = Partner.query.filter_by(is_active=True).count()
        total_campuses = Campus.query.filter_by(is_active=True).count()
        total_groups = CandidateGroup.query.filter_by(is_active=True).count()
        total_members = GroupMember.query.filter_by(status='active').count()
        
        # Partners por estado
        partners_by_state = db.session.query(
            PartnerStatePresence.state_name,
            db.func.count(PartnerStatePresence.id)
        ).filter(
            PartnerStatePresence.is_active == True
        ).group_by(PartnerStatePresence.state_name).all()
        
        # Últimos grupos creados
        recent_groups = CandidateGroup.query.filter_by(is_active=True).order_by(
            CandidateGroup.created_at.desc()
        ).limit(5).all()
        
        return jsonify({
            'stats': {
                'total_partners': total_partners,
                'total_campuses': total_campuses,
                'total_groups': total_groups,
                'total_members': total_members
            },
            'partners_by_state': [
                {'state': state, 'count': count} 
                for state, count in partners_by_state
            ],
            'recent_groups': [g.to_dict(include_campus=True) for g in recent_groups]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== ASOCIACIÓN USUARIO-PARTNER ==============

@bp.route('/<int:partner_id>/users', methods=['GET'])
@jwt_required()
@coordinator_required
def get_partner_users(partner_id):
    """Obtener usuarios (candidatos) asociados a un partner"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '')
        
        query = partner.users
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    User.name.ilike(search_term),
                    User.email.ilike(search_term),
                    User.curp.ilike(search_term)
                )
            )
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'partner_id': partner_id,
            'partner_name': partner.name,
            'users': [u.to_dict(include_private=True) for u in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:partner_id>/users/<string:user_id>', methods=['POST'])
@jwt_required()
@coordinator_required
def add_user_to_partner(partner_id, user_id):
    """Asociar un usuario a un partner"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        user = User.query.get_or_404(user_id)
        
        # Verificar si ya está asociado
        if partner.users.filter_by(id=user_id).first():
            return jsonify({'error': 'El usuario ya está asociado a este partner'}), 400
        
        partner.users.append(user)
        db.session.commit()
        
        return jsonify({
            'message': f'Usuario {user.full_name} asociado a {partner.name}',
            'user': user.to_dict(include_partners=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:partner_id>/users/<string:user_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def remove_user_from_partner(partner_id, user_id):
    """Desasociar un usuario de un partner"""
    try:
        partner = Partner.query.get_or_404(partner_id)
        user = User.query.get_or_404(user_id)
        
        # Verificar si está asociado
        if not partner.users.filter_by(id=user_id).first():
            return jsonify({'error': 'El usuario no está asociado a este partner'}), 400
        
        partner.users.remove(user)
        db.session.commit()
        
        return jsonify({
            'message': f'Usuario {user.full_name} desasociado de {partner.name}'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/users/<string:user_id>/partners', methods=['GET'])
@jwt_required()
@coordinator_required
def get_user_partners(user_id):
    """Obtener los partners a los que está asociado un usuario (solo para coordinadores)
    NOTA: Los coordinadores solo pueden ver la información del usuario en sus propios partners,
    no pueden ver a qué otros partners está asociado el usuario.
    """
    try:
        user = User.query.get_or_404(user_id)
        current_user = g.current_user
        
        partners_data = []
        for partner in user.partners.all():
            # Si el coordinador no es admin, solo puede ver sus propios partners
            # (esto requeriría una relación coordinator-partner, por ahora todos los coordinadores ven todos)
            partner_dict = partner.to_dict(include_states=True, include_campuses=True)
            # Obtener grupos del usuario en este partner
            user_groups = []
            for campus in partner.campuses.all():
                for group in campus.groups.all():
                    membership = GroupMember.query.filter_by(
                        group_id=group.id,
                        user_id=user_id
                    ).first()
                    if membership:
                        user_groups.append({
                            'group': group.to_dict(),
                            'campus': campus.to_dict(),
                            'membership_status': membership.status,
                            'joined_at': membership.joined_at.isoformat() if membership.joined_at else None
                        })
            partner_dict['user_groups'] = user_groups
            partners_data.append(partner_dict)
        
        return jsonify({
            'user_id': user_id,
            'user_name': user.full_name,
            'partners': partners_data,
            'total': len(partners_data)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/users/<string:user_id>/partners', methods=['POST'])
@jwt_required()
@coordinator_required
def set_user_partners(user_id):
    """Establecer los partners de un usuario (reemplaza los existentes)"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        partner_ids = data.get('partner_ids', [])
        
        # Limpiar partners existentes
        user.partners = []
        
        # Agregar nuevos partners
        for pid in partner_ids:
            partner = Partner.query.get(pid)
            if partner:
                user.partners.append(partner)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Partners actualizados exitosamente',
            'user': user.to_dict(include_partners=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== ENDPOINTS PARA CANDIDATOS (SUS PROPIOS PARTNERS) ==============

@bp.route('/my-partners', methods=['GET'])
@jwt_required()
def get_my_partners():
    """Obtener los partners a los que está ligado el candidato actual"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        
        partners_data = []
        for partner in user.partners.all():
            partner_dict = {
                'id': partner.id,
                'name': partner.name,
                'logo_url': partner.logo_url,
                'email': partner.email,
                'phone': partner.phone,
                'website': partner.website,
            }
            
            # Obtener los estados donde el partner tiene presencia
            partner_dict['states'] = [p.state_name for p in partner.state_presences.filter_by(is_active=True).all()]
            
            # Obtener grupos del usuario en este partner
            user_groups = []
            for campus in partner.campuses.filter_by(is_active=True).all():
                for group in campus.groups.filter_by(is_active=True).all():
                    membership = GroupMember.query.filter_by(
                        group_id=group.id,
                        user_id=user_id,
                        status='active'
                    ).first()
                    if membership:
                        user_groups.append({
                            'group_id': group.id,
                            'group_name': group.name,
                            'campus_id': campus.id,
                            'campus_name': campus.name,
                            'campus_city': campus.city,
                            'state_name': campus.state_name,
                            'joined_at': membership.joined_at.isoformat() if membership.joined_at else None
                        })
            partner_dict['my_groups'] = user_groups
            partners_data.append(partner_dict)
        
        return jsonify({
            'partners': partners_data,
            'total': len(partners_data)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/available', methods=['GET'])
@jwt_required()
def get_available_partners():
    """Obtener lista de partners disponibles para que un candidato se ligue"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        
        # Obtener IDs de partners a los que ya está ligado
        current_partner_ids = [p.id for p in user.partners.all()]
        
        # Obtener todos los partners activos
        partners = Partner.query.filter_by(is_active=True).order_by(Partner.name).all()
        
        partners_data = []
        for partner in partners:
            partners_data.append({
                'id': partner.id,
                'name': partner.name,
                'logo_url': partner.logo_url,
                'is_linked': partner.id in current_partner_ids,
                'states': [p.state_name for p in partner.state_presences.filter_by(is_active=True).all()]
            })
        
        return jsonify({
            'partners': partners_data,
            'total': len(partners_data)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/my-partners/<int:partner_id>', methods=['POST'])
@jwt_required()
def link_to_partner(partner_id):
    """Ligarse a un partner como candidato"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        partner = Partner.query.get_or_404(partner_id)
        
        if not partner.is_active:
            return jsonify({'error': 'Este partner no está activo'}), 400
        
        # Verificar si ya está ligado
        if user.partners.filter_by(id=partner_id).first():
            return jsonify({'error': 'Ya estás ligado a este partner'}), 400
        
        user.partners.append(partner)
        db.session.commit()
        
        return jsonify({
            'message': f'Te has ligado exitosamente a {partner.name}',
            'partner': {
                'id': partner.id,
                'name': partner.name,
                'logo_url': partner.logo_url
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/my-partners/<int:partner_id>', methods=['DELETE'])
@jwt_required()
def unlink_from_partner(partner_id):
    """Desligarse de un partner como candidato"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        partner = Partner.query.get_or_404(partner_id)
        
        # Verificar si está ligado
        if not user.partners.filter_by(id=partner_id).first():
            return jsonify({'error': 'No estás ligado a este partner'}), 400
        
        # Verificar si tiene grupos activos con este partner
        has_active_groups = False
        for campus in partner.campuses.all():
            for group in campus.groups.all():
                membership = GroupMember.query.filter_by(
                    group_id=group.id,
                    user_id=user_id,
                    status='active'
                ).first()
                if membership:
                    has_active_groups = True
                    break
            if has_active_groups:
                break
        
        if has_active_groups:
            return jsonify({
                'error': 'No puedes desligarte de este partner mientras tengas grupos activos. Contacta al coordinador.'
            }), 400
        
        user.partners.remove(partner)
        db.session.commit()
        
        return jsonify({
            'message': f'Te has desligado de {partner.name}'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
