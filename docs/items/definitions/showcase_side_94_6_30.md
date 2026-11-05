# showcase_side_94_6_30

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('showcase_side_94_6_30')`).

| Alan | Değer |
|---|---|
| itemKey | `showcase_side_94_6_30` |
| Ad | Vitrin Yan Sunta 94,6 × 30 cm |
| Tip | `showcase-board` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Ölçü | `width_cm=94.6`, `depth_cm=30`, `height_cm=1.8` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `wall_showcase_100_2_350`.

## Tip davranışı

`showcase-board` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_showcase_body_color_migration.py`
- `test/boardMaterialItemContract.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/showcaseBodyBoardsItemContract.test.js`
- `test/showcaseRecipes.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShowcaseItemContract.test.js`
