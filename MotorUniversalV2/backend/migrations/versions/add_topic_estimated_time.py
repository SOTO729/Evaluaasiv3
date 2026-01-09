"""Add estimated_time_minutes to study_topics table

Revision ID: add_topic_estimated_time
Revises: b6c3d4e5f6g7
Create Date: 2026-01-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_topic_estimated_time'
down_revision = 'b6c3d4e5f6g7'
branch_labels = None
depends_on = None


def upgrade():
    # Add estimated_time_minutes column to study_topics table
    op.add_column('study_topics', sa.Column('estimated_time_minutes', sa.Integer(), nullable=True))


def downgrade():
    # Remove estimated_time_minutes column from study_topics table
    op.drop_column('study_topics', 'estimated_time_minutes')
