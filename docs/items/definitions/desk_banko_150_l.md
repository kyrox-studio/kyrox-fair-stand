# desk_banko_150_l — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/desk_banko_150_L.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/shape/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Bileşik Item; `itemKey = desk_banko_150_l`. Type ailesi `counter`; `shape=L`; ölçü 150×150×100 cm. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`, `shape=L`. Alt kalemler ve miktarları Item kaydının `components` listesindedir (`composition.items`); BOM `src/itemBom.js` `resolveItemBom(itemKey)` ile çözülür. Mevcut recipe miktarları değişmez.

## Oluşturma, state ve kalıcılık
`createCounterModuleState` Item’dan default üretir; 8 face. Load hydrate; takma ad yok.

## Davranış ve renderer sınırı
Type `counter` placement/snap. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Prosedürel L renderer iş tek kaynağı değildir.

## Regresyon
`test/deskBankoItemsContract.test.js`, `test/lCounter150Contract.test.js`; E2E `e2e/desk-banko-items-contract.spec.mjs`.
