# door_leaf_100

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('door_leaf_100')`).

| Alan | Değer |
|---|---|
| itemKey | `door_leaf_100` |
| Ad | Ahşap Kapı Kanadı 100 × 200 cm |
| Tip | `door-leaf` |
| Birim | `adet` |
| Malzeme | ahşap |
| Katalog | görünmez |
| Ölçü | `width_cm=100`, `depth_cm=8`, `height_cm=200` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color`, `image` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `wall_door_100_350`.

## Tip davranışı

`door-leaf` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/designState.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_surface_flags.py`
- `e2e/f010-module-construction.spec.mjs`
- `test/designState.test.js`
- `test/doorCompositeItemContract.test.js`
- `test/doorLeafItemContract.test.js`
- `test/itemSurfaceCapabilitySoT.test.js`
- `test/moduleRecipes.test.js`
- `test/printAreaBom.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortRelationshipBom.test.js`
