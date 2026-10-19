"""Wall height rule: per-band quantities and height-matched uprights.

Revision ID: 0068_wall_band_recipe
Revises: 0067_group_templates

wall_50/100/150/200_350 keep their 350 cm recipe as saved. Two component
columns describe how the recipe follows another wall height (50 cm bands):
per_band is the quantity change per band (panel 1, single connector 2),
height_matched marks the upright that is replaced by the upright of the
chosen height. Five hidden uprights are added; real length and scene height
come from the product table (250 → 247,5 … 500 → 495).
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op


revision = "0068_wall_band_recipe"
down_revision = "0067_group_templates"
branch_labels = None
depends_on = None

_UPRIGHTS = (
    ("upright_247_5", "Dikme 247,5 cm", 247.5, 250),
    ("upright_297", "Dikme 297 cm", 297, 300),
    ("upright_396", "Dikme 396 cm", 396, 400),
    ("upright_445_5", "Dikme 445,5 cm", 445.5, 450),
    ("upright_495", "Dikme 495 cm", 495, 500),
)

_WALL_PANELS = {
    "wall_50_350": "panel_48_5",
    "wall_100_350": "panel_98",
    "wall_150_350": "panel_147_5",
    "wall_200_350": "panel_197",
}


def upgrade() -> None:
    bind = op.get_bind()
    # 0001 boş veritabanında güncel modelden kurar; sütun zaten varsa eklenmez.
    existing = {column["name"] for column in sa.inspect(bind).get_columns("fair_stand_item_components")}
    if "per_band" not in existing:
        op.add_column(
            "fair_stand_item_components",
            sa.Column("per_band", sa.Numeric(12, 4), nullable=False, server_default="0"),
        )
    if "height_matched" not in existing:
        op.add_column(
            "fair_stand_item_components",
            sa.Column("height_matched", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    now = datetime.now(tz=UTC)
    for item_key, name, real_cm, scene_cm in _UPRIGHTS:
        bind.execute(
            sa.text(
                """
                INSERT INTO fair_stand_items (
                  item_key, name, item_type, unit, catalog_visible,
                  material, default_color, default_z_cm,
                  is_render, accepts_color, accepts_image,
                  accepts_lightbox, accepts_glass, accepts_mesh,
                  is_active, created_at, updated_at
                )
                SELECT
                  :item_key, :name, 'upright', 'adet', false,
                  source.material, source.default_color, source.default_z_cm,
                  source.is_render, false, false,
                  false, false, false,
                  true, :now, :now
                FROM fair_stand_items AS source
                WHERE source.item_key = 'upright_346_5'
                  AND NOT EXISTS (
                    SELECT 1 FROM fair_stand_items WHERE item_key = :item_key
                  )
                """
            ),
            {"item_key": item_key, "name": name, "now": now},
        )
        bind.execute(
            sa.text(
                """
                INSERT INTO fair_stand_item_dimensions (item_key, width_cm, depth_cm, height_cm)
                SELECT :item_key, 8, 8, :height
                WHERE EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :item_key)
                  AND NOT EXISTS (
                    SELECT 1 FROM fair_stand_item_dimensions WHERE item_key = :item_key
                  )
                """
            ),
            {"item_key": item_key, "height": real_cm},
        )
        bind.execute(
            sa.text(
                """
                INSERT INTO fair_stand_item_scene_dimensions (item_key, width_cm, depth_cm, height_cm)
                SELECT :item_key, 8, 8, :height
                WHERE EXISTS (SELECT 1 FROM fair_stand_items WHERE item_key = :item_key)
                  AND NOT EXISTS (
                    SELECT 1 FROM fair_stand_item_scene_dimensions WHERE item_key = :item_key
                  )
                """
            ),
            {"item_key": item_key, "height": scene_cm},
        )

    for parent, panel in _WALL_PANELS.items():
        bind.execute(
            sa.text(
                """
                UPDATE fair_stand_item_components SET height_matched = true
                WHERE parent_item_key = :parent AND child_item_key = 'upright_346_5'
                """
            ),
            {"parent": parent},
        )
        bind.execute(
            sa.text(
                """
                UPDATE fair_stand_item_components SET per_band = 1
                WHERE parent_item_key = :parent AND child_item_key = :panel
                """
            ),
            {"parent": parent, "panel": panel},
        )
        bind.execute(
            sa.text(
                """
                UPDATE fair_stand_item_components SET per_band = 2
                WHERE parent_item_key = :parent AND child_item_key = 'connector_single'
                """
            ),
            {"parent": parent},
        )


# upright_396 / upright_445_5 / upright_495 bazı veritabanlarında bu migration'dan önce vardı
# (kısa duvar dikme yığını); downgrade yalnız kesin bu migration'ın eklediği iki dikmeyi siler.
_DOWNGRADE_UPRIGHTS = ("upright_247_5", "upright_297")


def downgrade() -> None:
    bind = op.get_bind()
    for item_key in _DOWNGRADE_UPRIGHTS:
        bind.execute(
            sa.text("DELETE FROM fair_stand_items WHERE item_key = :item_key"),
            {"item_key": item_key},
        )
    op.drop_column("fair_stand_item_components", "height_matched")
    op.drop_column("fair_stand_item_components", "per_band")
