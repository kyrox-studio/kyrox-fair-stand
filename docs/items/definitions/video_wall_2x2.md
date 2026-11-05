# video_wall_2x2

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('video_wall_2x2')`).

| Alan | Değer |
|---|---|
| itemKey | `video_wall_2x2` |
| Ad | Video Wall 2×2 |
| Tip | `tv` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Elektronik & Aydınlatma |
| Ölçü | `depth_cm=5` |
| Sahne ölçüsü | `width_cm=217`, `height_cm=122` |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`tv` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `wall-overlay` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `False` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_api.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/helpers/catalogWidth.mjs`
- `test/catalogCategories.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/catalogWidthFamily.test.js`
- `test/itemCatalogFields.test.js`
- `test/wallMediaItemsContract.test.js`
