# extra_long_planter_200 — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/EXTRA_LONG_PLANTER_200.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions/modelFile sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item; `itemKey = extra_long_planter_200`. Type ailesi `indoor-plant-1`; ölçü 200×30×30 cm; `modelFile = saksi_bitkili_200x30x30.glb`; `modelRotationYDeg=90`; `preserveModelScale=true`. Üst birim / BOM uydurulmadı.

## Oluşturma, state ve kalıcılık
`createIndoorPlantModuleState` Item'dan default üretir; uzun saksıda `surface.color` vardır (`free-model-color`). Load hydrate; takma ad yok.

## Davranış ve renderer sınırı
`indoor-plant-1` free behavior. GLB görünümü iş tek kaynağı değildir.

## Regresyon
`test/indoorPlantItemsContract.test.js`; E2E `e2e/indoor-plant-items-contract.spec.mjs`.
