"""Karolaj üretim listesi parçaları: yarım karo ve alt demirler.

Revision ID: 0098_karolaj_parts
Revises: 0097_project_fair_assignment

Kullanıcı kararı (2026-11-16):
- 100 cm'e tam bölünmeyen stand kenarında kalan 0,5 m² parçalar tam karoya yuvarlanmaz,
  `karolaj_yarim` satırında sayılır; köşedeki 50 × 50 parça da yarım sayılır.
- Karonun altındaki demir, karo ızgarasının kenarlarıdır; ortak kenar bir kez sayılır
  (1 kare 4, yan yana 2 kare 7, 3 kare 10 demir). 1 m kenar `profile_karolaj_100`,
  50 cm kenar `profile_karolaj_50`.
Üç kalem de sahnede yerleşmez (tip `floor-piece`, sahne davranışı yok); yalnız listede görünür.
Satırlar `karolaj`'dan kopyalanır (maliyet bayrağı vb.); var olan kayıt değişmez.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op


revision = "0098_karolaj_parts"
down_revision = "0097_project_fair_assignment"
branch_labels = None
depends_on = None

_SOURCE = "karolaj"
_TYPE_KEY = "floor-piece"
_TYPE_NAME = "Zemin parçası"
# item_key, ad, genişlik cm, derinlik cm, boyanır mı
_ITEMS = (
    ("karolaj_yarim", "Karolaj Yarım", 50, 100, True),
    ("profile_karolaj_100", "Profil 1 m", 100, None, False),
    ("profile_karolaj_50", "Profil 0.5 m", 50, None, False),
)
_OVERRIDDEN = {"item_key", "name", "item_type", "catalog_visible", "created_at", "updated_at"}


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(tz=UTC)
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_type (key, display_name, is_active, created_at, updated_at)
            SELECT :type_key, :display_name, :is_active, :now, :now
            WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_type WHERE key = :type_key)
            """
        ),
        {"type_key": _TYPE_KEY, "display_name": _TYPE_NAME, "is_active": True, "now": now},
    )
    source_exists = bind.execute(
        sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :k"), {"k": _SOURCE}
    ).scalar()
    if not source_exists:
        return
    copied = [
        column["name"]
        for column in sa.inspect(bind).get_columns("fair_stand_items")
        if column["name"] not in _OVERRIDDEN
    ]
    columns = ", ".join(copied)
    for item_key, name, width_cm, depth_cm, paintable in _ITEMS:
        inserted = bind.execute(
            sa.text(
                f"INSERT INTO fair_stand_items (item_key, name, item_type, catalog_visible, created_at, updated_at, {columns}) "
                f"SELECT :key, :name, :type_key, :visible, :now, :now, {columns} FROM fair_stand_items "
                "WHERE item_key = :source AND NOT EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :key)"
            ),
            {
                "key": item_key,
                "name": name,
                "type_key": _TYPE_KEY,
                "visible": False,
                "now": now,
                "source": _SOURCE,
            },
        ).rowcount
        if inserted and not paintable:
            bind.execute(
                sa.text(
                    "UPDATE fair_stand_items SET paintable = :paintable, default_color = NULL "
                    "WHERE item_key = :key"
                ),
                {"key": item_key, "paintable": False},
            )
        bind.execute(
            sa.text(
                """
                INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm)
                SELECT :key, :width_cm, :depth_cm
                WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_dimensions WHERE item_key = :key)
                """
            ),
            {"key": item_key, "width_cm": width_cm, "depth_cm": depth_cm},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for item_key, *_ in _ITEMS:
        bind.execute(sa.text("DELETE FROM fair_stand_items WHERE item_key = :key"), {"key": item_key})
    bind.execute(sa.text("DELETE FROM fair_stand_item_type WHERE key = :key"), {"key": _TYPE_KEY})
