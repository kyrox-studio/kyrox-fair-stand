"""Banko, Köşe Banko ve Baza: tek katalog kartı; ölçü bırakırken sorulur (Panel düzeni).

Revision ID: 0083_banko_base_cards
Revises: 0082_panel_separator_cards

Ürün kararı (2026-10-24): banko (200 / 150 / 100), köşe banko (200 / 150 / 100) ve baza
(200 / 150 / 100) katalogda Panel gibi tek kartla gelir; sahneye konurken ölçü sorulur.

- Aileler `variant` ile işaretlenir: `desk-banko`, `desk-banko-l`, `base`.
- Kart `desk_banko_100` ("Banko"), `desk_banko_100_l` ("Köşe Banko"), `base_100` ("Baza") görünür
  kalır (sürükleme önizlemesi ve varsayılan ölçü 100); 200 ve 150 katalogda gizlenir.
- Item'lar, item_key, ad ve BOM reçeteleri değişmez (kayıtlı projeler aynı kalır).
- Kategorinin görünür Item sırası boşluksuz 1…n olur (mevcut sıra korunur).
Downgrade variant'ı boşaltır; gizlenen altı Item 0082 sırası ve önizlemesiyle kategoriye döner.
"""

import sqlalchemy as sa
from alembic import op


revision = "0083_banko_base_cards"
down_revision = "0082_panel_separator_cards"
branch_labels = None
depends_on = None

# item_key → variant
_VARIANTS = {
    **{f"desk_banko_{width}": "desk-banko" for width in (200, 150, 100)},
    **{f"desk_banko_{width}_l": "desk-banko-l" for width in (200, 150, 100)},
    **{f"base_{width}": "base" for width in (200, 150, 100)},
}
_CARDS = ("desk_banko_100", "desk_banko_100_l", "base_100")
# Downgrade: 0082 sonundaki kategori içi sıra.
_PREVIOUS_ORDER = (
    "desk_banko_200", "desk_banko_150", "desk_banko_100",
    "desk_banko_200_l", "desk_banko_150_l", "desk_banko_100_l",
    "base_200", "base_150", "base_100",
)
# Gizlenen Item'ın önizlemesi kendi ailesinin kartından geri yazılır.
_PREVIEW_SOURCE = {
    "desk_banko_200": "desk_banko_100", "desk_banko_150": "desk_banko_100",
    "desk_banko_200_l": "desk_banko_100_l", "desk_banko_150_l": "desk_banko_100_l",
    "base_200": "base_100", "base_150": "base_100",
}


def _compact(bind, category_id, leading=()) -> None:
    """Kategorideki görünür Item sırası boşluksuz 1…n; `leading` görünürse başa alınır.

    Görünür sıra tekildir (uq_fair_stand_items_catalog_order): önce geçici aralığa taşınır.
    """
    rows = bind.execute(
        sa.text(
            "SELECT item_key FROM fair_stand_items WHERE category_id = :c AND catalog_visible "
            "ORDER BY catalog_item_index, item_key"
        ),
        {"c": category_id},
    ).scalars().all()
    ordered = [key for key in leading if key in rows] + [key for key in rows if key not in leading]
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET catalog_item_index = catalog_item_index + 100000 "
            "WHERE category_id = :c AND catalog_visible"
        ),
        {"c": category_id},
    )
    for index, item_key in enumerate(ordered, start=1):
        bind.execute(
            sa.text("UPDATE fair_stand_items SET catalog_item_index = :i WHERE item_key = :k"),
            {"i": index, "k": item_key},
        )


def upgrade() -> None:
    bind = op.get_bind()
    for item_key, variant in _VARIANTS.items():
        bind.execute(
            sa.text("UPDATE fair_stand_items SET variant = :v WHERE item_key = :k"),
            {"v": variant, "k": item_key},
        )
    categories = set(
        bind.execute(
            sa.text("SELECT category_id FROM fair_stand_items WHERE item_key IN :keys AND category_id IS NOT NULL")
            .bindparams(sa.bindparam("keys", expanding=True)),
            {"keys": list(_VARIANTS)},
        ).scalars().all()
    )
    hidden = [key for key in _VARIANTS if key not in _CARDS]
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET catalog_visible = false, category_id = NULL, "
            "catalog_item_index = NULL, preview_id = NULL WHERE item_key IN :keys"
        ).bindparams(sa.bindparam("keys", expanding=True)),
        {"keys": hidden},
    )
    for category_id in categories:
        _compact(bind, category_id)


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("UPDATE fair_stand_items SET variant = NULL WHERE item_key IN :keys")
        .bindparams(sa.bindparam("keys", expanding=True)),
        {"keys": list(_VARIANTS)},
    )
    reference = bind.execute(
        sa.text(
            "SELECT category_id FROM fair_stand_items WHERE item_key IN :keys "
            "AND catalog_visible AND category_id IS NOT NULL ORDER BY item_key LIMIT 1"
        ).bindparams(sa.bindparam("keys", expanding=True)),
        {"keys": list(_CARDS)},
    ).first()
    if reference is None:
        return
    category_id = reference[0]
    for offset, item_key in enumerate(_PREVIOUS_ORDER, start=1):
        preview = bind.execute(
            sa.text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"),
            {"k": _PREVIEW_SOURCE.get(item_key, item_key)},
        ).scalar()
        if preview is None:
            continue
        bind.execute(
            sa.text(
                "UPDATE fair_stand_items SET catalog_visible = true, category_id = :c, preview_id = :p, "
                "catalog_item_index = :i WHERE item_key = :k"
            ),
            {"c": category_id, "p": preview, "i": 200000 + offset, "k": item_key},
        )
    _compact(bind, category_id, leading=_PREVIOUS_ORDER)
