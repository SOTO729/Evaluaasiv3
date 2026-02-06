"""
Rutas para gestión de Partners, Planteles y Grupos
Solo accesibles por coordinadores y admins
"""
import secrets
import string
from datetime import datetime
from io import BytesIO
from flask import Blueprint, request, jsonify, g, send_file
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from app import db
from app.models import (
    Partner, PartnerStatePresence, Campus, CandidateGroup, GroupMember,
    User, MEXICAN_STATES, SchoolCycle
)
from app.models.partner import GroupExam
from app.models.user import decrypt_password, encrypt_password

bp = Blueprint('partners', __name__)


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


@bp.route('/countries', methods=['GET'])
@jwt_required()
def get_countries():
    """Obtener lista de países disponibles"""
    from app.models.partner import AVAILABLE_COUNTRIES
    return jsonify({'countries': AVAILABLE_COUNTRIES})


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
            country=data.get('country', 'México'),
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
        for field in ['name', 'legal_name', 'rfc', 'country', 'email', 'phone', 'website', 'logo_url', 'notes', 'is_active']:
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
    import secrets
    import string
    
    def generate_campus_code():
        """Genera un código único de 15 caracteres alfanuméricos"""
        alphabet = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(secrets.choice(alphabet) for _ in range(15))
            # Verificar que no exista
            if not Campus.query.filter_by(code=code).first():
                return code
    
    try:
        partner = Partner.query.get_or_404(partner_id)
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'El nombre es requerido'}), 400
        
        # El país por defecto es México
        country = data.get('country', 'México')
        
        # Si el país es México, el estado es requerido
        if country == 'México':
            if not data.get('state_name'):
                return jsonify({'error': 'El estado es requerido para México'}), 400
            if data['state_name'] not in MEXICAN_STATES:
                return jsonify({'error': 'Estado no válido'}), 400
        
        # El state_name puede ser None para países que no son México
        state_name = data.get('state_name') if country == 'México' else data.get('state_name', '')
            
        # Código postal es opcional
            
        if not data.get('email'):
            return jsonify({'error': 'El correo de contacto es requerido'}), 400
            
        if not data.get('phone'):
            return jsonify({'error': 'El teléfono de contacto es requerido'}), 400
            
        if not data.get('director_name'):
            return jsonify({'error': 'El nombre del director es requerido'}), 400
        
        if not data.get('director_first_surname'):
            return jsonify({'error': 'El primer apellido del director es requerido'}), 400
        
        if not data.get('director_second_surname'):
            return jsonify({'error': 'El segundo apellido del director es requerido'}), 400
            
        if not data.get('director_email'):
            return jsonify({'error': 'El correo del director es requerido'}), 400
            
        if not data.get('director_phone'):
            return jsonify({'error': 'El teléfono del director es requerido'}), 400
        
        if not data.get('director_curp'):
            return jsonify({'error': 'El CURP del director es requerido'}), 400
        
        # Validar CURP del director (18 caracteres)
        director_curp = data['director_curp'].upper().strip()
        if len(director_curp) != 18:
            return jsonify({'error': 'El CURP del director debe tener 18 caracteres'}), 400
        
        if not data.get('director_gender'):
            return jsonify({'error': 'El género del director es requerido'}), 400
        
        if data['director_gender'] not in ['M', 'F', 'O']:
            return jsonify({'error': 'Género del director inválido. Use M, F u O'}), 400
        
        if not data.get('director_date_of_birth'):
            return jsonify({'error': 'La fecha de nacimiento del director es requerida'}), 400
        
        # Validar formato de fecha de nacimiento
        from datetime import datetime as dt
        try:
            director_dob = dt.strptime(data['director_date_of_birth'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de fecha de nacimiento inválido. Use YYYY-MM-DD'}), 400
        
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
        
        # Generar código único para el plantel
        campus_code = generate_campus_code()
        
        # Los planteles nuevos se crean inactivos por defecto
        # Se activarán al completar el proceso de activación (asignar responsable, etc.)
        campus = Campus(
            partner_id=partner_id,
            name=data['name'],
            code=campus_code,
            country=country,
            state_name=state_name if state_name else None,
            city=data.get('city'),
            address=data.get('address'),
            postal_code=data.get('postal_code'),
            email=data.get('email'),
            phone=data.get('phone'),
            website=data.get('website'),
            # Director del plantel (datos completos)
            director_name=data.get('director_name'),
            director_first_surname=data.get('director_first_surname'),
            director_second_surname=data.get('director_second_surname'),
            director_email=data.get('director_email'),
            director_phone=data.get('director_phone'),
            director_curp=director_curp,
            director_gender=data.get('director_gender'),
            director_date_of_birth=director_dob,
            is_active=False,  # Inactivo hasta completar activación
            activation_status='pending'  # Estado inicial de activación
        )
        
        db.session.add(campus)
        db.session.flush()  # Para obtener el ID del campus
        
        # Crear usuario del director del plantel como responsable disponible
        import random
        import uuid
        
        def generate_unique_username():
            chars = string.ascii_uppercase + string.digits
            while True:
                username = ''.join(random.choices(chars, k=10))
                if not User.query.filter_by(username=username).first():
                    return username
        
        director_username = generate_unique_username()
        director_password = secrets.token_urlsafe(12)
        
        # Crear el usuario del director con rol responsable
        # El usuario del director se identifica porque su CURP coincide con director_curp del campus
        director_user = User(
            id=str(uuid.uuid4()),
            email=data.get('director_email'),
            username=director_username,
            name=data.get('director_name').strip(),
            first_surname=data.get('director_first_surname').strip(),
            second_surname=data.get('director_second_surname').strip(),
            gender=data.get('director_gender'),
            curp=director_curp,
            date_of_birth=director_dob,
            role='responsable',
            campus_id=campus.id,  # Asociado al plantel
            is_active=True,
            is_verified=True,
            can_bulk_create_candidates=False,
            can_manage_groups=False
        )
        director_user.set_password(director_password)
        director_user.encrypted_password = encrypt_password(director_password)
        
        db.session.add(director_user)
        
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
            'partner_states': updated_states,
            'director_user': {
                'id': director_user.id,
                'username': director_username,
                'full_name': director_user.full_name,
                'email': director_user.email,
                'temporary_password': director_password
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>', methods=['GET'])
@jwt_required()
@coordinator_required
def get_campus(campus_id):
    """Obtener detalle de un plantel con ciclos escolares"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        return jsonify({
            'campus': campus.to_dict(include_groups=True, include_partner=True, include_cycles=True, include_responsable=True)
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
        
        # Validar estado solo si el país es México
        country = data.get('country', campus.country or 'México')
        if country == 'México' and data.get('state_name') and data['state_name'] not in MEXICAN_STATES:
            return jsonify({'error': 'Estado no válido'}), 400
        
        # Si cambia a un país que no es México, el state_name puede quedar vacío
        if 'country' in data and data['country'] != 'México' and 'state_name' not in data:
            data['state_name'] = None
        
        # Validar y procesar campos del director si se envían
        if 'director_curp' in data and data['director_curp']:
            data['director_curp'] = data['director_curp'].upper().strip()
            if len(data['director_curp']) != 18:
                return jsonify({'error': 'El CURP del director debe tener 18 caracteres'}), 400
        
        if 'director_gender' in data and data['director_gender']:
            if data['director_gender'] not in ['M', 'F', 'O']:
                return jsonify({'error': 'Género del director inválido. Use M, F u O'}), 400
        
        if 'director_date_of_birth' in data and data['director_date_of_birth']:
            from datetime import datetime as dt
            try:
                data['director_date_of_birth'] = dt.strptime(data['director_date_of_birth'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Formato de fecha de nacimiento inválido. Use YYYY-MM-DD'}), 400
        
        # Actualizar campos (incluyendo los nuevos del director)
        for field in ['name', 'country', 'state_name', 'city', 'address', 'postal_code',
                      'email', 'phone', 'website', 
                      'director_name', 'director_first_surname', 'director_second_surname',
                      'director_email', 'director_phone', 'director_curp', 'director_gender', 
                      'director_date_of_birth', 'is_active']:
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


@bp.route('/campuses/<int:campus_id>/permanent-delete', methods=['DELETE'])
@jwt_required()
def permanent_delete_campus(campus_id):
    """
    Eliminar permanentemente un plantel (SOLO ADMINISTRADOR)
    Elimina:
    - El plantel
    - Los ciclos escolares del plantel
    - Los grupos del plantel
    - Los miembros de grupos (GroupMember)
    - Los exámenes asignados a grupos (GroupExam) y sus miembros específicos
    - Los materiales de estudio asignados a grupos (GroupStudyMaterial) y sus miembros específicos
    - Los estándares de competencia del plantel (CampusCompetencyStandard)
    
    NO elimina y permanece intacto:
    - Los usuarios (candidatos, responsables) - solo se desvinculan del plantel
    - Los vouchers ya asignados - las certificaciones permanecen
    - Los resultados de exámenes
    """
    from app.models.partner import GroupStudyMaterial, GroupStudyMaterialMember, GroupExamMember
    
    try:
        # Verificar que el usuario sea admin
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Acceso denegado. Solo administradores pueden eliminar planteles permanentemente'}), 403
        
        campus = Campus.query.get_or_404(campus_id)
        partner_id = campus.partner_id
        campus_name = campus.name
        
        # Contadores para el resumen
        stats = {
            'groups_deleted': 0,
            'cycles_deleted': 0,
            'members_removed': 0,
            'exams_unassigned': 0,
            'materials_unassigned': 0,
            'users_unlinked': 0,
            'competency_standards_deleted': 0
        }
        
        # 1. Obtener todos los grupos del plantel
        groups = CandidateGroup.query.filter_by(campus_id=campus_id).all()
        
        for group in groups:
            # Contar miembros que se eliminarán
            members_count = GroupMember.query.filter_by(group_id=group.id).count()
            stats['members_removed'] += members_count
            
            # Obtener exámenes asignados y eliminar sus miembros específicos primero
            group_exams = GroupExam.query.filter_by(group_id=group.id).all()
            for ge in group_exams:
                GroupExamMember.query.filter_by(group_exam_id=ge.id).delete()
            stats['exams_unassigned'] += len(group_exams)
            
            # Obtener materiales asignados y eliminar sus miembros específicos primero
            group_materials = GroupStudyMaterial.query.filter_by(group_id=group.id).all()
            for gm in group_materials:
                GroupStudyMaterialMember.query.filter_by(group_study_material_id=gm.id).delete()
            stats['materials_unassigned'] += len(group_materials)
            
            # Eliminar miembros de grupo (los usuarios NO se eliminan, solo la membresía)
            GroupMember.query.filter_by(group_id=group.id).delete()
            
            # Eliminar asignaciones de exámenes a grupos (GroupExam)
            # Nota: Esto NO elimina los resultados del usuario, solo la asignación del grupo
            GroupExam.query.filter_by(group_id=group.id).delete()
            
            # Eliminar asignaciones de materiales a grupos
            GroupStudyMaterial.query.filter_by(group_id=group.id).delete()
            
            stats['groups_deleted'] += 1
        
        # 2. Eliminar grupos
        CandidateGroup.query.filter_by(campus_id=campus_id).delete()
        
        # 3. Eliminar ciclos escolares
        cycles_count = SchoolCycle.query.filter_by(campus_id=campus_id).count()
        SchoolCycle.query.filter_by(campus_id=campus_id).delete()
        stats['cycles_deleted'] = cycles_count
        
        # 4. Eliminar estándares de competencia del plantel
        from app.models.partner import CampusCompetencyStandard
        competency_count = CampusCompetencyStandard.query.filter_by(campus_id=campus_id).count()
        CampusCompetencyStandard.query.filter_by(campus_id=campus_id).delete()
        stats['competency_standards_deleted'] = competency_count
        
        # 5. Desvincular usuarios del plantel (NO eliminarlos)
        # Los usuarios con campus_id = este plantel se desvinculan
        users_in_campus = User.query.filter_by(campus_id=campus_id).all()
        for u in users_in_campus:
            u.campus_id = None
            stats['users_unlinked'] += 1
        
        # 6. Desvincular responsable del plantel
        campus.responsable_id = None
        
        # 7. Finalmente, eliminar el plantel
        db.session.delete(campus)
        db.session.commit()
        
        return jsonify({
            'message': f'Plantel "{campus_name}" eliminado permanentemente',
            'campus_id': campus_id,
            'partner_id': partner_id,
            'stats': stats
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar el plantel: {str(e)}'}), 500


# ============== ACTIVACIÓN DE PLANTEL ==============

@bp.route('/campuses/<int:campus_id>/responsable', methods=['POST'])
@jwt_required()
@coordinator_required
def create_campus_responsable(campus_id):
    """
    Crear usuario responsable del plantel (Paso 1 de activación)
    Este endpoint crea un nuevo usuario con rol 'responsable' y lo asocia al plantel
    Si ya existe un responsable y se pasa replace_existing=true, permite actualizar o reemplazar
    """
    import random
    import string
    import uuid
    import secrets
    from datetime import datetime
    
    try:
        campus = Campus.query.get_or_404(campus_id)
        data = request.get_json()
        
        # Verificar si se quiere reemplazar/editar el responsable existente
        replace_existing = data.get('replace_existing', False)
        
        # Guardar el ID del responsable actual para verificaciones posteriores
        current_responsable_id = campus.responsable_id
        current_responsable = None
        
        # Verificar que el plantel no tenga ya un responsable activo
        if current_responsable_id:
            current_responsable = User.query.get(current_responsable_id)
            if current_responsable and current_responsable.is_active:
                if not replace_existing:
                    return jsonify({
                        'error': 'El plantel ya tiene un responsable asignado',
                        'current_responsable': {
                            'id': current_responsable.id,
                            'full_name': current_responsable.full_name,
                            'email': current_responsable.email
                        }
                    }), 400
                # Si replace_existing=true, continuamos sin desvincular aún
        
        # Validar campos requeridos
        required_fields = {
            'name': 'Nombre(s)',
            'first_surname': 'Apellido paterno',
            'second_surname': 'Apellido materno',
            'email': 'Correo electrónico',
            'curp': 'CURP',
            'gender': 'Género',
            'date_of_birth': 'Fecha de nacimiento'
        }
        
        for field, label in required_fields.items():
            if not data.get(field):
                return jsonify({'error': f'El campo {label} es requerido'}), 400
        
        email = data['email'].strip().lower()
        curp = data['curp'].upper().strip()
        
        # Validar formato de email
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({'error': 'Formato de correo electrónico inválido'}), 400
        
        # Validar CURP (18 caracteres alfanuméricos)
        curp_pattern = r'^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$'
        if not re.match(curp_pattern, curp):
            return jsonify({'error': 'Formato de CURP inválido. Debe tener 18 caracteres'}), 400
        
        # Validar género
        if data['gender'] not in ['M', 'F', 'O']:
            return jsonify({'error': 'Género inválido. Use M (masculino), F (femenino) u O (otro)'}), 400
        
        # Validar fecha de nacimiento
        try:
            date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400
        
        # Verificar email único (excepto si es el responsable actual que estamos actualizando)
        existing_email_user = User.query.filter_by(email=email).first()
        if existing_email_user:
            # Si replace_existing=true y el usuario con ese email es el responsable actual, actualizarlo
            if replace_existing and current_responsable_id and existing_email_user.id == current_responsable_id:
                # Actualizar el responsable existente en lugar de crear uno nuevo
                existing_email_user.name = data['name'].strip()
                existing_email_user.first_surname = data['first_surname'].strip()
                existing_email_user.second_surname = data['second_surname'].strip()
                existing_email_user.gender = data['gender']
                existing_email_user.curp = curp
                existing_email_user.date_of_birth = date_of_birth
                existing_email_user.can_bulk_create_candidates = data.get('can_bulk_create_candidates', False)
                existing_email_user.can_manage_groups = data.get('can_manage_groups', False)
                existing_email_user.campus_id = campus.id
                
                db.session.commit()
                
                return jsonify({
                    'message': 'Responsable del plantel actualizado exitosamente',
                    'responsable': {
                        'id': existing_email_user.id,
                        'username': existing_email_user.username,
                        'full_name': existing_email_user.full_name,
                        'email': existing_email_user.email,
                        'curp': existing_email_user.curp,
                        'gender': existing_email_user.gender,
                        'date_of_birth': existing_email_user.date_of_birth.isoformat(),
                        'can_bulk_create_candidates': existing_email_user.can_bulk_create_candidates,
                        'can_manage_groups': existing_email_user.can_manage_groups
                        # No incluimos temporary_password porque no cambia
                    },
                    'campus': {
                        'id': campus.id,
                        'activation_status': campus.activation_status
                    }
                }), 200
            else:
                return jsonify({'error': 'Ya existe un usuario con ese correo electrónico'}), 400
        
        # Verificar CURP único (excepto si es el responsable actual)
        existing_curp_user = User.query.filter_by(curp=curp).first()
        if existing_curp_user:
            if replace_existing and current_responsable_id and existing_curp_user.id == current_responsable_id:
                # Ya manejado arriba, no debería llegar aquí si el email es el mismo
                pass
            else:
                return jsonify({'error': 'Ya existe un usuario con ese CURP'}), 400
        
        # Generar username único de 10 caracteres (letras y números en mayúsculas)
        def generate_unique_username():
            chars = string.ascii_uppercase + string.digits
            while True:
                username = ''.join(random.choices(chars, k=10))
                if not User.query.filter_by(username=username).first():
                    return username
        
        username = generate_unique_username()
        
        # Generar contraseña segura
        password = secrets.token_urlsafe(12)
        
        # Obtener permisos configurables (defaults a False)
        can_bulk_create = data.get('can_bulk_create_candidates', False)
        can_manage_groups = data.get('can_manage_groups', False)
        
        # Si hay un responsable anterior y estamos creando uno nuevo, desvincularlo
        if replace_existing and current_responsable:
            current_responsable.campus_id = None
            db.session.add(current_responsable)
        
        # Crear el usuario responsable
        new_user = User(
            id=str(uuid.uuid4()),
            email=email,
            username=username,
            name=data['name'].strip(),
            first_surname=data['first_surname'].strip(),
            second_surname=data['second_surname'].strip(),
            gender=data['gender'],
            curp=curp,
            date_of_birth=date_of_birth,
            role='responsable',
            campus_id=campus.id,
            is_active=True,
            is_verified=True,  # Pre-verificado ya que lo crea un admin/coordinator
            can_bulk_create_candidates=can_bulk_create,
            can_manage_groups=can_manage_groups
        )
        new_user.set_password(password)
        new_user.encrypted_password = encrypt_password(password)
        
        db.session.add(new_user)
        
        # Asociar el responsable al plantel y actualizar estado de activación
        campus.responsable_id = new_user.id
        campus.activation_status = 'configuring'  # Avanza al siguiente estado
        
        db.session.commit()
        
        return jsonify({
            'message': 'Responsable del plantel creado exitosamente',
            'responsable': {
                'id': new_user.id,
                'username': new_user.username,
                'full_name': new_user.full_name,
                'email': new_user.email,
                'curp': new_user.curp,
                'gender': new_user.gender,
                'date_of_birth': new_user.date_of_birth.isoformat(),
                'can_bulk_create_candidates': new_user.can_bulk_create_candidates,
                'can_manage_groups': new_user.can_manage_groups,
                'temporary_password': password  # Solo se muestra una vez
            },
            'campus': {
                'id': campus.id,
                'name': campus.name,
                'code': campus.code,
                'activation_status': campus.activation_status
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/responsable', methods=['GET'])
@jwt_required()
@coordinator_required
def get_campus_responsable(campus_id):
    """Obtener información del responsable del plantel"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        if not campus.responsable_id:
            return jsonify({
                'message': 'El plantel no tiene responsable asignado',
                'responsable': None,
                'activation_status': campus.activation_status
            })
        
        responsable = User.query.get(campus.responsable_id)
        if not responsable:
            return jsonify({
                'message': 'El responsable asignado no existe',
                'responsable': None,
                'activation_status': campus.activation_status
            })
        
        return jsonify({
            'responsable': {
                'id': responsable.id,
                'username': responsable.username,
                'full_name': responsable.full_name,
                'email': responsable.email,
                'curp': responsable.curp,
                'gender': responsable.gender,
                'date_of_birth': responsable.date_of_birth.isoformat() if responsable.date_of_birth else None,
                'can_bulk_create_candidates': responsable.can_bulk_create_candidates,
                'can_manage_groups': responsable.can_manage_groups,
                'is_active': responsable.is_active,
                'created_at': responsable.created_at.isoformat() if responsable.created_at else None
            },
            'activation_status': campus.activation_status
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/responsable', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_campus_responsable(campus_id):
    """Actualizar datos o permisos del responsable del plantel"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        if not campus.responsable_id:
            return jsonify({'error': 'El plantel no tiene responsable asignado'}), 404
        
        responsable = User.query.get(campus.responsable_id)
        if not responsable:
            return jsonify({'error': 'El responsable asignado no existe'}), 404
        
        data = request.get_json()
        
        # Campos actualizables
        updatable_fields = ['name', 'first_surname', 'second_surname', 'gender', 'phone']
        for field in updatable_fields:
            if field in data:
                setattr(responsable, field, data[field].strip() if isinstance(data[field], str) else data[field])
        
        # Actualizar permisos
        if 'can_bulk_create_candidates' in data:
            responsable.can_bulk_create_candidates = bool(data['can_bulk_create_candidates'])
        if 'can_manage_groups' in data:
            responsable.can_manage_groups = bool(data['can_manage_groups'])
        
        # Actualizar estado activo
        if 'is_active' in data:
            responsable.is_active = bool(data['is_active'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Responsable actualizado exitosamente',
            'responsable': {
                'id': responsable.id,
                'username': responsable.username,
                'full_name': responsable.full_name,
                'email': responsable.email,
                'curp': responsable.curp,
                'gender': responsable.gender,
                'date_of_birth': responsable.date_of_birth.isoformat() if responsable.date_of_birth else None,
                'can_bulk_create_candidates': responsable.can_bulk_create_candidates,
                'can_manage_groups': responsable.can_manage_groups,
                'is_active': responsable.is_active
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/available-responsables', methods=['GET'])
@jwt_required()
@coordinator_required
def get_available_responsables(campus_id):
    """
    Obtener lista de responsables disponibles que pueden ser asignados a este plantel.
    Solo muestra responsables del mismo partner que no estén asignados a otro plantel activo.
    El director del plantel (identificado por su CURP) aparece primero en la lista.
    """
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        # Obtener todos los planteles del mismo partner
        partner_campus_ids = [c.id for c in Campus.query.filter_by(partner_id=campus.partner_id).all()]
        
        # Buscar usuarios con rol 'responsable' que pertenezcan a algún plantel del partner
        # y que no estén asignados actualmente a ningún plantel activo
        responsables = User.query.filter(
            User.role == 'responsable',
            User.is_active == True,
            User.campus_id.in_(partner_campus_ids)
        ).all()
        
        available = []
        for resp in responsables:
            # Verificar si está asignado a un plantel activo (diferente al actual)
            assigned_campus = Campus.query.filter(
                Campus.responsable_id == resp.id,
                Campus.id != campus_id,
                Campus.is_active == True
            ).first()
            
            # También verificar si está asignado al plantel actual
            is_current = campus.responsable_id == resp.id
            
            # Verificar si es el director del plantel (su CURP coincide con director_curp)
            is_director = resp.curp and campus.director_curp and resp.curp.upper() == campus.director_curp.upper()
            
            if not assigned_campus:
                available.append({
                    'id': resp.id,
                    'full_name': resp.full_name,
                    'email': resp.email,
                    'curp': resp.curp,
                    'gender': resp.gender,
                    'date_of_birth': resp.date_of_birth.isoformat() if resp.date_of_birth else None,
                    'username': resp.username,
                    'can_bulk_create_candidates': resp.can_bulk_create_candidates,
                    'can_manage_groups': resp.can_manage_groups,
                    'is_current': is_current,
                    'is_director': is_director,
                    'campus_id': resp.campus_id
                })
        
        # Ordenar: director primero, luego por nombre
        available.sort(key=lambda x: (not x['is_director'], x['full_name'].lower()))
        
        return jsonify({
            'available_responsables': available,
            'total': len(available),
            'campus_id': campus_id,
            'partner_id': campus.partner_id
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/assign-responsable', methods=['POST'])
@jwt_required()
@coordinator_required
def assign_existing_responsable(campus_id):
    """
    Asignar un responsable existente a un plantel.
    El responsable debe pertenecer al mismo partner y no estar asignado a otro plantel activo.
    """
    try:
        campus = Campus.query.get_or_404(campus_id)
        data = request.get_json()
        
        responsable_id = data.get('responsable_id')
        if not responsable_id:
            return jsonify({'error': 'El ID del responsable es requerido'}), 400
        
        responsable = User.query.get(responsable_id)
        if not responsable:
            return jsonify({'error': 'Responsable no encontrado'}), 404
        
        if responsable.role != 'responsable':
            return jsonify({'error': 'El usuario seleccionado no es un responsable'}), 400
        
        if not responsable.is_active:
            return jsonify({'error': 'El responsable no está activo'}), 400
        
        # Verificar que el responsable pertenezca a un plantel del mismo partner
        resp_campus = Campus.query.get(responsable.campus_id) if responsable.campus_id else None
        if not resp_campus or resp_campus.partner_id != campus.partner_id:
            return jsonify({'error': 'El responsable debe pertenecer al mismo partner'}), 400
        
        # Verificar que no esté asignado a otro plantel activo
        assigned_campus = Campus.query.filter(
            Campus.responsable_id == responsable_id,
            Campus.id != campus_id,
            Campus.is_active == True
        ).first()
        
        if assigned_campus:
            return jsonify({
                'error': f'El responsable ya está asignado al plantel activo: {assigned_campus.name}'
            }), 400
        
        # Si el plantel ya tiene otro responsable, liberarlo
        if campus.responsable_id and campus.responsable_id != responsable_id:
            # El responsable anterior mantiene su rol pero queda sin plantel asignado
            pass  # No hacemos nada con el anterior, solo lo reemplazamos
        
        # Asignar el responsable al plantel
        campus.responsable_id = responsable_id
        responsable.campus_id = campus.id  # Actualizar el campus_id del responsable
        
        # Actualizar permisos si se envían
        if 'can_bulk_create_candidates' in data:
            responsable.can_bulk_create_candidates = bool(data['can_bulk_create_candidates'])
        if 'can_manage_groups' in data:
            responsable.can_manage_groups = bool(data['can_manage_groups'])
        
        # Avanzar el estado de activación
        if campus.activation_status == 'pending':
            campus.activation_status = 'configuring'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Responsable asignado exitosamente',
            'responsable': {
                'id': responsable.id,
                'username': responsable.username,
                'full_name': responsable.full_name,
                'email': responsable.email,
                'curp': responsable.curp,
                'gender': responsable.gender,
                'date_of_birth': responsable.date_of_birth.isoformat() if responsable.date_of_birth else None,
                'can_bulk_create_candidates': responsable.can_bulk_create_candidates,
                'can_manage_groups': responsable.can_manage_groups,
                'is_active': responsable.is_active
            },
            'campus': {
                'id': campus.id,
                'name': campus.name,
                'code': campus.code,
                'activation_status': campus.activation_status
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/activate', methods=['POST'])
@jwt_required()
@coordinator_required
def activate_campus(campus_id):
    """Activar un plantel después de completar el proceso de configuración"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        # Verificar que el plantel tenga un responsable asignado
        if not campus.responsable_id:
            return jsonify({
                'error': 'El plantel debe tener un responsable asignado antes de activarse'
            }), 400
        
        # Verificar que la configuración esté completada
        if not campus.configuration_completed:
            return jsonify({
                'error': 'Debe completar la configuración del plantel antes de activarlo'
            }), 400
        
        # Verificar que el plantel no esté ya activo
        if campus.is_active:
            return jsonify({
                'error': 'El plantel ya está activo'
            }), 400
        
        # Activar el plantel
        campus.is_active = True
        campus.activation_status = 'active'
        campus.activated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Plantel activado exitosamente',
            'campus': campus.to_dict(include_config=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/configure', methods=['POST'])
@jwt_required()
@coordinator_required
def configure_campus(campus_id):
    """Configurar un plantel (paso 2 del proceso de activación)"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        # Verificar que el plantel tenga un responsable asignado
        if not campus.responsable_id:
            return jsonify({
                'error': 'El plantel debe tener un responsable asignado antes de configurarse'
            }), 400
        
        data = request.get_json()
        
        # Versión de Office
        if 'office_version' in data:
            valid_versions = ['office_2016', 'office_2019', 'office_365']
            if data['office_version'] not in valid_versions:
                return jsonify({'error': f'Versión de Office inválida. Opciones: {", ".join(valid_versions)}'}), 400
            campus.office_version = data['office_version']
        
        # Tiers de certificación
        if 'enable_tier_basic' in data:
            campus.enable_tier_basic = bool(data['enable_tier_basic'])
        if 'enable_tier_standard' in data:
            campus.enable_tier_standard = bool(data['enable_tier_standard'])
        if 'enable_tier_advanced' in data:
            campus.enable_tier_advanced = bool(data['enable_tier_advanced'])
        if 'enable_digital_badge' in data:
            campus.enable_digital_badge = bool(data['enable_digital_badge'])
        
        # Evaluaciones parciales
        if 'enable_partial_evaluations' in data:
            campus.enable_partial_evaluations = bool(data['enable_partial_evaluations'])
        if 'enable_unscheduled_partials' in data:
            campus.enable_unscheduled_partials = bool(data['enable_unscheduled_partials'])
        
        # Máquinas virtuales
        if 'enable_virtual_machines' in data:
            campus.enable_virtual_machines = bool(data['enable_virtual_machines'])
        
        # Pagos en línea
        if 'enable_online_payments' in data:
            campus.enable_online_payments = bool(data['enable_online_payments'])
        
        # Vigencia del plantel
        if 'license_start_date' in data:
            if data['license_start_date']:
                campus.license_start_date = datetime.strptime(data['license_start_date'], '%Y-%m-%d').date()
            else:
                campus.license_start_date = None
                
        if 'license_end_date' in data:
            if data['license_end_date']:
                campus.license_end_date = datetime.strptime(data['license_end_date'], '%Y-%m-%d').date()
            else:
                campus.license_end_date = None
        
        # Costos
        if 'certification_cost' in data:
            campus.certification_cost = float(data['certification_cost']) if data['certification_cost'] else 0
        if 'retake_cost' in data:
            campus.retake_cost = float(data['retake_cost']) if data['retake_cost'] else 0
        
        # ECM (Estándares de Competencia) asignados al plantel
        if 'competency_standard_ids' in data:
            from app.models.partner import CampusCompetencyStandard
            from app.models.competency_standard import CompetencyStandard
            
            standard_ids = data['competency_standard_ids']
            if not isinstance(standard_ids, list):
                return jsonify({'error': 'competency_standard_ids debe ser una lista'}), 400
            
            # Validar que todos los IDs existan y estén activos
            for std_id in standard_ids:
                standard = CompetencyStandard.query.get(std_id)
                if not standard:
                    return jsonify({'error': f'Estándar de competencia con ID {std_id} no encontrado'}), 404
                if not standard.is_active:
                    return jsonify({'error': f'El estándar {standard.code} no está activo'}), 400
            
            # Eliminar asignaciones existentes y crear nuevas
            CampusCompetencyStandard.query.filter_by(campus_id=campus_id).delete()
            for std_id in standard_ids:
                new_assignment = CampusCompetencyStandard(
                    campus_id=campus_id,
                    competency_standard_id=std_id
                )
                db.session.add(new_assignment)
        
        # Marcar configuración como completada si se proporciona el flag
        if data.get('complete_configuration'):
            from app.models.partner import CampusCompetencyStandard
            
            # Validar que se hayan configurado los campos requeridos
            if not campus.license_start_date:
                return jsonify({'error': 'Debe establecer la fecha de inicio de vigencia del plantel'}), 400
            
            if campus.license_end_date and campus.license_end_date <= campus.license_start_date:
                return jsonify({'error': 'La fecha de fin debe ser posterior a la fecha de inicio'}), 400
            
            # Al menos un tier debe estar habilitado
            if not (campus.enable_tier_basic or campus.enable_tier_standard or campus.enable_tier_advanced or campus.enable_digital_badge):
                return jsonify({'error': 'Debe habilitar al menos un tipo de certificación'}), 400
            
            # Al menos un ECM debe estar asignado
            ecm_count = CampusCompetencyStandard.query.filter_by(campus_id=campus_id).count()
            if ecm_count == 0:
                return jsonify({'error': 'Debe asignar al menos un Estándar de Competencia (ECM) al plantel'}), 400
            
            campus.configuration_completed = True
            campus.configuration_completed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Configuración guardada exitosamente',
            'campus': campus.to_dict(include_config=True, include_responsable=True)
        })
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': f'Error en formato de datos: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/config', methods=['GET'])
@jwt_required()
@coordinator_required
def get_campus_config(campus_id):
    """Obtener la configuración de un plantel"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        return jsonify({
            'campus_id': campus.id,
            'campus_name': campus.name,
            'configuration': {
                'office_version': campus.office_version or 'office_365',
                'enable_tier_basic': campus.enable_tier_basic if campus.enable_tier_basic is not None else True,
                'enable_tier_standard': campus.enable_tier_standard or False,
                'enable_tier_advanced': campus.enable_tier_advanced or False,
                'enable_digital_badge': campus.enable_digital_badge or False,
                'enable_partial_evaluations': campus.enable_partial_evaluations or False,
                'enable_unscheduled_partials': campus.enable_unscheduled_partials or False,
                'enable_virtual_machines': campus.enable_virtual_machines or False,
                'enable_online_payments': campus.enable_online_payments or False,
                'license_start_date': campus.license_start_date.isoformat() if campus.license_start_date else None,
                'license_end_date': campus.license_end_date.isoformat() if campus.license_end_date else None,
                'certification_cost': float(campus.certification_cost) if campus.certification_cost else 0,
                'retake_cost': float(campus.retake_cost) if campus.retake_cost else 0,
                'configuration_completed': campus.configuration_completed or False,
                'configuration_completed_at': campus.configuration_completed_at.isoformat() if campus.configuration_completed_at else None,
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/deactivate', methods=['POST'])
@jwt_required()
@coordinator_required
def deactivate_campus(campus_id):
    """Desactivar un plantel (para pruebas - requiere volver a activar)"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        # Desactivar el plantel y resetear configuración
        campus.is_active = False
        campus.activation_status = 'pending'
        campus.activated_at = None
        campus.configuration_completed = False
        campus.configuration_completed_at = None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Plantel desactivado. Debe completar el proceso de activación nuevamente.',
            'campus': campus.to_dict(include_config=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== ECM DEL PLANTEL (Estándares de Competencia) ==============

@bp.route('/campuses/<int:campus_id>/competency-standards', methods=['GET'])
@jwt_required()
@coordinator_required
def get_campus_competency_standards(campus_id):
    """Obtener los ECM asignados a un plantel"""
    try:
        from app.models.partner import CampusCompetencyStandard
        from app.models.competency_standard import CompetencyStandard
        
        campus = Campus.query.get_or_404(campus_id)
        
        # Obtener los ECM asignados al plantel
        campus_standards = CampusCompetencyStandard.query.filter_by(campus_id=campus_id).all()
        
        standards_data = []
        for cs in campus_standards:
            standard = CompetencyStandard.query.get(cs.competency_standard_id)
            if standard:
                standards_data.append({
                    'id': cs.id,
                    'competency_standard_id': standard.id,
                    'code': standard.code,
                    'name': standard.name,
                    'sector': standard.sector,
                    'is_active': standard.is_active,
                    'assigned_at': cs.created_at.isoformat() if cs.created_at else None
                })
        
        return jsonify({
            'campus_id': campus_id,
            'campus_name': campus.name,
            'competency_standards': standards_data,
            'total': len(standards_data)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/competency-standards', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_campus_competency_standards(campus_id):
    """Actualizar los ECM asignados a un plantel (reemplaza todos)"""
    try:
        from app.models.partner import CampusCompetencyStandard
        from app.models.competency_standard import CompetencyStandard
        
        campus = Campus.query.get_or_404(campus_id)
        data = request.get_json()
        
        # Lista de IDs de competency_standards a asignar
        standard_ids = data.get('competency_standard_ids', [])
        
        if not isinstance(standard_ids, list):
            return jsonify({'error': 'competency_standard_ids debe ser una lista'}), 400
        
        # Validar que todos los IDs existan
        for std_id in standard_ids:
            standard = CompetencyStandard.query.get(std_id)
            if not standard:
                return jsonify({'error': f'Estándar de competencia con ID {std_id} no encontrado'}), 404
            if not standard.is_active:
                return jsonify({'error': f'El estándar {standard.code} no está activo'}), 400
        
        # Eliminar asignaciones existentes
        CampusCompetencyStandard.query.filter_by(campus_id=campus_id).delete()
        
        # Crear nuevas asignaciones
        for std_id in standard_ids:
            new_assignment = CampusCompetencyStandard(
                campus_id=campus_id,
                competency_standard_id=std_id
            )
            db.session.add(new_assignment)
        
        db.session.commit()
        
        # Obtener datos actualizados
        campus_standards = CampusCompetencyStandard.query.filter_by(campus_id=campus_id).all()
        standards_data = []
        for cs in campus_standards:
            standard = CompetencyStandard.query.get(cs.competency_standard_id)
            if standard:
                standards_data.append({
                    'id': cs.id,
                    'competency_standard_id': standard.id,
                    'code': standard.code,
                    'name': standard.name,
                    'sector': standard.sector,
                    'is_active': standard.is_active,
                    'assigned_at': cs.created_at.isoformat() if cs.created_at else None
                })
        
        return jsonify({
            'message': f'{len(standard_ids)} estándar(es) de competencia asignado(s) al plantel',
            'campus_id': campus_id,
            'competency_standards': standards_data,
            'total': len(standards_data)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/competency-standards/available', methods=['GET'])
@jwt_required()
@coordinator_required
def get_available_competency_standards():
    """Obtener lista de todos los ECM activos disponibles para asignar"""
    try:
        from app.models.competency_standard import CompetencyStandard
        
        standards = CompetencyStandard.query.filter_by(is_active=True).order_by(CompetencyStandard.code).all()
        
        return jsonify({
            'competency_standards': [
                {
                    'id': s.id,
                    'code': s.code,
                    'name': s.name,
                    'sector': s.sector,
                    'level': s.level
                }
                for s in standards
            ],
            'total': len(standards)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== CICLOS ESCOLARES ==============

@bp.route('/campuses/<int:campus_id>/cycles', methods=['GET'])
@jwt_required()
@coordinator_required
def get_school_cycles(campus_id):
    """Listar ciclos escolares de un plantel"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        
        query = campus.school_cycles
        if active_only:
            query = query.filter_by(is_active=True)
        
        cycles = query.order_by(SchoolCycle.start_date.desc()).all()
        
        return jsonify({
            'cycles': [c.to_dict(include_groups=True) for c in cycles],
            'total': len(cycles)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/campuses/<int:campus_id>/cycles', methods=['POST'])
@jwt_required()
@coordinator_required
def create_school_cycle(campus_id):
    """Crear un nuevo ciclo escolar"""
    try:
        campus = Campus.query.get_or_404(campus_id)
        
        # Verificar que el plantel esté activo
        if not campus.is_active:
            return jsonify({
                'error': 'No se pueden crear ciclos escolares en un plantel inactivo',
                'message': 'El plantel debe completar el proceso de activación antes de crear ciclos escolares',
                'activation_status': campus.activation_status
            }), 400
        
        data = request.get_json()
        
        # Validaciones
        if not data.get('name'):
            return jsonify({'error': 'El nombre del ciclo es requerido'}), 400
        if not data.get('cycle_type') or data['cycle_type'] not in ['annual', 'semester']:
            return jsonify({'error': 'El tipo de ciclo debe ser "annual" o "semester"'}), 400
        if not data.get('start_date') or not data.get('end_date'):
            return jsonify({'error': 'Las fechas de inicio y fin son requeridas'}), 400
        
        from datetime import datetime
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        
        if end_date <= start_date:
            return jsonify({'error': 'La fecha de fin debe ser posterior a la fecha de inicio'}), 400
        
        # Si se marca como ciclo actual, desmarcar los demás
        if data.get('is_current', False):
            campus.school_cycles.filter_by(is_current=True).update({'is_current': False})
        
        cycle = SchoolCycle(
            campus_id=campus_id,
            name=data['name'],
            cycle_type=data['cycle_type'],
            start_date=start_date,
            end_date=end_date,
            is_current=data.get('is_current', False)
        )
        
        db.session.add(cycle)
        db.session.commit()
        
        return jsonify({
            'message': 'Ciclo escolar creado exitosamente',
            'cycle': cycle.to_dict()
        }), 201
        
    except ValueError as ve:
        return jsonify({'error': f'Formato de fecha inválido: {str(ve)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/cycles/<int:cycle_id>', methods=['GET'])
@jwt_required()
@coordinator_required
def get_school_cycle(cycle_id):
    """Obtener detalle de un ciclo escolar"""
    try:
        cycle = SchoolCycle.query.get_or_404(cycle_id)
        return jsonify({
            'cycle': cycle.to_dict(include_groups=True, include_campus=True)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/cycles/<int:cycle_id>', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_school_cycle(cycle_id):
    """Actualizar un ciclo escolar"""
    try:
        cycle = SchoolCycle.query.get_or_404(cycle_id)
        data = request.get_json()
        
        if 'name' in data:
            cycle.name = data['name']
        if 'cycle_type' in data:
            if data['cycle_type'] not in ['annual', 'semester']:
                return jsonify({'error': 'El tipo de ciclo debe ser "annual" o "semester"'}), 400
            cycle.cycle_type = data['cycle_type']
        
        if 'start_date' in data:
            from datetime import datetime
            cycle.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            from datetime import datetime
            cycle.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        
        if 'is_active' in data:
            cycle.is_active = data['is_active']
        
        # Si se marca como ciclo actual, desmarcar los demás del mismo campus
        if data.get('is_current', False) and not cycle.is_current:
            SchoolCycle.query.filter_by(campus_id=cycle.campus_id, is_current=True).update({'is_current': False})
            cycle.is_current = True
        elif 'is_current' in data:
            cycle.is_current = data['is_current']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Ciclo escolar actualizado exitosamente',
            'cycle': cycle.to_dict()
        })
        
    except ValueError as ve:
        return jsonify({'error': f'Formato de fecha inválido: {str(ve)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/cycles/<int:cycle_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def delete_school_cycle(cycle_id):
    """Eliminar un ciclo escolar (soft delete)"""
    try:
        cycle = SchoolCycle.query.get_or_404(cycle_id)
        cycle.is_active = False
        cycle.is_current = False
        db.session.commit()
        
        return jsonify({'message': 'Ciclo escolar desactivado exitosamente'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/cycles/<int:cycle_id>/permanent-delete', methods=['DELETE'])
@jwt_required()
def permanent_delete_cycle(cycle_id):
    """
    Eliminar permanentemente un ciclo escolar (SOLO ADMINISTRADOR)
    Elimina:
    - El ciclo escolar
    - Los grupos del ciclo
    - Los miembros de grupos (GroupMember)
    - Los exámenes asignados a grupos (GroupExam) y sus miembros específicos
    - Los materiales de estudio asignados a grupos (GroupStudyMaterial) y sus miembros específicos
    
    NO elimina y permanece intacto:
    - Los usuarios (candidatos) - solo se elimina su membresía en grupos
    - Los vouchers ya asignados - las certificaciones permanecen
    - Los resultados de exámenes
    """
    from app.models.partner import GroupStudyMaterial, GroupStudyMaterialMember, GroupExamMember
    
    try:
        # Verificar que el usuario sea admin
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Acceso denegado. Solo administradores pueden eliminar ciclos permanentemente'}), 403
        
        cycle = SchoolCycle.query.get_or_404(cycle_id)
        cycle_name = cycle.name
        campus_id = cycle.campus_id
        
        # Contadores para el resumen
        stats = {
            'groups_deleted': 0,
            'members_removed': 0,
            'exams_unassigned': 0,
            'materials_unassigned': 0,
        }
        
        # 1. Obtener todos los grupos del ciclo
        groups = CandidateGroup.query.filter_by(school_cycle_id=cycle_id).all()
        
        for group in groups:
            # Contar miembros que se eliminarán
            members_count = GroupMember.query.filter_by(group_id=group.id).count()
            stats['members_removed'] += members_count
            
            # Obtener exámenes asignados y eliminar sus miembros específicos primero
            group_exams = GroupExam.query.filter_by(group_id=group.id).all()
            for ge in group_exams:
                GroupExamMember.query.filter_by(group_exam_id=ge.id).delete()
            stats['exams_unassigned'] += len(group_exams)
            
            # Obtener materiales asignados y eliminar sus miembros específicos primero
            group_materials = GroupStudyMaterial.query.filter_by(group_id=group.id).all()
            for gm in group_materials:
                GroupStudyMaterialMember.query.filter_by(group_study_material_id=gm.id).delete()
            stats['materials_unassigned'] += len(group_materials)
            
            # Eliminar miembros de grupo (los usuarios NO se eliminan, solo la membresía)
            GroupMember.query.filter_by(group_id=group.id).delete()
            
            # Eliminar asignaciones de exámenes a grupos
            GroupExam.query.filter_by(group_id=group.id).delete()
            
            # Eliminar asignaciones de materiales a grupos
            GroupStudyMaterial.query.filter_by(group_id=group.id).delete()
            
            stats['groups_deleted'] += 1
        
        # 2. Eliminar grupos del ciclo
        CandidateGroup.query.filter_by(school_cycle_id=cycle_id).delete()
        
        # 3. Eliminar el ciclo
        db.session.delete(cycle)
        db.session.commit()
        
        return jsonify({
            'message': f'Ciclo escolar "{cycle_name}" eliminado permanentemente',
            'cycle_name': cycle_name,
            'stats': stats
        })
        
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
        cycle_id = request.args.get('cycle_id', type=int)
        
        query = CandidateGroup.query.filter_by(campus_id=campus_id)
        
        if active_only:
            query = query.filter(CandidateGroup.is_active == True)
        
        # Filtrar por ciclo escolar si se proporciona
        if cycle_id:
            query = query.filter(CandidateGroup.school_cycle_id == cycle_id)
        
        groups = query.order_by(CandidateGroup.name).all()
        
        return jsonify({
            'campus_id': campus_id,
            'campus_name': campus.name,
            'groups': [g.to_dict(include_members=True, include_cycle=True) for g in groups],
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
        
        # Validar el ciclo escolar si se proporciona
        school_cycle_id = data.get('school_cycle_id')
        if school_cycle_id:
            cycle = SchoolCycle.query.get(school_cycle_id)
            if not cycle or cycle.campus_id != campus_id:
                return jsonify({'error': 'Ciclo escolar no válido para este plantel'}), 400
        
        group = CandidateGroup(
            campus_id=campus_id,
            school_cycle_id=school_cycle_id,
            name=data['name'],
            code=data.get('code'),
            description=data.get('description'),
            start_date=data.get('start_date'),
            end_date=data.get('end_date'),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(group)
        db.session.commit()
        
        return jsonify({
            'message': 'Grupo creado exitosamente',
            'group': group.to_dict(include_cycle=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ======================================================================
# IMPORTANTE: Esta ruta debe ir ANTES de /groups/<int:group_id>
# para evitar que Flask intente interpretar 'list-all' como un int
# ======================================================================
@bp.route('/groups/list-all', methods=['GET'])
@jwt_required()
@coordinator_required
def list_all_groups():
    """Listar todos los grupos para selectores (sin paginación, info mínima)"""
    try:
        groups = CandidateGroup.query.filter_by(is_active=True).order_by(CandidateGroup.name).all()
        
        result = []
        for group in groups:
            campus = group.campus
            partner = campus.partner if campus else None
            member_count = GroupMember.query.filter_by(group_id=group.id, status='active').count()
            
            result.append({
                'id': group.id,
                'name': group.name,
                'campus_name': campus.name if campus else None,
                'partner_name': partner.name if partner else None,
                'current_members': member_count
            })
        
        return jsonify({
            'groups': result,
            'total': len(result)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group(group_id):
    """Obtener detalle de un grupo"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        return jsonify({
            'group': group.to_dict(include_members=True, include_campus=True, include_cycle=True, include_config=True)
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
        
        # Validar el ciclo escolar si se proporciona
        if 'school_cycle_id' in data:
            school_cycle_id = data['school_cycle_id']
            if school_cycle_id:
                cycle = SchoolCycle.query.get(school_cycle_id)
                if not cycle or cycle.campus_id != group.campus_id:
                    return jsonify({'error': 'Ciclo escolar no válido para este plantel'}), 400
            group.school_cycle_id = school_cycle_id
        
        # Actualizar campos
        for field in ['name', 'code', 'description', 'start_date', 'end_date', 'is_active']:
            if field in data:
                setattr(group, field, data[field])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Grupo actualizado exitosamente',
            'group': group.to_dict(include_cycle=True)
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


# ============== CONFIGURACIÓN DE GRUPO ==============

@bp.route('/groups/<int:group_id>/config', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group_config(group_id):
    """Obtener configuración del grupo con valores heredados del campus"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        campus = group.campus
        
        if not campus:
            return jsonify({'error': 'Campus no encontrado'}), 404
        
        # Configuración del campus (base)
        campus_config = {
            'office_version': campus.office_version,
            'enable_tier_basic': campus.enable_tier_basic,
            'enable_tier_standard': campus.enable_tier_standard,
            'enable_tier_advanced': campus.enable_tier_advanced,
            'enable_digital_badge': campus.enable_digital_badge,
            'enable_partial_evaluations': campus.enable_partial_evaluations,
            'enable_unscheduled_partials': campus.enable_unscheduled_partials,
            'enable_virtual_machines': campus.enable_virtual_machines,
            'enable_online_payments': campus.enable_online_payments,
            'certification_cost': float(campus.certification_cost) if campus.certification_cost else 0,
            'retake_cost': float(campus.retake_cost) if campus.retake_cost else 0,
            'license_start_date': campus.license_start_date.isoformat() if campus.license_start_date else None,
            'license_end_date': campus.license_end_date.isoformat() if campus.license_end_date else None,
        }
        
        # Overrides del grupo
        group_overrides = {
            'office_version_override': group.office_version_override,
            'enable_tier_basic_override': group.enable_tier_basic_override,
            'enable_tier_standard_override': group.enable_tier_standard_override,
            'enable_tier_advanced_override': group.enable_tier_advanced_override,
            'enable_digital_badge_override': group.enable_digital_badge_override,
            'enable_partial_evaluations_override': group.enable_partial_evaluations_override,
            'enable_unscheduled_partials_override': group.enable_unscheduled_partials_override,
            'enable_virtual_machines_override': group.enable_virtual_machines_override,
            'enable_online_payments_override': group.enable_online_payments_override,
            'certification_cost_override': float(group.certification_cost_override) if group.certification_cost_override is not None else None,
            'retake_cost_override': float(group.retake_cost_override) if group.retake_cost_override is not None else None,
            'group_start_date': group.group_start_date.isoformat() if group.group_start_date else None,
            'group_end_date': group.group_end_date.isoformat() if group.group_end_date else None,
        }
        
        # Configuración efectiva (combinando campus y grupo)
        effective_config = {
            'office_version': group.office_version_override or campus.office_version,
            'enable_tier_basic': group.enable_tier_basic_override if group.enable_tier_basic_override is not None else campus.enable_tier_basic,
            'enable_tier_standard': group.enable_tier_standard_override if group.enable_tier_standard_override is not None else campus.enable_tier_standard,
            'enable_tier_advanced': group.enable_tier_advanced_override if group.enable_tier_advanced_override is not None else campus.enable_tier_advanced,
            'enable_digital_badge': group.enable_digital_badge_override if group.enable_digital_badge_override is not None else campus.enable_digital_badge,
            'enable_partial_evaluations': group.enable_partial_evaluations_override if group.enable_partial_evaluations_override is not None else campus.enable_partial_evaluations,
            'enable_unscheduled_partials': group.enable_unscheduled_partials_override if group.enable_unscheduled_partials_override is not None else campus.enable_unscheduled_partials,
            'enable_virtual_machines': group.enable_virtual_machines_override if group.enable_virtual_machines_override is not None else campus.enable_virtual_machines,
            'enable_online_payments': group.enable_online_payments_override if group.enable_online_payments_override is not None else campus.enable_online_payments,
            'certification_cost': float(group.certification_cost_override) if group.certification_cost_override is not None else (float(campus.certification_cost) if campus.certification_cost else 0),
            'retake_cost': float(group.retake_cost_override) if group.retake_cost_override is not None else (float(campus.retake_cost) if campus.retake_cost else 0),
            'start_date': group.group_start_date.isoformat() if group.group_start_date else (campus.license_start_date.isoformat() if campus.license_start_date else None),
            'end_date': group.group_end_date.isoformat() if group.group_end_date else (campus.license_end_date.isoformat() if campus.license_end_date else None),
        }
        
        # Obtener conteo de candidatos sin CURP/email para advertencias
        # Solo si el grupo tiene habilitados conocer_certificate o digital_badge
        members_without_curp = []
        members_without_email = []
        
        conocer_enabled = effective_config.get('enable_tier_advanced', False)
        badge_enabled = effective_config.get('enable_digital_badge', False)
        
        if conocer_enabled or badge_enabled:
            # Obtener miembros del grupo con sus usuarios
            members = GroupMember.query.filter_by(group_id=group_id, status='active').all()
            for member in members:
                if member.user:
                    if conocer_enabled and not member.user.curp:
                        members_without_curp.append({
                            'id': member.user_id,
                            'name': member.user.full_name if hasattr(member.user, 'full_name') else f"{member.user.name} {member.user.first_surname}"
                        })
                    if badge_enabled and not member.user.email:
                        members_without_email.append({
                            'id': member.user_id,
                            'name': member.user.full_name if hasattr(member.user, 'full_name') else f"{member.user.name} {member.user.first_surname}"
                        })
        
        # Advertencias para el responsable
        warnings = []
        if conocer_enabled and members_without_curp:
            warnings.append({
                'type': 'curp_required_for_conocer',
                'message': f'{len(members_without_curp)} candidato(s) sin CURP no podrán recibir certificado CONOCER',
                'affected_members': members_without_curp
            })
        if badge_enabled and members_without_email:
            warnings.append({
                'type': 'email_required_for_badge',
                'message': f'{len(members_without_email)} candidato(s) sin email no podrán recibir insignia digital',
                'affected_members': members_without_email
            })
        
        return jsonify({
            'group_id': group.id,
            'group_name': group.name,
            'campus_id': campus.id,
            'campus_name': campus.name,
            'use_custom_config': group.use_custom_config or False,
            'campus_config': campus_config,
            'group_overrides': group_overrides,
            'effective_config': effective_config,
            'warnings': warnings
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/config', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_group_config(group_id):
    """Actualizar configuración del grupo (overrides)"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        data = request.get_json()
        
        # Campos booleanos de override
        bool_fields = [
            'enable_tier_basic_override',
            'enable_tier_standard_override',
            'enable_tier_advanced_override',
            'enable_digital_badge_override',
            'enable_partial_evaluations_override',
            'enable_unscheduled_partials_override',
            'enable_virtual_machines_override',
            'enable_online_payments_override',
        ]
        
        for field in bool_fields:
            if field in data:
                setattr(group, field, data[field])
        
        # Campo de versión de office
        if 'office_version_override' in data:
            group.office_version_override = data['office_version_override']
        
        # Campos de costos
        if 'certification_cost_override' in data:
            group.certification_cost_override = data['certification_cost_override']
        if 'retake_cost_override' in data:
            group.retake_cost_override = data['retake_cost_override']
        
        # Fechas del grupo
        if 'group_start_date' in data:
            group.group_start_date = data['group_start_date'] if data['group_start_date'] else None
        if 'group_end_date' in data:
            group.group_end_date = data['group_end_date'] if data['group_end_date'] else None
        
        # Flag de configuración personalizada
        if 'use_custom_config' in data:
            group.use_custom_config = data['use_custom_config']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Configuración del grupo actualizada',
            'group': group.to_dict(include_config=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/config/reset', methods=['POST'])
@jwt_required()
@coordinator_required
def reset_group_config(group_id):
    """Resetear configuración del grupo a valores del campus"""
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        
        # Limpiar todos los overrides
        group.use_custom_config = False
        group.office_version_override = None
        group.enable_tier_basic_override = None
        group.enable_tier_standard_override = None
        group.enable_tier_advanced_override = None
        group.enable_digital_badge_override = None
        group.enable_partial_evaluations_override = None
        group.enable_unscheduled_partials_override = None
        group.enable_virtual_machines_override = None
        group.enable_online_payments_override = None
        group.certification_cost_override = None
        group.retake_cost_override = None
        group.group_start_date = None
        group.group_end_date = None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Configuración del grupo restablecida a valores del campus',
            'group': group.to_dict(include_config=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== MIEMBROS DE GRUPO ==============

@bp.route('/groups/<int:group_id>/members', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group_members(group_id):
    """Listar miembros de un grupo con info de asignaciones"""
    try:
        from sqlalchemy import text
        
        group = CandidateGroup.query.get_or_404(group_id)
        
        status_filter = request.args.get('status')
        
        query = GroupMember.query.filter_by(group_id=group_id)
        
        if status_filter:
            query = query.filter(GroupMember.status == status_filter)
        
        members = query.all()
        
        # Obtener exámenes asignados al grupo
        group_exams = GroupExam.query.filter_by(group_id=group_id, is_active=True).all()
        group_exam_ids = [ge.id for ge in group_exams]
        
        # Obtener asignaciones de exámenes a usuarios específicos (user_id)
        exam_user_assignments = {}
        if group_exam_ids:
            result = db.session.execute(text("""
                SELECT gem.user_id, gem.group_exam_id
                FROM group_exam_members gem
                WHERE gem.group_exam_id IN :exam_ids
            """), {'exam_ids': tuple(group_exam_ids) if group_exam_ids else (0,)})
            for row in result:
                if row[0] not in exam_user_assignments:
                    exam_user_assignments[row[0]] = set()
                exam_user_assignments[row[0]].add(row[1])
        
        # Para saber si examen está asignado a todos o a miembros específicos
        exams_for_all = [ge.id for ge in group_exams if ge.assignment_type == 'all']
        
        # Obtener materiales asignados directamente al grupo
        materials_result = db.session.execute(text("""
            SELECT gsm.id, gsm.assignment_type
            FROM group_study_materials gsm
            WHERE gsm.group_id = :group_id AND gsm.is_active = 1
        """), {'group_id': group_id})
        
        group_materials = []
        materials_for_all_ids = []
        for row in materials_result:
            group_materials.append({'id': row[0], 'assignment_type': row[1]})
            if row[1] == 'all':
                materials_for_all_ids.append(row[0])
        
        group_material_ids = [m['id'] for m in group_materials]
        
        # Obtener asignaciones de materiales a usuarios específicos
        material_user_assignments = {}
        if group_material_ids:
            mat_result = db.session.execute(text("""
                SELECT gsmm.user_id, gsmm.group_study_material_id
                FROM group_study_material_members gsmm
                WHERE gsmm.group_study_material_id IN :mat_ids
            """), {'mat_ids': tuple(group_material_ids) if group_material_ids else (0,)})
            for row in mat_result:
                if row[0] not in material_user_assignments:
                    material_user_assignments[row[0]] = set()
                material_user_assignments[row[0]].add(row[1])
        
        # Obtener exámenes que tienen materiales incluidos (GroupExamMaterial)
        exams_with_materials = set()
        if group_exam_ids:
            exam_mat_result = db.session.execute(text("""
                SELECT DISTINCT gem.group_exam_id
                FROM group_exam_materials gem
                WHERE gem.group_exam_id IN :exam_ids
            """), {'exam_ids': tuple(group_exam_ids) if group_exam_ids else (0,)})
            exams_with_materials = {row[0] for row in exam_mat_result}
        
        # Obtener los exam_id reales de los group_exams para buscar resultados
        group_exam_to_exam_id = {ge.id: ge.exam_id for ge in group_exams}
        real_exam_ids = [ge.exam_id for ge in group_exams]
        
        # Obtener resultados de exámenes para todos los miembros
        user_ids = [m.user_id for m in members]
        certification_status_map = {}
        if user_ids and real_exam_ids:
            from app.models.result import Result
            results = Result.query.filter(
                Result.user_id.in_(user_ids),
                Result.exam_id.in_(real_exam_ids)
            ).all()
            
            for r in results:
                if r.user_id not in certification_status_map:
                    certification_status_map[r.user_id] = {'status': 0, 'result': 0}
                
                # Priorizar: aprobado > en proceso > reprobado
                current = certification_status_map[r.user_id]
                if r.result == 1 and r.status == 1:  # Aprobado y completado
                    current['status'] = 1
                    current['result'] = 1
                elif r.status == 0 and current['result'] != 1:  # En proceso (solo si no ha aprobado)
                    current['status'] = 0
                    current['result'] = 0
                elif r.status == 1 and r.result == 0 and current['status'] != 0 and current['result'] != 1:  # Reprobado
                    current['status'] = 1
                    current['result'] = 0
        
        # Construir respuesta con asignaciones
        members_data = []
        for m in members:
            member_dict = m.to_dict(include_user=True)
            
            # Determinar si tiene examen asignado (por user_id)
            user_exam_ids = set()
            if len(exams_for_all) > 0:
                user_exam_ids.update(exams_for_all)
            if m.user_id in exam_user_assignments:
                user_exam_ids.update(exam_user_assignments[m.user_id])
            
            has_exam = len(user_exam_ids) > 0
            
            # Verificar si algún examen del usuario tiene materiales incluidos
            has_material_from_exam = bool(user_exam_ids & exams_with_materials)
            
            # Determinar si tiene material asignado directamente (por user_id)
            has_direct_material = (
                len(materials_for_all_ids) > 0 or  # Hay materiales para todos
                m.user_id in material_user_assignments  # Tiene asignación específica por user_id
            )
            
            # El usuario tiene material si tiene material directo O material incluido en examen
            has_material = has_direct_material or has_material_from_exam
            
            # Calcular estado de asignación
            if has_exam and has_material:
                assignment_status = 'exam_and_material'
            elif has_exam:
                assignment_status = 'exam_only'
            elif has_material:
                assignment_status = 'material_only'
            else:
                assignment_status = 'none'
            
            member_dict['assignment_status'] = assignment_status
            member_dict['has_exam'] = has_exam
            member_dict['has_material'] = has_material
            
            # Agregar estatus de certificación
            cert_info = certification_status_map.get(m.user_id, None)
            if cert_info:
                if cert_info['result'] == 1 and cert_info['status'] == 1:
                    member_dict['certification_status'] = 'certified'  # Aprobado/Certificado
                elif cert_info['status'] == 0:
                    member_dict['certification_status'] = 'in_progress'  # En proceso
                else:
                    member_dict['certification_status'] = 'failed'  # Reprobado
            else:
                member_dict['certification_status'] = 'pending'  # Sin intentos
            
            # ========== ELEGIBILIDAD POR MIEMBRO ==========
            user = m.user
            has_curp = bool(user.curp) if user else False
            has_email = bool(user.email) if user else False
            
            member_dict['eligibility'] = {
                'has_curp': has_curp,
                'has_email': has_email,
                'can_receive_eduit': True,  # Siempre disponible
                'can_receive_certificate': True,  # Siempre disponible
                'can_receive_conocer': has_curp,  # Requiere CURP
                'can_receive_badge': has_email,  # Requiere email
            }
            
            members_data.append(member_dict)
        
        # ========== OBTENER CONFIGURACIÓN DEL GRUPO/CAMPUS ==========
        campus = group.campus
        
        # Determinar si CONOCER e insignia digital están habilitados
        conocer_enabled = False
        badge_enabled = False
        
        if campus:
            if group.use_custom_config and group.enable_tier_advanced_override is not None:
                conocer_enabled = group.enable_tier_advanced_override
            else:
                conocer_enabled = campus.enable_tier_advanced or False
            
            if group.use_custom_config and group.enable_digital_badge_override is not None:
                badge_enabled = group.enable_digital_badge_override
            else:
                badge_enabled = campus.enable_digital_badge or False
        
        # ========== RESUMEN DE ELEGIBILIDAD ==========
        total_members = len(members)
        members_with_curp = sum(1 for m in members if m.user and m.user.curp)
        members_with_email = sum(1 for m in members if m.user and m.user.email)
        members_without_curp = total_members - members_with_curp
        members_without_email = total_members - members_with_email
        members_fully_eligible = sum(1 for m in members if m.user and m.user.curp and m.user.email)
        
        eligibility_summary = {
            'total_members': total_members,
            'fully_eligible': members_fully_eligible,
            'members_with_curp': members_with_curp,
            'members_with_email': members_with_email,
            'members_without_curp': members_without_curp,
            'members_without_email': members_without_email,
            'conocer_enabled': conocer_enabled,
            'badge_enabled': badge_enabled,
            # Advertencias activas
            'warnings': []
        }
        
        if conocer_enabled and members_without_curp > 0:
            eligibility_summary['warnings'].append({
                'type': 'missing_curp',
                'message': f'{members_without_curp} candidato(s) sin CURP no podrán recibir certificado CONOCER',
                'count': members_without_curp
            })
        
        if badge_enabled and members_without_email > 0:
            eligibility_summary['warnings'].append({
                'type': 'missing_email',
                'message': f'{members_without_email} candidato(s) sin email no podrán recibir insignia digital',
                'count': members_without_email
            })
        
        return jsonify({
            'group_id': group_id,
            'group_name': group.name,
            'members': members_data,
            'total': len(members),
            'eligibility_summary': eligibility_summary
        })
        
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


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
        
        for user_id in user_ids:
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
            if data['status'] not in ['active', 'suspended']:
                return jsonify({'error': 'Estado no válido. Use: active, suspended'}), 400
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
        search_field = request.args.get('search_field', '')  # Campo específico de búsqueda
        exclude_group_id = request.args.get('exclude_group_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = User.query.filter(
            User.role == 'candidato',
            User.is_active == True
        )
        
        if search:
            search_term = f'%{search}%'
            # Si hay un campo específico, buscar solo en ese campo
            if search_field and search_field in ['name', 'first_surname', 'second_surname', 'email', 'curp']:
                field_map = {
                    'name': User.name,
                    'first_surname': User.first_surname,
                    'second_surname': User.second_surname,
                    'email': User.email,
                    'curp': User.curp,
                }
                query = query.filter(field_map[search_field].ilike(search_term))
            else:
                # Búsqueda en todos los campos relevantes
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
            # Obtener información del grupo actual del candidato (si tiene)
            current_membership = GroupMember.query.filter_by(
                user_id=user.id,
                status='active'
            ).first()
            
            group_info = None
            if current_membership and current_membership.group:
                group = current_membership.group
                campus = group.campus
                cycle = group.school_cycle
                partner = campus.partner if campus else None
                
                group_info = {
                    'group_id': group.id,
                    'group_name': group.name,
                    'campus_id': campus.id if campus else None,
                    'campus_name': campus.name if campus else None,
                    'state_name': campus.state_name if campus else None,
                    'city': campus.city if campus else None,
                    'school_cycle_id': cycle.id if cycle else None,
                    'school_cycle_name': cycle.name if cycle else None,
                    'partner_id': partner.id if partner else None,
                    'partner_name': partner.name if partner else None,
                }
            
            candidates.append({
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'first_surname': user.first_surname,
                'second_surname': user.second_surname,
                'full_name': f"{user.name} {user.first_surname} {user.second_surname or ''}".strip(),
                'curp': user.curp,
                'gender': user.gender,
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'current_group': group_info,
            })
        
        return jsonify({
            'candidates': candidates,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== PLANTILLA Y CARGA MASIVA DE ASIGNACIÓN ==============

@bp.route('/groups/members/template', methods=['GET'])
@jwt_required()
@coordinator_required
def download_group_members_template():
    """Descargar plantilla Excel para asignación masiva de candidatos a grupo"""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from io import BytesIO
    
    try:
        wb = Workbook()
        ws = wb.active
        ws.title = "Asignación de Candidatos"
        
        # Estilos
        header_font = Font(bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill(start_color="5B21B6", end_color="5B21B6", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Encabezados
        headers = [
            ("Identificador (Email o CURP)", 40),
            ("Notas (Opcional)", 30),
        ]
        
        for col, (header, width) in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
            ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = width
        
        # Ejemplos
        examples = [
            ("candidato@ejemplo.com", "Alumno nuevo"),
            ("ABCD123456HDFRRR00", ""),
            ("otro@email.com", "Transferido de otro grupo"),
        ]
        
        example_fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
        for row, (identifier, notes) in enumerate(examples, 2):
            ws.cell(row=row, column=1, value=identifier).fill = example_fill
            ws.cell(row=row, column=2, value=notes).fill = example_fill
        
        # Instrucciones en la hoja 2
        ws_help = wb.create_sheet(title="Instrucciones")
        ws_help.column_dimensions['A'].width = 80
        
        instructions = [
            "INSTRUCCIONES PARA ASIGNACIÓN MASIVA DE CANDIDATOS",
            "",
            "1. En la columna 'Identificador' ingrese el email o CURP del candidato.",
            "2. El candidato debe existir previamente en el sistema como usuario activo.",
            "3. El candidato debe tener el rol 'candidato'.",
            "4. Las notas son opcionales y se guardan con la membresía.",
            "5. Si el candidato ya está en el grupo, se omitirá.",
            "6. Elimine las filas de ejemplo antes de subir el archivo.",
            "",
            "IMPORTANTE:",
            "- Solo se pueden asignar candidatos hasta la capacidad máxima del grupo.",
            "- Los candidatos deben estar registrados previamente en el sistema.",
        ]
        
        for row, text in enumerate(instructions, 1):
            cell = ws_help.cell(row=row, column=1, value=text)
            if row == 1:
                cell.font = Font(bold=True, size=14)
            elif text.startswith("IMPORTANTE"):
                cell.font = Font(bold=True, color="DC2626")
        
        # Guardar en memoria
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='plantilla_asignacion_candidatos.xlsx'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/members/upload', methods=['POST'])
@jwt_required()
@coordinator_required
def upload_group_members(group_id):
    """Procesar archivo Excel para asignar candidatos al grupo
    
    Parámetros de form-data:
    - file: Archivo Excel con candidatos
    - mode: 'move' (mover de grupo anterior) o 'add' (agregar, puede estar en múltiples grupos)
    """
    from openpyxl import load_workbook
    
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        
        file = request.files['file']
        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({'error': 'El archivo debe ser Excel (.xlsx o .xls)'}), 400
        
        # Modo de asignación: 'move' o 'add'
        mode = request.form.get('mode', 'add')  # Por defecto 'add' para mantener compatibilidad
        
        # Cargar el archivo Excel
        wb = load_workbook(file)
        ws = wb.active
        
        added = []
        moved = []
        errors = []
        current_count = GroupMember.query.filter_by(group_id=group_id, status='active').count()
        
        # Procesar cada fila (saltando el encabezado)
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            identifier = row[0] if len(row) > 0 else None
            notes = row[1] if len(row) > 1 else None
            
            if not identifier:
                continue
            
            identifier = str(identifier).strip()
            
            # Buscar usuario por email o CURP
            user = User.query.filter(
                db.or_(
                    User.email == identifier,
                    User.curp == identifier.upper()
                ),
                User.role == 'candidato',
                User.is_active == True
            ).first()
            
            if not user:
                errors.append({
                    'identifier': identifier,
                    'error': 'Candidato no encontrado o inactivo'
                })
                continue
            
            # Verificar si ya es miembro de ESTE grupo
            existing_in_target = GroupMember.query.filter_by(group_id=group_id, user_id=user.id).first()
            if existing_in_target:
                if existing_in_target.status == 'active':
                    errors.append({
                        'identifier': identifier,
                        'error': 'Ya es miembro del grupo destino'
                    })
                    continue
                else:
                    # Reactivar membresía existente
                    existing_in_target.status = 'active'
                    existing_in_target.notes = str(notes) if notes else existing_in_target.notes
                    added.append(identifier)
                    current_count += 1
                    continue
            
            # Verificar si está en otro grupo
            existing_other = GroupMember.query.filter(
                GroupMember.user_id == user.id,
                GroupMember.group_id != group_id,
                GroupMember.status == 'active'
            ).first()
            
            if existing_other and mode == 'move':
                # Mover: desactivar membresía anterior
                previous_group_name = existing_other.group.name if existing_other.group else 'Grupo desconocido'
                existing_other.status = 'removed'
                moved.append({
                    'identifier': identifier,
                    'from_group': previous_group_name
                })
            
            # Crear nueva membresía
            member = GroupMember(
                group_id=group_id,
                user_id=user.id,
                status='active',
                notes=str(notes) if notes else None
            )
            db.session.add(member)
            if not (existing_other and mode == 'move'):
                added.append(identifier)
            current_count += 1
        
        db.session.commit()
        
        result_message = f'{len(added)} candidato(s) agregado(s)'
        if moved:
            result_message += f', {len(moved)} movido(s) de otros grupos'
        
        return jsonify({
            'message': result_message,
            'added': added,
            'moved': moved,
            'errors': errors,
            'total_processed': len(added) + len(moved) + len(errors),
            'mode': mode
        }), 201
        
    except Exception as e:
        db.session.rollback()
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


# ============== EXÁMENES ASIGNADOS A GRUPOS ==============

@bp.route('/groups/<int:group_id>/exams', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group_exams(group_id):
    """Listar exámenes asignados a un grupo"""
    try:
        from app.models import GroupExam, Exam
        from app.models.study_content import StudyMaterial
        
        group = CandidateGroup.query.get_or_404(group_id)
        
        group_exams = GroupExam.query.filter_by(group_id=group_id, is_active=True).all()
        
        exams_data = []
        for ge in group_exams:
            exam_data = ge.to_dict(include_exam=True, include_materials=True)
            exams_data.append(exam_data)
        
        return jsonify({
            'group_id': group_id,
            'group_name': group.name,
            'assigned_exams': exams_data,
            'total': len(exams_data)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/exams', methods=['POST'])
@jwt_required()
@coordinator_required
def assign_exam_to_group(group_id):
    """Asignar un examen a un grupo (automáticamente incluye materiales de estudio)
    
    Parámetros:
    - exam_id: ID del examen
    - assignment_type: 'all' (todo el grupo) o 'selected' (candidatos específicos)
    - member_ids: Lista de IDs de usuarios (solo si assignment_type='selected')
    - available_from, available_until: Período de disponibilidad (opcional)
    """
    try:
        from app.models import GroupExam, GroupExamMaterial, Exam
        from app.models.partner import GroupExamMember
        from app.models.study_content import StudyMaterial
        
        group = CandidateGroup.query.get_or_404(group_id)
        data = request.get_json()
        
        exam_id = data.get('exam_id')
        if not exam_id:
            return jsonify({'error': 'El ID del examen es requerido'}), 400
        
        assignment_type = data.get('assignment_type', 'all')
        member_ids = data.get('member_ids', [])
        
        if assignment_type == 'selected' and not member_ids:
            return jsonify({'error': 'Debes seleccionar al menos un candidato'}), 400
        
        # Verificar que el examen existe
        exam = Exam.query.get(exam_id)
        if not exam:
            return jsonify({'error': 'Examen no encontrado'}), 404
        
        # Verificar que no esté ya asignado
        existing = GroupExam.query.filter_by(group_id=group_id, exam_id=exam_id).first()
        if existing:
            if existing.is_active:
                return jsonify({'error': 'Este examen ya está asignado al grupo'}), 400
            else:
                # Reactivar la asignación
                existing.is_active = True
                existing.assigned_at = db.func.now()
                existing.assigned_by_id = g.current_user.id
                existing.assignment_type = assignment_type
                existing.available_from = data.get('available_from')
                existing.available_until = data.get('available_until')
                existing.time_limit_minutes = data.get('time_limit_minutes')
                existing.passing_score = data.get('passing_score')
                existing.max_attempts = data.get('max_attempts', 2)
                existing.max_disconnections = data.get('max_disconnections', 3)
                existing.exam_content_type = data.get('exam_content_type', 'questions_only')
                existing.exam_questions_count = data.get('exam_questions_count')
                existing.exam_exercises_count = data.get('exam_exercises_count')
                existing.simulator_questions_count = data.get('simulator_questions_count')
                existing.simulator_exercises_count = data.get('simulator_exercises_count')
                existing.security_pin = data.get('security_pin')
                existing.require_security_pin = data.get('require_security_pin', False)
                
                # Si es tipo 'selected', agregar miembros
                if assignment_type == 'selected':
                    # Limpiar miembros anteriores
                    GroupExamMember.query.filter_by(group_exam_id=existing.id).delete()
                    
                    for user_id in member_ids:
                        member = GroupExamMember(
                            group_exam_id=existing.id,
                            user_id=user_id
                        )
                        db.session.add(member)
                
                # Si se enviaron materiales personalizados, guardarlos
                material_ids = data.get('material_ids')
                if material_ids is not None:
                    # Limpiar materiales anteriores
                    GroupExamMaterial.query.filter_by(group_exam_id=existing.id).delete()
                    
                    for material_id in material_ids:
                        material = GroupExamMaterial(
                            group_exam_id=existing.id,
                            study_material_id=material_id,
                            is_included=True
                        )
                        db.session.add(material)
                
                db.session.commit()
                
                # Obtener materiales asociados
                materials = StudyMaterial.query.filter_by(exam_id=exam_id, is_published=True).all()
                
                return jsonify({
                    'message': 'Examen reactivado exitosamente',
                    'assignment': existing.to_dict(include_exam=True, include_materials=True, include_members=True),
                    'study_materials_count': len(material_ids) if material_ids else len(materials),
                    'assigned_members_count': len(member_ids) if assignment_type == 'selected' else group.members.count()
                })
        
        # Configuración del examen
        time_limit_minutes = data.get('time_limit_minutes')
        passing_score = data.get('passing_score')
        max_attempts = data.get('max_attempts', 2)
        max_disconnections = data.get('max_disconnections', 3)
        exam_content_type = data.get('exam_content_type', 'questions_only')
        exam_questions_count = data.get('exam_questions_count')
        exam_exercises_count = data.get('exam_exercises_count')
        simulator_questions_count = data.get('simulator_questions_count')
        simulator_exercises_count = data.get('simulator_exercises_count')
        security_pin = data.get('security_pin')
        require_security_pin = data.get('require_security_pin', False)
        material_ids = data.get('material_ids')
        
        # Crear nueva asignación
        group_exam = GroupExam(
            group_id=group_id,
            exam_id=exam_id,
            assigned_by_id=g.current_user.id,
            assignment_type=assignment_type,
            available_from=data.get('available_from'),
            available_until=data.get('available_until'),
            time_limit_minutes=time_limit_minutes,
            passing_score=passing_score,
            max_attempts=max_attempts,
            max_disconnections=max_disconnections,
            exam_content_type=exam_content_type,
            exam_questions_count=exam_questions_count,
            exam_exercises_count=exam_exercises_count,
            simulator_questions_count=simulator_questions_count,
            simulator_exercises_count=simulator_exercises_count,
            security_pin=security_pin,
            require_security_pin=require_security_pin
        )
        
        db.session.add(group_exam)
        db.session.flush()  # Para obtener el ID
        
        # Si es tipo 'selected', agregar miembros específicos
        if assignment_type == 'selected':
            for user_id in member_ids:
                member = GroupExamMember(
                    group_exam_id=group_exam.id,
                    user_id=user_id
                )
                db.session.add(member)
        
        # Si se enviaron materiales personalizados, guardarlos
        if material_ids is not None:
            for material_id in material_ids:
                material = GroupExamMaterial(
                    group_exam_id=group_exam.id,
                    study_material_id=material_id,
                    is_included=True
                )
                db.session.add(material)
        
        db.session.commit()
        
        # Obtener materiales asociados al examen
        materials = StudyMaterial.query.filter_by(exam_id=exam_id, is_published=True).all()
        materials_count = len(material_ids) if material_ids else len(materials)
        
        message = 'Examen asignado exitosamente.'
        if assignment_type == 'all':
            message += f' Disponible para los {group.members.count()} miembros del grupo.'
        else:
            message += f' Disponible para {len(member_ids)} candidato(s) seleccionado(s).'
        
        if materials_count > 0:
            message += f' Con {materials_count} material(es) de estudio.'
        
        return jsonify({
            'message': message,
            'assignment': group_exam.to_dict(include_exam=True, include_materials=True, include_members=True),
            'study_materials_count': materials_count,
            'assigned_members_count': len(member_ids) if assignment_type == 'selected' else group.members.count()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/exams/<int:exam_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def unassign_exam_from_group(group_id, exam_id):
    """Desasignar un examen de un grupo"""
    try:
        from app.models import GroupExam
        
        group_exam = GroupExam.query.filter_by(
            group_id=group_id, 
            exam_id=exam_id
        ).first_or_404()
        
        group_exam.is_active = False
        db.session.commit()
        
        return jsonify({
            'message': 'Examen desasignado del grupo'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/exams/<int:exam_id>/members', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group_exam_members(group_id, exam_id):
    """Obtener los miembros asignados a un examen específico del grupo"""
    try:
        from app.models import GroupExam
        from app.models.partner import GroupExamMember
        
        group_exam = GroupExam.query.filter_by(
            group_id=group_id, 
            exam_id=exam_id,
            is_active=True
        ).first_or_404()
        
        if group_exam.assignment_type == 'all':
            # Todos los miembros del grupo
            group_members = GroupMember.query.filter_by(group_id=group_id).all()
            assigned_user_ids = [m.user_id for m in group_members]
            members = []  # No hay miembros específicos asignados
        else:
            members = [m.to_dict(include_user=True) for m in group_exam.assigned_members]
            assigned_user_ids = [m.user_id for m in group_exam.assigned_members]
        
        return jsonify({
            'assignment_id': group_exam.id,
            'exam_id': exam_id,
            'assignment_type': group_exam.assignment_type,
            'members': members,
            'assigned_user_ids': assigned_user_ids,
            'total_members': len(assigned_user_ids)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/exams/<int:exam_id>/members', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_group_exam_members(group_id, exam_id):
    """Actualizar los miembros asignados a un examen del grupo"""
    try:
        from app.models import GroupExam
        from app.models.partner import GroupExamMember
        
        group = CandidateGroup.query.get_or_404(group_id)
        
        group_exam = GroupExam.query.filter_by(
            group_id=group_id, 
            exam_id=exam_id,
            is_active=True
        ).first_or_404()
        
        data = request.get_json()
        assignment_type = data.get('assignment_type', group_exam.assignment_type)
        member_ids = data.get('member_ids', [])
        
        if assignment_type == 'selected' and not member_ids:
            return jsonify({'error': 'Debes seleccionar al menos un candidato'}), 400
        
        # Actualizar tipo de asignación
        group_exam.assignment_type = assignment_type
        
        # Limpiar miembros anteriores
        GroupExamMember.query.filter_by(group_exam_id=group_exam.id).delete()
        
        # Si es tipo 'selected', agregar nuevos miembros
        if assignment_type == 'selected':
            for user_id in member_ids:
                member = GroupExamMember(
                    group_exam_id=group_exam.id,
                    user_id=user_id
                )
                db.session.add(member)
        
        db.session.commit()
        
        message = 'Asignación actualizada exitosamente.'
        if assignment_type == 'all':
            message += f' El examen está disponible para los {group.members.count()} miembros del grupo.'
        else:
            message += f' El examen está disponible para {len(member_ids)} candidato(s) seleccionado(s).'
        
        return jsonify({
            'message': message,
            'assignment': group_exam.to_dict(include_exam=True, include_members=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/exams/<int:exam_id>/members/add', methods=['POST'])
@jwt_required()
@coordinator_required
def add_members_to_exam(group_id, exam_id):
    """Agregar miembros a un examen existente sin afectar los actuales
    
    Parámetros:
    - user_ids: Lista de user_ids a agregar
    """
    try:
        from app.models import GroupExam
        from app.models.partner import GroupExamMember
        
        group_exam = GroupExam.query.filter_by(
            group_id=group_id,
            exam_id=exam_id,
            is_active=True
        ).first_or_404()
        
        data = request.get_json()
        user_ids_to_add = data.get('user_ids', [])
        
        if not user_ids_to_add:
            return jsonify({'error': 'Debes proporcionar user_ids a agregar'}), 400
        
        # Cambiar a 'selected' si era 'all'
        if group_exam.assignment_type == 'all':
            # Si era 'all', primero agregar todos los miembros actuales
            group_members = GroupMember.query.filter_by(group_id=group_id).all()
            for gm in group_members:
                existing = GroupExamMember.query.filter_by(
                    group_exam_id=group_exam.id,
                    user_id=gm.user_id
                ).first()
                if not existing:
                    member = GroupExamMember(
                        group_exam_id=group_exam.id,
                        user_id=gm.user_id
                    )
                    db.session.add(member)
            group_exam.assignment_type = 'selected'
        
        added = []
        for user_id in user_ids_to_add:
            existing = GroupExamMember.query.filter_by(
                group_exam_id=group_exam.id,
                user_id=user_id
            ).first()
            if not existing:
                member = GroupExamMember(
                    group_exam_id=group_exam.id,
                    user_id=user_id
                )
                db.session.add(member)
                added.append(user_id)
        
        db.session.commit()
        
        return jsonify({
            'message': f'{len(added)} usuario(s) agregado(s) al examen',
            'added': added
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== MATERIALES DE ESTUDIO SIN EXAMEN ==============

@bp.route('/groups/<int:group_id>/study-materials', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group_study_materials(group_id):
    """Obtener materiales de estudio asignados directamente al grupo (sin examen)"""
    try:
        from app.models import GroupStudyMaterial
        
        group = CandidateGroup.query.get_or_404(group_id)
        
        assignments = GroupStudyMaterial.query.filter_by(
            group_id=group_id,
            is_active=True
        ).order_by(GroupStudyMaterial.assigned_at.desc()).all()
        
        materials_data = [a.to_dict(include_material=True, include_members=True) for a in assignments]
        
        return jsonify({
            'group_id': group_id,
            'group_name': group.name,
            'assigned_materials': materials_data,
            'total': len(materials_data)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/study-materials', methods=['POST'])
@jwt_required()
@coordinator_required
def assign_study_materials_to_group(group_id):
    """Asignar materiales de estudio directamente a un grupo (sin examen)
    
    Parámetros:
    - material_ids: Lista de IDs de materiales a asignar
    - assignment_type: 'all' (todo el grupo) o 'selected' (candidatos específicos)
    - member_ids: Lista de IDs de usuarios (solo si assignment_type='selected')
    - available_from, available_until: Período de disponibilidad (opcional)
    """
    try:
        from app.models import GroupStudyMaterial, GroupStudyMaterialMember
        from app.models.study_content import StudyMaterial
        
        group = CandidateGroup.query.get_or_404(group_id)
        data = request.get_json()
        
        material_ids = data.get('material_ids', [])
        if not material_ids:
            return jsonify({'error': 'Debes seleccionar al menos un material de estudio'}), 400
        
        assignment_type = data.get('assignment_type', 'all')
        member_ids = data.get('member_ids', [])
        
        if assignment_type == 'selected' and not member_ids:
            return jsonify({'error': 'Debes seleccionar al menos un candidato'}), 400
        
        # Verificar que los materiales existen y están publicados
        materials = StudyMaterial.query.filter(
            StudyMaterial.id.in_(material_ids),
            StudyMaterial.is_published == True
        ).all()
        
        if len(materials) != len(material_ids):
            return jsonify({'error': 'Algunos materiales no existen o no están publicados'}), 400
        
        # Fechas de disponibilidad
        available_from = None
        available_until = None
        if data.get('available_from'):
            available_from = datetime.fromisoformat(data['available_from'].replace('Z', '+00:00'))
        if data.get('available_until'):
            available_until = datetime.fromisoformat(data['available_until'].replace('Z', '+00:00'))
        
        user_id = get_jwt_identity()
        assignments_created = []
        
        for material in materials:
            # Verificar si ya existe una asignación
            existing = GroupStudyMaterial.query.filter_by(
                group_id=group_id,
                study_material_id=material.id
            ).first()
            
            if existing:
                # Reactivar si estaba inactivo
                if not existing.is_active:
                    existing.is_active = True
                    existing.assigned_at = datetime.utcnow()
                    existing.assigned_by_id = user_id
                    existing.available_from = available_from
                    existing.available_until = available_until
                    existing.assignment_type = assignment_type
                    
                    # Actualizar miembros si es necesario
                    if assignment_type == 'selected':
                        GroupStudyMaterialMember.query.filter_by(group_study_material_id=existing.id).delete()
                        for mid in member_ids:
                            member = GroupStudyMaterialMember(
                                group_study_material_id=existing.id,
                                user_id=mid
                            )
                            db.session.add(member)
                    
                    assignments_created.append(existing)
            else:
                # Crear nueva asignación
                assignment = GroupStudyMaterial(
                    group_id=group_id,
                    study_material_id=material.id,
                    assigned_by_id=user_id,
                    available_from=available_from,
                    available_until=available_until,
                    assignment_type=assignment_type,
                    is_active=True
                )
                db.session.add(assignment)
                db.session.flush()  # Para obtener el ID
                
                # Agregar miembros si es asignación selectiva
                if assignment_type == 'selected':
                    for mid in member_ids:
                        member = GroupStudyMaterialMember(
                            group_study_material_id=assignment.id,
                            user_id=mid
                        )
                        db.session.add(member)
                
                assignments_created.append(assignment)
        
        db.session.commit()
        
        message = f'{len(assignments_created)} material(es) de estudio asignado(s) exitosamente.'
        if assignment_type == 'all':
            message += f' Disponible(s) para los {group.members.count()} miembros del grupo.'
        else:
            message += f' Disponible(s) para {len(member_ids)} candidato(s) seleccionado(s).'
        
        return jsonify({
            'message': message,
            'assignments': [a.to_dict(include_material=True) for a in assignments_created],
            'materials_count': len(assignments_created)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/study-materials/<int:material_id>', methods=['DELETE'])
@jwt_required()
@coordinator_required
def unassign_study_material_from_group(group_id, material_id):
    """Desasignar un material de estudio del grupo"""
    try:
        from app.models import GroupStudyMaterial
        
        assignment = GroupStudyMaterial.query.filter_by(
            group_id=group_id,
            study_material_id=material_id
        ).first_or_404()
        
        assignment.is_active = False
        db.session.commit()
        
        return jsonify({
            'message': 'Material de estudio desasignado del grupo'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/study-materials/<int:material_id>/members', methods=['GET'])
@jwt_required()
@coordinator_required
def get_study_material_members(group_id, material_id):
    """Obtener los miembros asignados a un material específico del grupo"""
    try:
        from app.models import GroupStudyMaterial, GroupStudyMaterialMember
        
        assignment = GroupStudyMaterial.query.filter_by(
            group_id=group_id,
            study_material_id=material_id,
            is_active=True
        ).first()
        
        if not assignment:
            return jsonify({
                'error': f'No se encontró asignación activa del material {material_id} en el grupo {group_id}'
            }), 404
        
        if assignment.assignment_type == 'all':
            # Todos los miembros del grupo
            group_members = GroupMember.query.filter_by(group_id=group_id).all()
            assigned_user_ids = [m.user_id for m in group_members]
        else:
            # Solo los seleccionados
            assigned_members = GroupStudyMaterialMember.query.filter_by(
                group_study_material_id=assignment.id
            ).all()
            assigned_user_ids = [m.user_id for m in assigned_members]
        
        return jsonify({
            'assignment_id': assignment.id,
            'material_id': material_id,
            'assignment_type': assignment.assignment_type,
            'assigned_user_ids': assigned_user_ids
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/study-materials/<int:material_id>/members', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_study_material_members(group_id, material_id):
    """Actualizar los miembros asignados a un material específico del grupo
    
    Parámetros:
    - user_ids: Lista de user_ids que deben estar asignados
    """
    try:
        from app.models import GroupStudyMaterial, GroupStudyMaterialMember
        
        assignment = GroupStudyMaterial.query.filter_by(
            group_id=group_id,
            study_material_id=material_id,
            is_active=True
        ).first()
        
        if not assignment:
            return jsonify({
                'error': f'No se encontró asignación activa del material {material_id} en el grupo {group_id}'
            }), 404
        
        data = request.get_json()
        new_user_ids = set(data.get('user_ids', []))
        
        if not new_user_ids:
            return jsonify({'error': 'Debes seleccionar al menos un candidato'}), 400
        
        # Cambiar a assignment_type 'selected' si era 'all'
        if assignment.assignment_type == 'all':
            assignment.assignment_type = 'selected'
        
        # Obtener asignaciones actuales
        current_members = GroupStudyMaterialMember.query.filter_by(
            group_study_material_id=assignment.id
        ).all()
        current_user_ids = {m.user_id for m in current_members}
        
        # Usuarios a agregar
        to_add = new_user_ids - current_user_ids
        # Usuarios a eliminar
        to_remove = current_user_ids - new_user_ids
        
        # Agregar nuevos
        for user_id in to_add:
            member = GroupStudyMaterialMember(
                group_study_material_id=assignment.id,
                user_id=user_id
            )
            db.session.add(member)
        
        # Eliminar los que ya no están
        for user_id in to_remove:
            GroupStudyMaterialMember.query.filter_by(
                group_study_material_id=assignment.id,
                user_id=user_id
            ).delete()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Miembros actualizados correctamente',
            'added': list(to_add),
            'removed': list(to_remove),
            'total_members': len(new_user_ids)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/study-materials/<int:material_id>/members/add', methods=['POST'])
@jwt_required()
@coordinator_required
def add_members_to_study_material(group_id, material_id):
    """Agregar miembros a un material de estudio existente sin afectar los actuales
    
    Parámetros:
    - user_ids: Lista de user_ids a agregar
    """
    try:
        from app.models import GroupStudyMaterial, GroupStudyMaterialMember
        
        assignment = GroupStudyMaterial.query.filter_by(
            group_id=group_id,
            study_material_id=material_id,
            is_active=True
        ).first()
        
        if not assignment:
            return jsonify({
                'error': f'No se encontró asignación activa del material {material_id} en el grupo {group_id}'
            }), 404
        
        data = request.get_json()
        user_ids_to_add = data.get('user_ids', [])
        
        if not user_ids_to_add:
            return jsonify({'error': 'Debes proporcionar user_ids a agregar'}), 400
        
        # Cambiar a 'selected' si era 'all'
        if assignment.assignment_type == 'all':
            # Si era 'all', primero agregar todos los miembros actuales
            group_members = GroupMember.query.filter_by(group_id=group_id).all()
            for gm in group_members:
                existing = GroupStudyMaterialMember.query.filter_by(
                    group_study_material_id=assignment.id,
                    user_id=gm.user_id
                ).first()
                if not existing:
                    member = GroupStudyMaterialMember(
                        group_study_material_id=assignment.id,
                        user_id=gm.user_id
                    )
                    db.session.add(member)
            assignment.assignment_type = 'selected'
        
        added = []
        for user_id in user_ids_to_add:
            existing = GroupStudyMaterialMember.query.filter_by(
                group_study_material_id=assignment.id,
                user_id=user_id
            ).first()
            if not existing:
                member = GroupStudyMaterialMember(
                    group_study_material_id=assignment.id,
                    user_id=user_id
                )
                db.session.add(member)
                added.append(user_id)
        
        db.session.commit()
        
        return jsonify({
            'message': f'{len(added)} usuario(s) agregado(s) al material',
            'added': added
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/study-materials/available', methods=['GET'])
@jwt_required()
@coordinator_required
def get_available_study_materials():
    """Obtener materiales de estudio publicados disponibles para asignar"""
    try:
        from app.models.study_content import StudyMaterial, study_material_exams
        from app.models import GroupStudyMaterial, GroupExam
        
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        group_id = request.args.get('group_id', type=int)
        
        # Obtener IDs de materiales ya asignados al grupo directamente
        assigned_material_ids = set()
        # Obtener materiales que están en exámenes asignados al grupo
        materials_in_assigned_exams = {}  # material_id -> exam_info
        
        if group_id:
            # Materiales asignados directamente
            assigned_materials = GroupStudyMaterial.query.filter_by(
                group_id=group_id,
                is_active=True
            ).all()
            assigned_material_ids = {gm.study_material_id for gm in assigned_materials}
            
            # Obtener exámenes asignados al grupo
            assigned_exams = GroupExam.query.filter_by(
                group_id=group_id,
                is_active=True
            ).all()
            
            # Para cada examen asignado, obtener sus materiales vinculados
            for group_exam in assigned_exams:
                exam = group_exam.exam
                if exam:
                    # Obtener materiales vinculados a este examen (tabla study_material_exams)
                    try:
                        result = db.session.execute(
                            db.select(study_material_exams.c.study_material_id).where(
                                study_material_exams.c.exam_id == exam.id
                            )
                        )
                        for row in result:
                            material_id = row[0]
                            if material_id not in materials_in_assigned_exams:
                                materials_in_assigned_exams[material_id] = {
                                    'exam_id': exam.id,
                                    'exam_name': exam.name,
                                    'group_exam_id': group_exam.id
                                }
                    except Exception:
                        pass  # Tabla puede no existir
                    
                    # También verificar materiales con relación legacy (exam_id directo)
                    legacy_materials = StudyMaterial.query.filter_by(exam_id=exam.id).all()
                    for mat in legacy_materials:
                        if mat.id not in materials_in_assigned_exams:
                            materials_in_assigned_exams[mat.id] = {
                                'exam_id': exam.id,
                                'exam_name': exam.name,
                                'group_exam_id': group_exam.id
                            }
        
        query = StudyMaterial.query.filter(StudyMaterial.is_published == True)
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    StudyMaterial.title.ilike(search_term),
                    StudyMaterial.description.ilike(search_term)
                )
            )
        
        query = query.order_by(StudyMaterial.title)
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        materials_data = []
        for mat in pagination.items:
            sessions_count = mat.sessions.count() if mat.sessions else 0
            topics_count = sum(s.topics.count() for s in mat.sessions.all()) if mat.sessions else 0
            
            # Verificar si está en un examen asignado
            exam_info = materials_in_assigned_exams.get(mat.id)
            
            materials_data.append({
                'id': mat.id,
                'title': mat.title,
                'description': mat.description,
                'image_url': mat.image_url,
                'is_published': mat.is_published,
                'sessions_count': sessions_count,
                'topics_count': topics_count,
                'is_assigned_to_group': mat.id in assigned_material_ids,
                'is_in_assigned_exam': exam_info is not None,
                'assigned_exam_info': exam_info,
            })
        
        return jsonify({
            'materials': materials_data,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/exams/available', methods=['GET'])
@jwt_required()
@coordinator_required
def get_available_exams():
    """Obtener exámenes disponibles para asignar a grupos
    
    Parámetros opcionales:
    - group_id: Si se proporciona, incluye is_assigned_to_group para indicar si ya está asignado
                Además, filtra exámenes por los ECM asignados al campus del grupo
    - campus_id: Si se proporciona (sin group_id), filtra exámenes por ECM del campus
    - filter_by_campus_ecm: Si es 'false', no filtra por ECM del campus (default: true)
    """
    try:
        from app.models import Exam, GroupExam
        from app.models.study_content import StudyMaterial
        from app.models.competency_standard import CompetencyStandard
        from app.models.partner import CampusCompetencyStandard
        from sqlalchemy import text
        from sqlalchemy.orm import joinedload
        
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        group_id = request.args.get('group_id', type=int)
        campus_id = request.args.get('campus_id', type=int)
        filter_by_campus_ecm = request.args.get('filter_by_campus_ecm', 'true').lower() != 'false'
        
        # Si se proporciona group_id, obtener exámenes ya asignados a ese grupo
        assigned_exam_ids = set()
        campus_ecm_ids = None
        
        if group_id:
            # Obtener el grupo para saber su campus
            group = CandidateGroup.query.get(group_id)
            if group:
                campus_id = group.campus_id
                
            assigned_exams = GroupExam.query.filter_by(
                group_id=group_id,
                is_active=True
            ).all()
            assigned_exam_ids = {ge.exam_id for ge in assigned_exams}
        
        # Obtener ECMs del campus para filtrar exámenes
        if campus_id and filter_by_campus_ecm:
            campus_ecm_relations = CampusCompetencyStandard.query.filter_by(campus_id=campus_id).all()
            if campus_ecm_relations:
                campus_ecm_ids = {rel.competency_standard_id for rel in campus_ecm_relations}
        
        # Cargar la relación competency_standard para tener el código ECM
        query = Exam.query.options(joinedload(Exam.competency_standard)).filter(Exam.is_published == True)
        
        # Filtrar por ECM del campus si corresponde
        if campus_ecm_ids is not None:
            query = query.filter(Exam.competency_standard_id.in_(campus_ecm_ids))
        
        if search:
            search_term = f'%{search}%'
            # Buscar también por código ECM
            query = query.outerjoin(CompetencyStandard).filter(
                db.or_(
                    Exam.name.ilike(search_term),
                    Exam.standard.ilike(search_term),
                    Exam.description.ilike(search_term),
                    CompetencyStandard.code.ilike(search_term)
                )
            )
        
        query = query.order_by(Exam.name)
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        exams_data = []
        for exam in pagination.items:
            # Contar materiales de estudio asociados (legacy exam_id)
            materials_count = StudyMaterial.query.filter_by(exam_id=exam.id, is_published=True).count()
            
            # También contar materiales de la relación muchos a muchos
            try:
                result = db.session.execute(text('''
                    SELECT COUNT(DISTINCT sme.study_material_id) 
                    FROM study_material_exams sme
                    JOIN study_contents sc ON sme.study_material_id = sc.id
                    WHERE sme.exam_id = :exam_id AND sc.is_published = 1
                '''), {'exam_id': exam.id})
                linked_count = result.scalar() or 0
                # Tomar el máximo de ambos (evitar duplicados si están en ambos)
                materials_count = max(materials_count, linked_count)
            except Exception:
                pass
            
            # Contar preguntas por tipo (exam vs simulator)
            exam_questions = 0
            simulator_questions = 0
            try:
                questions_result = db.session.execute(text('''
                    SELECT q.type, COUNT(q.id) as cnt
                    FROM questions q
                    JOIN topics t ON q.topic_id = t.id
                    JOIN categories c ON t.category_id = c.id
                    WHERE c.exam_id = :exam_id
                    GROUP BY q.type
                '''), {'exam_id': exam.id})
                for row in questions_result.fetchall():
                    q_type = row[0] or 'exam'
                    count = row[1] or 0
                    if q_type == 'simulator':
                        simulator_questions = count
                    else:
                        exam_questions = count
            except Exception as e:
                print(f"[DEBUG] Error contando preguntas: {e}")
            
            # Contar ejercicios por tipo (exam vs simulator)
            exam_exercises = 0
            simulator_exercises = 0
            try:
                exercises_result = db.session.execute(text('''
                    SELECT e.type, COUNT(e.id) as cnt
                    FROM exercises e
                    JOIN topics t ON e.topic_id = t.id
                    JOIN categories c ON t.category_id = c.id
                    WHERE c.exam_id = :exam_id
                    GROUP BY e.type
                '''), {'exam_id': exam.id})
                for row in exercises_result.fetchall():
                    e_type = row[0] or 'exam'
                    count = row[1] or 0
                    if e_type == 'simulator':
                        simulator_exercises = count
                    else:
                        exam_exercises = count
            except Exception as e:
                print(f"[DEBUG] Error contando ejercicios: {e}")
            
            total_questions = exam_questions + simulator_questions
            total_exercises = exam_exercises + simulator_exercises
            
            # Obtener código ECM si existe
            ecm_code = None
            ecm_name = None
            if exam.competency_standard:
                ecm_code = exam.competency_standard.code
                ecm_name = exam.competency_standard.name
            
            print(f"[DEBUG] Exam {exam.id} ({exam.name}): standard='{exam.standard}', ecm_code='{ecm_code}', competency_standard_id={exam.competency_standard_id}")
            
            exams_data.append({
                'id': exam.id,
                'name': exam.name,
                'version': exam.version,
                'standard': exam.standard,
                'ecm_code': ecm_code,
                'ecm_name': ecm_name,
                'description': exam.description,
                'duration_minutes': exam.duration_minutes,
                'passing_score': exam.passing_score,
                'is_published': exam.is_published,
                'study_materials_count': materials_count,
                'total_questions': total_questions,
                'total_exercises': total_exercises,
                'exam_questions_count': exam_questions,
                'simulator_questions_count': simulator_questions,
                'exam_exercises_count': exam_exercises,
                'simulator_exercises_count': simulator_exercises,
                'is_assigned_to_group': exam.id in assigned_exam_ids,
            })
        
        response_data = {
            'exams': exams_data,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }
        
        # Agregar info de filtrado por ECM si corresponde
        if campus_ecm_ids is not None:
            response_data['filtered_by_campus_ecm'] = True
            response_data['campus_ecm_count'] = len(campus_ecm_ids)
        else:
            response_data['filtered_by_campus_ecm'] = False
        
        return jsonify(response_data)
        
    except Exception as e:
        import traceback
        print(f"[DEBUG] Error en get_available_exams: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@bp.route('/exams/<int:exam_id>/materials', methods=['GET'])
@jwt_required()
@coordinator_required
def get_exam_materials_for_assignment(exam_id):
    """Obtener materiales disponibles para asignar con un examen.
    Retorna primero los materiales ligados al examen (solo los publicados),
    luego los demás materiales publicados.
    """
    try:
        from app.models.study_content import StudyMaterial
        from app.models import Exam
        from sqlalchemy import text
        
        print(f"=== get_exam_materials_for_assignment: exam_id={exam_id} ===")
        
        exam = Exam.query.get_or_404(exam_id)
        print(f"Exam found: {exam.name}")
        
        # Obtener IDs de materiales vinculados al examen (desde study_material_exams)
        linked_material_ids = []
        try:
            result = db.session.execute(text('''
                SELECT study_material_id FROM study_material_exams 
                WHERE exam_id = :exam_id
            '''), {'exam_id': exam_id})
            linked_material_ids = [r[0] for r in result.fetchall()]
            print(f"Linked materials from study_material_exams: {linked_material_ids}")
        except Exception as e:
            print(f"Error getting linked materials from study_material_exams: {e}")
        
        # También verificar materiales con el campo legacy exam_id
        try:
            legacy_materials = StudyMaterial.query.filter_by(exam_id=exam_id).all()
            print(f"Legacy materials with exam_id={exam_id}: {[m.id for m in legacy_materials]}")
            for mat in legacy_materials:
                if mat.id not in linked_material_ids:
                    linked_material_ids.append(mat.id)
        except Exception as e:
            print(f"Error getting legacy materials: {e}")
        
        print(f"Total linked material IDs: {linked_material_ids}")
        
        materials_data = []
        linked_set = set(linked_material_ids)
        
        # Primero los materiales vinculados al examen (solo mostrar publicados)
        if linked_material_ids:
            linked_materials = StudyMaterial.query.filter(
                StudyMaterial.id.in_(linked_material_ids),
                StudyMaterial.is_published == True
            ).order_by(StudyMaterial.title).all()
            
            print(f"Linked published materials found: {len(linked_materials)}")
            
            for mat in linked_materials:
                # Calcular conteos
                sessions_count = mat.sessions.count() if mat.sessions else 0
                topics_count = sum(s.topics.count() for s in mat.sessions.all()) if mat.sessions else 0
                
                materials_data.append({
                    'id': mat.id,
                    'title': mat.title,
                    'description': mat.description,
                    'cover_image_url': mat.image_url,
                    'is_published': True,
                    'is_linked': True,  # Vinculado directamente al examen
                    'is_selected': True,  # Por defecto seleccionado si está vinculado
                    'sessions_count': sessions_count,
                    'topics_count': topics_count,
                })
        
        # Luego los materiales publicados que no están vinculados
        if linked_material_ids:
            other_published = StudyMaterial.query.filter(
                StudyMaterial.is_published == True,
                ~StudyMaterial.id.in_(linked_material_ids)
            ).order_by(StudyMaterial.title).all()
        else:
            # Si no hay materiales ligados, obtener todos los publicados
            other_published = StudyMaterial.query.filter(
                StudyMaterial.is_published == True
            ).order_by(StudyMaterial.title).all()
        
        print(f"Other published materials found: {len(other_published)}")
        
        for mat in other_published:
            # Calcular conteos
            sessions_count = mat.sessions.count() if mat.sessions else 0
            topics_count = sum(s.topics.count() for s in mat.sessions.all()) if mat.sessions else 0
            
            materials_data.append({
                'id': mat.id,
                'title': mat.title,
                'description': mat.description,
                'cover_image_url': mat.image_url,
                'is_published': True,
                'is_linked': False,  # No vinculado directamente
                'is_selected': False,  # Por defecto no seleccionado
                'sessions_count': sessions_count,
                'topics_count': topics_count,
            })
        
        print(f"Total materials to return: {len(materials_data)}")
        
        return jsonify({
            'exam_id': exam_id,
            'exam_name': exam.name,
            'materials': materials_data,
            'linked_count': len([m for m in materials_data if m['is_linked']]),
            'total_count': len(materials_data)
        })
        
    except Exception as e:
        import traceback
        print(f"Error in get_exam_materials_for_assignment: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


# ============== MATERIALES PERSONALIZADOS POR GRUPO-EXAMEN ==============

@bp.route('/group-exams/<int:group_exam_id>/materials', methods=['GET'])
@jwt_required()
@coordinator_required
def get_group_exam_materials(group_exam_id):
    """Obtener materiales disponibles y seleccionados para un grupo-examen"""
    try:
        from app.models import GroupExam, GroupExamMaterial
        from app.models.study_content import StudyMaterial
        from sqlalchemy import text
        
        group_exam = GroupExam.query.get_or_404(group_exam_id)
        
        # Obtener materiales vinculados al examen (desde study_material_exams)
        linked_material_ids = []
        try:
            result = db.session.execute(text('''
                SELECT study_material_id FROM study_material_exams 
                WHERE exam_id = :exam_id
            '''), {'exam_id': group_exam.exam_id})
            linked_material_ids = [r[0] for r in result.fetchall()]
        except Exception:
            pass
        
        # Obtener materiales personalizados para este group_exam
        custom_materials = GroupExamMaterial.query.filter_by(group_exam_id=group_exam_id).all()
        custom_dict = {cm.study_material_id: cm.is_included for cm in custom_materials}
        
        # Obtener todos los materiales publicados para selección adicional
        all_published = StudyMaterial.query.filter_by(is_published=True).all()
        
        # Construir respuesta
        materials_data = []
        
        # Primero los materiales vinculados al examen (solo mostrar publicados en esta sección)
        for mat in StudyMaterial.query.filter(StudyMaterial.id.in_(linked_material_ids), StudyMaterial.is_published == True).all():
            # Por defecto incluido SOLO si está vinculado Y publicado
            is_included = custom_dict.get(mat.id, True)
            materials_data.append({
                'id': mat.id,
                'title': mat.title,
                'description': mat.description,
                'cover_image_url': mat.image_url,
                'is_published': mat.is_published,
                'is_linked': True,  # Vinculado directamente al examen
                'is_included': is_included,
            })
        
        # Luego los materiales publicados que no están vinculados
        linked_set = set(linked_material_ids)
        for mat in all_published:
            if mat.id not in linked_set:
                is_included = custom_dict.get(mat.id, False)  # Por defecto no incluido
                materials_data.append({
                    'id': mat.id,
                    'title': mat.title,
                    'description': mat.description,
                    'cover_image_url': mat.image_url,
                    'is_published': mat.is_published,
                    'is_linked': False,  # No vinculado directamente
                    'is_included': is_included,
                })
        
        return jsonify({
            'group_exam_id': group_exam_id,
            'exam_id': group_exam.exam_id,
            'exam_name': group_exam.exam.name if group_exam.exam else None,
            'materials': materials_data,
            'has_customizations': len(custom_materials) > 0
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/group-exams/<int:group_exam_id>/materials', methods=['PUT'])
@jwt_required()
@coordinator_required
def update_group_exam_materials(group_exam_id):
    """Actualizar materiales seleccionados para un grupo-examen"""
    try:
        from app.models import GroupExam, GroupExamMaterial
        
        group_exam = GroupExam.query.get_or_404(group_exam_id)
        data = request.get_json()
        
        # data.materials = [{id: number, is_included: boolean}, ...]
        materials_config = data.get('materials', [])
        
        # Eliminar configuraciones anteriores
        GroupExamMaterial.query.filter_by(group_exam_id=group_exam_id).delete()
        
        # Crear nuevas configuraciones
        for mat_config in materials_config:
            mat_id = mat_config.get('id')
            is_included = mat_config.get('is_included', False)
            
            if mat_id:
                gem = GroupExamMaterial(
                    group_exam_id=group_exam_id,
                    study_material_id=mat_id,
                    is_included=is_included
                )
                db.session.add(gem)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Materiales actualizados exitosamente',
            'group_exam_id': group_exam_id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/group-exams/<int:group_exam_id>/materials/reset', methods=['POST'])
@jwt_required()
@coordinator_required
def reset_group_exam_materials(group_exam_id):
    """Resetear materiales a los vinculados por defecto del examen"""
    try:
        from app.models import GroupExam, GroupExamMaterial
        
        group_exam = GroupExam.query.get_or_404(group_exam_id)
        
        # Eliminar todas las personalizaciones
        GroupExamMaterial.query.filter_by(group_exam_id=group_exam_id).delete()
        db.session.commit()
        
        return jsonify({
            'message': 'Materiales reseteados a valores por defecto',
            'group_exam_id': group_exam_id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== MOVER CANDIDATOS ENTRE GRUPOS ==============

@bp.route('/groups/<int:source_group_id>/members/move', methods=['POST'])
@jwt_required()
@coordinator_required
def move_members_to_group(source_group_id):
    """Mover candidatos de un grupo a otro"""
    try:
        data = request.get_json()
        
        target_group_id = data.get('target_group_id')
        user_ids = data.get('user_ids', [])
        
        if not target_group_id:
            return jsonify({'error': 'El grupo destino es requerido'}), 400
        
        if not user_ids or not isinstance(user_ids, list):
            return jsonify({'error': 'Debe especificar al menos un candidato para mover'}), 400
        
        if source_group_id == target_group_id:
            return jsonify({'error': 'El grupo origen y destino no pueden ser el mismo'}), 400
        
        # Verificar grupos existen
        source_group = CandidateGroup.query.get_or_404(source_group_id)
        target_group = CandidateGroup.query.get_or_404(target_group_id)
        
        moved = []
        errors = []
        
        for user_id in user_ids:
            # Verificar que el candidato esté en el grupo origen
            source_member = GroupMember.query.filter_by(
                group_id=source_group_id,
                user_id=user_id,
                status='active'
            ).first()
            
            if not source_member:
                user = User.query.get(user_id)
                errors.append({
                    'user_id': user_id,
                    'name': user.name if user else 'Desconocido',
                    'error': 'No es miembro activo del grupo origen'
                })
                continue
            
            # Verificar que no esté ya en el grupo destino
            existing_target = GroupMember.query.filter_by(
                group_id=target_group_id,
                user_id=user_id
            ).first()
            
            if existing_target:
                user = User.query.get(user_id)
                errors.append({
                    'user_id': user_id,
                    'name': user.name if user else 'Desconocido',
                    'error': 'Ya existe en el grupo destino'
                })
                continue
            
            # Mover: eliminar del origen y crear en destino
            user = User.query.get(user_id)
            
            # Eliminar del grupo origen
            db.session.delete(source_member)
            
            # Crear en grupo destino
            new_member = GroupMember(
                group_id=target_group_id,
                user_id=user_id,
                status='active',
                notes=f'Movido desde {source_group.name}'
            )
            db.session.add(new_member)
            
            moved.append({
                'user_id': user_id,
                'name': f"{user.name} {user.first_surname}" if user else 'Desconocido',
                'email': user.email if user else ''
            })
        
        db.session.commit()
        
        return jsonify({
            'message': f'{len(moved)} candidato(s) movido(s) exitosamente',
            'moved': moved,
            'errors': errors,
            'source_group': source_group.name,
            'target_group': target_group.name
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/members/upload/preview', methods=['POST'])
@jwt_required()
@coordinator_required
def preview_group_members_upload(group_id):
    """Preview del archivo Excel antes de procesar la asignación"""
    from openpyxl import load_workbook
    
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        
        file = request.files['file']
        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({'error': 'El archivo debe ser Excel (.xlsx o .xls)'}), 400
        
        # Cargar el archivo Excel
        wb = load_workbook(file)
        ws = wb.active
        
        preview = []
        current_count = GroupMember.query.filter_by(group_id=group_id, status='active').count()
        
        # Procesar cada fila (saltando el encabezado)
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            identifier = row[0] if len(row) > 0 else None
            notes = row[1] if len(row) > 1 else None
            
            if not identifier:
                continue
            
            identifier = str(identifier).strip()
            
            # Buscar usuario por email o CURP
            user = User.query.filter(
                db.or_(
                    User.email == identifier,
                    User.curp == identifier.upper()
                ),
                User.role == 'candidato',
                User.is_active == True
            ).first()
            
            status = 'ready'  # ready, already_member, not_found
            user_info = None
            error_message = None
            
            if not user:
                status = 'not_found'
                error_message = 'Candidato no encontrado o inactivo'
            else:
                # Verificar si ya es miembro
                existing = GroupMember.query.filter_by(group_id=group_id, user_id=user.id).first()
                if existing:
                    status = 'already_member'
                    error_message = 'Ya es miembro del grupo'
                
                user_info = {
                    'id': user.id,
                    'email': user.email,
                    'name': user.name,
                    'first_surname': user.first_surname,
                    'second_surname': user.second_surname,
                    'full_name': f"{user.name} {user.first_surname} {user.second_surname or ''}".strip(),
                    'curp': user.curp,
                    'gender': user.gender
                }
            
            preview.append({
                'row': row_num,
                'identifier': identifier,
                'notes': str(notes) if notes else None,
                'status': status,
                'error': error_message,
                'user': user_info
            })
        
        # Contar por status
        ready_count = len([p for p in preview if p['status'] == 'ready'])
        already_member_count = len([p for p in preview if p['status'] == 'already_member'])
        not_found_count = len([p for p in preview if p['status'] == 'not_found'])
        
        return jsonify({
            'group_name': group.name,
            'current_members': current_count,
            'preview': preview,
            'summary': {
                'total': len(preview),
                'ready': ready_count,
                'already_member': already_member_count,
                'not_found': not_found_count
            },
            'can_proceed': ready_count > 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/candidates/search/advanced', methods=['GET'])
@jwt_required()
@coordinator_required
def search_candidates_advanced():
    """Búsqueda avanzada de candidatos con filtros múltiples"""
    try:
        # Parámetros de búsqueda básica
        search = request.args.get('search', '')
        search_field = request.args.get('search_field', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Filtros avanzados
        has_group = request.args.get('has_group')  # 'yes', 'no', o vacío para todos
        group_id = request.args.get('group_id', type=int)  # Candidatos de un grupo específico
        exclude_group_id = request.args.get('exclude_group_id', type=int)  # Excluir candidatos de un grupo
        partner_id = request.args.get('partner_id', type=int)  # Candidatos de un partner específico
        campus_id = request.args.get('campus_id', type=int)  # Candidatos de un campus específico
        state = request.args.get('state')  # Estado del campus
        gender = request.args.get('gender')  # M, F, O
        
        query = User.query.filter(
            User.role == 'candidato',
            User.is_active == True
        )
        
        # Filtro de búsqueda textual
        if search:
            search_term = f'%{search}%'
            if search_field and search_field in ['name', 'first_surname', 'second_surname', 'email', 'curp']:
                field_map = {
                    'name': User.name,
                    'first_surname': User.first_surname,
                    'second_surname': User.second_surname,
                    'email': User.email,
                    'curp': User.curp,
                }
                query = query.filter(field_map[search_field].ilike(search_term))
            else:
                query = query.filter(
                    db.or_(
                        User.name.ilike(search_term),
                        User.first_surname.ilike(search_term),
                        User.second_surname.ilike(search_term),
                        User.email.ilike(search_term),
                        User.curp.ilike(search_term)
                    )
                )
        
        # Filtro por género
        if gender and gender in ['M', 'F', 'O']:
            query = query.filter(User.gender == gender)
        
        # Filtro: tiene grupo / sin grupo
        if has_group == 'yes':
            # Candidatos que tienen al menos un grupo activo
            candidates_with_group = db.session.query(GroupMember.user_id).filter(
                GroupMember.status == 'active'
            ).subquery()
            query = query.filter(User.id.in_(candidates_with_group))
        elif has_group == 'no':
            # Candidatos sin grupo activo
            candidates_with_group = db.session.query(GroupMember.user_id).filter(
                GroupMember.status == 'active'
            ).subquery()
            query = query.filter(~User.id.in_(candidates_with_group))
        
        # Filtro: candidatos de un grupo específico
        if group_id:
            members_of_group = db.session.query(GroupMember.user_id).filter(
                GroupMember.group_id == group_id,
                GroupMember.status == 'active'
            ).subquery()
            query = query.filter(User.id.in_(members_of_group))
        
        # Filtro: excluir candidatos de un grupo
        if exclude_group_id:
            members_of_group = db.session.query(GroupMember.user_id).filter(
                GroupMember.group_id == exclude_group_id
            ).subquery()
            query = query.filter(~User.id.in_(members_of_group))
        
        # Filtro por partner
        if partner_id:
            # Candidatos que están en grupos de campuses del partner
            groups_of_partner = db.session.query(CandidateGroup.id).join(Campus).filter(
                Campus.partner_id == partner_id
            ).subquery()
            members_of_partner = db.session.query(GroupMember.user_id).filter(
                GroupMember.group_id.in_(groups_of_partner),
                GroupMember.status == 'active'
            ).subquery()
            query = query.filter(User.id.in_(members_of_partner))
        
        # Filtro por campus
        if campus_id:
            groups_of_campus = db.session.query(CandidateGroup.id).filter(
                CandidateGroup.campus_id == campus_id
            ).subquery()
            members_of_campus = db.session.query(GroupMember.user_id).filter(
                GroupMember.group_id.in_(groups_of_campus),
                GroupMember.status == 'active'
            ).subquery()
            query = query.filter(User.id.in_(members_of_campus))
        
        # Filtro por estado
        if state:
            groups_of_state = db.session.query(CandidateGroup.id).join(Campus).filter(
                Campus.state_name == state
            ).subquery()
            members_of_state = db.session.query(GroupMember.user_id).filter(
                GroupMember.group_id.in_(groups_of_state),
                GroupMember.status == 'active'
            ).subquery()
            query = query.filter(User.id.in_(members_of_state))
        
        # Ordenamiento: 'recent' ordena por fecha de creación descendente
        sort_by = request.args.get('sort_by', 'name')
        if sort_by == 'recent':
            query = query.order_by(User.created_at.desc())
        else:
            query = query.order_by(User.first_surname, User.name)
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        candidates = []
        for user in pagination.items:
            # Obtener información del grupo actual
            current_membership = GroupMember.query.filter_by(
                user_id=user.id,
                status='active'
            ).first()
            
            group_info = None
            if current_membership and current_membership.group:
                group = current_membership.group
                campus = group.campus
                cycle = group.school_cycle
                partner = campus.partner if campus else None
                
                group_info = {
                    'group_id': group.id,
                    'group_name': group.name,
                    'campus_id': campus.id if campus else None,
                    'campus_name': campus.name if campus else None,
                    'state_name': campus.state_name if campus else None,
                    'city': campus.city if campus else None,
                    'school_cycle_id': cycle.id if cycle else None,
                    'school_cycle_name': cycle.name if cycle else None,
                    'partner_id': partner.id if partner else None,
                    'partner_name': partner.name if partner else None,
                }
            
            candidates.append({
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'first_surname': user.first_surname,
                'second_surname': user.second_surname,
                'full_name': f"{user.name} {user.first_surname} {user.second_surname or ''}".strip(),
                'curp': user.curp,
                'gender': user.gender,
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'current_group': group_info,
            })
        
        return jsonify({
            'candidates': candidates,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'filters_applied': {
                'search': search,
                'search_field': search_field,
                'has_group': has_group,
                'group_id': group_id,
                'exclude_group_id': exclude_group_id,
                'partner_id': partner_id,
                'campus_id': campus_id,
                'state': state,
                'gender': gender
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/export-members', methods=['GET'])
@jwt_required()
@coordinator_required
def export_group_members(group_id):
    """
    Exportar miembros del grupo a Excel
    Incluye: Grupo, Usuario, Contraseña, Nombre Completo, Email, CURP, Estado, Estatus Certificación
    """
    try:
        from sqlalchemy import text
        from app.models.result import Result
        
        group = CandidateGroup.query.get_or_404(group_id)
        
        # Obtener miembros con sus usuarios
        members = GroupMember.query.filter_by(group_id=group_id).all()
        
        # Obtener exámenes del grupo para buscar resultados
        group_exams = GroupExam.query.filter_by(group_id=group_id, is_active=True).all()
        real_exam_ids = [ge.exam_id for ge in group_exams]
        
        # Obtener resultados de certificación para todos los usuarios
        user_ids = [m.user_id for m in members if m.user]
        certification_status_map = {}
        
        if user_ids and real_exam_ids:
            results = Result.query.filter(
                Result.user_id.in_(user_ids),
                Result.exam_id.in_(real_exam_ids)
            ).all()
            
            for r in results:
                if r.user_id not in certification_status_map:
                    certification_status_map[r.user_id] = {'status': -1, 'result': -1}
                
                current = certification_status_map[r.user_id]
                # Priorizar: aprobado > en proceso > reprobado
                if r.result == 1 and r.status == 1:
                    current['status'] = 1
                    current['result'] = 1
                elif r.status == 0 and current['result'] != 1:
                    current['status'] = 0
                    current['result'] = 0
                elif r.status == 1 and r.result == 0 and current['status'] != 0 and current['result'] != 1:
                    current['status'] = 1
                    current['result'] = 0
        
        # Crear workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Miembros del Grupo"
        
        # Estilos
        header_font = Font(bold=True, color="FFFFFF", size=12)
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Headers - ahora incluye CURP y Estatus Certificación
        headers = ["Grupo", "Usuario", "Contraseña", "Nombre Completo", "Email", "CURP", "Estado", "Estatus Certificación"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Datos
        row_num = 2
        for member in members:
            user = member.user
            if user:
                # Desencriptar contraseña
                password = "No disponible"
                if user.encrypted_password:
                    try:
                        decrypted = decrypt_password(user.encrypted_password)
                        if decrypted:
                            password = decrypted
                    except Exception:
                        password = "Error al desencriptar"
                
                # Determinar estatus de certificación
                cert_info = certification_status_map.get(user.id, None)
                if cert_info:
                    if cert_info['result'] == 1 and cert_info['status'] == 1:
                        cert_status_text = "Certificado"
                    elif cert_info['status'] == 0:
                        cert_status_text = "En proceso"
                    else:
                        cert_status_text = "No aprobado"
                else:
                    cert_status_text = "Pendiente"
                
                ws.cell(row=row_num, column=1, value=group.name).border = thin_border
                ws.cell(row=row_num, column=2, value=user.username).border = thin_border
                ws.cell(row=row_num, column=3, value=password).border = thin_border
                ws.cell(row=row_num, column=4, value=user.full_name or f"{user.name or ''} {user.last_name or ''}".strip()).border = thin_border
                ws.cell(row=row_num, column=5, value=user.email).border = thin_border
                ws.cell(row=row_num, column=6, value=user.curp or "").border = thin_border
                ws.cell(row=row_num, column=7, value="Activo" if member.status == 'active' else "Suspendido").border = thin_border
                ws.cell(row=row_num, column=8, value=cert_status_text).border = thin_border
                row_num += 1
        
        # Ajustar anchos de columna
        ws.column_dimensions['A'].width = 25
        ws.column_dimensions['B'].width = 20
        ws.column_dimensions['C'].width = 20
        ws.column_dimensions['D'].width = 35
        ws.column_dimensions['E'].width = 30
        ws.column_dimensions['F'].width = 22
        ws.column_dimensions['G'].width = 15
        ws.column_dimensions['H'].width = 22
        
        # Guardar a BytesIO
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        # Nombre del archivo
        safe_name = group.name.replace(' ', '_').replace('/', '-')[:30]
        filename = f"Miembros_{safe_name}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== ENDPOINTS PARA RESPONSABLE DE PLANTEL ==============

def responsable_required(f):
    """Decorador que requiere rol de responsable"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'No autorizado'}), 401
        if user.role != 'responsable':
            return jsonify({'error': 'Acceso denegado. Se requiere rol de responsable'}), 403
        if not user.campus_id:
            return jsonify({'error': 'No tienes un plantel asignado'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


@bp.route('/mi-plantel', methods=['GET'])
@jwt_required()
@responsable_required
def get_mi_plantel():
    """Obtener información del plantel del responsable"""
    try:
        user = g.current_user
        campus = Campus.query.get(user.campus_id)
        
        if not campus:
            return jsonify({'error': 'No se encontró el plantel asignado'}), 404
        
        # Verificar que el usuario es el responsable asignado
        if campus.responsable_id != user.id:
            return jsonify({'error': 'No eres el responsable de este plantel'}), 403
        
        return jsonify({
            'campus': campus.to_dict(include_partner=True, include_responsable=True, include_config=True)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/mi-plantel/stats', methods=['GET'])
@jwt_required()
@responsable_required
def get_mi_plantel_stats():
    """Obtener estadísticas del plantel del responsable"""
    from app.models import Result, Exam, StudyMaterial
    from app.models.student_progress import StudentContentProgress
    from sqlalchemy import func
    
    try:
        user = g.current_user
        campus = Campus.query.get(user.campus_id)
        
        if not campus:
            return jsonify({'error': 'No se encontró el plantel asignado'}), 404
        
        # Obtener todos los grupos del plantel
        groups = CandidateGroup.query.filter_by(campus_id=campus.id, is_active=True).all()
        group_ids = [g.id for g in groups]
        
        # Obtener todos los candidatos del plantel (miembros de grupos)
        candidate_ids = db.session.query(GroupMember.user_id).filter(
            GroupMember.group_id.in_(group_ids),
            GroupMember.status == 'active'
        ).distinct().all()
        candidate_ids = [c[0] for c in candidate_ids]
        
        total_candidates = len(candidate_ids)
        total_groups = len(groups)
        
        # Estadísticas de exámenes
        if candidate_ids:
            # Total de evaluaciones completadas
            total_evaluations = Result.query.filter(
                Result.user_id.in_(candidate_ids),
                Result.status == 1  # Completado
            ).count()
            
            # Evaluaciones aprobadas
            passed_evaluations = Result.query.filter(
                Result.user_id.in_(candidate_ids),
                Result.status == 1,
                Result.result == 1  # Aprobado
            ).count()
            
            # Evaluaciones reprobadas
            failed_evaluations = Result.query.filter(
                Result.user_id.in_(candidate_ids),
                Result.status == 1,
                Result.result == 0  # Reprobado
            ).count()
            
            # Promedio de calificaciones
            avg_score = db.session.query(func.avg(Result.score)).filter(
                Result.user_id.in_(candidate_ids),
                Result.status == 1
            ).scalar() or 0
            
            # Progreso en materiales de estudio
            total_progress_records = StudentContentProgress.query.filter(
                StudentContentProgress.user_id.in_(candidate_ids)
            ).count()
            
            completed_progress = StudentContentProgress.query.filter(
                StudentContentProgress.user_id.in_(candidate_ids),
                StudentContentProgress.is_completed == True
            ).count()
            
            # Candidatos con al menos una evaluación
            candidates_with_eval = db.session.query(Result.user_id).filter(
                Result.user_id.in_(candidate_ids),
                Result.status == 1
            ).distinct().count()
            
            # Candidatos con certificado (aprobado)
            candidates_certified = db.session.query(Result.user_id).filter(
                Result.user_id.in_(candidate_ids),
                Result.status == 1,
                Result.result == 1
            ).distinct().count()
        else:
            total_evaluations = 0
            passed_evaluations = 0
            failed_evaluations = 0
            avg_score = 0
            total_progress_records = 0
            completed_progress = 0
            candidates_with_eval = 0
            candidates_certified = 0
        
        # Calcular tasa de aprobación
        approval_rate = (passed_evaluations / total_evaluations * 100) if total_evaluations > 0 else 0
        
        # Calcular tasa de progreso en materiales
        material_completion_rate = (completed_progress / total_progress_records * 100) if total_progress_records > 0 else 0
        
        return jsonify({
            'campus': {
                'id': campus.id,
                'name': campus.name,
                'code': campus.code
            },
            'stats': {
                'total_groups': total_groups,
                'total_candidates': total_candidates,
                'candidates_with_evaluations': candidates_with_eval,
                'candidates_certified': candidates_certified,
                'total_evaluations': total_evaluations,
                'passed_evaluations': passed_evaluations,
                'failed_evaluations': failed_evaluations,
                'approval_rate': round(approval_rate, 1),
                'average_score': round(float(avg_score), 1),
                'material_completion_rate': round(material_completion_rate, 1),
                'total_material_progress': total_progress_records,
                'completed_material_progress': completed_progress
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/mi-plantel/evaluations', methods=['GET'])
@jwt_required()
@responsable_required
def get_mi_plantel_evaluations():
    """Obtener lista de evaluaciones del plantel del responsable"""
    from app.models import Result, Exam
    
    try:
        user = g.current_user
        campus = Campus.query.get(user.campus_id)
        
        if not campus:
            return jsonify({'error': 'No se encontró el plantel asignado'}), 404
        
        # Parámetros de paginación y filtrado
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        exam_id = request.args.get('exam_id', type=int)
        result_status = request.args.get('result', type=int)  # 0=reprobado, 1=aprobado
        search = request.args.get('search', '')
        
        # Obtener todos los grupos del plantel
        groups = CandidateGroup.query.filter_by(campus_id=campus.id).all()
        group_ids = [g.id for g in groups]
        
        # Obtener todos los candidatos del plantel
        candidate_ids = db.session.query(GroupMember.user_id).filter(
            GroupMember.group_id.in_(group_ids)
        ).distinct().all()
        candidate_ids = [c[0] for c in candidate_ids]
        
        if not candidate_ids:
            return jsonify({
                'evaluations': [],
                'total': 0,
                'page': page,
                'per_page': per_page,
                'pages': 0
            })
        
        # Query base de resultados
        query = Result.query.filter(
            Result.user_id.in_(candidate_ids),
            Result.status == 1  # Solo completados
        )
        
        # Filtros
        if exam_id:
            query = query.filter(Result.exam_id == exam_id)
        
        if result_status is not None:
            query = query.filter(Result.result == result_status)
        
        # Ordenar por fecha más reciente
        query = query.order_by(Result.end_date.desc())
        
        # Paginación
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        evaluations = []
        for result in pagination.items:
            # Obtener datos del usuario
            candidate = User.query.get(result.user_id)
            
            # Obtener datos del examen
            exam = Exam.query.get(result.exam_id)
            
            # Obtener grupo del candidato
            member = GroupMember.query.filter(
                GroupMember.user_id == result.user_id,
                GroupMember.group_id.in_(group_ids)
            ).first()
            group = CandidateGroup.query.get(member.group_id) if member else None
            
            evaluations.append({
                'id': result.id,
                'candidate': {
                    'id': candidate.id,
                    'full_name': candidate.full_name,
                    'username': candidate.username,
                    'email': candidate.email,
                    'curp': candidate.curp
                } if candidate else None,
                'exam': {
                    'id': exam.id,
                    'name': exam.name,
                    'version': exam.version
                } if exam else None,
                'group': {
                    'id': group.id,
                    'name': group.name
                } if group else None,
                'score': result.score,
                'result': result.result,
                'result_text': 'Aprobado' if result.result == 1 else 'Reprobado',
                'start_date': result.start_date.isoformat() if result.start_date else None,
                'end_date': result.end_date.isoformat() if result.end_date else None,
                'duration_seconds': result.duration_seconds,
                'certificate_url': result.certificate_url,
                'report_url': result.report_url
            })
        
        return jsonify({
            'evaluations': evaluations,
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/mi-plantel/evaluations/export', methods=['GET'])
@jwt_required()
@responsable_required
def export_mi_plantel_evaluations():
    """Exportar evaluaciones del plantel a Excel"""
    from app.models import Result, Exam
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    
    try:
        user = g.current_user
        campus = Campus.query.get(user.campus_id)
        
        if not campus:
            return jsonify({'error': 'No se encontró el plantel asignado'}), 404
        
        # Filtros opcionales
        exam_id = request.args.get('exam_id', type=int)
        result_status = request.args.get('result', type=int)
        
        # Obtener todos los grupos del plantel
        groups = CandidateGroup.query.filter_by(campus_id=campus.id).all()
        group_ids = [g.id for g in groups]
        
        # Obtener todos los candidatos del plantel
        candidate_ids = db.session.query(GroupMember.user_id).filter(
            GroupMember.group_id.in_(group_ids)
        ).distinct().all()
        candidate_ids = [c[0] for c in candidate_ids]
        
        if not candidate_ids:
            return jsonify({'error': 'No hay candidatos en el plantel'}), 404
        
        # Query de resultados
        query = Result.query.filter(
            Result.user_id.in_(candidate_ids),
            Result.status == 1
        )
        
        if exam_id:
            query = query.filter(Result.exam_id == exam_id)
        
        if result_status is not None:
            query = query.filter(Result.result == result_status)
        
        results = query.order_by(Result.end_date.desc()).all()
        
        # Crear workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Evaluaciones"
        
        # Estilos
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="0066CC", end_color="0066CC", fill_type="solid")
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        center_align = Alignment(horizontal='center')
        
        # Título
        ws.merge_cells('A1:I1')
        ws['A1'] = f"Reporte de Evaluaciones - {campus.name}"
        ws['A1'].font = Font(bold=True, size=14)
        ws['A1'].alignment = Alignment(horizontal='center')
        
        # Fecha de generación
        ws.merge_cells('A2:I2')
        ws['A2'] = f"Generado el: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        ws['A2'].alignment = Alignment(horizontal='center')
        
        # Encabezados
        headers = ['Grupo', 'Candidato', 'CURP', 'Email', 'Examen', 'Calificación', 'Resultado', 'Fecha', 'Duración']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=4, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = center_align
        
        # Datos
        row_num = 5
        for result in results:
            candidate = User.query.get(result.user_id)
            exam = Exam.query.get(result.exam_id)
            
            member = GroupMember.query.filter(
                GroupMember.user_id == result.user_id,
                GroupMember.group_id.in_(group_ids)
            ).first()
            group = CandidateGroup.query.get(member.group_id) if member else None
            
            # Calcular duración en formato legible
            duration_str = ""
            if result.duration_seconds:
                mins = result.duration_seconds // 60
                secs = result.duration_seconds % 60
                duration_str = f"{mins}m {secs}s"
            
            ws.cell(row=row_num, column=1, value=group.name if group else "Sin grupo").border = thin_border
            ws.cell(row=row_num, column=2, value=candidate.full_name if candidate else "").border = thin_border
            ws.cell(row=row_num, column=3, value=candidate.curp if candidate else "").border = thin_border
            ws.cell(row=row_num, column=4, value=candidate.email if candidate else "").border = thin_border
            ws.cell(row=row_num, column=5, value=exam.name if exam else "").border = thin_border
            ws.cell(row=row_num, column=6, value=result.score).border = thin_border
            ws.cell(row=row_num, column=7, value="Aprobado" if result.result == 1 else "Reprobado").border = thin_border
            ws.cell(row=row_num, column=8, value=result.end_date.strftime('%d/%m/%Y %H:%M') if result.end_date else "").border = thin_border
            ws.cell(row=row_num, column=9, value=duration_str).border = thin_border
            
            row_num += 1
        
        # Ajustar anchos
        ws.column_dimensions['A'].width = 20
        ws.column_dimensions['B'].width = 30
        ws.column_dimensions['C'].width = 22
        ws.column_dimensions['D'].width = 30
        ws.column_dimensions['E'].width = 25
        ws.column_dimensions['F'].width = 12
        ws.column_dimensions['G'].width = 12
        ws.column_dimensions['H'].width = 18
        ws.column_dimensions['I'].width = 12
        
        # Guardar a BytesIO
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        filename = f"Evaluaciones_{campus.code}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/mi-plantel/groups', methods=['GET'])
@jwt_required()
@responsable_required
def get_mi_plantel_groups():
    """Obtener grupos del plantel del responsable"""
    try:
        user = g.current_user
        campus = Campus.query.get(user.campus_id)
        
        if not campus:
            return jsonify({'error': 'No se encontró el plantel asignado'}), 404
        
        groups = CandidateGroup.query.filter_by(campus_id=campus.id, is_active=True).all()
        
        return jsonify({
            'groups': [g.to_dict(include_members=False) for g in groups]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/mi-plantel/exams', methods=['GET'])
@jwt_required()
@responsable_required
def get_mi_plantel_exams():
    """Obtener exámenes asignados al plantel"""
    from app.models import Exam
    from app.models.partner import GroupExam
    
    try:
        user = g.current_user
        campus = Campus.query.get(user.campus_id)
        
        if not campus:
            return jsonify({'error': 'No se encontró el plantel asignado'}), 404
        
        # Obtener grupos del plantel
        groups = CandidateGroup.query.filter_by(campus_id=campus.id, is_active=True).all()
        group_ids = [g.id for g in groups]
        
        # Obtener exámenes asignados a los grupos
        exam_ids = db.session.query(GroupExam.exam_id).filter(
            GroupExam.group_id.in_(group_ids),
            GroupExam.is_active == True
        ).distinct().all()
        exam_ids = [e[0] for e in exam_ids]
        
        exams = Exam.query.filter(Exam.id.in_(exam_ids)).all() if exam_ids else []
        
        return jsonify({
            'exams': [{
                'id': exam.id,
                'name': exam.name,
                'version': exam.version,
                'description': exam.description
            } for exam in exams]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# ENDPOINTS PARA CANDIDATOS - Exámenes y Materiales Asignados
# =====================================================

@bp.route('/mis-examenes', methods=['GET'])
@jwt_required()
def get_mis_examenes():
    """Obtener exámenes asignados al candidato basándose en sus grupos"""
    from app.models import Exam
    from app.models.partner import GroupExam, GroupMember, GroupExamMember
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        # Solo para candidatos y responsables
        if user.role not in ['candidato', 'responsable']:
            return jsonify({'error': 'Acceso no autorizado'}), 403
        
        # Si es responsable, obtener exámenes del plantel
        if user.role == 'responsable':
            if not user.campus_id:
                return jsonify({'exams': [], 'total': 0, 'pages': 1, 'current_page': 1})
            
            campus = Campus.query.get(user.campus_id)
            if not campus:
                return jsonify({'exams': [], 'total': 0, 'pages': 1, 'current_page': 1})
            
            # Obtener grupos del plantel
            groups = CandidateGroup.query.filter_by(campus_id=campus.id, is_active=True).all()
            group_ids = [g.id for g in groups]
            
            # Obtener exámenes asignados a los grupos
            exam_ids = db.session.query(GroupExam.exam_id).filter(
                GroupExam.group_id.in_(group_ids),
                GroupExam.is_active == True
            ).distinct().all()
            exam_ids = [e[0] for e in exam_ids]
        else:
            # Para candidatos: obtener grupos donde es miembro activo
            memberships = GroupMember.query.filter_by(
                user_id=user_id,
                status='active'
            ).all()
            
            if not memberships:
                return jsonify({'exams': [], 'total': 0, 'pages': 1, 'current_page': 1})
            
            # Filtrar solo grupos que existen y están activos
            group_ids = []
            for m in memberships:
                group = CandidateGroup.query.filter_by(id=m.group_id, is_active=True).first()
                if group:
                    group_ids.append(m.group_id)
            
            if not group_ids:
                return jsonify({'exams': [], 'total': 0, 'pages': 1, 'current_page': 1})
            
            # Obtener exámenes asignados a esos grupos
            group_exams = GroupExam.query.filter(
                GroupExam.group_id.in_(group_ids),
                GroupExam.is_active == True
            ).all()
            
            # Filtrar por asignación específica si es individual
            exam_ids = set()
            for ge in group_exams:
                if ge.assignment_type == 'all' or ge.assignment_type is None:
                    # Asignado a todos los miembros del grupo
                    exam_ids.add(ge.exam_id)
                elif ge.assignment_type == 'selected':
                    # Verificar si el candidato está asignado específicamente
                    member_assignment = GroupExamMember.query.filter_by(
                        group_exam_id=ge.id,
                        user_id=user_id
                    ).first()
                    if member_assignment:
                        exam_ids.add(ge.exam_id)
            
            exam_ids = list(exam_ids)
        
        if not exam_ids:
            return jsonify({'exams': [], 'total': 0, 'pages': 1, 'current_page': 1})
        
        # Obtener los exámenes publicados
        exams = Exam.query.filter(
            Exam.id.in_(exam_ids),
            Exam.is_published == True
        ).order_by(Exam.updated_at.desc()).all()
        
        return jsonify({
            'exams': [exam.to_dict() for exam in exams],
            'total': len(exams),
            'pages': 1,
            'current_page': 1
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/mis-materiales', methods=['GET'])
@jwt_required()
def get_mis_materiales():
    """Obtener materiales de estudio asignados al candidato basándose en sus grupos"""
    from app.models.study_content import StudyMaterial
    from app.models.partner import GroupExam, GroupMember, GroupExamMaterial
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        # Solo para candidatos y responsables
        if user.role not in ['candidato', 'responsable']:
            return jsonify({'error': 'Acceso no autorizado'}), 403
        
        # Si es responsable, obtener materiales del plantel
        if user.role == 'responsable':
            if not user.campus_id:
                return jsonify({'materials': [], 'total': 0, 'pages': 1, 'current_page': 1})
            
            campus = Campus.query.get(user.campus_id)
            if not campus:
                return jsonify({'materials': [], 'total': 0, 'pages': 1, 'current_page': 1})
            
            # Obtener grupos del plantel
            groups = CandidateGroup.query.filter_by(campus_id=campus.id, is_active=True).all()
            group_ids = [g.id for g in groups]
            
            # Obtener exámenes asignados a los grupos
            group_exams = GroupExam.query.filter(
                GroupExam.group_id.in_(group_ids),
                GroupExam.is_active == True
            ).all()
            
            # Obtener materiales de esos exámenes
            material_ids = set()
            for ge in group_exams:
                materials = GroupExamMaterial.query.filter_by(
                    group_exam_id=ge.id,
                    is_included=True
                ).all()
                for m in materials:
                    material_ids.add(m.study_material_id)
        else:
            # Para candidatos: obtener grupos donde es miembro activo
            memberships = GroupMember.query.filter_by(
                user_id=user_id,
                status='active'
            ).all()
            
            if not memberships:
                return jsonify({'materials': [], 'total': 0, 'pages': 1, 'current_page': 1})
            
            # Filtrar solo grupos que existen y están activos
            group_ids = []
            for m in memberships:
                group = CandidateGroup.query.filter_by(id=m.group_id, is_active=True).first()
                if group:
                    group_ids.append(m.group_id)
            
            if not group_ids:
                return jsonify({'materials': [], 'total': 0, 'pages': 1, 'current_page': 1})
            
            # Obtener exámenes asignados a esos grupos
            group_exams = GroupExam.query.filter(
                GroupExam.group_id.in_(group_ids),
                GroupExam.is_active == True
            ).all()
            
            # Obtener materiales de esos exámenes
            material_ids = set()
            for ge in group_exams:
                # Verificar si el candidato tiene acceso al examen
                has_access = False
                if ge.assignment_type == 'all' or ge.assignment_type is None:
                    has_access = True
                elif ge.assignment_type == 'selected':
                    from app.models.partner import GroupExamMember
                    # La existencia del registro indica asignación
                    member_assignment = GroupExamMember.query.filter_by(
                        group_exam_id=ge.id,
                        user_id=user_id
                    ).first()
                    has_access = member_assignment is not None
                
                if has_access:
                    materials = GroupExamMaterial.query.filter_by(
                        group_exam_id=ge.id,
                        is_included=True
                    ).all()
                    for m in materials:
                        material_ids.add(m.study_material_id)
        
        material_ids = list(material_ids)
        
        if not material_ids:
            return jsonify({'materials': [], 'total': 0, 'pages': 1, 'current_page': 1})
        
        # Obtener los materiales publicados
        materials = StudyMaterial.query.filter(
            StudyMaterial.id.in_(material_ids),
            StudyMaterial.is_published == True
        ).order_by(StudyMaterial.updated_at.desc()).all()
        
        return jsonify({
            'materials': [m.to_dict() for m in materials],
            'total': len(materials),
            'pages': 1,
            'current_page': 1
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============== ELIMINACIÓN COMPLETA DE GRUPOS (SOLO ADMIN) ==============

@bp.route('/groups/<int:group_id>/hard-delete', methods=['DELETE'])
@jwt_required()
def hard_delete_group(group_id):
    """
    Eliminar completamente un grupo y todas sus relaciones.
    SOLO PARA USUARIOS ADMIN.
    Elimina:
    - GroupMember (membresías)
    - GroupExamMember (asignaciones individuales de exámenes)
    - GroupExamMaterial (materiales de exámenes)
    - GroupExam (exámenes asignados al grupo)
    - GroupStudyMaterialMember (asignaciones individuales de materiales)
    - GroupStudyMaterial (materiales asignados directamente)
    - CandidateGroup (el grupo)
    """
    from app.models.partner import (
        GroupMember, GroupExam, GroupExamMember, GroupExamMaterial,
        GroupStudyMaterial, GroupStudyMaterialMember
    )
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user or user.role != 'admin':
            return jsonify({'error': 'Solo los administradores pueden eliminar grupos permanentemente'}), 403
        
        group = CandidateGroup.query.get(group_id)
        
        if not group:
            return jsonify({'error': 'Grupo no encontrado'}), 404
        
        group_name = group.name
        
        # Estadísticas de lo que se va a eliminar
        stats = {
            'members': 0,
            'exam_assignments': 0,
            'exam_member_assignments': 0,
            'exam_materials': 0,
            'study_materials': 0,
            'study_material_members': 0
        }
        
        # 1. Eliminar asignaciones de miembros a exámenes del grupo (GroupExamMember)
        group_exams = GroupExam.query.filter_by(group_id=group_id).all()
        for ge in group_exams:
            # Eliminar materiales del examen
            materials_deleted = GroupExamMaterial.query.filter_by(group_exam_id=ge.id).delete()
            stats['exam_materials'] += materials_deleted
            
            # Eliminar asignaciones individuales
            members_deleted = GroupExamMember.query.filter_by(group_exam_id=ge.id).delete()
            stats['exam_member_assignments'] += members_deleted
        
        # 2. Eliminar exámenes asignados al grupo (GroupExam)
        stats['exam_assignments'] = GroupExam.query.filter_by(group_id=group_id).delete()
        
        # 3. Eliminar asignaciones de materiales de estudio directos
        group_materials = GroupStudyMaterial.query.filter_by(group_id=group_id).all()
        for gm in group_materials:
            # Eliminar asignaciones individuales de materiales
            deleted = GroupStudyMaterialMember.query.filter_by(group_study_material_id=gm.id).delete()
            stats['study_material_members'] += deleted
        
        stats['study_materials'] = GroupStudyMaterial.query.filter_by(group_id=group_id).delete()
        
        # 4. Eliminar membresías (GroupMember)
        stats['members'] = GroupMember.query.filter_by(group_id=group_id).delete()
        
        # 5. Eliminar el grupo
        db.session.delete(group)
        db.session.commit()
        
        return jsonify({
            'message': f'Grupo "{group_name}" eliminado permanentemente',
            'deleted': stats
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/admin/cleanup-orphan-memberships', methods=['POST'])
@jwt_required()
def cleanup_orphan_memberships():
    """
    Limpia membresías huérfanas (de grupos que ya no existen).
    SOLO PARA USUARIOS ADMIN.
    """
    from app.models.partner import GroupMember
    
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user or user.role != 'admin':
            return jsonify({'error': 'Solo los administradores pueden ejecutar esta operación'}), 403
        
        # Encontrar membresías huérfanas
        orphan_memberships = db.session.query(GroupMember).outerjoin(
            CandidateGroup, GroupMember.group_id == CandidateGroup.id
        ).filter(CandidateGroup.id == None).all()
        
        count = len(orphan_memberships)
        
        for m in orphan_memberships:
            db.session.delete(m)
        
        db.session.commit()
        
        return jsonify({
            'message': f'Se eliminaron {count} membresías huérfanas',
            'deleted_count': count
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============== ASIGNACIÓN MASIVA DE EXÁMENES POR ECM ==============

@bp.route('/groups/<int:group_id>/exams/bulk-assign-template', methods=['GET'])
@jwt_required()
@coordinator_required
def download_bulk_exam_assign_template(group_id):
    """
    Descargar plantilla Excel para asignación masiva de exámenes.
    La plantilla incluye los miembros del grupo y columnas para indicar el código ECM.
    """
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
    from openpyxl.utils import get_column_letter
    from flask import send_file
    
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        
        # Obtener miembros del grupo
        members = group.members.filter_by(is_active=True).all()
        if not members:
            return jsonify({'error': 'El grupo no tiene miembros activos'}), 400
        
        # Crear workbook
        wb = Workbook()
        
        # === Hoja 1: Plantilla de Asignación ===
        ws = wb.active
        ws.title = "Asignación Exámenes"
        
        # Estilos
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Headers
        headers = ['ID Usuario', 'Nombre Completo', 'Email', 'CURP', 'Código ECM']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = Alignment(horizontal='center')
        
        # Datos de miembros
        for row, member in enumerate(members, 2):
            user = member.user
            if user:
                ws.cell(row=row, column=1, value=user.id).border = thin_border
                ws.cell(row=row, column=2, value=user.full_name).border = thin_border
                ws.cell(row=row, column=3, value=user.email).border = thin_border
                ws.cell(row=row, column=4, value=user.curp or '').border = thin_border
                # Columna ECM vacía para que el usuario la llene
                ws.cell(row=row, column=5, value='').border = thin_border
        
        # Ajustar anchos de columna
        ws.column_dimensions['A'].width = 40
        ws.column_dimensions['B'].width = 35
        ws.column_dimensions['C'].width = 35
        ws.column_dimensions['D'].width = 22
        ws.column_dimensions['E'].width = 20
        
        # === Hoja 2: Catálogo de ECM disponibles ===
        ws2 = wb.create_sheet(title="Catálogo ECM")
        
        # Headers para catálogo
        catalog_headers = ['Código ECM', 'Nombre del Examen', 'Marca', 'Sector']
        for col, header in enumerate(catalog_headers, 1):
            cell = ws2.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
            cell.border = thin_border
            cell.alignment = Alignment(horizontal='center')
        
        # Obtener ECMs con exámenes publicados
        from app.models.competency_standard import CompetencyStandard
        from app.models.exam import Exam
        
        ecms = CompetencyStandard.query.filter(
            CompetencyStandard.is_active == True,
            CompetencyStandard.exams.any(Exam.is_active == True, Exam.is_published == True)
        ).order_by(CompetencyStandard.code).all()
        
        for row, ecm in enumerate(ecms, 2):
            ws2.cell(row=row, column=1, value=ecm.code).border = thin_border
            ws2.cell(row=row, column=2, value=ecm.name).border = thin_border
            ws2.cell(row=row, column=3, value=ecm.brand.name if ecm.brand else 'N/A').border = thin_border
            ws2.cell(row=row, column=4, value=ecm.sector or 'N/A').border = thin_border
        
        # Ajustar anchos
        ws2.column_dimensions['A'].width = 15
        ws2.column_dimensions['B'].width = 50
        ws2.column_dimensions['C'].width = 20
        ws2.column_dimensions['D'].width = 30
        
        # === Hoja 3: Instrucciones ===
        ws3 = wb.create_sheet(title="Instrucciones")
        
        instructions = [
            ("INSTRUCCIONES DE USO", None),
            ("", None),
            ("1. En la hoja 'Asignación Exámenes', complete la columna 'Código ECM' para cada candidato.", None),
            ("2. Use los códigos de la hoja 'Catálogo ECM' como referencia.", None),
            ("3. Puede asignar diferentes exámenes a diferentes candidatos.", None),
            ("4. Si deja la columna ECM vacía, ese candidato no recibirá asignación.", None),
            ("5. Suba este archivo en el sistema para procesar las asignaciones.", None),
            ("", None),
            ("NOTAS IMPORTANTES:", None),
            ("- Solo se procesarán códigos ECM válidos del catálogo.", None),
            ("- Los exámenes deben estar publicados para poder asignarse.", None),
            ("- Si un candidato ya tiene el examen asignado, se omitirá.", None),
        ]
        
        for row, (text, _) in enumerate(instructions, 1):
            cell = ws3.cell(row=row, column=1, value=text)
            if row == 1 or row == 9:
                cell.font = Font(bold=True, size=12)
            else:
                cell.font = Font(size=11)
        
        ws3.column_dimensions['A'].width = 80
        
        # Guardar en memoria
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        filename = f"plantilla_asignacion_examenes_{group.name.replace(' ', '_')}_{group_id}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/groups/<int:group_id>/exams/bulk-assign', methods=['POST'])
@jwt_required()
@coordinator_required
def bulk_assign_exams_by_ecm(group_id):
    """
    Procesar archivo Excel y asignar exámenes masivamente usando código ECM.
    
    El archivo debe tener las columnas:
    - ID Usuario
    - Código ECM
    
    Parámetros adicionales (JSON o form-data):
    - time_limit_minutes: Límite de tiempo (opcional)
    - passing_score: Puntaje mínimo (opcional)
    - max_attempts: Máximo de intentos (default: 2)
    - max_disconnections: Máximo de desconexiones (default: 3)
    - exam_content_type: 'questions_only', 'exercises_only', 'mixed' (default: 'questions_only')
    """
    import io
    from openpyxl import load_workbook
    from app.models import GroupExam, Exam
    from app.models.partner import GroupExamMember
    from app.models.competency_standard import CompetencyStandard
    
    try:
        group = CandidateGroup.query.get_or_404(group_id)
        
        # Verificar que se envió un archivo
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        
        file = request.files['file']
        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({'error': 'El archivo debe ser Excel (.xlsx o .xls)'}), 400
        
        # Obtener configuración adicional
        config = {
            'time_limit_minutes': request.form.get('time_limit_minutes', type=int),
            'passing_score': request.form.get('passing_score', type=int),
            'max_attempts': request.form.get('max_attempts', 2, type=int),
            'max_disconnections': request.form.get('max_disconnections', 3, type=int),
            'exam_content_type': request.form.get('exam_content_type', 'questions_only'),
        }
        
        # Leer archivo Excel
        wb = load_workbook(io.BytesIO(file.read()))
        ws = wb.active
        
        # Obtener headers
        headers = [cell.value for cell in ws[1]]
        
        # Encontrar columnas
        user_id_col = None
        ecm_col = None
        
        for idx, header in enumerate(headers):
            if header:
                header_lower = str(header).lower().strip()
                if 'id' in header_lower and 'usuario' in header_lower:
                    user_id_col = idx
                elif 'ecm' in header_lower or 'código' in header_lower:
                    ecm_col = idx
        
        if user_id_col is None or ecm_col is None:
            return jsonify({
                'error': 'El archivo debe tener columnas "ID Usuario" y "Código ECM"'
            }), 400
        
        # Procesar filas
        results = {
            'processed': 0,
            'assigned': [],
            'skipped': [],
            'errors': []
        }
        
        # Cache de ECM a Exam
        ecm_exam_cache = {}
        
        # Obtener miembros del grupo
        group_member_ids = set(m.user_id for m in group.members.all())
        
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[user_id_col] or not row[ecm_col]:
                continue
            
            user_id = str(row[user_id_col]).strip()
            ecm_code = str(row[ecm_col]).strip().upper()
            
            results['processed'] += 1
            
            # Verificar que el usuario sea miembro del grupo
            if user_id not in group_member_ids:
                results['errors'].append({
                    'row': row_num,
                    'user_id': user_id,
                    'ecm': ecm_code,
                    'error': 'Usuario no es miembro del grupo'
                })
                continue
            
            # Obtener examen del ECM (usar cache)
            if ecm_code not in ecm_exam_cache:
                ecm = CompetencyStandard.query.filter(
                    db.func.upper(CompetencyStandard.code) == ecm_code,
                    CompetencyStandard.is_active == True
                ).first()
                
                if ecm:
                    # Obtener examen activo más reciente
                    exam = ecm.exams.filter_by(is_active=True, is_published=True).order_by(
                        Exam.created_at.desc()
                    ).first()
                    ecm_exam_cache[ecm_code] = exam
                else:
                    ecm_exam_cache[ecm_code] = None
            
            exam = ecm_exam_cache[ecm_code]
            
            if not exam:
                results['errors'].append({
                    'row': row_num,
                    'user_id': user_id,
                    'ecm': ecm_code,
                    'error': f'Código ECM "{ecm_code}" no encontrado o sin examen publicado'
                })
                continue
            
            # Verificar si ya existe asignación para este grupo y examen
            group_exam = GroupExam.query.filter_by(
                group_id=group_id, 
                exam_id=exam.id,
                is_active=True
            ).first()
            
            # Si no existe, crear nueva asignación tipo 'selected'
            if not group_exam:
                group_exam = GroupExam(
                    group_id=group_id,
                    exam_id=exam.id,
                    assigned_by_id=g.current_user.id,
                    assignment_type='selected',
                    time_limit_minutes=config['time_limit_minutes'],
                    passing_score=config['passing_score'],
                    max_attempts=config['max_attempts'],
                    max_disconnections=config['max_disconnections'],
                    exam_content_type=config['exam_content_type']
                )
                db.session.add(group_exam)
                db.session.flush()
            
            # Verificar si el usuario ya tiene este examen asignado
            existing_member = GroupExamMember.query.filter_by(
                group_exam_id=group_exam.id,
                user_id=user_id
            ).first()
            
            if existing_member:
                results['skipped'].append({
                    'row': row_num,
                    'user_id': user_id,
                    'ecm': ecm_code,
                    'reason': 'Usuario ya tiene este examen asignado'
                })
                continue
            
            # Si el GroupExam es tipo 'all', verificar si el usuario es miembro del grupo
            if group_exam.assignment_type == 'all':
                results['skipped'].append({
                    'row': row_num,
                    'user_id': user_id,
                    'ecm': ecm_code,
                    'reason': 'El examen está asignado a todo el grupo'
                })
                continue
            
            # Crear asignación de miembro
            member = GroupExamMember(
                group_exam_id=group_exam.id,
                user_id=user_id
            )
            db.session.add(member)
            
            results['assigned'].append({
                'row': row_num,
                'user_id': user_id,
                'ecm': ecm_code,
                'exam_name': exam.name
            })
        
        db.session.commit()
        
        return jsonify({
            'message': f'Procesamiento completado. {len(results["assigned"])} asignaciones realizadas.',
            'results': results,
            'summary': {
                'total_processed': results['processed'],
                'assigned': len(results['assigned']),
                'skipped': len(results['skipped']),
                'errors': len(results['errors'])
            }
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
