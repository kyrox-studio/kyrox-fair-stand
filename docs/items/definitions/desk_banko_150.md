# desk_banko_150 — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/desk_banko_150.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Bileşik Item; `itemKey = desk_banko_150`. Type ailesi `counter`; straight genişlik 150 cm. Doğrulanmış ölçüler: `widthCm=150`, `depthCm=50`, `heightCm=100`. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`. Alt kalemler ve miktarları Item kaydının `components` listesindedir (`composition.items`); BOM `src/itemBom.js` `resolveItemBom(itemKey)` ile çözülür. Alt satırları Item kartında kopyalanmaz; mevcut recipe miktarları bu migration’da değişmez.

## Oluşturma, state ve kalıcılık
`createCounterModuleState` Item’dan default üretir; `itemKey` damgalar; 6 face. Load hydrate `itemKey`; takma ad yok.

## Davranış ve renderer sınırı
Type `counter` free/10 cm snap. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Prosedürel renderer iş tek kaynağı değildir.

## Regresyon
`test/deskBankoItemsContract.test.js`, `test/counterModule.test.js`, `test/counterRecipes.test.js`; E2E `e2e/desk-banko-items-contract.spec.mjs`.
