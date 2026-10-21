# wall_50 — Kanonik Item

Migration öncesi tam envanter: [current-system/wall_50](../current-system/wall_50.md).
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
`src/items.js > COMPOSITE_ITEMS.wall_50` kanonik itemKey/name/type/dimensions sahibidir. Bileşik Item; `itemKey = wall_50`. Type ailesi `flat-panel`; genişlik 50 cm. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`, `moduleType=wall`; recipe lookup `item.dimensions.widthCm=50`. Miktar tek kaynak: `src/moduleRecipes.js` straight-wall `50` (`wall-straight-50`). Alt satırları Item kartında kopyalanmaz; mevcut recipe miktarları bu migration’da değişmez. Raw BOM UI dokunulmadı.

## Oluşturma, state ve kalıcılık
`createFlatPanelModuleState` `getItem(itemKey|width)` ile Item’dan default üretir; `itemKey` damgalar; 7 strip aynı yapı korunur. Yüklemede `normalizeModuleItemState` `itemKey` doldurur; takma ad yok.

## Davranış ve renderer sınırı
`moduleBehavior.js > flat-panel`: `WALL_BEHAVIOR` — duvar yerleşimi, 10 cm snap. Placement/snap type bazlıdır. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Prosedürel `createFlatPanelModule` iş tek kaynağı değildir.

## Regresyon
`test/wallFlatPanelItemsContract.test.js`; E2E `e2e/wall-flat-panel-items-contract.spec.mjs`.
