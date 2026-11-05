# tulle_fabric

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('tulle_fabric')`).

| Alan | Değer |
|---|---|
| itemKey | `tulle_fabric` |
| Ad | Tül |
| Tip | `tulle-fabric` |
| Birim | `metre_kare` |
| Malzeme | — |
| Katalog | görünür, Extra |
| Ölçü | `width_cm=200`, `depth_cm=0.4`, `height_cm=100` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`tulle-fabric` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `src/printAreaBom.js`
- `src/projectBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_item_cost_enabled.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `backend/tests/modules/fair_stand/test_vertical_move_migration.py`
- `test/bomLineGroups.test.js`
- `test/catalogCategories.test.js`
- `test/itemCatalogFields.test.js`
- `test/tulleFabric.test.js`
- `test/verticalMoveUprightHeight.test.js`
