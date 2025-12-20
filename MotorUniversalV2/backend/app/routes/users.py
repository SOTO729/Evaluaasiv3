"""
Rutas de usuarios
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User

bp = Blueprint('users', __name__)


@bp.route('', methods=['GET'])
@jwt_required()
def get_users():
    """
    Listar usuarios (solo admin/soporte)
    ---
    tags:
      - Users
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de usuarios
      403:
        description: Sin permisos
    """
    user_id = get_jwt_identity()
    current_user = User.query.get(user_id)
    
    if not current_user or not current_user.has_permission('users:read'):
        return jsonify({'error': 'Permiso denegado'}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    role = request.args.get('role')
    
    query = User.query
    
    if role:
        query = query.filter_by(role=role)
    
    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )
    
    return jsonify({
        'users': [user.to_dict() for user in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': pagination.page
    }), 200


@bp.route('/<string:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Obtener información de un usuario"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Solo admin/soporte pueden ver otros usuarios, o el usuario mismo
    if user_id != current_user_id and not current_user.has_permission('users:read'):
        return jsonify({'error': 'Permiso denegado'}), 403
    
    include_private = (user_id == current_user_id or current_user.role in ['admin', 'soporte'])
    
    return jsonify(user.to_dict(include_private=include_private)), 200


@bp.route('/<string:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Actualizar usuario"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Solo el mismo usuario o admin pueden actualizar
    if user_id != current_user_id and current_user.role != 'admin':
        return jsonify({'error': 'Permiso denegado'}), 403
    
    data = request.get_json()
    
    # Campos que puede actualizar cualquier usuario
    self_updatable_fields = ['name', 'first_surname', 'second_surname', 'phone']
    
    # Campos que solo admin puede actualizar
    admin_only_fields = ['role', 'is_active', 'campus_id', 'subsystem_id']
    
    for field in self_updatable_fields:
        if field in data:
            setattr(user, field, data[field])
    
    # Solo admin puede cambiar role y estado
    if current_user.role == 'admin':
        for field in admin_only_fields:
            if field in data:
                setattr(user, field, data[field])
    
    db.session.commit()
    
    return jsonify({
        'message': 'Usuario actualizado exitosamente',
        'user': user.to_dict(include_private=True)
    }), 200
