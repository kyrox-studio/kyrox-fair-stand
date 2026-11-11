# panel_197

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('panel_197')`).

| Alan | Değer |
|---|---|
| itemKey | `panel_197` |
| Ad | Panel 197 × 47 cm |
| Tip | `panel` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=197`, `depth_cm=0.8`, `height_cm=47` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_200`, `desk_banko_200`, `desk_banko_200_l`, `wall_200_350`, `wall_200_short_1`, `wall_200_short_2`.

## Tip davranışı

`panel` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/baseRunBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_default_z.py`
- `backend/tests/modules/fair_stand/test_item_snap.py`
- `backend/tests/modules/fair_stand/test_item_surface_flags.py`
- `test/baseItemsContract.test.js`
- `test/baseRecipes.test.js`
- `test/baseRunBom.test.js`
- `test/boardMaterialItemContract.test.js`
- `test/bomLineGroups.test.js`
- `test/catalogCategories.test.js`
- `test/catalogDomainBoundary.test.js`
- `test/catalogItemProjection.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/counterModule.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/itemAssembly.test.js`
- `test/itemBoxDimensions.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemIsRenderFactory.test.js`
- `test/itemSnapAnchor.test.js`
- `test/itemSurfaceCapabilitySoT.test.js`
- `test/lCounter200Contract.test.js`
- `test/mapCatalogSeed.mjs`
- `test/metalSeparator.test.js`
- `test/moduleRecipes.test.js`
- `test/panel197ItemContract.test.js`
- `test/panelCamFamily.test.js`
- `test/panelCorner192ItemContract.test.js`
- `test/panelGlassBom.test.js`
- `test/printAreaBom.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomEndToEnd.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortRelationshipBom.test.js`
