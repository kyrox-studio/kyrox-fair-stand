# wall_200 — Kanonik Item

Migration öncesi tam envanter: [current-system/wall_200](../current-system/wall_200.md).
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
`src/items.js > COMPOSITE_ITEMS.wall_200` kanonik itemKey/name/type/dimensions sahibidir. Bileşik Item; `itemKey = wall_200`. Type ailesi `flat-panel`; genişlik 200 cm. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`, `moduleType=wall`; recipe lookup `item.dimensions.widthCm=200`. Miktar tek kaynak: `src/moduleRecipes.js` straight-wall `200` (`wall-straight-200`). Mevcut recipe miktarları değişmez. Raw BOM UI dokunulmadı.

## Oluşturma, state ve kalıcılık
`createFlatPanelModuleState` Item’dan default üretir; 7 strip. Load hydrate; takma ad yok.

## Davranış ve renderer sınırı
`WALL_BEHAVIOR`: duvar yerleşimi, 10 cm snap. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Prosedürel renderer iş tek kaynağı değildir.

## Regresyon
`test/wallFlatPanelItemsContract.test.js`; E2E `e2e/wall-flat-panel-items-contract.spec.mjs`.
