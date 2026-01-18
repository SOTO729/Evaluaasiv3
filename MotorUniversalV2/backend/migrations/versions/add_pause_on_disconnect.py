"""Add pause_on_disconnect column to exams table

Revision ID: add_pause_on_disconnect
Revises: 
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_pause_on_disconnect'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Add pause_on_disconnect column to exams table"""
    # Add the column with default value True
    op.add_column('exams', 
        sa.Column('pause_on_disconnect', sa.Boolean(), nullable=False, server_default=sa.text('1'))
    )


def downgrade():
    """Remove pause_on_disconnect column from exams table"""
    op.drop_column('exams', 'pause_on_disconnect')
