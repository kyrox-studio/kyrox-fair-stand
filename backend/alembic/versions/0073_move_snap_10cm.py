"""Bütün öğe türlerinde taşıma adımı 10 cm.

Revision ID: 0073_move_snap_10cm
Revises: 0072_shelf_rows

Ürün kararı (2026-10-21): sahnede her öğe 10 cm adımla taşınır; zemin ızgarası
(1 m kalın / 50 cm ince) yalnız görüntüdür. Önceki DB'de mobilya, duvar ve kapı
türleri zaten 10 cm idi; banko, LED projektör (20), tül, video wall paneli ve
alt parça türleri 50 cm kalmıştı. Upgrade hepsini 10 yapar; downgrade yalnız bu
listedeki türleri önceki değerine döndürür.
"""

import sqlalchemy as sa
from alembic import op


revision = "0073_move_snap_10cm"
down_revision = "0072_shelf_rows"
branch_labels = None
depends_on = None

MOVE_SNAP_CM = 10

# Upgrade öncesi 10 cm olmayan türler (yerel ve canlı DB, 2026-10-21).
_PREVIOUS_MOVE_SNAP_CM = {
    "base-top": 50,
    "connector": 50,
    "counter": 50,
    "counter-top": 50,
    "door-leaf": 50,
    "floor": 50,
    "led-floodlight": 20,
    "panel": 50,
    "panel-glass": 50,
    "sarmasik": 50,
    "shelf-accessory": 50,
    "showcase-2-body": 50,
    "showcase-3-body": 50,
    "showcase-accessory": 50,
    "showcase-board": 50,
    "tulle-fabric": 50,
    "upright": 50,
    "video-wall-panel": 50,
}


def upgrade() -> None:
    op.get_bind().execute(
        sa.text(
            "UPDATE fair_stand_item_type_scene_behavior "
            "SET move_snap_cm = :step WHERE move_snap_cm <> :step"
        ),
        {"step": MOVE_SNAP_CM},
    )


def downgrade() -> None:
    bind = op.get_bind()
    for key, move_snap_cm in _PREVIOUS_MOVE_SNAP_CM.items():
        bind.execute(
            sa.text(
                "UPDATE fair_stand_item_type_scene_behavior SET move_snap_cm = :value "
                "WHERE item_type_id = (SELECT id FROM fair_stand_item_type WHERE key = :key)"
            ),
            {"key": key, "value": move_snap_cm},
        )
