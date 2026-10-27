# furniture_sofa_set_classic — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/furniture_sofa_set_classic.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Item kümesi; `itemKey = furniture_sofa_set_classic`. Type `sofa-set-classic`; oturum alanı 150×150×78 cm. Üyelik aynı Item’dadır: `1 × furniture_sofa_double_classic` + `2 × furniture_sofa_single_classic` + `1 × furniture_coffee_table_classic`. Miktarlar mevcut takım renderer yerleşiminden (1 ikili mesh + 2 tekli mesh + 1 sehpa). `moduleRecipes.js` kullanılmaz. Üst birim / BOM uydurulmadı (`decision-required`).

> **Bayat (2026-10-27 denetimi):** `moduleRecipes` (2026-09-17 `0db4af90`: ürün reçete tabloları silindi; `src/moduleRecipes.js` yalnız `expandRecipe` (composition.items)). Bu satır güncel kodla yeniden doğrulanmalı.

## Oluşturma, state ve kalıcılık
`createBeigeSofaSetModuleState` Item’dan default üretir; `itemKey` damgalar; editable `surface` korunur (`free-model-color`). Yüklemede `normalizeModuleItemState` doldurur; takma ad yok. Sahne tek modül kalır.

## Davranış ve renderer sınırı
`moduleBehavior.js > sofa-set-classic`: free, snap 10, boundary `wall-inner-face`. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Takım yerleşim açıları mevcut renderer yerleşims’tır; parça Item’ların tekil `visualRotationYDeg` değeri takımı değiştirmez. GLB/material hedefi iş tek kaynağı değildir.

## Regresyon
`test/furnitureItemsContract.test.js`; `test/sofaClassicPiecesContract.test.js`; E2E `e2e/furniture-items-contract.spec.mjs`.
