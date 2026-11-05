# base_200

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('base_200')`).

| Alan | Değer |
|---|---|
| itemKey | `base_200` |
| Ad | Baza 200 |
| Tip | `base` |
| Birim | — |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | `width_cm=200`, `depth_cm=50`, `height_cm=50` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | `color`, `image` kabul eder |

## Bileşim / BOM

`composition_mode=recipe`. BOM `src/itemBom.js` `resolveItemBom('base_200')` ile bu satırlardan çözülür.

| Alt kalem | Miktar |
|---|---|
| `profile_190` | 4 |
| `profile_41_5` | 4 |
| `upright_49_5` | 4 |
| `panel_197` | 2 |
| `panel_48_5` | 2 |
| `connector_start` | 8 |
| `connector_single` | 8 |
| `base_top_206_50` | 1 |

## Tip davranışı

`base` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `src/designState.js`

## Testler

- `backend/tests/modules/fair_stand/test_banko_base_cards_migration.py`
- `e2e/base-items-contract.spec.mjs`
- `test/baseItemsContract.test.js`
- `test/baseModule.test.js`
- `test/baseRunBom.test.js`
- `test/modulePlacement.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/wallShortRelationshipBom.test.js`
