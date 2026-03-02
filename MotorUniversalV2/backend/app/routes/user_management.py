"""
Rutas para gestión de usuarios (admin y coordinadores)
"""
from flask import Blueprint, request, jsonify, g
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, and_, func, case, text
from datetime import datetime
from app import db, cache
from app.models import User
from app.models.user import encrypt_password
import uuid
import re

bp = Blueprint('user_management', __name__, url_prefix='/api/user-management')

# Roles disponibles en el sistema (sin alumno)
AVAILABLE_ROLES = ['admin', 'developer', 'gerente', 'financiero', 'editor', 'editor_invitado', 'soporte', 'coordinator', 'responsable', 'responsable_partner', 'candidato', 'auxiliar']

# Roles que puede crear cada tipo de usuario
ROLE_CREATE_PERMISSIONS = {
    'admin': ['developer', 'gerente', 'financiero', 'editor', 'editor_invitado', 'soporte', 'coordinator', 'responsable', 'responsable_partner', 'candidato', 'auxiliar'],  # Todo menos admin
    'developer': ['gerente', 'financiero', 'editor', 'editor_invitado', 'soporte', 'coordinator', 'responsable', 'responsable_partner', 'candidato', 'auxiliar'],  # Todo menos admin y developer
    'coordinator': ['responsable', 'responsable_partner', 'candidato']  # Responsables, Responsables del Partner y candidatos
}


def management_required(f):
    """Decorador que requiere rol de admin, developer o coordinator"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'No autorizado'}), 401
        if user.role not in ['admin', 'developer', 'coordinator']:
            return jsonify({'error': 'Acceso denegado. Se requiere rol de administrador, desarrollador o coordinador'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorador que requiere rol de admin o developer"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'No autorizado'}), 401
        if user.role not in ['admin', 'developer']:
            return jsonify({'error': 'Acceso denegado. Se requiere rol de administrador'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def validate_email(email):
    """Validar formato de email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password(password):
    """Validar requisitos de contraseña"""
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres"
    if not re.search(r'[A-Z]', password):
        return False, "La contraseña debe tener al menos una mayúscula"
    if not re.search(r'[a-z]', password):
        return False, "La contraseña debe tener al menos una minúscula"
    if not re.search(r'[0-9]', password):
        return False, "La contraseña debe tener al menos un número"
    return True, None


# ============== LISTAR USUARIOS ==============

@bp.route('/users', methods=['GET'])
@jwt_required()
@management_required
def list_users():
    """
    Listar usuarios según permisos del solicitante.
    Optimizado para escalar a 100K+ usuarios con:
    - Select específico de columnas (evita SELECT *)
    - Cursor-based pagination opcional
    - Índices optimizados
    """
    try:
        current_user = g.current_user
        
        # Parámetros de paginación
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)  # Max 100 por página
        
        # Cursor-based pagination (más eficiente para grandes datasets)
        cursor = request.args.get('cursor', '')  # ID del último usuario
        cursor_date = request.args.get('cursor_date', '')  # Fecha del último usuario
        use_cursor = cursor and cursor_date
        
        # Filtros
        search = request.args.get('search', '').strip()
        role_filter = request.args.get('role', '')
        active_filter = request.args.get('is_active', '')
        created_from = request.args.get('created_from', '').strip()
        created_to = request.args.get('created_to', '').strip()
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Seleccionar solo las columnas necesarias para la lista (evita cargar todo)
        columns = [
            User.id, User.email, User.username, User.name, User.first_surname,
            User.second_surname, User.gender, User.role, User.is_active,
            User.is_verified, User.created_at, User.last_login, User.curp,
            User.phone, User.campus_id, User.date_of_birth,
            User.can_bulk_create_candidates, User.can_manage_groups, User.can_view_reports,
            User.enable_evaluation_report, User.enable_certificate,
            User.enable_conocer_certificate, User.enable_digital_badge
        ]
        
        query = db.session.query(*columns)
        
        # Coordinadores ven candidatos, responsables y responsables del partner
        if current_user.role == 'coordinator':
            query = query.filter(User.role.in_(['candidato', 'responsable', 'responsable_partner']))
            # Multi-tenant: solo ve usuarios que le pertenecen
            query = query.filter(User.coordinator_id == current_user.id)
        
        # Filtros
        if role_filter:
            roles = [r.strip() for r in role_filter.split(',') if r.strip()]
            if len(roles) == 1:
                query = query.filter(User.role == roles[0])
            elif len(roles) > 1:
                query = query.filter(User.role.in_(roles))
            
        if active_filter != '':
            is_active = active_filter.lower() == 'true'
            query = query.filter(User.is_active == is_active)
        
        # Búsqueda optimizada
        if search:
            search_term = f'%{search}%'
            # Intentar usar búsqueda por prefijo si es corta (más eficiente con índices)
            if len(search) <= 3:
                search_prefix = f'{search}%'
                query = query.filter(
                    or_(
                        User.name.ilike(search_prefix),
                        User.first_surname.ilike(search_prefix),
                        User.email.ilike(search_prefix),
                        User.curp.ilike(search_prefix),
                        User.username.ilike(search_prefix)
                    )
                )
            else:
                query = query.filter(
                    or_(
                        User.name.ilike(search_term),
                        User.first_surname.ilike(search_term),
                        User.email.ilike(search_term),
                        User.curp.ilike(search_term),
                        User.username.ilike(search_term)
                    )
                )
        
        # Filtros de fecha de creación
        if created_from:
            try:
                date_from = datetime.fromisoformat(created_from)
                query = query.filter(User.created_at >= date_from)
            except ValueError:
                pass
        if created_to:
            try:
                date_to = datetime.fromisoformat(created_to + 'T23:59:59') if 'T' not in created_to else datetime.fromisoformat(created_to)
                query = query.filter(User.created_at <= date_to)
            except ValueError:
                pass
        
        # Ordenamiento dinámico
        sort_columns = {
            'name': User.name,
            'full_name': User.first_surname,
            'email': User.email,
            'role': User.role,
            'is_active': User.is_active,
            'created_at': User.created_at,
            'last_login': User.last_login,
            'curp': User.curp
        }
        
        sort_column = sort_columns.get(sort_by, User.created_at)
        
        # Cursor-based pagination (más eficiente para páginas > 100)
        if use_cursor and sort_by == 'created_at':
            try:
                cursor_datetime = datetime.fromisoformat(cursor_date)
                if sort_order == 'desc':
                    query = query.filter(
                        or_(
                            User.created_at < cursor_datetime,
                            and_(User.created_at == cursor_datetime, User.id < cursor)
                        )
                    )
                else:
                    query = query.filter(
                        or_(
                            User.created_at > cursor_datetime,
                            and_(User.created_at == cursor_datetime, User.id > cursor)
                        )
                    )
            except ValueError:
                pass  # Invalid cursor, use offset pagination
        
        # Aplicar ordenamiento
        if sort_order == 'asc':
            query = query.order_by(sort_column.asc(), User.id.asc())
        else:
            query = query.order_by(sort_column.desc(), User.id.desc())
        
        # Contar total solo si no usamos cursor (es costoso)
        if use_cursor:
            # Con cursor, estimamos el total o lo cacheamos
            total = _get_cached_user_count(current_user.role, role_filter, active_filter, coordinator_id=current_user.id if current_user.role == 'coordinator' else None)
            users_data = query.limit(per_page + 1).all()  # +1 para saber si hay más
            has_more = len(users_data) > per_page
            users_data = users_data[:per_page]
            pages = -1  # Indicar que usamos cursor
        else:
            # Paginación tradicional con offset
            total = query.count()
            pages = (total + per_page - 1) // per_page
            offset = (page - 1) * per_page
            users_data = query.offset(offset).limit(per_page).all()
            has_more = page < pages
        
        # Convertir resultados a diccionarios
        users_list = []
        for row in users_data:
            full_name = ' '.join(filter(None, [row.name, row.first_surname, row.second_surname]))
            users_list.append({
                'id': row.id,
                'email': row.email,
                'username': row.username,
                'name': row.name,
                'first_surname': row.first_surname,
                'second_surname': row.second_surname,
                'full_name': full_name,
                'gender': row.gender,
                'role': row.role,
                'is_active': row.is_active,
                'is_verified': row.is_verified,
                'created_at': row.created_at.isoformat() if row.created_at else None,
                'last_login': row.last_login.isoformat() if row.last_login else None,
                'curp': row.curp,
                'phone': row.phone,
                'campus_id': row.campus_id,
                'date_of_birth': row.date_of_birth.isoformat() if row.date_of_birth else None,
                'can_bulk_create_candidates': row.can_bulk_create_candidates,
                'can_manage_groups': row.can_manage_groups,
                'can_view_reports': row.can_view_reports,
                'document_options': {
                    'evaluation_report': row.enable_evaluation_report,
                    'certificate': row.enable_certificate,
                    'conocer_certificate': row.enable_conocer_certificate,
                    'digital_badge': row.enable_digital_badge
                }
            })
        
        # Generar cursor para siguiente página
        next_cursor = None
        next_cursor_date = None
        if users_list and has_more:
            last_user = users_list[-1]
            next_cursor = last_user['id']
            next_cursor_date = last_user['created_at']
        
        return jsonify({
            'users': users_list,
            'total': total,
            'pages': pages,
            'current_page': page,
            'has_more': has_more,
            'next_cursor': next_cursor,
            'next_cursor_date': next_cursor_date
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def _get_cached_user_count(user_role, role_filter='', active_filter='', coordinator_id=None):
    """
    Obtener conteo de usuarios con caché.
    El conteo exacto es costoso, así que lo cacheamos por 5 minutos.
    """
    cache_key = f'user_count_{user_role}_{role_filter}_{active_filter}_{coordinator_id or "all"}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    query = User.query
    if user_role == 'coordinator':
        query = query.filter(User.role.in_(['candidato', 'responsable', 'responsable_partner']))
        if coordinator_id:
            query = query.filter(User.coordinator_id == coordinator_id)
    if role_filter:
        roles = [r.strip() for r in role_filter.split(',') if r.strip()]
        query = query.filter(User.role.in_(roles))
    if active_filter:
        is_active = active_filter.lower() == 'true'
        query = query.filter(User.is_active == is_active)
    
    count = query.count()
    cache.set(cache_key, count, timeout=300)  # 5 minutos
    return count


@bp.route('/users/<string:user_id>', methods=['GET'])
@jwt_required()
@management_required
def get_user_detail(user_id):
    """Obtener detalle de un usuario"""
    try:
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        
        # Coordinadores pueden ver candidatos, responsables y responsables del partner
        if current_user.role == 'coordinator':
            if user.role not in ['candidato', 'responsable', 'responsable_partner']:
                return jsonify({'error': 'No tienes permiso para ver este usuario'}), 403
            # Multi-tenant: solo puede ver usuarios que le pertenecen
            if user.coordinator_id != current_user.id:
                return jsonify({'error': 'No tienes permiso para ver este usuario'}), 403
        
        return jsonify({
            'user': user.to_dict(include_private=True, include_partners=True)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== VERIFICACIÓN DE SIMILITUD DE NOMBRE ==============

@bp.route('/users/check-name-similarity', methods=['POST'])
@jwt_required()
@management_required
def check_name_similarity():
    """
    Busca usuarios existentes con nombre similar (exacto o parcial).
    Se usa antes de crear un usuario para advertir sobre posibles duplicados.
    Retorna lista de coincidencias con su nivel de similitud.
    """
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        first_surname = (data.get('first_surname') or '').strip()
        second_surname = (data.get('second_surname') or '').strip()

        if not name or not first_surname:
            return jsonify({'similar_users': [], 'has_exact_match': False}), 200

        similar = []
        seen_ids = set()

        # 1. Coincidencia EXACTA: nombre + primer_apellido + segundo_apellido
        exact_filters = [
            func.lower(func.ltrim(func.rtrim(User.name))) == name.lower(),
            func.lower(func.ltrim(func.rtrim(User.first_surname))) == first_surname.lower(),
            User.is_active == True,
        ]
        if second_surname:
            exact_filters.append(
                func.lower(func.ltrim(func.rtrim(User.second_surname))) == second_surname.lower()
            )

        exact_matches = User.query.filter(and_(*exact_filters)).limit(10).all()
        for u in exact_matches:
            if u.id not in seen_ids:
                seen_ids.add(u.id)
                similar.append({
                    'id': u.id,
                    'full_name': u.full_name,
                    'email': u.email,
                    'curp': u.curp,
                    'username': u.username,
                    'role': u.role,
                    'is_active': u.is_active,
                    'match_level': 'exact',
                    'match_description': 'Nombre completo idéntico',
                })

        # 2. Coincidencia PARCIAL: nombre + primer_apellido (sin segundo apellido)
        if second_surname:
            partial_matches = User.query.filter(
                func.lower(func.ltrim(func.rtrim(User.name))) == name.lower(),
                func.lower(func.ltrim(func.rtrim(User.first_surname))) == first_surname.lower(),
                User.is_active == True,
                or_(
                    User.second_surname == None,
                    func.lower(func.ltrim(func.rtrim(User.second_surname))) != second_surname.lower()
                )
            ).limit(10).all()
            for u in partial_matches:
                if u.id not in seen_ids:
                    seen_ids.add(u.id)
                    similar.append({
                        'id': u.id,
                        'full_name': u.full_name,
                        'email': u.email,
                        'curp': u.curp,
                        'username': u.username,
                        'role': u.role,
                        'is_active': u.is_active,
                        'match_level': 'partial',
                        'match_description': f'Mismo nombre y primer apellido (segundo apellido diferente: {u.second_surname or "sin dato"})',
                    })

        # 3. Coincidencia por primer_apellido + segundo_apellido (mismos apellidos, nombre diferente)
        if second_surname:
            surname_matches = User.query.filter(
                func.lower(func.ltrim(func.rtrim(User.first_surname))) == first_surname.lower(),
                func.lower(func.ltrim(func.rtrim(User.second_surname))) == second_surname.lower(),
                func.lower(func.ltrim(func.rtrim(User.name))) != name.lower(),
                User.is_active == True,
            ).limit(5).all()
            for u in surname_matches:
                if u.id not in seen_ids:
                    seen_ids.add(u.id)
                    similar.append({
                        'id': u.id,
                        'full_name': u.full_name,
                        'email': u.email,
                        'curp': u.curp,
                        'username': u.username,
                        'role': u.role,
                        'is_active': u.is_active,
                        'match_level': 'surname',
                        'match_description': f'Mismos apellidos, nombre diferente ({u.name})',
                    })

        has_exact = any(s['match_level'] == 'exact' for s in similar)

        return jsonify({
            'similar_users': similar[:20],
            'has_exact_match': has_exact,
            'total_found': len(similar),
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== CREAR USUARIOS ==============

@bp.route('/users', methods=['POST'])
@jwt_required()
@management_required
def create_user():
    """Crear un nuevo usuario"""
    try:
        from app.models.partner import Campus
        
        current_user = g.current_user
        data = request.get_json()
        
        # Validar campos requeridos básicos (name, first_surname, role)
        required_fields = ['name', 'first_surname', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'El campo {field} es requerido'}), 400
        
        role = data['role']
        
        # Email es requerido para todos EXCEPTO candidatos (opcional para candidatos)
        if role != 'candidato' and not data.get('email'):
            return jsonify({'error': 'El campo email es requerido'}), 400
        
        # Para candidatos: CURP y email son opcionales
        # - Sin email: no puede recibir insignia digital
        # - Sin CURP: no puede recibir certificado CONOCER
        if role == 'candidato':
            # Solo second_surname y gender son obligatorios para candidatos
            candidato_required = ['second_surname', 'gender']
            field_names = {'second_surname': 'segundo apellido', 'gender': 'género'}
            for field in candidato_required:
                if not data.get(field):
                    return jsonify({'error': f'El campo {field_names[field]} es requerido para candidatos'}), 400
        
        # Para responsables, campos adicionales son obligatorios
        if role == 'responsable':
            responsable_required = ['second_surname', 'curp', 'gender', 'date_of_birth', 'campus_id']
            field_names = {
                'second_surname': 'segundo apellido',
                'curp': 'CURP',
                'gender': 'género',
                'date_of_birth': 'fecha de nacimiento',
                'campus_id': 'plantel'
            }
            for field in responsable_required:
                if not data.get(field):
                    return jsonify({'error': f'El campo {field_names[field]} es requerido para responsables'}), 400
            
            # Validar que el campus exista
            campus = Campus.query.get(data['campus_id'])
            if not campus:
                return jsonify({'error': 'El plantel especificado no existe'}), 404
            
            # Validar fecha de nacimiento
            from datetime import datetime as dt
            try:
                date_of_birth = dt.strptime(data['date_of_birth'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Formato de fecha de nacimiento inválido. Use YYYY-MM-DD'}), 400
            
            # Validar género
            if data['gender'] not in ['M', 'F', 'O']:
                return jsonify({'error': 'Género inválido. Use M (masculino), F (femenino) u O (otro)'}), 400
        
        # Para responsable_partner, partner_id es obligatorio
        if role == 'responsable_partner':
            if not data.get('partner_id'):
                return jsonify({'error': 'Debe seleccionar un partner para el responsable del partner'}), 400
            from app.models.partner import Partner
            partner = Partner.query.get(data['partner_id'])
            if not partner:
                return jsonify({'error': 'El partner especificado no existe'}), 404
        
        # Email es opcional para candidatos
        email = None
        if data.get('email'):
            email = data['email'].strip().lower()
            
            # Validar formato email
            if not validate_email(email):
                return jsonify({'error': 'Formato de email inválido'}), 400
            
            # Verificar email único (solo si se proporciona)
            if User.query.filter_by(email=email).first():
                return jsonify({'error': 'Ya existe un usuario con ese email'}), 400
        
        # Generar contraseña automática para TODOS los usuarios
        import secrets
        password = secrets.token_urlsafe(12)  # Contraseña segura de 16 caracteres
        
        # Validar contraseña
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Verificar permisos de creación según rol
        allowed_roles = ROLE_CREATE_PERMISSIONS.get(current_user.role, [])
        if role not in allowed_roles:
            if current_user.role == 'coordinator':
                return jsonify({'error': 'Los coordinadores solo pueden crear usuarios de tipo candidato'}), 403
            else:
                return jsonify({'error': f'No tienes permiso para crear usuarios con rol {role}'}), 403
        
        # Verificar CURP único si se proporciona (solo para roles diferentes a editor/editor_invitado/gerente/financiero)
        if data.get('curp') and role not in ['editor', 'editor_invitado', 'gerente', 'financiero']:
            curp = data['curp'].upper().strip()
            if User.query.filter_by(curp=curp).first():
                return jsonify({'error': 'Ya existe un usuario con ese CURP'}), 400
        
        # Generar username automáticamente (10 caracteres alfanuméricos únicos EN MAYÚSCULAS)
        import random
        import string
        
        def generate_unique_username():
            """Genera un username único de 10 caracteres alfanuméricos en MAYÚSCULAS"""
            chars = string.ascii_uppercase + string.digits
            while True:
                username = ''.join(random.choices(chars, k=10))
                if not User.query.filter_by(username=username).first():
                    return username
        
        username = generate_unique_username()
        
        # Para usuarios tipo editor o candidato, no guardar phone
        # Para usuarios tipo editor/gerente/financiero, no guardar CURP ni phone
        user_curp = None
        user_phone = None
        user_date_of_birth = None
        user_campus_id = None
        
        if role not in ['editor', 'editor_invitado', 'candidato', 'gerente', 'financiero']:
            # Solo admin/coordinator/responsable pueden tener teléfono
            user_phone = data.get('phone', '').strip() or None
        if role not in ['editor', 'editor_invitado', 'gerente', 'financiero']:
            # Solo candidatos, responsables y otros roles (no editor/gerente/financiero) pueden tener CURP
            user_curp = data.get('curp', '').upper().strip() or None
        
        # Para responsables, campos adicionales
        if role == 'responsable':
            from datetime import datetime as dt
            user_date_of_birth = dt.strptime(data['date_of_birth'], '%Y-%m-%d').date()
            user_campus_id = data['campus_id']
        
        # Crear usuario
        # Determinar coordinator_id para multi-tenancy
        user_coordinator_id = None
        if current_user.role == 'coordinator' and role in ['candidato', 'responsable', 'responsable_partner']:
            user_coordinator_id = current_user.id
        elif current_user.role in ['admin', 'developer'] and role in ['responsable', 'candidato'] and user_campus_id:
            # Admin/developer creando responsable/candidato: buscar el coordinador del campus
            from app.models.partner import Campus as CampusLookup, Partner as PartnerLookup, user_partners as up_table
            campus_lookup = CampusLookup.query.get(user_campus_id)
            if campus_lookup and campus_lookup.partner_id:
                # Buscar coordinador asociado al partner del campus
                coord_row = db.session.query(up_table.c.user_id).join(
                    User, User.id == up_table.c.user_id
                ).filter(
                    up_table.c.partner_id == campus_lookup.partner_id,
                    User.role == 'coordinator',
                    User.is_active == True
                ).first()
                if coord_row:
                    user_coordinator_id = coord_row[0]
        elif current_user.role in ['admin', 'developer'] and role == 'responsable_partner' and data.get('partner_id'):
            # Admin creando responsable_partner: buscar el coordinador del partner
            from app.models.partner import user_partners as up_table2
            coord_row2 = db.session.query(up_table2.c.user_id).join(
                User, User.id == up_table2.c.user_id
            ).filter(
                up_table2.c.partner_id == data['partner_id'],
                User.role == 'coordinator',
                User.is_active == True
            ).first()
            if coord_row2:
                user_coordinator_id = coord_row2[0]
        
        new_user = User(
            id=str(uuid.uuid4()),
            email=email,
            username=username,
            name=data['name'].strip(),
            first_surname=data['first_surname'].strip(),
            second_surname=data.get('second_surname', '').strip() or None,
            gender=data.get('gender'),
            curp=user_curp,
            phone=user_phone,
            role=role,
            campus_id=user_campus_id,
            date_of_birth=user_date_of_birth,
            coordinator_id=user_coordinator_id,
            is_active=data.get('is_active', True),
            is_verified=True if role == 'responsable' else data.get('is_verified', False),
            can_bulk_create_candidates=data.get('can_bulk_create_candidates', False) if role == 'responsable' else False,
            can_manage_groups=data.get('can_manage_groups', False) if role == 'responsable' else False,
            can_view_reports=data.get('can_view_reports', True) if role == 'responsable' else True
        )
        new_user.set_password(password)  # Usar la variable password (puede ser generada automáticamente)
        
        db.session.add(new_user)
        db.session.flush()  # Persistir el user para que exista antes de la FK en user_partners
        
        # Para responsable_partner, crear la asociación en user_partners
        if role == 'responsable_partner' and data.get('partner_id'):
            from app.models.partner import user_partners
            db.session.execute(user_partners.insert().values(
                user_id=new_user.id,
                partner_id=data['partner_id']
            ))
        
        # Para responsable, asociarlo como responsable del plantel
        if role == 'responsable' and user_campus_id:
            from app.models.partner import Campus as CampusModel
            campus_obj = CampusModel.query.get(user_campus_id)
            if campus_obj:
                campus_obj.responsable_id = new_user.id
                # Avanzar estado de activación si está pendiente
                if campus_obj.activation_status == 'pending':
                    campus_obj.activation_status = 'configuring'
        
        db.session.commit()
        
        # Enviar email de bienvenida si tiene email
        if new_user.email:
            try:
                from app.services.email_service import send_welcome_email
                send_welcome_email(new_user, password)
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).error(f'Error enviando welcome email: {email_err}')
        
        # Incluir la contraseña temporal en la respuesta para TODOS los roles
        response_data = {
            'message': 'Usuario creado exitosamente',
            'user': new_user.to_dict(include_private=True),
            'temporary_password': password
        }
        
        return jsonify(response_data), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== ACTUALIZAR USUARIOS ==============

@bp.route('/users/<string:user_id>', methods=['PUT'])
@jwt_required()
@management_required
def update_user(user_id):
    """Actualizar un usuario"""
    try:
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        # Coordinadores pueden editar candidatos, responsables y responsables del partner
        if current_user.role == 'coordinator':
            if user.role not in ['candidato', 'responsable', 'responsable_partner']:
                return jsonify({'error': 'No tienes permiso para editar este usuario'}), 403
            if user.coordinator_id != current_user.id:
                return jsonify({'error': 'No tienes permiso para editar este usuario'}), 403
        
        # No se puede editar a uno mismo por esta ruta (usar perfil)
        if user_id == current_user.id:
            return jsonify({'error': 'Usa la opción de perfil para editar tu propia cuenta'}), 400
        
        # Campos actualizables
        basic_fields = ['name', 'first_surname', 'second_surname', 'gender']
        # Solo actualizar phone si el usuario NO es editor/editor_invitado ni candidato
        if user.role not in ['editor', 'editor_invitado', 'candidato']:
            basic_fields.append('phone')
        for field in basic_fields:
            if field in data:
                setattr(user, field, data[field].strip() if data[field] else None)
        
        # CURP - verificar unicidad (solo si el usuario no es editor/editor_invitado)
        if 'curp' in data and user.role not in ['editor', 'editor_invitado']:
            curp = data['curp'].upper().strip() if data['curp'] else None
            if curp:
                existing = User.query.filter(User.curp == curp, User.id != user_id).first()
                if existing:
                    return jsonify({'error': 'Ya existe un usuario con ese CURP'}), 400
            user.curp = curp
        
        # Email - verificar unicidad
        if 'email' in data:
            email = data['email'].strip().lower()
            if not validate_email(email):
                return jsonify({'error': 'Formato de email inválido'}), 400
            existing = User.query.filter(User.email == email, User.id != user_id).first()
            if existing:
                return jsonify({'error': 'Ya existe un usuario con ese email'}), 400
            user.email = email
        
        # Campos que solo admin puede cambiar
        if current_user.role in ['admin', 'developer']:
            if 'role' in data:
                new_role = data['role']
                # Admin/developer no puede crear otros admins o developers
                if new_role in ['admin', 'developer'] and user.role not in ['admin', 'developer']:
                    return jsonify({'error': 'No se puede asignar rol de administrador o desarrollador'}), 403
                # Si cambia a editor/editor_invitado o candidato, limpiar phone
                if new_role in ['editor', 'editor_invitado', 'candidato'] and user.role not in ['editor', 'editor_invitado', 'candidato']:
                    user.phone = None
                # Si cambia a editor/editor_invitado, también limpiar CURP
                if new_role in ['editor', 'editor_invitado'] and user.role not in ['editor', 'editor_invitado']:
                    user.curp = None
                user.role = new_role
            
            if 'is_active' in data:
                user.is_active = data['is_active']
            
            if 'is_verified' in data:
                user.is_verified = data['is_verified']
        
        # Coordinadores solo pueden cambiar is_active de candidatos
        elif current_user.role == 'coordinator':
            if 'is_active' in data:
                user.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Usuario actualizado exitosamente',
            'user': user.to_dict(include_private=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== CAMBIAR CONTRASEÑA ==============

@bp.route('/users/<string:user_id>/password', methods=['PUT'])
@jwt_required()
@management_required
def change_user_password(user_id):
    """Cambiar contraseña de un usuario (sin requerir contraseña actual)"""
    try:
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        # Coordinadores pueden cambiar contraseña de candidatos, responsables y responsables del partner
        if current_user.role == 'coordinator':
            if user.role not in ['candidato', 'responsable', 'responsable_partner']:
                return jsonify({'error': 'No tienes permiso para cambiar la contraseña de este usuario'}), 403
            if user.coordinator_id != current_user.id:
                return jsonify({'error': 'No tienes permiso para cambiar la contraseña de este usuario'}), 403
        
        new_password = data.get('new_password')
        if not new_password:
            return jsonify({'error': 'La nueva contraseña es requerida'}), 400
        
        is_valid, error_msg = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({
            'message': 'Contraseña actualizada exitosamente'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== GENERAR CONTRASEÑA TEMPORAL (ADMIN Y COORDINADOR) ==============

@bp.route('/users/<string:user_id>/generate-password', methods=['POST'])
@jwt_required()
@management_required
def generate_temp_password(user_id):
    """Generar una contraseña temporal para un usuario (admin y coordinador)"""
    try:
        import secrets
        
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        
        # Coordinadores solo pueden generar contraseñas para candidatos, responsables y responsables_partner
        if current_user.role == 'coordinator':
            if user.role not in ['candidato', 'responsable', 'responsable_partner']:
                return jsonify({'error': 'No tienes permiso para generar contraseña de este usuario'}), 403
            if user.coordinator_id != current_user.id:
                return jsonify({'error': 'No tienes permiso para generar contraseña de este usuario'}), 403
        
        # Generar contraseña segura de 12 caracteres
        temp_password = secrets.token_urlsafe(9)  # Genera ~12 caracteres
        
        # Establecer la nueva contraseña
        user.set_password(temp_password)
        db.session.commit()
        
        return jsonify({
            'message': 'Contraseña temporal generada exitosamente',
            'password': temp_password,
            'user': user.to_dict(include_private=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== VER CONTRASEÑA DE USUARIO (ADMIN Y COORDINADOR) ==============

@bp.route('/users/<string:user_id>/password', methods=['GET'])
@jwt_required()
@management_required
def get_user_password(user_id):
    """Obtener la contraseña descifrada de un usuario (admin y coordinador)"""
    try:
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        
        # Coordinadores solo pueden ver contraseñas de candidatos, responsables y responsables_partner
        if current_user.role == 'coordinator':
            if user.role not in ['candidato', 'responsable', 'responsable_partner']:
                return jsonify({'error': 'No tienes permiso para ver la contraseña de este usuario'}), 403
            if user.coordinator_id != current_user.id:
                return jsonify({'error': 'No tienes permiso para ver la contraseña de este usuario'}), 403
        
        # Desencriptar la contraseña
        decrypted_password = user.get_decrypted_password()
        
        if not decrypted_password:
            return jsonify({
                'error': 'No se puede recuperar la contraseña. Genera una nueva contraseña temporal.',
                'has_password': False
            }), 404
        
        return jsonify({
            'password': decrypted_password,
            'has_password': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.full_name
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== ACTIVAR/DESACTIVAR USUARIOS ==============

@bp.route('/users/<string:user_id>/toggle-active', methods=['POST'])
@jwt_required()
@management_required
def toggle_user_active(user_id):
    """Activar o desactivar un usuario"""
    try:
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        
        # Developers no pueden desactivar usuarios
        if current_user.role == 'developer':
            return jsonify({'error': 'Los desarrolladores no pueden desactivar usuarios'}), 403
        
        # Coordinadores pueden manejar candidatos, responsables y responsables del partner
        if current_user.role == 'coordinator':
            if user.role not in ['candidato', 'responsable', 'responsable_partner']:
                return jsonify({'error': 'No tienes permiso para modificar este usuario'}), 403
            if user.coordinator_id != current_user.id:
                return jsonify({'error': 'No tienes permiso para modificar este usuario'}), 403
        
        # No se puede desactivar a uno mismo
        if user_id == current_user.id:
            return jsonify({'error': 'No puedes desactivarte a ti mismo'}), 400
        
        user.is_active = not user.is_active
        db.session.commit()
        
        status = 'activado' if user.is_active else 'desactivado'
        
        return jsonify({
            'message': f'Usuario {status} exitosamente',
            'user': user.to_dict(include_private=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== OPCIONES DE DOCUMENTOS ==============

@bp.route('/users/<string:user_id>/document-options', methods=['PUT'])
@jwt_required()
@management_required
def update_user_document_options(user_id):
    """Actualizar opciones de documentos de un usuario (admin y coordinador)"""
    try:
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        
        # Coordinadores solo pueden modificar opciones de sus propios usuarios
        if current_user.role == 'coordinator':
            if user.role not in ['candidato', 'responsable', 'responsable_partner']:
                return jsonify({'error': 'No tienes permiso para modificar este usuario'}), 403
            if user.coordinator_id != current_user.id:
                return jsonify({'error': 'No tienes permiso para modificar este usuario'}), 403
        
        data = request.get_json()
        
        if 'evaluation_report' in data:
            user.enable_evaluation_report = data['evaluation_report']
        if 'certificate' in data:
            user.enable_certificate = data['certificate']
        if 'conocer_certificate' in data:
            user.enable_conocer_certificate = data['conocer_certificate']
        if 'digital_badge' in data:
            user.enable_digital_badge = data['digital_badge']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Opciones de documentos actualizadas',
            'user': user.to_dict(include_private=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== ELIMINAR USUARIO (SOLO ADMIN) ==============

@bp.route('/users/<string:user_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_user(user_id):
    """Eliminar un usuario permanentemente (solo admin, no developer).
    
    Limpia todas las referencias FK antes de eliminar para evitar
    errores de constraint en MSSQL.
    """
    try:
        current_user = g.current_user
        
        # Solo admin puede eliminar usuarios, developer no
        if current_user.role != 'admin':
            return jsonify({'error': 'Solo el administrador puede eliminar usuarios'}), 403
        
        user = User.query.get_or_404(user_id)
        
        # No se puede eliminar a uno mismo
        if user_id == current_user.id:
            return jsonify({'error': 'No puedes eliminarte a ti mismo'}), 400
        
        # Guardar info para el mensaje
        user_email = user.email
        user_name = user.full_name
        
        # Expulsar el objeto User de la sesión ORM para evitar que
        # SQLAlchemy intente SET NULL en backrefs con NOT NULL constraints
        db.session.expunge(user)
        
        # ── Limpiar todas las referencias FK con NO_ACTION ──
        # SET NULL en columnas que son nullable (created_by, updated_by, assigned_by, etc.)
        # DELETE en tablas de relación directa (activity_logs, ecm_assignments, etc.)
        
        nullable_refs = [
            ('answers', 'created_by'),
            ('answers', 'updated_by'),
            ('balance_requests', 'approved_by_id'),
            ('balance_requests', 'financiero_id'),
            ('balance_transactions', 'created_by_id'),
            ('categories', 'created_by'),
            ('categories', 'updated_by'),
            ('conocer_upload_batches', 'uploaded_by'),
            ('ecm_candidate_assignments', 'assigned_by_id'),
            ('ecm_retakes', 'applied_by_id'),
            ('exams', 'created_by'),
            ('exams', 'updated_by'),
            ('exercises', 'created_by'),
            ('exercises', 'updated_by'),
            ('questions', 'created_by'),
            ('questions', 'updated_by'),
            ('study_contents', 'created_by'),
            ('study_contents', 'updated_by'),
            ('study_interactive_exercises', 'created_by'),
            ('study_interactive_exercises', 'updated_by'),
            ('study_materials', 'created_by'),
            ('study_materials', 'updated_by'),
            ('topics', 'created_by'),
            ('topics', 'updated_by'),
            ('vm_sessions', 'cancelled_by_id'),
            ('vm_sessions', 'created_by_id'),
        ]
        
        for table, col in nullable_refs:
            try:
                db.session.execute(
                    text(f"UPDATE {table} SET {col} = NULL WHERE {col} = :uid"),
                    {'uid': user_id}
                )
            except Exception:
                pass  # Tabla podría no existir en algunos entornos
        
        # SET NULL en users.coordinator_id (auto-referencia)
        db.session.execute(
            text("UPDATE users SET coordinator_id = NULL WHERE coordinator_id = :uid"),
            {'uid': user_id}
        )
        
        # DELETE en tablas de datos directos del usuario
        # (tablas con user_id NOT NULL que no tienen CASCADE en la DB)
        delete_refs = [
            ('group_exam_members', 'user_id'),
            ('activity_logs', 'user_id'),
            ('balance_transactions', 'coordinator_id'),
            ('ecm_candidate_assignments', 'user_id'),
            ('ecm_retakes', 'user_id'),
            ('student_content_progress', 'user_id'),
            ('student_topic_progress', 'user_id'),
            ('vm_sessions', 'user_id'),
            ('vouchers', 'user_id'),
            ('results', 'user_id'),
        ]
        
        for table, col in delete_refs:
            try:
                db.session.execute(
                    text(f"DELETE FROM {table} WHERE {col} = :uid"),
                    {'uid': user_id}
                )
            except Exception:
                pass
        
        # Eliminar usuario via SQL directo para evitar que el ORM
        # intente SET NULL en backrefs con NOT NULL constraints
        db.session.execute(
            text("DELETE FROM users WHERE id = :uid"),
            {'uid': user_id}
        )
        db.session.commit()
        
        return jsonify({
            'message': f'Usuario {user_name} ({user_email}) eliminado permanentemente'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============== ESTADÍSTICAS ==============

@bp.route('/stats', methods=['GET'])
@jwt_required()
@management_required
def get_user_stats():
    """
    Obtener estadísticas de usuarios.
    Optimizado con:
    - Caché de 5 minutos
    - Una sola query agregada en lugar de múltiples counts
    """
    try:
        current_user = g.current_user
        
        # Intentar obtener del caché primero
        cache_key = f'user_stats_{current_user.role}_{current_user.id if current_user.role == "coordinator" else "all"}'
        cached_stats = cache.get(cache_key)
        if cached_stats is not None:
            return jsonify(cached_stats)
        
        # Query optimizada: obtener todos los conteos en una sola consulta
        if current_user.role == 'coordinator':
            allowed_roles = ['candidato', 'responsable', 'responsable_partner']
        else:
            allowed_roles = AVAILABLE_ROLES
        
        # Usar una sola query con GROUP BY para obtener stats por rol
        stats_query = db.session.query(
            User.role,
            func.count(User.id).label('total'),
            func.sum(case((User.is_active == True, 1), else_=0)).label('active'),
            func.sum(case((User.is_verified == True, 1), else_=0)).label('verified')
        )
        
        if current_user.role == 'coordinator':
            stats_query = stats_query.filter(User.role.in_(allowed_roles))
            # Multi-tenant: solo contar usuarios del coordinador
            stats_query = stats_query.filter(User.coordinator_id == current_user.id)
        
        stats_query = stats_query.group_by(User.role)
        role_stats = stats_query.all()
        
        # Procesar resultados
        total_users = 0
        active_users = 0
        verified_users = 0
        users_by_role = []
        
        role_counts = {stat.role: stat.total for stat in role_stats}
        
        for stat in role_stats:
            total_users += stat.total
            active_users += stat.active or 0
            verified_users += stat.verified or 0
            users_by_role.append({'role': stat.role, 'count': stat.total})
        
        # Asegurar que todos los roles aparezcan (aunque tengan 0)
        if current_user.role in ['admin', 'developer']:
            for role in AVAILABLE_ROLES:
                if role not in role_counts:
                    users_by_role.append({'role': role, 'count': 0})
        elif current_user.role == 'coordinator':
            for role in allowed_roles:
                if role not in role_counts:
                    users_by_role.append({'role': role, 'count': 0})
        
        # Ordenar por rol
        users_by_role.sort(key=lambda x: x['role'])
        
        inactive_users = total_users - active_users
        
        result = {
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': inactive_users,
            'verified_users': verified_users,
            'users_by_role': users_by_role
        }
        
        # Guardar en caché por 5 minutos
        cache.set(cache_key, result, timeout=300)
        
        return jsonify(result)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@bp.route('/stats/invalidate', methods=['POST'])
@jwt_required()
@management_required
def invalidate_stats_cache():
    """Invalidar caché de estadísticas (admin y coordinador)"""
    try:
        cache.delete('user_stats_admin')
        cache.delete('user_stats_coordinator')
        # Invalidar también los conteos de usuarios
        cache.delete_many('user_count_*')
        return jsonify({'message': 'Caché de estadísticas invalidada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== ROLES DISPONIBLES ==============

@bp.route('/roles', methods=['GET'])
@jwt_required()
@management_required
def get_available_roles():
    """Obtener roles que puede crear el usuario actual"""
    try:
        current_user = g.current_user
        allowed_roles = ROLE_CREATE_PERMISSIONS.get(current_user.role, [])
        
        role_descriptions = {
            'admin': 'Administrador - Acceso total al sistema',
            'gerente': 'Gerente - Supervisión general y aprobación de operaciones',
            'financiero': 'Financiero - Gestión de saldos y aprobaciones financieras',
            'editor': 'Editor - Gestión de exámenes y contenidos',
            'editor_invitado': 'Editor Invitado - Gestión de exámenes con contenido aislado',
            'soporte': 'Soporte - Atención a usuarios y vouchers',
            'coordinator': 'Coordinador - Gestión de partners y candidatos',
            'responsable': 'Responsable - Administra un plantel y sus candidatos',
            'responsable_partner': 'Responsable del Partner - Supervisa al partner y sus planteles',
            'candidato': 'Candidato - Usuario que presenta evaluaciones',
            'auxiliar': 'Auxiliar - Acceso de solo lectura'
        }
        
        return jsonify({
            'roles': [
                {'value': role, 'label': role.capitalize(), 'description': role_descriptions.get(role, '')}
                for role in allowed_roles
            ],
            'all_roles': [
                {'value': role, 'label': role.capitalize(), 'description': role_descriptions.get(role, '')}
                for role in AVAILABLE_ROLES
            ] if current_user.role in ['admin', 'developer'] else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== PLANTELES PARA RESPONSABLES ==============

@bp.route('/available-campuses', methods=['GET'])
@jwt_required()
@management_required
def get_available_campuses():
    """
    Obtener lista de planteles disponibles.
    Por defecto muestra todos los planteles (para asignar candidatos a grupos).
    Con for_responsable=true, muestra solo los pendientes de activación.
    """
    try:
        from app.models.partner import Campus, Partner
        
        for_responsable = request.args.get('for_responsable', 'false').lower() == 'true'
        
        # Usar outerjoin para incluir campus aunque no tengan partner asociado
        query = Campus.query.outerjoin(Partner)
        
        if for_responsable:
            # Solo planteles pendientes de activación (para asignar responsables)
            query = query.filter(Campus.is_active == False)
        # Si no es for_responsable, mostrar TODOS los planteles (sin filtro is_active)
        
        campuses = query.order_by(Campus.name).all()
        
        return jsonify({
            'campuses': [{
                'id': c.id,
                'name': c.name,
                'code': c.code,
                'partner_id': c.partner_id,
                'partner_name': c.partner.name if c.partner else 'Sin partner',
                'state_name': c.state_name,
                'city': c.city,
                'has_responsable': c.responsable_id is not None,
                'activation_status': c.activation_status,
                'certification_cost': float(c.certification_cost) if c.certification_cost else 500.0
            } for c in campuses],
            'total': len(campuses)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== PARTNERS DISPONIBLES (para responsable_partner) ==============

@bp.route('/available-partners', methods=['GET'])
@jwt_required()
@management_required
def get_available_partners():
    """Obtener lista de partners disponibles para asignar a responsable_partner"""
    try:
        from app.models.partner import Partner
        
        partners = Partner.query.filter_by(is_active=True).order_by(Partner.name).all()
        
        return jsonify({
            'partners': [{
                'id': p.id,
                'name': p.name,
                'rfc': p.rfc or '',
                'contact_email': p.email or '',
                'country': p.country or 'México',
                'total_campuses': p.campuses.count() if p.campuses else 0
            } for p in partners],
            'total': len(partners)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== HELPERS: CARGA MASIVA DE CANDIDATOS ==============

MAX_BULK_ROWS = 50000
MAX_BULK_FILE_MB = 20
BATCH_COMMIT_SIZE = 500

_COLUMN_MAPPING = {
    'email': ['email', 'correo', 'correo electronico', 'correo electrónico', 'e-mail'],
    'nombre': ['nombre', 'name', 'nombres'],
    'primer_apellido': ['primer_apellido', 'primer apellido', 'apellido paterno', 'apellido_paterno', 'first_surname', 'apellido1'],
    'segundo_apellido': ['segundo_apellido', 'segundo apellido', 'apellido materno', 'apellido_materno', 'second_surname', 'apellido2'],
    'genero': ['genero', 'género', 'sexo', 'gender'],
    'curp': ['curp']
}


def _parse_bulk_candidates_excel(file_storage):
    """
    Parse Excel de candidatos. Retorna (parsed_rows, error_string).
    Valida tamaño, formato, columnas requeridas y límite de filas.
    """
    import io
    from openpyxl import load_workbook

    # Validar tamaño
    file_storage.seek(0, 2)
    file_size = file_storage.tell()
    file_storage.seek(0)
    if file_size > MAX_BULK_FILE_MB * 1024 * 1024:
        return None, f'Archivo excede {MAX_BULK_FILE_MB}MB (tiene {file_size / 1024 / 1024:.1f}MB)'

    try:
        workbook = load_workbook(filename=io.BytesIO(file_storage.read()), data_only=True)
        sheet = workbook.active
    except Exception as e:
        return None, f'Error al leer el archivo Excel: {str(e)}'

    # Encabezados
    headers = []
    for cell in sheet[1]:
        value = cell.value
        headers.append(str(value).strip().lower() if value else '')

    column_indices = {}
    for field, aliases in _COLUMN_MAPPING.items():
        for i, header in enumerate(headers):
            if header in aliases:
                column_indices[field] = i
                break

    required_columns = ['nombre', 'primer_apellido', 'segundo_apellido', 'genero']
    missing = [c for c in required_columns if c not in column_indices]
    if missing:
        return None, f'Faltan columnas requeridas: {", ".join(missing)}. Requeridas: nombre, primer_apellido, segundo_apellido, genero'

    # Parsear filas (fila 1=headers, fila 2=descripciones, datos desde fila 3)
    parsed_rows = []
    for row_idx, row in enumerate(sheet.iter_rows(min_row=3), start=3):
        if len(parsed_rows) >= MAX_BULK_ROWS:
            return None, f'Límite excedido: máximo {MAX_BULK_ROWS:,} filas permitidas'

        def _val(field):
            if field not in column_indices:
                return None
            idx = column_indices[field]
            if idx < len(row):
                v = row[idx].value
                return str(v).strip() if v is not None else None
            return None

        nombre = _val('nombre')
        primer_ap = _val('primer_apellido')
        email_raw = _val('email')
        # Saltar filas completamente vacías
        if not any([email_raw, nombre, primer_ap]):
            continue

        parsed_rows.append({
            'row': row_idx,
            'email': email_raw.lower().strip() if email_raw else None,
            'nombre': nombre,
            'primer_apellido': primer_ap,
            'segundo_apellido': _val('segundo_apellido'),
            'genero_raw': _val('genero'),
            'curp': _val('curp').upper().strip() if _val('curp') else None,
        })

    return parsed_rows, None


def _validate_rows(parsed_rows):
    """Validar campos requeridos y formatos. Retorna (valid, errors)."""
    valid = []
    errors = []
    for r in parsed_rows:
        errs = []
        if not r['nombre']:
            errs.append('nombre vacío')
        if not r['primer_apellido']:
            errs.append('primer_apellido vacío')
        if not r['segundo_apellido']:
            errs.append('segundo_apellido vacío')
        if not r['genero_raw']:
            errs.append('genero vacío')
        if r['email'] and not validate_email(r['email']):
            errs.append('formato de email inválido')
        if r['curp'] and len(r['curp']) != 18:
            errs.append(f'CURP debe tener 18 caracteres (tiene {len(r["curp"])})')
        genero = None
        if r['genero_raw']:
            g = r['genero_raw'].upper()[0]
            if g in ('M', 'F', 'O'):
                genero = g
            else:
                errs.append('género inválido (usar M, F u O)')
        r['genero'] = genero
        if errs:
            errors.append({'row': r['row'], 'email': r['email'] or '(vacío)', 'nombre': r.get('nombre', ''), 'error': '; '.join(errs)})
        else:
            valid.append(r)
    return valid, errors


def _batch_fetch_existing(valid_rows):
    """
    Batch-fetch usuarios existentes por email y CURP.
    Retorna (existing_by_email, existing_by_curp) como dicts {key: User}.
    """
    from sqlalchemy import func as sf
    CHUNK = 500

    all_emails = list({r['email'] for r in valid_rows if r['email']})
    all_curps = list({r['curp'] for r in valid_rows if r['curp']})

    existing_by_email = {}
    for i in range(0, len(all_emails), CHUNK):
        chunk = all_emails[i:i + CHUNK]
        users = User.query.filter(sf.lower(User.email).in_(chunk)).all()
        for u in users:
            if u.email:
                existing_by_email[u.email.lower()] = u

    existing_by_curp = {}
    for i in range(0, len(all_curps), CHUNK):
        chunk = all_curps[i:i + CHUNK]
        users = User.query.filter(sf.upper(User.curp).in_(chunk)).all()
        for u in users:
            if u.curp:
                existing_by_curp[u.curp.upper()] = u

    return existing_by_email, existing_by_curp


def _batch_generate_usernames(rows_to_create):
    """
    Pre-generar usernames únicos sin N+1 queries.
    Retorna dict {row_index: username}.
    """
    from sqlalchemy import func as sf, or_
    CHUNK = 500

    # Calcular base usernames
    bases = {}
    for r in rows_to_create:
        if r['email']:
            base = r['email'].split('@')[0].upper()
        else:
            base = f"{(r['nombre'] or 'X')[:3]}{(r['primer_apellido'] or 'X')[:3]}".upper()
        # Limpiar caracteres no alfanuméricos
        base = re.sub(r'[^A-Z0-9]', '', base) or 'USER'
        bases[r['row']] = base

    # Batch-fetch usernames existentes con esos prefijos
    unique_bases = list(set(bases.values()))
    existing_usernames = set()
    for i in range(0, len(unique_bases), CHUNK):
        chunk = unique_bases[i:i + CHUNK]
        conditions = [sf.upper(User.username).like(f"{b}%") for b in chunk]
        if conditions:
            users = User.query.filter(or_(*conditions)).with_entities(User.username).all()
            existing_usernames.update(u.username.upper() for u in users if u.username)

    # Asignar usernames (tracking localmente los ya usados)
    used = set(existing_usernames)
    result = {}
    for r in rows_to_create:
        base = bases[r['row']]
        username = base
        counter = 1
        while username in used:
            username = f"{base}{counter}"
            counter += 1
        used.add(username)
        result[r['row']] = username
    return result


def _classify_valid_rows(valid_rows, existing_by_email, existing_by_curp, target_group_id=None):
    """
    Clasificar filas válidas en: to_create, duplicates (existing_assigned), skipped.
    Batch-fetch membresías de grupo si aplica.
    """
    from app.models.partner import GroupMember
    CHUNK = 500
    to_create = []
    duplicates = []  # Usuarios que ya existen (por email o CURP)
    skipped = []
    seen_emails = set()
    seen_curps = set()

    # Pre-fetch membresías si hay grupo destino
    group_member_ids = set()
    if target_group_id:
        all_existing_ids = list({u.id for u in list(existing_by_email.values()) + list(existing_by_curp.values())})
        for i in range(0, len(all_existing_ids), CHUNK):
            chunk = all_existing_ids[i:i + CHUNK]
            members = GroupMember.query.filter(
                GroupMember.group_id == target_group_id,
                GroupMember.user_id.in_(chunk)
            ).with_entities(GroupMember.user_id).all()
            group_member_ids.update(m.user_id for m in members)

    for r in valid_rows:
        email = r['email']
        curp = r['curp']

        # Duplicado por email
        if email and email in existing_by_email:
            user = existing_by_email[email]
            if target_group_id:
                if user.id in group_member_ids:
                    skipped.append({'row': r['row'], 'email': email, 'reason': 'Email ya registrado y ya es miembro del grupo',
                                    'user_id': user.id, 'name': user.full_name, 'username': user.username, 'is_existing_user': True})
                else:
                    duplicates.append({'row': r['row'], 'email': email, 'name': user.full_name, 'username': user.username, 'user_id': user.id})
            else:
                skipped.append({'row': r['row'], 'email': email, 'reason': 'Email ya registrado',
                                'user_id': user.id, 'name': user.full_name, 'username': user.username, 'is_existing_user': True})
            continue

        # Duplicado por CURP
        if curp and curp in existing_by_curp:
            user = existing_by_curp[curp]
            already_dup = any(d.get('user_id') == user.id for d in duplicates)
            if target_group_id:
                if user.id in group_member_ids or already_dup:
                    if not already_dup:
                        skipped.append({'row': r['row'], 'email': email or '(sin email)', 'reason': f'CURP {curp} ya registrado y ya es miembro del grupo',
                                        'user_id': user.id, 'name': user.full_name, 'username': user.username, 'is_existing_user': True})
                else:
                    duplicates.append({'row': r['row'], 'email': user.email or email or '(sin email)', 'name': user.full_name, 'username': user.username, 'user_id': user.id})
            else:
                skipped.append({'row': r['row'], 'email': email or '(sin email)', 'reason': f'CURP {curp} ya registrado',
                                'user_id': user.id, 'name': user.full_name, 'username': user.username, 'is_existing_user': True})
            continue

        # Duplicado interno (mismo email/curp repetido en el mismo archivo)
        if email and email in seen_emails:
            skipped.append({'row': r['row'], 'email': email, 'reason': 'Email duplicado en el mismo archivo'})
            continue
        if curp and curp in seen_curps:
            skipped.append({'row': r['row'], 'email': email or '(sin email)', 'reason': 'CURP duplicado en el mismo archivo'})
            continue

        if email:
            seen_emails.add(email)
        if curp:
            seen_curps.add(curp)
        to_create.append(r)

    return to_create, duplicates, skipped


def _validate_target_group(group_id, current_user):
    """Validar grupo destino. Retorna (group, error_tuple_or_None)."""
    if not group_id:
        return None, None
    from app.models.partner import CandidateGroup, Campus, Partner
    group = CandidateGroup.query.get(group_id)
    if not group:
        return None, (jsonify({'error': f'Grupo con ID {group_id} no encontrado'}), 404)
    if not group.is_active:
        return None, (jsonify({'error': 'El grupo seleccionado no está activo'}), 400)
    if current_user.role == 'coordinator':
        campus = Campus.query.get(group.campus_id)
        if campus:
            partner = Partner.query.get(campus.partner_id)
            if partner and partner.coordinator_id != current_user.id:
                return None, (jsonify({'error': 'No tienes acceso a este grupo'}), 403)
    return group, None


# ============== PREVIEW CARGA MASIVA ==============

@bp.route('/candidates/bulk-upload/preview', methods=['POST'])
@jwt_required()
@management_required
def preview_bulk_upload_candidates():
    """
    Preview de carga masiva de candidatos — valida SIN crear usuarios.
    Retorna status por fila: ready, duplicate, error, skipped.
    """
    try:
        current_user = g.current_user
        group_id = request.form.get('group_id', type=int)

        # Validar grupo si se especificó
        target_group, group_err = _validate_target_group(group_id, current_user)
        if group_err:
            return group_err

        # Validar archivo
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        file = request.files['file']
        if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
            return jsonify({'error': 'El archivo debe ser formato Excel (.xlsx o .xls)'}), 400

        # Parsear
        parsed_rows, parse_error = _parse_bulk_candidates_excel(file)
        if parse_error:
            return jsonify({'error': parse_error}), 400
        if not parsed_rows:
            return jsonify({'error': 'El archivo no contiene datos (filas vacías)'}), 400

        # Validar campos
        valid_rows, validation_errors = _validate_rows(parsed_rows)

        # Batch-fetch existentes
        existing_by_email, existing_by_curp = _batch_fetch_existing(valid_rows)

        # Clasificar
        to_create, duplicates, skipped = _classify_valid_rows(
            valid_rows, existing_by_email, existing_by_curp,
            target_group.id if target_group else None
        )

        # Pre-generar usernames para los que se van a crear
        username_map = _batch_generate_usernames(to_create) if to_create else {}

        # Detectar coincidencias por nombre+género en to_create
        name_match_map = {}  # row_number -> [matching_users]
        if to_create:
            # Recopilar combinaciones únicas (nombre, primer_apellido, genero)
            name_keys = set()
            for r in to_create:
                key = (r['nombre'].strip().lower(), r['primer_apellido'].strip().lower(), (r['genero'] or '').strip().upper())
                name_keys.add(key)

            # Batch-fetch por primer_apellido (reducir queries)
            surnames = list({k[1] for k in name_keys})
            CHUNK = 500
            matching_users = []
            for i in range(0, len(surnames), CHUNK):
                chunk = surnames[i:i + CHUNK]
                users = User.query.filter(
                    func.lower(func.ltrim(func.rtrim(User.first_surname))).in_(chunk),
                    User.is_active == True,
                ).all()
                matching_users.extend(users)

            # Construir lookup: (nombre_lower, primer_apellido_lower, genero_upper) -> [users]
            name_lookup = {}
            for u in matching_users:
                n = (u.name or '').strip().lower()
                fs = (u.first_surname or '').strip().lower()
                g = (u.gender or '').strip().upper()
                key = (n, fs, g)
                name_lookup.setdefault(key, []).append(u)

            # Mapear filas a coincidencias
            for r in to_create:
                key = (r['nombre'].strip().lower(), r['primer_apellido'].strip().lower(), (r['genero'] or '').strip().upper())
                matches = name_lookup.get(key, [])
                if matches:
                    name_match_map[r['row']] = [
                        {
                            'id': u.id,
                            'full_name': u.full_name,
                            'username': u.username,
                            'email': u.email or '',
                            'curp': u.curp or '',
                        }
                        for u in matches[:5]  # Máximo 5 coincidencias
                    ]

        # Construir preview
        preview = []
        name_match_count = 0
        for r in to_create:
            matches = name_match_map.get(r['row'])
            row_status = 'name_match' if matches else 'ready'
            if matches:
                name_match_count += 1
            entry = {
                'row': r['row'],
                'status': row_status,
                'email': r['email'],
                'nombre': r['nombre'],
                'primer_apellido': r['primer_apellido'],
                'segundo_apellido': r['segundo_apellido'],
                'genero': r['genero'],
                'curp': r['curp'],
                'username_preview': username_map.get(r['row'], ''),
                'eligibility': {
                    'reporte': True, 'eduit': True,
                    'conocer': bool(r['curp']),
                    'insignia': bool(r['email']),
                },
                'error': None,
            }
            if matches:
                entry['name_matches'] = matches
            preview.append(entry)
        for d in duplicates:
            preview.append({
                'row': d['row'],
                'status': 'duplicate',
                'email': d.get('email'),
                'nombre': d.get('name', ''),
                'existing_user': {'id': d['user_id'], 'name': d['name'], 'username': d['username']},
                'error': 'Usuario ya existe — se asignará al grupo' if target_group else 'Usuario ya existe',
            })
        for s in skipped:
            entry = {
                'row': s['row'],
                'status': 'skipped',
                'email': s.get('email'),
                'error': s['reason'],
            }
            if s.get('is_existing_user'):
                entry['existing_user'] = {
                    'id': s['user_id'],
                    'name': s['name'],
                    'username': s['username'],
                }
            preview.append(entry)
        for e in validation_errors:
            preview.append({
                'row': e['row'],
                'status': 'error',
                'email': e.get('email'),
                'nombre': e.get('nombre', ''),
                'error': e['error'],
            })

        # Ordenar por número de fila
        preview.sort(key=lambda x: x['row'])

        return jsonify({
            'preview': preview,
            'summary': {
                'total_rows': len(parsed_rows),
                'ready': len(to_create) - name_match_count,
                'name_matches': name_match_count,
                'duplicates': len(duplicates),
                'errors': len(validation_errors),
                'skipped': len(skipped),
            },
            'can_proceed': len(to_create) > 0 or len(duplicates) > 0,
            'group_info': {'id': target_group.id, 'name': target_group.name} if target_group else None,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== CARGA MASIVA DE CANDIDATOS (OPTIMIZADO) ==============

@bp.route('/candidates/bulk-upload', methods=['POST'])
@jwt_required()
@management_required
def bulk_upload_candidates():
    """
    Carga masiva de candidatos desde archivo Excel — versión batch-optimizada.
    Soporta hasta 50,000 filas. Commits en lotes de 500.

    Columnas: nombre, primer_apellido, segundo_apellido, genero (requeridas)
              email, curp (opcionales)
    Form fields: group_id (opcional)
    """
    try:
        import secrets
        import string

        current_user = g.current_user
        group_id = request.form.get('group_id', type=int)

        # Validar grupo
        target_group, group_err = _validate_target_group(group_id, current_user)
        if group_err:
            return group_err

        # Validar archivo
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        file = request.files['file']
        if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
            return jsonify({'error': 'El archivo debe ser formato Excel (.xlsx o .xls)'}), 400

        # Parsear
        parsed_rows, parse_error = _parse_bulk_candidates_excel(file)
        if parse_error:
            return jsonify({'error': parse_error}), 400
        if not parsed_rows:
            return jsonify({'error': 'El archivo no contiene datos'}), 400

        # Validar
        valid_rows, validation_errors = _validate_rows(parsed_rows)

        # Batch-fetch existentes
        existing_by_email, existing_by_curp = _batch_fetch_existing(valid_rows)

        # Clasificar
        to_create, existing_assigned, skipped = _classify_valid_rows(
            valid_rows, existing_by_email, existing_by_curp,
            target_group.id if target_group else None
        )

        # Handle include_existing_ids — skipped users the admin opted to add to group
        include_existing_ids_raw = request.form.get('include_existing_ids', '')
        if include_existing_ids_raw and target_group:
            import json as _json
            try:
                include_ids = _json.loads(include_existing_ids_raw)
                if isinstance(include_ids, list):
                    include_set = set(str(i) for i in include_ids)
                    new_skipped = []
                    for s in skipped:
                        if s.get('is_existing_user') and str(s.get('user_id', '')) in include_set:
                            existing_assigned.append({
                                'row': s['row'],
                                'email': s.get('email', ''),
                                'name': s.get('name', ''),
                                'username': s.get('username', ''),
                                'user_id': s['user_id'],
                            })
                        else:
                            new_skipped.append(s)
                    skipped = new_skipped
            except (ValueError, TypeError):
                pass

        # Handle skip_row_numbers — name_match rows the admin chose NOT to create
        skip_rows_raw = request.form.get('skip_row_numbers', '')
        if skip_rows_raw:
            import json as _json2
            try:
                skip_rows = _json2.loads(skip_rows_raw)
                if isinstance(skip_rows, list):
                    skip_set = set(int(r) for r in skip_rows)
                    new_to_create = []
                    for r in to_create:
                        if r['row'] in skip_set:
                            skipped.append({
                                'row': r['row'],
                                'email': r.get('email', ''),
                                'reason': 'Omitido por coincidencia de nombre (decisión del usuario)',
                            })
                        else:
                            new_to_create.append(r)
                    to_create = new_to_create
            except (ValueError, TypeError):
                pass

        # Generar usernames
        username_map = _batch_generate_usernames(to_create) if to_create else {}

        # Función para generar contraseña
        def _gen_pwd(length=10):
            alpha = string.ascii_letters + string.digits
            pwd = [secrets.choice(string.ascii_uppercase), secrets.choice(string.ascii_lowercase), secrets.choice(string.digits)]
            pwd += [secrets.choice(alpha) for _ in range(length - 3)]
            secrets.SystemRandom().shuffle(pwd)
            return ''.join(pwd)

        # Crear usuarios en lotes
        created = []
        create_errors = []
        batch_count = 0
        for r in to_create:
            try:
                username = username_map[r['row']]
                password = _gen_pwd()
                new_user = User(
                    id=str(uuid.uuid4()),
                    email=r['email'] if r['email'] else None,
                    username=username,
                    name=r['nombre'],
                    first_surname=r['primer_apellido'],
                    second_surname=r['segundo_apellido'] or None,
                    gender=r['genero'],
                    curp=r['curp'] or None,
                    role='candidato',
                    coordinator_id=current_user.id if current_user.role == 'coordinator' else None,
                    is_active=True,
                    is_verified=False,
                )
                new_user.set_password(password)
                new_user.encrypted_password = encrypt_password(password)
                db.session.add(new_user)
                created.append({
                    'row': r['row'],
                    'email': r['email'],
                    'name': f"{r['nombre']} {r['primer_apellido']}",
                    'username': username,
                    'password': password,
                })
                batch_count += 1
                # Commit en lotes
                if batch_count >= BATCH_COMMIT_SIZE:
                    db.session.commit()
                    batch_count = 0
            except Exception as e:
                db.session.rollback()
                create_errors.append({'row': r['row'], 'email': r['email'] or '(vacío)', 'error': str(e)})
                batch_count = 0

        # Commit remanente
        if batch_count > 0:
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                import logging
                logging.getLogger(__name__).error(f'Error en commit final bulk: {e}')

        # Enviar emails de bienvenida (con retry individual)
        emails_sent = 0
        emails_failed = 0
        if created:
            try:
                from app.services.email_service import send_welcome_email
                # Batch-fetch los usuarios creados para enviar email
                created_usernames = [c['username'] for c in created if c.get('email')]
                CHUNK = 500
                created_users_map = {}
                for i in range(0, len(created_usernames), CHUNK):
                    chunk = created_usernames[i:i + CHUNK]
                    users = User.query.filter(User.username.in_(chunk)).all()
                    for u in users:
                        created_users_map[u.username] = u

                for c in created:
                    if c.get('email') and c['username'] in created_users_map:
                        try:
                            send_welcome_email(created_users_map[c['username']], c['password'])
                            emails_sent += 1
                        except Exception:
                            emails_failed += 1
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).error(f'Error enviando welcome emails bulk: {email_err}')

        # Asignar a grupo si aplica
        group_assignment = None
        if target_group and (created or existing_assigned):
            from app.models.partner import GroupMember
            assigned_new = 0
            assigned_existing = 0
            assignment_errors = []

            # Batch-fetch membresías del grupo destino
            all_assign_ids = []
            if created:
                cnames = [c['username'] for c in created]
                for i in range(0, len(cnames), CHUNK):
                    chunk = cnames[i:i + CHUNK]
                    users = User.query.filter(User.username.in_(chunk)).with_entities(User.id, User.username).all()
                    all_assign_ids.extend([(u.id, u.username) for u in users])
            for ea in existing_assigned:
                all_assign_ids.append((ea['user_id'], ea.get('username', '?')))

            uid_list = [x[0] for x in all_assign_ids]
            existing_members = set()
            for i in range(0, len(uid_list), CHUNK):
                chunk = uid_list[i:i + CHUNK]
                members = GroupMember.query.filter(
                    GroupMember.group_id == target_group.id,
                    GroupMember.user_id.in_(chunk)
                ).with_entities(GroupMember.user_id).all()
                existing_members.update(m.user_id for m in members)

            batch_count = 0
            for uid, uname in all_assign_ids:
                if uid not in existing_members:
                    try:
                        db.session.add(GroupMember(group_id=target_group.id, user_id=uid, status='active'))
                        if uid in {ea['user_id'] for ea in existing_assigned}:
                            assigned_existing += 1
                        else:
                            assigned_new += 1
                        batch_count += 1
                        if batch_count >= BATCH_COMMIT_SIZE:
                            db.session.commit()
                            batch_count = 0
                    except Exception as e:
                        assignment_errors.append({'username': uname, 'error': str(e)})

            if batch_count > 0:
                db.session.commit()

            group_assignment = {
                'group_id': target_group.id,
                'group_name': target_group.name,
                'assigned': assigned_new + assigned_existing,
                'assigned_new': assigned_new,
                'assigned_existing': assigned_existing,
                'errors': assignment_errors,
            }

        # Combinar errores
        all_errors = validation_errors + create_errors

        response_data = {
            'message': f'Proceso completado: {len(created)} creados, {len(existing_assigned)} existentes asignados',
            'summary': {
                'total_processed': len(parsed_rows),
                'created': len(created),
                'existing_assigned': len(existing_assigned),
                'errors': len(all_errors),
                'skipped': len(skipped),
                'emails_sent': emails_sent,
                'emails_failed': emails_failed,
            },
            'details': {
                'created': created,
                'existing_assigned': existing_assigned,
                'errors': all_errors,
                'skipped': skipped,
                'total_processed': len(parsed_rows),
            },
        }
        if group_assignment:
            response_data['group_assignment'] = group_assignment

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/candidates/bulk-upload/template', methods=['GET'])
@jwt_required()
@management_required
def download_bulk_upload_template():
    """
    Descargar plantilla Excel para carga masiva de candidatos
    """
    try:
        import io
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from flask import send_file
        
        # Crear workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Candidatos"
        
        # Estilos
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        required_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
        optional_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Encabezados - obligatorios a la izquierda, opcionales a la derecha
        headers = [
            ('nombre', 'Requerido'),
            ('primer_apellido', 'Requerido'),
            ('segundo_apellido', 'Requerido'),
            ('genero', 'Requerido (M, F, O)'),
            ('email', 'Opcional (sin email no recibe insignia)'),
            ('curp', 'Opcional (sin CURP no recibe cert. CONOCER)')
        ]
        
        for col, (header, _) in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center')
            cell.border = thin_border
        
        # Segunda fila con descripción
        for col, (_, description) in enumerate(headers, start=1):
            cell = ws.cell(row=2, column=col, value=description)
            if 'Requerido' in description:
                cell.fill = required_fill
            else:
                cell.fill = optional_fill
            cell.alignment = Alignment(horizontal='center', wrap_text=True)
            cell.border = thin_border
        
        # Ejemplo de datos (obligatorios primero, opcionales al final)
        example_data = [
            ('Juan', 'García', 'López', 'M', 'candidato1@email.com', 'GALJ900101HDFRPR01'),
            ('María', 'Pérez', 'Sánchez', 'F', '', ''),  # Sin email ni CURP
        ]
        
        for row_idx, data in enumerate(example_data, start=3):
            for col_idx, value in enumerate(data, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.border = thin_border
        
        # Ajustar ancho de columnas
        column_widths = [15, 18, 18, 18, 30, 25]
        for col, width in enumerate(column_widths, start=1):
            ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = width
        
        # Hoja de instrucciones
        ws_instructions = wb.create_sheet("Instrucciones")
        instructions = [
            "INSTRUCCIONES PARA CARGA MASIVA DE CANDIDATOS",
            "",
            "1. Use la hoja 'Candidatos' para ingresar los datos",
            "2. No modifique los encabezados de las columnas",
            "3. Elimine las filas de ejemplo antes de agregar sus datos",
            "",
            "CAMPOS REQUERIDOS:",
            "- nombre: Nombre(s) del candidato",
            "- primer_apellido: Apellido paterno",
            "- segundo_apellido: Apellido materno",
            "- genero: M (Masculino), F (Femenino), O (Otro)",
            "",
            "CAMPOS OPCIONALES:",
            "- email: Sin email, el candidato NO podrá recibir insignia digital",
            "- curp: Sin CURP, el candidato NO podrá recibir certificado CONOCER",
            "  (El reporte de evaluación y certificado Eduit siempre están disponibles)",
            "",
            "GENERACIÓN AUTOMÁTICA:",
            "- Las contraseñas se generan automáticamente para cada usuario",
            "- Los usernames se generan a partir del email o nombre+apellido",
            "",
            "NOTAS:",
            "- Los emails duplicados serán omitidos",
            "- Los CURP duplicados serán omitidos",
            "- Se genera un reporte con los resultados de la carga"
        ]
        
        for row_idx, text in enumerate(instructions, start=1):
            cell = ws_instructions.cell(row=row_idx, column=1, value=text)
            if row_idx == 1:
                cell.font = Font(bold=True, size=14)
            elif text.endswith(':'):
                cell.font = Font(bold=True)
        
        ws_instructions.column_dimensions['A'].width = 60
        
        # Guardar en memoria
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='plantilla_candidatos.xlsx'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============== EXPORTAR USUARIOS CON CONTRASEÑAS (ADMIN Y COORDINADOR) ==============

@bp.route('/export-credentials', methods=['POST'])
@jwt_required()
@management_required
def export_user_credentials():
    """
    Exportar usuarios seleccionados con sus contraseñas en Excel (admin y coordinador)
    Recibe una lista de IDs de usuarios a exportar
    """
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from flask import send_file
        import io
        
        current_user = g.current_user
        data = request.get_json()
        user_ids = data.get('user_ids', [])
        
        if not user_ids:
            return jsonify({'error': 'Debes seleccionar al menos un usuario'}), 400
        
        # Obtener usuarios (coordinador solo puede exportar sus propios usuarios)
        query = User.query.filter(User.id.in_(user_ids))
        if current_user.role == 'coordinator':
            query = query.filter(
                User.coordinator_id == current_user.id,
                User.role.in_(['candidato', 'responsable', 'responsable_partner'])
            )
        users = query.all()
        
        if not users:
            return jsonify({'error': 'No se encontraron usuarios'}), 404
        
        # Crear Excel
        wb = Workbook()
        ws = wb.active
        ws.title = "Credenciales"
        
        # Estilos
        header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
        header_font = Font(color='FFFFFF', bold=True, size=11)
        cell_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Encabezados
        headers = ['Nombre Completo', 'Email', 'Usuario', 'Contraseña', 'CURP', 'Rol', 'Estado', 'Plantel', 'Fecha Creación']
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = cell_border
        
        # Datos de usuarios
        from app.models.partner import Campus
        
        for row, user in enumerate(users, start=2):
            # Obtener plantel si existe
            campus_name = ''
            if user.campus_id:
                campus = Campus.query.get(user.campus_id)
                if campus:
                    campus_name = campus.name
            
            # Obtener contraseña desencriptada
            password = user.get_decrypted_password() or '(no disponible)'
            
            row_data = [
                user.full_name,
                user.email or '-',
                user.username,
                password,
                user.curp or '-',
                user.role,
                'Activo' if user.is_active else 'Inactivo',
                campus_name or '-',
                user.created_at.strftime('%d/%m/%Y %H:%M') if user.created_at else '-'
            ]
            
            for col, value in enumerate(row_data, start=1):
                cell = ws.cell(row=row, column=col, value=value)
                cell.border = cell_border
                cell.alignment = Alignment(vertical='center')
        
        # Ajustar anchos de columna
        column_widths = [30, 35, 20, 20, 20, 15, 12, 30, 18]
        for col, width in enumerate(column_widths, start=1):
            ws.column_dimensions[chr(64 + col)].width = width
        
        # Congelar primera fila
        ws.freeze_panes = 'A2'
        
        # Guardar en memoria
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'credenciales_usuarios_{len(users)}.xlsx'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

