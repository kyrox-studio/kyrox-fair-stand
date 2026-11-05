# desk_banko_200_l

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('desk_banko_200_l')`).

| Alan | Değer |
|---|---|
| itemKey | `desk_banko_200_l` |
| Ad | Köşe Banko 200×200 |
| Tip | `counter` |
| Birim | — |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | `width_cm=200`, `depth_cm=200`, `height_cm=100` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | `color`, `image` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('desk_banko_200_l')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_190` | 5 |
| `profile_140_5` | 1 |
| `profile_41_5` | 4 |
| `upright_99` | 5 |
| `panel_197` | 4 |
| `panel_48_5` | 4 |
| `connector_start` | 8 |
| `connector_single` | 16 |
| `counter_top_210_60` | 1 |
| `counter_top_150_60` | 1 |

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
- `e2e/desk-banko-items-contract.spec.mjs`
- `test/catalogWidthFamily.test.js`
- `test/deskBankoItemsContract.test.js`
- `test/lCounter200Contract.test.js`
- `test/rawBomSelectionParser.test.js`
- `test/sceneBomAcceptance.test.js`
