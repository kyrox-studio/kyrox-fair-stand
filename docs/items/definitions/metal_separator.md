# metal_separator

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('metal_separator')`).

| Alan | Değer |
|---|---|
| itemKey | `metal_separator` |
| Ad | Metal Separatör |
| Tip | `panel-glass` |
| Birim | `metre_kare` |
| Malzeme | metal |
| Katalog | görünmez |
| Ölçü | `width_cm=98`, `depth_cm=0.8`, `height_cm=47` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`panel-glass` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/panelGlassBom.js`
- `src/productionBomPanel.js`
- `src/projectBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_item_cost_enabled.py`
- `test/metalSeparator.test.js`
