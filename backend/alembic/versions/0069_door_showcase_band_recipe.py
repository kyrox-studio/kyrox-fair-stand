"""Wall height rule for the door and the 2/3 eye showcases.

Revision ID: 0069_door_showcase_band_recipe
Revises: 0068_wall_band_recipe

Same rule as the flat walls (0068): the 350 cm recipe stays as saved, the
panel follows the band count (per_band 1), single connectors follow it
(per_band 2) and the upright is replaced by the upright of the chosen height.
Door leaf, profiles, start connectors and showcase body parts stay fixed.
At 250 cm: door 1 panel / 1 single, 2 eye showcase 3 panels / 5 singles,
3 eye showcase 2 panels / 3 singles (product table).
"""

import sqlalchemy as sa
from alembic import op


revision = "0069_door_showcase_band_recipe"
down_revision = "0068_wall_band_recipe"
branch_labels = None
depends_on = None

_PARENTS = ("wall_door_100_350", "wall_showcase_100_2_350", "wall_showcase_100_3_350")


def _set(bind, column: str, value, parent: str, child: str) -> None:
    bind.execute(
        sa.text(
            f"UPDATE fair_stand_item_components SET {column} = :value "
            "WHERE parent_item_key = :parent AND child_item_key = :child"
        ),
        {"value": value, "parent": parent, "child": child},
    )


def upgrade() -> None:
    bind = op.get_bind()
    for parent in _PARENTS:
        _set(bind, "height_matched", True, parent, "upright_346_5")
        _set(bind, "per_band", 1, parent, "panel_98")
        _set(bind, "per_band", 2, parent, "connector_single")


def downgrade() -> None:
    bind = op.get_bind()
    for parent in _PARENTS:
        _set(bind, "height_matched", False, parent, "upright_346_5")
        _set(bind, "per_band", 0, parent, "panel_98")
        _set(bind, "per_band", 0, parent, "connector_single")
