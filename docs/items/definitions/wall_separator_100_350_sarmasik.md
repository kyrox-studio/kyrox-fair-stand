# wall_separator_100_350_sarmasik

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('wall_separator_100_350_sarmasik')`).

| Alan | Değer |
|---|---|
| itemKey | `wall_separator_100_350_sarmasik` |
| Ad | Separatör 100 Sarmaşık |
| Tip | `separator` |
| Birim | — |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | `wall-separator-sarmasik` |
| Ölçü | `width_cm=100` |
| Sahne ölçüsü | `depth_cm=10`, `height_cm=350` |
| Varsayılan renk | — |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('wall_separator_100_350_sarmasik')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_91` | 2 |
| `upright_346_5` | 2 |
| `separator_panel_98` | 7 |
| `connector_start` | 2 |
| `connector_single` | 13 |

## Tip davranışı

`separator` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `wall` |
| collision | `segment` |
| moveSnapCm | `10` |
| magneticSnap | `standard` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `True` |
| wallCapacity | `include` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_panel_separator_cards_migration.py`
- `e2e/wall-height-matrix.spec.mjs`
- `test/catalogSingleSource.test.js`
- `test/catalogWidthFamily.test.js`
- `test/mapCatalogSeed.mjs`
- `test/moduleStateConstructionRegistry.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallSeparatorItemsContract.test.js`
- `test/wallShortRelationshipBom.test.js`
