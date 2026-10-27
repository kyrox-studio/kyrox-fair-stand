# furniture_sofa_single_classic — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/furniture_sofa_single_classic.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item; `itemKey = furniture_sofa_single_classic`. Type `sofa-single-classic`; oturum alanı 65×45×78 cm. Ölçüler koltuk takımı renderer’ındaki tekli koltuk genişliği ve derinlik sabitinden taşındı. `visualRotationYDeg=-135` (GLB sırt −Z, oturma sahne önü +Z; `rotationZDeg 0=ön`). Katalogda modelFile yok; renderer mevcut `bej_koltuk_1_ciftli_2_tekli.glb` içinden tekli mesh yükler. Unit / BOM uydurulmadı (`decision-required`).

## Oluşturma, state ve kalıcılık
`createSofaSingleClassicModuleState` Item’dan default üretir; `itemKey` damgalar; editable `surface` korunur (`free-model-color`). Yüklemede `normalizeModuleItemState` doldurur; takma ad yok.

## Davranış ve renderer sınırı
`moduleBehavior.js > sofa-single-classic`: free, snap 10, `collision: none`, `magneticSnap: none`, boundary `stand-edge`. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). GLB/material hedefi iş tek kaynağı değildir. `furniture_sofa_set_classic` bu Item’ın parent kümesidir (`1 × furniture_sofa_double_classic` + `2 × furniture_sofa_single_classic` + `1 × furniture_coffee_table_classic`).

## Regresyon
`test/furnitureItemsContract.test.js`; `test/sofaClassicPiecesContract.test.js`; E2E `e2e/furniture-items-contract.spec.mjs`.
