"""
Modelo de Usuario
"""
from datetime import datetime
from app import db
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.fernet import Fernet
import base64
import hashlib
import os

ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16
)

# Funciones de encriptación/desencriptación para contraseñas (solo admin puede acceder)
def _get_encryption_key(secret_key=None):
    """Genera una clave de encriptación basada en SECRET_KEY"""
    if secret_key is None:
        secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    key = hashlib.sha256(secret_key.encode()).digest()
    return base64.urlsafe_b64encode(key)

def _get_fallback_keys():
    """Claves anteriores para desencriptar contraseñas legacy"""
    raw = os.getenv('SECRET_KEY_FALLBACKS', '')
    if not raw:
        return []
    return [k.strip() for k in raw.split(',') if k.strip()]

def encrypt_password(password):
    """Encripta una contraseña de forma reversible"""
    if not password:
        return None
    try:
        f = Fernet(_get_encryption_key())
        return f.encrypt(password.encode()).decode()
    except Exception:
        return None

def decrypt_password(encrypted_password):
    """Desencripta una contraseña, probando claves fallback si la actual falla"""
    if not encrypted_password:
        return None
    # Intentar con la clave actual
    try:
        f = Fernet(_get_encryption_key())
        return f.decrypt(encrypted_password.encode()).decode()
    except Exception:
        pass
    # Intentar con claves anteriores
    for fallback_key in _get_fallback_keys():
        try:
            f = Fernet(_get_encryption_key(fallback_key))
            return f.decrypt(encrypted_password.encode()).decode()
        except Exception:
            continue
    return None


class User(db.Model):
    """Modelo de usuario con autenticación"""
    
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True)
    # Email: nullable para candidatos sin email (unicidad manejada a nivel aplicación)
    email = db.Column(db.String(255), nullable=True, index=True)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    encrypted_password = db.Column(db.String(500))  # Contraseña encriptada (reversible) para que admin pueda verla
    
    # Información personal
    name = db.Column(db.String(100), nullable=False)
    first_surname = db.Column(db.String(100), nullable=False)
    second_surname = db.Column(db.String(100))
    gender = db.Column(db.String(1))  # M, F, O
    curp = db.Column(db.String(18), index=True)  # Unicidad manejada a nivel aplicación (no constraint por NULLs en editores)
    curp_verified = db.Column(db.Boolean, default=False, nullable=False)  # True si CURP fue validada contra RENAPO
    curp_verified_at = db.Column(db.DateTime, nullable=True)  # Fecha/hora de última validación RENAPO
    curp_renapo_name = db.Column(db.String(100), nullable=True)  # Nombre(s) devuelto por RENAPO
    curp_renapo_first_surname = db.Column(db.String(100), nullable=True)  # Primer apellido RENAPO
    curp_renapo_second_surname = db.Column(db.String(100), nullable=True)  # Segundo apellido RENAPO
    phone = db.Column(db.String(20))
    
    # Institucional
    campus_id = db.Column(db.Integer, index=True)
    subsystem_id = db.Column(db.Integer)
    
    # Fecha de nacimiento (requerido para responsables y candidatos)
    date_of_birth = db.Column(db.Date)
    
    # Rol y permisos
    role = db.Column(db.String(25), nullable=False, default='candidato', index=True)  # admin, developer, gerente, financiero, editor, editor_invitado, soporte, coordinator, candidato, auxiliar, responsable, responsable_partner
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    
    # Multi-tenant: coordinador que creó/gestiona este usuario
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    
    # Permisos específicos para responsables de plantel
    can_bulk_create_candidates = db.Column(db.Boolean, default=False, nullable=False)  # Puede crear altas masivas de candidatos
    can_manage_groups = db.Column(db.Boolean, default=False, nullable=False)  # Puede crear grupos y asignar exámenes/materiales
    can_view_reports = db.Column(db.Boolean, default=True, nullable=False)  # Puede ver reportes (habilitado por default)
    
    # Delegación de aprobación de saldos (gerente -> financiero)
    can_approve_balance = db.Column(db.Boolean, default=False, nullable=False)  # Financiero puede aprobar/rechazar solicitudes de saldo
    
    # Opciones de documentos/certificados habilitados para el usuario
    # El reporte de evaluación está habilitado por default para todos
    enable_evaluation_report = db.Column(db.Boolean, default=True, nullable=False)
    # Las siguientes opciones son opcionales y deben habilitarse explícitamente
    enable_certificate = db.Column(db.Boolean, default=False, nullable=False)
    enable_conocer_certificate = db.Column(db.Boolean, default=False, nullable=False)
    enable_digital_badge = db.Column(db.Boolean, default=False, nullable=False)
    
    # LinkedIn API OAuth2 token
    linkedin_token = db.Column(db.String(2000), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = db.Column(db.DateTime)
    
    # Relaciones
    vouchers = db.relationship('Voucher', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    results = db.relationship('Result', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        if not self.id:
            import uuid
            self.id = str(uuid.uuid4())
    
    @property
    def full_name(self):
        """Nombre completo del usuario"""
        parts = [self.name, self.first_surname]
        if self.second_surname:
            parts.append(self.second_surname)
        return ' '.join(parts)
    
    def set_password(self, password):
        """Hashear contraseña con Argon2"""
        self.password_hash = ph.hash(password)
        # SECURITY: Ya no se almacena encrypted_password (reversible)
        # La columna se mantiene por compatibilidad pero no se actualiza
    
    def get_decrypted_password(self):
        """Obtener contraseña desencriptada (solo para admin)"""
        return decrypt_password(self.encrypted_password)
    
    def check_password(self, password):
        """Verificar contraseña"""
        try:
            ph.verify(self.password_hash, password)
            # Rehash si es necesario (auto-upgrade)
            if ph.check_needs_rehash(self.password_hash):
                self.password_hash = ph.hash(password)
                db.session.commit()
            return True
        except VerifyMismatchError:
            return False
    
    def has_permission(self, permission):
        """Verificar si el usuario tiene un permiso específico"""
        role_permissions = {
            'admin': ['*'],  # Todos los permisos
            'developer': ['*'],  # Mismos permisos que admin, pero sin poder desactivar/eliminar usuarios
            'gerente': ['users:read', 'users:manage', 'balance:approve', 'activity:read', 'reports:read'],  # Ver actividad de personal, aprobar saldos
            'financiero': ['users:read', 'balance:review', 'balance:read', 'reports:read'],  # Revisar y recomendar saldos
            'editor': ['exams:create', 'exams:read', 'exams:update', 'exams:delete'],
            'editor_invitado': ['exams:create', 'exams:read', 'exams:update', 'exams:delete'],  # Mismo que editor pero con aislamiento de datos
            'soporte': ['users:read', 'vouchers:create', 'vouchers:read'],
            'coordinator': ['users:read', 'users:create', 'exams:read', 'groups:manage', 'balance:request'],
            'responsable': ['users:read', 'users:create', 'exams:read', 'groups:manage'],  # Permisos base, extendidos por can_bulk_create_candidates y can_manage_groups
            'responsable_partner': ['users:read', 'exams:read', 'groups:manage', 'reports:read', 'certificates:read'],  # Ve todos los planteles de su partner
            'candidato': ['exams:read', 'evaluations:create'],
            'auxiliar': ['users:read', 'exams:read']
        }
        
        permissions = role_permissions.get(self.role, [])
        return '*' in permissions or permission in permissions
    
    def to_dict(self, include_private=False, include_partners=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'name': self.name,
            'first_surname': self.first_surname,
            'second_surname': self.second_surname,
            'full_name': self.full_name,
            'gender': self.gender,
            'role': self.role,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            # Opciones de documentos habilitados
            'can_approve_balance': self.can_approve_balance if self.role == 'financiero' else None,
            'document_options': {
                'evaluation_report': self.enable_evaluation_report,
                'certificate': self.enable_certificate,
                'conocer_certificate': self.enable_conocer_certificate,
                'digital_badge': self.enable_digital_badge
            }
        }
        
        if include_private:
            # Resolver nombre del coordinador si tiene coordinator_id
            coordinator_name = None
            if self.coordinator_id:
                from app.models.user import User as UserModel
                coord = UserModel.query.get(self.coordinator_id)
                if coord:
                    coordinator_name = coord.full_name
            data.update({
                'curp': self.curp,
                'curp_verified': self.curp_verified,
                'curp_verified_at': self.curp_verified_at.isoformat() if self.curp_verified_at else None,
                'curp_renapo_name': self.curp_renapo_name,
                'curp_renapo_first_surname': self.curp_renapo_first_surname,
                'curp_renapo_second_surname': self.curp_renapo_second_surname,
                'phone': self.phone,
                'campus_id': self.campus_id,
                'subsystem_id': self.subsystem_id,
                'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
                'can_bulk_create_candidates': self.can_bulk_create_candidates,
                'can_manage_groups': self.can_manage_groups,
                'can_view_reports': self.can_view_reports,
                'coordinator_id': self.coordinator_id,
                'coordinator_name': coordinator_name
            })
        
        if include_partners:
            # Incluir información de partners asociados
            data['partners'] = [{
                'id': p.id,
                'name': p.name,
                'logo_url': p.logo_url
            } for p in self.partners.all()]
        
        return data
    
    def __repr__(self):
        return f'<User {self.username}>'
