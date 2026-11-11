# shelf_200_self

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('shelf_200_self')`).

| Alan | Değer |
|---|---|
| itemKey | `shelf_200_self` |
| Ad | Raf 200 Tek |
| Tip | `shelf` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez, Raf & Vitrin |
| Varyant ailesi | — |
| Ölçü | `width_cm=200`, `depth_cm=38`, `height_cm=1.8` |
| Sahne ölçüsü | `width_cm=200`, `height_cm=1.8` |
| Varsayılan renk | `#ffffff` |
| Yüzey | — |

## Bileşim / BOM

`composition_mode=None`. BOM `src/itemBom.js` `resolveItemBom('shelf_200_self')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `shelf_leg` | 3 |

Alt kalem olarak kullanıldığı Item'lar: `shelf_200`.

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

- `e2e/shelf-rows-flow.spec.mjs`
- `test/itemSurfaceFlagAudit.test.js`
- `test/mapCatalogSeed.mjs`
- `test/recipeCompositionItemsContract.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shelfRecipeBom.test.js`
