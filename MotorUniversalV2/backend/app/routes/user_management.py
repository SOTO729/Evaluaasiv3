"""
Rutas para gestión de usuarios (admin y coordinadores)
"""
from flask import Blueprint, request, jsonify, g
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User
import uuid
import re

bp = Blueprint('user_management', __name__, url_prefix='/api/user-management')

# Roles disponibles en el sistema (sin alumno)
AVAILABLE_ROLES = ['admin', 'editor', 'soporte', 'coordinator', 'candidato', 'auxiliar']

# Roles que puede crear cada tipo de usuario
ROLE_CREATE_PERMISSIONS = {
    'admin': ['editor', 'soporte', 'coordinator', 'candidato', 'auxiliar'],  # Todo menos admin
    'coordinator': ['candidato']  # Solo candidatos
}


def management_required(f):
    """Decorador que requiere rol de admin o coordinator"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'No autorizado'}), 401
        if user.role not in ['admin', 'coordinator']:
            return jsonify({'error': 'Acceso denegado. Se requiere rol de administrador o coordinador'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorador que requiere rol de admin"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'No autorizado'}), 401
        if user.role != 'admin':
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
    """Listar usuarios según permisos del solicitante"""
    try:
        current_user = g.current_user
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '')
        role_filter = request.args.get('role', '')
        active_filter = request.args.get('is_active', '')
        
        query = User.query
        
        # Coordinadores solo ven candidatos
        if current_user.role == 'coordinator':
            query = query.filter(User.role == 'candidato')
        
        # Filtros
        if role_filter:
            # Soportar múltiples roles separados por coma (ej: "admin,editor,soporte")
            roles = [r.strip() for r in role_filter.split(',') if r.strip()]
            if len(roles) == 1:
                query = query.filter(User.role == roles[0])
            elif len(roles) > 1:
                query = query.filter(User.role.in_(roles))
            
        if active_filter != '':
            is_active = active_filter.lower() == 'true'
            query = query.filter(User.is_active == is_active)
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    User.name.ilike(search_term),
                    User.first_surname.ilike(search_term),
                    User.email.ilike(search_term),
                    User.curp.ilike(search_term),
                    User.username.ilike(search_term)
                )
            )
        
        query = query.order_by(User.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'users': [u.to_dict(include_private=True) for u in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/users/<string:user_id>', methods=['GET'])
@jwt_required()
@management_required
def get_user_detail(user_id):
    """Obtener detalle de un usuario"""
    try:
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        
        # Coordinadores solo pueden ver candidatos
        if current_user.role == 'coordinator' and user.role != 'candidato':
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
        current_user = g.current_user
        data = request.get_json()
        
        # Validar campos requeridos
        required_fields = ['email', 'password', 'name', 'first_surname', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'El campo {field} es requerido'}), 400
        
        email = data['email'].strip().lower()
        role = data['role']
        
        # Validar email
        if not validate_email(email):
            return jsonify({'error': 'Formato de email inválido'}), 400
        
        # Verificar email único
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Ya existe un usuario con ese email'}), 400
        
        # Validar contraseña
        is_valid, error_msg = validate_password(data['password'])
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Verificar permisos de creación según rol
        allowed_roles = ROLE_CREATE_PERMISSIONS.get(current_user.role, [])
        if role not in allowed_roles:
            if current_user.role == 'coordinator':
                return jsonify({'error': 'Los coordinadores solo pueden crear usuarios de tipo candidato'}), 403
            else:
                return jsonify({'error': f'No tienes permiso para crear usuarios con rol {role}'}), 403
        
        # Verificar CURP único si se proporciona
        if data.get('curp'):
            curp = data['curp'].upper().strip()
            if User.query.filter_by(curp=curp).first():
                return jsonify({'error': 'Ya existe un usuario con ese CURP'}), 400
        
        # Generar username si no se proporciona
        username = data.get('username', '').strip()
        if not username:
            # Generar username a partir del email
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            while User.query.filter_by(username=username).first():
                username = f"{base_username}{counter}"
                counter += 1
        else:
            # Verificar username único
            if User.query.filter_by(username=username).first():
                return jsonify({'error': 'Ya existe un usuario con ese nombre de usuario'}), 400
        
        # Crear usuario
        new_user = User(
            id=str(uuid.uuid4()),
            email=email,
            username=username,
            name=data['name'].strip(),
            first_surname=data['first_surname'].strip(),
            second_surname=data.get('second_surname', '').strip() or None,
            gender=data.get('gender'),
            curp=data.get('curp', '').upper().strip() or None,
            phone=data.get('phone', '').strip() or None,
            role=role,
            is_active=data.get('is_active', True),
            is_verified=data.get('is_verified', False)
        )
        new_user.set_password(data['password'])
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'message': 'Usuario creado exitosamente',
            'user': new_user.to_dict(include_private=True)
        }), 201
        
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
        
        # Coordinadores solo pueden editar candidatos
        if current_user.role == 'coordinator' and user.role != 'candidato':
            return jsonify({'error': 'No tienes permiso para editar este usuario'}), 403
        
        # No se puede editar a uno mismo por esta ruta (usar perfil)
        if user_id == current_user.id:
            return jsonify({'error': 'Usa la opción de perfil para editar tu propia cuenta'}), 400
        
        # Campos actualizables
        basic_fields = ['name', 'first_surname', 'second_surname', 'gender', 'phone']
        for field in basic_fields:
            if field in data:
                setattr(user, field, data[field].strip() if data[field] else None)
        
        # CURP - verificar unicidad
        if 'curp' in data:
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
        if current_user.role == 'admin':
            if 'role' in data:
                new_role = data['role']
                # Admin no puede crear otros admins
                if new_role == 'admin' and user.role != 'admin':
                    return jsonify({'error': 'No se puede asignar rol de administrador'}), 403
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
        
        # Coordinadores solo pueden cambiar contraseña de candidatos
        if current_user.role == 'coordinator' and user.role != 'candidato':
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


# ============== ACTIVAR/DESACTIVAR USUARIOS ==============

@bp.route('/users/<string:user_id>/toggle-active', methods=['POST'])
@jwt_required()
@management_required
def toggle_user_active(user_id):
    """Activar o desactivar un usuario"""
    try:
        current_user = g.current_user
        user = User.query.get_or_404(user_id)
        
        # Coordinadores solo pueden manejar candidatos
        if current_user.role == 'coordinator' and user.role != 'candidato':
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


# ============== ESTADÍSTICAS ==============

@bp.route('/stats', methods=['GET'])
@jwt_required()
@management_required
def get_user_stats():
    """Obtener estadísticas de usuarios"""
    try:
        current_user = g.current_user
        
        base_query = User.query
        
        # Coordinadores solo ven stats de candidatos
        if current_user.role == 'coordinator':
            base_query = base_query.filter(User.role == 'candidato')
        
        total_users = base_query.count()
        active_users = base_query.filter(User.is_active == True).count()
        inactive_users = base_query.filter(User.is_active == False).count()
        verified_users = base_query.filter(User.is_verified == True).count()
        
        # Usuarios por rol (solo para admin)
        users_by_role = []
        if current_user.role == 'admin':
            for role in AVAILABLE_ROLES:
                count = User.query.filter_by(role=role).count()
                users_by_role.append({'role': role, 'count': count})
        else:
            users_by_role = [{'role': 'candidato', 'count': total_users}]
        
        return jsonify({
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': inactive_users,
            'verified_users': verified_users,
            'users_by_role': users_by_role
        })
        
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
            'soporte': 'Soporte - Atención a usuarios y vouchers',
            'coordinator': 'Coordinador - Gestión de partners y candidatos',
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
            ] if current_user.role == 'admin' else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
