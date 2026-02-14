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

# Países disponibles
AVAILABLE_COUNTRIES = [
    'México', 'Estados Unidos', 'Canadá', 'España', 'Argentina', 'Chile',
    'Colombia', 'Perú', 'Brasil', 'Ecuador', 'Venezuela', 'Guatemala',
    'Costa Rica', 'Panamá', 'República Dominicana', 'Puerto Rico', 'Otro'
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
    
    # País de origen
    country = db.Column(db.String(100), default='México', nullable=False)
    
    # Coordinador dueño (multi-tenant)
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    
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
    # Relación con el coordinador dueño
    coordinator = db.relationship('User', foreign_keys=[coordinator_id], backref=db.backref('owned_partners', lazy='dynamic'))
    
    def to_dict(self, include_states=False, include_campuses=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'name': self.name,
            'legal_name': self.legal_name,
            'rfc': self.rfc,
            'country': self.country or 'México',
            'coordinator_id': self.coordinator_id,
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
            # Obtener estados únicos desde los campus del partner
            campus_states = db.session.query(Campus.state_name).filter(
                Campus.partner_id == self.id
            ).distinct().all()
            unique_states = sorted(set([s[0] for s in campus_states if s[0]]))
            data['states'] = [{'state_name': state, 'from_campuses': True} for state in unique_states]
            data['state_count'] = len(unique_states)
            
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
    code = db.Column(db.String(15), unique=True, nullable=False)  # Código único auto-generado
    
    # Ubicación
    country = db.Column(db.String(100), default='México', nullable=False)  # País
    state_name = db.Column(db.String(50))  # Estado (solo para México, opcional para otros países)
    city = db.Column(db.String(100))
    address = db.Column(db.String(500))
    postal_code = db.Column(db.String(10))
    
    # Contacto
    email = db.Column(db.String(255))
    phone = db.Column(db.String(20))
    website = db.Column(db.String(500))  # Sitio web (opcional)
    
    # Director del plantel (datos completos como candidato)
    director_name = db.Column(db.String(200))  # Nombre(s)
    director_first_surname = db.Column(db.String(100))  # Primer apellido
    director_second_surname = db.Column(db.String(100))  # Segundo apellido
    director_email = db.Column(db.String(255))
    director_phone = db.Column(db.String(20))
    director_curp = db.Column(db.String(18))  # CURP
    director_gender = db.Column(db.String(1))  # M, F, O
    director_date_of_birth = db.Column(db.Date)  # Fecha de nacimiento
    
    # Responsable del plantel (usuario del sistema - para activación)
    responsable_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'))
    
    # Estado de activación del plantel
    # pending: Recién creado, sin responsable
    # configuring: Tiene responsable pero falta configuración
    # active: Completamente activado y operativo
    activation_status = db.Column(db.String(20), default='pending', nullable=False)
    activated_at = db.Column(db.DateTime)  # Fecha de activación completa
    
    # Por defecto inactivo hasta completar el proceso de activación
    is_active = db.Column(db.Boolean, default=False, nullable=False)
    
    # ========== CONFIGURACIÓN DEL PLANTEL ==========
    
    # Versión de Office para certificación
    office_version = db.Column(db.String(20), default='office_365')  # office_2016, office_2019, office_365
    
    # Tiers de certificación habilitados
    enable_tier_basic = db.Column(db.Boolean, default=False)  # Constancia de participación Eduit
    enable_tier_standard = db.Column(db.Boolean, default=False)  # Certificado Eduit oficial
    enable_tier_advanced = db.Column(db.Boolean, default=False)  # Certificado CONOCER
    enable_digital_badge = db.Column(db.Boolean, default=False)  # Insignia digital
    
    # Evaluaciones parciales
    enable_partial_evaluations = db.Column(db.Boolean, default=False)  # Habilitar evaluaciones parciales
    enable_unscheduled_partials = db.Column(db.Boolean, default=False)  # Parciales sin agendar
    
    # Máquinas virtuales
    enable_virtual_machines = db.Column(db.Boolean, default=False)  # Usar VMs para exámenes
    
    # Pagos en línea
    enable_online_payments = db.Column(db.Boolean, default=False)  # Habilitar pagos en línea
    
    # Vigencia del plantel (licencia)
    license_start_date = db.Column(db.Date)  # Fecha de inicio de vigencia (legacy)
    license_end_date = db.Column(db.Date)  # Fecha de fin de vigencia (legacy)
    assignment_validity_months = db.Column(db.Integer, default=6)  # Meses de vigencia tras asignación
    
    # Costos
    certification_cost = db.Column(db.Numeric(10, 2), default=0)  # Costo por certificación
    retake_cost = db.Column(db.Numeric(10, 2), default=0)  # Costo por retoma
    
    # Configuración completada
    configuration_completed = db.Column(db.Boolean, default=False)
    configuration_completed_at = db.Column(db.DateTime)
    
    # ========== FIN CONFIGURACIÓN ==========
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    responsable = db.relationship('User', foreign_keys=[responsable_id], backref='managed_campuses')
    groups = db.relationship('CandidateGroup', backref='campus', lazy='dynamic', cascade='all, delete-orphan')
    school_cycles = db.relationship('SchoolCycle', backref='campus', lazy='dynamic', cascade='all, delete-orphan')
    # Relación muchos-a-muchos con estándares de competencia (ECM)
    competency_standards = db.relationship('CampusCompetencyStandard', backref='campus', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_groups=False, include_partner=False, include_cycles=False, include_responsable=False, include_config=False, include_ecms=False):
        data = {
            'id': self.id,
            'partner_id': self.partner_id,
            'name': self.name,
            'code': self.code,
            'country': self.country or 'México',
            'state_name': self.state_name,
            'city': self.city,
            'address': self.address,
            'postal_code': self.postal_code,
            'email': self.email,
            'phone': self.phone,
            'website': self.website,
            # Director del plantel (datos completos)
            'director_name': self.director_name,
            'director_first_surname': self.director_first_surname,
            'director_second_surname': self.director_second_surname,
            'director_email': self.director_email,
            'director_phone': self.director_phone,
            'director_curp': self.director_curp,
            'director_gender': self.director_gender,
            'director_date_of_birth': self.director_date_of_birth.isoformat() if self.director_date_of_birth else None,
            'director_full_name': ' '.join(filter(None, [self.director_name, self.director_first_surname, self.director_second_surname])) if self.director_name else None,
            'responsable_id': self.responsable_id,
            'activation_status': self.activation_status,
            'activated_at': self.activated_at.isoformat() if self.activated_at else None,
            'is_active': self.is_active,
            'configuration_completed': self.configuration_completed or False,
            'configuration_completed_at': self.configuration_completed_at.isoformat() if self.configuration_completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'group_count': self.groups.count() if self.groups else 0,
            'cycle_count': self.school_cycles.count() if self.school_cycles else 0,
            # Campos de configuración siempre incluidos (con valores por defecto si son None)
            'office_version': self.office_version or 'office_365',
            'enable_tier_basic': self.enable_tier_basic if self.enable_tier_basic is not None else True,
            'enable_tier_standard': self.enable_tier_standard if self.enable_tier_standard is not None else False,
            'enable_tier_advanced': self.enable_tier_advanced if self.enable_tier_advanced is not None else False,
            'enable_digital_badge': self.enable_digital_badge if self.enable_digital_badge is not None else False,
            'enable_partial_evaluations': self.enable_partial_evaluations if self.enable_partial_evaluations is not None else False,
            'enable_unscheduled_partials': self.enable_unscheduled_partials if self.enable_unscheduled_partials is not None else False,
            'enable_virtual_machines': self.enable_virtual_machines if self.enable_virtual_machines is not None else False,
            'enable_online_payments': self.enable_online_payments if self.enable_online_payments is not None else False,
            'assignment_validity_months': self.assignment_validity_months or 6,
            'certification_cost': float(self.certification_cost) if self.certification_cost else 0,
            'retake_cost': float(self.retake_cost) if self.retake_cost else 0,
        }
        
        # Incluir configuración del plantel
        if include_config:
            data['config'] = {
                'office_version': self.office_version or 'office_365',
                'enable_tier_basic': self.enable_tier_basic if self.enable_tier_basic is not None else True,
                'enable_tier_standard': self.enable_tier_standard if self.enable_tier_standard is not None else False,
                'enable_tier_advanced': self.enable_tier_advanced if self.enable_tier_advanced is not None else False,
                'enable_digital_badge': self.enable_digital_badge if self.enable_digital_badge is not None else False,
                'enable_partial_evaluations': self.enable_partial_evaluations if self.enable_partial_evaluations is not None else False,
                'enable_unscheduled_partials': self.enable_unscheduled_partials if self.enable_unscheduled_partials is not None else False,
                'enable_virtual_machines': self.enable_virtual_machines if self.enable_virtual_machines is not None else False,
                'enable_online_payments': self.enable_online_payments if self.enable_online_payments is not None else False,
                'assignment_validity_months': self.assignment_validity_months or 6,
                'certification_cost': float(self.certification_cost) if self.certification_cost else 0,
                'retake_cost': float(self.retake_cost) if self.retake_cost else 0,
            }
        
        if include_responsable and self.responsable:
            data['responsable'] = {
                'id': self.responsable.id,
                'username': self.responsable.username,
                'full_name': self.responsable.full_name,
                'email': self.responsable.email,
                'curp': self.responsable.curp,
                'gender': self.responsable.gender,
                'date_of_birth': self.responsable.date_of_birth.isoformat() if self.responsable.date_of_birth else None,
                'can_bulk_create_candidates': self.responsable.can_bulk_create_candidates,
                'can_manage_groups': self.responsable.can_manage_groups,
                'is_active': self.responsable.is_active
            }
        
        if include_groups:
            data['groups'] = [g.to_dict() for g in self.groups.all()]
            
        if include_partner:
            data['partner'] = self.partner.to_dict() if self.partner else None
        
        if include_cycles:
            data['school_cycles'] = [c.to_dict(include_groups=True) for c in self.school_cycles.order_by(SchoolCycle.start_date.desc()).all()]
        
        if include_ecms:
            data['competency_standards'] = self.get_competency_standards_list()
            data['competency_standard_ids'] = self.get_competency_standard_ids()
            
        return data
    
    def get_competency_standard_ids(self):
        """Obtener lista de IDs de estándares de competencia asignados"""
        return [cs.competency_standard_id for cs in self.competency_standards.all()]
    
    def get_competency_standards_list(self):
        """Obtener lista de estándares de competencia con info básica"""
        from app.models.competency_standard import CompetencyStandard
        result = []
        for cs in self.competency_standards.all():
            standard = CompetencyStandard.query.get(cs.competency_standard_id)
            if standard:
                result.append({
                    'id': standard.id,
                    'code': standard.code,
                    'name': standard.name,
                    'sector': standard.sector,
                    'assigned_at': cs.created_at.isoformat() if cs.created_at else None
                })
        return result


class CampusCompetencyStandard(db.Model):
    """
    Relación muchos-a-muchos entre Campus y CompetencyStandard (ECM).
    Define qué estándares de competencia puede ofrecer cada plantel.
    """
    
    __tablename__ = 'campus_competency_standards'
    
    id = db.Column(db.Integer, primary_key=True)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=False)
    competency_standard_id = db.Column(db.Integer, db.ForeignKey('competency_standards.id', ondelete='CASCADE'), nullable=False)
    
    # Metadatos
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('campus_id', 'competency_standard_id', name='uq_campus_competency_standard'),
    )
    
    def to_dict(self):
        from app.models.competency_standard import CompetencyStandard
        standard = CompetencyStandard.query.get(self.competency_standard_id)
        return {
            'id': self.id,
            'campus_id': self.campus_id,
            'competency_standard_id': self.competency_standard_id,
            'competency_standard': {
                'id': standard.id,
                'code': standard.code,
                'name': standard.name,
                'sector': standard.sector
            } if standard else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class SchoolCycle(db.Model):
    """Ciclo escolar de un plantel"""
    
    __tablename__ = 'school_cycles'
    
    id = db.Column(db.Integer, primary_key=True)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=False)
    
    name = db.Column(db.String(100), nullable=False)  # Ej: "2026-2027", "Semestre 1 2026"
    cycle_type = db.Column(db.String(20), nullable=False)  # 'annual' o 'semester'
    
    # Fechas del ciclo
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_current = db.Column(db.Boolean, default=False, nullable=False)  # Si es el ciclo actual
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    groups = db.relationship('CandidateGroup', backref='school_cycle', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_groups=False, include_campus=False):
        data = {
            'id': self.id,
            'campus_id': self.campus_id,
            'name': self.name,
            'cycle_type': self.cycle_type,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_active': self.is_active,
            'is_current': self.is_current,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'group_count': self.groups.count() if self.groups else 0,
        }
        
        if include_groups:
            data['groups'] = [g.to_dict() for g in self.groups.filter_by(is_active=True).all()]
            
        if include_campus:
            data['campus'] = self.campus.to_dict() if self.campus else None
            
        return data


class CandidateGroup(db.Model):
    """Grupo de candidatos en un ciclo escolar"""
    
    __tablename__ = 'candidate_groups'
    
    id = db.Column(db.Integer, primary_key=True)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=False)
    school_cycle_id = db.Column(db.Integer, db.ForeignKey('school_cycles.id', ondelete='SET NULL'), nullable=True)
    
    name = db.Column(db.String(100), nullable=False)  # Ej: "Grupo A", "Turno Matutino", etc.
    code = db.Column(db.String(50))  # Código identificador
    description = db.Column(db.Text)
    
    # Período (opcional)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # ========== CONFIGURACIÓN HEREDADA DEL CAMPUS (Overrides) ==========
    # Si es NULL, se usa la configuración del campus
    # Si tiene valor, se usa ese valor en lugar del campus
    
    use_custom_config = db.Column(db.Boolean, default=False)  # Flag para usar config personalizada
    
    # Versión de Office
    office_version_override = db.Column(db.String(20))
    
    # Tiers de certificación
    enable_tier_basic_override = db.Column(db.Boolean)
    enable_tier_standard_override = db.Column(db.Boolean)
    enable_tier_advanced_override = db.Column(db.Boolean)
    enable_digital_badge_override = db.Column(db.Boolean)
    
    # Evaluaciones parciales
    enable_partial_evaluations_override = db.Column(db.Boolean)
    enable_unscheduled_partials_override = db.Column(db.Boolean)
    
    # Máquinas virtuales
    enable_virtual_machines_override = db.Column(db.Boolean)
    
    # Pagos en línea
    enable_online_payments_override = db.Column(db.Boolean)
    
    # Costos
    certification_cost_override = db.Column(db.Numeric(10, 2))
    retake_cost_override = db.Column(db.Numeric(10, 2))
    
    # Vigencia específica del grupo
    group_start_date = db.Column(db.Date)  # legacy
    group_end_date = db.Column(db.Date)  # legacy
    assignment_validity_months_override = db.Column(db.Integer)  # Override de meses de vigencia
    
    # ========== FIN CONFIGURACIÓN ==========
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relación con miembros
    members = db.relationship('GroupMember', backref='group', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_members=False, include_campus=False, include_cycle=False, include_config=False):
        data = {
            'id': self.id,
            'campus_id': self.campus_id,
            'school_cycle_id': self.school_cycle_id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'member_count': self.members.count() if self.members else 0,
        }
        
        if include_config:
            # Incluir configuración del grupo (overrides)
            data['use_custom_config'] = self.use_custom_config or False
            data['config'] = {
                'office_version_override': self.office_version_override,
                'enable_tier_basic_override': self.enable_tier_basic_override,
                'enable_tier_standard_override': self.enable_tier_standard_override,
                'enable_tier_advanced_override': self.enable_tier_advanced_override,
                'enable_digital_badge_override': self.enable_digital_badge_override,
                'enable_partial_evaluations_override': self.enable_partial_evaluations_override,
                'enable_unscheduled_partials_override': self.enable_unscheduled_partials_override,
                'enable_virtual_machines_override': self.enable_virtual_machines_override,
                'enable_online_payments_override': self.enable_online_payments_override,
                'certification_cost_override': float(self.certification_cost_override) if self.certification_cost_override is not None else None,
                'retake_cost_override': float(self.retake_cost_override) if self.retake_cost_override is not None else None,
                'assignment_validity_months_override': self.assignment_validity_months_override,
            }
            
            # Incluir también la configuración efectiva (combinando grupo y campus)
            if self.campus:
                data['effective_config'] = {
                    'office_version': self.office_version_override if self.office_version_override else self.campus.office_version,
                    'enable_tier_basic': self.enable_tier_basic_override if self.enable_tier_basic_override is not None else self.campus.enable_tier_basic,
                    'enable_tier_standard': self.enable_tier_standard_override if self.enable_tier_standard_override is not None else self.campus.enable_tier_standard,
                    'enable_tier_advanced': self.enable_tier_advanced_override if self.enable_tier_advanced_override is not None else self.campus.enable_tier_advanced,
                    'enable_digital_badge': self.enable_digital_badge_override if self.enable_digital_badge_override is not None else self.campus.enable_digital_badge,
                    'enable_partial_evaluations': self.enable_partial_evaluations_override if self.enable_partial_evaluations_override is not None else self.campus.enable_partial_evaluations,
                    'enable_unscheduled_partials': self.enable_unscheduled_partials_override if self.enable_unscheduled_partials_override is not None else self.campus.enable_unscheduled_partials,
                    'enable_virtual_machines': self.enable_virtual_machines_override if self.enable_virtual_machines_override is not None else self.campus.enable_virtual_machines,
                    'enable_online_payments': self.enable_online_payments_override if self.enable_online_payments_override is not None else self.campus.enable_online_payments,
                    'certification_cost': float(self.certification_cost_override) if self.certification_cost_override is not None else (float(self.campus.certification_cost) if self.campus.certification_cost else 0),
                    'retake_cost': float(self.retake_cost_override) if self.retake_cost_override is not None else (float(self.campus.retake_cost) if self.campus.retake_cost else 0),
                    'assignment_validity_months': self.assignment_validity_months_override if self.assignment_validity_months_override is not None else (self.campus.assignment_validity_months or 6),
                }
        
        if include_members:
            data['members'] = [m.to_dict(include_user=True) for m in self.members.all()]
            
        if include_campus:
            data['campus'] = self.campus.to_dict(include_partner=True) if self.campus else None
        
        if include_cycle and self.school_cycle:
            data['school_cycle'] = self.school_cycle.to_dict()
            
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


class GroupExam(db.Model):
    """Examen asignado a un grupo - incluye automáticamente los materiales de estudio relacionados"""
    
    __tablename__ = 'group_exams'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='CASCADE'), nullable=False)
    exam_id = db.Column(db.Integer, db.ForeignKey('exams.id', ondelete='CASCADE'), nullable=False)
    
    # Fecha de asignación
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    assigned_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    
    # Período de disponibilidad (opcional)
    available_from = db.Column(db.DateTime, nullable=True)
    available_until = db.Column(db.DateTime, nullable=True)
    
    # Tipo de asignación: 'all' para todo el grupo, 'selected' para miembros específicos
    assignment_type = db.Column(db.String(20), default='all', nullable=False)
    
    # Configuración del examen
    time_limit_minutes = db.Column(db.Integer, nullable=True)  # Tiempo límite en minutos (null = sin límite o usar el del examen)
    passing_score = db.Column(db.Integer, nullable=True)  # Calificación mínima para aprobar (0-100)
    max_attempts = db.Column(db.Integer, default=1, nullable=False)  # Número de reintentos permitidos
    max_disconnections = db.Column(db.Integer, default=3, nullable=False)  # Oportunidades de desconexión/dejar de ver pantalla
    exam_content_type = db.Column(db.String(30), default='questions_only', nullable=False)  # questions_only, exercises_only, mixed
    
    # Configuración de cantidad - EXAMEN
    exam_questions_count = db.Column(db.Integer, nullable=True)  # Número de preguntas de examen (null = todas)
    exam_exercises_count = db.Column(db.Integer, nullable=True)  # Número de ejercicios de examen (null = todos)
    
    # Configuración de cantidad - SIMULADOR
    simulator_questions_count = db.Column(db.Integer, nullable=True)  # Número de preguntas de simulador (null = todas)
    simulator_exercises_count = db.Column(db.Integer, nullable=True)  # Número de ejercicios de simulador (null = todos)
    
    # PIN de seguridad (solo para modo examen)
    security_pin = db.Column(db.String(10), nullable=True)  # PIN de seguridad para iniciar el examen
    require_security_pin = db.Column(db.Boolean, default=False, nullable=False)  # Requerir PIN para iniciar
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('group_id', 'exam_id', name='uq_group_exam'),
    )
    
    # Relaciones
    group = db.relationship('CandidateGroup', backref=db.backref('assigned_exams', lazy='dynamic'))
    exam = db.relationship('Exam', backref=db.backref('group_assignments', lazy='dynamic'))
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id])
    
    def to_dict(self, include_exam=False, include_group=False, include_materials=False, include_members=False):
        data = {
            'id': self.id,
            'group_id': self.group_id,
            'exam_id': self.exam_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'assigned_by_id': self.assigned_by_id,
            'available_from': self.available_from.isoformat() if self.available_from else None,
            'available_until': self.available_until.isoformat() if self.available_until else None,
            'assignment_type': self.assignment_type or 'all',
            'time_limit_minutes': self.time_limit_minutes,
            'passing_score': self.passing_score,
            'max_attempts': self.max_attempts or 1,
            'max_disconnections': self.max_disconnections or 3,
            'exam_content_type': self.exam_content_type or 'questions_only',
            'exam_questions_count': self.exam_questions_count,
            'exam_exercises_count': self.exam_exercises_count,
            'simulator_questions_count': self.simulator_questions_count,
            'simulator_exercises_count': self.simulator_exercises_count,
            'security_pin': self.security_pin,
            'require_security_pin': self.require_security_pin or False,
            'is_active': self.is_active,
        }
        
        # Contar miembros asignados si es tipo 'selected'
        if self.assignment_type == 'selected':
            data['assigned_members_count'] = self.assigned_members.count() if self.assigned_members else 0
        
        if include_exam and self.exam:
            # Obtener información del ECM si existe
            ecm_data = None
            if self.exam.competency_standard_id:
                from app.models.competency_standard import CompetencyStandard
                standard = CompetencyStandard.query.get(self.exam.competency_standard_id)
                if standard:
                    ecm_data = {
                        'id': standard.id,
                        'code': standard.code,
                        'name': standard.name,
                        'logo_url': standard.logo_url,
                        'brand_id': standard.brand_id,
                        'brand_name': standard.brand.name if standard.brand else None,
                        'brand_logo_url': standard.brand.logo_url if standard.brand else None,
                    }
            
            data['exam'] = {
                'id': self.exam.id,
                'name': self.exam.name,
                'version': self.exam.version,
                'standard': self.exam.standard,
                'description': self.exam.description,
                'duration_minutes': self.exam.duration_minutes,
                'passing_score': self.exam.passing_score,
                'is_published': self.exam.is_published,
                'competency_standard_id': self.exam.competency_standard_id,
                'ecm': ecm_data,
            }
            
        if include_group and self.group:
            data['group'] = self.group.to_dict()
        
        if include_members and self.assignment_type == 'selected':
            data['assigned_members'] = [m.to_dict() for m in self.assigned_members.all()]
            
        if include_materials and self.exam:
            # Obtener materiales de estudio asociados al examen
            from app.models.study_content import StudyMaterial
            from sqlalchemy import text
            
            # Verificar si hay personalizaciones para este group_exam
            custom_materials = self.custom_materials.all() if self.custom_materials else []
            has_customizations = len(custom_materials) > 0
            
            materials = []
            
            if has_customizations:
                # Si hay personalizaciones, usar solo los materiales marcados como incluidos
                included_ids = [cm.study_material_id for cm in custom_materials if cm.is_included]
                if included_ids:
                    try:
                        placeholders = ','.join([str(id) for id in included_ids])
                        query = f'''
                            SELECT sc.id, sc.title, sc.description, sc.image_url
                            FROM study_contents sc
                            WHERE sc.id IN ({placeholders})
                        '''
                        linked_materials = db.session.execute(text(query)).fetchall()
                        
                        for m in linked_materials:
                            materials.append({
                                'id': m[0],
                                'title': m[1],
                                'description': m[2],
                                'cover_image_url': m[3],
                                'is_custom': True,
                            })
                    except Exception:
                        pass
            else:
                # Sin personalizaciones: usar materiales vinculados al examen que estén PUBLICADOS
                # Buscar por relación muchos a muchos usando la tabla intermedia
                try:
                    linked_materials = db.session.execute(text('''
                        SELECT sc.id, sc.title, sc.description, sc.image_url
                        FROM study_contents sc
                        INNER JOIN study_material_exams sme ON sc.id = sme.study_material_id
                        WHERE sme.exam_id = :exam_id AND sc.is_published = 1
                    '''), {'exam_id': self.exam.id}).fetchall()
                    
                    for m in linked_materials:
                        materials.append({
                            'id': m[0],
                            'title': m[1],
                            'description': m[2],
                            'cover_image_url': m[3],
                            'is_custom': False,
                        })
                except Exception:
                    pass
                
                # También buscar por campo exam_id directo (legacy) - solo publicados
                if not materials:
                    legacy_materials = StudyMaterial.query.filter_by(exam_id=self.exam.id, is_published=True).all()
                    materials = [{
                        'id': m.id,
                        'title': m.title,
                        'description': m.description,
                        'cover_image_url': getattr(m, 'cover_image_url', m.image_url),
                        'is_custom': False,
                    } for m in legacy_materials]
            
            data['study_materials'] = materials
            data['has_custom_materials'] = has_customizations
            
        return data


class GroupExamMaterial(db.Model):
    """Modelo para materiales personalizados por grupo-examen"""
    
    __tablename__ = 'group_exam_materials'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    group_exam_id = db.Column(db.Integer, db.ForeignKey('group_exams.id', ondelete='CASCADE'), nullable=False)
    study_material_id = db.Column(db.Integer, db.ForeignKey('study_contents.id', ondelete='CASCADE'), nullable=False)
    is_included = db.Column(db.Boolean, default=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relaciones
    group_exam = db.relationship('GroupExam', backref=db.backref('custom_materials', lazy='dynamic', cascade='all, delete-orphan'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'group_exam_id': self.group_exam_id,
            'study_material_id': self.study_material_id,
            'is_included': self.is_included,
            'added_at': self.added_at.isoformat() if self.added_at else None,
        }


class GroupExamMember(db.Model):
    """Miembro específico asignado a un examen de grupo (cuando assignment_type='selected')"""
    
    __tablename__ = 'group_exam_members'
    
    id = db.Column(db.Integer, primary_key=True)
    group_exam_id = db.Column(db.Integer, db.ForeignKey('group_exams.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('group_exam_id', 'user_id', name='uq_group_exam_member'),
    )
    
    # Relaciones
    group_exam = db.relationship('GroupExam', backref=db.backref('assigned_members', lazy='dynamic', cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('group_exam_assignments', lazy='dynamic'))
    
    def to_dict(self, include_user=True):
        data = {
            'id': self.id,
            'group_exam_id': self.group_exam_id,
            'user_id': self.user_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
        }
        
        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'name': self.user.name,
                'first_surname': self.user.first_surname,
                'second_surname': self.user.second_surname,
                'full_name': self.user.full_name,
                'email': self.user.email,
                'curp': self.user.curp,
            }
        
        return data


class GroupStudyMaterial(db.Model):
    """Material de estudio asignado directamente a un grupo (sin examen)"""
    
    __tablename__ = 'group_study_materials'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='CASCADE'), nullable=False)
    study_material_id = db.Column(db.Integer, db.ForeignKey('study_contents.id', ondelete='CASCADE'), nullable=False)
    
    # Fecha de asignación
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    assigned_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    
    # Período de disponibilidad (opcional)
    available_from = db.Column(db.DateTime, nullable=True)
    available_until = db.Column(db.DateTime, nullable=True)
    
    # Tipo de asignación: 'all' para todo el grupo, 'selected' para miembros específicos
    assignment_type = db.Column(db.String(20), default='all', nullable=False)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('group_id', 'study_material_id', name='uq_group_study_material'),
    )
    
    # Relaciones
    group = db.relationship('CandidateGroup', backref=db.backref('assigned_study_materials', lazy='dynamic'))
    study_material = db.relationship('StudyMaterial', backref=db.backref('group_assignments', lazy='dynamic'))
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id])
    
    def to_dict(self, include_material=False, include_group=False, include_members=False):
        data = {
            'id': self.id,
            'group_id': self.group_id,
            'study_material_id': self.study_material_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'assigned_by_id': self.assigned_by_id,
            'available_from': self.available_from.isoformat() if self.available_from else None,
            'available_until': self.available_until.isoformat() if self.available_until else None,
            'assignment_type': self.assignment_type or 'all',
            'is_active': self.is_active,
        }
        
        # Contar miembros asignados si es tipo 'selected'
        if self.assignment_type == 'selected':
            data['assigned_members_count'] = self.assigned_members.count() if hasattr(self, 'assigned_members') and self.assigned_members else 0
        
        if include_material and self.study_material:
            data['study_material'] = {
                'id': self.study_material.id,
                'title': self.study_material.title,
                'description': self.study_material.description,
                'image_url': self.study_material.image_url,
                'is_published': self.study_material.is_published,
            }
        
        if include_group and self.group:
            data['group'] = {
                'id': self.group.id,
                'name': self.group.name,
                'code': self.group.code,
            }
        
        if include_members and self.assignment_type == 'selected':
            data['members'] = [m.to_dict(include_user=True) for m in self.assigned_members.all()] if hasattr(self, 'assigned_members') else []
        
        return data


class GroupStudyMaterialMember(db.Model):
    """Miembro específico asignado a un material de estudio de grupo (cuando assignment_type='selected')"""
    
    __tablename__ = 'group_study_material_members'
    
    id = db.Column(db.Integer, primary_key=True)
    group_study_material_id = db.Column(db.Integer, db.ForeignKey('group_study_materials.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('group_study_material_id', 'user_id', name='uq_group_study_material_member'),
    )
    
    # Relaciones
    group_study_material = db.relationship('GroupStudyMaterial', backref=db.backref('assigned_members', lazy='dynamic', cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('group_study_material_assignments', lazy='dynamic'))
    
    def to_dict(self, include_user=True):
        data = {
            'id': self.id,
            'group_study_material_id': self.group_study_material_id,
            'user_id': self.user_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
        }
        
        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'name': self.user.name,
                'first_surname': self.user.first_surname,
                'second_surname': self.user.second_surname,
                'full_name': self.user.full_name,
                'email': self.user.email,
                'curp': self.user.curp,
            }
        
        return data


class EcmCandidateAssignment(db.Model):
    """Asignación permanente de un ECM a un candidato.
    
    Cada vez que se asigna un examen (que tiene competency_standard_id) a candidatos,
    se crea un registro aquí con un número de asignación único de 12 caracteres.
    Estas asignaciones son PERMANENTES: no se borran aunque el grupo sea eliminado
    o el candidato cambie de grupo.
    """
    
    __tablename__ = 'ecm_candidate_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    assignment_number = db.Column(db.String(12), unique=True, nullable=False, index=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    competency_standard_id = db.Column(db.Integer, db.ForeignKey('competency_standards.id'), nullable=False)
    exam_id = db.Column(db.Integer, db.ForeignKey('exams.id'), nullable=False)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='SET NULL'), nullable=True)
    group_id = db.Column(db.Integer, nullable=True)  # Solo referencia, sin FK para que persista si se borra el grupo
    group_name = db.Column(db.String(200), nullable=True)  # Nombre del grupo al momento de la asignación
    group_exam_id = db.Column(db.Integer, nullable=True)  # Referencia al group_exam original
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    assigned_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    assignment_source = db.Column(db.String(20), default='bulk', nullable=False)  # 'bulk' o 'selected'
    
    # Relaciones (sin cascade delete - estas asignaciones son permanentes)
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('ecm_assignments', lazy='dynamic'))
    competency_standard = db.relationship('CompetencyStandard', backref=db.backref('candidate_assignments', lazy='dynamic'))
    exam = db.relationship('Exam', backref=db.backref('ecm_candidate_assignments', lazy='dynamic'))
    campus = db.relationship('Campus', backref=db.backref('ecm_candidate_assignments', lazy='dynamic'))
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id])
    
    __table_args__ = (
        db.Index('ix_ecm_candidate_user_ecm', 'user_id', 'competency_standard_id'),
    )
    
    @staticmethod
    def generate_assignment_number():
        """Genera un número de asignación único de 12 caracteres alfanuméricos"""
        import secrets
        import string
        chars = string.ascii_uppercase + string.digits
        while True:
            number = ''.join(secrets.choice(chars) for _ in range(12))
            existing = EcmCandidateAssignment.query.filter_by(assignment_number=number).first()
            if not existing:
                return number
    
    def to_dict(self):
        return {
            'id': self.id,
            'assignment_number': self.assignment_number,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'user_email': self.user.email if self.user else None,
            'user_curp': self.user.curp if self.user else None,
            'competency_standard_id': self.competency_standard_id,
            'ecm_code': self.competency_standard.code if self.competency_standard else None,
            'ecm_name': self.competency_standard.name if self.competency_standard else None,
            'exam_id': self.exam_id,
            'campus_id': self.campus_id,
            'group_id': self.group_id,
            'group_name': self.group_name,
            'group_exam_id': self.group_exam_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'assigned_by_id': self.assigned_by_id,
            'assignment_source': self.assignment_source,
        }
