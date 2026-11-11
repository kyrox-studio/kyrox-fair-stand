# upright_346_5

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('upright_346_5')`).

| Alan | Değer |
|---|---|
| itemKey | `upright_346_5` |
| Ad | Dikme 346,5 |
| Tip | `upright` |
| Birim | `adet` |
| Malzeme | alüminyum |
| Katalog | görünür, Panel Ek Modül |
| Varyant ailesi | `upright` |
| Ölçü | `width_cm=8`, `depth_cm=8`, `height_cm=346.5` |
| Sahne ölçüsü | `width_cm=8`, `depth_cm=8`, `height_cm=346.5` |
| Varsayılan renk | `#d0d3d4` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `wall_100_350`, `wall_150_350`, `wall_200_350`, `wall_50_350`, `wall_door_100_350`, `wall_separator_100_350`, `wall_separator_100_350_sarmasik`, `wall_separator_50_350`, `wall_separator_50_350_sarmasik`, `wall_showcase_100_2_350`, `wall_showcase_100_3_350`.

## Tip davranışı

`upright` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `footprint` |
| moveSnapCm | `10` |
| magneticSnap | `short-up-joint` |
| allowSideInsert | `False` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `exclude` |
| overlapWithTypes | `('flat-panel', 'profile', 'counter')` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/designState.js`
- `src/modulePlacement.js`
- `src/relationshipBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_length_parts_migration.py`
- `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`
- `backend/tests/modules/fair_stand/test_vertical_move_migration.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/flat-panel-back-strips.spec.mjs`
- `e2e/invalid-placement-ghost.spec.mjs`
- `e2e/short-joint-structural-upright.spec.mjs`
- `e2e/vertical-move-upright-height.spec.mjs`
- `e2e/wall-short-width.spec.mjs`
- `test/autoFascia.test.js`
- `test/baseRunBom.test.js`
- `test/catalogCategories.test.js`
- `test/catalogItemProjection.test.js`
- `test/doorCompositeItemContract.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/itemBoxDimensions.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemLengthParts.test.js`
- `test/itemSceneDimensions.test.js`
- `test/itemScenePose.test.js`
- `test/moduleRecipes.test.js`
- `test/panelGlassBom.test.js`
- `test/profileLength.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomEndToEnd.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/separatorRecipes.test.js`
- `test/shortJointStructuralUpright.test.js`
- `test/showcaseRecipes.test.js`
- `test/standResizeWallHeight.test.js`
- `test/upright3465ItemContract.test.js`
- `test/uprightFieldPlacement.test.js`
- `test/uprightIntrinsicProperties.test.js`
- `test/variantFamilies.test.js`
- `test/verticalMoveUprightHeight.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortProfileSnapCollision.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShowcaseItemContract.test.js`
