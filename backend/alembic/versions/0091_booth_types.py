"""Stand tipleri ve Item eşlemesi.

Revision ID: 0091_booth_types
Revises: 0090_carpet_anthracite

Ürün kararı (2026-11-05): üç stand tipi (Maksima aktif; Özel Tasarım ve Paket pasif). Bir Item
birden çok tipte olabilir; satırı yoksa (null) bütün tiplerde görünür. Extra ile Elektronik &
Aydınlatma null kalır, katalogda görünen diğer Item'lar Maksima olur, görünmeyenler etiketlenmez.
"""

import sqlalchemy as sa
from alembic import op

from app.modules.fair_stand.infrastructure.booth_type_seed import (
    ALL_BOOTH_TYPES_CATEGORY_NAMES,
    BOOTH_TYPE_ROWS,
    DEFAULT_BOOTH_TYPE_KEY,
)


revision = "0091_booth_types"
down_revision = "0090_carpet_anthracite"
branch_labels = None
depends_on = None


def upgrade() -> None:
    booth_types = op.create_table(
        "fair_stand_booth_types",
        sa.Column("booth_type_key", sa.String(32), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_index", sa.Integer(), nullable=False),
    )
    op.create_table(
        "fair_stand_item_booth_types",
        sa.Column(
            "item_key",
            sa.String(128),
            sa.ForeignKey("fair_stand_items.item_key", ondelete="CASCADE", onupdate="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "booth_type_key",
            sa.String(32),
            sa.ForeignKey("fair_stand_booth_types.booth_type_key", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )
    op.bulk_insert(booth_types, list(BOOTH_TYPE_ROWS))
    op.get_bind().execute(
        sa.text(
            "INSERT INTO fair_stand_item_booth_types (item_key, booth_type_key) "
            "SELECT i.item_key, :booth_type_key FROM fair_stand_items i "
            "JOIN fair_stand_categories c ON c.id = i.category_id "
            "WHERE i.catalog_visible AND c.catalog_name NOT IN :names"
        ).bindparams(sa.bindparam("names", expanding=True)),
        {"booth_type_key": DEFAULT_BOOTH_TYPE_KEY, "names": list(ALL_BOOTH_TYPES_CATEGORY_NAMES)},
    )


def downgrade() -> None:
    op.drop_table("fair_stand_item_booth_types")
    op.drop_table("fair_stand_booth_types")
