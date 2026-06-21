"""spa: assignee_id em sp_records + automation_rules em smart_processes

Revision ID: f1a2b3c4d5e6
Revises: 7bec009010b6
Create Date: 2026-06-21
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '7bec009010b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sp_records',
        sa.Column('assignee_id', sa.Integer(), nullable=True))
    op.add_column('smart_processes',
        sa.Column('automation_rules', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('sp_records', 'assignee_id')
    op.drop_column('smart_processes', 'automation_rules')
