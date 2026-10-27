# furniture_bar_stool_classic — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/furniture_bar_stool_classic.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item; `itemKey = furniture_bar_stool_classic`. Type `bar-stool`; oturum alanı 60×55×121 cm. Katalogda modelFile yoktu; renderer `bar_chair.glb` hardcode eder. Üst birim / BOM uydurulmadı (`decision-required`).

## Oluşturma, state ve kalıcılık
`createBarStoolModuleState` Item’dan default üretir; `itemKey` damgalar; editable `surface` korunur (`free-model-color`). Yüklemede `normalizeModuleItemState` doldurur; takma ad yok.

## Davranış ve renderer sınırı
`moduleBehavior.js > bar-stool`: free, snap 10, `collision: none`, `magneticSnap: none`, boundary `stand-edge`. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). GLB/material hedefi iş tek kaynağı değildir.

## Regresyon
`test/furnitureItemsContract.test.js`; E2E `e2e/furniture-items-contract.spec.mjs`.
