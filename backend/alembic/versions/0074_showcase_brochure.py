"""Ayaklı vitrin ve broşürlük: iki tekil sahne öğesi.

Revision ID: 0074_showcase_brochure
Revises: 0073_move_snap_10cm

Ürün kararı (2026-10-21):
- floor_showcase_100 "Ayaklı Vitrin 100": 100 × 40 cm, toplam 100 cm (70 cm gövde,
  30 cm cam fanus). Raf & Vitrin kategorisi. Gövdenin ön/sol/sağ yüzü renk, görsel
  ve Lightbox alır.
- brochure_stand "Broşürlük": 30 × 30 cm taban, 150 cm, 5 cep, beyaz delikli metal.
  Extra kategorisi.
İkisi de serbest yerleşimli, taban alanıyla çakışır, 10 cm adımla taşınır; BOM tek
kalem 1 adet (reçete yok). Her biri kendi katalog önizleme türünü alır. Var olan
satırlar olduğu gibi bırakılır; downgrade yalnız bu satırları siler.
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op


revision = "0074_showcase_brochure"
down_revision = "0073_move_snap_10cm"
branch_labels = None
depends_on = None

_PREVIEW_BASE_CSS = (
    ".module-drag-preview { display:flex; height:78px; align-items:center; justify-content:center; "
    "overflow:hidden; border-radius:7px; background:#fff; }\n"
)

_ITEMS = (
    {
        "item_key": "floor_showcase_100",
        "name": "Ayaklı Vitrin 100",
        "type_key": "floor-showcase",
        "type_name": "Ayaklı vitrin",
        "category_index": 3,
        "dimensions": (100.00, 40.00, 100.00),
        "preview_name": "Ayaklı vitrin",
        "surface_flags": True,
        "preview_markup": '<div class="module-drag-floor-showcase"></div>',
        "preview_css": (
            ".module-drag-floor-showcase { position:relative; width:44px; height:62px; }\n"
            ".module-drag-floor-showcase::before { content:''; position:absolute; left:4px; right:4px; "
            "top:3px; height:18px; box-sizing:border-box; border:2px solid #9fbfa5; "
            "background:rgba(205,232,209,.5); }\n"
            ".module-drag-floor-showcase::after { content:''; position:absolute; left:4px; right:4px; "
            "top:21px; bottom:3px; box-sizing:border-box; border:3px solid #D0D3D4; background:#f8fafc; "
            "box-shadow:4px 4px 0 #d7dde4; }\n"
        ),
    },
    {
        "item_key": "brochure_stand",
        "name": "Broşürlük",
        "type_key": "brochure-stand",
        "type_name": "Broşürlük",
        "category_index": 5,
        "dimensions": (30.00, 30.00, 150.00),
        "preview_name": "Broşürlük",
        "surface_flags": False,
        "preview_markup": '<div class="module-drag-brochure-stand"></div>',
        "preview_css": (
            ".module-drag-brochure-stand { position:relative; width:24px; height:64px; "
            "box-sizing:border-box; border:2px solid #D0D3D4; border-bottom-width:4px; "
            "background:repeating-linear-gradient(to bottom,#f8fafc 0 9px,#D0D3D4 9px 11px); "
            "transform:skewX(-6deg); }\n"
        ),
    },
)


def _scalar(bind, sql: str, params: dict):
    return bind.execute(sa.text(sql), params).scalar()


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(tz=UTC)
    for item in _ITEMS:
        if _scalar(bind, "SELECT 1 FROM fair_stand_items WHERE item_key = :key", {"key": item["item_key"]}):
            continue
        bind.execute(
            sa.text(
                "INSERT INTO fair_stand_item_type (key, display_name, is_active, created_at, updated_at) "
                "SELECT :key, :name, :active, :now, :now "
                "WHERE NOT EXISTS (SELECT 1 FROM fair_stand_item_type WHERE key = :key)"
            ),
            {"key": item["type_key"], "name": item["type_name"], "active": True, "now": now},
        )
        type_id = _scalar(bind, "SELECT id FROM fair_stand_item_type WHERE key = :key", {"key": item["type_key"]})
        bind.execute(
            sa.text(
                """
                INSERT INTO fair_stand_item_type_scene_behavior (
                  item_type_id, placement, collision, move_snap_cm,
                  magnetic_snap, allow_side_insert, supports_wall_overlay_mount, wall_capacity,
                  connection_endpoint, collision_depth, endpoint_contact, boundary_snap, collision_height,
                  ghost_kind, ghost_renderer, ghost_opacity
                )
                SELECT
                  :type_id, 'free', 'footprint', 10,
                  'none', :allow_side, :supports_overlay, 'include',
                  'segment', 'physical', 'standard', 'stand-edge', 'full',
                  'silhouette', 'module-silhouette', :ghost_opacity
                WHERE NOT EXISTS (
                  SELECT 1 FROM fair_stand_item_type_scene_behavior WHERE item_type_id = :type_id
                )
                """
            ),
            {"type_id": type_id, "allow_side": True, "supports_overlay": False, "ghost_opacity": 0.380},
        )
        existing_preview = _scalar(
            bind,
            "SELECT id FROM fair_stand_catalog_preview_kinds WHERE markup = :markup ORDER BY id",
            {"markup": item["preview_markup"]},
        )
        if existing_preview is None:
            sort_index = _scalar(
                bind, "SELECT COALESCE(MAX(sort_index), 0) + 1 FROM fair_stand_catalog_preview_kinds", {}
            )
            bind.execute(
                sa.text(
                    "INSERT INTO fair_stand_catalog_preview_kinds "
                    "(display_name, markup, css_code, sort_index, is_active, created_at, updated_at) "
                    "VALUES (:name, :markup, :css, :sort_index, :active, :now, :now)"
                ),
                {
                    "name": item["preview_name"],
                    "markup": item["preview_markup"],
                    "css": _PREVIEW_BASE_CSS + item["preview_css"],
                    "sort_index": sort_index,
                    "active": True,
                    "now": now,
                },
            )
        preview_id = _scalar(
            bind,
            "SELECT id FROM fair_stand_catalog_preview_kinds WHERE markup = :markup ORDER BY id",
            {"markup": item["preview_markup"]},
        )
        category_id = _scalar(
            bind, "SELECT id FROM fair_stand_categories WHERE catalog_index = :index", {"index": item["category_index"]}
        )
        next_index = _scalar(
            bind,
            "SELECT COALESCE(MAX(catalog_item_index), 0) + 1 FROM fair_stand_items WHERE category_id = :category_id",
            {"category_id": category_id},
        )
        bind.execute(
            sa.text(
                """
                INSERT INTO fair_stand_items (
                  item_key, name, item_type, unit, catalog_visible,
                  category_id, catalog_item_index, preview_id,
                  default_opacity, default_z_cm,
                  is_render, accepts_color, accepts_image,
                  accepts_lightbox, accepts_glass, accepts_mesh,
                  is_cost_enabled, is_active,
                  rotation_step_deg, default_rotation_deg, side_insert_rotation,
                  created_at, updated_at
                ) VALUES (
                  :item_key, :name, :type_key, 'adet', :visible,
                  :category_id, :catalog_item_index, :preview_id,
                  :default_opacity, :default_z_cm,
                  :is_render, :faces, :faces,
                  :faces, :no, :no,
                  :cost_enabled, :active,
                  :rotation_step_deg, :default_rotation_deg, 'inherit',
                  :now, :now
                )
                """
            ),
            {
                "item_key": item["item_key"],
                "name": item["name"],
                "type_key": item["type_key"],
                "visible": True,
                "category_id": category_id,
                "catalog_item_index": next_index,
                "preview_id": preview_id,
                "default_opacity": 1.000,
                "default_z_cm": 0.00,
                "is_render": True,
                "no": False,
                "faces": item["surface_flags"],
                "cost_enabled": True,
                "active": True,
                "rotation_step_deg": 90.00,
                "default_rotation_deg": 0.00,
                "now": now,
            },
        )
        width_cm, depth_cm, height_cm = item["dimensions"]
        bind.execute(
            sa.text(
                "INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm, height_cm) "
                "VALUES (:item_key, :width_cm, :depth_cm, :height_cm)"
            ),
            {"item_key": item["item_key"], "width_cm": width_cm, "depth_cm": depth_cm, "height_cm": height_cm},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for item in _ITEMS:
        bind.execute(sa.text("DELETE FROM fair_stand_item_dimensions WHERE item_key = :key"), {"key": item["item_key"]})
        bind.execute(sa.text("DELETE FROM fair_stand_items WHERE item_key = :key"), {"key": item["item_key"]})
        bind.execute(
            sa.text("DELETE FROM fair_stand_catalog_preview_kinds WHERE markup = :markup"),
            {"markup": item["preview_markup"]},
        )
        type_id = _scalar(bind, "SELECT id FROM fair_stand_item_type WHERE key = :key", {"key": item["type_key"]})
        if type_id is not None:
            bind.execute(
                sa.text("DELETE FROM fair_stand_item_type_scene_behavior WHERE item_type_id = :id"), {"id": type_id}
            )
            bind.execute(sa.text("DELETE FROM fair_stand_item_type WHERE id = :id"), {"id": type_id})
