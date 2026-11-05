# shelf_row_1

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('shelf_row_1')`).

| Alan | Değer |
|---|---|
| itemKey | `shelf_row_1` |
| Ad | Tekli raf |
| Tip | `shelf` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünür, Raf & Vitrin |
| Ölçü | `width_cm=100`, `depth_cm=38`, `height_cm=1.8` |
| Sahne ölçüsü | `width_cm=100`, `height_cm=1.8` |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

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
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/helpers/catalogWidth.mjs`
- `e2e/shelf-items-contract.spec.mjs`
- `e2e/shelf-rows-flow.spec.mjs`
- `e2e/shelf-width-variant.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogDomainBoundary.test.js`
- `test/catalogDragItemKeyInvariant.test.js`
- `test/catalogWidthFamily.test.js`
- `test/doorShelfPanelSeams.test.js`
- `test/itemCatalogFields.test.js`
- `test/shelfCatalogPanelSeam.test.js`
- `test/shelfWidthVariantPlacement.test.js`
