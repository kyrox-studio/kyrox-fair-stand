# base_100 — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/BASE_100.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Bileşik Item; `itemKey = base_100`. Tek type ailesi `base`; genişlik varyantı 100 cm. Doğrulanmış ölçüler: `widthCm=100`, `depthCm=50`, `heightCm=50`. Üst öğe üzerinde unit uydurulmadı; child unit’ler production Item’lardadır.

## Bileşim / BOM
`composition.mode=recipe`. Alt kalemler ve miktarları Item kaydının `components` listesindedir (`composition.items`); BOM `src/itemBom.js` `resolveItemBom(itemKey)` ile çözülür. Alt satırları Item kartında kopyalanmaz. `base_top_107_50` bu recipe’de ×1 tüketilir.

## Oluşturma, state ve kalıcılık
`src/designState.js > createBaseModuleState` `resolveBaseItemKey` + `getItem(itemKey)` ile kanonik Item’dan default üretir; `itemKey` damgalar; `faces.front|left|right` editable aynı yapı korunur. `getCommercialItemForType('base')` kullanılmaz. Yüklemede `normalizeModuleItemState` `itemKey` doldurur; takma ad yok.

## Davranış ve renderer sınırı
`moduleBehavior.js > base`: free, 10 cm snap, oturum alanı, `logical-fixture`. Placement type bazlıdır. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). `createBaseModule()` prosedürel renderer; top thickness/overhang görsel temsildir, iş tek kaynağı değildir.

## Regresyon
`test/baseItemsContract.test.js`, `test/baseModule.test.js`, `test/baseRecipes.test.js`, `test/baseTopsItemContract.test.js`; E2E `e2e/base-items-contract.spec.mjs`.
