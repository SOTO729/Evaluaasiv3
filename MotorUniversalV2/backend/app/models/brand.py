"""
Modelo de Marca (Brand)
Para categorizar los estándares por marca (Microsoft, Huawei, Abierto, etc.)
"""
from datetime import datetime
from app import db


class Brand(db.Model):
    """
    Modelo de Marca para estándares de competencia
    
    Permite agrupar y categorizar los ECM por marca/fabricante.
    Cada marca puede tener su propio logo.
    """
    
    __tablename__ = 'brands'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)  # Ej: Microsoft, Huawei, Abierto
    logo_url = db.Column(db.String(500))  # URL del logo de la marca
    description = db.Column(db.Text)
    
    # Estado
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Orden de visualización
    display_order = db.Column(db.Integer, default=0)
    
    # Auditoría
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    competency_standards = db.relationship('CompetencyStandard', backref='brand', lazy='dynamic')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_brands')
    updater = db.relationship('User', foreign_keys=[updated_by], backref='updated_brands')
    
    def get_standards_count(self):
        """Contar el número de estándares asociados"""
        return self.competency_standards.count()
    
    def to_dict(self, include_stats=False):
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'name': self.name,
            'logo_url': self.logo_url,
            'description': self.description,
            'is_active': self.is_active,
            'display_order': self.display_order,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_stats:
            data['standards_count'] = self.get_standards_count()
        
        return data
    
    def __repr__(self):
        return f'<Brand {self.name}>'
