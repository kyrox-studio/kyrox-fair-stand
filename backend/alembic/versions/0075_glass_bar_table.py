"""Bar masası: cam masa ailesinin 108 cm yüksek ürünü.

Revision ID: 0075_glass_bar_table
Revises: 0074_showcase_brochure

Ürün kararı (2026-10-22): "Bar Masası" (glass_bar_table) tekli cam masa ile aynıdır
(tür table-glass, 75 × 75 cm cam tabla, aynı ayak ve taban); yalnız yükseklik 108 cm.
Satır glass_table kaydından kopyalanır (birim, maliyet bayrağı, önizleme, dönüş ve
yüzey bayrakları dahil); ad, katalog sırası ve yükseklik değişir. Extra kategorisinin
sonuna eklenir. Var olan satır olduğu gibi bırakılır; downgrade yalnız bu satırı siler.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op


revision = "0075_glass_bar_table"
down_revision = "0074_showcase_brochure"
branch_labels = None
depends_on = None

_SOURCE = "glass_table"
_ITEM_KEY = "glass_bar_table"
_NAME = "Bar Masası"
_HEIGHT_CM = 108
_OVERRIDDEN = {"item_key", "name", "catalog_item_index", "created_at", "updated_at"}


def upgrade() -> None:
    bind = op.get_bind()
    if bind.execute(sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :k"), {"k": _ITEM_KEY}).scalar():
        return
    source = bind.execute(
        sa.text("SELECT category_id FROM fair_stand_items WHERE item_key = :k"), {"k": _SOURCE}
    ).first()
    if source is None:
        return
    next_index = bind.execute(
        sa.text("SELECT COALESCE(MAX(catalog_item_index), 0) + 1 FROM fair_stand_items WHERE category_id = :c"),
        {"c": source[0]},
    ).scalar_one()
    copied = [
        column["name"]
        for column in sa.inspect(bind).get_columns("fair_stand_items")
        if column["name"] not in _OVERRIDDEN
    ]
    columns = ", ".join(copied)
    now = datetime.now(tz=UTC)
    bind.execute(
        sa.text(
            f"INSERT INTO fair_stand_items (item_key, name, catalog_item_index, created_at, updated_at, {columns}) "
            f"SELECT :key, :name, :index, :now, :now, {columns} FROM fair_stand_items WHERE item_key = :source"
        ),
        {"key": _ITEM_KEY, "name": _NAME, "index": next_index, "now": now, "source": _SOURCE},
    )
    bind.execute(
        sa.text(
            "INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm, height_cm) "
            "SELECT :key, width_cm, depth_cm, :height FROM fair_stand_item_dimensions WHERE item_key = :source"
        ),
        {"key": _ITEM_KEY, "height": _HEIGHT_CM, "source": _SOURCE},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM fair_stand_item_dimensions WHERE item_key = :k"), {"k": _ITEM_KEY})
    bind.execute(sa.text("DELETE FROM fair_stand_items WHERE item_key = :k"), {"k": _ITEM_KEY})
