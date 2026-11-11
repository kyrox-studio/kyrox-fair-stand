# wall_showcase_100_2_350

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('wall_showcase_100_2_350')`).

| Alan | Değer |
|---|---|
| itemKey | `wall_showcase_100_2_350` |
| Ad | 2 Gözlü Vitrin 100 |
| Tip | `showcase-2` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | `wall-showcase` |
| Ölçü | `width_cm=100` |
| Sahne ölçüsü | `depth_cm=10`, `height_cm=350` |
| Varsayılan renk | — |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('wall_showcase_100_2_350')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_91` | 4 |
| `upright_346_5` | 2 |
| `panel_98` | 5 |
| `connector_start` | 4 |
| `connector_single` | 9 |
| `showcase_side_94_6_30` | 2 |
| `showcase_horizontal_87_4_30` | 2 |
| `glass_shelf` | 1 |

## Tip davranışı

`showcase-2` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `src/relationshipBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/wall-height-matrix.spec.mjs`
- `e2e/wall-height.spec.mjs`
- `e2e/wall-showcase-item-contract.spec.mjs`
- `test/baseRunBom.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/catalogWidthFamily.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/mapCatalogSeed.mjs`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shelfCatalogPanelSeam.test.js`
- `test/showcaseAppearance.test.js`
- `test/showcaseBodyColorRegression.test.js`
- `test/showcaseRecipes.test.js`
- `test/wallHeightProjects.mjs`
- `test/wallHeightRecipe.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShowcaseItemContract.test.js`
