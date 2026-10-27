# video_wall_2x2 — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/VIDEO_WALL_2X2.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md).

## Kimlik, özellikler ve ölçüler
Kanonik itemKey/name/type/videoWall/dimensions sahibi Fair Stand ilişkisel Item store'udur (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2); `src/items.js` `getItem(itemKey)` bu kaydı okur. **Tekil parametrik Item'dır**; `videoWall.rows × cols` grid parent'ta kalır, panel ölçüsü `videoWall.panelItemKey = video_wall_panel` Item'ındandır (`widthCm=108.5`, `heightCm=61`). Toplam sahne `sceneDimensions` `217 × 122 cm`; `depthCm=5`. `itemKey = video_wall_2x2`. Bu Item N adet ayrı `tv_55`'in bileşimi DEĞİLDİR; composite BOM üretilmez. Doğrulanmış unit YOK; unit/malzeme/renk tahmin edilmedi.

## Oluşturma, state ve kalıcılık
`src/designState.js > createTvModuleState` kanonik Item'ı `itemKey` ile çözer; toplam ölçüler `resolveSceneDimensions` ve `video_wall_panel` × ızgaradan gelir. Örnek `id`, `itemKey`, `type`, türetilmiş toplam `widthCm`/`heightCm`/`depthCm`, `videoWallRows/Cols=2` taşır; panel ölçüleri parent state'e kopyalanmaz. `tv` state oluşturucu tek oluşturma yoludur; dış tanım ürün defaultlarını tanımlayamaz. Proje load'unda `normalizeModuleItemState` `itemKey` doldurur; `resolveItemKey` eski kaydı `itemKey` veya type+widthCm üzerinden `video_wall_2x2`'ye çözer. Takma ad /çift yazım yoktur.

## Davranış, yerleşim ve renderer sınırı
`tv` tip davranışı `fair_stand_item_type` kaydından gelir (`src/moduleBehavior.js` `getModuleBehavior`, DB bootstrap `itemTypes`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`): `wall-overlay`, move snap `10 cm`, collision/magnetic snap `none`. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`). `src/scene3d.js > createTvModule()` tek örnek olarak `2×2` grid için 1 cm black seam mesh'leri ekler; bu görsel temsildir, business material/BOM değildir.

## BOM ve tüketiciler
`src/moduleContracts.js` mevcut `wall-media` profilini, `decision-required` politikasını ve `source: null` değerini korur. Reçete/unit/resolver eklenmedi. Değişiklik yalnız kanonik kimlik, tek kaynak sahiplik ve kimlik yönlendirmesini kapsar; ölçü/BOM/yerleşim/render aynı yapı korunur.

## Regresyon ve açık kapsam
`test/wallMediaItemsContract.test.js`: kanonik özellikler, panel×grid türetimi, tekil parametrik yapı (composite reddi), catalog/state eşyapı, `itemKey` doldurma, `decision-required` BOM. `e2e/wall-media-items-contract.spec.mjs`: katalog kartı drag akışı ve kaydedilen projede `itemKey` + grid parametreleri. Yeni bir `video-wall` type açılmadı; renderer/GLB eşyapı korundu.
