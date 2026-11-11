# wall_150_short_1

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('wall_150_short_1')`).

| Alan | Değer |
|---|---|
| itemKey | `wall_150_short_1` |
| Ad | Panel Tek Sıra 150 |
| Tip | `flat-panel` |
| Birim | — |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | `wall-short-1` |
| Ölçü | `width_cm=150` |
| Sahne ölçüsü | `depth_cm=10` |
| Varsayılan renk | — |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('wall_150_short_1')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_140_5` | 2 |
| `upright_49_5` | 2 |
| `panel_147_5` | 1 |
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

- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/wall-height-matrix.spec.mjs`
- `e2e/wall-short-width.spec.mjs`
- `test/mapCatalogSeed.mjs`
- `test/sceneBomAcceptance.test.js`
- `test/uprightFieldPlacement.test.js`
- `test/wallShortCanonicalRename.test.js`
- `test/wallShortRelationshipBom.test.js`
- `test/wallShortWidth.test.js`
