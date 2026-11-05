# counter_top_160_60

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('counter_top_160_60')`).

| Alan | Değer |
|---|---|
| itemKey | `counter_top_160_60` |
| Ad | Banko Üstü 160 × 60 cm |
| Tip | `counter-top` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Ölçü | `width_cm=160`, `depth_cm=60`, `height_cm=1.8` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#f8fafc` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `desk_banko_150`, `desk_banko_150_l`.

## Tip davranışı

`counter-top` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `test/boardMaterialItemContract.test.js`
- `test/counterRecipes.test.js`
- `test/counterTopDefaultColor.test.js`
- `test/lCounter150Contract.test.js`
- `test/recipeCompositionItemsContract.test.js`
