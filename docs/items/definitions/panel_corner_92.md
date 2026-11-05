# panel_corner_92

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('panel_corner_92')`).

| Alan | Değer |
|---|---|
| itemKey | `panel_corner_92` |
| Ad | İç Köşe Paneli 92 × 47 cm |
| Tip | `panel` |
| Birim | `adet` |
| Malzeme | sunta |
| Katalog | görünmez |
| Ölçü | `width_cm=92`, `depth_cm=0.8`, `height_cm=47` |
| Sahne ölçüsü | — |
| Varsayılan renk | `#ffffff` |
| Yüzey | `color`, `image`, `lightbox`, `glass`, `mesh` kabul eder |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`panel` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/relationshipBom.js`

## Testler

- `backend/tests/modules/fair_stand/test_catalog_constraints.py`
- `test/boardMaterialItemContract.test.js`
- `test/flatPanelBackStrips.test.js`
- `test/panel197ItemContract.test.js`
- `test/panelCamFamily.test.js`
- `test/panelCorner192ItemContract.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/showcaseRecipes.test.js`
- `test/straightPanelsItemContract.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortRelationshipBom.test.js`
