# wall_100_short_2

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('wall_100_short_2')`).

| Alan | Değer |
|---|---|
| itemKey | `wall_100_short_2` |
| Ad | Panel Çift Sıra 100 |
| Tip | `flat-panel` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Panel Ek Modül |
| Ölçü | `width_cm=100` |
| Sahne ölçüsü | `depth_cm=10` |
| Varsayılan renk | — |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('wall_100_short_2')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_91` | 2 |
| `upright_99` | 2 |
| `panel_98` | 2 |
| `connector_start` | 2 |
| `connector_single` | 3 |

## Tip davranışı

`flat-panel` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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

- `backend/tests/modules/fair_stand/test_vertical_move_migration.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/wall-height-matrix.spec.mjs`
- `e2e/wall-short-width.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogItemProjection.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/itemCatalogFields.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/uprightFieldPlacement.test.js`
- `test/verticalMoveUprightHeight.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShortVerticalMove.test.js`
- `test/wallShortWidth.test.js`
