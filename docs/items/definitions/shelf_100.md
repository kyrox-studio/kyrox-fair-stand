# shelf_100

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('shelf_100')`).

| Alan | Değer |
|---|---|
| itemKey | `shelf_100` |
| Ad | Raf 100 cm |
| Tip | `shelf` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez, Raf & Vitrin |
| Ölçü | `width_cm=100`, `depth_cm=38`, `height_cm=1.8` |
| Sahne ölçüsü | `width_cm=100`, `height_cm=1.8` |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('shelf_100')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `shelf_100_self` | 1 |
| `shelf_leg` | 2 |

Alt kalem olarak kullanıldığı Item'lar: `shelf_row_2_100`, `shelf_row_3_100`.

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

- `backend/tests/modules/fair_stand/test_admin_catalog_api.py`
- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_catalog_seed.py`
- `backend/tests/modules/fair_stand/test_item_snap.py`
- `backend/tests/modules/fair_stand/test_shelf_rows_migration.py`
- `e2e/shelf-rows-flow.spec.mjs`
- `test/boardMaterialItemContract.test.js`
- `test/catalogDomainBoundary.test.js`
- `test/catalogWidthFamily.test.js`
- `test/itemBoxDimensions.test.js`
- `test/itemSnapAnchor.test.js`
- `test/moduleRecipes.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shelfCatalogPanelSeam.test.js`
- `test/shelfLighting.test.js`
- `test/shelfModule.test.js`
- `test/shelfRecipeBom.test.js`
- `test/wallShelfItemsContract.test.js`
