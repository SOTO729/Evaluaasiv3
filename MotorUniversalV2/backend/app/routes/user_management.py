"""
Rutas para gestión de usuarios (admin y coordinadores)
"""
from flask import Blueprint, request, jsonify, g
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User
from app.models.user import encrypt_password
import uuid
import re

bp = Blueprint('user_management', __name__, url_prefix='/api/user-management')

# Roles disponibles en el sistema (sin alumno)
AVAILABLE_ROLES = ['admin', 'developer', 'editor', 'editor_invitado', 'soporte', 'coordinator', 'responsable', 'responsable_partner', 'candidato', 'auxiliar']

# Roles que puede crear cada tipo de usuario
ROLE_CREATE_PERMISSIONS = {
    'admin': ['developer', 'editor', 'editor_invitado', 'soporte', 'coordinator', 'responsable', 'responsable_partner', 'candidato', 'auxiliar'],  # Todo menos admin
    'developer': ['editor', 'editor_invitado', 'soporte', 'coordinator', 'responsable', 'responsable_partner', 'candidato', 'auxiliar'],  # Todo menos admin y developer
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
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Seleccionar solo las columnas necesarias para la lista (evita cargar todo)
        columns = [
            User.id, User.email, User.username, User.name, User.first_surname,
            User.second_surname, User.gender, User.role, User.is_active,
            User.is_verified, User.created_at, User.last_login, User.curp,
            User.phone, User.campus_id, User.date_of_birth,
            User.can_bulk_create_candidates, User.can_manage_groups,
            User.enable_evaluation_report, User.enable_certificate,
            User.enable_conocer_certificate, User.enable_digital_badge
        ]
        
        query = db.session.query(*columns)
        
        # Coordinadores ven candidatos, responsables y responsables del partner
        if current_user.role == 'coordinator':
            query = query.filter(User.role.in_(['candidato', 'responsable', 'responsable_partner']))
        
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
            total = _get_cached_user_count(current_user.role, role_filter, active_filter)
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


def _get_cached_user_count(user_role, role_filter='', active_filter=''):
    """
    Obtener conteo de usuarios con caché.
    El conteo exacto es costoso, así que lo cacheamos por 5 minutos.
    """
    cache_key = f'user_count_{user_role}_{role_filter}_{active_filter}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    query = User.query
    if user_role == 'coordinator':
        query = query.filter(User.role.in_(['candidato', 'responsable', 'responsable_partner']))
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
        if current_user.role == 'coordinator' and user.role not in ['candidato', 'responsable', 'responsable_partner']:
            return jsonify({'error': 'No tienes permiso para ver este usuario'}), 403
        
        return jsonify({
            'user': user.to_dict(include_private=True, include_partners=True)
        })
        
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
        
        # Verificar CURP único si se proporciona (solo para roles diferentes a editor/editor_invitado)
        if data.get('curp') and role not in ['editor', 'editor_invitado']:
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
        # Para usuarios tipo editor, no guardar CURP ni phone
        user_curp = None
        user_phone = None
        user_date_of_birth = None
        user_campus_id = None
        
        if role not in ['editor', 'editor_invitado', 'candidato']:
            # Solo admin/coordinator/responsable pueden tener teléfono
            user_phone = data.get('phone', '').strip() or None
        if role not in ['editor', 'editor_invitado']:
            # Solo candidatos, responsables y otros roles (no editor) pueden tener CURP
            user_curp = data.get('curp', '').upper().strip() or None
        
        # Para responsables, campos adicionales
        if role == 'responsable':
            from datetime import datetime as dt
            user_date_of_birth = dt.strptime(data['date_of_birth'], '%Y-%m-%d').date()
            user_campus_id = data['campus_id']
        
        # Crear usuario
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
            is_active=data.get('is_active', True),
            is_verified=True if role == 'responsable' else data.get('is_verified', False),
            can_bulk_create_candidates=data.get('can_bulk_create_candidates', False) if role == 'responsable' else False,
            can_manage_groups=data.get('can_manage_groups', False) if role == 'responsable' else False
        )
        new_user.set_password(password)  # Usar la variable password (puede ser generada automáticamente)
        
        db.session.add(new_user)
        
        # Para responsable_partner, crear la asociación en user_partners
        if role == 'responsable_partner' and data.get('partner_id'):
            from app.models.partner import user_partners
            db.session.execute(user_partners.insert().values(
                user_id=new_user.id,
                partner_id=data['partner_id']
            ))
        
        db.session.commit()
        
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
        if current_user.role == 'coordinator' and user.role not in ['candidato', 'responsable', 'responsable_partner']:
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
        if current_user.role == 'coordinator' and user.role not in ['candidato', 'responsable', 'responsable_partner']:
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


# ============== GENERAR CONTRASEÑA TEMPORAL (SOLO ADMIN) ==============

@bp.route('/users/<string:user_id>/generate-password', methods=['POST'])
@jwt_required()
@admin_required
def generate_temp_password(user_id):
    """Generar una contraseña temporal para un usuario (solo admin)"""
    try:
        import secrets
        
        user = User.query.get_or_404(user_id)
        
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


# ============== VER CONTRASEÑA DE USUARIO (SOLO ADMIN) ==============

@bp.route('/users/<string:user_id>/password', methods=['GET'])
@jwt_required()
@admin_required
def get_user_password(user_id):
    """Obtener la contraseña descifrada de un usuario (solo admin)"""
    try:
        user = User.query.get_or_404(user_id)
        
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
        if current_user.role == 'coordinator' and user.role not in ['candidato', 'responsable', 'responsable_partner']:
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
@admin_required
def update_user_document_options(user_id):
    """Actualizar opciones de documentos de un usuario (solo admin)"""
    try:
        user = User.query.get_or_404(user_id)
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
    """Eliminar un usuario permanentemente (solo admin, no developer)"""
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
        
        # Eliminar usuario
        db.session.delete(user)
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
        cache_key = f'user_stats_{current_user.role}'
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
            func.sum(func.cast(User.is_active == True, db.Integer)).label('active'),
            func.sum(func.cast(User.is_verified == True, db.Integer)).label('verified')
        )
        
        if current_user.role == 'coordinator':
            stats_query = stats_query.filter(User.role.in_(allowed_roles))
        
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
@admin_required
def invalidate_stats_cache():
    """Invalidar caché de estadísticas (solo admin)"""
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


# ============== CARGA MASIVA DE CANDIDATOS ==============

@bp.route('/candidates/bulk-upload', methods=['POST'])
@jwt_required()
@management_required
def bulk_upload_candidates():
    """
    Carga masiva de candidatos desde archivo Excel
    
    Formato esperado del Excel (columnas):
    - nombre (requerido)
    - primer_apellido (requerido)
    - segundo_apellido (requerido)
    - genero (requerido: M, F, O)
    - email (opcional - sin email no puede recibir insignia digital)
    - curp (opcional - sin CURP no puede recibir certificado CONOCER)
    
    Nota: Las contraseñas se generan automáticamente
    """
    try:
        import io
        import secrets
        import string
        from openpyxl import load_workbook
        
        current_user = g.current_user
        
        # Verificar que se envió un archivo
        if 'file' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        
        file = request.files['file']
        
        if not file.filename:
            return jsonify({'error': 'No se seleccionó ningún archivo'}), 400
        
        # Verificar extensión
        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            return jsonify({'error': 'El archivo debe ser formato Excel (.xlsx o .xls)'}), 400
        
        # Leer el archivo Excel
        try:
            workbook = load_workbook(filename=io.BytesIO(file.read()), data_only=True)
            sheet = workbook.active
        except Exception as e:
            return jsonify({'error': f'Error al leer el archivo Excel: {str(e)}'}), 400
        
        # Obtener encabezados (primera fila)
        headers = []
        for cell in sheet[1]:
            value = cell.value
            if value:
                headers.append(str(value).strip().lower())
            else:
                headers.append('')
        
        # Mapeo de nombres de columna esperados
        column_mapping = {
            'email': ['email', 'correo', 'correo electronico', 'correo electrónico', 'e-mail'],
            'nombre': ['nombre', 'name', 'nombres'],
            'primer_apellido': ['primer_apellido', 'primer apellido', 'apellido paterno', 'apellido_paterno', 'first_surname', 'apellido1'],
            'segundo_apellido': ['segundo_apellido', 'segundo apellido', 'apellido materno', 'apellido_materno', 'second_surname', 'apellido2'],
            'genero': ['genero', 'género', 'sexo', 'gender'],
            'curp': ['curp']
        }
        
        # Encontrar índices de columnas
        column_indices = {}
        for field, aliases in column_mapping.items():
            for i, header in enumerate(headers):
                if header in aliases:
                    column_indices[field] = i
                    break
        
        # Verificar columnas requeridas (email y curp son opcionales)
        required_columns = ['nombre', 'primer_apellido']
        missing_columns = [col for col in required_columns if col not in column_indices]
        if missing_columns:
            return jsonify({
                'error': f'Faltan columnas requeridas: {", ".join(missing_columns)}',
                'hint': 'Las columnas requeridas son: nombre, primer_apellido, segundo_apellido, genero'
            }), 400
        
        # Función para generar contraseña aleatoria
        def generate_password(length=10):
            alphabet = string.ascii_letters + string.digits
            # Asegurar al menos una mayúscula, una minúscula y un número
            password = [
                secrets.choice(string.ascii_uppercase),
                secrets.choice(string.ascii_lowercase),
                secrets.choice(string.digits)
            ]
            password += [secrets.choice(alphabet) for _ in range(length - 3)]
            secrets.SystemRandom().shuffle(password)
            return ''.join(password)
        
        # Procesar filas (empezar en fila 3: fila 1=encabezados, fila 2=descripciones)
        results = {
            'created': [],
            'errors': [],
            'skipped': [],
            'total_processed': 0
        }
        
        for row_idx, row in enumerate(sheet.iter_rows(min_row=3), start=3):
            results['total_processed'] += 1
            
            # Obtener valores de la fila
            def get_cell_value(field):
                if field not in column_indices:
                    return None
                idx = column_indices[field]
                if idx < len(row):
                    value = row[idx].value
                    return str(value).strip() if value is not None else None
                return None
            
            email = get_cell_value('email')
            nombre = get_cell_value('nombre')
            primer_apellido = get_cell_value('primer_apellido')
            segundo_apellido = get_cell_value('segundo_apellido')
            genero = get_cell_value('genero')
            curp = get_cell_value('curp')
            
            # Validar campos requeridos (email y curp son opcionales)
            missing_fields = []
            if not nombre:
                missing_fields.append('nombre')
            if not primer_apellido:
                missing_fields.append('primer_apellido')
            if not segundo_apellido:
                missing_fields.append('segundo_apellido')
            if not genero:
                missing_fields.append('genero')
            
            if missing_fields:
                missing_str = ', '.join(missing_fields)
                results['errors'].append({
                    'row': row_idx,
                    'email': email or '(vacío)',
                    'error': f'Campos requeridos vacíos: {missing_str}'
                })
                continue
            
            # Si hay email, validar formato y unicidad
            if email:
                email = email.lower().strip()
                if not validate_email(email):
                    results['errors'].append({
                        'row': row_idx,
                        'email': email,
                        'error': 'Formato de email inválido'
                    })
                    continue
                # Verificar si el email ya existe
                if User.query.filter_by(email=email).first():
                    results['skipped'].append({
                        'row': row_idx,
                        'email': email,
                        'reason': 'Email ya registrado'
                    })
                    continue
            
            # Validar y verificar CURP (opcional - sin CURP no puede recibir certificado CONOCER)
            if curp:
                curp = curp.upper().strip()
                if len(curp) != 18:
                    results['errors'].append({
                        'row': row_idx,
                        'email': email or '(sin email)',
                        'error': f'CURP inválido: debe tener 18 caracteres (tiene {len(curp)})'
                    })
                    continue
                if User.query.filter_by(curp=curp).first():
                    results['skipped'].append({
                        'row': row_idx,
                        'email': email or '(sin email)',
                        'reason': f'CURP {curp} ya registrado'
                    })
                    continue
            
            # Normalizar género (ya validado que existe)
            genero = genero.upper()[0]
            if genero not in ['M', 'F', 'O']:
                results['errors'].append({
                    'row': row_idx,
                    'email': email,
                    'error': f'Género inválido: debe ser M, F u O'
                })
                continue
            
            # Generar contraseña automáticamente
            generated_password = generate_password()
            
            # Generar username único EN MAYÚSCULAS
            # Si hay email, usar parte antes del @; si no, usar nombre+apellido
            if email:
                base_username = email.split('@')[0].upper()
            else:
                base_username = f"{nombre[:3]}{primer_apellido[:3]}".upper()
            username = base_username
            counter = 1
            while User.query.filter_by(username=username).first():
                username = f"{base_username}{counter}"
                counter += 1
            
            # Crear usuario
            try:
                new_user = User(
                    id=str(uuid.uuid4()),
                    email=email if email else None,
                    username=username,
                    name=nombre,
                    first_surname=primer_apellido,
                    second_surname=segundo_apellido or None,
                    gender=genero,
                    curp=curp or None,
                    role='candidato',
                    is_active=True,
                    is_verified=False
                )
                new_user.set_password(generated_password)
                new_user.encrypted_password = encrypt_password(generated_password)
                db.session.add(new_user)
                
                results['created'].append({
                    'row': row_idx,
                    'email': email,
                    'name': f"{nombre} {primer_apellido}",
                    'username': username,
                    'password': generated_password  # Contraseña generada automáticamente
                })
            except Exception as e:
                results['errors'].append({
                    'row': row_idx,
                    'email': email,
                    'error': str(e)
                })
                continue
        
        # Commit de todos los usuarios creados
        if results['created']:
            db.session.commit()
        
        return jsonify({
            'message': f'Proceso completado: {len(results["created"])} usuarios creados',
            'summary': {
                'total_processed': results['total_processed'],
                'created': len(results['created']),
                'errors': len(results['errors']),
                'skipped': len(results['skipped'])
            },
            'details': results
        }), 200
        
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


# ============== EXPORTAR USUARIOS CON CONTRASEÑAS (SOLO ADMIN) ==============

@bp.route('/export-credentials', methods=['POST'])
@jwt_required()
@admin_required
def export_user_credentials():
    """
    Exportar usuarios seleccionados con sus contraseñas en Excel (SOLO ADMIN)
    Recibe una lista de IDs de usuarios a exportar
    """
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from flask import send_file
        import io
        
        data = request.get_json()
        user_ids = data.get('user_ids', [])
        
        if not user_ids:
            return jsonify({'error': 'Debes seleccionar al menos un usuario'}), 400
        
        # Obtener usuarios
        users = User.query.filter(User.id.in_(user_ids)).all()
        
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

