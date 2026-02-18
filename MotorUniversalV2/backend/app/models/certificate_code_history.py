"""
Modelo de Historial de Códigos de Certificado
Cuando un código de verificación (ZC/EC) es reemplazado, el anterior se archiva aquí.
Los QR antiguos siguen verificándose consultando esta tabla como fallback.
"""
from datetime import datetime
from app import db


class CertificateCodeHistory(db.Model):
    """Historial de códigos de certificado reemplazados"""
    
    __tablename__ = 'certificate_code_history'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    
    # Referencia al resultado (NO FK - el result podría eliminarse)
    result_id = db.Column(db.String(36), nullable=False, index=True)
    user_id = db.Column(db.String(36), nullable=False, index=True)
    exam_id = db.Column(db.Integer, nullable=False)
    
    # El código archivado
    code = db.Column(db.String(100), nullable=False, unique=True, index=True)
    code_type = db.Column(db.String(30), nullable=False)  # 'certificate_code' o 'eduit_certificate_code'
    
    # Referencia al código que lo reemplazó
    replaced_by_code = db.Column(db.String(100), nullable=True)
    
    # Datos de verificación (snapshot del resultado al momento de archivar)
    score = db.Column(db.Integer, nullable=True)
    result_value = db.Column(db.Integer, nullable=True)  # 0=reprobado, 1=aprobado
    competency_standard_id = db.Column(db.Integer, nullable=True)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)  # Cuándo se creó el código original
    archived_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)  # Cuándo se archivó
    
    def __repr__(self):
        return f'<CertificateCodeHistory {self.code} -> {self.replaced_by_code}>'


def archive_certificate_code(result, code_type, new_code=None):
    """
    Archiva un código de certificado existente antes de que sea reemplazado.
    
    Args:
        result: Objeto Result que tiene el código actual
        code_type: 'certificate_code' o 'eduit_certificate_code'
        new_code: El nuevo código que reemplazará al actual (opcional)
    
    Returns:
        CertificateCodeHistory si se archivó, None si no había código que archivar
    """
    current_code = getattr(result, code_type, None)
    if not current_code:
        return None
    
    # Verificar que no exista ya en el historial (idempotencia)
    existing = CertificateCodeHistory.query.filter_by(code=current_code).first()
    if existing:
        return existing
    
    history = CertificateCodeHistory(
        result_id=str(result.id),
        user_id=str(result.user_id),
        exam_id=result.exam_id,
        code=current_code,
        code_type=code_type,
        replaced_by_code=new_code,
        score=result.score,
        result_value=result.result,
        competency_standard_id=result.competency_standard_id,
        start_date=result.start_date,
        end_date=result.end_date,
    )
    
    db.session.add(history)
    # No hacemos commit aquí - lo hace el caller
    
    return history
