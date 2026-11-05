# shelf_leg

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('shelf_leg')`).

| Alan | Değer |
|---|---|
| itemKey | `shelf_leg` |
| Ad | Raf Ayağı |
| Tip | `shelf-accessory` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | — |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `shelf_100`, `shelf_100_self`, `shelf_150`, `shelf_150_self`, `shelf_200`, `shelf_200_self`.

## Tip davranışı

`shelf-accessory` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_admin_items_api.py`
- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `e2e/shelf-rows-flow.spec.mjs`
- `test/bomLineGroups.test.js`
- `test/itemSceneDimensions.test.js`
- `test/itemSurfaceFlagAudit.test.js`
- `test/moduleRecipes.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shelfLegItemContract.test.js`
- `test/shelfRecipeBom.test.js`
- `test/wallShelfItemsContract.test.js`
