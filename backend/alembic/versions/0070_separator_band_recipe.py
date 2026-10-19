"""Wall height rule for the 100 cm separators (plain and sarmaşık).

Revision ID: 0070_separator_band_recipe
Revises: 0069_door_showcase_band_recipe

Same rule as the flat wall: separator_panel_98 per_band 1, single connector
per_band 2, upright height_matched; profiles, start connectors and the
sarmaşık part stay fixed. The 50 cm separators are not included: their saved
recipes (7 singles; the sarmaşık one with 98 cm panels) do not follow this rule
and wait for a product decision.
"""

import sqlalchemy as sa
from alembic import op


revision = "0070_separator_band_recipe"
down_revision = "0069_door_showcase_band_recipe"
branch_labels = None
depends_on = None

_PARENTS = ("wall_separator_100_350", "wall_separator_100_350_sarmasik")


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
        _set(bind, "per_band", 1, parent, "separator_panel_98")
        _set(bind, "per_band", 2, parent, "connector_single")


def downgrade() -> None:
    bind = op.get_bind()
    for parent in _PARENTS:
        _set(bind, "height_matched", False, parent, "upright_346_5")
        _set(bind, "per_band", 0, parent, "separator_panel_98")
        _set(bind, "per_band", 0, parent, "connector_single")
