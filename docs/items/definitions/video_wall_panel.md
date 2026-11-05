# video_wall_panel

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('video_wall_panel')`).

| Alan | Değer |
|---|---|
| itemKey | `video_wall_panel` |
| Ad | Video Wall Panel |
| Tip | `video-wall-panel` |
| Birim | — |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | `width_cm=108.5`, `height_cm=61` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`video-wall-panel` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `test/catalogDomainBoundary.test.js`
- `test/itemIsRenderFactory.test.js`
- `test/wallMediaItemsContract.test.js`
