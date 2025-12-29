"""Add study contents tables

Revision ID: a5b2c3d4e5f6
Revises: e07f122af0eb
Create Date: 2025-12-29 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a5b2c3d4e5f6'
down_revision = 'e07f122af0eb'
branch_labels = None
depends_on = None


def upgrade():
    # Crear tabla de contenidos de estudio
    op.create_table('study_contents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=False, default=False),
        sa.Column('order', sa.Integer(), nullable=True, default=0),
        sa.Column('exam_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_by', sa.String(length=36), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Crear tabla de lecturas
    op.create_table('study_readings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('study_content_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True, default=0),
        sa.Column('estimated_time_minutes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['study_content_id'], ['study_contents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Crear tabla de videos
    op.create_table('study_videos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('study_content_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('video_url', sa.Text(), nullable=False),
        sa.Column('video_type', sa.String(length=50), nullable=True, default='youtube'),
        sa.Column('thumbnail_url', sa.Text(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['study_content_id'], ['study_contents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Crear tabla de ejercicios descargables
    op.create_table('study_downloadable_exercises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('study_content_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('file_url', sa.Text(), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=True),
        sa.Column('file_type', sa.String(length=50), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['study_content_id'], ['study_contents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Crear tabla de ejercicios interactivos
    op.create_table('study_interactive_exercises',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('study_content_id', sa.Integer(), nullable=False),
        sa.Column('exercise_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_by', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_by', sa.String(length=36), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['study_content_id'], ['study_contents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Crear tabla de pasos de ejercicios interactivos
    op.create_table('study_interactive_exercise_steps',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('exercise_id', sa.String(length=36), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('image_width', sa.Integer(), nullable=True),
        sa.Column('image_height', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['exercise_id'], ['study_interactive_exercises.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Crear tabla de acciones de ejercicios interactivos
    op.create_table('study_interactive_exercise_actions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('step_id', sa.String(length=36), nullable=False),
        sa.Column('action_number', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.String(length=20), nullable=False),
        sa.Column('position_x', sa.Float(), nullable=False),
        sa.Column('position_y', sa.Float(), nullable=False),
        sa.Column('width', sa.Float(), nullable=False),
        sa.Column('height', sa.Float(), nullable=False),
        sa.Column('label', sa.String(length=255), nullable=True),
        sa.Column('placeholder', sa.String(length=255), nullable=True),
        sa.Column('correct_answer', sa.Text(), nullable=True),
        sa.Column('is_case_sensitive', sa.Boolean(), nullable=True, default=False),
        sa.Column('scoring_mode', sa.String(length=20), nullable=True, default='exact'),
        sa.Column('on_error_action', sa.String(length=20), nullable=True, default='next_step'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('max_attempts', sa.Integer(), nullable=True, default=3),
        sa.Column('text_color', sa.String(length=20), nullable=True, default='#000000'),
        sa.Column('font_family', sa.String(length=50), nullable=True, default='Arial'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['step_id'], ['study_interactive_exercise_steps.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('study_interactive_exercise_actions')
    op.drop_table('study_interactive_exercise_steps')
    op.drop_table('study_interactive_exercises')
    op.drop_table('study_downloadable_exercises')
    op.drop_table('study_videos')
    op.drop_table('study_readings')
    op.drop_table('study_contents')
