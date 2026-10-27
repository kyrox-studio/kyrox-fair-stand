# connector_start

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

| Alan | Değer |
|---|---|
| itemKey | `connector_start` |
| Ad | Başlangıç Aparatı |
| Tip | `connector` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | — |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_100`, `base_150`, `base_200`, `desk_banko_100`, `desk_banko_100_l`, `desk_banko_150`, `desk_banko_150_l`, `desk_banko_200`, `desk_banko_200_l`, `wall_100_350`, `wall_100_short_1`, `wall_100_short_2`, `wall_150_350`, `wall_150_short_1`, `wall_150_short_2`, `wall_200_350`, `wall_200_short_1`, `wall_200_short_2`, `wall_50_350`, `wall_50_short_1`, `wall_50_short_2`, `wall_door_100_350`, `wall_separator_100_350`, `wall_separator_100_350_sarmasik`, `wall_separator_50_350`, `wall_separator_50_350_sarmasik`, `wall_showcase_100_2_350`, `wall_showcase_100_3_350`.

## Tip davranışı

`connector` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/baseRunBom.js`
- `src/relationshipBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_surface_flags.py`
- `test/baseRunBom.test.js`
- `test/counterRecipes.test.js`
- `test/doorCompositeItemContract.test.js`
- `test/itemIsRenderFactory.test.js`
- `test/itemSceneDimensions.test.js`
- `test/itemSurfaceCapabilitySoT.test.js`
- `test/lCounter150Contract.test.js`
- `test/lCounter200Contract.test.js`
- `test/moduleRecipes.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomEndToEnd.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/separatorRecipes.test.js`
- `test/showcaseRecipes.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortProfileSnapCollision.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShowcaseItemContract.test.js`
