# furniture_table_chair_set_eames

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('furniture_table_chair_set_eames')`).

| Alan | Değer |
|---|---|
| itemKey | `furniture_table_chair_set_eames` |
| Ad | Eames Masa Sandalye Takımı |
| Tip | `table-chair-set-eames` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Extra |
| Ölçü | `width_cm=150`, `depth_cm=150`, `height_cm=82` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

`composition_mode=None`. BOM `src/itemBom.js` `resolveItemBom('furniture_table_chair_set_eames')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `glass_table` | 1 |
| `chair_eames` | 4 |

## Tip davranışı

`table-chair-set-eames` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/autoFurniture.js`
- `src/featureContracts.js`

## Testler

- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `test/catalogCategories.test.js`
- `test/chairEamesContract.test.js`
- `test/eamesTableChairSetContract.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemSurfaceFlagAudit.test.js`
- `test/recipeCompositionItemsContract.test.js`
