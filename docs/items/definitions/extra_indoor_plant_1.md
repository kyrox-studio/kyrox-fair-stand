# extra_indoor_plant_1 — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/EXTRA_INDOOR_PLANT_1.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item; `itemKey = extra_indoor_plant_1`. Type ailesi `indoor-plant-1`; ölçü 60×60×120 cm. Katalogda modelFile yoktu; runtime default `indoor_plants.glb` oluşturucu tarafında uygulanır. Üst birim / BOM uydurulmadı (`decision-required`).

## Oluşturma, state ve kalıcılık
`createIndoorPlantModuleState` Item'dan default üretir; `itemKey` damgalar; editable surface yoktur (`free-model-fixed`). Load hydrate; takma ad yok.

## Davranış ve renderer sınırı
`moduleBehavior.js > indoor-plant-1`: free, snap 10, oturum alanı, thin-wall-endpoint. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). GLB fit iş tek kaynağı değildir.

## Regresyon
`test/indoorPlantItemsContract.test.js`; E2E `e2e/indoor-plant-items-contract.spec.mjs`.
