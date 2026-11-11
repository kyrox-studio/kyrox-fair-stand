# karolaj

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('karolaj')`).

| Alan | Değer |
|---|---|
| itemKey | `karolaj` |
| Ad | Karolaj |
| Tip | `floor` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=100`, `depth_cm=100` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#e9edf1` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`floor` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/floorArea.js`
- `src/items.js`
- `src/main.js`
- `src/scene3d.js`
- `src/standStandardsCopy.js`

## Testler

- `e2e/floor-area.spec.mjs`
- `e2e/floor-items-contract.spec.mjs`
- `e2e/project-import-export-roundtrip.spec.mjs`
- `e2e/stage-result-after-restore.spec.mjs`
- `test/boothTypes.test.js`
- `test/floorArea.test.js`
- `test/floorItemsContract.test.js`
- `test/projectBom.test.js`
- `test/projectImportValidation.test.js`
