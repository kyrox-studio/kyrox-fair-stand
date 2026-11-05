# wall_showcase_100_3_350

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('wall_showcase_100_3_350')`).

| Alan | Değer |
|---|---|
| itemKey | `wall_showcase_100_3_350` |
| Ad | 3 Gözlü Vitrin 100 |
| Tip | `showcase-3` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünür, Panel & Duvar |
| Ölçü | `width_cm=100` |
| Sahne ölçüsü | `depth_cm=10`, `height_cm=350` |
| Varsayılan renk | — |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('wall_showcase_100_3_350')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_91` | 4 |
| `upright_346_5` | 2 |
| `panel_98` | 4 |
| `connector_start` | 4 |
| `connector_single` | 7 |
| `showcase_side_143_5_30` | 2 |
| `showcase_horizontal_87_4_30` | 2 |
| `glass_shelf` | 2 |

## Tip davranışı

`showcase-3` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `src/relationshipBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_panel_separator_cards_migration.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/helpers/catalogWidth.mjs`
- `e2e/wall-height-matrix.spec.mjs`
- `e2e/wall-height.spec.mjs`
- `e2e/wall-showcase-item-contract.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/catalogWidthFamily.test.js`
- `test/itemCatalogFields.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shelfCatalogPanelSeam.test.js`
- `test/showcaseAppearance.test.js`
- `test/showcaseBodyColorRegression.test.js`
- `test/showcaseRecipes.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShowcaseItemContract.test.js`
