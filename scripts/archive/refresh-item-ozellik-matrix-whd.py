"""Drop legacy lengthCm/thicknessCm columns; fill W/H/D from catalog seed."""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "test" / "fixtures" / "itemCatalogSeed.json"
TSV = ROOT / "docs" / "items" / "audit" / "ITEM_OZELLIK_MATRISI.tsv"

DROP_COLS = {
    "static.dimensions.lengthCm",
    "static.dimensions.thicknessCm",
}


def fmt(v) -> str:
    if v is None:
        return ""
    s = str(v)
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def main() -> None:
    seed = {r["item_key"]: r for r in json.loads(SEED.read_text(encoding="utf-8"))["items"]}
    rows = list(csv.DictReader(TSV.open(encoding="utf-8"), delimiter="\t"))
    if not rows:
        raise SystemExit("empty matrix")
    fieldnames = [c for c in rows[0].keys() if c not in DROP_COLS]
    for row in rows:
        key = row.get("itemKey") or row.get("item_key")
        item = seed.get(key)
        if item and item.get("dimensions"):
            d = item["dimensions"]
            row["static.dimensions.widthCm"] = fmt(d.get("width_cm"))
            row["static.dimensions.depthCm"] = fmt(d.get("depth_cm"))
            row["static.dimensions.heightCm"] = fmt(d.get("height_cm"))
        for col in DROP_COLS:
            row.pop(col, None)
    with TSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter="\t", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"rewrote {len(rows)} rows, dropped {len(DROP_COLS)} columns")


if __name__ == "__main__":
    main()
