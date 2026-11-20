# panel_finish_mese

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('panel_finish_mese')`).

| Alan | Değer |
|---|---|
| itemKey | `panel_finish_mese` |
| Ad | Meşe |
| Tip | `panel-finish` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=141`, `height_cm=100` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#d9b27c` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`panel-finish` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_panel_finishes_migration.py`
- `e2e/f028-reset-features.spec.mjs`
- `e2e/panel-finish.spec.mjs`
- `test/panelFinish.test.js`
- `test/resetModuleFeatures.test.js`
