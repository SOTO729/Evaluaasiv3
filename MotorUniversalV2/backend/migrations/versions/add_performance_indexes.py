"""Add performance indexes for scalability

Revision ID: add_perf_indexes_001
Revises: 
Create Date: 2026-01-20

This migration adds indexes to frequently queried columns to improve
query performance at scale.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_perf_indexes_001'
down_revision = None  # Will be set automatically
branch_labels = None
depends_on = None


def upgrade():
    """Add performance indexes"""
    
    # Indexes for results table - heavily queried
    op.create_index('idx_results_user_id', 'results', ['user_id'], unique=False)
    op.create_index('idx_results_exam_id', 'results', ['exam_id'], unique=False)
    op.create_index('idx_results_competency_standard_id', 'results', ['competency_standard_id'], unique=False)
    op.create_index('idx_results_status', 'results', ['status'], unique=False)
    op.create_index('idx_results_created_at', 'results', ['created_at'], unique=False)
    # Composite index for common query patterns
    op.create_index('idx_results_user_exam', 'results', ['user_id', 'exam_id'], unique=False)
    
    # Indexes for categories table
    op.create_index('idx_categories_exam_id', 'categories', ['exam_id'], unique=False)
    
    # Indexes for topics table
    op.create_index('idx_topics_category_id', 'topics', ['category_id'], unique=False)
    
    # Indexes for questions table
    op.create_index('idx_questions_topic_id', 'questions', ['topic_id'], unique=False)
    op.create_index('idx_questions_type', 'questions', ['type'], unique=False)
    
    # Indexes for answers table
    op.create_index('idx_answers_question_id', 'answers', ['question_id'], unique=False)
    
    # Indexes for exercises table
    op.create_index('idx_exercises_topic_id', 'exercises', ['topic_id'], unique=False)
    op.create_index('idx_exercises_type', 'exercises', ['type'], unique=False)
    
    # Indexes for exams table
    op.create_index('idx_exams_is_published', 'exams', ['is_published'], unique=False)
    op.create_index('idx_exams_is_active', 'exams', ['is_active'], unique=False)
    op.create_index('idx_exams_competency_standard_id', 'exams', ['competency_standard_id'], unique=False)
    
    # Indexes for study_contents table
    op.create_index('idx_study_contents_exam_id', 'study_contents', ['exam_id'], unique=False)
    op.create_index('idx_study_contents_is_published', 'study_contents', ['is_published'], unique=False)


def downgrade():
    """Remove performance indexes"""
    
    # Results indexes
    op.drop_index('idx_results_user_id', table_name='results')
    op.drop_index('idx_results_exam_id', table_name='results')
    op.drop_index('idx_results_competency_standard_id', table_name='results')
    op.drop_index('idx_results_status', table_name='results')
    op.drop_index('idx_results_created_at', table_name='results')
    op.drop_index('idx_results_user_exam', table_name='results')
    
    # Categories indexes
    op.drop_index('idx_categories_exam_id', table_name='categories')
    
    # Topics indexes
    op.drop_index('idx_topics_category_id', table_name='topics')
    
    # Questions indexes
    op.drop_index('idx_questions_topic_id', table_name='questions')
    op.drop_index('idx_questions_type', table_name='questions')
    
    # Answers indexes
    op.drop_index('idx_answers_question_id', table_name='answers')
    
    # Exercises indexes
    op.drop_index('idx_exercises_topic_id', table_name='exercises')
    op.drop_index('idx_exercises_type', table_name='exercises')
    
    # Exams indexes
    op.drop_index('idx_exams_is_published', table_name='exams')
    op.drop_index('idx_exams_is_active', table_name='exams')
    op.drop_index('idx_exams_competency_standard_id', table_name='exams')
    
    # Study contents indexes
    op.drop_index('idx_study_contents_exam_id', table_name='study_contents')
    op.drop_index('idx_study_contents_is_published', table_name='study_contents')
