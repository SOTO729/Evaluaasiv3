"""Add video dimensions columns

Revision ID: add_video_dims
Revises: 
Create Date: 2026-01-01
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'add_video_dims'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Agregar columnas de dimensiones a study_videos
    with op.batch_alter_table('study_videos', schema=None) as batch_op:
        batch_op.add_column(sa.Column('video_width', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('video_height', sa.Integer(), nullable=True))

def downgrade():
    with op.batch_alter_table('study_videos', schema=None) as batch_op:
        batch_op.drop_column('video_height')
        batch_op.drop_column('video_width')
