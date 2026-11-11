# profile_91

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('profile_91')`).

| Alan | Değer |
|---|---|
| itemKey | `profile_91` |
| Ad | Profil 91 |
| Tip | `profile` |
| Birim | `adet` |
| Malzeme | alüminyum |
| Katalog | görünmez |
| Varyant ailesi | `profile` |
| Ölçü | `width_cm=91`, `depth_cm=8`, `height_cm=8` |
| Sahne ölçüsü | `width_cm=100`, `depth_cm=8`, `height_cm=350` |
| Varsayılan renk | `#d0d3d4` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_100`, `desk_banko_100`, `desk_banko_100_l`, `desk_banko_150_l`, `wall_100_350`, `wall_100_short_1`, `wall_100_short_2`, `wall_door_100_350`, `wall_separator_100_350`, `wall_separator_100_350_sarmasik`, `wall_showcase_100_2_350`, `wall_showcase_100_3_350`.

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

- `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/flat-panel-back-strips.spec.mjs`
- `e2e/vertical-move-upright-height.spec.mjs`
- `test/baseItemsContract.test.js`
- `test/baseRecipes.test.js`
- `test/baseRunBom.test.js`
- `test/counterRecipes.test.js`
- `test/doorCompositeItemContract.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/itemAssembly.test.js`
- `test/itemSceneDimensions.test.js`
- `test/lCounter150Contract.test.js`
- `test/mapCatalogSeed.mjs`
- `test/modulePlacement.test.js`
- `test/moduleRecipes.test.js`
- `test/profile190ItemContract.test.js`
- `test/profileFieldPlacement.test.js`
- `test/profileIntrinsicProperties.test.js`
- `test/profileLength.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomEndToEnd.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/separatorRecipes.test.js`
- `test/showcaseRecipes.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortProfileSnapCollision.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShowcaseItemContract.test.js`
