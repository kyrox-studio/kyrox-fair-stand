"""Işıklı Strafor katalog kartı: sahneye katalogdan konur, logo görseli panelden seçilir.

Revision ID: 0084_illuminated_foam_card
Revises: 0083_banko_base_cards

Ürün kararı (2026-10-24): Işıklı Strafor (`illuminated-foam`) arşivdeki SVG'nin sürüklenmesiyle
değil, katalogdan sahneye konarak eklenir; logo görseli Özellikler panelinin görsel bölümünden
(diğer öğelerdeki gibi) seçilir.

- `illuminated-foam` görünür kart olur: Elektronik & Aydınlatma kategorisinin sonuna eklenir,
  önizleme düz panel önizlemesidir (son tasarımda kendi ikonu verilebilir).
- `accepts_image` açılır: panelin görsel bölümü straforda görünür (logo SVG).
- Item, item_key, ölçü, birim ve üretim satırı değişmez; kayıtlı projeler aynı kalır.
Downgrade kartı gizler ve görsel kabulünü kapatır; kategori sırası boşluksuz kalır.
"""

import sqlalchemy as sa
from alembic import op


revision = "0084_illuminated_foam_card"
down_revision = "0083_banko_base_cards"
branch_labels = None
depends_on = None

_ITEM_KEY = "illuminated-foam"
# Kategori ve önizleme kaynağı: mevcut görünür Item'lardan okunur (DB kimlikleri sabit değildir).
_CATEGORY_SOURCE = "led_floodlight"
_PREVIEW_SOURCE = "wall_100_350"


def _compact(bind, category_id) -> None:
    """Kategorideki görünür Item sırası boşluksuz 1…n (mevcut sıra korunur)."""
    rows = bind.execute(
        sa.text(
            "SELECT item_key FROM fair_stand_items WHERE category_id = :c AND catalog_visible "
            "ORDER BY catalog_item_index, item_key"
        ),
        {"c": category_id},
    ).scalars().all()
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET catalog_item_index = catalog_item_index + 100000 "
            "WHERE category_id = :c AND catalog_visible"
        ),
        {"c": category_id},
    )
    for index, item_key in enumerate(rows, start=1):
        bind.execute(
            sa.text("UPDATE fair_stand_items SET catalog_item_index = :i WHERE item_key = :k"),
            {"i": index, "k": item_key},
        )


def upgrade() -> None:
    bind = op.get_bind()
    current = bind.execute(
        sa.text("SELECT catalog_visible FROM fair_stand_items WHERE item_key = :k"), {"k": _ITEM_KEY}
    ).first()
    if current is None:
        return
    category_id = bind.execute(
        sa.text("SELECT category_id FROM fair_stand_items WHERE item_key = :k"), {"k": _CATEGORY_SOURCE}
    ).scalar()
    preview_id = bind.execute(
        sa.text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"), {"k": _PREVIEW_SOURCE}
    ).scalar()
    if category_id is None or preview_id is None:
        return
    bind.execute(
        sa.text("UPDATE fair_stand_items SET accepts_image = true WHERE item_key = :k"), {"k": _ITEM_KEY}
    )
    if not current[0]:
        last = bind.execute(
            sa.text(
                "SELECT COALESCE(MAX(catalog_item_index), 0) FROM fair_stand_items "
                "WHERE category_id = :c AND catalog_visible"
            ),
            {"c": category_id},
        ).scalar_one()
        bind.execute(
            sa.text(
                "UPDATE fair_stand_items SET catalog_visible = true, category_id = :c, preview_id = :p, "
                "catalog_item_index = :i WHERE item_key = :k"
            ),
            {"c": category_id, "p": preview_id, "i": last + 1, "k": _ITEM_KEY},
        )
    _compact(bind, category_id)


def downgrade() -> None:
    bind = op.get_bind()
    category_id = bind.execute(
        sa.text("SELECT category_id FROM fair_stand_items WHERE item_key = :k"), {"k": _ITEM_KEY}
    ).scalar()
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET catalog_visible = false, category_id = NULL, catalog_item_index = NULL, "
            "preview_id = NULL, accepts_image = false WHERE item_key = :k"
        ),
        {"k": _ITEM_KEY},
    )
    if category_id is not None:
        _compact(bind, category_id)
