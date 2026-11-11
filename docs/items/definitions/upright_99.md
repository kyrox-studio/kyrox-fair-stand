# upright_99

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('upright_99')`).

| Alan | Değer |
|---|---|
| itemKey | `upright_99` |
| Ad | Dikme 99 |
| Tip | `upright` |
| Birim | `adet` |
| Malzeme | alüminyum |
| Katalog | görünmez |
| Varyant ailesi | `upright` |
| Ölçü | `width_cm=8`, `depth_cm=8`, `height_cm=99` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#d0d3d4` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `desk_banko_100`, `desk_banko_100_l`, `desk_banko_150`, `desk_banko_150_l`, `desk_banko_200`, `desk_banko_200_l`, `wall_100_short_2`, `wall_150_short_2`, `wall_200_short_2`, `wall_50_short_2`.

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

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/relationshipBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_length_parts_migration.py`
- `backend/tests/modules/fair_stand/test_item_scene_pose.py`
- `backend/tests/modules/fair_stand/test_variant_families.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/short-joint-structural-upright.spec.mjs`
- `test/catalogDomainBoundary.test.js`
- `test/counterRecipes.test.js`
- `test/illuminatedFoamInteraction.test.js`
- `test/itemAdminAssemblyLock.test.js`
- `test/itemIsRenderFactory.test.js`
- `test/itemLengthParts.test.js`
- `test/itemScenePose.test.js`
- `test/lCounter150Contract.test.js`
- `test/lCounter200Contract.test.js`
- `test/mapCatalogSeed.mjs`
- `test/recipeCompositionItemsContract.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shortJointStructuralUpright.test.js`
- `test/standResizeWallHeight.test.js`
- `test/upright3465ItemContract.test.js`
- `test/upright99And495ItemContract.test.js`
- `test/uprightIntrinsicProperties.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortRelationshipBom.test.js`
