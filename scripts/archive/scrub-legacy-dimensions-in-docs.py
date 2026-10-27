"""Remove or rewrite legacy lengthCm/thicknessCm in remaining docs (not migrations)."""
from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "items"

SKIP = {
    "audit/properties/properties/static.dimensions.lengthCm.md",
    "audit/properties/properties/static.dimensions.thicknessCm.md",
    "audit/README.md",
}

SUBS = [
    (re.compile(r"`dimensions\.widthCm`, `heightCm`, `depthCm`, `lengthCm`, `thicknessCm`"), "`dimensions.widthCm`, `heightCm`, `depthCm`"),
    (re.compile(r"`dimensions\.widthCm`, `heightCm`, `depthCm`, `lengthCm`, `thicknessCm`,"), "`dimensions.widthCm`, `heightCm`, `depthCm`,"),
    (re.compile(r"static\.dimensions\.lengthCm"), "static.dimensions.widthCm (legacy column removed)"),
    (re.compile(r"static\.dimensions\.thicknessCm"), "static.dimensions.depthCm (legacy column removed)"),
    (re.compile(r"dimensions\.lengthCm"), "dimensions.widthCm"),
    (re.compile(r"dimensions\.thicknessCm"), "dimensions.depthCm"),
    (re.compile(r"thicknessCm=0\.8"), "depthCm=0.8"),
    (re.compile(r"thicknessCm = 0\.8"), "depthCm = 0.8"),
    (re.compile(r"thicknessCm = 8"), "depthCm = 8"),
    (re.compile(r"thicknessCm=8"), "depthCm=8"),
    (re.compile(r", thicknessCm="), ", depthCm="),
    (re.compile(r"`lengthCm=([\d.]+)`, `thicknessCm=8`"), r"`widthCm=\1`, `depthCm=8`, `heightCm=8`"),
    (re.compile(r"`lengthCm=([\d.]+)`, `thicknessCm=([\d.]+)`"), r"`widthCm=\1`, `depthCm=\2`, `heightCm=\2`"),
]


def scrub_text(rel: str, text: str) -> str:
    if rel.replace("\\", "/") in SKIP:
        return text
    for pat, repl in SUBS:
        text = pat.sub(repl, text)
    return text


def scrub_csv(path: Path) -> None:
    rows = list(csv.reader(path.read_text(encoding="utf-8").splitlines()))
    if not rows:
        return
    header = rows[0]
    drop = {i for i, c in enumerate(header) if "lengthCm" in c or "thicknessCm" in c}
    if not drop:
        return
    out = []
    for row in rows:
        out.append([v for i, v in enumerate(row) if i not in drop])
    path.write_text("\n".join(",".join(r) for r in out) + "\n", encoding="utf-8")


def main() -> None:
    n = 0
    for path in DOCS.rglob("*"):
        if path.suffix not in {".md", ".csv"}:
            continue
        rel = str(path.relative_to(ROOT / "docs" / "items"))
        if path.suffix == ".csv":
            scrub_csv(path)
            n += 1
            continue
        text = path.read_text(encoding="utf-8")
        new = scrub_text(rel, text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            n += 1
    stub = ROOT / "docs" / "items" / "audit" / "report" / "ITEM_SYSTEM_AUDIT.md"
    stub.write_text(
        "# Item system audit (arşiv)\n\n"
        "Bu snapshot güncel değildir. Canonical Item ve ölçüler:\n\n"
        "- [`docs/refactor/ITEMS.md`](../../refactor/ITEMS.md)\n"
        "- [`docs/refactor/ITEM_DIMENSIONS.md`](../../refactor/ITEM_DIMENSIONS.md)\n\n"
        "Detaylı audit matrisi: `ITEM_OZELLIK_MATRISI.tsv` (legacy length/thickness sütunları kaldırıldı).\n",
        encoding="utf-8",
    )
    (ROOT / "docs" / "items" / "audit" / "report" / "audit-data.json").write_text(
        '{"deprecated":true,"see":["docs/refactor/ITEMS.md","docs/refactor/ITEM_DIMENSIONS.md"]}\n',
        encoding="utf-8",
    )
    html = ROOT / "docs" / "items" / "audit" / "report" / "ITEM_SYSTEM_AUDIT.html"
    if html.exists():
        html.write_text(
            "<!DOCTYPE html><html><body><p>Deprecated audit HTML. See docs/refactor/ITEMS.md</p></body></html>\n",
            encoding="utf-8",
        )
    print(f"scrubbed {n} files + report stubs")


if __name__ == "__main__":
    main()
