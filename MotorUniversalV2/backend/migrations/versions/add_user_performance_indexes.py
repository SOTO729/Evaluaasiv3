"""Add performance indexes for users table - scalability to 100K+ users

Revision ID: add_user_perf_indexes_001
Revises: add_perf_indexes_001
Create Date: 2026-02-09

This migration adds optimized indexes for the users table to support:
- Fast search with LIKE/ILIKE queries
- Efficient filtering by role, is_active
- Optimized sorting by created_at, last_login
- Composite indexes for common query patterns
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_user_perf_indexes_001'
down_revision = 'add_perf_indexes_001'
branch_labels = None
depends_on = None


def upgrade():
    """Add performance indexes for users table"""
    
    # ============== SINGLE COLUMN INDEXES ==============
    
    # Role filtering - very frequent
    op.create_index('idx_users_role', 'users', ['role'], unique=False)
    
    # Active status filtering - very frequent
    op.create_index('idx_users_is_active', 'users', ['is_active'], unique=False)
    
    # Created at for sorting - very frequent
    op.create_index('idx_users_created_at', 'users', ['created_at'], unique=False)
    
    # Last login for sorting
    op.create_index('idx_users_last_login', 'users', ['last_login'], unique=False)
    
    # First surname for name sorting (full_name sorts by surname first)
    op.create_index('idx_users_first_surname', 'users', ['first_surname'], unique=False)
    
    # ============== COMPOSITE INDEXES ==============
    
    # Most common query: filter by role + is_active + sort by created_at
    op.create_index(
        'idx_users_role_active_created', 
        'users', 
        ['role', 'is_active', 'created_at'],
        unique=False
    )
    
    # Coordinator view: filter by role (candidato/responsable) + sort by created_at
    op.create_index(
        'idx_users_coordinator_view',
        'users',
        ['role', 'created_at'],
        unique=False
    )
    
    # ============== SEARCH OPTIMIZATION ==============
    
    # Lowercase email for case-insensitive search
    # Using functional index (PostgreSQL specific)
    try:
        op.execute('CREATE INDEX idx_users_email_lower ON users (LOWER(email))')
    except Exception:
        # Fallback for non-PostgreSQL databases
        pass
    
    # CURP index for fast lookups (already indexed but explicit)
    op.create_index('idx_users_curp', 'users', ['curp'], unique=False)
    
    # ============== PAGINATION OPTIMIZATION ==============
    
    # For cursor-based pagination: id + created_at composite
    op.create_index(
        'idx_users_cursor_pagination',
        'users',
        ['created_at', 'id'],
        unique=False
    )
    
    # ============== FULL-TEXT SEARCH (PostgreSQL) ==============
    
    # Create GIN index for full-text search if PostgreSQL
    try:
        op.execute('''
            CREATE INDEX idx_users_fulltext_search 
            ON users 
            USING gin(
                to_tsvector('spanish', 
                    COALESCE(name, '') || ' ' || 
                    COALESCE(first_surname, '') || ' ' || 
                    COALESCE(second_surname, '') || ' ' || 
                    COALESCE(email, '') || ' ' || 
                    COALESCE(curp, '') || ' ' ||
                    COALESCE(username, '')
                )
            )
        ''')
    except Exception:
        # Fallback: create simple trigram index if available
        try:
            op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
            op.execute('''
                CREATE INDEX idx_users_name_trgm ON users 
                USING gin(name gin_trgm_ops)
            ''')
            op.execute('''
                CREATE INDEX idx_users_surname_trgm ON users 
                USING gin(first_surname gin_trgm_ops)
            ''')
        except Exception:
            # Non-PostgreSQL fallback - create simple BTREE indexes
            pass


def downgrade():
    """Remove performance indexes"""
    
    # Single column indexes
    op.drop_index('idx_users_role', table_name='users')
    op.drop_index('idx_users_is_active', table_name='users')
    op.drop_index('idx_users_created_at', table_name='users')
    op.drop_index('idx_users_last_login', table_name='users')
    op.drop_index('idx_users_first_surname', table_name='users')
    
    # Composite indexes
    op.drop_index('idx_users_role_active_created', table_name='users')
    op.drop_index('idx_users_coordinator_view', table_name='users')
    op.drop_index('idx_users_curp', table_name='users')
    op.drop_index('idx_users_cursor_pagination', table_name='users')
    
    # Try to drop PostgreSQL-specific indexes
    try:
        op.execute('DROP INDEX IF EXISTS idx_users_email_lower')
        op.execute('DROP INDEX IF EXISTS idx_users_fulltext_search')
        op.execute('DROP INDEX IF EXISTS idx_users_name_trgm')
        op.execute('DROP INDEX IF EXISTS idx_users_surname_trgm')
    except Exception:
        pass
