# base_150 — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/BASE_150.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Bileşik Item; `itemKey = base_150`. Tek type ailesi `base`; genişlik varyantı 150 cm. Doğrulanmış ölçüler: `widthCm=150`, `depthCm=50`, `heightCm=50`. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`. Alt kalemler ve miktarları Item kaydının `components` listesindedir (`composition.items`); BOM `src/itemBom.js` `resolveItemBom(itemKey)` ile çözülür. `base_top_157_50` bu recipe’de ×1 tüketilir.

## Oluşturma, state ve kalıcılık
`createBaseModuleState` Item’dan default üretir; `itemKey` damgalar; üç editable face aynı yapı korunur. Load hydrate: `itemKey`. Alias yok. `getCommercialItemForType('base')` yok.

## Davranış ve renderer sınırı
Type `base` ortak behavior (free, 10 cm snap, oturum alanı, logical-fixture). Prosedürel renderer kalınlık/overhang iş tek kaynağı değildir.

## Regresyon
`test/baseItemsContract.test.js`, mevcut base recipe/module/tops testleri; E2E `e2e/base-items-contract.spec.mjs`.
