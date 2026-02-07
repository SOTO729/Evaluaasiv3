"""
Modelos para gestión de Saldos y Solicitudes de Financiamiento

Sistema de control de inventario de certificaciones:
- CoordinatorBalance: Saldo actual de cada coordinador
- BalanceRequest: Solicitudes de saldo/beca
- BalanceTransaction: Historial de movimientos (auditoría)
"""
from datetime import datetime
from app import db
from decimal import Decimal


class CoordinatorBalance(db.Model):
    """Saldo actual de un coordinador para asignar certificaciones"""
    
    __tablename__ = 'coordinator_balances'
    
    id = db.Column(db.Integer, primary_key=True)
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # Saldo actual en pesos
    current_balance = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    
    # Totales históricos
    total_received = db.Column(db.Numeric(12, 2), default=0, nullable=False)  # Total recibido (aprobaciones)
    total_spent = db.Column(db.Numeric(12, 2), default=0, nullable=False)  # Total gastado (asignaciones)
    total_scholarships = db.Column(db.Numeric(12, 2), default=0, nullable=False)  # Total en becas recibidas
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relación con usuario
    coordinator = db.relationship('User', backref=db.backref('balance', uselist=False))
    
    def to_dict(self, include_coordinator=False):
        data = {
            'id': self.id,
            'coordinator_id': self.coordinator_id,
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
        
        return data
    
    def add_balance(self, amount, is_scholarship=False):
        """Agregar saldo al coordinador"""
        self.current_balance = (self.current_balance or Decimal('0')) + Decimal(str(amount))
        self.total_received = (self.total_received or Decimal('0')) + Decimal(str(amount))
        if is_scholarship:
            self.total_scholarships = (self.total_scholarships or Decimal('0')) + Decimal(str(amount))
        self.updated_at = datetime.utcnow()
    
    def deduct_balance(self, amount):
        """Descontar saldo del coordinador"""
        self.current_balance = (self.current_balance or Decimal('0')) - Decimal(str(amount))
        self.total_spent = (self.total_spent or Decimal('0')) + Decimal(str(amount))
        self.updated_at = datetime.utcnow()
    
    def has_sufficient_balance(self, amount):
        """Verificar si tiene saldo suficiente"""
        return (self.current_balance or Decimal('0')) >= Decimal(str(amount))


# Estados de solicitud
REQUEST_STATUS = {
    'pending': 'Pendiente',
    'in_review': 'En revisión',
    'recommended_approve': 'Recomendado aprobar',
    'recommended_reject': 'Recomendado rechazar',
    'approved': 'Aprobado',
    'rejected': 'Rechazado'
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
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Destino (para trazabilidad)
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id'), nullable=True)  # Para qué plantel
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id'), nullable=True)  # Para qué grupo (opcional)
    
    # Tipo de solicitud
    request_type = db.Column(db.String(20), default='saldo', nullable=False)  # 'saldo' o 'beca'
    
    # Montos
    amount_requested = db.Column(db.Numeric(12, 2), nullable=False)
    amount_approved = db.Column(db.Numeric(12, 2), nullable=True)  # Puede ser menor al solicitado
    
    # Justificación del coordinador
    justification = db.Column(db.Text, nullable=False)
    
    # Estado
    status = db.Column(db.String(30), default='pending', nullable=False)
    
    # Revisión del financiero (primer nivel)
    financiero_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    financiero_notes = db.Column(db.Text, nullable=True)
    financiero_recommended_amount = db.Column(db.Numeric(12, 2), nullable=True)  # Monto que recomienda aprobar
    financiero_reviewed_at = db.Column(db.DateTime, nullable=True)
    
    # Documentación adicional solicitada (para becas)
    documentation_requested = db.Column(db.Text, nullable=True)  # Qué documentos se pidieron
    documentation_provided = db.Column(db.Boolean, default=False)  # Si ya se proporcionaron
    
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
    'devolucion': 'Devolución'
}


class BalanceTransaction(db.Model):
    """Registro de movimientos de saldo (auditoría completa)"""
    
    __tablename__ = 'balance_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # A quién pertenece el movimiento
    coordinator_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
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
    
    def to_dict(self, include_coordinator=False, include_created_by=False):
        data = {
            'id': self.id,
            'coordinator_id': self.coordinator_id,
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
        
        return data


def create_balance_transaction(coordinator_id, transaction_type, concept, amount, 
                               reference_type=None, reference_id=None, notes=None, 
                               created_by_id=None):
    """Helper para crear una transacción de saldo con todos los datos correctos"""
    from app.models.balance import CoordinatorBalance
    
    # Obtener o crear el balance del coordinador
    balance = CoordinatorBalance.query.filter_by(coordinator_id=coordinator_id).first()
    if not balance:
        balance = CoordinatorBalance(coordinator_id=coordinator_id)
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
