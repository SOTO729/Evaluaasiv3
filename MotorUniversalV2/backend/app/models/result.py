"""
Modelo de Resultado
"""
from datetime import datetime
from app import db


class Result(db.Model):
    """Modelo de resultado de examen"""
    
    __tablename__ = 'results'
    
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    voucher_id = db.Column(db.Integer, db.ForeignKey('vouchers.id'), nullable=True)  # Nullable para permitir resultados sin voucher
    exam_id = db.Column(db.Integer, nullable=False, index=True)
    
    # Relación con Estándar de Competencia (ECM) - los resultados se asocian al ECM
    competency_standard_id = db.Column(db.Integer, db.ForeignKey('competency_standards.id'), nullable=True, index=True)
    
    # Resultado
    score = db.Column(db.Integer, nullable=False)  # Puntaje obtenido (0-100)
    status = db.Column(db.Integer, default=0, nullable=False)  # 0=en proceso, 1=completado, 2=abandonado
    result = db.Column(db.Integer, default=0)  # 0=reprobado, 1=aprobado
    
    # Metadata del examen
    start_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    end_date = db.Column(db.DateTime)
    duration_seconds = db.Column(db.Integer)  # Duración real en segundos
    
    # Información del entorno
    ip_address = db.Column(db.String(45))  # IPv4 o IPv6
    user_agent = db.Column(db.String(500))
    browser = db.Column(db.String(100))
    
    # Datos del examen (JSON)
    answers_data = db.Column(db.JSON)  # Respuestas del usuario
    questions_order = db.Column(db.JSON)  # Orden de preguntas presentadas
    
    # Certificado
    certificate_url = db.Column(db.String(500))  # URL del certificado en Azure Blob
    certificate_code = db.Column(db.String(100), unique=True)  # Código único del certificado
    report_url = db.Column(db.String(500))  # URL del reporte PDF en Azure Blob
    pdf_status = db.Column(db.String(50), default='pending')  # pending, processing, completed, error
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relación con el estándar de competencia
    competency_standard = db.relationship('CompetencyStandard', backref='results')
    
    def __init__(self, **kwargs):
        super(Result, self).__init__(**kwargs)
        if not self.id:
            import uuid
            self.id = str(uuid.uuid4())
    
    def calculate_duration(self):
        """Calcular duración del examen"""
        if self.end_date and self.start_date:
            delta = self.end_date - self.start_date
            self.duration_seconds = int(delta.total_seconds())
    
    def is_passing(self, passing_score=70):
        """Verificar si aprobó el examen"""
        return self.score >= passing_score
    
    def to_dict(self, include_details=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'exam_id': self.exam_id,
            'competency_standard_id': self.competency_standard_id,
            'score': self.score,
            'status': self.status,
            'result': self.result,
            'start_date': (self.start_date.isoformat() + 'Z') if self.start_date else None,
            'end_date': (self.end_date.isoformat() + 'Z') if self.end_date else None,
            'duration_seconds': self.duration_seconds,
            'certificate_code': self.certificate_code,
            'certificate_url': self.certificate_url,
            'report_url': self.report_url,
            'pdf_status': self.pdf_status
        }
        
        # Incluir info del estándar de competencia si existe
        if self.competency_standard:
            data['competency_standard'] = {
                'id': self.competency_standard.id,
                'code': self.competency_standard.code,
                'name': self.competency_standard.name
            }
        
        if include_details:
            data['answers_data'] = self.answers_data
            data['questions_order'] = self.questions_order
            data['ip_address'] = self.ip_address
            data['browser'] = self.browser
        
        return data
    
    def __repr__(self):
        return f'<Result {self.id} - Score: {self.score}>'
