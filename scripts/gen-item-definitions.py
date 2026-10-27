"""docs/items/definitions/<itemKey>.md belgelerini koddan üretir. Belgedeki her satırın kaynağı kod/DB seed'dir.

Kaynaklar (depo kökü):
  test/fixtures/itemCatalogSeed.json                                   Item store seed'i (kimlik, tip, ölçü, renk, components, yüzey bayrakları)
  backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py  tip davranışı (placement, collision, snap, magnetic, side insert ...)
  test/ e2e/ backend/tests                                             itemKey'i dizge olarak geçen test dosyaları
Kullanım: python -I scripts/gen-item-definitions.py . docs/items/definitions [itemKey ...]
Tüm Item'lar için itemKey verilmez; yalnız seçilenleri üretmek için itemKey listesi verilir.
"""
import ast, json, re, sys
from pathlib import Path

WT, OUTDIR = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
only = set(sys.argv[3:])
seed = json.loads((WT / "test/fixtures/itemCatalogSeed.json").read_text(encoding="utf-8"))
items = {i["item_key"]: i for i in seed["items"]}
cats = {c["catalog_index"]: c["catalog_name"] for c in seed["categories"]}

# tip davranışı: seed modülündeki sözlükler ast ile okunur (çalıştırılmaz)
beh_src = (WT / "backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py").read_text(encoding="utf-8")
tree = ast.parse(beh_src)
dicts = {}
for n in tree.body:
    tgt = n.target if isinstance(n, ast.AnnAssign) else (n.targets[0] if isinstance(n, ast.Assign) else None)
    if isinstance(tgt, ast.Name) and isinstance(getattr(n, "value", None), ast.Dict):
        try:
            dicts[tgt.id] = {ast.literal_eval(k): v for k, v in zip(n.value.keys, n.value.values)}
        except Exception:
            pass


def lit(v):
    try:
        return ast.literal_eval(v)
    except Exception:
        return None


def behavior(t):
    out = {}
    s1 = dicts.get("TYPE_BEHAVIOR_SLICE1", {}).get(t)
    if s1 is not None:
        p, c, snap = lit(s1)
        out.update(placement=p, collision=c, moveSnapCm=snap)
    s2 = dicts.get("TYPE_BEHAVIOR_SLICE2", {}).get(t)
    if s2 is not None:
        m, side, mount, cap = lit(s2)
        out.update(magneticSnap=m, allowSideInsert=side, supportsWallOverlayMount=mount, wallCapacity=cap)
    s3 = dicts.get("TYPE_BEHAVIOR_SLICE3", {}).get(t)
    if s3 is not None and isinstance(s3, ast.Call):
        for kw in s3.keywords:
            out[{"overlap": "overlapWithTypes", "endpoint_contact": "endpointContact"}.get(kw.arg, kw.arg)] = lit(kw.value)
    return out


test_files = [p for d in ("test", "e2e", "backend/tests") for p in (WT / d).rglob("*") if p.is_file() and p.suffix in (".js", ".mjs", ".py")]
test_text = {p.relative_to(WT).as_posix(): p.read_text(encoding="utf-8", errors="replace") for p in test_files}


def tests_for(key):
    rx = re.compile(r"['\"`]" + re.escape(key) + r"['\"`]")
    return sorted(p for p, t in test_text.items() if rx.search(t))


src_files = [p for d in ("src", "backend/app") for p in (WT / d).rglob("*") if p.is_file() and p.suffix in (".js", ".mjs", ".py")]
src_text = {p.relative_to(WT).as_posix(): p.read_text(encoding="utf-8", errors="replace").splitlines() for p in src_files}


def code_uses(key):
    """itemKey'i dizge olarak geçen kaynak satırları (seed ve test hariç): dosya -> satır numaraları."""
    rx = re.compile(r"['\"`]" + re.escape(key) + r"['\"`]")
    out = {}
    for p, ls in src_text.items():
        hits = [i for i, l in enumerate(ls, 1) if rx.search(l)]
        if hits and not p.endswith("item_type_behavior_seed.py"):
            out[p] = hits
    return dict(sorted(out.items()))


def color(v):
    return f"`#{v:06x}`" if isinstance(v, int) else "—"


def dims(d):
    if not d:
        return "—"
    return ", ".join(f"`{k}={v}`" for k, v in d.items() if v is not None) or "—"


def render(key):
    it = items[key]
    used_by = sorted(k for k, o in items.items() if any((c.get("child_item_key") == key) for c in (o.get("components") or [])))
    lines = [f"# {key}", "",
             "> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: "
             "[ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).", "",
             "## Kimlik", "",
             "| Alan | Değer |", "|---|---|",
             f"| itemKey | `{key}` |",
             f"| Ad | {it.get('name') or '—'} |",
             f"| Tip | `{it.get('item_type')}` |",
             f"| Birim | {('`' + it['unit'] + '`') if it.get('unit') else '—'} |",
             f"| Malzeme | {it.get('material') or '—'} |",
             f"| Katalog | {'görünür' if it.get('catalog_visible') else 'görünmez'}" + (f", {cats.get(it.get('category_index'), it.get('category_index'))}" if it.get('category_index') is not None else "") + " |",
             f"| Ölçü | {dims(it.get('dimensions'))} |",
             f"| Sahne ölçüsü | {dims(it.get('scene_dimensions'))} |",
             f"| Varsayılan renk | {color(it.get('default_color'))} |",
             f"| Yüzey | " + ", ".join(f"`{k[len('accepts_'):]}`" for k in ("accepts_color", "accepts_image", "accepts_lightbox", "accepts_glass", "accepts_mesh") if it.get(k)) + (" kabul eder" if any(it.get(k) for k in ("accepts_color", "accepts_image", "accepts_lightbox", "accepts_glass", "accepts_mesh")) else "—") + " |",
             ""]
    comps = it.get("components") or []
    lines += ["## Bileşim / BOM", ""]
    if comps:
        lines += [f"`composition_mode={it.get('composition_mode')}`. BOM `src/itemBom.js` `resolveItemBom('{key}')` ile bu satırlardan çözülür.", "",
                  "| Alt kalem | Miktar |", "|---|---|"]
        lines += [f"| `{c['child_item_key']}` | {c['quantity']} |" for c in sorted(comps, key=lambda c: c.get("sort_order", 0))]
    else:
        lines += ["Tekil Item: alt kalemi yoktur; BOM satırı kendisidir."]
    if used_by:
        lines += ["", "Alt kalem olarak kullanıldığı Item'lar: " + ", ".join(f"`{k}`" for k in used_by) + "."]
    lines += ["", "## Tip davranışı", ""]
    b = behavior(it.get("item_type"))
    if b:
        lines += [f"`{it.get('item_type')}` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):", "",
                  "| Alan | Değer |", "|---|---|"] + [f"| {k} | `{v}` |" for k, v in b.items()]
    else:
        lines += [f"`{it.get('item_type')}` tipi için ayrı sahne davranışı tanımlı değildir."]
    u = code_uses(key)
    lines += ["", "## Kaynak kodda geçtiği yerler", ""]
    lines += [f"- `{p}`" for p in u] if u else ["Kaynak kod bu itemKey'i adıyla kullanmaz; Item store ve bileşim üzerinden çözülür."]
    t = tests_for(key)
    lines += ["", "## Testler", ""]
    lines += [f"- `{p}`" for p in t] if t else ["Bu itemKey'i doğrudan adıyla kullanan test yok."]
    return "\n".join(lines) + "\n"


OUTDIR.mkdir(parents=True, exist_ok=True)
for key in sorted(only or items):
    (OUTDIR / f"{key}.md").write_text(render(key), encoding="utf-8")
print("üretildi:", len(only or items))
