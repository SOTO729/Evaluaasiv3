"""Add allowed element types to study sessions

Revision ID: add_session_elements
Revises: 
Create Date: 2026-01-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_session_elements'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns for allowed element types
    op.add_column('study_sessions', sa.Column('allow_reading', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('study_sessions', sa.Column('allow_video', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('study_sessions', sa.Column('allow_downloadable', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('study_sessions', sa.Column('allow_interactive', sa.Boolean(), nullable=True, server_default='true'))


def downgrade():
    op.drop_column('study_sessions', 'allow_reading')
    op.drop_column('study_sessions', 'allow_video')
    op.drop_column('study_sessions', 'allow_downloadable')
    op.drop_column('study_sessions', 'allow_interactive')
