# box_block

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('box_block')`).

| Alan | Değer |
|---|---|
| itemKey | `box_block` |
| Ad | Kutu blok |
| Tip | `box-block` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünür, Panel Ek Modül |
| Ölçü | `width_cm=100`, `depth_cm=50`, `height_cm=50` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#e8e8d5` |
| Yüzey | `color`, `image`, `lightbox`, `mesh` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`box-block` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `backend/app/modules/fair_stand/infrastructure/item_rotation_seed.py`
- `src/designState.js`

## Testler

- `backend/tests/modules/fair_stand/test_item_surface_flags.py`
- `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`
- `backend/tests/modules/fair_stand/test_wall_short_cards_migration.py`
- `e2e/box-block-corners.spec.mjs`
- `e2e/box-block-face-image-restore.spec.mjs`
- `e2e/catalog-drop-append.spec.mjs`
- `e2e/group-template.spec.mjs`
- `e2e/missing-project-asset-open.spec.mjs`
- `e2e/module-group.spec.mjs`
- `e2e/project-open-timing.spec.mjs`
- `test/boxBlockModule.test.js`
- `test/catalogCategories.test.js`
- `test/groupTemplates.test.js`
- `test/itemCatalogFields.test.js`
- `test/tulleFabric.test.js`
- `test/uprightFieldPlacement.test.js`
- `test/verticalMoveUprightHeight.test.js`
