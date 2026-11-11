# floor_showcase_100

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('floor_showcase_100')`).

| Alan | Değer |
|---|---|
| itemKey | `floor_showcase_100` |
| Ad | Ayaklı Vitrin 100 |
| Tip | `floor-showcase` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünür, Banko & Baza |
| Varyant ailesi | — |
| Ölçü | `width_cm=100`, `depth_cm=40`, `height_cm=100` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | `color`, `image`, `lightbox` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`floor-showcase` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `footprint` |
| moveSnapCm | `10` |
| magneticSnap | `none` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `include` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_banko_base_cards_migration.py`
- `backend/tests/modules/fair_stand/test_showcase_brochure_migration.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/floor-showcase-brochure-copy-rotate.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogWidthFamily.test.js`
- `test/floorShowcaseBrochureStand.test.js`
- `test/itemCatalogFields.test.js`
