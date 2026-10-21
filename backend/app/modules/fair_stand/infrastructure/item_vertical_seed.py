"""Item dikey hareket ve taban referansı seed'i (migration 0076 ile aynı kural).

- vertical_move: sahnede ↑/↓ ile dikey taşınan öğeler (TV, strafor, tül, raf, küp blok,
  LED projektör, profil ve kısa duvarlar).
- z_reference: default_z_cm katalog duvar tepesine (350) göre olan öğeler wall-top
  (profil ve kısa duvarlar); seçili duvar yüksekliği farkı kadar kayar. Diğerleri floor.
"""

from __future__ import annotations

VERTICAL_MOVE_TYPES = frozenset(
    {"tv", "illuminated-foam", "tulle-fabric", "shelf", "box-block", "led-floodlight", "profile"}
)
WALL_SHORT_VARIANTS = frozenset({"wall-short-1", "wall-short-2"})


def vertical_fields_for(item_type: str | None, variant: str | None) -> dict[str, object]:
    wall_short = item_type == "flat-panel" and variant in WALL_SHORT_VARIANTS
    return {
        "vertical_move": item_type in VERTICAL_MOVE_TYPES or wall_short,
        "z_reference": "wall-top" if item_type == "profile" or wall_short else "floor",
    }


def apply_item_vertical_fields(row: dict) -> dict:
    row.update(vertical_fields_for(row.get("item_type"), row.get("variant")))
    return row
