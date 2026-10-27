# furniture_coffee_table_classic — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/furniture_coffee_table_classic.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item; `itemKey = furniture_coffee_table_classic`. Type `coffee-table-classic`; oturum alanı 60×42×38 cm. `glass_table` değildir. ModelFile yok; renderer prosedürel sehpa. Unit / BOM uydurulmadı (`decision-required`).

## Oluşturma, state ve kalıcılık
`createCoffeeTableClassicModuleState` Item’dan default üretir; `itemKey` damgalar; surface yok (`free-model-fixed`). Yüklemede `normalizeModuleItemState` doldurur; takma ad yok.

## Davranış ve renderer sınırı
`moduleBehavior.js > coffee-table-classic`: free, snap 10, `collision: none`, `magneticSnap: none`, boundary `stand-edge`. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Tabla/sap/taban ayrı Item değildir. `furniture_sofa_set_classic` bu Item’ın parent kümesidir (`1 × furniture_sofa_double_classic` + `2 × furniture_sofa_single_classic` + `1 × furniture_coffee_table_classic`).

## Regresyon
`test/furnitureItemsContract.test.js`; `test/sofaClassicPiecesContract.test.js`; E2E `e2e/furniture-items-contract.spec.mjs`.
