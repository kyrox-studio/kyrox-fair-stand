# desk_banko_100_l

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('desk_banko_100_l')`).

| Alan | Değer |
|---|---|
| itemKey | `desk_banko_100_l` |
| Ad | Köşe Banko 100×100 |
| Tip | `counter` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Banko & Baza |
| Ölçü | `width_cm=100`, `depth_cm=100`, `height_cm=100` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | `color`, `image` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('desk_banko_100_l')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_91` | 5 |
| `profile_41_5` | 5 |
| `upright_99` | 5 |
| `panel_98` | 4 |
| `panel_48_5` | 4 |
| `connector_start` | 8 |
| `connector_single` | 16 |
| `counter_top_110_60` | 1 |
| `counter_top_52_60` | 1 |

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
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/desk-banko-items-contract.spec.mjs`
- `e2e/helpers/catalogWidth.mjs`
- `test/catalogCategories.test.js`
- `test/deskBankoItemsContract.test.js`
- `test/itemCatalogFields.test.js`
- `test/lCounter100Contract.test.js`
- `test/moduleRotationPolicy.test.js`
- `test/rawBomSelectionParser.test.js`
- `test/sceneBomAcceptance.test.js`
