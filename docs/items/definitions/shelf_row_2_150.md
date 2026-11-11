# shelf_row_2_150

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('shelf_row_2_150')`).

| Alan | Değer |
|---|---|
| itemKey | `shelf_row_2_150` |
| Ad | 2 sıralı raf 150 cm |
| Tip | `shelf` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez, Raf & Vitrin |
| Varyant ailesi | — |
| Ölçü | `width_cm=150`, `depth_cm=38`, `height_cm=51.8` |
| Sahne ölçüsü | `width_cm=150`, `height_cm=51.8` |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('shelf_row_2_150')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `shelf_150` | 2 |

## Tip davranışı

`shelf` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `wall-overlay` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `False` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `exclude` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_catalog_seed.py`
- `backend/tests/modules/fair_stand/test_shelf_rows_migration.py`
- `e2e/shelf-rows-flow.spec.mjs`
- `e2e/shelf-width-variant.spec.mjs`
- `test/catalogWidthFamily.test.js`
- `test/mapCatalogSeed.mjs`
- `test/shelfRowsRender.test.js`
