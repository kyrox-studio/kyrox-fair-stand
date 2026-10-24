"""Vitrin, Raf, TV, Video Wall ve Uzun Saksı: tek katalog kartı; varyant Özellikler panelinde seçilir.

Revision ID: 0086_variant_family_cards
Revises: 0085_showcase_body_color

Ürün kararı (2026-10-24):
- Duvar vitrini (2 / 3 göz) tek kart olur ve Panel & Duvar altında görünür (kart 3 göz).
- Ayaklı Vitrin Banko & Baza altına taşınır.
- Raf (tekli / 2 sıralı / 3 sıralı) tek kart olur (kart tekli raf; genişlik duvardan gelir).
- TV (42 / 55 / 65 ve admin kaynaklı 85) ve Video Wall (2×2 / 3×3) ayrı birer kart olur (kartlar TV 42,
  Video Wall 2×2). `tv_85` tohum verisinde yoktur; ortamda varsa aileye katılır, yoksa satır etkilenmez.
- Uzun Saksı (100 / 150 / 200) tek kart olur (kart 100).

- Aileler `variant` ile işaretlenir: `wall-showcase`, `shelf-row`, `tv`, `video-wall`, `long-planter`.
- Kart dışındaki üyeler katalogda gizlenir (katalog alanları boşaltılır).
- Item'lar, item_key, ad ve BOM reçeteleri değişmez (kayıtlı projeler aynı kalır).
- Etkilenen kategorilerin görünür Item sırası boşluksuz 1…n olur (mevcut sıra korunur; taşınan kart sona).
Downgrade variant'ı boşaltır; Item'lar 0085 kategorisi, sırası ve önizlemesiyle geri döner.
"""

import sqlalchemy as sa
from alembic import op


revision = "0086_variant_family_cards"
down_revision = "0085_showcase_body_color"
branch_labels = None
depends_on = None

# item_key → variant
_VARIANTS = {
    "wall_showcase_100_2_350": "wall-showcase",
    "wall_showcase_100_3_350": "wall-showcase",
    "shelf_row_1": "shelf-row",
    "shelf_row_2": "shelf-row",
    "shelf_row_3": "shelf-row",
    "tv_42": "tv",
    "tv_55": "tv",
    "tv_65": "tv",
    "tv_85": "tv",
    "video_wall_2x2": "video-wall",
    "video_wall_3x3": "video-wall",
    "extra_long_planter_100": "long-planter",
    "extra_long_planter_150": "long-planter",
    "extra_long_planter_200": "long-planter",
}
_CARDS = ("wall_showcase_100_3_350", "shelf_row_1", "tv_42", "video_wall_2x2", "extra_long_planter_100")
# Kart → hedef kategoriyi veren Item (kategori kimliği ortama göre değişir).
_MOVES = {
    "wall_showcase_100_3_350": "wall_100_350",  # Panel & Duvar
    "floor_showcase_100": "desk_banko_100",  # Banko & Baza
}
# Downgrade: 0085 sonundaki kategori ve kategori içi sıra (kaynak kategoriyi veren Item → sıra).
_PREVIOUS_ORDER = {
    "shelf_row_1": (
        "wall_showcase_100_3_350", "wall_showcase_100_2_350",
        "shelf_row_1", "shelf_row_2", "shelf_row_3", "floor_showcase_100",
    ),
    "tv_42": ("tv_42", "tv_55", "video_wall_2x2", "video_wall_3x3", "tv_65", "tv_85"),
    # Saksılar Extra'nın ortasındaydı: önceki kartlar da sırayı sabitlemek için yazılır.
    "extra_long_planter_100": (
        "furniture_sofa_set_classic", "furniture_sofa_single_classic", "furniture_sofa_double_classic",
        "furniture_coffee_table_classic", "furniture_table_chair_set_eames", "chair_eames", "glass_table",
        "furniture_bar_stool_classic", "mini_fridge_avanti", "kettle", "coat_rack", "plastic_trash_bin",
        "extra_indoor_plant_1",
        "extra_long_planter_100", "extra_long_planter_150", "extra_long_planter_200",
    ),
}
# Gizlenen Item'ın önizlemesi kendi ailesinin kartından geri yazılır.
_PREVIEW_SOURCE = {
    "wall_showcase_100_2_350": "wall_showcase_100_3_350",
    "shelf_row_2": "shelf_row_1",
    "shelf_row_3": "shelf_row_1",
    "tv_55": "tv_42",
    "tv_65": "tv_42",
    "tv_85": "tv_42",
    "video_wall_3x3": "video_wall_2x2",
    "extra_long_planter_150": "extra_long_planter_100",
    "extra_long_planter_200": "extra_long_planter_100",
}


def _category_of(bind, item_key):
    return bind.execute(
        sa.text("SELECT category_id FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}
    ).scalar()


def _compact(bind, category_id, leading=(), trailing=()) -> None:
    """Kategorideki görünür Item sırası boşluksuz 1…n; `leading` başa, `trailing` sona alınır.

    Görünür sıra tekildir (uq_fair_stand_items_catalog_order): önce geçici aralığa taşınır.
    """
    rows = bind.execute(
        sa.text(
            "SELECT item_key FROM fair_stand_items WHERE category_id = :c AND catalog_visible "
            "ORDER BY catalog_item_index, item_key"
        ),
        {"c": category_id},
    ).scalars().all()
    middle = [key for key in rows if key not in leading and key not in trailing]
    ordered = [key for key in leading if key in rows] + middle + [key for key in trailing if key in rows]
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
            sa.text(
                "SELECT category_id FROM fair_stand_items WHERE item_key IN :keys AND category_id IS NOT NULL"
            ).bindparams(sa.bindparam("keys", expanding=True)),
            {"keys": [*_VARIANTS, *_MOVES]},
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
    trailing_by_category = {}
    for item_key, reference_key in _MOVES.items():
        target = _category_of(bind, reference_key)
        if target is None:
            continue
        categories.add(target)
        if _category_of(bind, item_key) != target:
            # Hedef kategorinin sonuna: sıra tekil olduğundan önce geçici aralıkta durur.
            bind.execute(
                sa.text(
                    "UPDATE fair_stand_items SET category_id = :c, catalog_item_index = 300000 + "
                    "(SELECT count(*) FROM fair_stand_items WHERE category_id = :c) "
                    "WHERE item_key = :k AND catalog_visible"
                ),
                {"c": target, "k": item_key},
            )
        trailing_by_category.setdefault(target, []).append(item_key)
    for category_id in categories:
        _compact(bind, category_id, trailing=tuple(trailing_by_category.get(category_id, ())))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("UPDATE fair_stand_items SET variant = NULL WHERE item_key IN :keys")
        .bindparams(sa.bindparam("keys", expanding=True)),
        {"keys": list(_VARIANTS)},
    )
    # Her sıra, kartının (anchor) bugünkü kategorisine yazılır.
    for anchor, order in _PREVIOUS_ORDER.items():
        category_id = _category_of(bind, anchor)
        if category_id is None:
            continue
        for offset, item_key in enumerate(order, start=1):
            preview = bind.execute(
                sa.text("SELECT preview_id FROM fair_stand_items WHERE item_key = :k"),
                {"k": _PREVIEW_SOURCE.get(item_key, item_key)},
            ).scalar()
            if preview is None:
                continue
            source = _category_of(bind, item_key)
            bind.execute(
                sa.text(
                    "UPDATE fair_stand_items SET catalog_visible = true, category_id = :c, preview_id = :p, "
                    "catalog_item_index = :i WHERE item_key = :k"
                ),
                {"c": category_id, "p": preview, "i": 200000 + offset, "k": item_key},
            )
            if source is not None and source != category_id:
                _compact(bind, source)
        _compact(bind, category_id, leading=order)
