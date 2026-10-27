# wall_separator_100_350 — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/wall_separator_100.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Bileşik Item; `itemKey = wall_separator_100_350`. Type ailesi `separator`; genişlik 100 cm; `modelFile` yok. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`. Alt kalemler ve miktarları Item kaydının `components` listesindedir (`composition.items`); BOM `src/itemBom.js` `resolveItemBom(itemKey)` ile çözülür. Alt satırları Item kartında kopyalanmaz; mevcut recipe miktarları değişmez. Raw BOM UI dokunulmadı.

## Oluşturma, state ve kalıcılık
`createSeparatorModuleState` Item’dan default üretir; `itemKey` damgalar; tek `surface.color` (image yok). Default renk child `separator_panel_98` üzerinden. Yüklemede hydrate; takma ad yok.

## Davranış ve renderer sınırı
`separator` tip davranışı `fair_stand_item_type` kaydından gelir (`src/moduleBehavior.js` `getModuleBehavior`, DB bootstrap `itemTypes`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`): `placement=wall`, `collision=segment`, 10 cm snap. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Prosedürel renderer / GLB iş tek kaynağı değildir.

## Regresyon
`test/wallSeparatorItemsContract.test.js`; E2E `e2e/wall-separator-items-contract.spec.mjs`.
