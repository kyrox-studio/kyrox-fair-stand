# glass_table

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('glass_table')`).

| Alan | Değer |
|---|---|
| itemKey | `glass_table` |
| Ad | Cam Masa |
| Tip | `table-glass` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Extra |
| Ölçü | `width_cm=75`, `depth_cm=75`, `height_cm=74` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `furniture_table_chair_set_eames`.

## Tip davranışı

`table-glass` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/designState.js`
- `src/scene3d.js`

## Testler

- `backend/tests/modules/fair_stand/test_glass_bar_table_migration.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/glass-bar-table.spec.mjs`
- `e2e/scene-select-all.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogWidthFamily.test.js`
- `test/chairEamesContract.test.js`
- `test/furnitureItemsContract.test.js`
- `test/glassBarTable.test.js`
- `test/glassTableContract.test.js`
- `test/itemCatalogFields.test.js`
- `test/verticalMoveUprightHeight.test.js`
