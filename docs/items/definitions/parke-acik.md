# parke-acik

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('parke-acik')`).

| Alan | Değer |
|---|---|
| itemKey | `parke-acik` |
| Ad | Beyaz Meşe |
| Tip | `floor` |
| Birim | `m2` |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=140`, `depth_cm=16` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#c9cac5` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`floor` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/floorArea.js`

## Testler

- `backend/tests/modules/fair_stand/test_parquet_reference_migration.py`
- `e2e/floor-items-contract.spec.mjs`
- `test/floorArea.test.js`
- `test/floorItemsContract.test.js`
- `test/projectImportValidation.test.js`
- `test/selectionFeedback.test.js`
