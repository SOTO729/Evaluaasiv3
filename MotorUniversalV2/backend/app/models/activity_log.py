"""
Modelo de Log de Actividad

Sistema de auditoría para el portal de gerencia:
- Registra todas las acciones de usuarios tipo "personal"
- Permite filtrar por usuario, entidad, tipo de acción
- Captura IP y user agent para seguridad
"""
from datetime import datetime
from app import db
import json


# Tipos de acciones que se registran
ACTION_TYPES = {
    # Autenticación
    'login': 'Inicio de sesión',
    'logout': 'Cierre de sesión',
    'login_failed': 'Intento de login fallido',
    
    # CRUD genérico
    'create': 'Creación',
    'read': 'Lectura',
    'update': 'Actualización',
    'delete': 'Eliminación',
    
    # Saldos y solicitudes
    'balance_request': 'Solicitud de saldo',
    'balance_review': 'Revisión de solicitud',
    'balance_recommend': 'Recomendación de solicitud',
    'balance_approve': 'Aprobación de saldo',
    'balance_reject': 'Rechazo de saldo',
    'balance_deduct': 'Descuento de saldo',
    
    # Asignaciones
    'assign_certification': 'Asignación de certificación',
    'assign_material': 'Asignación de material',
    'unassign': 'Desasignación',
    
    # Usuarios
    'user_create': 'Creación de usuario',
    'user_update': 'Actualización de usuario',
    'user_activate': 'Activación de usuario',
    'user_deactivate': 'Desactivación de usuario',
    
    # Grupos
    'group_create': 'Creación de grupo',
    'group_update': 'Actualización de grupo',
    'group_delete': 'Eliminación de grupo',
    'member_add': 'Agregar miembro',
    'member_remove': 'Remover miembro',
    
    # Planteles
    'campus_create': 'Creación de plantel',
    'campus_update': 'Actualización de plantel',
    'campus_activate': 'Activación de plantel',
    'campus_deactivate': 'Desactivación de plantel',
    
    # Exámenes
    'exam_create': 'Creación de examen',
    'exam_update': 'Actualización de examen',
    'exam_publish': 'Publicación de examen',
    'exam_unpublish': 'Despublicación de examen',
    
    # Sistema
    'config_change': 'Cambio de configuración',
    'export_data': 'Exportación de datos',
    'import_data': 'Importación de datos',
}

# Tipos de entidades
ENTITY_TYPES = {
    'user': 'Usuario',
    'balance_request': 'Solicitud de saldo',
    'balance_transaction': 'Transacción de saldo',
    'group': 'Grupo',
    'campus': 'Plantel',
    'partner': 'Partner',
    'exam': 'Examen',
    'study_material': 'Material de estudio',
    'group_exam': 'Examen de grupo',
    'group_member': 'Miembro de grupo',
    'system': 'Sistema',
}

# Roles considerados "personal" (visible para gerente)
PERSONAL_ROLES = ['admin', 'gerente', 'financiero', 'coordinator', 'editor', 'soporte', 'auxiliar']


class ActivityLog(db.Model):
    """Registro de actividad de usuarios"""
    
    __tablename__ = 'activity_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Usuario que realizó la acción
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    user_role = db.Column(db.String(20), nullable=True)  # Guardamos rol al momento de la acción
    user_email = db.Column(db.String(255), nullable=True)  # Para referencia incluso si se borra usuario
    
    # Tipo de acción
    action_type = db.Column(db.String(50), nullable=False)
    
    # Entidad afectada
    entity_type = db.Column(db.String(50), nullable=True)
    entity_id = db.Column(db.String(50), nullable=True)  # String para soportar UUIDs
    entity_name = db.Column(db.String(255), nullable=True)  # Nombre descriptivo para logs
    
    # Detalles adicionales (JSON)
    details = db.Column(db.Text, nullable=True)  # JSON con información adicional
    
    # Información de la petición
    ip_address = db.Column(db.String(45), nullable=True)  # Soporta IPv6
    user_agent = db.Column(db.String(500), nullable=True)
    
    # Resultado de la acción
    success = db.Column(db.Boolean, default=True, nullable=False)
    error_message = db.Column(db.Text, nullable=True)
    
    # Timestamp
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relación con usuario
    user = db.relationship('User', backref=db.backref('activity_logs', lazy='dynamic'))
    
    def set_details(self, details_dict):
        """Guardar detalles como JSON"""
        if details_dict:
            self.details = json.dumps(details_dict, ensure_ascii=False, default=str)
    
    def get_details(self):
        """Obtener detalles como dict"""
        if self.details:
            try:
                return json.loads(self.details)
            except:
                return {}
        return {}
    
    def to_dict(self, include_user=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'user_role': self.user_role,
            'user_email': self.user_email,
            'action_type': self.action_type,
            'action_type_label': ACTION_TYPES.get(self.action_type, self.action_type),
            'entity_type': self.entity_type,
            'entity_type_label': ENTITY_TYPES.get(self.entity_type, self.entity_type),
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'details': self.get_details(),
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'success': self.success,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        
        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'full_name': self.user.full_name,
                'email': self.user.email,
                'role': self.user.role,
            }
        
        return data


def log_activity(user=None, action_type=None, entity_type=None, entity_id=None, 
                 entity_name=None, details=None, ip_address=None, user_agent=None,
                 success=True, error_message=None):
    """
    Helper para registrar actividad.
    
    Args:
        user: Usuario que realiza la acción (objeto o dict con id, email, role)
        action_type: Tipo de acción (ver ACTION_TYPES)
        entity_type: Tipo de entidad afectada (ver ENTITY_TYPES)
        entity_id: ID de la entidad afectada
        entity_name: Nombre descriptivo de la entidad
        details: Dict con información adicional
        ip_address: IP del cliente
        user_agent: User agent del cliente
        success: Si la acción fue exitosa
        error_message: Mensaje de error si falló
    
    Returns:
        ActivityLog creado
    """
    log = ActivityLog(
        action_type=action_type,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        entity_name=entity_name,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success,
        error_message=error_message
    )
    
    # Extraer información del usuario
    if user:
        if hasattr(user, 'id'):
            log.user_id = user.id
            log.user_email = user.email
            log.user_role = user.role
        elif isinstance(user, dict):
            log.user_id = user.get('id')
            log.user_email = user.get('email')
            log.user_role = user.get('role')
    
    # Guardar detalles
    if details:
        log.set_details(details)
    
    db.session.add(log)
    
    return log


def get_request_info():
    """Obtener IP y User Agent de la petición actual de Flask"""
    from flask import request, has_request_context
    
    if not has_request_context():
        return None, None
    
    # Obtener IP real (considerando proxies)
    ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ip_address and ',' in ip_address:
        ip_address = ip_address.split(',')[0].strip()
    
    user_agent = request.headers.get('User-Agent', '')[:500]  # Limitar longitud
    
    return ip_address, user_agent


def log_activity_from_request(user=None, action_type=None, entity_type=None, 
                              entity_id=None, entity_name=None, details=None,
                              success=True, error_message=None):
    """
    Helper que automáticamente obtiene IP y User Agent de la petición actual.
    """
    ip_address, user_agent = get_request_info()
    
    return log_activity(
        user=user,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success,
        error_message=error_message
    )
