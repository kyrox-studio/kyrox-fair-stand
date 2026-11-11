# plastic_trash_bin

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('plastic_trash_bin')`).

| Alan | Değer |
|---|---|
| itemKey | `plastic_trash_bin` |
| Ad | Çöp Kutusu |
| Tip | `plastic-trash-bin` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünür, Extra |
| Varyant ailesi | — |
| Ölçü | `width_cm=40`, `depth_cm=40`, `height_cm=60` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`plastic-trash-bin` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `src/autoDepot.js`
- `src/featureContracts.js`
- `src/mountFairStand.js`

## Testler

- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/commercial-items-contract.spec.mjs`
- `e2e/module-lock.spec.mjs`
- `e2e/plastic-trash-bin-module.spec.mjs`
- `e2e/toast-notifications.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogDomainBoundary.test.js`
- `test/catalogPreviewConfig.test.js`
- `test/commercialItemsContract.test.js`
- `test/itemCatalogFields.test.js`
- `test/plasticTrashBinModule.test.js`
- `test/plasticTrashBinTopLabel.test.js`
