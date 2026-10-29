"""Parke renkleri ve beton plaka ölçüsü referans ürünlere eşitlenir.

Revision ID: 0089_parquet_reference
Revises: 0088_upright_vertical_move

Ürün kararı (2026-10-28): parkeler gerçek ürünlere göre görünür.
- parke-acik  → Floorpan Classic Kristal Meşe FC086, renk #c9cac5
- parke-sari  → Floorpan Classic Alaska Meşe FC066, renk #ad8e76
- parke-beton → Floorpan Stonex Gri Beton FT007, renk #6b6762 (ürün görselinin sahnede koyu görünen tonu), plaka 120,6 × 40,2 cm
Renk, ürün görselinin ortalama rengidir. Ahşap lamel ölçüsü ürün sayfasında yok; 140 × 16 kalır.
Downgrade seed değerlerine döner.
"""

import sqlalchemy as sa
from alembic import op


revision = "0089_parquet_reference"
down_revision = "0088_upright_vertical_move"
branch_labels = None
depends_on = None


_COLOR_SQL = "UPDATE fair_stand_items SET default_color = :color WHERE item_key = :item_key"
_DIMENSIONS_SQL = (
    "UPDATE fair_stand_item_dimensions SET width_cm = :width_cm, depth_cm = :depth_cm WHERE item_key = :item_key"
)


def _apply(colors: dict[str, int], beton_dimensions: tuple[float, float]) -> None:
    bind = op.get_bind()
    for item_key, color in colors.items():
        bind.execute(sa.text(_COLOR_SQL), {"color": color, "item_key": item_key})
    width_cm, depth_cm = beton_dimensions
    bind.execute(
        sa.text(_DIMENSIONS_SQL),
        {"width_cm": width_cm, "depth_cm": depth_cm, "item_key": "parke-beton"},
    )


def upgrade() -> None:
    _apply({"parke-acik": 0xC9CAC5, "parke-sari": 0xAD8E76, "parke-beton": 0x6B6762}, (120.6, 40.2))


def downgrade() -> None:
    _apply({"parke-acik": 0xE8DFD1, "parke-sari": 0xC4A480, "parke-beton": 0x625F58}, (112, 28))
