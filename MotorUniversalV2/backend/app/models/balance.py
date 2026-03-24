"""
Modelos para gestión de Saldos y Solicitudes de Financiamiento

Sistema de control de inventario de certificaciones:
- CoordinatorBalance: Saldo actual de cada coordinador
- BalanceRequest: Solicitudes de saldo/beca
- BalanceTransaction: Historial de movimientos (auditoría)
"""
import json
from datetime import datetime
from app import db
from decimal import Decimal


class CoordinatorBalance(db.Model):
    """Saldo de un coordinador para un plantel (campus).
    
    Cada registro representa el saldo disponible de un coordinador
    para un plantel en particular. Al asignar exámenes en un grupo,
    se descuenta del saldo del plantel al que pertenece ese grupo.
    """
    
    __tablename__ = 'coordinator_balances'
    
    id = db.Column(db.Integer, primary_key=True)
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=False)
    
    # Saldo actual en pesos (para este plantel)
    current_balance = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    
    # Totales históricos (para este plantel)
    total_received = db.Column(db.Numeric(12, 2), default=0, nullable=False)  # Total recibido (aprobaciones)
    total_spent = db.Column(db.Numeric(12, 2), default=0, nullable=False)  # Total gastado (asignaciones)
    total_scholarships = db.Column(db.Numeric(12, 2), default=0, nullable=False)  # Total en becas recibidas
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Unique constraint: un registro por coordinador+plantel
    __table_args__ = (
        db.UniqueConstraint('coordinator_id', 'campus_id', name='uq_coordinator_campus_balance'),
    )
    
    # Relaciones
    coordinator = db.relationship('User', backref=db.backref('balances', lazy='dynamic'))
    campus = db.relationship('Campus', backref=db.backref('coordinator_balances', lazy='dynamic'))
    
    def to_dict(self, include_coordinator=False, include_campus=False, **kwargs):
        data = {
            'id': self.id,
            'coordinator_id': self.coordinator_id,
            'campus_id': self.campus_id,
            'current_balance': float(self.current_balance) if self.current_balance else 0,
            'total_received': float(self.total_received) if self.total_received else 0,
            'total_spent': float(self.total_spent) if self.total_spent else 0,
            'total_scholarships': float(self.total_scholarships) if self.total_scholarships else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_coordinator and self.coordinator:
            data['coordinator'] = {
                'id': self.coordinator.id,
                'name': self.coordinator.name,
                'first_surname': self.coordinator.first_surname,
                'second_surname': self.coordinator.second_surname,
                'full_name': self.coordinator.full_name,
                'email': self.coordinator.email,
            }
        
        if include_campus and self.campus:
            cert_cost = float(self.campus.certification_cost) if self.campus.certification_cost is not None else 0.0
            data['campus'] = {
                'id': self.campus.id,
                'name': self.campus.name,
                'certification_cost': cert_cost,
            }
            if self.campus.partner:
                data['campus']['partner_name'] = self.campus.partner.name
        
        return data
    
    def add_balance(self, amount, is_scholarship=False):
        """Agregar saldo al coordinador para este plantel"""
        self.current_balance = (self.current_balance or Decimal('0')) + Decimal(str(amount))
        self.total_received = (self.total_received or Decimal('0')) + Decimal(str(amount))
        if is_scholarship:
            self.total_scholarships = (self.total_scholarships or Decimal('0')) + Decimal(str(amount))
        self.updated_at = datetime.utcnow()
    
    def deduct_balance(self, amount):
        """Descontar saldo del coordinador para este plantel"""
        self.current_balance = (self.current_balance or Decimal('0')) - Decimal(str(amount))
        self.total_spent = (self.total_spent or Decimal('0')) + Decimal(str(amount))
        self.updated_at = datetime.utcnow()
    
    def has_sufficient_balance(self, amount):
        """Verificar si tiene saldo suficiente en este plantel"""
        return (self.current_balance or Decimal('0')) >= Decimal(str(amount))


# Estados de solicitud
REQUEST_STATUS = {
    'pending': 'Pendiente',
    'in_review': 'En revisión',
    'recommended_approve': 'Recomendado aprobar',
    'recommended_reject': 'Recomendado rechazar',
    'approved': 'Aprobado',
    'rejected': 'Rechazado',
    'cancelled': 'Cancelado'
}

# Tipos de solicitud
REQUEST_TYPES = {
    'saldo': 'Saldo',
    'beca': 'Beca'
}


class BalanceRequest(db.Model):
    """Solicitud de saldo o beca de un coordinador"""
    
    __tablename__ = 'balance_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Solicitante
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    # Destino (plantel obligatorio, grupo opcional para precio especial)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id'), nullable=False, index=True)  # Para qué plantel
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='SET NULL'), nullable=True)  # Grupo con precio especial (opcional)
    
    # Tipo de solicitud
    request_type = db.Column(db.String(20), default='saldo', nullable=False)  # 'saldo' o 'beca'
    
    # Montos
    amount_requested = db.Column(db.Numeric(12, 2), nullable=False)
    amount_approved = db.Column(db.Numeric(12, 2), nullable=True)  # Puede ser menor al solicitado
    
    # Justificación del coordinador
    justification = db.Column(db.Text, nullable=False)

    # Estado
    status = db.Column(db.String(30), default='pending', nullable=False, index=True)
    
    # Revisión del financiero (primer nivel)
    financiero_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    financiero_notes = db.Column(db.Text, nullable=True)
    financiero_recommended_amount = db.Column(db.Numeric(12, 2), nullable=True)  # Monto que recomienda aprobar
    financiero_reviewed_at = db.Column(db.DateTime, nullable=True)
    
    # Documentación adicional solicitada (para becas)
    documentation_requested = db.Column(db.Text, nullable=True)  # Qué documentos se pidieron
    documentation_provided = db.Column(db.Boolean, default=False)  # Si ya se proporcionaron
    
    # Archivos adjuntos (JSON: [{name, url, type, size}])
    attachments = db.Column(db.Text, nullable=True)  # JSON de archivos adjuntos
    
    # Aprobación final (gerente o admin)
    approved_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    approver_notes = db.Column(db.Text, nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    requested_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    coordinator = db.relationship('User', foreign_keys=[coordinator_id], backref=db.backref('balance_requests', lazy='dynamic'))
    financiero = db.relationship('User', foreign_keys=[financiero_id])
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    campus = db.relationship('Campus', backref=db.backref('balance_requests', lazy='dynamic'))
    group = db.relationship('CandidateGroup', backref=db.backref('balance_requests', lazy='dynamic'))
    
    def to_dict(self, include_coordinator=False, include_campus=False, include_group=False, include_reviewers=False):
        data = {
            'id': self.id,
            'coordinator_id': self.coordinator_id,
            'campus_id': self.campus_id,
            'group_id': self.group_id,
            'request_type': self.request_type,
            'request_type_label': REQUEST_TYPES.get(self.request_type, self.request_type),
            'amount_requested': float(self.amount_requested) if self.amount_requested else 0,
            'amount_approved': float(self.amount_approved) if self.amount_approved else None,
            'justification': self.justification,
            'status': self.status,
            'status_label': REQUEST_STATUS.get(self.status, self.status),
            'financiero_notes': self.financiero_notes,
            'financiero_recommended_amount': float(self.financiero_recommended_amount) if self.financiero_recommended_amount else None,
            'financiero_reviewed_at': self.financiero_reviewed_at.isoformat() if self.financiero_reviewed_at else None,
            'documentation_requested': self.documentation_requested,
            'documentation_provided': self.documentation_provided,
            'attachments': json.loads(self.attachments) if self.attachments else [],
            'approver_notes': self.approver_notes,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'requested_at': self.requested_at.isoformat() if self.requested_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_coordinator and self.coordinator:
            data['coordinator'] = {
                'id': self.coordinator.id,
                'name': self.coordinator.name,
                'first_surname': self.coordinator.first_surname,
                'full_name': self.coordinator.full_name,
                'email': self.coordinator.email,
            }
        
        if include_campus and self.campus:
            data['campus'] = {
                'id': self.campus.id,
                'name': self.campus.name,
                'state_name': self.campus.state_name,
                'partner_id': self.campus.partner_id,
            }
            if self.campus.partner:
                data['campus']['partner_name'] = self.campus.partner.name
        
        if include_group and self.group:
            data['group'] = {
                'id': self.group.id,
                'name': self.group.name,
                'code': self.group.code,
            }
        
        if include_reviewers:
            if self.financiero:
                data['financiero'] = {
                    'id': self.financiero.id,
                    'full_name': self.financiero.full_name,
                }
            if self.approved_by:
                data['approved_by'] = {
                    'id': self.approved_by.id,
                    'full_name': self.approved_by.full_name,
                }
        
        return data


# Tipos de transacción
TRANSACTION_TYPES = {
    'credit': 'Abono',
    'debit': 'Cargo',
    'adjustment': 'Ajuste'
}

# Conceptos de transacción
TRANSACTION_CONCEPTS = {
    'saldo_aprobado': 'Saldo aprobado',
    'beca': 'Beca aprobada',
    'asignacion_certificacion': 'Asignación de certificación',
    'asignacion_retoma': 'Asignación de retoma',
    'ajuste_manual': 'Ajuste manual',
    'devolucion': 'Devolución',
    'pago_en_linea': 'Pago en línea',
}


class BalanceTransaction(db.Model):
    """Registro de movimientos de saldo (auditoría completa)"""
    
    __tablename__ = 'balance_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # A quién pertenece el movimiento
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Plantel al que afecta el movimiento
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='SET NULL'), nullable=True)
    
    # Grupo de referencia (para detalles de auditoría, e.g. qué grupo se asignó)
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='SET NULL'), nullable=True)
    
    # Tipo y concepto
    transaction_type = db.Column(db.String(20), nullable=False)  # credit, debit, adjustment
    concept = db.Column(db.String(50), nullable=False)  # saldo_aprobado, beca, asignacion, etc.
    
    # Monto y saldo resultante
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    balance_before = db.Column(db.Numeric(12, 2), nullable=False)
    balance_after = db.Column(db.Numeric(12, 2), nullable=False)
    
    # Referencia al origen del movimiento
    reference_type = db.Column(db.String(50), nullable=True)  # 'balance_request', 'group_exam_member', etc.
    reference_id = db.Column(db.Integer, nullable=True)
    
    # Detalles adicionales
    notes = db.Column(db.Text, nullable=True)
    
    # Quién realizó el movimiento (puede ser sistema o usuario)
    created_by_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    
    # Timestamp
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relaciones
    coordinator = db.relationship('User', foreign_keys=[coordinator_id], backref=db.backref('balance_transactions', lazy='dynamic'))
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    campus = db.relationship('Campus', backref=db.backref('balance_transactions', lazy='dynamic'))
    group = db.relationship('CandidateGroup', backref=db.backref('balance_transactions', lazy='dynamic'))
    
    def to_dict(self, include_coordinator=False, include_created_by=False, include_group=False, include_campus=False):
        data = {
            'id': self.id,
            'coordinator_id': self.coordinator_id,
            'campus_id': self.campus_id,
            'group_id': self.group_id,
            'transaction_type': self.transaction_type,
            'transaction_type_label': TRANSACTION_TYPES.get(self.transaction_type, self.transaction_type),
            'concept': self.concept,
            'concept_label': TRANSACTION_CONCEPTS.get(self.concept, self.concept),
            'amount': float(self.amount) if self.amount else 0,
            'balance_before': float(self.balance_before) if self.balance_before else 0,
            'balance_after': float(self.balance_after) if self.balance_after else 0,
            'reference_type': self.reference_type,
            'reference_id': self.reference_id,
            'notes': self.notes,
            'created_by_id': self.created_by_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        
        if include_coordinator and self.coordinator:
            data['coordinator'] = {
                'id': self.coordinator.id,
                'full_name': self.coordinator.full_name,
            }
        
        if include_created_by and self.created_by:
            data['created_by'] = {
                'id': self.created_by.id,
                'full_name': self.created_by.full_name,
            }
        
        if include_group and self.group:
            data['group'] = {
                'id': self.group.id,
                'name': self.group.name,
                'code': self.group.code,
            }
        
        if include_campus and self.campus:
            data['campus'] = {
                'id': self.campus.id,
                'name': self.campus.name,
            }
        
        return data


def create_balance_transaction(coordinator_id, campus_id, transaction_type, concept, amount, 
                               group_id=None, reference_type=None, reference_id=None, notes=None, 
                               created_by_id=None):
    """Helper para crear una transacción de saldo vinculada a un plantel (campus).
    
    Args:
        coordinator_id: ID del coordinador
        campus_id: ID del plantel (obligatorio, determina qué balance se afecta)
        transaction_type: 'credit', 'debit', 'adjustment'
        concept: 'saldo_aprobado', 'beca', 'asignacion_certificacion', etc.
        amount: Monto del movimiento
        group_id: ID del grupo (opcional, para referencia en auditoría)
        reference_type: Tipo de referencia ('balance_request', 'group_exam', etc.)
        reference_id: ID de la referencia
        notes: Notas del movimiento
        created_by_id: ID del usuario que realizó el movimiento
    """
    from app.models.balance import CoordinatorBalance
    
    # Obtener o crear el balance del coordinador para este plantel
    balance = CoordinatorBalance.query.filter_by(
        coordinator_id=coordinator_id,
        campus_id=campus_id
    ).first()
    if not balance:
        balance = CoordinatorBalance(coordinator_id=coordinator_id, campus_id=campus_id)
        db.session.add(balance)
        db.session.flush()
    
    balance_before = float(balance.current_balance or 0)
    
    # Aplicar el movimiento según el tipo
    if transaction_type == 'credit':
        is_scholarship = concept == 'beca'
        balance.add_balance(amount, is_scholarship=is_scholarship)
    elif transaction_type == 'debit':
        balance.deduct_balance(amount)
    else:  # adjustment
        balance.current_balance = balance.current_balance + Decimal(str(amount))
    
    balance_after = float(balance.current_balance)
    
    # Crear el registro de transacción
    transaction = BalanceTransaction(
        coordinator_id=coordinator_id,
        campus_id=campus_id,
        group_id=group_id,
        transaction_type=transaction_type,
        concept=concept,
        amount=abs(amount),  # Siempre positivo, el tipo indica dirección
        balance_before=balance_before,
        balance_after=balance_after,
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes,
        created_by_id=created_by_id
    )
    db.session.add(transaction)
    
    return transaction, balance


# =====================================================
# SOLICITUDES DE CERTIFICADOS (Responsable → Coordinador)
# =====================================================

CERTIFICATE_REQUEST_STATUS = {
    'pending': 'Pendiente',
    'seen': 'Vista',
    'approved_by_coordinator': 'Aprobada por coordinador',
    'rejected_by_coordinator': 'Rechazada por coordinador',
    'modified': 'Modificada por coordinador',
    'forwarded': 'Enviada a aprobación',
    'in_review': 'En revisión financiera',
    'approved': 'Aprobada',
    'rejected': 'Rechazada',
    'resolved': 'Resuelta',
}


class CertificateRequest(db.Model):
    """Solicitud de saldo de un responsable de plantel a su coordinador.
    
    Flujo completo:
    1. Responsable solicita N unidades + justificación + documentos adjuntos
    2. Coordinador recibe → puede rechazar, modificar o aprobar
    3. Si aprueba, elige precio especial (grupo) y número de unidades, y envía al flujo de aprobación
    4. Financiero revisa → Gerente aprueba/rechaza
    """
    
    __tablename__ = 'certificate_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Quién solicita
    responsable_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Destino
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='SET NULL'), nullable=True)
    
    # Coordinador destino (via user.coordinator_id del responsable)
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Datos de la solicitud (responsable)
    units_requested = db.Column(db.Integer, nullable=False)
    justification = db.Column(db.Text, nullable=False)
    attachments = db.Column(db.Text, nullable=True)  # JSON: [{name, url, type, size}]
    
    # Datos del coordinador (al revisar/modificar)
    coordinator_units = db.Column(db.Integer, nullable=True)  # Unidades aprobadas por coordinador
    coordinator_group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='SET NULL'), nullable=True)
    coordinator_notes = db.Column(db.Text, nullable=True)
    coordinator_reviewed_at = db.Column(db.DateTime, nullable=True)
    
    # Vinculación con solicitud de saldo (BalanceRequest) cuando el coordinador envía al flujo
    forwarded_request_id = db.Column(db.Integer, db.ForeignKey('balance_requests.id', ondelete='SET NULL'), nullable=True)
    forwarded_at = db.Column(db.DateTime, nullable=True)
    
    # Estado
    status = db.Column(db.String(30), default='pending', nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    responsable = db.relationship('User', foreign_keys=[responsable_id], backref=db.backref('certificate_requests_made', lazy='dynamic'))
    coordinator = db.relationship('User', foreign_keys=[coordinator_id], backref=db.backref('certificate_requests_received', lazy='dynamic'))
    campus = db.relationship('Campus', backref=db.backref('certificate_requests', lazy='dynamic'))
    group = db.relationship('CandidateGroup', foreign_keys=[group_id], backref=db.backref('certificate_requests', lazy='dynamic'))
    coordinator_group = db.relationship('CandidateGroup', foreign_keys=[coordinator_group_id])
    forwarded_request = db.relationship('BalanceRequest', backref=db.backref('certificate_request_origin', uselist=False))
    
    def to_dict(self):
        data = {
            'id': self.id,
            'responsable_id': self.responsable_id,
            'campus_id': self.campus_id,
            'group_id': self.group_id,
            'coordinator_id': self.coordinator_id,
            'units_requested': self.units_requested,
            'justification': self.justification,
            'attachments': json.loads(self.attachments) if self.attachments else [],
            'coordinator_units': self.coordinator_units,
            'coordinator_group_id': self.coordinator_group_id,
            'coordinator_notes': self.coordinator_notes,
            'coordinator_reviewed_at': self.coordinator_reviewed_at.isoformat() if self.coordinator_reviewed_at else None,
            'forwarded_request_id': self.forwarded_request_id,
            'forwarded_at': self.forwarded_at.isoformat() if self.forwarded_at else None,
            'status': self.status,
            'status_label': CERTIFICATE_REQUEST_STATUS.get(self.status, self.status),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if self.responsable:
            data['responsable'] = {
                'id': self.responsable.id,
                'full_name': self.responsable.full_name,
                'email': self.responsable.email,
            }
        if self.campus:
            data['campus'] = {
                'id': self.campus.id,
                'name': self.campus.name,
            }
        if self.group:
            data['group'] = {
                'id': self.group.id,
                'name': self.group.name,
            }
        if self.coordinator_group:
            data['coordinator_group'] = {
                'id': self.coordinator_group.id,
                'name': self.coordinator_group.name,
            }
        if self.coordinator:
            data['coordinator'] = {
                'id': self.coordinator.id,
                'full_name': self.coordinator.full_name,
                'email': self.coordinator.email,
            }
        if self.forwarded_request:
            data['forwarded_request_status'] = self.forwarded_request.status
            data['forwarded_request_status_label'] = REQUEST_STATUS.get(self.forwarded_request.status, self.forwarded_request.status)
        return data
