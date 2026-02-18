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
from app.models.partner import GroupMember, GroupExam, GroupExamMember, CandidateGroup, Campus
from app.models.result import Result
from app.models.exam import Exam
from sqlalchemy import and_
from app.utils.rate_limit import (
    rate_limit_login, 
    rate_limit_register,
    rate_limit_password_reset,
    is_account_locked,
    increment_failed_login,
    reset_failed_login,
    lock_account,
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION
)
from datetime import datetime, timedelta
import redis
import secrets
import logging

logger = logging.getLogger(__name__)

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
      423:
        description: Cuenta bloqueada temporalmente
    """
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username y password son requeridos'}), 400
    
    # Verificar si la cuenta está bloqueada
    locked, remaining_seconds = is_account_locked(username)
    if locked:
        minutes_remaining = remaining_seconds // 60
        return jsonify({
            'error': 'Cuenta bloqueada temporalmente',
            'message': f'Has excedido el número máximo de intentos. Tu cuenta está bloqueada por {minutes_remaining} minutos.',
            'retry_after': remaining_seconds,
            'locked': True
        }), 423  # HTTP 423 Locked
    
    # Buscar usuario (por username o email, ignorando mayúsculas/minúsculas)
    username_lower = username.lower().strip()
    user = User.query.filter(
        (func.lower(User.username) == username_lower) | (func.lower(User.email) == username_lower)
    ).first()
    
    if not user or not user.check_password(password):
        # Incrementar contador de intentos fallidos
        failed_count = increment_failed_login(username)
        attempts_remaining = MAX_FAILED_ATTEMPTS - failed_count
        
        # Bloquear cuenta si excede el límite
        if failed_count >= MAX_FAILED_ATTEMPTS:
            lock_account(username, LOCKOUT_DURATION)
            return jsonify({
                'error': 'Cuenta bloqueada',
                'message': f'Has excedido {MAX_FAILED_ATTEMPTS} intentos fallidos. Tu cuenta ha sido bloqueada por {LOCKOUT_DURATION // 60} minutos.',
                'locked': True,
                'retry_after': LOCKOUT_DURATION
            }), 423
        
        return jsonify({
            'error': 'Credenciales inválidas',
            'attempts_remaining': attempts_remaining if attempts_remaining > 0 else 0
        }), 401
    
    if not user.is_active:
        return jsonify({'error': 'Usuario inactivo'}), 401
    
    # Login exitoso - resetear contador de intentos fallidos
    reset_failed_login(username)
    
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
    
    # Obtener datos base del usuario
    user_data = user.to_dict(include_private=True)
    
    # Si es candidato, incluir información del grupo, plantel, ciclo y estado
    if user.role == 'candidato':
        # Buscar membresía activa en algún grupo
        membership = GroupMember.query.filter_by(
            user_id=user_id, 
            status='active'
        ).first()
        
        if membership and membership.group:
            group = membership.group
            campus = group.campus
            cycle = group.school_cycle
            
            user_data['group_info'] = {
                'group_id': group.id,
                'group_name': group.name,
                'group_code': group.code,
                'campus_id': campus.id if campus else None,
                'campus_name': campus.name if campus else None,
                'state_name': campus.state_name if campus else None,
                'city': campus.city if campus else None,
                'school_cycle_id': cycle.id if cycle else None,
                'school_cycle_name': cycle.name if cycle else None,
                'joined_at': membership.joined_at.isoformat() if membership.joined_at else None,
            }
        else:
            user_data['group_info'] = None
    
    return jsonify(user_data), 200


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


@bp.route('/forgot-password', methods=['POST'])
@rate_limit_password_reset(limit=3, window=3600)
def forgot_password():
    """
    Solicitar recuperación de contraseña
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
          properties:
            email:
              type: string
    responses:
      200:
        description: Si el email existe, se envía el enlace de recuperación
    """
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    
    if not email:
        return jsonify({'error': 'Email es requerido'}), 400
    
    # Siempre responder 200 para no revelar si el email existe
    success_msg = {
        'message': 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
    }
    
    user = User.query.filter(func.lower(User.email) == email).first()
    if not user or not user.is_active:
        return jsonify(success_msg), 200
    
    # Generar token seguro y guardar en Redis (expira en 1 hora)
    token = secrets.token_urlsafe(48)
    try:
        if redis_client:
            # Guardar: token -> user_id, con TTL de 1 hora
            redis_client.setex(f'pwreset:{token}', 3600, user.id)
            # Guardar referencia inversa para invalidar tokens previos
            old_token = redis_client.get(f'pwreset_user:{user.id}')
            if old_token:
                redis_client.delete(f'pwreset:{old_token.decode()}')
            redis_client.setex(f'pwreset_user:{user.id}', 3600, token)
        else:
            logger.error("Redis no disponible para forgot-password")
            return jsonify(success_msg), 200
    except Exception as e:
        logger.error(f"Error guardando token de reset: {e}")
        return jsonify(success_msg), 200
    
    # Enviar email
    try:
        from app.services.email_service import send_password_reset_email
        send_password_reset_email(user, token)
    except Exception as e:
        logger.error(f"Error enviando email de reset: {e}")
    
    return jsonify(success_msg), 200


@bp.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Restablecer contraseña con token
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
            - token
            - new_password
          properties:
            token:
              type: string
            new_password:
              type: string
    responses:
      200:
        description: Contraseña restablecida exitosamente
      400:
        description: Token inválido o expirado
    """
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')
    
    if not token or not new_password:
        return jsonify({'error': 'Token y nueva contraseña son requeridos'}), 400
    
    if len(new_password) < 8:
        return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres'}), 400
    
    # Buscar token en Redis
    try:
        if not redis_client:
            return jsonify({'error': 'Servicio no disponible'}), 503
        
        user_id = redis_client.get(f'pwreset:{token}')
        if not user_id:
            return jsonify({'error': 'El enlace ha expirado o es inválido. Solicita uno nuevo.'}), 400
        
        user_id = user_id.decode()
    except Exception as e:
        logger.error(f"Error verificando token de reset: {e}")
        return jsonify({'error': 'Error al verificar el enlace'}), 500
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Actualizar contraseña
    user.set_password(new_password)
    db.session.commit()
    
    # Invalidar token usado
    try:
        redis_client.delete(f'pwreset:{token}')
        redis_client.delete(f'pwreset_user:{user_id}')
    except Exception:
        pass
    
    logger.info(f"Contraseña restablecida para usuario {user.username} ({user.email})")
    
    return jsonify({
        'message': 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.'
    }), 200


@bp.route('/contact', methods=['POST'])
@rate_limit_password_reset(limit=5, window=3600)  # Reusar rate limit: 5/hora
def contact_form():
    """
    Formulario de contacto (landing page)
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
            - name
            - email
            - message
          properties:
            name:
              type: string
            email:
              type: string
            subject:
              type: string
            message:
              type: string
    responses:
      200:
        description: Mensaje enviado
      400:
        description: Datos inválidos
    """
    data = request.get_json()
    
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()
    subject_text = (data.get('subject') or 'Sin asunto').strip()
    message = (data.get('message') or '').strip()
    
    if not name or not email or not message:
        return jsonify({'error': 'Nombre, email y mensaje son requeridos'}), 400
    
    # Validar formato de email
    import re
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({'error': 'Formato de email inválido'}), 400
    
    # Enviar email
    try:
        from app.services.email_service import send_contact_form_email
        sent = send_contact_form_email(name, email, subject_text, message)
        if sent:
            return jsonify({'message': 'Mensaje enviado exitosamente. Nos pondremos en contacto pronto.'}), 200
        else:
            return jsonify({'message': 'Tu mensaje fue recibido. Nos pondremos en contacto pronto.'}), 200
    except Exception as e:
        logger.error(f"Error en formulario de contacto: {e}")
        return jsonify({'message': 'Tu mensaje fue recibido. Nos pondremos en contacto pronto.'}), 200


@bp.route('/my-assignments', methods=['GET'])
@jwt_required()
def get_my_assignments():
    """
    Obtener historial completo de asignaciones del usuario actual.
    Devuelve todas las asignaciones de exámenes con su configuración,
    grupo, campus y resultados asociados.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de asignaciones con resultados
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    try:
        # Obtener todas las membresías del usuario en grupos (historial completo)
        memberships = GroupMember.query.filter_by(user_id=user_id).all()
        membership_map = {}
        for m in memberships:
            membership_map[m.group_id] = {
                'status': m.status,
                'joined_at': m.joined_at.isoformat() if m.joined_at else None
            }
        
        # Obtener todos los group_ids donde el usuario es/fue miembro
        user_group_ids = [m.group_id for m in memberships]
        
        # Obtener asignaciones directas (group_exam_members - tipo 'selected')
        direct_assignments = GroupExamMember.query.filter_by(user_id=user_id).all()
        direct_ge_ids = {da.group_exam_id for da in direct_assignments}
        direct_assigned_at = {da.group_exam_id: da.assigned_at for da in direct_assignments}
        
        # Obtener todos los GroupExam relevantes:
        # 1) Tipo 'all' en grupos donde el usuario es miembro
        # 2) Tipo 'selected' donde el usuario fue asignado directamente
        group_exams = []
        
        if user_group_ids:
            # Asignaciones tipo 'all' en grupos del usuario
            all_type = GroupExam.query.filter(
                GroupExam.group_id.in_(user_group_ids),
                GroupExam.assignment_type == 'all'
            ).all()
            group_exams.extend(all_type)
        
        if direct_ge_ids:
            # Asignaciones tipo 'selected' donde está el usuario
            selected_type = GroupExam.query.filter(
                GroupExam.id.in_(direct_ge_ids)
            ).all()
            # Agregar solo los que no estén ya incluidos
            existing_ids = {ge.id for ge in group_exams}
            for ge in selected_type:
                if ge.id not in existing_ids:
                    group_exams.append(ge)
        
        # Obtener todos los resultados del usuario indexados por group_exam_id
        results = Result.query.filter_by(user_id=user_id).all()
        results_by_ge = {}
        results_by_exam = {}
        for r in results:
            if r.group_exam_id:
                if r.group_exam_id not in results_by_ge:
                    results_by_ge[r.group_exam_id] = []
                results_by_ge[r.group_exam_id].append(r)
            if r.exam_id:
                if r.exam_id not in results_by_exam:
                    results_by_exam[r.exam_id] = []
                results_by_exam[r.exam_id].append(r)
        
        # Construir respuesta
        assignments = []
        for ge in group_exams:
            # Cargar relaciones
            exam = ge.exam
            group = ge.group
            campus = group.campus if group else None
            
            # Determinar cuándo fue asignado este usuario
            effective_assigned_at = None
            if ge.id in direct_assigned_at:
                effective_assigned_at = direct_assigned_at[ge.id].isoformat() if direct_assigned_at[ge.id] else None
            elif ge.assigned_at:
                effective_assigned_at = ge.assigned_at.isoformat()
            
            # Obtener resultados para esta asignación
            ge_results = results_by_ge.get(ge.id, [])
            # Si no hay resultados por group_exam_id, buscar por exam_id + group_id
            if not ge_results and ge.group_id:
                for r in results_by_exam.get(ge.exam_id, []):
                    if r.group_id == ge.group_id:
                        ge_results.append(r)
            
            # Obtener el mejor resultado y el último intento
            best_result = None
            last_attempt = None
            attempts_count = len([r for r in ge_results if r.status == 1])  # Solo completados
            
            if ge_results:
                completed = [r for r in ge_results if r.status == 1]
                if completed:
                    best_result = max(completed, key=lambda r: r.score)
                last_attempt = max(ge_results, key=lambda r: r.start_date if r.start_date else datetime.min)
            
            assignment_data = {
                'id': ge.id,
                'assigned_at': effective_assigned_at,
                'is_active': ge.is_active,
                
                # Configuración de la asignación
                'config': {
                    'time_limit_minutes': ge.time_limit_minutes,
                    'passing_score': ge.passing_score,
                    'max_attempts': ge.max_attempts or 1,
                    'max_disconnections': ge.max_disconnections or 3,
                    'exam_content_type': ge.exam_content_type or 'questions_only',
                    'available_from': ge.available_from.isoformat() if ge.available_from else None,
                    'available_until': ge.available_until.isoformat() if ge.available_until else None,
                    'require_security_pin': ge.require_security_pin or False,
                },
                
                # Examen
                'exam': {
                    'id': exam.id,
                    'name': exam.name,
                    'version': exam.version,
                    'standard': exam.standard,
                    'duration_minutes': exam.duration_minutes,
                } if exam else None,
                
                # Grupo 
                'group': {
                    'id': group.id,
                    'name': group.name,
                    'code': group.code,
                } if group else None,
                
                # Campus
                'campus': {
                    'id': campus.id,
                    'name': campus.name,
                    'state_name': campus.state_name,
                    'city': campus.city,
                } if campus else None,
                
                # Membresía del usuario en el grupo
                'membership': membership_map.get(ge.group_id),
                
                # Resultados
                'attempts_count': attempts_count,
                'best_result': {
                    'score': best_result.score,
                    'result': best_result.result,  # 0=reprobado, 1=aprobado
                    'end_date': best_result.end_date.isoformat() if best_result.end_date else None,
                    'duration_seconds': best_result.duration_seconds,
                    'certificate_code': best_result.certificate_code,
                    'report_url': best_result.report_url,
                } if best_result else None,
                
                'last_attempt': {
                    'score': last_attempt.score,
                    'status': last_attempt.status,  # 0=en proceso, 1=completado, 2=abandonado
                    'result': last_attempt.result,
                    'start_date': last_attempt.start_date.isoformat() if last_attempt.start_date else None,
                    'end_date': last_attempt.end_date.isoformat() if last_attempt.end_date else None,
                } if last_attempt else None,
            }
            
            assignments.append(assignment_data)
        
        # Ordenar por fecha de asignación (más reciente primero)
        assignments.sort(key=lambda a: a['assigned_at'] or '', reverse=True)
        
        return jsonify({
            'assignments': assignments,
            'total': len(assignments)
        }), 200
        
    except Exception as e:
        logger.error(f"Error obteniendo historial de asignaciones: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error al obtener el historial de asignaciones'}), 500


@bp.route('/campus-assignments', methods=['GET'])
@jwt_required()
def get_campus_assignments():
    """
    Obtener historial de asignaciones del plantel del responsable.
    Solo accesible para usuarios con rol 'responsable'.
    Devuelve TODAS las asignaciones de TODOS los candidatos en los grupos
    del plantel que administra el responsable.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Lista de asignaciones del plantel con candidatos y resultados
      403:
        description: No autorizado (no es responsable)
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    if user.role != 'responsable':
        return jsonify({'error': 'Solo los responsables pueden acceder a este endpoint'}), 403
    
    try:
        # Obtener el campus que administra este responsable
        campus = Campus.query.filter_by(responsable_id=user_id).first()
        
        if not campus:
            return jsonify({
                'assignments': [],
                'total': 0,
                'campus': None
            }), 200
        
        # Obtener todos los grupos del campus
        campus_groups = CandidateGroup.query.filter_by(campus_id=campus.id).all()
        group_ids = [g.id for g in campus_groups]
        group_map = {g.id: g for g in campus_groups}
        
        if not group_ids:
            return jsonify({
                'assignments': [],
                'total': 0,
                'campus': {
                    'id': campus.id,
                    'name': campus.name,
                    'state_name': campus.state_name,
                    'city': campus.city,
                }
            }), 200
        
        # Obtener todas las asignaciones (GroupExam) de los grupos del campus
        group_exams = GroupExam.query.filter(
            GroupExam.group_id.in_(group_ids)
        ).all()
        
        if not group_exams:
            return jsonify({
                'assignments': [],
                'total': 0,
                'campus': {
                    'id': campus.id,
                    'name': campus.name,
                    'state_name': campus.state_name,
                    'city': campus.city,
                }
            }), 200
        
        ge_ids = [ge.id for ge in group_exams]
        
        # Obtener todos los miembros de los grupos del campus
        all_members = GroupMember.query.filter(
            GroupMember.group_id.in_(group_ids)
        ).all()
        
        # Mapear miembro por (group_id, user_id)
        member_map = {}
        user_ids_set = set()
        for m in all_members:
            member_map[(m.group_id, m.user_id)] = m
            user_ids_set.add(m.user_id)
        
        # Obtener asignaciones directas (tipo 'selected')
        direct_members = GroupExamMember.query.filter(
            GroupExamMember.group_exam_id.in_(ge_ids)
        ).all()
        direct_map = {}  # group_exam_id -> [user_ids]
        for dm in direct_members:
            if dm.group_exam_id not in direct_map:
                direct_map[dm.group_exam_id] = []
            direct_map[dm.group_exam_id].append(dm.user_id)
            user_ids_set.add(dm.user_id)
        
        # Cargar datos de todos los usuarios involucrados
        user_ids_list = list(user_ids_set)
        users = {}
        if user_ids_list:
            # Cargar en lotes de 500 para evitar límites de SQL IN
            for i in range(0, len(user_ids_list), 500):
                batch = user_ids_list[i:i+500]
                batch_users = User.query.filter(User.id.in_(batch)).all()
                for u in batch_users:
                    users[u.id] = u
        
        # Obtener todos los resultados de los usuarios del campus
        all_results = []
        if user_ids_list:
            for i in range(0, len(user_ids_list), 500):
                batch = user_ids_list[i:i+500]
                batch_results = Result.query.filter(User.id.in_(batch)).filter(
                    Result.user_id.in_(batch)
                ).all()
                all_results.extend(batch_results)
        
        # Indexar resultados por (user_id, group_exam_id)
        results_index = {}
        for r in all_results:
            key = (r.user_id, r.group_exam_id)
            if key not in results_index:
                results_index[key] = []
            results_index[key].append(r)
        
        # Construir respuesta: una fila por cada (candidato, asignación)
        assignments = []
        
        for ge in group_exams:
            exam = ge.exam
            group = group_map.get(ge.group_id)
            
            # Determinar qué usuarios están asignados a este examen
            if ge.assignment_type == 'selected':
                assigned_user_ids = direct_map.get(ge.id, [])
            else:
                # Tipo 'all': todos los miembros del grupo
                assigned_user_ids = [
                    m.user_id for m in all_members if m.group_id == ge.group_id
                ]
            
            for uid in assigned_user_ids:
                u = users.get(uid)
                if not u:
                    continue
                
                # Resultados de este usuario para esta asignación
                user_results = results_index.get((uid, ge.id), [])
                
                # Si no hay resultados por group_exam_id, buscar por exam_id+group_id
                if not user_results:
                    for r in all_results:
                        if r.user_id == uid and r.exam_id == ge.exam_id and r.group_id == ge.group_id:
                            user_results.append(r)
                
                best_result = None
                last_attempt = None
                attempts_count = len([r for r in user_results if r.status == 1])
                
                if user_results:
                    completed = [r for r in user_results if r.status == 1]
                    if completed:
                        best_result = max(completed, key=lambda r: r.score)
                    last_attempt = max(user_results, key=lambda r: r.start_date if r.start_date else datetime.min)
                
                membership = member_map.get((ge.group_id, uid))
                
                assignment_data = {
                    'id': f"{ge.id}-{uid}",
                    'group_exam_id': ge.id,
                    'assigned_at': ge.assigned_at.isoformat() if ge.assigned_at else None,
                    'is_active': ge.is_active,
                    
                    # Candidato
                    'candidate': {
                        'id': u.id,
                        'full_name': u.full_name,
                        'email': u.email,
                        'curp': u.curp,
                    },
                    
                    # Configuración
                    'config': {
                        'time_limit_minutes': ge.time_limit_minutes,
                        'passing_score': ge.passing_score,
                        'max_attempts': ge.max_attempts or 1,
                        'max_disconnections': ge.max_disconnections or 3,
                        'exam_content_type': ge.exam_content_type or 'questions_only',
                        'available_from': ge.available_from.isoformat() if ge.available_from else None,
                        'available_until': ge.available_until.isoformat() if ge.available_until else None,
                        'require_security_pin': ge.require_security_pin or False,
                    },
                    
                    # Examen
                    'exam': {
                        'id': exam.id,
                        'name': exam.name,
                        'version': exam.version,
                        'standard': exam.standard,
                        'duration_minutes': exam.duration_minutes,
                    } if exam else None,
                    
                    # Grupo
                    'group': {
                        'id': group.id,
                        'name': group.name,
                        'code': group.code,
                    } if group else None,
                    
                    # Campus (siempre el mismo para el responsable)
                    'campus': {
                        'id': campus.id,
                        'name': campus.name,
                        'state_name': campus.state_name,
                        'city': campus.city,
                    },
                    
                    # Membresía
                    'membership': {
                        'status': membership.status,
                        'joined_at': membership.joined_at.isoformat() if membership.joined_at else None,
                    } if membership else None,
                    
                    # Resultados
                    'attempts_count': attempts_count,
                    'best_result': {
                        'score': best_result.score,
                        'result': best_result.result,
                        'end_date': best_result.end_date.isoformat() if best_result.end_date else None,
                        'duration_seconds': best_result.duration_seconds,
                        'certificate_code': best_result.certificate_code,
                        'report_url': best_result.report_url,
                    } if best_result else None,
                    
                    'last_attempt': {
                        'score': last_attempt.score,
                        'status': last_attempt.status,
                        'result': last_attempt.result,
                        'start_date': last_attempt.start_date.isoformat() if last_attempt.start_date else None,
                        'end_date': last_attempt.end_date.isoformat() if last_attempt.end_date else None,
                    } if last_attempt else None,
                }
                
                assignments.append(assignment_data)
        
        # Ordenar por fecha de asignación (más reciente primero)
        assignments.sort(key=lambda a: a['assigned_at'] or '', reverse=True)
        
        return jsonify({
            'assignments': assignments,
            'total': len(assignments),
            'campus': {
                'id': campus.id,
                'name': campus.name,
                'state_name': campus.state_name,
                'city': campus.city,
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error obteniendo asignaciones del campus: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Error al obtener las asignaciones del plantel'}), 500
