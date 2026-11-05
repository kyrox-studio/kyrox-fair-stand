# parke-sari

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('parke-sari')`).

| Alan | Değer |
|---|---|
| itemKey | `parke-sari` |
| Ad | Sarı Meşe |
| Tip | `floor` |
| Birim | `m2` |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | `width_cm=140`, `depth_cm=16` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ad8e76` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`floor` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_item_unit_fk_migration.py`
- `backend/tests/modules/fair_stand/test_parquet_reference_migration.py`
- `e2e/floor-items-contract.spec.mjs`
- `test/floorArea.test.js`
- `test/floorItemsContract.test.js`
- `test/projectBom.test.js`
