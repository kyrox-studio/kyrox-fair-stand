# coat_rack

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('coat_rack')`).

| Alan | Değer |
|---|---|
| itemKey | `coat_rack` |
| Ad | Askılık |
| Tip | `coat-rack` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünür, Extra |
| Varyant ailesi | — |
| Ölçü | `width_cm=43`, `depth_cm=43`, `height_cm=180` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`coat-rack` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `src/scene3d.js`

## Testler

- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/commercial-items-contract.spec.mjs`
- `e2e/free-props-collision-none.spec.mjs`
- `e2e/rapid-actions-responsive.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogDomainBoundary.test.js`
- `test/coatRackModule.test.js`
- `test/commercialItemsContract.test.js`
- `test/itemCatalogFields.test.js`
- `test/moduleRotationPolicy.test.js`
