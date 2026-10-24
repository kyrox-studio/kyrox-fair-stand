"""Panel ve Separatör: tek katalog kartı; genişlik bırakırken sorulur (kısa panel düzeni).

Revision ID: 0082_panel_separator_cards
Revises: 0081_profile_346_5

Ürün kararı (2026-10-24): duvar paneli (50 / 100 / 150 / 200) ve separatör (50 / 100) katalogda
kısa panel gibi tek kartla gelir; bırakırken genişlik sorulur. Separatör penceresinde "Sarmaşıklı"
çentiği seçilirse aynı genişliğin sarmaşıklı separatörü bırakılır.

- Aileler `variant` ile işaretlenir: `wall-panel` (wall_50/100/150/200_350), `wall-separator`
  (wall_separator_50/100_350), `wall-separator-sarmasik` (iki sarmaşıklı separatör).
- Kart `wall_100_350` ("Panel 100", kart başlığı "Panel") ve `wall_separator_100_350`
  ("Separatör 100", kart başlığı "Separatör") görünür kalır; diğerleri katalogda gizlenir
  (katalog alanları boşaltılır).
- Item'lar, item_key, ad ve BOM reçeteleri değişmez (kayıtlı projeler aynı kalır).
- Kategorinin görünür Item sırası boşluksuz 1…n olur (mevcut sıra korunur).
Downgrade variant'ı boşaltır; gizlenen altı Item 0081 sırasıyla kategoriye döner.
"""

import sqlalchemy as sa
from alembic import op


revision = "0082_panel_separator_cards"
down_revision = "0081_profile_346_5"
branch_labels = None
depends_on = None

# item_key → variant
_VARIANTS = {
    **{f"wall_{width}_350": "wall-panel" for width in (50, 100, 150, 200)},
    "wall_separator_50_350": "wall-separator",
    "wall_separator_100_350": "wall-separator",
    "wall_separator_50_350_sarmasik": "wall-separator-sarmasik",
    "wall_separator_100_350_sarmasik": "wall-separator-sarmasik",
}
_CARDS = ("wall_100_350", "wall_separator_100_350")
# Downgrade: 0081 sonundaki kategori içi sıra (yalnız bu Item'lar ve kapı).
_PREVIOUS_ORDER = (
    "wall_200_350", "wall_150_350", "wall_100_350", "wall_50_350",
    "wall_separator_100_350", "wall_separator_50_350",
    "wall_separator_100_350_sarmasik", "wall_separator_50_350_sarmasik",
)
# Gizlenen Item'ın önizlemesi (downgrade geri yazar).
_PREVIOUS_PREVIEW_SOURCE = {
    "wall_200_350": "wall_100_350",
    "wall_150_350": "wall_100_350",
    "wall_50_350": "wall_100_350",
    "wall_separator_50_350": "wall_separator_100_350",
}
_SARMASIK_PREVIEW = 19


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
        source = _PREVIOUS_PREVIEW_SOURCE.get(item_key, item_key)
        preview = bind.execute(
            sa.text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"), {"k": source}
        ).scalar()
        if preview is None and item_key.endswith("_sarmasik"):
            preview = _SARMASIK_PREVIEW
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
