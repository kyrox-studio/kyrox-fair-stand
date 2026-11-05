# kettle

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('kettle')`).

| Alan | Değer |
|---|---|
| itemKey | `kettle` |
| Ad | Kettle |
| Tip | `kettle` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünür, Extra |
| Ölçü | `width_cm=24`, `depth_cm=19`, `height_cm=25` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`kettle` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |
| overlapWithTypes | `('mini-fridge',)` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `backend/app/modules/fair_stand/infrastructure/item_default_z_seed.py`
- `backend/app/modules/fair_stand/infrastructure/item_rotation_seed.py`
- `backend/app/modules/fair_stand/infrastructure/preview_kind_definitions.py`
- `src/autoDepot.js`
- `src/designState.js`
- `src/featureContracts.js`
- `src/items.js`
- `src/moduleBehavior.js`
- `src/moduleContracts.js`
- `src/scene3d.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_default_z.py`
- `backend/tests/modules/fair_stand/test_item_type_behavior.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/commercial-items-contract.spec.mjs`
- `e2e/f027-scene-reset.spec.mjs`
- `e2e/rapid-actions-responsive.spec.mjs`
- `test/autoDepot.test.js`
- `test/catalogCategories.test.js`
- `test/catalogDomainBoundary.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/commercialItemsContract.test.js`
- `test/depotFreeDragSnap.test.js`
- `test/freePropsCollisionNone.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemDefaultZCm.test.js`
- `test/itemRotationSeed.mjs`
- `test/itemSurfaceFlagsSeed.mjs`
- `test/itemTypeBehaviorDualRead.test.js`
- `test/itemTypeBehaviorSeed.mjs`
- `test/kettle.test.js`
- `test/moduleBehaviorPolicy.test.js`
- `test/moduleRotationPolicy.test.js`
- `test/plasticTrashBinModule.test.js`
