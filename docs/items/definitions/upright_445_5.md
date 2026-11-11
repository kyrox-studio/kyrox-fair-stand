# upright_445_5

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('upright_445_5')`).

| Alan | Değer |
|---|---|
| itemKey | `upright_445_5` |
| Ad | Dikme 445,5 |
| Tip | `upright` |
| Birim | `adet` |
| Malzeme | alüminyum |
| Katalog | görünmez |
| Varyant ailesi | `upright` |
| Ölçü | `width_cm=8`, `depth_cm=8`, `height_cm=445.5` |
| Sahne ölçüsü | `width_cm=8`, `depth_cm=8`, `height_cm=450` |
| Varsayılan renk | `#d0d3d4` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`upright` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `free` |
| collision | `footprint` |
| moveSnapCm | `10` |
| magneticSnap | `short-up-joint` |
| allowSideInsert | `False` |
| supportsWallOverlayMount | `False` |
| wallCapacity | `exclude` |
| overlapWithTypes | `('flat-panel', 'profile', 'counter')` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/relationshipBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_length_parts_migration.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `test/mapCatalogSeed.mjs`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRecipe.test.js`
- `test/wallShortRelationshipBom.test.js`
