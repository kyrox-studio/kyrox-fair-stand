# led_floodlight

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('led_floodlight')`).

| Alan | Değer |
|---|---|
| itemKey | `led_floodlight` |
| Ad | LED Projektör |
| Tip | `led-floodlight` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Elektronik & Aydınlatma |
| Varyant ailesi | — |
| Ölçü | `width_cm=50`, `depth_cm=20`, `height_cm=35`, `mount_height_cm=350` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#17191c` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`led-floodlight` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `top` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `exclude` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/items.js`
- `src/scene3d.js`
- `src/selectionFeedback.js`

## Testler

- `backend/tests/modules/fair_stand/test_booth_types.py`
- `backend/tests/modules/fair_stand/test_illuminated_foam_card_migration.py`
- `backend/tests/modules/fair_stand/test_item_default_z.py`
- `backend/tests/modules/fair_stand/test_item_snap.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/f010-module-construction.spec.mjs`
- `e2e/lighting-items-contract.spec.mjs`
- `e2e/new-project-wizard.spec.mjs`
- `e2e/scene-select-all.spec.mjs`
- `e2e/wall-reflow-u-stand.spec.mjs`
- `test/automaticWall.test.js`
- `test/catalogCategories.test.js`
- `test/catalogWidthFamily.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemDefaultZCm.test.js`
- `test/itemSnapAnchor.test.js`
- `test/ledFloodlightModule.test.js`
- `test/lightingItemsContract.test.js`
- `test/moduleRotationPolicy.test.js`
- `test/standResizeWallHeight.test.js`
- `test/verticalMoveUprightHeight.test.js`
- `test/wallHeightTopRail.test.js`
