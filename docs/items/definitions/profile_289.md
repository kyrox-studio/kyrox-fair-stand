# profile_289

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('profile_289')`).

| Alan | Değer |
|---|---|
| itemKey | `profile_289` |
| Ad | Profil 289 |
| Tip | `profile` |
| Birim | `adet` |
| Malzeme | alüminyum |
| Katalog | görünür, Panel Ek Modül |
| Varyant ailesi | `profile` |
| Ölçü | `width_cm=289`, `depth_cm=8`, `height_cm=8` |
| Sahne ölçüsü | `width_cm=300`, `depth_cm=8`, `height_cm=350` |
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

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/designState.js`

## Testler

- `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`
- `backend/tests/modules/fair_stand/test_variant_families.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/variant-families-admin.spec.mjs`
- `e2e/vertical-move-upright-height.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogItemProjection.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemLengthParts.test.js`
- `test/itemSceneDimensions.test.js`
- `test/profileFieldPlacement.test.js`
- `test/profileLength.test.js`
- `test/uprightFieldPlacement.test.js`
- `test/variantFamilies.test.js`
- `test/wallShortRelationshipBom.test.js`
