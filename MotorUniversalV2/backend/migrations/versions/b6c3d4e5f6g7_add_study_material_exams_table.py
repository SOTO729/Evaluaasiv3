"""Add study_material_exams many-to-many relationship table

Revision ID: b6c3d4e5f6g7
Revises: a5b2c3d4e5f6
Create Date: 2025-01-17 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b6c3d4e5f6g7'
down_revision = 'a5b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Crear tabla de relación muchos-a-muchos entre study_contents y exams
    op.create_table('study_material_exams',
        sa.Column('study_material_id', sa.Integer(), nullable=False),
        sa.Column('exam_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['study_material_id'], ['study_contents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('study_material_id', 'exam_id')
    )
    
    # Crear índices para mejorar rendimiento de búsquedas
    op.create_index('ix_study_material_exams_study_material_id', 'study_material_exams', ['study_material_id'])
    op.create_index('ix_study_material_exams_exam_id', 'study_material_exams', ['exam_id'])


def downgrade():
    op.drop_index('ix_study_material_exams_exam_id', table_name='study_material_exams')
    op.drop_index('ix_study_material_exams_study_material_id', table_name='study_material_exams')
    op.drop_table('study_material_exams')
