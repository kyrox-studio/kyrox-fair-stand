"""Emit docs/refactor/data/item_dimensions_matrix.tsv from the Item store seed (test/fixtures/itemCatalogSeed.json)."""
from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "test" / "fixtures" / "itemCatalogSeed.json"
OUT = ROOT / "docs" / "refactor" / "data" / "item_dimensions_matrix.tsv"


def fmt(value: object) -> str:
    if value is None:
        return ""
    d = Decimal(str(value)).normalize()
    text = format(d, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def main() -> None:
    items = json.loads(SEED.read_text(encoding="utf-8"))["items"]
    types = {i["item_key"]: i["item_type"] for i in items}
    dims = sorted(
        ({"item_key": i["item_key"], **i["dimensions"]} for i in items if i.get("dimensions")),
        key=lambda r: r["item_key"],
    )
    scene = {i["item_key"]: i["scene_dimensions"] for i in items if i.get("scene_dimensions")}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    header = [
        "item_key",
        "item_type",
        "width_cm",
        "height_cm",
        "depth_cm",
        "mount_height_cm",
        "wall_gap_cm",
        "scene_width_cm",
        "scene_height_cm",
        "scene_depth_cm",
    ]
    lines = ["\t".join(header)]
    for row in dims:
        key = row["item_key"]
        s = scene.get(key) or {}
        lines.append(
            "\t".join(
                [
                    key,
                    types.get(key, ""),
                    fmt(row.get("width_cm")),
                    fmt(row.get("height_cm")),
                    fmt(row.get("depth_cm")),
                    fmt(row.get("mount_height_cm")),
                    fmt(row.get("wall_gap_cm")),
                    fmt(s.get("width_cm")),
                    fmt(s.get("height_cm")),
                    fmt(s.get("depth_cm")),
                ]
            )
        )
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(dims)} rows -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
