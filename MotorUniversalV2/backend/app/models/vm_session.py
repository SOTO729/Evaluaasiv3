"""
Modelo para sesiones de máquinas virtuales.
Los candidatos pueden agendar sesiones de VM de 1 hora,
sin empalme (no pueden existir dos sesiones en el mismo slot de hora).
"""
from datetime import datetime
from app import db


class VmSession(db.Model):
    """Sesión agendada de máquina virtual"""
    
    __tablename__ = 'vm_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Quién agenda
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Contexto organizacional
    campus_id = db.Column(db.Integer, db.ForeignKey('campuses.id', ondelete='CASCADE'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('candidate_groups.id', ondelete='SET NULL'), nullable=True)
    
    # Slot de la sesión (fecha + hora de inicio; duración siempre = 1 hora)
    session_date = db.Column(db.Date, nullable=False)
    start_hour = db.Column(db.Integer, nullable=False)  # 0-23 (hora del día)
    
    # Tipo de sesión: simulador, examen, parcial
    session_type = db.Column(db.String(20), default='simulador', nullable=False)
    
    # Sesión local (Office en PC del candidato, NO VDI remota)
    is_local = db.Column(db.Boolean, default=False, nullable=False)
    
    # Office-specific (para sesiones locales)
    office_app = db.Column(db.String(20), nullable=True)  # 'word', 'excel', 'powerpoint'
    office_version = db.Column(db.String(20), nullable=True)  # viene de config del grupo
    level = db.Column(db.String(20), nullable=True)  # 'basico', 'avanzado'
    parcial_units = db.Column(db.String(200), nullable=True)  # "1,3,10,15" unidades asignadas (parciales)
    end_hour = db.Column(db.Integer, nullable=True)  # hora fin (para Office: rango horario)
    
    # VDI/Workstation asignada (de dbo.Equipo en EvaluaasiConfig)
    workstation_id = db.Column(db.Integer, nullable=True)  # EquipoId en EvaluaasiConfig
    workstation_name = db.Column(db.String(30), nullable=True)  # Nombre del VDI (ej: VDI-OF2016-1)
    workstation_color = db.Column(db.String(7), nullable=True)  # Color hex para UI
    
    # Referencia a sesión en EvaluaasiConfig (dbo.Sesion.SesionId)
    config_session_id = db.Column(db.String(36), nullable=True)
    
    # Contraseña AD generada para esta sesión (se provisiona just-in-time)
    ad_password = db.Column(db.String(64), nullable=True)
    
    # Estado: scheduled, in_progress, completed, cancelled, no_show
    status = db.Column(db.String(20), default='scheduled', nullable=False)
    
    # Notas opcionales
    notes = db.Column(db.Text)
    
    # Quién creó la sesión (puede ser el candidato, admin o coordinator)
    created_by_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    cancelled_by_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    cancellation_reason = db.Column(db.Text)
    cancelled_at = db.Column(db.DateTime)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    user = db.relationship('User', foreign_keys=[user_id], backref='vm_sessions')
    campus = db.relationship('Campus', backref='vm_sessions')
    group = db.relationship('CandidateGroup', backref='vm_sessions')
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    cancelled_by = db.relationship('User', foreign_keys=[cancelled_by_id])
    
    # Nota: la unicidad por slot solo aplica a sesiones activas (status='scheduled').
    # Las sesiones canceladas conservan la fila para auditoría sin bloquear nuevos
    # agendamientos en el mismo slot. La unicidad filtrada se garantiza vía
    # auto_migrate (índice único filtrado en MSSQL); aquí sólo dejamos los
    # índices de soporte.
    __table_args__ = (
        db.Index('ix_vm_session_user', 'user_id'),
        db.Index('ix_vm_session_campus_date', 'campus_id', 'session_date'),
        db.Index('ix_vm_session_status', 'status'),
        db.Index('ix_vm_session_date_hour', 'session_date', 'start_hour'),
    )
    
    def to_dict(self, include_user=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'campus_id': self.campus_id,
            'group_id': self.group_id,
            'session_date': self.session_date.isoformat() if self.session_date else None,
            'start_hour': self.start_hour,
            'end_hour': self.end_hour if self.end_hour is not None else self.start_hour + 1,
            'session_type': self.session_type or 'simulador',
            'is_local': self.is_local or False,
            'office_app': self.office_app,
            'office_version': self.office_version,
            'level': self.level,
            'parcial_units': self.parcial_units,
            'workstation_id': self.workstation_id,
            'workstation_name': self.workstation_name,
            'workstation_color': self.workstation_color,
            'config_session_id': self.config_session_id,
            'status': self.status,
            'notes': self.notes,
            'created_by_id': self.created_by_id,
            'cancelled_by_id': self.cancelled_by_id,
            'cancellation_reason': self.cancellation_reason,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'name': self.user.full_name,
                'email': self.user.email,
                'role': self.user.role,
            }
        
        if self.group:
            data['group_name'] = self.group.name
        
        if self.campus:
            data['campus_name'] = self.campus.name
            
        return data
