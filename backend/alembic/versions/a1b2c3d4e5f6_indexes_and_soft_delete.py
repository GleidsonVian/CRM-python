"""indexes and soft delete

Revision ID: a1b2c3d4e5f6
Revises: ebb32388df81
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'ebb32388df81'
branch_labels = None
depends_on = None


def upgrade():
    # ── Soft delete columns ───────────────────────────────────────────────────
    with op.batch_alter_table('cards') as batch:
        batch.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))

    with op.batch_alter_table('leads') as batch:
        batch.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))

    # ── Indexes ───────────────────────────────────────────────────────────────
    op.create_index('ix_cards_stage_id',      'cards',      ['stage_id'])
    op.create_index('ix_leads_stage_id',      'leads',      ['stage_id'])
    op.create_index('ix_activities_card_id',  'activities', ['card_id'])
    op.create_index('ix_activities_lead_id',  'activities', ['lead_id'])
    op.create_index('ix_audit_logs_entity_id','audit_logs', ['entity_id'])


def downgrade():
    op.drop_index('ix_cards_stage_id',       'cards')
    op.drop_index('ix_leads_stage_id',       'leads')
    op.drop_index('ix_activities_card_id',   'activities')
    op.drop_index('ix_activities_lead_id',   'activities')
    op.drop_index('ix_audit_logs_entity_id', 'audit_logs')

    with op.batch_alter_table('cards') as batch:
        batch.drop_column('deleted_at')

    with op.batch_alter_table('leads') as batch:
        batch.drop_column('deleted_at')
