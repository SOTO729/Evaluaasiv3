"""
Modelo para pagos en línea vía Mercado Pago

Registra cada intento de pago y su estado según las notificaciones IPN/webhook.
"""
import json
from datetime import datetime
from app import db


PAYMENT_STATUS = {
    'pending': 'Pendiente',
    'processing': 'Procesando',
    'approved': 'Aprobado',
    'rejected': 'Rechazado',
    'cancelled': 'Cancelado',
    'refunded': 'Reembolsado',
    'in_mediation': 'En mediación',
    'charged_back': 'Contracargo',
}


class Payment(db.Model):
    """Registro de un pago realizado o intentado vía Mercado Pago."""

    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)

    # Quién paga
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=False)

    # Qué se paga
    units = db.Column(db.Integer, nullable=False)  # Número de vouchers/certificados
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)  # Precio unitario al momento del pago
    total_amount = db.Column(db.Numeric(12, 2), nullable=False)  # units * unit_price

    # Mercado Pago
    mp_preference_id = db.Column(db.String(100), nullable=True)  # ID de la preferencia creada
    mp_payment_id = db.Column(db.String(100), nullable=True, index=True)  # ID del pago en MP
    mp_status = db.Column(db.String(30), nullable=True)  # Estado raw de MP (approved, pending, rejected, etc.)
    mp_status_detail = db.Column(db.String(100), nullable=True)  # Detalle (accredited, pending_contingency, etc.)
    mp_payment_method = db.Column(db.String(50), nullable=True)  # Método: visa, master, oxxo, etc.
    mp_payment_type = db.Column(db.String(30), nullable=True)  # Tipo: credit_card, debit_card, ticket, etc.
    mp_external_reference = db.Column(db.String(100), nullable=True, unique=True, index=True)  # Referencia interna

    # Estado interno
    status = db.Column(db.String(30), default='pending', nullable=False, index=True)

    # Si ya se acreditaron los vouchers al saldo
    credits_applied = db.Column(db.Boolean, default=False, nullable=False)
    credits_applied_at = db.Column(db.DateTime, nullable=True)

    # Datos extra del webhook (JSON)
    webhook_data = db.Column(db.Text, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relaciones
    user = db.relationship('User', backref=db.backref('payments', lazy='dynamic'))
    campus = db.relationship('Campus', backref=db.backref('payments', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'campus_id': self.campus_id,
            'units': self.units,
            'unit_price': float(self.unit_price) if self.unit_price else 0,
            'total_amount': float(self.total_amount) if self.total_amount else 0,
            'mp_preference_id': self.mp_preference_id,
            'mp_payment_id': self.mp_payment_id,
            'mp_status': self.mp_status,
            'mp_status_detail': self.mp_status_detail,
            'mp_payment_method': self.mp_payment_method,
            'mp_payment_type': self.mp_payment_type,
            'mp_external_reference': self.mp_external_reference,
            'status': self.status,
            'status_label': PAYMENT_STATUS.get(self.status, self.status),
            'credits_applied': self.credits_applied,
            'credits_applied_at': self.credits_applied_at.isoformat() if self.credits_applied_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'campus': {
                'id': self.campus.id,
                'name': self.campus.name,
            } if self.campus else None,
        }
