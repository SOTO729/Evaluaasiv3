"""
Modelos para gestión de Partners, Planteles y Grupos
"""
from datetime import datetime
from app import db


# Estados de México para validación
MEXICAN_STATES = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
    'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
    'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
    'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
    'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
    'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
]


# Tabla de asociación para relación muchos-a-muchos entre User y Partner
user_partners = db.Table('user_partners',
    db.Column('user_id', db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    db.Column('partner_id', db.Integer, db.ForeignKey('partners.id', ondelete='CASCADE'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow, nullable=False)
)


class Partner(db.Model):
    """Modelo de Partner (organización/empresa)"""
    
    __tablename__ = 'partners'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    legal_name = db.Column(db.String(300))  # Razón social
    rfc = db.Column(db.String(13), unique=True)
    
    # Contacto
    email = db.Column(db.String(255))
    phone = db.Column(db.String(20))
    website = db.Column(db.String(255))
    
    # Logo/imagen
    logo_url = db.Column(db.String(500))
    
    # Estado
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Notas
    notes = db.Column(db.Text)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    state_presences = db.relationship('PartnerStatePresence', backref='partner', lazy='dynamic', cascade='all, delete-orphan')
    campuses = db.relationship('Campus', backref='partner', lazy='dynamic', cascade='all, delete-orphan')
    # Relación muchos-a-muchos con usuarios (candidatos)
    users = db.relationship('User', secondary='user_partners', lazy='dynamic',
                           backref=db.backref('partners', lazy='dynamic'))
    
    def to_dict(self, include_states=False, include_campuses=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'name': self.name,
            'legal_name': self.legal_name,
            'rfc': self.rfc,
            'email': self.email,
            'phone': self.phone,
            'website': self.website,
            'logo_url': self.logo_url,
            'is_active': self.is_active,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_states:
            data['states'] = [sp.to_dict() for sp in self.state_presences.all()]
            
        if include_campuses:
            data['campuses'] = [c.to_dict() for c in self.campuses.all()]
            data['campus_count'] = self.campuses.count()
            
        return data


class PartnerStatePresence(db.Model):
    """Presencia de un partner en un estado de México"""
    
    __tablename__ = 'partner_state_presences'
    
    id = db.Column(db.Integer, primary_key=True)
    partner_id = db.Column(db.Integer, db.ForeignKey('partners.id', ondelete='CASCADE'), nullable=False)
    state_name = db.Column(db.String(50), nullable=False)  # Nombre del estado mexicano
    
    # Contacto regional (opcional)
    regional_contact_name = db.Column(db.String(200))
    regional_contact_email = db.Column(db.String(255))
    regional_contact_phone = db.Column(db.String(20))
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('partner_id', 'state_name', name='uq_partner_state'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'partner_id': self.partner_id,
            'state_name': self.state_name,
            'regional_contact_name': self.regional_contact_name,
            'regional_contact_email': self.regional_contact_email,
            'regional_contact_phone': self.regional_contact_phone,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Campus(db.Model):
    """Plantel de un partner"""
    
    __tablename__ = 'campuses'
    
    id = db.Column(db.Integer, primary_key=True)
    partner_id = db.Column(db.Integer, db.ForeignKey('partners.id', ondelete='CASCADE'), nullable=False)
    
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50))  # Código interno del plantel
    
    # Ubicación
    state_name = db.Column(db.String(50), nullable=False)  # Estado de México
    city = db.Column(db.String(100))
    address = db.Column(db.String(500))
    postal_code = db.Column(db.String(10))
    
    # Contacto
    email = db.Column(db.String(255))
    phone = db.Column(db.String(20))
    
    # Responsable del plantel
    director_name = db.Column(db.String(200))
    director_email = db.Column(db.String(255))
    director_phone = db.Column(db.String(20))
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    groups = db.relationship('CandidateGroup', backref='campus', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_groups=False, include_partner=False):
        data = {
            'id': self.id,
            'partner_id': self.partner_id,
            'name': self.name,
            'code': self.code,
            'state_name': self.state_name,
            'city': self.city,
            'address': self.address,
            'postal_code': self.postal_code,
            'email': self.email,
            'phone': self.phone,
            'director_name': self.director_name,
            'director_email': self.director_email,
            'director_phone': self.director_phone,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'group_count': self.groups.count() if self.groups else 0,
        }
        
        if include_groups:
            data['groups'] = [g.to_dict() for g in self.groups.all()]
            
        if include_partner:
            data['partner'] = self.partner.to_dict() if self.partner else None
            
        return data


class CandidateGroup(db.Model):
    """Grupo de candidatos en un plantel"""
    
    __tablename__ = 'candidate_groups'
    
    id = db.Column(db.Integer, primary_key=True)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=False)
    
    name = db.Column(db.String(100), nullable=False)  # Ej: "Grupo A", "Turno Matutino", etc.
    code = db.Column(db.String(50))  # Código identificador
    description = db.Column(db.Text)
    
    # Período (opcional)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    
    # Capacidad
    max_members = db.Column(db.Integer, default=50)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relación con miembros
    members = db.relationship('GroupMember', backref='group', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_members=False, include_campus=False):
        data = {
            'id': self.id,
            'campus_id': self.campus_id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'max_members': self.max_members,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'member_count': self.members.count() if self.members else 0,
        }
        
        if include_members:
            data['members'] = [m.to_dict(include_user=True) for m in self.members.all()]
            
        if include_campus:
            data['campus'] = self.campus.to_dict(include_partner=True) if self.campus else None
            
        return data


class GroupMember(db.Model):
    """Miembro (candidato) de un grupo"""
    
    __tablename__ = 'group_members'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Estado en el grupo
    status = db.Column(db.String(20), default='active')  # active, inactive, completed, withdrawn
    
    # Notas sobre el candidato en este grupo
    notes = db.Column(db.Text)
    
    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('group_id', 'user_id', name='uq_group_user'),
    )
    
    # Relación con usuario
    user = db.relationship('User', backref=db.backref('group_memberships', lazy='dynamic'))
    
    def to_dict(self, include_user=False, include_group=False):
        data = {
            'id': self.id,
            'group_id': self.group_id,
            'user_id': self.user_id,
            'status': self.status,
            'notes': self.notes,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
        }
        
        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'email': self.user.email,
                'name': self.user.name,
                'first_surname': self.user.first_surname,
                'second_surname': self.user.second_surname,
                'full_name': f"{self.user.name} {self.user.first_surname} {self.user.second_surname or ''}".strip(),
                'curp': self.user.curp,
                'phone': self.user.phone,
                'is_active': self.user.is_active,
            }
            
        if include_group and self.group:
            data['group'] = self.group.to_dict(include_campus=True)
            
        return data
