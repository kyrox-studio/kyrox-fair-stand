# hali

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('hali')`).

| Alan | Değer |
|---|---|
| itemKey | `hali` |
| Ad | Halı |
| Tip | `floor` |
| Birim | `m2` |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | — |
| Sahne ölçüsü | — |
| Varsayılan renk | `#383e42` |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`floor` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/floorArea.js`

## Testler

- `backend/tests/modules/fair_stand/test_carpet_anthracite_migration.py`
- `backend/tests/modules/fair_stand/test_item_unit_fk_migration.py`
- `e2e/autosave-interval.spec.mjs`
- `e2e/f020-save-before-project-actions.spec.mjs`
- `e2e/f027-scene-reset.spec.mjs`
- `e2e/floor-area.spec.mjs`
- `e2e/floor-items-contract.spec.mjs`
- `e2e/new-project-wizard.spec.mjs`
- `e2e/selection-property-panel.spec.mjs`
- `test/floorArea.test.js`
- `test/floorItemsContract.test.js`
- `test/itemSceneDimensions.test.js`
- `test/projectBom.test.js`
- `test/projectImportValidation.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/selectionFeedback.test.js`
