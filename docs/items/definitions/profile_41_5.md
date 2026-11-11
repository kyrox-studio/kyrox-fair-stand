# profile_41_5

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('profile_41_5')`).

| Alan | Değer |
|---|---|
| itemKey | `profile_41_5` |
| Ad | Profil 41,5 |
| Tip | `profile` |
| Birim | `adet` |
| Malzeme | alüminyum |
| Katalog | görünmez |
| Varyant ailesi | `profile` |
| Ölçü | `width_cm=41.5`, `depth_cm=8`, `height_cm=8` |
| Sahne ölçüsü | `width_cm=50`, `depth_cm=8`, `height_cm=350` |
| Varsayılan renk | `#d0d3d4` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_100`, `base_150`, `base_200`, `desk_banko_100`, `desk_banko_100_l`, `desk_banko_150`, `desk_banko_150_l`, `desk_banko_200`, `desk_banko_200_l`, `wall_50_350`, `wall_50_short_1`, `wall_50_short_2`, `wall_separator_50_350`, `wall_separator_50_350_sarmasik`.

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

- `backend/tests/modules/fair_stand/test_item_length_parts_migration.py`
- `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/vertical-move-upright-height.spec.mjs`
- `test/baseRunBom.test.js`
- `test/counterRecipes.test.js`
- `test/itemAdminAssemblyLock.test.js`
- `test/itemLengthParts.test.js`
- `test/lCounter150Contract.test.js`
- `test/lCounter200Contract.test.js`
- `test/mapCatalogSeed.mjs`
- `test/moduleRecipes.test.js`
- `test/profile190ItemContract.test.js`
- `test/profileFieldPlacement.test.js`
- `test/profileIntrinsicProperties.test.js`
- `test/profileLength.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/separatorRecipes.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortRelationshipBom.test.js`
