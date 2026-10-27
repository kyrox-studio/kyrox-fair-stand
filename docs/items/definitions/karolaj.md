# karolaj — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/karolaj.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil Item. `itemKey = karolaj`. Type `floor`. Katalog kartı yoktur. Karo ızgarası `100 × 100 cm` (UI + 1 m grid). `defaultColor=#e9edf1`. `paintable=true`. Unit / BOM uydurulmadı.

## Oluşturma, state ve kalıcılık
Zemin `currentModules` içinde değildir. Persist alanı `stand.itemKey`. `assignStandFloorItem` `floorType` alanını siler; yüklemede eski kayıt `floorType` hydrate edilebilir. Bilinmeyen zemin `karolaj`e düşer. Varsa `floorColor` örnek ezme’dır.

## Davranış ve renderer sınırı
Floor selection / `setFloorColor` Item `paintable` alanını kullanır. Material roughness ve grid çizgi rengi renderer temsilidir.

## Regresyon
`test/floorItemsContract.test.js`; E2E `e2e/floor-items-contract.spec.mjs`.
