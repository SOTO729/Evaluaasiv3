"""
Modelo de Plantilla de Certificado por ECM
Permite a cada Estándar de Competencia tener su propia plantilla PDF
con posiciones configurables para nombre, nombre de certificado y código QR.
"""
import json
from datetime import datetime
from app import db


class CertificateTemplate(db.Model):
    """
    Plantilla de certificado personalizada por ECM.
    
    Cada CompetencyStandard puede tener una plantilla PDF personalizada
    con posiciones configurables para los elementos del certificado.
    Las posiciones se almacenan en coordenadas PDF (puntos, origen inferior-izquierdo).
    """
    
    __tablename__ = 'certificate_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    competency_standard_id = db.Column(
        db.Integer,
        db.ForeignKey('competency_standards.id'),
        nullable=False,
        unique=True
    )
    
    # URL del PDF de plantilla en Azure Blob Storage
    template_blob_url = db.Column(db.String(500), nullable=False)
    
    # Dimensiones del PDF en puntos (detectadas al subir)
    pdf_width = db.Column(db.Float, nullable=False, default=612.0)
    pdf_height = db.Column(db.Float, nullable=False, default=792.0)
    
    # Configuración de campos como JSON
    # Estructura:
    # {
    #   "name_field": { "x": float, "y": float, "width": float, "height": float, "maxFontSize": int, "color": str },
    #   "cert_name_field": { "x": float, "y": float, "width": float, "height": float, "maxFontSize": int, "color": str },
    #   "qr_field": { "x": float, "y": float, "size": float, "background": "white"|"transparent", "showCode": bool, "showText": bool }
    # }
    config = db.Column(db.Text, nullable=False, default='{}')
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    competency_standard = db.relationship(
        'CompetencyStandard',
        backref=db.backref('certificate_template', uselist=False, lazy='joined')
    )
    creator = db.relationship('User', foreign_keys=[created_by])
    updater = db.relationship('User', foreign_keys=[updated_by])
    
    # Configuración por defecto
    DEFAULT_CONFIG = {
        'name_field': {
            'x': 85.0,
            'y': 375.0,
            'width': 455.0,
            'height': 50.0,
            'maxFontSize': 36,
            'color': '#1a365d'
        },
        'cert_name_field': {
            'x': 85.0,
            'y': 300.0,
            'width': 455.0,
            'height': 30.0,
            'maxFontSize': 18,
            'color': '#1a365d'
        },
        'qr_field': {
            'x': 30.0,
            'y': 25.0,
            'size': 50.0,
            'background': 'transparent',
            'showCode': True,
            'showText': True
        }
    }
    
    def get_config(self):
        """Obtener configuración parseada, con defaults para campos faltantes"""
        try:
            cfg = json.loads(self.config) if self.config else {}
        except (json.JSONDecodeError, TypeError):
            cfg = {}
        
        # Merge con defaults
        result = {}
        for key, defaults in self.DEFAULT_CONFIG.items():
            result[key] = {**defaults, **(cfg.get(key, {}))}
        
        return result
    
    def set_config(self, config_dict):
        """Guardar configuración como JSON"""
        self.config = json.dumps(config_dict)
    
    def to_dict(self):
        """Convertir a diccionario"""
        return {
            'id': self.id,
            'competency_standard_id': self.competency_standard_id,
            'template_blob_url': self.template_blob_url,
            'pdf_width': self.pdf_width,
            'pdf_height': self.pdf_height,
            'config': self.get_config(),
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_by': self.updated_by,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
