"""
Modelos para resultados de exámenes Office (VB6 legacy) y tokens de sesión VB6.

OfficeExamResult: Almacena resultados de exámenes/simuladores/parciales ejecutados
en Office real (Word, Excel, PowerPoint) desde la app VB6.

Vb6SessionToken: Token de autenticación simple para que el VB6 se comunique
con la API REST de MotorV2.

OfficeAppVersion: Control de versiones mínimas por EXE de VB6.
"""
from datetime import datetime, timedelta
from uuid import uuid4
from app import db


class OfficeExamResult(db.Model):
    """Resultado de examen Office ejecutado desde VB6."""
    
    __tablename__ = 'office_exam_results'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    
    # Usuario y contexto organizacional
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    vm_session_id = db.Column(db.Integer, db.ForeignKey('vm_sessions.id', ondelete='SET NULL'), nullable=True)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='SET NULL'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='SET NULL'), nullable=True)
    group_exam_id = db.Column(db.Integer, nullable=True)  # Asignación (reemplaza voucher)
    
    # Tipo de evaluación: examen, simulador, competencia, parcial
    session_type = db.Column(db.String(20), nullable=False)
    
    # Aplicación Office
    office_app = db.Column(db.String(20), nullable=False)  # excel, word, powerpoint
    office_version = db.Column(db.String(20), nullable=True)  # 2016, 2019, office_365
    level = db.Column(db.String(20), nullable=True)  # basico, avanzado
    
    # Resultados (escala 0-1000 del VB6)
    score = db.Column(db.Integer, default=0)
    passing_score = db.Column(db.Integer, default=400)
    passed = db.Column(db.Boolean, default=False)
    total_questions = db.Column(db.Integer, default=0)
    correct_answers = db.Column(db.Integer, default=0)
    
    # Voucher/PIN
    voucher_code = db.Column(db.String(50), nullable=True)
    voucher_expired = db.Column(db.Boolean, default=False)
    
    # Datos detallados (JSON text)
    answers_data = db.Column(db.Text, nullable=True)
    # URL en Azure Blob del XML crudo subido vía UpXML2016 (respaldo auditable)
    xml_blob_url = db.Column(db.String(500), nullable=True)
    # Parciales: datos por sesión
    parcial_sessions_data = db.Column(db.Text, nullable=True)
    assigned_sessions = db.Column(db.String(200), nullable=True)  # "1,3,10,15"
    parcial_session_number = db.Column(db.Integer, nullable=True)  # sesión individual 1-17
    calendario_id = db.Column(db.String(50), nullable=True)
    
    # Telemetría
    app_version = db.Column(db.String(30), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    mac_address = db.Column(db.String(50), nullable=True)
    pc_name = db.Column(db.String(100), nullable=True)
    
    # Estado y tiempos
    status = db.Column(db.String(20), default='in_progress')  # in_progress, completed, abandoned
    duration_seconds = db.Column(db.Integer, nullable=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    finished_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Certificado generado
    certificate_code = db.Column(db.String(50), nullable=True)

    # Insignia emitida (IssuedBadge.badge_uuid). Permite trazar office_result → IssuedBadge sin FK directa.
    badge_uuid = db.Column(db.String(36), nullable=True, index=True)

    # Relaciones
    user = db.relationship('User', backref=db.backref('office_exam_results', lazy='dynamic'))
    vm_session = db.relationship('VmSession', backref=db.backref('office_exam_results', lazy='dynamic'))
    
    __table_args__ = (
        db.Index('ix_office_result_user', 'user_id'),
        db.Index('ix_office_result_type', 'session_type'),
        db.Index('ix_office_result_status', 'status'),
        db.Index('ix_office_result_campus', 'campus_id'),
    )
    
    def to_dict(self, include_user=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'vm_session_id': self.vm_session_id,
            'campus_id': self.campus_id,
            'group_id': self.group_id,
            'session_type': self.session_type,
            'office_app': self.office_app,
            'office_version': self.office_version,
            'level': self.level,
            'score': self.score,
            'score_normalized': round(self.score / 10, 1) if self.score else 0,
            'passing_score': self.passing_score,
            'passed': self.passed,
            'total_questions': self.total_questions,
            'correct_answers': self.correct_answers,
            'voucher_code': self.voucher_code,
            'parcial_session_number': self.parcial_session_number,
            'assigned_sessions': self.assigned_sessions,
            'calendario_id': self.calendario_id,
            'app_version': self.app_version,
            'status': self.status,
            'duration_seconds': self.duration_seconds,
            'certificate_code': self.certificate_code,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'xml_blob_url': self.xml_blob_url,
            'badge_uuid': self.badge_uuid,
        }
        
        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'name': self.user.full_name,
                'email': self.user.email,
                'username': self.user.username,
            }
        
        return data


class Vb6SessionToken(db.Model):
    """Token de sesión simple para autenticación VB6 → MotorV2."""
    
    __tablename__ = 'vb6_session_tokens'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    vm_session_id = db.Column(db.Integer, nullable=True)
    group_exam_id = db.Column(db.Integer, nullable=True)  # Asignación (reemplaza concepto de voucher)
    session_type = db.Column(db.String(20), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(hours=4))
    is_active = db.Column(db.Boolean, default=True)
    
    user = db.relationship('User', backref=db.backref('vb6_tokens', lazy='dynamic'))
    
    def is_valid(self):
        return self.is_active and self.expires_at > datetime.utcnow()


class OfficeAppVersion(db.Model):
    """Control de versiones mínimas por EXE de VB6."""
    
    __tablename__ = 'office_app_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    app_name = db.Column(db.String(100), unique=True, nullable=False)  # "EvaluadorExcel2016Basico"
    app_type = db.Column(db.String(20), nullable=False)  # examen, simulador, parcial
    min_version = db.Column(db.String(30), nullable=True)
    latest_version = db.Column(db.String(30), nullable=True)
    download_url = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'app_name': self.app_name,
            'app_type': self.app_type,
            'min_version': self.min_version,
            'latest_version': self.latest_version,
            'download_url': self.download_url,
            'is_active': self.is_active,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
