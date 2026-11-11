# panel_48_5

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('panel_48_5')`).

| Alan | Değer |
|---|---|
| itemKey | `panel_48_5` |
| Ad | Panel 48,5 × 47 cm |
| Tip | `panel` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=48.5`, `depth_cm=0.8`, `height_cm=47` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_100`, `base_150`, `base_200`, `desk_banko_100`, `desk_banko_100_l`, `desk_banko_150`, `desk_banko_150_l`, `desk_banko_200`, `desk_banko_200_l`, `wall_50_350`, `wall_50_short_1`, `wall_50_short_2`.

## Tip davranışı

`panel` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/baseRunBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `test/baseRunBom.test.js`
- `test/boardMaterialItemContract.test.js`
- `test/cornerPanelsItemContract.test.js`
- `test/counterModule.test.js`
- `test/counterRecipes.test.js`
- `test/lCounter150Contract.test.js`
- `test/lCounter200Contract.test.js`
- `test/mapCatalogSeed.mjs`
- `test/moduleRecipes.test.js`
- `test/panelCamFamily.test.js`
- `test/panelGlassBom.test.js`
- `test/printAreaBom.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/straightPanelsItemContract.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallShortCanonicalRename.test.js`
