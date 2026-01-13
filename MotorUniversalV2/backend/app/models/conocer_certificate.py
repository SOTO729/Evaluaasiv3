"""
Modelo de Certificado CONOCER
Almacena la metadata de certificados oficiales emitidos por CONOCER México
"""
from datetime import datetime
from app import db


class ConocerCertificate(db.Model):
    """
    Modelo para certificados CONOCER (Consejo Nacional de Normalización 
    y Certificación de Competencias Laborales)
    """
    
    __tablename__ = 'conocer_certificates'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    
    # Información del certificado CONOCER
    certificate_number = db.Column(db.String(50), unique=True, nullable=False, index=True)  # Folio oficial CONOCER
    curp = db.Column(db.String(18), nullable=False, index=True)  # CURP del certificado
    
    # Estándar de competencia
    standard_code = db.Column(db.String(20), nullable=False)  # Ej: EC0217, EC0301
    standard_name = db.Column(db.String(500), nullable=False)  # Nombre completo del estándar
    competency_level = db.Column(db.String(10))  # Nivel de competencia (1, 2, 3, etc.)
    
    # Centro evaluador
    evaluation_center_name = db.Column(db.String(255))  # Nombre del centro evaluador
    evaluation_center_code = db.Column(db.String(50))  # Código del centro evaluador
    evaluator_name = db.Column(db.String(255))  # Nombre del evaluador
    
    # Fechas
    issue_date = db.Column(db.Date, nullable=False)  # Fecha de emisión
    expiration_date = db.Column(db.Date)  # Fecha de vencimiento (algunos certificados no vencen)
    evaluation_date = db.Column(db.Date)  # Fecha de evaluación
    
    # Archivo en Azure Blob Storage
    blob_name = db.Column(db.String(500), nullable=False)  # Nombre del blob (ruta completa)
    blob_container = db.Column(db.String(100), default='conocer-certificates')  # Contenedor
    blob_tier = db.Column(db.String(20), default='Cool')  # Hot, Cool, Archive
    file_size = db.Column(db.Integer)  # Tamaño en bytes
    file_hash = db.Column(db.String(64))  # SHA-256 del archivo para verificar integridad
    content_type = db.Column(db.String(100), default='application/pdf')
    
    # Estado
    status = db.Column(db.String(20), default='active', nullable=False)  # active, archived, revoked
    is_verified = db.Column(db.Boolean, default=False)  # Si se verificó con CONOCER
    verification_date = db.Column(db.DateTime)  # Fecha de última verificación
    verification_url = db.Column(db.String(500))  # URL de verificación en CONOCER
    
    # Metadata adicional
    notes = db.Column(db.Text)  # Notas internas
    metadata_json = db.Column(db.JSON)  # Metadata adicional flexible
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    archived_at = db.Column(db.DateTime)  # Fecha en que se movió a Archive tier
    
    # Relación con usuario
    user = db.relationship('User', backref=db.backref('conocer_certificates', lazy='dynamic'))
    
    def __repr__(self):
        return f'<ConocerCertificate {self.certificate_number}>'
    
    def to_dict(self, include_blob_info=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'certificate_number': self.certificate_number,
            'curp': self.curp,
            'standard_code': self.standard_code,
            'standard_name': self.standard_name,
            'competency_level': self.competency_level,
            'evaluation_center_name': self.evaluation_center_name,
            'evaluator_name': self.evaluator_name,
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'expiration_date': self.expiration_date.isoformat() if self.expiration_date else None,
            'evaluation_date': self.evaluation_date.isoformat() if self.evaluation_date else None,
            'status': self.status,
            'is_verified': self.is_verified,
            'verification_date': self.verification_date.isoformat() if self.verification_date else None,
            'verification_url': self.verification_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        
        if include_blob_info:
            data['blob_info'] = {
                'blob_name': self.blob_name,
                'blob_container': self.blob_container,
                'blob_tier': self.blob_tier,
                'file_size': self.file_size,
                'file_hash': self.file_hash,
                'content_type': self.content_type
            }
        
        return data
    
    @property
    def is_expired(self):
        """Verificar si el certificado está vencido"""
        if not self.expiration_date:
            return False  # Sin fecha de vencimiento = no vence
        return datetime.now().date() > self.expiration_date
    
    @property
    def is_active(self):
        """Verificar si el certificado está activo (no vencido, no revocado)"""
        return self.status == 'active' and not self.is_expired
    
    @property
    def days_until_expiration(self):
        """Días hasta el vencimiento"""
        if not self.expiration_date:
            return None
        delta = self.expiration_date - datetime.now().date()
        return delta.days
