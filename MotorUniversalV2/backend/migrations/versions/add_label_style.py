"""Add label_style to interactive exercise actions

Revision ID: add_label_style
Revises: 
Create Date: 2026-01-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_label_style'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add label_style column to study_interactive_exercise_actions table
    op.add_column('study_interactive_exercise_actions', 
                  sa.Column('label_style', sa.String(20), server_default='text_with_shadow'))


def downgrade():
    op.drop_column('study_interactive_exercise_actions', 'label_style')
