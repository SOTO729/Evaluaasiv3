"""Add type column to exercises and questions tables

Revision ID: add_type_column
Revises: 
Create Date: 2026-01-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_type_column'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add type column to exercises table
    # Valid values: exam, simulator
    op.add_column('exercises', 
                  sa.Column('type', sa.String(20), server_default='exam', nullable=False))
    
    # Add type column to questions table
    # Valid values: exam, simulator  
    op.add_column('questions',
                  sa.Column('type', sa.String(20), server_default='exam', nullable=False))


def downgrade():
    op.drop_column('exercises', 'type')
    op.drop_column('questions', 'type')
