# led_floodlight — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/LED_FLOODLIGHT.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item; `itemKey = led_floodlight`. Type `led-floodlight`. Footprint `50 × 20 × 35 cm`; `mountHeightCm=350`. Eski katalog anahtarı `LED_FLOODLIGHT` idi; ürün kararı ile küçük harfe alındı. Unit / BOM uydurulmadı (`decision-required`).

## Oluşturma, state ve kalıcılık
`createLedFloodlightModuleState` Item’dan default üretir; `itemKey` damgalar; `surface.color=#17191c` korunur. Yüklemede `normalizeModuleItemState` type `led-floodlight` için doldurur. Recipe yok.

## Davranış ve renderer sınırı
`moduleBehavior.js > led-floodlight`: yerleşim `top`, snap `20 cm`, `collision: none`, `wallCapacity: exclude`. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). Prosedürel gövde/45 LED noktası/spotlight renderer temsilidir; BOM değildir. Mesh metre ölçüleri değiştirilmedi.

Non-island stand kurulunca `appendAutomaticWallLamps` bu Item’ı otomatik yazar. Aralık `AUTOMATIC_WALL_LAMP_INTERVAL_CM` (150). Kesintisiz sırt, sol ve sağ `flat-panel` koşusunun her 150 cm’sine bir lamba gelir. Depo arka duvarı ve depo yanı sayılmaz. 150 cm’den kısa koşuya lamba konmaz. Ada standta bu lamba oluşmaz. State `itemKey` `led_floodlight` kalır; ad ve birim kopyalanmaz. Yerleşim üst profile snap edilir.

## Regresyon
`test/lightingItemsContract.test.js`; `test/ledFloodlightModule.test.js`; `test/automaticWall.test.js`; E2E `e2e/lighting-items-contract.spec.mjs`, `e2e/f010-module-construction.spec.mjs`, `e2e/wall-reflow-u-stand.spec.mjs`.
