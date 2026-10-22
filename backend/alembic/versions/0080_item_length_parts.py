"""Uzun profil/dikme parçalarının bölünüşü (yalnız BOM etiketi).

Revision ID: 0080_item_length_parts
Revises: 0079_wall_short_cards

Ürün kararı (2026-10-22): 346,5 cm'yi aşan profil ve dikmeler üretim listesinde tek satır
kalır, adının yanına parça bölünüşü yazılır: "N × Dikme 495 cm (346,5 + 8 + 140,5)".
BOM miktarı, reçete ve maliyet değişmez; bölünüş yalnız etiket içindir.

- fair_stand_item_length_parts: item_key + position (sıra) → part_item_key.
  Alt Item yapısı (fair_stand_item_components) kullanılmaz: sırası yoktur ve itemSnap
  alt Item'ları snap hattı sayar (uzun dikme kısa panele profil hattı gibi davranırdı).
- profile_8 ("Profil 8", 8 cm) profile_190'dan kopyalanır; katalogda gizli, sahnede
  çizilmez (yalnız bölünüş parçası).
- Bölünüşler: profile_388 = 346,5 + 41,5; profile_487 = 346,5 + 140,5;
  upright_396 = 346,5 + 49,5; upright_445_5 = 346,5 + 99; upright_495 = 346,5 + 8 + 140,5.
Downgrade tabloyu ve profile_8 satırını siler.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op


revision = "0080_item_length_parts"
down_revision = "0079_wall_short_cards"
branch_labels = None
depends_on = None

_TABLE = "fair_stand_item_length_parts"
_SOURCE = "profile_190"
_PIECE = "profile_8"
_PIECE_NAME = "Profil 8"
_PIECE_LENGTH_CM = 8
_OVERRIDDEN = {
    "item_key", "name", "catalog_visible", "category_id", "catalog_item_index", "preview_id",
    "is_render", "created_at", "updated_at",
}
_PARTS = {
    "profile_388": ("upright_346_5", "profile_41_5"),
    "profile_487": ("upright_346_5", "profile_140_5"),
    "upright_396": ("upright_346_5", "upright_49_5"),
    "upright_445_5": ("upright_346_5", "upright_99"),
    "upright_495": ("upright_346_5", _PIECE, "profile_140_5"),
}


def _exists(bind, item_key: str) -> bool:
    return bool(
        bind.execute(sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :k"), {"k": item_key}).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()
    if not sa.inspect(bind).has_table(_TABLE):
        op.create_table(
            _TABLE,
            sa.Column(
                "item_key", sa.String(128),
                sa.ForeignKey("fair_stand_items.item_key", ondelete="CASCADE", onupdate="CASCADE"),
                primary_key=True,
            ),
            sa.Column("position", sa.Integer(), primary_key=True),
            sa.Column(
                "part_item_key", sa.String(128),
                sa.ForeignKey("fair_stand_items.item_key", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=False,
            ),
            sa.CheckConstraint("position >= 1", name="ck_fair_stand_item_length_parts_position"),
            sa.CheckConstraint("item_key <> part_item_key", name="ck_fair_stand_item_length_parts_self"),
        )
        op.create_index("ix_fair_stand_item_length_parts_part", _TABLE, ["part_item_key"])

    if not _exists(bind, _PIECE) and _exists(bind, _SOURCE):
        copied = [
            column["name"]
            for column in sa.inspect(bind).get_columns("fair_stand_items")
            if column["name"] not in _OVERRIDDEN
        ]
        columns = ", ".join(copied)
        now = datetime.now(tz=UTC)
        bind.execute(
            sa.text(
                f"INSERT INTO fair_stand_items (item_key, name, catalog_visible, is_render, created_at, updated_at, "
                f"{columns}) SELECT :key, :name, false, false, :now, :now, {columns} "
                f"FROM fair_stand_items WHERE item_key = :source"
            ),
            {"key": _PIECE, "name": _PIECE_NAME, "now": now, "source": _SOURCE},
        )
        bind.execute(
            sa.text(
                "INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm, height_cm) "
                "SELECT :key, :length, depth_cm, height_cm FROM fair_stand_item_dimensions WHERE item_key = :source"
            ),
            {"key": _PIECE, "length": _PIECE_LENGTH_CM, "source": _SOURCE},
        )

    for item_key, parts in _PARTS.items():
        if not _exists(bind, item_key) or not all(_exists(bind, part) for part in parts):
            continue
        bind.execute(sa.text(f"DELETE FROM {_TABLE} WHERE item_key = :k"), {"k": item_key})
        for position, part in enumerate(parts, start=1):
            bind.execute(
                sa.text(f"INSERT INTO {_TABLE} (item_key, position, part_item_key) VALUES (:k, :p, :part)"),
                {"k": item_key, "p": position, "part": part},
            )


def downgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table(_TABLE):
        op.drop_index("ix_fair_stand_item_length_parts_part", table_name=_TABLE)
        op.drop_table(_TABLE)
    for table in ("fair_stand_item_dimensions", "fair_stand_items"):
        bind.execute(sa.text(f"DELETE FROM {table} WHERE item_key = :k"), {"k": _PIECE})
