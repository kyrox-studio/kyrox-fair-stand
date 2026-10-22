"""Kısa paneller: Tek Sıra / Çift Sıra için tek katalog kartı; ölçü aileleri ölçülü ad taşır.

Revision ID: 0079_wall_short_cards
Revises: 0078_profile_lengths

Ürün kararı (2026-10-22): kısa panel profil gibi katalogda varyant başına tek kartla gelir;
bırakılırken genişlik (50 / 100 / 150 / 200) sorulur.

- Kart `wall_100_short_1` (Tek Sıra) ve `wall_100_short_2` (Çift Sıra) görünür kalır.
- Ad = sahnedeki öğe (ürün kararı 2026-10-22): kısa panel "Panel Tek Sıra W" / "Panel Çift Sıra W"
  (W = 50 / 100 / 150 / 200), profil ve dikme gerçek boyla "Profil 41,5", "Dikme 346,5" ("cm" yok).
  Kart da kendi Item'ının ölçülü adını gösterir. Yalnız önceki adı taşıyan satır değişir (admin ezmesi korunur).
- Diğer genişlikler (`wall_50/150/200_short_1/2`) katalogda gizlenir; katalog alanları boşaltılır.
  Item'lar, item_key, variant ve BOM reçeteleri değişmez (otomatik alınlık ve kayıtlı projeler aynı kalır).
- Kartın kategorisinde görünür Item sırası boşluksuz 1…n olur (mevcut sıra korunur).
Downgrade eski adları geri yazar; sekiz genişlik kategorinin başına 0078 sırasıyla döner.
"""

import sqlalchemy as sa
from alembic import op


revision = "0079_wall_short_cards"
down_revision = "0078_profile_lengths"
branch_labels = None
depends_on = None

# variant → kart item_key
_CARDS = {
    "wall-short-1": "wall_100_short_1",
    "wall-short-2": "wall_100_short_2",
}
_ROWS_LABEL = {"1": "Tek", "2": "Çift"}
# item_key → (önceki ad, yeni ad)
_NAMES = {
    **{
        f"wall_{width}_short_{rows}": (f"Panel {width} Kısa {label} Sıra", f"Panel {label} Sıra {width}")
        for rows, label in _ROWS_LABEL.items()
        for width in (50, 100, 150, 200)
    },
    "profile_41_5": ("Profil 41,5 cm", "Profil 41,5"),
    "profile_91": ("Profil 91 cm", "Profil 91"),
    "profile_140_5": ("Profil 140,5 cm", "Profil 140,5"),
    "profile_190": ("Profil 190 cm", "Profil 190"),
    "upright_49_5": ("Dikme 49,5 cm", "Dikme 49,5"),
    "upright_99": ("Dikme 99 cm", "Dikme 99"),
    "upright_247_5": ("Dikme 247,5 cm", "Dikme 247,5"),
    "upright_297": ("Dikme 297 cm", "Dikme 297"),
    "upright_346_5": ("Dikme 346,5 cm", "Dikme 346,5"),
    "upright_396": ("Dikme 396 cm", "Dikme 396"),
    "upright_445_5": ("Dikme 445,5 cm", "Dikme 445,5"),
    "upright_495": ("Dikme 495 cm", "Dikme 495"),
}
# Downgrade: 0078 sonundaki seed sırası (kategori içi sıra).
_PREVIOUS_ORDER = (
    "wall_200_short_2", "wall_150_short_2", "wall_100_short_2", "wall_50_short_2",
    "wall_200_short_1", "wall_150_short_1", "wall_100_short_1", "wall_50_short_1",
)
_FIELDS = ("category_id", "catalog_item_index", "preview_id")


def _catalog_fields(bind, variant: str, card_key: str):
    """Kartın katalog alanları; boşsa aynı varyantın görünür bir genişliğinden alınır."""
    card = bind.execute(
        sa.text("SELECT category_id, catalog_item_index, preview_id FROM fair_stand_items WHERE item_key = :k"),
        {"k": card_key},
    ).first()
    if card is None:
        return None
    values = dict(zip(_FIELDS, card))
    for column in _FIELDS:
        if values[column] is not None:
            continue
        values[column] = bind.execute(
            sa.text(
                f"SELECT {column} FROM fair_stand_items WHERE variant = :variant AND {column} IS NOT NULL "
                f"ORDER BY item_key LIMIT 1"
            ),
            {"variant": variant},
        ).scalar()
    return values


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


def _rename(bind, forward: bool) -> None:
    for item_key, (previous, current) in _NAMES.items():
        source, target = (previous, current) if forward else (current, previous)
        bind.execute(
            sa.text("UPDATE fair_stand_items SET name = :target WHERE item_key = :k AND name = :source"),
            {"k": item_key, "source": source, "target": target},
        )


def upgrade() -> None:
    bind = op.get_bind()
    _rename(bind, True)
    categories = set()
    for variant, card_key in _CARDS.items():
        # Değerler gizlemeden önce okunur (kategori içi sıra tekil kalır).
        values = _catalog_fields(bind, variant, card_key)
        if values is None:
            continue
        bind.execute(
            sa.text(
                "UPDATE fair_stand_items SET catalog_visible = false, category_id = NULL, "
                "catalog_item_index = NULL, preview_id = NULL WHERE variant = :variant AND item_key <> :card"
            ),
            {"variant": variant, "card": card_key},
        )
        # Görünür kartta kategori, sıra ve önizleme zorunludur (ck_fair_stand_items_catalog_visible).
        if None in values.values():
            continue
        bind.execute(
            sa.text(
                "UPDATE fair_stand_items SET category_id = :category_id, catalog_item_index = :catalog_item_index, "
                "preview_id = :preview_id, catalog_visible = true WHERE item_key = :card"
            ),
            {**values, "card": card_key},
        )
        categories.add(values["category_id"])
    for category_id in categories:
        _compact(bind, category_id)


def downgrade() -> None:
    bind = op.get_bind()
    _rename(bind, False)
    reference = bind.execute(
        sa.text(
            "SELECT category_id, preview_id FROM fair_stand_items WHERE item_key IN :keys "
            "AND catalog_visible AND category_id IS NOT NULL AND preview_id IS NOT NULL "
            "ORDER BY item_key LIMIT 1"
        ).bindparams(sa.bindparam("keys", expanding=True)),
        {"keys": list(_CARDS.values())},
    ).first()
    if reference is None:
        return
    category_id, preview_id = reference
    # Sekiz genişlik görünür olur (geçici sıra kategorinin sonunda), sonra başa 0078 sırasıyla alınır.
    for offset, item_key in enumerate(_PREVIOUS_ORDER, start=1):
        bind.execute(
            sa.text(
                "UPDATE fair_stand_items SET catalog_visible = true, category_id = :c, preview_id = :p, "
                "catalog_item_index = :i WHERE item_key = :k"
            ),
            {"c": category_id, "p": preview_id, "i": 200000 + offset, "k": item_key},
        )
    _compact(bind, category_id, leading=_PREVIOUS_ORDER)
