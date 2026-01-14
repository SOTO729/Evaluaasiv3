"""
Migración: Añadir sistema de Estándares de Competencia (ECM)

Crea las tablas:
- competency_standards: Estándares de competencia
- deletion_requests: Solicitudes de eliminación

Modifica:
- exams: Añade FK a competency_standard_id
- results: Añade FK a competency_standard_id

Revision ID: 20260114_add_ecm_system
Revises: 20260113_conocer_certificates
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers
revision = '20260114_add_ecm_system'
down_revision = '20260113_conocer_certificates'
branch_labels = None
depends_on = None


def upgrade():
    # Crear tabla competency_standards
    op.create_table(
        'competency_standards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('level', sa.Integer(), nullable=True),
        sa.Column('validity_years', sa.Integer(), default=5),
        sa.Column('certifying_body', sa.String(255), default='CONOCER'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('updated_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    
    # Crear índices para competency_standards
    op.create_index('ix_competency_standards_code', 'competency_standards', ['code'])
    op.create_index('ix_competency_standards_is_active', 'competency_standards', ['is_active'])
    
    # Crear tabla deletion_requests
    op.create_table(
        'deletion_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('entity_name', sa.String(255), nullable=True),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='pending'),
        sa.Column('admin_response', sa.Text(), nullable=True),
        sa.Column('reviewed_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('requested_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('requested_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices para deletion_requests
    op.create_index('ix_deletion_requests_status', 'deletion_requests', ['status'])
    op.create_index('ix_deletion_requests_entity', 'deletion_requests', ['entity_type', 'entity_id'])
    
    # Añadir columna competency_standard_id a exams (nullable para permitir exámenes existentes)
    op.add_column('exams', sa.Column('competency_standard_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_exams_competency_standard',
        'exams', 'competency_standards',
        ['competency_standard_id'], ['id']
    )
    
    # Añadir columna competency_standard_id a results (nullable para permitir resultados existentes)
    op.add_column('results', sa.Column('competency_standard_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_results_competency_standard',
        'results', 'competency_standards',
        ['competency_standard_id'], ['id']
    )
    
    # Crear índice para búsqueda de resultados por estándar
    op.create_index('ix_results_competency_standard', 'results', ['competency_standard_id'])


def downgrade():
    # Eliminar FK y columna de results
    op.drop_index('ix_results_competency_standard', 'results')
    op.drop_constraint('fk_results_competency_standard', 'results', type_='foreignkey')
    op.drop_column('results', 'competency_standard_id')
    
    # Eliminar FK y columna de exams
    op.drop_constraint('fk_exams_competency_standard', 'exams', type_='foreignkey')
    op.drop_column('exams', 'competency_standard_id')
    
    # Eliminar índices y tabla deletion_requests
    op.drop_index('ix_deletion_requests_entity', 'deletion_requests')
    op.drop_index('ix_deletion_requests_status', 'deletion_requests')
    op.drop_table('deletion_requests')
    
    # Eliminar índices y tabla competency_standards
    op.drop_index('ix_competency_standards_is_active', 'competency_standards')
    op.drop_index('ix_competency_standards_code', 'competency_standards')
    op.drop_table('competency_standards')
