# desk_banko_150

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('desk_banko_150')`).

| Alan | Değer |
|---|---|
| itemKey | `desk_banko_150` |
| Ad | Banko 150 |
| Tip | `counter` |
| Birim | — |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | `width_cm=150`, `depth_cm=50`, `height_cm=100` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | `color`, `image` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('desk_banko_150')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_140_5` | 3 |
| `profile_41_5` | 4 |
| `upright_99` | 4 |
| `panel_147_5` | 2 |
| `panel_48_5` | 4 |
| `connector_start` | 6 |
| `connector_single` | 12 |
| `counter_top_160_60` | 1 |

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

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `backend/app/modules/fair_stand/infrastructure/item_rotation_seed.py`
- `src/designState.js`

## Testler

- `backend/tests/modules/fair_stand/test_banko_base_cards_migration.py`
- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `e2e/desk-banko-items-contract.spec.mjs`
- `test/deskBankoItemsContract.test.js`
- `test/lCounterDefaultOrientation.test.js`
- `test/moduleBehaviorPolicy.test.js`
- `test/moduleRotationPolicy.test.js`
- `test/sceneBomAcceptance.test.js`
