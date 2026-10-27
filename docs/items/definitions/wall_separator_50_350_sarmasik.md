# wall_separator_50_350_sarmasik — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/wall_separator_50_sarmasik.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/modelFile/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Bileşik Item; `itemKey = wall_separator_50_350_sarmasik`. Type ailesi `separator`; genişlik 50 cm; `modelFile = wall_separator_50_350_sarmasik.glb`. Üst öğe üzerinde unit uydurulmadı.

## Bileşim / BOM
`composition.mode=recipe`, `moduleType=separator`; recipe lookup `item.dimensions.widthCm=50`. Miktar tek kaynak: aynı `separator:50` (düz 50 ile paylaşır). Recipe miktarları değişmez. Raw BOM UI dokunulmadı.

## Oluşturma, state ve kalıcılık
`createSeparatorModuleState` Item’dan default üretir; `modelFile` damgalanır. Catalog ayrımı `modelFile` ile. Yüklemede hydrate; takma ad yok.

## Davranış ve renderer sınırı
`separator` tip davranışı `fair_stand_item_type` kaydından gelir (`src/moduleBehavior.js` `getModuleBehavior`, DB bootstrap `itemTypes`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`): `placement=wall`, `collision=segment`, 10 cm snap. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). GLB vine mesh’leri renderer detayıdır; iş tek kaynağı değildir.

## Regresyon
`test/wallSeparatorItemsContract.test.js`; E2E `e2e/wall-separator-items-contract.spec.mjs`.
