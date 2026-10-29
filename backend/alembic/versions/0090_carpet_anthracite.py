"""Halı varsayılan rengi antrasit olur.

Revision ID: 0090_carpet_anthracite
Revises: 0089_parquet_reference

Ürün kararı (2026-10-29): halı varsayılan rengi antrasit (RAL 7016, #383e42).
Rengi kaydedilmiş projeler kendi `floorColor` değerini korur; yalnız varsayılan değişir.
Downgrade eski gri #8b8f94 değerine döner.
"""

import sqlalchemy as sa
from alembic import op


revision = "0090_carpet_anthracite"
down_revision = "0089_parquet_reference"
branch_labels = None
depends_on = None


_COLOR_SQL = "UPDATE fair_stand_items SET default_color = :color WHERE item_key = 'hali'"


def upgrade() -> None:
    op.get_bind().execute(sa.text(_COLOR_SQL), {"color": 0x383E42})


def downgrade() -> None:
    op.get_bind().execute(sa.text(_COLOR_SQL), {"color": 0x8B8F94})
