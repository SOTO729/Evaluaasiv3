"""
Modelos de verificación CURP

- CurpRenapoCache: cache local de respuestas RENAPO (positivas y negativas)
  para reducir llamadas externas a gob.mx. Las positivas viven 30 días;
  las negativas se renuevan rápido (1h) para permitir reintentos cuando
  RENAPO está intermitente.

- CurpVerificationQueue: cola persistente de CURPs pendientes de verificar
  contra RENAPO. Sustituye los threads volátiles. Si RENAPO está caído,
  las entradas se reagendan cada 12h indefinidamente — NUNCA se delegan
  al candidato como `curp_required` por culpa del servicio externo.
"""
from datetime import datetime, timedelta
from app import db


# Estados de la cola
QUEUE_PENDING = 'pending'         # esperando próxima ejecución
QUEUE_PROCESSING = 'processing'   # worker la está validando ahora mismo
QUEUE_DONE = 'done'               # validada exitosamente
QUEUE_REJECTED = 'rejected'       # RENAPO rechazó (no la encontró) — ya delegada a usuario
QUEUE_FAILED = 'failed'           # error técnico no recuperable (formato inválido, etc.)


class CurpRenapoCache(db.Model):
    """Cache de respuestas RENAPO por CURP.

    Una entrada por CURP. El campo `valid` indica si RENAPO la encontró.
    `payload_json` guarda los datos derivados (nombre, apellidos, sexo,
    fecha de nacimiento) cuando la consulta fue positiva.
    """
    __tablename__ = 'curp_renapo_cache'

    id = db.Column(db.Integer, primary_key=True)
    curp = db.Column(db.String(18), unique=True, nullable=False, index=True)
    valid = db.Column(db.Boolean, nullable=False, default=False)
    payload_json = db.Column(db.Text, nullable=True)  # JSON con name/surnames/gender/birth_date
    error_message = db.Column(db.String(500), nullable=True)
    cached_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    hits = db.Column(db.Integer, default=0, nullable=False)  # cuántas veces se sirvió desde cache

    # TTL configurable
    POSITIVE_TTL_DAYS = 30  # CURPs encontradas: poco probable que cambien
    NEGATIVE_TTL_HOURS = 1  # CURPs rechazadas: TTL corto por intermitencia RENAPO

    @staticmethod
    def calc_expiry(valid: bool) -> datetime:
        if valid:
            return datetime.utcnow() + timedelta(days=CurpRenapoCache.POSITIVE_TTL_DAYS)
        return datetime.utcnow() + timedelta(hours=CurpRenapoCache.NEGATIVE_TTL_HOURS)

    def is_fresh(self) -> bool:
        return datetime.utcnow() < self.expires_at

    def to_dict(self):
        return {
            'curp': self.curp,
            'valid': self.valid,
            'cached_at': self.cached_at.isoformat() if self.cached_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'hits': self.hits,
        }


class CurpVerificationQueue(db.Model):
    """Cola de CURPs pendientes de validar contra RENAPO.

    Características:
    - `next_retry_at` permite agendar reintentos cuando RENAPO está caído.
    - `attempts` cuenta intentos totales (visibilidad operativa).
    - `circuit_open_retries` cuenta reintentos por circuit-breaker abierto.
      Cuando este contador sube, el delay sube a 12h (config) — NUNCA se
      escala a curp_required por servicio caído.
    - `batch_id` opcional liga la entrada a una carga masiva para emitir
      el correo de notificación cuando todas las CURPs del batch terminen.
    """
    __tablename__ = 'curp_verification_queue'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    curp = db.Column(db.String(18), nullable=False, index=True)
    status = db.Column(db.String(20), default=QUEUE_PENDING, nullable=False, index=True)
    attempts = db.Column(db.Integer, default=0, nullable=False)
    circuit_open_retries = db.Column(db.Integer, default=0, nullable=False)
    last_error = db.Column(db.String(500), nullable=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('bulk_upload_batches.id', ondelete='SET NULL'), nullable=True, index=True)
    source = db.Column(db.String(20), default='bulk', nullable=False)  # 'bulk', 'self_service', 'recovery'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    next_retry_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    finished_at = db.Column(db.DateTime, nullable=True)
    locked_at = db.Column(db.DateTime, nullable=True)  # para evitar dos workers tomando la misma fila
    locked_by = db.Column(db.String(80), nullable=True)

    # Política de reintentos
    MAX_RENAPO_ATTEMPTS_BEFORE_DELEGATE = 6  # 6 rondas reales (no por circuit) = mismo umbral histórico
    CIRCUIT_OPEN_BACKOFF_HOURS = 12          # cuando RENAPO está caído

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'curp': self.curp,
            'status': self.status,
            'attempts': self.attempts,
            'circuit_open_retries': self.circuit_open_retries,
            'last_error': self.last_error,
            'batch_id': self.batch_id,
            'source': self.source,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'next_retry_at': self.next_retry_at.isoformat() if self.next_retry_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
        }
