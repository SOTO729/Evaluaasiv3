"""
Modelo de Estándar de Competencia (ECM)
"""
from datetime import datetime
from app import db


class CompetencyStandard(db.Model):
    """
    Modelo de Estándar de Competencia (ECM)
    
    Los ECM son la base estructural para los exámenes. Un ECM puede tener
    múltiples versiones de examen a lo largo del tiempo, pero los resultados
    de los alumnos se asocian al ECM, no al examen específico.
    """
    
    __tablename__ = 'competency_standards'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)  # Ej: EC0217, EC0301
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    # Información adicional del estándar
    sector = db.Column(db.String(100))  # Sector productivo
    level = db.Column(db.Integer)  # Nivel de competencia (1-5)
    validity_years = db.Column(db.Integer, default=5)  # Años de vigencia del certificado
    
    # Organismo certificador
    certifying_body = db.Column(db.String(255), default='CONOCER')
    
    # Estado
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Marca (Brand) - Ej: Microsoft, Huawei, Abierto
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'), nullable=True)
    
    # Logo del estándar
    logo_url = db.Column(db.String(500), nullable=True)
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    exams = db.relationship('Exam', backref='competency_standard', lazy='dynamic')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_standards')
    updater = db.relationship('User', foreign_keys=[updated_by], backref='updated_standards')
    
    def get_active_exam(self):
        """Obtener el examen activo más reciente para este estándar"""
        return self.exams.filter_by(is_active=True, is_published=True).order_by(
            db.desc('created_at')
        ).first()
    
    def get_exam_count(self):
        """Contar el número de exámenes asociados"""
        return self.exams.count()
    
    def get_results_count(self):
        """Contar el número de resultados asociados a este estándar"""
        from app.models.result import Result
        return Result.query.filter_by(competency_standard_id=self.id).count()
    
    def to_dict(self, include_stats=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'sector': self.sector,
            'level': self.level,
            'validity_years': self.validity_years,
            'certifying_body': self.certifying_body,
            'brand_id': self.brand_id,
            'brand': self.brand.to_dict() if self.brand else None,
            'logo_url': self.logo_url,
            'is_active': self.is_active,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_stats:
            data['exam_count'] = self.get_exam_count()
            data['results_count'] = self.get_results_count()
            
            # Incluir info del examen activo
            active_exam = self.get_active_exam()
            if active_exam:
                data['active_exam'] = {
                    'id': active_exam.id,
                    'name': active_exam.name,
                    'version': active_exam.version
                }
            else:
                data['active_exam'] = None
        
        return data
    
    def __repr__(self):
        return f'<CompetencyStandard {self.code}: {self.name}>'


class DeletionRequest(db.Model):
    """
    Modelo para solicitudes de eliminación
    
    Los editores no pueden eliminar ECMs directamente, deben solicitar
    la eliminación al administrador.
    """
    
    __tablename__ = 'deletion_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Tipo de entidad a eliminar
    entity_type = db.Column(db.String(50), nullable=False)  # 'competency_standard', 'exam', etc.
    entity_id = db.Column(db.Integer, nullable=False)
    entity_name = db.Column(db.String(255))  # Nombre para referencia
    
    # Razón de la solicitud
    reason = db.Column(db.Text, nullable=False)
    
    # Estado: pending, approved, rejected
    status = db.Column(db.String(20), default='pending', nullable=False)
    
    # Respuesta del admin
    admin_response = db.Column(db.Text)
    reviewed_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    reviewed_at = db.Column(db.DateTime)
    
    # Auditoría
    requested_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relaciones
    requester = db.relationship('User', foreign_keys=[requested_by], backref='deletion_requests')
    reviewer = db.relationship('User', foreign_keys=[reviewed_by], backref='reviewed_deletions')
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'reason': self.reason,
            'status': self.status,
            'admin_response': self.admin_response,
            'requested_by': self.requested_by,
            'requested_at': self.requested_at.isoformat() if self.requested_at else None,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'requester_name': self.requester.name if self.requester else None
        }
    
    def __repr__(self):
        return f'<DeletionRequest {self.entity_type}:{self.entity_id} - {self.status}>'
