# illuminated-foam — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/illuminated-foam.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item. `itemKey = type = illuminated-foam`. Katalog kartı yoktur (`MODULE_CATALOG` dışı; `NON_CATALOG_MODULE_CONTRACTS`). Oluşturucu default ölçü: width `200`, height `50`, depth `3.5`, `wallGapCm=1.5`. Dialog limitleri mevcut UI’dadır (`10..5000` / `5..350`). Unit / BOM uydurulmadı (`decision-required`).

## Oluşturma, state ve kalıcılık
Oluşturma yolu SVG asset sağ tık `Işıklı Strafora Dönüştür`. `createIlluminatedFoamModuleState` Item defaultlarını ve `itemKey` damgasını yazar. `imageAssetId` zorunludur. `haloColor` default `#ffffff`. Load hydrate `itemKey` doldurur. `Tüm Özellikleri Kaldır` bu type’ı sahneden çıkarır.

## Davranış ve renderer sınırı
Tip davranışı `fair_stand_item_type` kaydındadır (seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`): `wall-overlay`, snap `10 cm`. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). SVG extrude + halo renderer temsilidir.

## Regresyon
`test/lightingItemsContract.test.js`; `test/illuminatedFoamModule.test.js`; `test/moduleStateConstructionRegistry.test.js`; E2E `e2e/lighting-items-contract.spec.mjs` (katalogda olmadığını doğrular) ve mevcut `e2e/f028-reset-features.spec.mjs`.
