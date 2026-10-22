"""Profil boyları: tek katalog kartı ve sahne ölçüleri.

Revision ID: 0078_profile_lengths
Revises: 0077_upright_render

Ürün kararı (2026-10-22): profil dikme gibi tek kartla sahneye gelir; bırakılırken boy
sorulur. Gerçek boy (BOM) → sahne boyu: 41,5 → 50, 91 → 100, 140,5 → 150, 190 → 200,
239,5 → 250, 289 → 300, 388 → 400, 487 → 500. Sahne kesiti 10 × 10 cm (dikmelerle aynı).

- Admin ekranında açılan `profile_289_scene` kartı `profile_289` olur (ad "Profil 289");
  proje ve grup şablonu kayıtlarındaki anahtar da çevrilir (0041 düzeni). Satır yoksa
  `profile_289` profile_190'dan kopyalanır.
- `profile_239_5`, `profile_388`, `profile_487` profile_190'dan kopyalanır ("Profil 239,5" / "Profil 388" / "Profil 487").
- Katalogda yalnız `profile_289` görünür; diğer profiller boy penceresinden seçilir.
Downgrade yalnız `profile_239_5`, `profile_388`, `profile_487` satırlarını siler; anahtar değişikliği geri alınmaz.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op


revision = "0078_profile_lengths"
down_revision = "0077_upright_render"
branch_labels = None
depends_on = None

_SOURCE = "profile_190"
_LEGACY_CARD = "profile_289_scene"
_CARD = "profile_289"
# item_key → (ad, gerçek boy cm, sahne boyu cm)
_PROFILES = {
    "profile_41_5": (None, 41.5, 50),
    "profile_91": (None, 91, 100),
    "profile_140_5": (None, 140.5, 150),
    "profile_190": (None, 190, 200),
    "profile_239_5": ("Profil 239,5", 239.5, 250),
    _CARD: ("Profil 289", 289, 300),
    "profile_388": ("Profil 388", 388, 400),
    "profile_487": ("Profil 487", 487, 500),
}
_SCENE_SECTION_CM = 10
# Bu migration'ın kesin eklediği satırlar (downgrade bunları siler).
_ADDED = ("profile_239_5", "profile_388", "profile_487")
_OVERRIDDEN = {"item_key", "name", "catalog_visible", "created_at", "updated_at"}


def _exists(bind, item_key: str) -> bool:
    return bool(
        bind.execute(sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}).scalar()
    )


def _rename_legacy_card(bind) -> None:
    if not _exists(bind, _LEGACY_CARD):
        return
    if _exists(bind, _CARD):
        raise RuntimeError(f"Cannot rename {_LEGACY_CARD!r} → {_CARD!r}: target key already exists.")
    # FK kolonları fair_stand_items.item_key'e ON UPDATE CASCADE ile bağlıdır.
    bind.execute(
        sa.text("UPDATE fair_stand_items SET item_key = :new WHERE item_key = :old"),
        {"old": _LEGACY_CARD, "new": _CARD},
    )
    # Proje ve şablon JSON'ları itemKey metnini gömülü taşır (FK ile çevrilmez).
    postgres = bind.dialect.name == "postgresql"
    as_text = "payload::text" if postgres else "payload"
    as_json = "::jsonb" if postgres else ""
    inspector = sa.inspect(bind)
    for table in ("fair_stand_projects", "fair_stand_group_templates"):
        if not inspector.has_table(table) or "payload" not in {c["name"] for c in inspector.get_columns(table)}:
            continue
        bind.execute(
            sa.text(
                f"UPDATE {table} SET payload = replace({as_text}, :old, :new){as_json} "
                f"WHERE {as_text} LIKE '%' || :old || '%'"
            ),
            {"old": _LEGACY_CARD, "new": _CARD},
        )


def _copy_from_source(bind, item_key: str, name: str) -> None:
    if _exists(bind, item_key) or not _exists(bind, _SOURCE):
        return
    copied = [
        column["name"]
        for column in sa.inspect(bind).get_columns("fair_stand_items")
        if column["name"] not in _OVERRIDDEN
    ]
    columns = ", ".join(copied)
    now = datetime.now(tz=UTC)
    bind.execute(
        sa.text(
            f"INSERT INTO fair_stand_items (item_key, name, catalog_visible, created_at, updated_at, {columns}) "
            f"SELECT :key, :name, false, :now, :now, {columns} FROM fair_stand_items WHERE item_key = :source"
        ),
        {"key": item_key, "name": name, "now": now, "source": _SOURCE},
    )


def _set_dimensions(bind, item_key: str, real_cm: float, scene_cm: float) -> None:
    if not _exists(bind, item_key):
        return
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm, height_cm)
            SELECT :key, :real, 8, 8
            WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_dimensions WHERE item_key = :key)
            """
        ),
        {"key": item_key, "real": real_cm},
    )
    bind.execute(
        sa.text("UPDATE fair_stand_item_dimensions SET width_cm = :real WHERE item_key = :key"),
        {"key": item_key, "real": real_cm},
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_scene_dimensions (item_key, width_cm, depth_cm, height_cm)
            SELECT :key, :scene, :section, :section
            WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_scene_dimensions WHERE item_key = :key)
            """
        ),
        {"key": item_key, "scene": scene_cm, "section": _SCENE_SECTION_CM},
    )
    bind.execute(
        sa.text(
            "UPDATE fair_stand_item_scene_dimensions SET width_cm = :scene, depth_cm = :section, "
            "height_cm = :section WHERE item_key = :key"
        ),
        {"key": item_key, "scene": scene_cm, "section": _SCENE_SECTION_CM},
    )


def upgrade() -> None:
    bind = op.get_bind()
    _rename_legacy_card(bind)
    for item_key, (name, real_cm, scene_cm) in _PROFILES.items():
        if name:
            _copy_from_source(bind, item_key, name)
            bind.execute(
                sa.text("UPDATE fair_stand_items SET name = :name WHERE item_key = :key"),
                {"key": item_key, "name": name},
            )
        _set_dimensions(bind, item_key, real_cm, scene_cm)
    # Tek kart: profile_289; kategori/sıra boşsa profile_190'ınkini alır.
    # Görünür kartta kategori, sıra ve önizleme zorunludur (ck_fair_stand_items_catalog_visible).
    # Boşsa önce profile_190'dan, o da boşsa başka bir profilden alınır. Değerler okunduktan sonra
    # gizlenen profillerin katalog alanları boşaltılır (kategori içi sıra tekil kalır).
    fields = ("category_id", "catalog_item_index", "preview_id")
    card = bind.execute(
        sa.text("SELECT category_id, catalog_item_index, preview_id FROM fair_stand_items WHERE item_key = :k"),
        {"k": _CARD},
    ).first()
    if card is None:
        return
    values = dict(zip(fields, card))
    for column in fields:
        if values[column] is not None:
            continue
        values[column] = bind.execute(
            sa.text(
                f"SELECT {column} FROM fair_stand_items WHERE item_type = 'profile' AND {column} IS NOT NULL "
                f"ORDER BY CASE WHEN item_key = :source THEN 0 ELSE 1 END, item_key LIMIT 1"
            ),
            {"source": _SOURCE},
        ).scalar()
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET catalog_visible = false, category_id = NULL, "
            "catalog_item_index = NULL, preview_id = NULL WHERE item_type = 'profile' AND item_key <> :card"
        ),
        {"card": _CARD},
    )
    bind.execute(
        sa.text(
            "UPDATE fair_stand_items SET category_id = :category_id, catalog_item_index = :catalog_item_index, "
            "preview_id = :preview_id, catalog_visible = true WHERE item_key = :card"
        ),
        {**values, "card": _CARD},
    )


def downgrade() -> None:
    bind = op.get_bind()
    for item_key in _ADDED:
        for table in ("fair_stand_item_scene_dimensions", "fair_stand_item_dimensions", "fair_stand_items"):
            bind.execute(sa.text(f"DELETE FROM {table} WHERE item_key = :k"), {"k": item_key})
