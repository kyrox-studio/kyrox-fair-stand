# shelf_200

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('shelf_200')`).

| Alan | Değer |
|---|---|
| itemKey | `shelf_200` |
| Ad | Raf 200 cm |
| Tip | `shelf` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez, Raf & Vitrin |
| Ölçü | `width_cm=200`, `depth_cm=38`, `height_cm=1.8` |
| Sahne ölçüsü | `width_cm=200`, `height_cm=1.8` |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('shelf_200')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `shelf_200_self` | 1 |
| `shelf_leg` | 3 |

Alt kalem olarak kullanıldığı Item'lar: `shelf_row_2_200`, `shelf_row_3_200`.

## Tip davranışı

`shelf` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `wall-overlay` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `False` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `exclude` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_catalog_seed.py`
- `backend/tests/modules/fair_stand/test_shelf_rows_migration.py`
- `e2e/shelf-rows-flow.spec.mjs`
- `test/boardMaterialItemContract.test.js`
- `test/bomLineGroups.test.js`
- `test/catalogWidthFamily.test.js`
- `test/moduleRecipes.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shelfCatalogPanelSeam.test.js`
- `test/shelfModule.test.js`
- `test/shelfRecipeBom.test.js`
- `test/wallShortRelationshipBom.test.js`
