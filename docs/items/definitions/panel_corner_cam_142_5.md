# panel_corner_cam_142_5

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('panel_corner_cam_142_5')`).

| Alan | Değer |
|---|---|
| itemKey | `panel_corner_cam_142_5` |
| Ad | Cam İç Köşe Paneli 142,5 × 47 cm |
| Tip | `panel-glass` |
| Birim | `adet` |
| Malzeme | cam |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=142.5`, `depth_cm=0.8`, `height_cm=47` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`panel-glass` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_item_surface_flags.py`
- `test/mapCatalogSeed.mjs`
- `test/panelCamFamily.test.js`
- `test/panelGlassBom.test.js`
