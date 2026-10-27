# connector_corner

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

| Alan | Değer |
|---|---|
| itemKey | `connector_corner` |
| Ad | Köşe Aparatı |
| Tip | `connector` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünmez |
| Ölçü | — |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`connector` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/relationshipBom.js`

## Testler

- `test/flatPanelBackStrips.test.js`
- `test/itemSceneDimensions.test.js`
- `test/moduleRecipes.test.js`
- `test/productionBomPanelEntry.test.js`
- `test/relationshipBomJoints.test.js`
- `test/sceneBomAcceptance.test.js`
- `test/showcaseRecipes.test.js`
- `test/wallHeightProjectBom.test.js`
- `test/wallHeightRelationshipBom.test.js`
- `test/wallShortRelationshipBom.test.js`
