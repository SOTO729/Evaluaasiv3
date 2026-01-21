"""Add pdf_status column to results table

Revision ID: 20250604_add_pdf_status
Revises: 
Create Date: 2025-06-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250604_add_pdf_status'
down_revision = None  # Ajustar al último migration ID existente
branch_labels = None
depends_on = None


def upgrade():
    """Agregar columna pdf_status a la tabla results"""
    # Verificar si la columna ya existe
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('results')]
    
    if 'pdf_status' not in columns:
        op.add_column('results', 
            sa.Column('pdf_status', sa.String(50), nullable=True, server_default='pending')
        )
        print("Columna pdf_status agregada a results")
    else:
        print("Columna pdf_status ya existe en results")


def downgrade():
    """Remover columna pdf_status de la tabla results"""
    op.drop_column('results', 'pdf_status')
