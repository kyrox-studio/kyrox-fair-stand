# mini_fridge_avanti

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('mini_fridge_avanti')`).

| Alan | Değer |
|---|---|
| itemKey | `mini_fridge_avanti` |
| Ad | Mini Buzdolabı |
| Tip | `mini-fridge` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünür, Extra |
| Ölçü | `width_cm=50`, `depth_cm=50`, `height_cm=66` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`mini-fridge` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |
| overlapWithTypes | `('kettle',)` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/autoDepot.js`
- `src/featureContracts.js`
- `src/scene3d.js`

## Testler

- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/color-image-capability.spec.mjs`
- `e2e/commercial-items-contract.spec.mjs`
- `e2e/design-undo.spec.mjs`
- `e2e/f011-module-behavior.spec.mjs`
- `e2e/free-props-collision-none.spec.mjs`
- `e2e/invalid-placement-ghost.spec.mjs`
- `e2e/mini-fridge-dimensions.spec.mjs`
- `e2e/module-lock.spec.mjs`
- `e2e/module-move-snap.spec.mjs`
- `e2e/pinch-zoom-no-drag.spec.mjs`
- `e2e/project-import-export-roundtrip.spec.mjs`
- `e2e/rapid-actions-responsive.spec.mjs`
- `e2e/reload-restore.spec.mjs`
- `e2e/selection-toolbar.spec.mjs`
- `e2e/shelf-items-contract.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogDomainBoundary.test.js`
- `test/commercialItemsContract.test.js`
- `test/itemCatalogFields.test.js`
- `test/miniFridge.test.js`
- `test/moduleRotationPolicy.test.js`
