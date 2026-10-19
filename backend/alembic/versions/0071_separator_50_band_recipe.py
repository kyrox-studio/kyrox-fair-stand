"""50 cm separators: correct the 350 cm recipe and add the wall height rule.

Revision ID: 0071_separator_50_band_recipe
Revises: 0070_separator_band_recipe

Product decision (2026-10-19): a 50 cm separator, plain or sarmaşık, is
2 uprights, 2 × profile_41_5, one separator_panel_48_5 per band, 2 start
connectors and 2 × bands − 1 single connectors (250 cm: 5 panels, 9 singles).
At 350 cm that is 7 panels and 13 singles. The saved rows had 7 singles, and
some databases had 98 cm separator panels on the sarmaşık one; both are
corrected. The sarmaşık part stays as saved. Downgrade puts the single count
back to 7 and clears the rule; removed 98 cm panel rows are not restored.
"""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op


revision = "0071_separator_50_band_recipe"
down_revision = "0070_separator_band_recipe"
branch_labels = None
depends_on = None

_PARENTS = ("wall_separator_50_350", "wall_separator_50_350_sarmasik")
_PANEL = "separator_panel_48_5"


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
        exists = bind.execute(
            sa.text("SELECT 1 FROM fair_stand_items WHERE item_key = :parent"),
            {"parent": parent},
        ).scalar()
        if not exists:
            continue
        bind.execute(
            sa.text(
                "DELETE FROM fair_stand_item_components "
                "WHERE parent_item_key = :parent AND child_item_key = 'separator_panel_98'"
            ),
            {"parent": parent},
        )
        has_panel = bind.execute(
            sa.text(
                "SELECT 1 FROM fair_stand_item_components "
                "WHERE parent_item_key = :parent AND child_item_key = :panel"
            ),
            {"parent": parent, "panel": _PANEL},
        ).scalar()
        if not has_panel:
            bind.execute(
                sa.text(
                    "INSERT INTO fair_stand_item_components "
                    "(id, parent_item_key, child_item_key, quantity, per_band, height_matched) "
                    "VALUES (:id, :parent, :panel, 7, 0, false)"
                ),
                {"id": str(uuid4()), "parent": parent, "panel": _PANEL},
            )
        _set(bind, "quantity", 7, parent, _PANEL)
        _set(bind, "quantity", 13, parent, "connector_single")
        _set(bind, "height_matched", True, parent, "upright_346_5")
        _set(bind, "per_band", 1, parent, _PANEL)
        _set(bind, "per_band", 2, parent, "connector_single")


def downgrade() -> None:
    bind = op.get_bind()
    for parent in _PARENTS:
        _set(bind, "quantity", 7, parent, "connector_single")
        _set(bind, "height_matched", False, parent, "upright_346_5")
        _set(bind, "per_band", 0, parent, _PANEL)
        _set(bind, "per_band", 0, parent, "connector_single")
