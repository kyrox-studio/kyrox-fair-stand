# panel_98

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('panel_98')`).

| Alan | Değer |
|---|---|
| itemKey | `panel_98` |
| Ad | Panel 98 × 47 cm |
| Tip | `panel` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=98`, `depth_cm=0.8`, `height_cm=47` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_100`, `desk_banko_100`, `desk_banko_100_l`, `wall_100_350`, `wall_100_short_1`, `wall_100_short_2`, `wall_door_100_350`, `wall_showcase_100_2_350`, `wall_showcase_100_3_350`.

## Tip davranışı

`panel` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/baseRunBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_unit_fk_migration.py`
- `e2e/flat-panel-back-strips.spec.mjs`
- `test/baseItemsContract.test.js`
- `test/baseRecipes.test.js`
- `test/baseRunBom.test.js`
- `test/boardMaterialItemContract.test.js`
- `test/cornerPanelsItemContract.test.js`
- `test/counterModule.test.js`
- `test/counterRecipes.test.js`
- `test/counterTopDefaultColor.test.js`
- `test/doorCompositeItemContract.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/itemAssembly.test.js`
- `test/itemIsRenderFactory.test.js`
- `test/mapCatalogSeed.mjs`
- `test/moduleRecipes.test.js`
- `test/panelCamFamily.test.js`
- `test/printAreaBom.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomEndToEnd.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/showcaseRecipes.test.js`
- `test/straightPanelsItemContract.test.js`
- `test/tulleFabric.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortProfileSnapCollision.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShowcaseItemContract.test.js`
