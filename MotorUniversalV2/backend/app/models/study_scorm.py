"""
Modelos de SCORM para Materiales de Estudio.

Diseño:
- StudyScormPackage: paquete SCORM 1.2 vinculado opcionalmente a un StudyTopic (1:1).
- StudyScormAttempt: intento persistente de un usuario sobre un paquete (UNIQUE user_id+package_id).

Aditivo: no rompe estructuras existentes. El topic admite SCORM como un 5º tipo de elemento opcional.
"""
from datetime import datetime
from app import db


class StudyScormPackage(db.Model):
    """Paquete SCORM 1.2 (zip extraído en Azure Blob)."""

    __tablename__ = 'study_scorm_packages'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(
        db.Integer,
        db.ForeignKey('study_topics.id', ondelete='CASCADE'),
        nullable=True,
        unique=True,
        index=True,
    )

    version = db.Column(db.String(10), default='1.2', nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)

    # Storage
    blob_prefix = db.Column(db.String(255), nullable=False)   # ej: "scorm-packages/<uuid>"
    blob_base_url = db.Column(db.String(500), nullable=False) # ej: "https://<acct>.blob.core.windows.net/scorm-packages/<uuid>"
    manifest_path = db.Column(db.String(500))                 # ruta relativa dentro del prefix
    entry_point = db.Column(db.String(500), nullable=False)   # ej: "index_lms.html"
    size_bytes = db.Column(db.BigInteger)
    file_count = db.Column(db.Integer)

    # Auditoría
    uploaded_by = db.Column(
        db.String(36),
        db.ForeignKey('users.id', ondelete='NO ACTION'),
        nullable=False,
        index=True,
    )
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    attempts = db.relationship(
        'StudyScormAttempt',
        backref='package',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )

    @property
    def launch_url(self) -> str:
        """URL pública para ejecutar el paquete (entry point)."""
        base = self.blob_base_url.rstrip('/')
        ep = (self.entry_point or 'index.html').lstrip('/')
        return f"{base}/{ep}"

    def to_dict(self, include_attempt_for_user: str = None) -> dict:
        data = {
            'id': self.id,
            'topic_id': self.topic_id,
            'version': self.version,
            'title': self.title,
            'description': self.description,
            'entry_point': self.entry_point,
            'launch_url': self.launch_url,
            'size_bytes': self.size_bytes,
            'file_count': self.file_count,
            'uploaded_by': self.uploaded_by,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_attempt_for_user:
            attempt = StudyScormAttempt.query.filter_by(
                user_id=include_attempt_for_user,
                package_id=self.id,
            ).first()
            data['attempt'] = attempt.to_dict() if attempt else None
        return data


class StudyScormAttempt(db.Model):
    """Intento persistente (1 por usuario+paquete)."""

    __tablename__ = 'study_scorm_attempts'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'package_id', name='uq_scorm_attempt_user_package'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.String(36),
        db.ForeignKey('users.id', ondelete='NO ACTION'),
        nullable=False,
        index=True,
    )
    package_id = db.Column(
        db.Integer,
        db.ForeignKey('study_scorm_packages.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )

    # CMI 1.2 core
    completion_status = db.Column(db.String(20), default='not attempted')  # not attempted|incomplete|completed|browsed|failed|passed
    success_status = db.Column(db.String(20))                              # passed|failed|unknown
    lesson_status = db.Column(db.String(20))                               # SCORM 1.2: passed/completed/failed/incomplete/browsed/not attempted
    score_raw = db.Column(db.Float)
    score_min = db.Column(db.Float)
    score_max = db.Column(db.Float)
    score_scaled = db.Column(db.Float)  # 0.0 - 1.0
    session_time = db.Column(db.String(20))
    total_time = db.Column(db.String(20))
    location = db.Column(db.String(1000))
    suspend_data = db.Column(db.Text)   # NVARCHAR(MAX) en MSSQL
    cmi_data = db.Column(db.Text)       # snapshot JSON completo (debug/extras)
    exit_status = db.Column(db.String(20))

    # Marca derivada (cache para queries rápidos)
    is_completed = db.Column(db.Boolean, default=False, nullable=False)

    started_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_commit_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    finished_at = db.Column(db.DateTime)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'package_id': self.package_id,
            'completion_status': self.completion_status,
            'success_status': self.success_status,
            'lesson_status': self.lesson_status,
            'score_raw': self.score_raw,
            'score_min': self.score_min,
            'score_max': self.score_max,
            'score_scaled': self.score_scaled,
            'session_time': self.session_time,
            'total_time': self.total_time,
            'location': self.location,
            'suspend_data': self.suspend_data,
            'exit_status': self.exit_status,
            'is_completed': bool(self.is_completed),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'last_commit_at': self.last_commit_at.isoformat() if self.last_commit_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
        }
