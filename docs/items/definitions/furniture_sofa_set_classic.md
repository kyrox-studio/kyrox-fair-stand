# furniture_sofa_set_classic

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('furniture_sofa_set_classic')`).

| Alan | Değer |
|---|---|
| itemKey | `furniture_sofa_set_classic` |
| Ad | Koltuk Takımı |
| Tip | `sofa-set-classic` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Extra |
| Varyant ailesi | — |
| Ölçü | `width_cm=150`, `depth_cm=150`, `height_cm=78` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

`composition_mode=None`. BOM `src/itemBom.js` `resolveItemBom('furniture_sofa_set_classic')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `furniture_sofa_double_classic` | 1 |
| `furniture_sofa_single_classic` | 2 |
| `furniture_coffee_table_classic` | 1 |

## Tip davranışı

`sofa-set-classic` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `footprint` |
| moveSnapCm | `10` |
| magneticSnap | `standard` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |
| boundary_snap | `wall-inner-face` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/scene3d.js`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/furniture-items-contract.spec.mjs`
- `test/catalogCategories.test.js`
- `test/itemCatalogFields.test.js`
- `test/projectBom.test.js`
- `test/recipeCompositionItemsContract.test.js`
- `test/sofaClassicPiecesContract.test.js`
