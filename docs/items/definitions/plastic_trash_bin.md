# plastic_trash_bin — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/PLASTIC_TRASH_BIN.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/unit/dimensions/modelFile sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. Tekil ticari Item; parametrik veya bileşik değildir. Canonical birim `adet`tir. Width/depth/height mevcut katalog/state değerlerinden taşındı; length/thickness/material/defaultColor için doğrulanmış business üstveri YOK, tahmin eklenmedi. `modelRotationYDeg`, `visualRotationYDeg=-90` ve `preserveModelScale` defaultları aynı Item'dadır.

## Oluşturma, state ve kalıcılık
`src/designState.js > createCommercialModuleState` type üzerinden kanonik Item'ı çözer. Mevcut public oluşturucu girişleri bu tek oluşturma yoluna bağlanır. Örnek `id`, itemKey, type, kanonik ölçüler ve Item'dan kopyalanan başlangıç görsel dönüşünü taşır; yerleşim/autoDepot proje alanlarıdır. Dış tanım ürün defaultlarını tanımlayamaz. Oluşturulmuş örneğin `visualRotationYDeg` alanı daha sonra kontrollü bir runtime/editor işlemiyle ezilebilir; renderer alan yoksa Item defaultuna döner.
JSON snapshot/save/load örnek ID ve kanonik ürün alanlarını korur; duplicate yeni ID üretir. Renderer/ghost/geçici seçim persist edilmez. Kullanıcı kararı: eski DEPOT_ projeleri için alias veya geriye uyumluluk migrationı yok.

## Davranış, yetenekler ve ilişkiler
`src/moduleBehavior.js` placement/snap/collision type ailesidir: serbest yerleşim, move/snap, `collision: none` (yalnız stand sınırı), ghost ve kettle-fridge overlap. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). UI selection, drag, sağ click, silme, sağ/sol duplicate/insert ve klavye yolları ortak modül akışındadır. Fixed-model profile renk/image düzenlemeyi kapalı tutar.
Otomatik depo yeni bir parent Item oluşturmaz; içerik örnek'larını planlar. Persistent host/child/neighbor ilişkisi ve host takip reflow'u yok. Kettle mevcut sabit yükseltilmiş görünümünü fridge Item yüksekliğinden alır; bu migration yeni stacking davranışı eklemez.

## BOM ve tüketiciler
Kullanıcı kararıyla bu Item canonical leaf/self BOM'dur: `unit=adet`, `quantity=1`. `src/itemBom.js > resolveItemBom('plastic_trash_bin')` tek satır `plastic_trash_bin ×1 adet` üretir. `src/moduleContracts.js` BOM politikasını `mode: self`, `source: src/itemBom.js` olarak ilan eder. Child recipe/composition yoktur.

## Tüketici geçişi ve renderer sınırı
Catalog tanım, shared oluşturucu ve autoDepot ölçüleri kanonik Item kaynağından gelir. `selectionFeedback.js` gerçek state ölçülerini/defaultları gösterir. Sol katalog ve Add picker kartları `moduleDragSidebar.js` içindeki `module-drag-trash-bin` siluetini paylaşır; wall/panel şerit önizlemesi kullanılmaz. `scene3d.js` model path ve ölçü fallbacklarını Item'dan alır; GLB ile üst etiketi birlikte çevirirken örnek `visualRotationYDeg` değerini, alan yoksa Item defaultunu kullanır. GLB scaling, proxy, sidebar ikon renkleri ve trash gövdesindeki beyaz materyal uygulaması renderer temsilidir; business material/defaultColor değildir.

## Regresyon ve açık kapsam
`test/commercialItemsContract.test.js`: özellikler, `adet` unit, self BOM `×1`, state/save-load/duplicate, seçim metni, otomatik depo, dış tanım ürün alanlarının reddi.
`e2e/commercial-items-contract.spec.mjs`: dört katalog drag akışı ve otomatik depo kaydet/yeniden aç. Mevcut ürün/yerleşim testleri korunur.
