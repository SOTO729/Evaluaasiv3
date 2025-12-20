"""
Modelo de Voucher
"""
from datetime import datetime
from app import db


class Voucher(db.Model):
    """Modelo de voucher de acceso a exámenes"""
    
    __tablename__ = 'vouchers'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    exam_stage_id = db.Column(db.Integer, nullable=False)
    
    # Información del voucher
    voucher_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    voucher_number = db.Column(db.Integer, nullable=False)
    
    # Configuración institucional
    subsystem_id = db.Column(db.Integer, nullable=False)
    campus_id = db.Column(db.Integer, nullable=False)
    certification_id = db.Column(db.Integer, nullable=False)
    application_id = db.Column(db.Integer, nullable=False)
    
    # Control de uso
    opportunities = db.Column(db.Integer, default=2, nullable=False)  # Intentos permitidos
    opportunities_used = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.Integer, default=0, nullable=False)  # 0=activo, 1=usado, 2=expirado, 3=en proceso
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_synchronized = db.Column(db.Boolean, default=False, nullable=False)
    
    # Fechas
    expiration_date = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relaciones
    results = db.relationship('Result', backref='voucher', lazy='dynamic', cascade='all, delete-orphan')
    
    def is_valid(self):
        """Verificar si el voucher es válido"""
        if not self.is_active:
            return False, "Voucher inactivo"
        
        if self.status == 2:
            return False, "Voucher expirado"
        
        if self.expiration_date < datetime.utcnow():
            self.status = 2
            db.session.commit()
            return False, "Voucher expirado"
        
        if self.opportunities_used >= self.opportunities:
            return False, "Sin oportunidades restantes"
        
        return True, "Voucher válido"
    
    def use_opportunity(self):
        """Usar una oportunidad del voucher"""
        if self.opportunities_used < self.opportunities:
            self.opportunities_used += 1
            if self.opportunities_used >= self.opportunities:
                self.status = 1  # Usado
            return True
        return False
    
    def to_dict(self):
        """Convertir a diccionario"""
        is_valid, message = self.is_valid()
        
        return {
            'id': self.id,
            'voucher_code': self.voucher_code,
            'voucher_number': self.voucher_number,
            'exam_stage_id': self.exam_stage_id,
            'opportunities': self.opportunities,
            'opportunities_used': self.opportunities_used,
            'opportunities_remaining': self.opportunities - self.opportunities_used,
            'status': self.status,
            'is_active': self.is_active,
            'is_valid': is_valid,
            'validation_message': message,
            'expiration_date': self.expiration_date.isoformat() if self.expiration_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Voucher {self.voucher_code}>'
