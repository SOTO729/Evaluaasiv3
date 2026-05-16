"""
Modelo de solicitud de exportación SCORM de un material de estudio.

Flujo:
    pending  → approved   (admin o gerente aprueba)
             → rejected   (admin o gerente rechaza)
    approved → consumed   (editor descarga el ZIP; cada autorización
                            permite UNA descarga. Para descargar de nuevo
                            se requiere una nueva solicitud aprobada.)
"""
from datetime import datetime, timezone
from app import db


class StudyExportRequest(db.Model):
    __tablename__ = 'study_export_requests'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    material_id = db.Column(
        db.Integer,
        db.ForeignKey('study_contents.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    requested_by = db.Column(
        db.String(36),
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    reason = db.Column(db.Text, nullable=True)
    # pending | approved | rejected | consumed
    status = db.Column(db.String(20), nullable=False, default='pending', index=True)

    reviewed_by = db.Column(
        db.String(36),
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
    )
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_notes = db.Column(db.Text, nullable=True)

    consumed_at = db.Column(db.DateTime, nullable=True)
    consumed_filename = db.Column(db.String(500), nullable=True)
    size_bytes = db.Column(db.BigInteger, nullable=True)

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self, include_material: bool = False) -> dict:
        from app.models.user import User
        requester = User.query.get(self.requested_by) if self.requested_by else None
        reviewer = User.query.get(self.reviewed_by) if self.reviewed_by else None
        data = {
            'id': self.id,
            'material_id': self.material_id,
            'status': self.status,
            'reason': self.reason,
            'requested_by': self.requested_by,
            'requested_by_name': (
                (requester.full_name if hasattr(requester, 'full_name') else None)
                or (requester.username if requester else None)
            ) if requester else None,
            'requested_by_email': requester.email if requester else None,
            'reviewed_by': self.reviewed_by,
            'reviewed_by_name': (
                (reviewer.full_name if hasattr(reviewer, 'full_name') else None)
                or (reviewer.username if reviewer else None)
            ) if reviewer else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_notes': self.review_notes,
            'consumed_at': self.consumed_at.isoformat() if self.consumed_at else None,
            'consumed_filename': self.consumed_filename,
            'size_bytes': self.size_bytes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_material:
            from app.models.study_content import StudyMaterial
            mat = StudyMaterial.query.get(self.material_id)
            data['material'] = {
                'id': mat.id,
                'title': mat.title,
                'description': mat.description,
                'image_url': mat.image_url,
                'is_published': mat.is_published,
            } if mat else None
        return data
