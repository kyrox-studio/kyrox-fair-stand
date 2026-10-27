# glass_table — Kanonik Item

Aynı ailede `glass_bar_table` "Bar Masası" vardır (migration `0075_glass_bar_table`): tür, çizim, davranış ve BOM politikası aynıdır; yalnız yükseklik 108 cm. Çizim `createGlassTableModule` modülün `itemKey`'inden okunur, ayak masa yüksekliğine göre uzar.

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/glass_table.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item; `itemKey = glass_table`. Type `table-glass`; çap `dimensions.widthCm=75`; oturum alanı 75×75×74 cm. ModelFile yok; renderer prosedürel cam masa. Unit / BOM uydurulmadı (`decision-required`).

## Oluşturma, state ve kalıcılık
`createGlassTableModuleState` Item’dan default üretir; `itemKey` damgalar; surface yok (`free-model-fixed`). Yüklemede `normalizeModuleItemState` doldurur; takma ad yok.

## Davranış ve renderer sınırı
`moduleBehavior.js > table-glass`: free, snap 10, `collision: none`, `magneticSnap: none`, boundary `stand-edge`. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Tabla/sap/taban ayrı Item değildir.

## Regresyon
`test/furnitureItemsContract.test.js`; `test/glassTableContract.test.js`; E2E `e2e/furniture-items-contract.spec.mjs`.
