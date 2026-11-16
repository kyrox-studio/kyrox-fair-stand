"""Dikme 148,5 ve Dikme 198 (üst üste kısa panel kolonu).

Revision ID: 0099_upright_148_5_198
Revises: 0098_karolaj_parts

Kullanıcı kararı (2026-11-16): yalnız kısa panellerden oluşan kolonda (ör. Çift Sıra üstünde Tek Sıra)
her plan ucundaki dikmeler tek parça sayılır: 99 + 49,5 → 148,5, 99 + 99 → 198. İki satır
`upright_99`'dan kopyalanır (gizli, `upright` ailesi); sahne boyu 150 / 200, kesit 8 × 8.
Maksima stand tipine bağlanır (0093 düzeni). Var olan kayıt değişmez.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op


revision = "0099_upright_148_5_198"
down_revision = "0098_karolaj_parts"
branch_labels = None
depends_on = None

_SOURCE = "upright_99"
# item_key, ad, gerçek boy, sahne boyu
_ITEMS = (
    ("upright_148_5", "Dikme 148,5", 148.5, 150),
    ("upright_198", "Dikme 198", 198, 200),
)
_SECTION_CM = 8
_BOOTH_TYPE_KEY = "maxima"
_OVERRIDDEN = {"item_key", "name", "catalog_visible", "created_at", "updated_at"}


def _has_table(bind, name: str) -> bool:
    return sa.inspect(bind).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()
    if not bind.execute(sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :k"), {"k": _SOURCE}).scalar():
        return
    now = datetime.now(tz=UTC)
    copied = [
        column["name"]
        for column in sa.inspect(bind).get_columns("fair_stand_items")
        if column["name"] not in _OVERRIDDEN
    ]
    columns = ", ".join(copied)
    for item_key, name, real_cm, scene_cm in _ITEMS:
        bind.execute(
            sa.text(
                f"INSERT INTO fair_stand_items (item_key, name, catalog_visible, created_at, updated_at, {columns}) "
                f"SELECT :key, :name, :visible, :now, :now, {columns} FROM fair_stand_items "
                "WHERE item_key = :source AND NOT EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :key)"
            ),
            {"key": item_key, "name": name, "visible": False, "now": now, "source": _SOURCE},
        )
        bind.execute(
            sa.text(
                """
                INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm, height_cm)
                SELECT :key, :section, :section, :real
                WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_dimensions WHERE item_key = :key)
                """
            ),
            {"key": item_key, "section": _SECTION_CM, "real": real_cm},
        )
        bind.execute(
            sa.text(
                """
                INSERT INTO fair_stand_item_scene_dimensions (item_key, width_cm, depth_cm, height_cm)
                SELECT :key, :section, :section, :scene
                WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_scene_dimensions WHERE item_key = :key)
                """
            ),
            {"key": item_key, "section": _SECTION_CM, "scene": scene_cm},
        )
        if _has_table(bind, "fair_stand_item_booth_types"):
            bind.execute(
                sa.text(
                    "INSERT INTO fair_stand_item_booth_types (item_key, booth_type_key) "
                    "SELECT :key, :booth FROM fair_stand_items i WHERE i.item_key = :key "
                    "AND EXISTS (SELECT 1 FROM fair_stand_booth_types b WHERE b.booth_type_key = :booth) "
                    "AND NOT EXISTS (SELECT 1 FROM fair_stand_item_booth_types x WHERE x.item_key = :key)"
                ),
                {"key": item_key, "booth": _BOOTH_TYPE_KEY},
            )


def downgrade() -> None:
    bind = op.get_bind()
    for item_key, *_ in _ITEMS:
        for table in (
            "fair_stand_item_booth_types",
            "fair_stand_item_scene_dimensions",
            "fair_stand_item_dimensions",
            "fair_stand_items",
        ):
            if _has_table(bind, table):
                bind.execute(sa.text(f"DELETE FROM {table} WHERE item_key = :key"), {"key": item_key})
