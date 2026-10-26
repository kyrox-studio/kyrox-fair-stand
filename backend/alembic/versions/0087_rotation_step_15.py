"""Use 15 degree keyboard steps; preserve previous values for downgrade.

Only populated catalog rotation steps change. Default orientations, leaf rows
and saved project placements are untouched.
"""
import sqlalchemy as sa
from alembic import op

revision = "0087_rotation_step_15"
down_revision = "0086_variant_family_cards"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "fair_stand_rotation_step_0087_backup",
        sa.Column("item_key", sa.String(128), primary_key=True),
        sa.Column("rotation_step_deg", sa.Numeric(8, 2), nullable=False),
    )
    bind = op.get_bind()
    bind.execute(sa.text(
        "INSERT INTO fair_stand_rotation_step_0087_backup (item_key, rotation_step_deg) "
        "SELECT item_key, rotation_step_deg FROM fair_stand_items WHERE rotation_step_deg IS NOT NULL"
    ))
    bind.execute(sa.text("UPDATE fair_stand_items SET rotation_step_deg=15 WHERE rotation_step_deg IS NOT NULL"))


def downgrade():
    bind = op.get_bind()
    bind.execute(sa.text(
        "UPDATE fair_stand_items SET rotation_step_deg=(SELECT b.rotation_step_deg "
        "FROM fair_stand_rotation_step_0087_backup b WHERE b.item_key=fair_stand_items.item_key) "
        "WHERE rotation_step_deg=15 AND item_key IN (SELECT item_key FROM fair_stand_rotation_step_0087_backup)"
    ))
    op.drop_table("fair_stand_rotation_step_0087_backup")
