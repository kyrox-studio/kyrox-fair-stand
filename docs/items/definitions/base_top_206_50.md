# base_top_206_50

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('base_top_206_50')`).

| Alan | Değer |
|---|---|
| itemKey | `base_top_206_50` |
| Ad | Baza Üstü 206 × 50 cm |
| Tip | `base-top` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Ölçü | `width_cm=206`, `depth_cm=50`, `height_cm=1.8` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `base_200`.

## Tip davranışı

`base-top` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/baseRunBom.js`

## Testler

- `test/baseItemsContract.test.js`
- `test/baseRecipes.test.js`
- `test/baseRunBom.test.js`
- `test/boardMaterialItemContract.test.js`
- `test/recipeCompositionItemsContract.test.js`
