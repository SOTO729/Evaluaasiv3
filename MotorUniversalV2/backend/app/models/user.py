"""
Modelo de Usuario
"""
from datetime import datetime
from app import db
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16
)


class User(db.Model):
    """Modelo de usuario con autenticación"""
    
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Información personal
    name = db.Column(db.String(100), nullable=False)
    first_surname = db.Column(db.String(100), nullable=False)
    second_surname = db.Column(db.String(100))
    gender = db.Column(db.String(1))  # M, F, O
    curp = db.Column(db.String(18), unique=True)
    phone = db.Column(db.String(20))
    
    # Institucional
    campus_id = db.Column(db.Integer)
    subsystem_id = db.Column(db.Integer)
    
    # Rol y permisos
    role = db.Column(db.String(20), nullable=False, default='candidato')  # admin, editor, soporte, candidato, auxiliar
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    
    # Opciones de documentos/certificados habilitados para el usuario
    # El reporte de evaluación está habilitado por default para todos
    enable_evaluation_report = db.Column(db.Boolean, default=True, nullable=False)
    # Las siguientes opciones son opcionales y deben habilitarse explícitamente
    enable_certificate = db.Column(db.Boolean, default=False, nullable=False)
    enable_conocer_certificate = db.Column(db.Boolean, default=False, nullable=False)
    enable_digital_badge = db.Column(db.Boolean, default=False, nullable=False)
    
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
            'editor': ['exams:create', 'exams:read', 'exams:update', 'exams:delete'],
            'soporte': ['users:read', 'vouchers:create', 'vouchers:read'],
            'candidato': ['exams:read', 'evaluations:create'],
            'auxiliar': ['users:read', 'exams:read']
        }
        
        permissions = role_permissions.get(self.role, [])
        return '*' in permissions or permission in permissions
    
    def to_dict(self, include_private=False):
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
            'document_options': {
                'evaluation_report': self.enable_evaluation_report,
                'certificate': self.enable_certificate,
                'conocer_certificate': self.enable_conocer_certificate,
                'digital_badge': self.enable_digital_badge
            }
        }
        
        if include_private:
            data.update({
                'curp': self.curp,
                'phone': self.phone,
                'campus_id': self.campus_id,
                'subsystem_id': self.subsystem_id
            })
        
        return data
    
    def __repr__(self):
        return f'<User {self.username}>'
