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
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('group_id', 'exam_id', name='uq_group_exam'),
    )
    
    # Relaciones
    group = db.relationship('CandidateGroup', backref=db.backref('assigned_exams', lazy='dynamic'))
    exam = db.relationship('Exam', backref=db.backref('group_assignments', lazy='dynamic'))
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id])
    
    def to_dict(self, include_exam=False, include_group=False, include_materials=False):
        data = {
            'id': self.id,
            'group_id': self.group_id,
            'exam_id': self.exam_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'assigned_by_id': self.assigned_by_id,
            'available_from': self.available_from.isoformat() if self.available_from else None,
            'available_until': self.available_until.isoformat() if self.available_until else None,
            'is_active': self.is_active,
        }
        
        if include_exam and self.exam:
            data['exam'] = {
                'id': self.exam.id,
                'name': self.exam.name,
                'version': self.exam.version,
                'standard': self.exam.standard,
                'description': self.exam.description,
                'duration_minutes': self.exam.duration_minutes,
                'passing_score': self.exam.passing_score,
                'is_published': self.exam.is_published,
            }
            
        if include_group and self.group:
            data['group'] = self.group.to_dict()
            
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
