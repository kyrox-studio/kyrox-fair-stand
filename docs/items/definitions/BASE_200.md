# BASE_200 — Kanonik Item

Migration öncesi tam envanter: [current-system/BASE_200](../current-system/BASE_200.md).
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
`src/items.js > COMPOSITE_ITEMS.BASE_200` kanonik itemKey/name/type/dimensions sahibidir. Bileşik Item; `itemKey = BASE_200`. Tek type ailesi `base`; genişlik varyantı 200 cm. Doğrulanmış ölçüler: `widthCm=200`, `depthCm=50`, `heightCm=50`. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`, `moduleType=base`; recipe lookup `item.dimensions.widthCm=200`. Miktar tek kaynak: `src/moduleRecipes.js` → `base:200`. `base_top_206_50` bu recipe’de ×1 tüketilir.

## Oluşturma, state ve kalıcılık
`createBaseModuleState` Item’dan default üretir; `itemKey` damgalar; üç editable face aynı yapı korunur. Load hydrate: `itemKey`. Alias yok. `getCommercialItemForType('base')` yok.

## Davranış ve renderer sınırı
Type `base` ortak behavior (free, 10 cm snap, oturum alanı, logical-fixture). Prosedürel renderer kalınlık/overhang iş tek kaynağı değildir.

## Regresyon
`test/baseItemsContract.test.js`, mevcut base recipe/module/tops testleri; E2E `e2e/base-items-contract.spec.mjs`.
