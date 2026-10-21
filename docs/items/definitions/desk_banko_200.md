# desk_banko_200 — Kanonik Item

Migration öncesi tam envanter: [current-system/desk_banko_200](../current-system/desk_banko_200.md).
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
`src/items.js > COMPOSITE_ITEMS.desk_banko_200` kanonik itemKey/name/type/dimensions sahibidir. Bileşik Item; `itemKey = desk_banko_200`. Type ailesi `counter`; straight genişlik 200 cm. Doğrulanmış ölçüler: `widthCm=200`, `depthCm=50`, `heightCm=100`. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`, `moduleType=counter`; recipe lookup `item.dimensions.widthCm=200`. Miktar tek kaynak: `src/moduleRecipes.js` → `counter:200`. Alt satırları Item kartında kopyalanmaz; mevcut recipe miktarları bu migration’da değişmez.

## Oluşturma, state ve kalıcılık
`createCounterModuleState` Item’dan default üretir; `itemKey` damgalar; 6 face. Load hydrate `itemKey`; takma ad yok.

## Davranış ve renderer sınırı
Type `counter` free/10 cm snap. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Prosedürel renderer iş tek kaynağı değildir.

## Regresyon
`test/deskBankoItemsContract.test.js`, `test/counterModule.test.js`, `test/counterRecipes.test.js`; E2E `e2e/desk-banko-items-contract.spec.mjs`.
