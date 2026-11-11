# profile_190

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('profile_190')`).

| Alan | Değer |
|---|---|
| itemKey | `profile_190` |
| Ad | Profil 190 |
| Tip | `profile` |
| Birim | `adet` |
| Malzeme | alüminyum |
| Katalog | görünmez |
| Varyant ailesi | `profile` |
| Ölçü | `width_cm=190`, `depth_cm=8`, `height_cm=8` |
| Sahne ölçüsü | `width_cm=200`, `depth_cm=8`, `height_cm=350` |
| Varsayılan renk | `#d0d3d4` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_200`, `desk_banko_200`, `desk_banko_200_l`, `wall_200_350`, `wall_200_short_1`, `wall_200_short_2`.

## Tip davranışı

`profile` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `wall` |
| collision | `segment` |
| moveSnapCm | `10` |
| magneticSnap | `standard` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `True` |
| wallCapacity | `include` |
| overlapWithTypes | `('separator',)` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/baseRunBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_booth_types.py`
- `backend/tests/modules/fair_stand/test_item_default_z.py`
- `backend/tests/modules/fair_stand/test_item_scene_pose.py`
- `backend/tests/modules/fair_stand/test_item_snap.py`
- `backend/tests/modules/fair_stand/test_item_surface_flags.py`
- `backend/tests/modules/fair_stand/test_profile_346_5_migration.py`
- `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`
- `backend/tests/modules/fair_stand/test_variant_families.py`
- `backend/tests/modules/fair_stand/test_vertical_move_migration.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/long-part-split-label.spec.mjs`
- `e2e/new-project-wizard.spec.mjs`
- `e2e/vertical-move-upright-height.spec.mjs`
- `test/automaticWall.test.js`
- `test/baseItemsContract.test.js`
- `test/baseRecipes.test.js`
- `test/baseRunBom.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/itemBoxDimensions.test.js`
- `test/itemDefaultZCm.test.js`
- `test/itemSceneDimensions.test.js`
- `test/itemScenePose.test.js`
- `test/itemSnapAnchor.test.js`
- `test/lCounter200Contract.test.js`
- `test/mapCatalogSeed.mjs`
- `test/moduleBehaviorPolicy.test.js`
- `test/modulePlacement.test.js`
- `test/moduleRecipes.test.js`
- `test/profile190ItemContract.test.js`
- `test/profileFieldPlacement.test.js`
- `test/profileIntrinsicProperties.test.js`
- `test/profileLength.test.js`
- `test/profilesItemContract.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/recipeWallPanelSlots.test.js`
- `test/relationshipBomEndToEnd.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/uprightFieldPlacement.test.js`
- `test/verticalMoveUprightHeight.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortProfileSnapCollision.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShortVerticalMove.test.js`
