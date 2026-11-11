# desk_banko_200

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('desk_banko_200')`).

| Alan | Değer |
|---|---|
| itemKey | `desk_banko_200` |
| Ad | Banko 200 |
| Tip | `counter` |
| Birim | — |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | `desk-banko` |
| Ölçü | `width_cm=200`, `depth_cm=50`, `height_cm=100` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | `color`, `image` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('desk_banko_200')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_190` | 3 |
| `profile_41_5` | 4 |
| `upright_99` | 4 |
| `panel_197` | 2 |
| `panel_48_5` | 4 |
| `connector_start` | 6 |
| `connector_single` | 12 |
| `counter_top_210_60` | 1 |

## Tip davranışı

`counter` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `footprint` |
| moveSnapCm | `10` |
| magneticSnap | `standard` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |
| connection_endpoint | `logical-fixture` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `backend/app/modules/fair_stand/infrastructure/item_rotation_seed.py`
- `src/designState.js`

## Testler

- `backend/tests/modules/fair_stand/test_banko_base_cards_migration.py`
- `e2e/desk-banko-items-contract.spec.mjs`
- `e2e/double-click-select.spec.mjs`
- `e2e/selection-stale-clear.spec.mjs`
- `test/deskBankoItemsContract.test.js`
- `test/mapCatalogSeed.mjs`
- `test/moduleBehaviorPolicy.test.js`
- `test/moduleRotationPolicy.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/uprightFieldPlacement.test.js`
- `test/wallFlatPanelItemsContract.test.js`
- `test/wallShortRelationshipBom.test.js`
