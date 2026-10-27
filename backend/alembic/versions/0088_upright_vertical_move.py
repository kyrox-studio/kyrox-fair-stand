"""Dikme sahnede ↑/↓ ile dikey taşınır (vertical_move).

Revision ID: 0088_upright_vertical_move
Revises: 0087_rotation_step_15

Ürün kararı (2026-10-27): 0076'da kapalı kalan dikme (item_type upright) de dikey taşınır.
Adım tip moveSnapCm (10 cm); taban 0, tepe stand tavanını geçmez. z_reference floor kalır.
Downgrade dikmeleri yeniden kapatır.
"""

import sqlalchemy as sa
from alembic import op


revision = "0088_upright_vertical_move"
down_revision = "0087_rotation_step_15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(sa.text("UPDATE fair_stand_items SET vertical_move = true WHERE item_type = 'upright'"))


def downgrade() -> None:
    op.get_bind().execute(sa.text("UPDATE fair_stand_items SET vertical_move = false WHERE item_type = 'upright'"))
