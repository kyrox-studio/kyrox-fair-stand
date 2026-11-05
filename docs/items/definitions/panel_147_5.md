# panel_147_5

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('panel_147_5')`).

| Alan | Değer |
|---|---|
| itemKey | `panel_147_5` |
| Ad | Panel 147,5 × 47 cm |
| Tip | `panel` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Ölçü | `width_cm=147.5`, `depth_cm=0.8`, `height_cm=47` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_150`, `desk_banko_150`, `desk_banko_150_l`, `wall_150_350`, `wall_150_short_1`, `wall_150_short_2`.

## Tip davranışı

`panel` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/baseRunBom.js`

## Testler

- `test/baseItemsContract.test.js`
- `test/baseRecipes.test.js`
- `test/baseRunBom.test.js`
- `test/boardMaterialItemContract.test.js`
- `test/cornerPanelsItemContract.test.js`
- `test/counterModule.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/lCounter150Contract.test.js`
- `test/moduleRecipes.test.js`
- `test/panelCamFamily.test.js`
- `test/printAreaBom.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/straightPanelsItemContract.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortRelationshipBom.test.js`
