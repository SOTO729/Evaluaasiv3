"""
Migración para crear tabla de certificados CONOCER
"""
from datetime import datetime
from alembic import op
import sqlalchemy as sa


# Revisión ID
revision = '20260113_conocer_certificates'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """
    Crear tabla conocer_certificates para almacenar metadata de certificados CONOCER
    """
    op.create_table(
        'conocer_certificates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        
        # Información del certificado
        sa.Column('certificate_number', sa.String(50), nullable=False),
        sa.Column('curp', sa.String(18), nullable=False),
        
        # Estándar de competencia
        sa.Column('standard_code', sa.String(20), nullable=False),
        sa.Column('standard_name', sa.String(500), nullable=False),
        sa.Column('competency_level', sa.String(10), nullable=True),
        
        # Centro evaluador
        sa.Column('evaluation_center_name', sa.String(255), nullable=True),
        sa.Column('evaluation_center_code', sa.String(50), nullable=True),
        sa.Column('evaluator_name', sa.String(255), nullable=True),
        
        # Fechas
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('expiration_date', sa.Date(), nullable=True),
        sa.Column('evaluation_date', sa.Date(), nullable=True),
        
        # Azure Blob Storage
        sa.Column('blob_name', sa.String(500), nullable=False),
        sa.Column('blob_container', sa.String(100), server_default='conocer-certificates'),
        sa.Column('blob_tier', sa.String(20), server_default='Cool'),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('file_hash', sa.String(64), nullable=True),
        sa.Column('content_type', sa.String(100), server_default='application/pdf'),
        
        # Estado
        sa.Column('status', sa.String(20), server_default='active', nullable=False),
        sa.Column('is_verified', sa.Boolean(), server_default='0'),
        sa.Column('verification_date', sa.DateTime(), nullable=True),
        sa.Column('verification_url', sa.String(500), nullable=True),
        
        # Metadata
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('archived_at', sa.DateTime(), nullable=True),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('certificate_number')
    )
    
    # Índices para búsquedas frecuentes
    op.create_index('ix_conocer_certificates_user_id', 'conocer_certificates', ['user_id'])
    op.create_index('ix_conocer_certificates_certificate_number', 'conocer_certificates', ['certificate_number'])
    op.create_index('ix_conocer_certificates_curp', 'conocer_certificates', ['curp'])
    op.create_index('ix_conocer_certificates_standard_code', 'conocer_certificates', ['standard_code'])
    op.create_index('ix_conocer_certificates_status', 'conocer_certificates', ['status'])


def downgrade():
    """
    Eliminar tabla conocer_certificates
    """
    op.drop_index('ix_conocer_certificates_status', 'conocer_certificates')
    op.drop_index('ix_conocer_certificates_standard_code', 'conocer_certificates')
    op.drop_index('ix_conocer_certificates_curp', 'conocer_certificates')
    op.drop_index('ix_conocer_certificates_certificate_number', 'conocer_certificates')
    op.drop_index('ix_conocer_certificates_user_id', 'conocer_certificates')
    op.drop_table('conocer_certificates')
