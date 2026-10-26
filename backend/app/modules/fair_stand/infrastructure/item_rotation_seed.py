"""Canonical Item rotation seed. Placeable modules get values; leaf rows stay null."""

from __future__ import annotations

import sqlalchemy as sa

PLACEABLE_ITEM_TYPES = frozenset(
    {
        "flat-panel",
        "base",
        "counter",
        "separator",
        "sofa-set-classic",
        "sofa-single-classic",
        "sofa-double-classic",
        "coffee-table-classic",
        "table-chair-set-eames",
        "chair",
        "table-glass",
        "bar-stool",
        "mini-fridge",
        "kettle",
        "coat-rack",
        "floor-showcase",
        "brochure-stand",
        "upright",
        "profile",
        "plastic-trash-bin",
        "box-block",
        "indoor-plant-1",
        "tv",
        "shelf",
        "led-floodlight",
        "door",
        "showcase-2",
        "showcase-3",
        "illuminated-foam",
        "tulle-fabric",
    }
)

_DEFAULT_PLACEABLE = (15, 0, "inherit")

_SPECIAL = {
    "desk_banko_100": (15, 0, "inherit"),
    "desk_banko_150": (15, 0, "inherit"),
    "desk_banko_200": (15, 0, "inherit"),
    "desk_banko_100_l": (15, 270, "inherit"),
    "desk_banko_150_l": (15, 270, "inherit"),
    "desk_banko_200_l": (15, 270, "inherit"),
    "box_block": (15, 0, "inherit"),
    "furniture_sofa_single_classic": (15, 0, "inherit"),
    "furniture_bar_stool_classic": (15, 270, "default"),
}


def rotation_fields_for_item(item_key: str, item_type: str) -> tuple[int | None, int | None, str | None]:
    if item_key in _SPECIAL:
        return _SPECIAL[item_key]
    if item_type in PLACEABLE_ITEM_TYPES:
        return _DEFAULT_PLACEABLE
    return (None, None, None)


def apply_item_rotation_fields(row: dict) -> dict:
    step, default, side = rotation_fields_for_item(row["item_key"], row["item_type"])
    row["rotation_step_deg"] = step
    row["default_rotation_deg"] = default
    row["side_insert_rotation"] = side
    return row


def fill_item_rotation_columns(bind) -> None:
    existing = bind.execute(sa.text("SELECT item_key, item_type FROM fair_stand_items")).mappings()
    for row in existing:
        step, default, side = rotation_fields_for_item(row["item_key"], row["item_type"])
        bind.execute(
            sa.text(
                "UPDATE fair_stand_items SET rotation_step_deg = :step, "
                "default_rotation_deg = :default_deg, side_insert_rotation = :side "
                "WHERE item_key = :item_key"
            ),
            {
                "step": step,
                "default_deg": default,
                "side": side,
                "item_key": row["item_key"],
            },
        )
