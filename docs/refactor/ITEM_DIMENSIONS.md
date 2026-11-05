# Item dimensions — DB kolonları ve W/H/D yerleşimi

Ön görünüş kutusu (cm): **W** duvar boyunca, **H** dikey, **D** duvara doğru derinlik.

Tablo: `fair_stand_item_dimensions` (1:1 `fair_stand_items.item_key`). Sahne override: `fair_stand_item_scene_dimensions` (ayrı tablo; aynı W/H/D field adları).

---

## DB kolon → JSON → anlam

| DB kolon | JSON (`dimensions.*`) | Rol |
|---|---|---|
| `width_cm` | `widthCm` | Kutu **W** (duvar boyunca) |
| `height_cm` | `heightCm` | Kutu **H** (dikey) |
| `depth_cm` | `depthCm` | Kutu **D** (duvara içeri) |
| `mount_height_cm` | `mountHeightCm` | Montaj kotu (legacy; `default_z_cm` tercih) |
| `wall_gap_cm` | `wallGapCm` | Duvar boşluğu (ör. strafor) |

**Kaldırıldı (migration `0021_drop_item_length_thickness`):** `length_cm` / `thickness_cm` — eski BOM alanları; değerler `0020_item_dims_wh_d_fill` ile W/H/D’ye taşındı.

**Runtime effective kutu:** `resolveSceneDimensions(item)` = aynı field adında `sceneDimensions ?? dimensions` (cross-remap yok).

---

## `item_type` → W/H/D anlamı (canonical)

| `item_type` | W | H | D |
|---|---|---|---|
| `panel`, `separator-panel`, `video-wall-panel`, `door-leaf` | Ürün genişliği | Ürün yüksekliği | Panel kalınlığı |
| `upright` | Kesit (8) | Dikme boyu | Kesit (8) |
| `profile` | Ray span (BOM boy) | Kesit (8) | Kesit (8) |
| `shelf` | Raf span | Tabla kalınlığı | Raf derinliği (38) |
| `showcase-board`, `showcase-accessory` | Board boyu | Kalınlık | Derinlik |
| `floor` | Karo boyu | Kalınlık | Derinlik |
| `counter-top`, `base-top` | Üst ölçü W | Tabla kalınlığı | Üst ölçü D |
| Diğer (tv, mobilya, …) | Doğrudan W/H/D | | |

Profil sahne genişliği (50/100/150/200 cm şerit) **`fair_stand_item_scene_dimensions.width_cm`**; üretim span **`dimensions.width_cm`** (ör. 190).

---

## Pilot SKU

| item_key | type | W | H | D | Not |
|---|---|---:|---:|---:|---|
| `panel_197` | panel | 197 | 47 | 0.8 | D = kalınlık |
| `upright_346_5` | upright | 8 | 346.5 | 8 | |
| `profile_190` | profile | 190 | 8 | 8 | Sahne **W=200** → `scene_dimensions` |
| `shelf_100` | shelf | 100 | 1.8 | 38 | |
| `counter_top_110_60` | counter-top | 110 | 1.8 | 60 | H = tabla |

---

## Tüm satırlar

Matris (Item store seed'inden üretilir): `docs/refactor/data/item_dimensions_matrix.tsv`

Üretim: `python kyrox-fair-stand/scripts/generate-item-dimensions-matrix.py`
