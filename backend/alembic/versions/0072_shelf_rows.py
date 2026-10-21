"""Raf kartları hedef duvar genişliğinden tekli/ikili/üçlü ürüne çözülür.

Revision ID: 0072_shelf_rows
Revises: 0071_separator_50_band_recipe

Ürün kararı (2026-10-21): katalogda Tekli raf, 2 sıralı raf, 3 sıralı raf
kartları genişliksiz görünür. Genişlik takıldığı duvardan gelir
(100 / 150 / 200; 50 cm duvarda eşleşme yoktur).

- fair_stand_item_width_variants kartı (aile) genişlik ürünlerine bağlar;
  genişlik varyant Item'ın dimensions.width_cm değeridir.
- Tekli kart mevcut shelf_100 / shelf_150 / shelf_200 ürünlerine çözülür;
  kayıtlı ürün kimlikleri korunur, eski ürünler katalogda gizlenir.
- Sıralı gizli reçete: shelf_row_n_W = shelf_W × n; BOM tekli reçetenin
  n katıdır (2 sıralı 150 → 2 tahta + 6 ayak).
- Eksik tekli reçete/tahta/ölçü satırları eklenir; mevcut kullanıcı ölçüleri
  ve bileşen adetleri ezilmez. Sahne ölçüsü değişikliği bu migration'ın işi değildir.

Downgrade kartları, sıralı reçeteleri ve eşleme tablosunu kaldırır;
tekli rafları katalogda gösterir. Tekli reçete satırları korunur.
"""

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op


revision = "0072_shelf_rows"
down_revision = "0071_separator_50_band_recipe"
branch_labels = None
depends_on = None

_WIDTHS = (100, 150, 200)
_LEGS = {100: 2, 150: 3, 200: 3}
_ROW_PITCH_CM = 50
_BOARD_CM = 1.8
_CARDS = (
    ("shelf_row_1", "Tekli raf", 1),
    ("shelf_row_2", "2 sıralı raf", 2),
    ("shelf_row_3", "3 sıralı raf", 3),
)

# Kaynak satırdan aynen kopyalanan kolonlar (dönüş, snap, renk, yüzey bayrakları...).
_COPIED_COLUMNS = (
    "item_type", "unit", "category_id", "preview_id", "material", "default_color",
    "default_opacity", "preserve_model_scale", "model_rotation_y_deg", "visual_rotation_y_deg",
    "rotation_step_deg", "default_rotation_deg", "side_insert_rotation", "paintable", "shape",
    "variant", "eye_count", "default_z_cm", "snap_target_item_type", "snap_anchor",
    "snap_requires_rule_id", "snap_provides_rule_id", "is_cost_enabled", "is_active",
)


def _variant_key(rows: int, width: int) -> str:
    return f"shelf_{width}" if rows == 1 else f"shelf_row_{rows}_{width}"


def _stack_height(rows: int) -> float:
    return round(_BOARD_CM + (rows - 1) * _ROW_PITCH_CM, 2)


def _insert_item_from(bind, *, source, item_key, name, catalog_visible, catalog_item_index,
                      composition_mode, is_render, accepts_color, now) -> None:
    columns = ", ".join(_COPIED_COLUMNS)
    selected = ", ".join(f"source.{column}" for column in _COPIED_COLUMNS)
    bind.execute(
        sa.text(
            f"""
            INSERT INTO fair_stand_items (
              item_key, name, catalog_visible, catalog_item_index, composition_mode,
              is_render, accepts_color, accepts_image, accepts_lightbox, accepts_glass,
              accepts_mesh, created_at, updated_at, {columns}
            )
            SELECT
              :item_key, :name, :catalog_visible, :catalog_item_index, :composition_mode,
              :is_render, :accepts_color, false, false, false,
              false, :now, :now, {selected}
            FROM fair_stand_items AS source
            WHERE source.item_key = :source
              AND NOT EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :item_key)
            """
        ),
        {
            "source": source, "item_key": item_key, "name": name,
            "catalog_visible": catalog_visible, "catalog_item_index": catalog_item_index,
            "composition_mode": composition_mode, "is_render": is_render,
            "accepts_color": accepts_color, "now": now,
        },
    )


def _ensure_dimensions(bind, item_key, width, depth, height) -> None:
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm, height_cm)
            SELECT :item_key, :width, :depth, :height
            WHERE EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :item_key)
              AND NOT EXISTS (SELECT 1 FROM fair_stand_item_dimensions WHERE item_key = :item_key)
            """
        ),
        {"item_key": item_key, "width": width, "depth": depth, "height": height},
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_scene_dimensions (item_key, width_cm, depth_cm, height_cm)
            SELECT :item_key, :width, NULL, :height
            WHERE EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :item_key)
              AND NOT EXISTS (
                SELECT 1 FROM fair_stand_item_scene_dimensions WHERE item_key = :item_key
              )
            """
        ),
        {"item_key": item_key, "width": width, "height": height},
    )


def _ensure_component(bind, parent, child, quantity) -> None:
    bind.execute(
        sa.text(
            """
            INSERT INTO fair_stand_item_components (
              id, parent_item_key, child_item_key, quantity, per_band, height_matched
            )
            SELECT :id, :parent, :child, :quantity, 0, false
            WHERE EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :parent)
              AND EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :child)
              AND NOT EXISTS (
                SELECT 1 FROM fair_stand_item_components
                WHERE parent_item_key = :parent AND child_item_key = :child
              )
            """
        ),
        {"id": str(uuid4()), "parent": parent, "child": child, "quantity": quantity},
    )


def upgrade() -> None:
    bind = op.get_bind()
    # 0001 boş veritabanında güncel modelden kurar; tablo zaten varsa yeniden oluşturulmaz.
    if not sa.inspect(bind).has_table("fair_stand_item_width_variants"):
        op.create_table(
            "fair_stand_item_width_variants",
            sa.Column(
                "family_item_key", sa.String(128),
                sa.ForeignKey("fair_stand_items.item_key", ondelete="CASCADE", onupdate="CASCADE"),
                primary_key=True,
            ),
            sa.Column(
                "item_key", sa.String(128),
                sa.ForeignKey("fair_stand_items.item_key", ondelete="CASCADE", onupdate="CASCADE"),
                primary_key=True,
            ),
            sa.CheckConstraint(
                "family_item_key <> item_key", name="ck_fair_stand_item_width_variants_self",
            ),
        )
        op.create_index(
            "ix_fair_stand_item_width_variants_item", "fair_stand_item_width_variants", ["item_key"],
        )

    now = datetime.now(tz=UTC)

    # Tekli raf reçetesi: shelf_W = shelf_W_self (tahta) × 1 + shelf_leg × 2/3/3 (yoksa eklenir).
    for width in _WIDTHS:
        shelf_key = f"shelf_{width}"
        self_key = f"shelf_{width}_self"
        _insert_item_from(
            bind, source=shelf_key, item_key=self_key, name=f"Raf {width} Tek",
            catalog_visible=False, catalog_item_index=None, composition_mode=None,
            is_render=False, accepts_color=False, now=now,
        )
        _ensure_dimensions(bind, self_key, width, 38, _BOARD_CM)
        _ensure_component(bind, self_key, "shelf_leg", _LEGS[width])
        _ensure_component(bind, shelf_key, self_key, 1)
        _ensure_component(bind, shelf_key, "shelf_leg", _LEGS[width])
        bind.execute(
            sa.text(
                """
                UPDATE fair_stand_items
                SET composition_mode = 'recipe', catalog_visible = false, updated_at = :now
                WHERE item_key = :item_key
                """
            ),
            {"item_key": shelf_key, "now": now},
        )

    # n sıralı raf: shelf_row_n_W = shelf_W × n (BOM tekli reçetenin n katı).
    for rows in (2, 3):
        for width in _WIDTHS:
            key = _variant_key(rows, width)
            _insert_item_from(
                bind, source=f"shelf_{width}", item_key=key, name=f"{rows} sıralı raf {width} cm",
                catalog_visible=False, catalog_item_index=None, composition_mode="recipe",
                is_render=True, accepts_color=True, now=now,
            )
            _ensure_dimensions(bind, key, width, 38, _stack_height(rows))
            _ensure_component(bind, key, f"shelf_{width}", rows)

    # Katalog kartları: kategori/önizleme/sıra mevcut raflardan (Tekli = 200'lük rafın sırası...).
    card_indexes = [
        bind.execute(
            sa.text("SELECT catalog_item_index FROM fair_stand_items WHERE item_key = :key"),
            {"key": f"shelf_{width}"},
        ).scalar()
        for width in _WIDTHS
    ]
    ordered_indexes = sorted(index for index in card_indexes if index is not None) or [3, 4, 5]
    for position, (card_key, card_name, rows) in enumerate(_CARDS):
        _insert_item_from(
            bind, source="shelf_100", item_key=card_key, name=card_name,
            catalog_visible=True,
            catalog_item_index=ordered_indexes[min(position, len(ordered_indexes) - 1)],
            composition_mode=None, is_render=True, accepts_color=True, now=now,
        )
        _ensure_dimensions(bind, card_key, 100, 38, _stack_height(rows))
        for width in _WIDTHS:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO fair_stand_item_width_variants (family_item_key, item_key)
                    SELECT :family, :item_key
                    WHERE EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :family)
                      AND EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :item_key)
                      AND NOT EXISTS (
                        SELECT 1 FROM fair_stand_item_width_variants
                        WHERE family_item_key = :family AND item_key = :item_key
                      )
                    """
                ),
                {"family": card_key, "item_key": _variant_key(rows, width)},
            )


def downgrade() -> None:
    bind = op.get_bind()
    for card_key, _name, _rows in _CARDS:
        bind.execute(sa.text("DELETE FROM fair_stand_items WHERE item_key = :key"), {"key": card_key})
    for rows in (2, 3):
        for width in _WIDTHS:
            bind.execute(
                sa.text("DELETE FROM fair_stand_items WHERE item_key = :key"),
                {"key": _variant_key(rows, width)},
            )
    for width in _WIDTHS:
        bind.execute(
            sa.text("UPDATE fair_stand_items SET catalog_visible = true WHERE item_key = :key"),
            {"key": f"shelf_{width}"},
        )
    op.drop_index("ix_fair_stand_item_width_variants_item", table_name="fair_stand_item_width_variants")
    op.drop_table("fair_stand_item_width_variants")
