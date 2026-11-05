# separator_panel_48_5

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('separator_panel_48_5')`).

| Alan | Değer |
|---|---|
| itemKey | `separator_panel_48_5` |
| Ad | Separatör Paneli 48,5 × 47 cm |
| Tip | `separator-panel` |
| Birim | `adet` |
| Malzeme | mdf |
| Katalog | görünmez |
| Ölçü | `width_cm=48.5`, `depth_cm=0.8`, `height_cm=47` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#c79b63` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `wall_separator_50_350`, `wall_separator_50_350_sarmasik`.

## Tip davranışı

`separator-panel` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/designState.js`

## Testler

- `test/panelGlassBom.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/relationshipBomJoints.test.js`
- `test/separatorRecipes.test.js`
- `test/wallHeightProjectBom.test.js`
