"""add smart_processes, sp_records, sp_record_links

Revision ID: 7bec009010b6
Revises: c3d4e5f6a1b2
Create Date: 2026-06-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '7bec009010b6'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a1b2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'smart_processes',
        sa.Column('id',            sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name',          sa.String(),  nullable=False),
        sa.Column('icon',          sa.String(),  nullable=True,  default='📋'),
        sa.Column('color',         sa.String(),  nullable=True,  default='#6366f1'),
        sa.Column('description',   sa.String(),  nullable=True,  default=''),
        sa.Column('fields_config', sa.JSON(),    nullable=True),
        sa.Column('stages',        sa.JSON(),    nullable=True),
        sa.Column('created_at',    sa.DateTime(),nullable=True),
    )
    op.create_table(
        'sp_records',
        sa.Column('id',          sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('process_id',  sa.Integer(), sa.ForeignKey('smart_processes.id', ondelete='CASCADE')),
        sa.Column('title',       sa.String(),  nullable=False),
        sa.Column('stage_index', sa.Integer(), nullable=True, default=0),
        sa.Column('data',        sa.JSON(),    nullable=True),
        sa.Column('created_at',  sa.DateTime(),nullable=True),
        sa.Column('updated_at',  sa.DateTime(),nullable=True),
    )
    op.create_table(
        'sp_record_links',
        sa.Column('id',          sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('record_id',   sa.Integer(), sa.ForeignKey('sp_records.id', ondelete='CASCADE')),
        sa.Column('entity_type', sa.String(),  nullable=True),
        sa.Column('entity_id',   sa.Integer(), nullable=True),
        sa.Column('created_at',  sa.DateTime(),nullable=True),
    )


def downgrade() -> None:
    op.drop_table('sp_record_links')
    op.drop_table('sp_records')
    op.drop_table('smart_processes')
