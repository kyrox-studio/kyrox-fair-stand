# profile_487

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('profile_487')`).

| Alan | Değer |
|---|---|
| itemKey | `profile_487` |
| Ad | Profil 487 |
| Tip | `profile` |
| Birim | `adet` |
| Malzeme | alüminyum |
| Katalog | görünmez |
| Varyant ailesi | `profile` |
| Ölçü | `width_cm=487`, `depth_cm=8`, `height_cm=8` |
| Sahne ölçüsü | `width_cm=500`, `depth_cm=8`, `height_cm=350` |
| Varsayılan renk | `#d0d3d4` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`profile` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

| Alan | Değer |
|---|---|
| placement | `wall` |
| collision | `segment` |
| moveSnapCm | `10` |
| magneticSnap | `standard` |
| allowSideInsert | `True` |
| supportsWallOverlayMount | `True` |
| wallCapacity | `include` |
| overlapWithTypes | `('separator',)` |

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/booth_type_seed.py`
- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`

## Testler

- `backend/tests/modules/fair_stand/test_item_length_parts_migration.py`
- `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`
- `e2e/variant-families-admin.spec.mjs`
- `e2e/vertical-move-upright-height.spec.mjs`
- `test/mapCatalogSeed.mjs`
- `test/profileFieldPlacement.test.js`
- `test/profileLength.test.js`
- `test/wallShortRelationshipBom.test.js`
