"""
Rutas de autenticación
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from sqlalchemy import func
from app import db, cache
from app.models.user import User
from app.utils.rate_limit import rate_limit_login, rate_limit_register
from datetime import datetime
import redis

bp = Blueprint('auth', __name__)

# Redis para tokens revocados
try:
    redis_client = redis.from_url(cache.config['CACHE_REDIS_URL'])
except:
    redis_client = None


@bp.route('/register', methods=['POST'])
@rate_limit_register(limit=3, window=3600)  # 3 registros por hora por IP
def register():
    """
    Registro de nuevo usuario
    ---
    tags:
      - Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - email
            - username
            - password
            - name
            - first_surname
          properties:
            email:
              type: string
            username:
              type: string
            password:
              type: string
            name:
              type: string
            first_surname:
              type: string
            second_surname:
              type: string
            gender:
              type: string
            phone:
              type: string
    responses:
      201:
        description: Usuario creado exitosamente
      400:
        description: Datos inválidos
    """
    data = request.get_json()
    
    # Validaciones
    required_fields = ['email', 'username', 'password', 'name', 'first_surname']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} es requerido'}), 400
    
    # Verificar si ya existe
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'El email ya está registrado'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'El username ya está en uso'}), 400
    
    # Crear usuario
    user = User(
        email=data['email'],
        username=data['username'],
        name=data['name'],
        first_surname=data['first_surname'],
        second_surname=data.get('second_surname'),
        gender=data.get('gender'),
        phone=data.get('phone'),
        curp=data.get('curp'),
        campus_id=data.get('campus_id', 0),
        subsystem_id=data.get('subsystem_id', 0),
        role=data.get('role', 'candidato')  # Cambiado de 'alumno' a 'candidato'
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'message': 'Usuario creado exitosamente',
        'user': user.to_dict()
    }), 201


@bp.route('/login', methods=['POST'])
@rate_limit_login(limit=5, window=300)  # 5 intentos cada 5 minutos por IP
def login():
    """
    Iniciar sesión
    ---
    tags:
      - Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
            password:
              type: string
    responses:
      200:
        description: Login exitoso
      401:
        description: Credenciales inválidas
    """
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username y password son requeridos'}), 400
    
    # Buscar usuario (por username o email, ignorando mayúsculas/minúsculas)
    username_lower = username.lower().strip()
    user = User.query.filter(
        (func.lower(User.username) == username_lower) | (func.lower(User.email) == username_lower)
    ).first()
    
    if not user or not user.check_password(password):
        return jsonify({'error': 'Credenciales inválidas'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Usuario inactivo'}), 401
    
    # Actualizar último login
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    # Crear tokens
    access_token = create_access_token(
        identity=user.id,
        fresh=True,
        additional_claims={
            'role': user.role,
            'username': user.username
        }
    )
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
        'message': 'Login exitoso',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(include_private=True)
    }), 200


@bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refrescar access token
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Token refrescado
    """
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity, fresh=False)
    
    return jsonify({
        'access_token': access_token
    }), 200


@bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Cerrar sesión (revocar token)
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Logout exitoso
    """
    if redis_client:
        jti = get_jwt()['jti']
        # Guardar token en blacklist por 24 horas
        redis_client.setex(f'revoked:{jti}', 86400, 'true')
    
    return jsonify({'message': 'Logout exitoso'}), 200


@bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Obtener información del usuario actual
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Información del usuario
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    return jsonify(user.to_dict(include_private=True)), 200


@bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Cambiar contraseña
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - current_password
            - new_password
          properties:
            current_password:
              type: string
            new_password:
              type: string
    responses:
      200:
        description: Contraseña actualizada
      400:
        description: Contraseña actual incorrecta
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Contraseñas requeridas'}), 400
    
    if not user.check_password(current_password):
        return jsonify({'error': 'Contraseña actual incorrecta'}), 400
    
    if len(new_password) < 8:
        return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres'}), 400
    
    user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'message': 'Contraseña actualizada exitosamente'}), 200


@bp.route('/verify-password', methods=['POST'])
@jwt_required()
def verify_password():
    """
    Verificar contraseña del usuario actual
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - password
          properties:
            password:
              type: string
    responses:
      200:
        description: Contraseña verificada correctamente
      401:
        description: Contraseña incorrecta
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    data = request.get_json()
    password = data.get('password')
    
    if not password:
        return jsonify({'error': 'Contraseña requerida'}), 400
    
    if not user.check_password(password):
        return jsonify({'error': 'Contraseña incorrecta'}), 401
    
    return jsonify({'message': 'Contraseña verificada correctamente'}), 200


@bp.route('/request-email-change', methods=['POST'])
@jwt_required()
def request_email_change():
    """
    Solicitar cambio de correo electrónico
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - new_email
            - password
          properties:
            new_email:
              type: string
            password:
              type: string
    responses:
      200:
        description: Correo actualizado exitosamente
      400:
        description: Datos inválidos
      401:
        description: Contraseña incorrecta
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    data = request.get_json()
    new_email = data.get('new_email')
    password = data.get('password')
    
    if not new_email or not password:
        return jsonify({'error': 'Nuevo correo y contraseña son requeridos'}), 400
    
    # Verificar contraseña
    if not user.check_password(password):
        return jsonify({'error': 'Contraseña incorrecta'}), 401
    
    # Validar formato de email
    import re
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_regex, new_email):
        return jsonify({'error': 'Formato de correo electrónico inválido'}), 400
    
    # Verificar que el email no esté en uso
    existing_user = User.query.filter_by(email=new_email).first()
    if existing_user and existing_user.id != user.id:
        return jsonify({'error': 'Este correo electrónico ya está registrado'}), 400
    
    # En producción, aquí se enviaría un correo de verificación
    # Por ahora, actualizamos directamente
    old_email = user.email
    user.email = new_email
    db.session.commit()
    
    return jsonify({
        'message': 'Correo electrónico actualizado exitosamente',
        'old_email': old_email,
        'new_email': new_email
    }), 200
