# furniture_bar_stool_classic

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('furniture_bar_stool_classic')`).

| Alan | Değer |
|---|---|
| itemKey | `furniture_bar_stool_classic` |
| Ad | Bar Taburesi |
| Tip | `bar-stool` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Extra |
| Ölçü | `width_cm=60`, `depth_cm=55`, `height_cm=121` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`bar-stool` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `backend/app/modules/fair_stand/infrastructure/item_rotation_seed.py`
- `src/autoFurniture.js`
- `src/featureContracts.js`
- `src/scene3d.js`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `test/barStool2.test.js`
- `test/catalogCategories.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemRotation.test.js`
- `test/moduleBehavior.test.js`
- `test/moduleBehaviorPolicy.test.js`
- `test/modulePlacement.test.js`
- `test/moduleRotationPolicy.test.js`
