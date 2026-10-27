# furniture_table_chair_set_eames — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/furniture_table_chair_set_eames.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Item kümesi; `itemKey = furniture_table_chair_set_eames`. Type `table-chair-set-eames`; oturum alanı 150×150×82 cm. Üyelik aynı Item’dadır: `1 × glass_table` + `4 × chair_eames`. `moduleRecipes.js` kullanılmaz. Üst birim / BOM uydurulmadı (`decision-required`).

> **Bayat (2026-10-27 denetimi):** `moduleRecipes` (2026-09-17 `0db4af90`: ürün reçete tabloları silindi; `src/moduleRecipes.js` yalnız `expandRecipe` (composition.items)). Bu satır güncel kodla yeniden doğrulanmalı.

## Oluşturma, state ve kalıcılık
`createEamesTableChairSetModuleState` Item’dan default üretir; `itemKey` damgalar; `chairCount` küme üyeliğinden 4 gelir; editable `surface` korunur (`free-model-color`). Yüklemede `normalizeModuleItemState` doldurur; takma ad yok. Sahne tek modül kalır.

## Davranış ve renderer sınırı
`moduleBehavior.js > table-chair-set-eames`: free, snap 10, `collision: none`, `magneticSnap: none`, boundary `stand-edge` (çöp kutusu ile aynı serbestlik; stand dışına çıkmaz). Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Masa geometrisi `glass_table` Item’dan; sandalye GLB mevcut `eames_chair.glb`. GLB/material hedefi iş tek kaynağı değildir.

## Regresyon
`test/furnitureItemsContract.test.js`; `test/chairEamesContract.test.js`; E2E `e2e/furniture-items-contract.spec.mjs`.
