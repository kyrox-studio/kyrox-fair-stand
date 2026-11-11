# wall_200_short_2

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('wall_200_short_2')`).

| Alan | Değer |
|---|---|
| itemKey | `wall_200_short_2` |
| Ad | Panel Çift Sıra 200 |
| Tip | `flat-panel` |
| Birim | — |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | `wall-short-2` |
| Ölçü | `width_cm=200` |
| Sahne ölçüsü | `depth_cm=10` |
| Varsayılan renk | — |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('wall_200_short_2')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_190` | 2 |
| `upright_99` | 2 |
| `panel_197` | 2 |
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

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/designState.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_default_z.py`
- `backend/tests/modules/fair_stand/test_item_scene_pose.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/wall-height-matrix.spec.mjs`
- `e2e/wall-short-width.spec.mjs`
- `test/automaticWallItemLookup.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/itemDefaultZCm.test.js`
- `test/itemScenePose.test.js`
- `test/itemSnapAnchor.test.js`
- `test/mapCatalogSeed.mjs`
- `test/recipeWallPanelSlots.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/shortJointStructuralUpright.test.js`
- `test/stripOccupancy.test.js`
- `test/uprightFieldPlacement.test.js`
- `test/wallFlatPanelItemsContract.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortProfileSnapCollision.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShortVerticalMove.test.js`
