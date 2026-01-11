"""add report_url to results

Revision ID: add_report_url_to_results
Revises: 
Create Date: 2025-01-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_report_url_to_results'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Agregar columna report_url a la tabla results
    op.add_column('results', sa.Column('report_url', sa.String(500), nullable=True))


def downgrade():
    # Eliminar columna report_url de la tabla results
    op.drop_column('results', 'report_url')
