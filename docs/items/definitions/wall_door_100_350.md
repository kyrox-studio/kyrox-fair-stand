# wall_door_100_350

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('wall_door_100_350')`).

| Alan | Değer |
|---|---|
| itemKey | `wall_door_100_350` |
| Ad | Depo Kapısı 100 |
| Tip | `door` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünür, Panel & Duvar |
| Varyant ailesi | — |
| Ölçü | `width_cm=100` |
| Sahne ölçüsü | `depth_cm=10`, `height_cm=350` |
| Varsayılan renk | — |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('wall_door_100_350')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_91` | 1 |
| `upright_346_5` | 2 |
| `panel_98` | 3 |
| `connector_start` | 2 |
| `connector_single` | 5 |
| `door_leaf_100` | 1 |

## Tip davranışı

`door` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `src/autoDepot.js`
- `src/designState.js`
- `src/relationshipBom.js`
- `src/standResize.js`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_panel_separator_cards_migration.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/f010-module-construction.spec.mjs`
- `e2e/shelf-width-variant.spec.mjs`
- `e2e/wall-height-matrix.spec.mjs`
- `e2e/wall-height.spec.mjs`
- `test/baseRunBom.test.js`
- `test/canonicalDimensionDedup.test.js`
- `test/catalogCategories.test.js`
- `test/catalogWidthFamily.test.js`
- `test/doorCompositeItemContract.test.js`
- `test/doorLeafItemContract.test.js`
- `test/doorShelfPanelSeams.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/itemCatalogFields.test.js`
- `test/moduleRecipes.test.js`
- `test/moduleStateConstructionRegistry.test.js`
- `test/printAreaBom.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/wallHeightProjects.mjs`
- `test/wallHeightRecipe.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortRelationshipBom.test.js`
