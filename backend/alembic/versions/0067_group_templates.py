"""Organization group templates (sahne editörü Faz 5).

Revision ID: 0067_group_templates
Revises: 0066_metal_separator_area

A template stores a group's parts (itemKey, size, relative placement, colour and
panel features) for one organization. It is not an Item and has no BOM of its own;
placing it creates normal modules. Images are not stored.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0067_group_templates"
down_revision = "0066_metal_separator_area"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fair_stand_group_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("member_count", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_fair_stand_group_templates"),
        sa.CheckConstraint("length(btrim(name)) > 0", name="ck_fair_stand_group_templates_name"),
        sa.CheckConstraint("member_count > 0", name="ck_fair_stand_group_templates_member_count"),
    )
    op.create_index(
        "ix_fair_stand_group_templates_organization_id_updated_at",
        "fair_stand_group_templates",
        ["organization_id", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_fair_stand_group_templates_organization_id_updated_at",
        table_name="fair_stand_group_templates",
    )
    op.drop_table("fair_stand_group_templates")
