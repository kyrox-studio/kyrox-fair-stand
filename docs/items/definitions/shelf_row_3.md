# shelf_row_3

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('shelf_row_3')`).

| Alan | Değer |
|---|---|
| itemKey | `shelf_row_3` |
| Ad | 3 sıralı raf |
| Tip | `shelf` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Varyant ailesi | `shelf-row` |
| Ölçü | `width_cm=100`, `depth_cm=38`, `height_cm=101.8` |
| Sahne ölçüsü | `width_cm=100`, `height_cm=101.8` |
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

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_catalog_seed.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/shelf-items-contract.spec.mjs`
- `e2e/shelf-rows-flow.spec.mjs`
- `test/catalogDragItemKeyInvariant.test.js`
- `test/catalogWidthFamily.test.js`
- `test/mapCatalogSeed.mjs`
- `test/shelfCatalogPanelSeam.test.js`
- `test/shelfWidthVariantPlacement.test.js`
