# floor_showcase_100 — Kanonik Item

Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md). Migration: `backend/alembic/versions/0074_showcase_brochure.py`.

## Kimlik, özellikler ve ölçüler
`itemKey = floor_showcase_100`, ad "Ayaklı Vitrin 100", type `floor-showcase`, birim `adet`. Tekil ticari Item; bileşik veya parametrik değildir. Ürün kararı (2026-10-21): genişlik 100 cm, derinlik 40 cm, toplam yükseklik 100 cm; bunun 70 cm'i gövde, 30 cm'i cam fanus. Malzeme, renk ve iç raf için karar yok; eklenmedi. Katalog: Raf & Vitrin, önizleme "Ayaklı vitrin".

## Oluşturma, state ve kalıcılık
`src/designState.js > createFloorShowcaseModuleState` → `createCommercialModuleState('floor-showcase')` + `ensureFloorShowcaseFaces`; Item'dan `itemKey`, `type` ve ölçüleri alır. Gövdenin ön/sol/sağ yüzü `faces.front/left/right` düzenlenebilir panel durumudur (renk, görsel, Lightbox kumaş); arka yüz ve cam düzenlenmez. Açılışta eksik yüz tamamlanır, kopya yeni yüz kimliği alır.

## Davranış
`floor-showcase` type davranışı DB'dedir (`fair_stand_item_type_scene_behavior`): serbest yerleşim, `collision: footprint` (taban alanıyla çakışır), 10 cm adım, mıknatıslı yapışma yok, 90° dönüş. Item bayrakları: renk, görsel ve Lightbox açık; cam ve mesh kapalı. Görünmez seçim kutusu düzenlenmez.

## BOM
`src/moduleContracts.js` `TYPE_SELF_BOM`: tek satır `floor_showcase_100 ×1 adet` (`src/itemBom.js > resolveItemBom`). Banko reçetesi kullanılmaz: derinlik (40 cm) ve gövde yüksekliği (70 cm) banko parçalarıyla örtüşmez; reçete miktarı uydurulmadı. Fiyat `fair_stand_cost_items` üzerinden ayrıca girilir.

## Renderer sınırı
`src/scene3d.js > createFloorShowcaseModule` prosedüreldir: kaide, beyaz gövde, üst tabla, alüminyum çerçeveli cam fanus (`TABLE_GLASS_APPEARANCE`, kırılma yalnız Render Al'da) ve görünüm amaçlı iki spot gövdesi. Cam oranı `FLOOR_SHOWCASE_GLASS_HEIGHT_RATIO = 0.3`. Çizim BOM'un kaynağı değildir.

## Regresyon
`test/floorShowcaseBrochureStand.test.js`; E2E `e2e/floor-showcase-brochure-copy-rotate.spec.mjs`; migration `backend/tests/modules/fair_stand/test_showcase_brochure_migration.py`.
