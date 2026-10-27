# hali — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/hali.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item. `itemKey = hali`. Type `floor`. Katalog kartı yoktur. `defaultColor=#8b8f94`. `paintable=true`. Standı kaplayan zemin olduğu için oturum alanı ölçü uydurulmadı. Unit / BOM uydurulmadı.

## Oluşturma, state ve kalıcılık
Persist `stand.itemKey = hali`. Eski `floorType` yalnız hydrate. Halı repeat `0.7 m` renderer ölçeğidir.

## Regresyon
`test/floorItemsContract.test.js`; E2E `e2e/floor-items-contract.spec.mjs`.
