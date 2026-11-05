# wall_separator_100_350

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('wall_separator_100_350')`).

| Alan | Değer |
|---|---|
| itemKey | `wall_separator_100_350` |
| Ad | Separatör 100 |
| Tip | `separator` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Panel & Duvar |
| Ölçü | `width_cm=100` |
| Sahne ölçüsü | `depth_cm=10`, `height_cm=350` |
| Varsayılan renk | — |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('wall_separator_100_350')` ile bu satırlardan çözülür.

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

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/designState.js`

## Testler

- `backend/tests/modules/fair_stand/test_panel_separator_cards_migration.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/helpers/catalogWidth.mjs`
- `e2e/wall-height-matrix.spec.mjs`
- `e2e/wall-separator-items-contract.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogItemProjection.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/catalogSingleSource.test.js`
- `test/catalogWidthFamily.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemSceneDimensions.test.js`
- `test/moduleStateConstructionRegistry.test.js`
- `test/profileFieldPlacement.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/wallHeightProjects.mjs`
- `test/wallHeightRecipe.test.js`
- `test/wallSeparatorItemsContract.test.js`
- `test/wallShortRelationshipBom.test.js`
