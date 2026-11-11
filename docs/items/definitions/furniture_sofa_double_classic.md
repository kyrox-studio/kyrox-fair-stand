# furniture_sofa_double_classic

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('furniture_sofa_double_classic')`).

| Alan | Değer |
|---|---|
| itemKey | `furniture_sofa_double_classic` |
| Ad | Çiftli Koltuk |
| Tip | `sofa-double-classic` |
| Birim | — |
| Malzeme | — |
| Katalog | görünür, Extra |
| Varyant ailesi | — |
| Ölçü | `width_cm=150`, `depth_cm=45`, `height_cm=78` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

Alt kalem olarak kullanıldığı Item'lar: `furniture_sofa_set_classic`.

## Tip davranışı

`sofa-double-classic` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `none` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/scene3d.js`
- `src/selectionFeedback.js`

## Testler

- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `test/catalogCategories.test.js`
- `test/furnitureItemsContract.test.js`
- `test/itemCatalogFields.test.js`
- `test/moduleRotationPolicy.test.js`
- `test/sofaClassicPiecesContract.test.js`
