"""Test kataloğunu (`test/fixtures/itemCatalogSeed.json`) Fair Stand veritabanındaki gerçek Item verisinden üretir.

Birim testleri ve E2E kataloğu (FAIR_STAND_E2E_CATALOG) bu dosyayı okur. Elle düzenlenmez: DB'de Item
eklenince / değişince bu betik yeniden çalıştırılır (kullanıcı kararı 2026-11-20: test kataloğu DB'deki
gerçek veriyle aynı olur).

Çalıştırma (backend sanal ortamıyla, depo kökünden):
    backend/.venv/Scripts/python -I scripts/export-test-catalog.py            # Windows
    backend/.venv/bin/python -I scripts/export-test-catalog.py                # Linux

Bağlantı: `FAIR_STAND_DATABASE_URL` ortam değişkeni, yoksa `backend/.env` içindeki aynı anahtar.
Yalnız aktif Item, kategori ve varyant ailesi alınır. Önizleme kimliği DB'de sıra numarasıdır; testte
`test/fixtures/catalogPreviewKinds.mjs` kimliğine ad üzerinden eşlenir (eşleşmeyen önizleme hata verir).
"""

from __future__ import annotations

import json
import os
import re
import sys
from decimal import Decimal
from pathlib import Path

import sqlalchemy as sa

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test" / "fixtures" / "itemCatalogSeed.json"
PREVIEW_FIXTURE = ROOT / "test" / "fixtures" / "catalogPreviewKinds.mjs"


def database_url() -> str:
    url = os.environ.get("FAIR_STAND_DATABASE_URL")
    if url:
        return url
    env = ROOT / "backend" / ".env"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("FAIR_STAND_DATABASE_URL="):
            return line.split("=", 1)[1].strip()
    sys.exit("FAIR_STAND_DATABASE_URL bulunamadı (ortam değişkeni ya da backend/.env).")


def plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def preview_ids_by_name() -> dict[str, int]:
    text = PREVIEW_FIXTURE.read_text(encoding="utf-8")
    return {name: int(pid) for pid, name in re.findall(r"\{ id: (\d+), displayName: '([^']+)'", text)}


def main() -> None:
    engine = sa.create_engine(database_url())
    with engine.connect() as db:
        rows = lambda sql: [dict(r._mapping) for r in db.execute(sa.text(sql))]  # noqa: E731

        fixture_preview = preview_ids_by_name()
        previews = rows("select id, display_name, sort_index from fair_stand_catalog_preview_kinds where is_active order by sort_index, id")
        preview_map = {}
        for preview in previews:
            if preview["display_name"] not in fixture_preview:
                sys.exit(f"Önizleme test fikstüründe yok: {preview['display_name']!r} (catalogPreviewKinds.mjs'e ekle).")
            preview_map[preview["id"]] = fixture_preview[preview["display_name"]]

        categories = rows("select id, catalog_name, catalog_index from fair_stand_categories where is_active order by catalog_index")
        category_index = {c["id"]: c["catalog_index"] for c in categories}
        rule_key = {r["id"]: r["key"] for r in rows("select id, key from fair_stand_rule")}

        def grouped(sql, key):
            out: dict[str, list] = {}
            for row in rows(sql):
                out.setdefault(row.pop(key), []).append(row)
            return out

        dims = {r.pop("item_key"): r for r in rows("select * from fair_stand_item_dimensions")}
        scene = {r.pop("item_key"): r for r in rows("select * from fair_stand_item_scene_dimensions")}
        strips = {r.pop("item_key"): r for r in rows("select * from fair_stand_item_strip_occupancy")}
        assets = grouped("select item_key, asset_role, relative_path, is_active from fair_stand_item_assets order by id", "item_key")
        components = grouped(
            "select parent_item_key, child_item_key, quantity, per_band, height_matched from fair_stand_item_components order by id",
            "parent_item_key",
        )
        video = {r.pop("parent_item_key"): r for r in rows("select parent_item_key, rows, cols, panel_item_key from fair_stand_item_video_walls")}
        body = grouped("select parent_item_key, body_role, child_item_key from fair_stand_item_body_parts order by id", "parent_item_key")
        lengths = grouped("select item_key, part_item_key from fair_stand_item_length_parts order by position", "item_key")
        widths = grouped("select family_item_key, item_key from fair_stand_item_width_variants order by item_key", "family_item_key")

        items = []
        for row in rows("select * from fair_stand_items where is_active order by item_key"):
            key = row["item_key"]
            comps = []
            for index, comp in enumerate(components.get(key, [])):
                entry = {"child_item_key": comp["child_item_key"], "quantity": plain(comp["quantity"]), "sort_order": index}
                if comp["per_band"] is not None:
                    entry["per_band"] = plain(comp["per_band"])
                if comp["height_matched"]:
                    entry["height_matched"] = True
                comps.append(entry)
            item = {
                "item_key": key,
                "name": row["name"],
                "item_type": row["item_type"],
                "unit": row["unit"],
                "catalog_visible": row["catalog_visible"],
                "category_index": category_index.get(row["category_id"]),
                "catalog_item_index": row["catalog_item_index"],
                "preview_id": preview_map.get(row["preview_id"]),
                "material": row["material"],
                "default_color": row["default_color"],
                "default_opacity": plain(row["default_opacity"]),
                "preserve_model_scale": row["preserve_model_scale"],
                "model_rotation_y_deg": plain(row["model_rotation_y_deg"]),
                "visual_rotation_y_deg": plain(row["visual_rotation_y_deg"]),
                "composition_mode": row["composition_mode"],
                "paintable": row["paintable"],
                "shape": row["shape"],
                "variant": row["variant"],
                "eye_count": row["eye_count"],
                "is_render": row["is_render"],
                "accepts_color": row["accepts_color"],
                "accepts_image": row["accepts_image"],
                "accepts_lightbox": row["accepts_lightbox"],
                "accepts_glass": row["accepts_glass"],
                "accepts_mesh": row["accepts_mesh"],
                "is_cost_enabled": row["is_cost_enabled"],
                "default_z_cm": plain(row["default_z_cm"]),
                "rotation_step_deg": plain(row["rotation_step_deg"]),
                "default_rotation_deg": plain(row["default_rotation_deg"]),
                "side_insert_rotation": row["side_insert_rotation"],
                "snap_requires_rule_code": rule_key.get(row["snap_requires_rule_id"]),
                "snap_provides_rule_code": rule_key.get(row["snap_provides_rule_id"]),
                "dimensions": {k: plain(v) for k, v in dims[key].items()} if key in dims else None,
                "scene_dimensions": {k: plain(v) for k, v in scene[key].items()} if key in scene else None,
                "strip_occupancy": strips.get(key),
                "assets": assets.get(key, []),
                "components": comps,
                "video_wall": video.get(key),
                "body_parts": body.get(key, []),
                "length_parts": [part["part_item_key"] for part in lengths.get(key, [])],
                "width_variants": [entry["item_key"] for entry in widths.get(key, [])],
            }
            items.append(item)

        families = rows(
            "select family_key, title, tab_label, card_label, label_rule, option_family_key, option_label, sort_index, is_system, is_active "
            "from fair_stand_variant_families where is_active order by sort_index, family_key"
        )

    fixture = {
        "categories": [{"catalog_name": c["catalog_name"], "catalog_index": c["catalog_index"]} for c in categories],
        "variant_families": families,
        "preview_kinds": [{"sort_index": p["sort_index"], "id": preview_map[p["id"]]} for p in previews],
        "items": items,
    }
    OUT.write_text(json.dumps(fixture, ensure_ascii=False, default=plain), encoding="utf-8", newline="")
    print(f"{OUT.relative_to(ROOT)}: {len(items)} Item, {len(categories)} kategori, {len(families)} varyant ailesi, {len(previews)} önizleme")


if __name__ == "__main__":
    main()
