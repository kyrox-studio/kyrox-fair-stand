# glass_shelf

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('glass_shelf')`).

| Alan | Değer |
|---|---|
| itemKey | `glass_shelf` |
| Ad | Cam Raf |
| Tip | `showcase-accessory` |
| Birim | `adet` |
| Malzeme | cam |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=87.3`, `depth_cm=28.5`, `height_cm=0.6` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `wall_showcase_100_2_350`, `wall_showcase_100_3_350`.

## Tip davranışı

`showcase-accessory` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/application/item_mapper.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `backend/app/modules/fair_stand/infrastructure/models.py`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `test/glassShelfItemContract.test.js`
- `test/itemIsRenderFactory.test.js`
- `test/moduleRecipes.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shelfCatalogPanelSeam.test.js`
- `test/showcaseRecipes.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShowcaseItemContract.test.js`
