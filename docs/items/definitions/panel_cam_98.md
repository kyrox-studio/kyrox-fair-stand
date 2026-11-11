# panel_cam_98

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('panel_cam_98')`).

| Alan | Değer |
|---|---|
| itemKey | `panel_cam_98` |
| Ad | Cam Panel 98 × 47 cm |
| Tip | `panel-glass` |
| Birim | `adet` |
| Malzeme | cam |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=98`, `depth_cm=0.8`, `height_cm=47` |
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
- `test/flatPanelBackStrips.test.js`
- `test/mapCatalogSeed.mjs`
- `test/panelCamFamily.test.js`
