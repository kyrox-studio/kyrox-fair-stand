# illuminated-foam

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('illuminated-foam')`).

| Alan | Değer |
|---|---|
| itemKey | `illuminated-foam` |
| Ad | Işıklı Strafor / Logo |
| Tip | `illuminated-foam` |
| Birim | `metre_kare` |
| Malzeme | — |
| Katalog | görünür, Elektronik & Aydınlatma |
| Varyant ailesi | — |
| Ölçü | `width_cm=200`, `depth_cm=3.5`, `height_cm=50`, `wall_gap_cm=1.5` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | `image` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`illuminated-foam` tipinin davranışı (`fair_stand_item_type`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`, çözüm `src/moduleBehavior.js` `getModuleBehavior`):

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
- `backend/app/modules/fair_stand/infrastructure/item_rotation_seed.py`
- `backend/app/modules/fair_stand/infrastructure/item_vertical_seed.py`
- `backend/app/modules/fair_stand/infrastructure/preview_kind_definitions.py`
- `src/bomLineGroups.js`
- `src/designState.js`
- `src/main.js`
- `src/moduleBehavior.js`
- `src/moduleContextMenu.js`
- `src/moduleContracts.js`
- `src/printAreaBom.js`
- `src/projectBom.js`
- `src/scene3d.js`
- `src/selectionFeedback.js`

## Testler

- `backend/tests/modules/fair_stand/test_drop_foam_logo_item_migration.py`
- `backend/tests/modules/fair_stand/test_foam_card_preview_migration.py`
- `backend/tests/modules/fair_stand/test_illuminated_foam_card_migration.py`
- `backend/tests/modules/fair_stand/test_variant_family_cards_migration.py`
- `e2e/f028-reset-features.spec.mjs`
- `e2e/illuminated-foam-placement-feedback.spec.mjs`
- `e2e/lighting-items-contract.spec.mjs`
- `test/catalogCategories.test.js`
- `test/catalogDomainBoundary.test.js`
- `test/catalogItemProjection.test.js`
- `test/f028FeatureReset.test.js`
- `test/illuminatedFoamInteraction.test.js`
- `test/illuminatedFoamModule.test.js`
- `test/itemCatalogFields.test.js`
- `test/itemIsRenderFactory.test.js`
- `test/itemRotationSeed.mjs`
- `test/itemSurfaceFlagAudit.test.js`
- `test/itemSurfaceFlagsSeed.mjs`
- `test/itemTypeBehaviorSeed.mjs`
- `test/itemVerticalSeed.mjs`
- `test/lightingItemsContract.test.js`
- `test/moduleContextAllowSideInsert.test.js`
- `test/modulePersistenceRoundTrip.test.js`
- `test/moduleRotationPolicy.test.js`
- `test/moduleStateConstructionRegistry.test.js`
- `test/printAreaBom.test.js`
- `test/projectImportValidation.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/selectionFeedback.test.js`
- `test/systemDevelopmentContract.test.js`
- `test/systemModuleCatalogDoc.test.js`
- `test/tulleFabric.test.js`
- `test/wallOverlayFeedback.test.js`
