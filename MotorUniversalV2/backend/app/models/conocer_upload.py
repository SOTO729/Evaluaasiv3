"""
Modelos para Carga Masiva de Certificados CONOCER
Registro de batches (cargas ZIP) y logs individuales por PDF procesado
"""
from datetime import datetime
from app import db


class ConocerUploadBatch(db.Model):
    """
    Registro de cada carga ZIP de certificados CONOCER.
    Un batch contiene múltiples PDFs procesados individualmente.
    """
    
    __tablename__ = 'conocer_upload_batches'
    
    id = db.Column(db.Integer, primary_key=True)
    uploaded_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    
    # Archivo ZIP
    filename = db.Column(db.String(255), nullable=False)  # Nombre original del ZIP
    blob_name = db.Column(db.String(500))  # Ruta al ZIP temporal en blob storage
    
    # Contadores de procesamiento
    total_files = db.Column(db.Integer, default=0)  # Total archivos en el ZIP
    processed_files = db.Column(db.Integer, default=0)  # Procesados hasta ahora
    matched_files = db.Column(db.Integer, default=0)  # Nuevos certificados creados
    replaced_files = db.Column(db.Integer, default=0)  # Certificados existentes reemplazados
    skipped_files = db.Column(db.Integer, default=0)  # Duplicados dentro del ZIP
    discarded_files = db.Column(db.Integer, default=0)  # No cumplen requisitos
    error_files = db.Column(db.Integer, default=0)  # Errores técnicos
    
    # Estado del batch
    status = db.Column(db.String(20), default='queued', nullable=False, index=True)
    # queued → processing → completed / failed
    
    # Timestamps
    started_at = db.Column(db.DateTime)  # Inicio del procesamiento
    completed_at = db.Column(db.DateTime)  # Fin del procesamiento
    error_message = db.Column(db.Text)  # Error global si falló todo el batch
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relaciones
    uploader = db.relationship('User', backref=db.backref('conocer_upload_batches', lazy='dynamic'))
    logs = db.relationship('ConocerUploadLog', backref='batch', lazy='dynamic',
                           cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<ConocerUploadBatch {self.id} - {self.filename}>'
    
    def to_dict(self, include_uploader=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'uploaded_by': self.uploaded_by,
            'filename': self.filename,
            'total_files': self.total_files,
            'processed_files': self.processed_files,
            'matched_files': self.matched_files,
            'replaced_files': self.replaced_files,
            'skipped_files': self.skipped_files,
            'discarded_files': self.discarded_files,
            'error_files': self.error_files,
            'status': self.status,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_uploader and self.uploader:
            data['uploader_name'] = f"{self.uploader.name or ''} {self.uploader.first_surname or ''}".strip()
            data['uploader_email'] = self.uploader.email
        return data
    
    @property
    def success_count(self):
        """Total de procesados exitosamente (matched + replaced)"""
        return (self.matched_files or 0) + (self.replaced_files or 0)
    
    @property
    def progress_percentage(self):
        """Porcentaje de progreso"""
        if not self.total_files:
            return 0
        return round((self.processed_files or 0) / self.total_files * 100, 1)


class ConocerUploadLog(db.Model):
    """
    Detalle del procesamiento de cada archivo PDF dentro de un batch.
    Registra tanto los exitosos como los descartados/errores.
    """
    
    __tablename__ = 'conocer_upload_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('conocer_upload_batches.id', ondelete='CASCADE'),
                         nullable=False, index=True)
    
    # Archivo procesado
    filename = db.Column(db.String(500), nullable=False)  # Nombre del PDF dentro del ZIP
    
    # Datos extraídos del PDF
    extracted_curp = db.Column(db.String(18))
    extracted_ecm_code = db.Column(db.String(20))
    extracted_name = db.Column(db.String(255))
    extracted_folio = db.Column(db.String(50))  # Folio CONOCER (ej: D-0040124625)
    extracted_ecm_name = db.Column(db.String(500))
    extracted_issue_date = db.Column(db.String(100))  # Texto de fecha original
    extracted_certifying_entity = db.Column(db.String(255))
    
    # Resultado del procesamiento
    # matched: nuevo certificado creado
    # replaced: certificado existente actualizado con PDF más reciente
    # skipped: duplicado dentro del ZIP (se usó otro archivo)
    # discarded: no cumple requisitos
    # error: error técnico
    status = db.Column(db.String(20), nullable=False, index=True)
    
    # Razón de descarte (solo si status = discarded)
    discard_reason = db.Column(db.String(50))
    # not_pdf, parse_error, no_curp, no_ecm_code, curp_not_found, 
    # ecm_not_found, no_pending_tramite
    
    discard_detail = db.Column(db.String(500))  # Descripción legible
    
    # Referencias al resultado
    matched_user_id = db.Column(db.String(36))  # Usuario encontrado
    certificate_id = db.Column(db.Integer, db.ForeignKey('conocer_certificates.id',
                               ondelete='SET NULL'))
    replaced_previous_hash = db.Column(db.String(64))  # Hash del PDF anterior (si fue reemplazo)
    
    # Rendimiento
    processing_time_ms = db.Column(db.Integer)  # Tiempo de procesamiento en ms
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relaciones
    certificate = db.relationship('ConocerCertificate', backref=db.backref('upload_logs', lazy='dynamic'))
    
    def __repr__(self):
        return f'<ConocerUploadLog {self.id} - {self.filename} ({self.status})>'
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'filename': self.filename,
            'extracted_curp': self.extracted_curp,
            'extracted_ecm_code': self.extracted_ecm_code,
            'extracted_name': self.extracted_name,
            'extracted_folio': self.extracted_folio,
            'extracted_ecm_name': self.extracted_ecm_name,
            'extracted_issue_date': self.extracted_issue_date,
            'extracted_certifying_entity': self.extracted_certifying_entity,
            'status': self.status,
            'discard_reason': self.discard_reason,
            'discard_detail': self.discard_detail,
            'matched_user_id': self.matched_user_id,
            'certificate_id': self.certificate_id,
            'replaced_previous_hash': self.replaced_previous_hash,
            'processing_time_ms': self.processing_time_ms,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
