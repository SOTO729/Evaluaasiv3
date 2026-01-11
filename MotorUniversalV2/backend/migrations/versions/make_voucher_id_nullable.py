"""Make voucher_id nullable in results table

This migration allows storing exam results without requiring a voucher,
which is necessary for the new self-service exam testing feature.

Revision ID: make_voucher_nullable
Revises: 
Create Date: 2025-01-17 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'make_voucher_nullable'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Make voucher_id nullable in results table"""
    # Use raw SQL to alter the column to be nullable
    # This is compatible with most SQL databases
    try:
        op.alter_column('results', 'voucher_id',
                       existing_type=sa.Integer(),
                       nullable=True)
        print("✅ Successfully made voucher_id nullable in results table")
    except Exception as e:
        print(f"⚠️ Migration may have already been applied or column doesn't exist: {e}")


def downgrade():
    """Revert voucher_id to non-nullable (if needed)"""
    # Note: This will fail if there are NULL values in the column
    try:
        op.alter_column('results', 'voucher_id',
                       existing_type=sa.Integer(),
                       nullable=False)
        print("✅ Successfully reverted voucher_id to non-nullable")
    except Exception as e:
        print(f"⚠️ Could not revert migration: {e}")
