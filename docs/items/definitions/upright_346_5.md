# upright_346_5 — Item Contract

## Kanonik kimlik
- `itemKey`: `upright_346_5`
- `name`: `Dikme 346,5`
- `type`: `upright`
- `unit`: `adet`
- structure: Tekil Item

## Kanonik ürüne özgü özellikler
- `dimensions.widthCm = 8` (kesit)
- `dimensions.depthCm = 8` (kesit)
- `dimensions.heightCm = 346.5` (dikme boyu)
- `material = 'alüminyum'`
- `defaultColor = 0xd0d3d4`

These values are product defaults owned by the Item. Explicit project/runtime/render ezmes may replace presentation where applicable without changing the kanonik default.

Katalog/saha yerleşimi `resolveSceneDimensions` ile aynı W/H/D alanlarını okur; cross-remap yoktur.

## Bileşim / BOM
The Item is a leaf BOM component. It is consumed by 18 doğrulanmış parent recipes, quantity `2` in each. Parent recipes own quantity; `src/items.js` owns product üstveri.

Sahaya elle konan her örnek ayrı instance'dır. Seçilince `resolveItemBom('upright_346_5')` `upright_346_5 × 1 adet` üretir. Parent reçetelere otomatik eklenmez.

## Davranış / state / kalıcılık
Katalog grubu `Panel Ek Modül`. Snap `short-up-1` / `short-up-2` uçları, saha `profile` uçları ve `counter` (banko) uçlarıdır (`magneticSnap: short-up-joint`). Banko/profil altındaki çarpışma short-up ile aynı şekilde dikmeyi engellemez. Snap yoksa bırakılmaz; kırmızı silhouette ghost pointer konumunda kalır. Düz `wall_*` kimliği ve reçetesi değişmez. Katalog kartı `module-drag-upright` ile düz alüminyum dikme gösterir; 7 şeritli panel kartı kullanılmaz.

Dikey taşıma (`0088_upright_vertical_move`, bütün `upright` Item'ları): seçili dikme ↑/↓ ile tip `moveSnapCm` (10 cm) adımında Z'de taşınır, tuş ekranda dikeye denk geldiğinde (`scene3d.js` serbest yerleşim ok dalı). Taban 0'ın altına inmez, tepe (taban + sahne boyu) stand tavanını geçmez; `upright_346_5` sahnede 346,5 cm olduğundan 350 cm standda en çok 3,5 cm kalkar; `upright_297` (sahnede 300) 0…50 cm arasında taşınır. Seçiliyken zemin/tavan uzaklığı gösterilir. Yükseltilmiş dikmenin boyu Özellikler panelinden uzatılınca taban tavana sığacak kadar iner (`applyUprightItemKey`).

## Renderer ezme sınırı
Saha örneği kare kolondur: plan kesit 8×8 cm (`widthCm`/`depthCm`), boy `heightCm` (346,5 cm), Item `default_color` `#d0d3d4` / metalness 0.68 / roughness 0.28. İki `wall_200_350` köşe silüetiyle aynı kare kesit.

## Regresyon sözleşmesi
`test/upright3465ItemContract.test.js` 18 recipe ×2 miktarını korur. `test/uprightFieldPlacement.test.js` katalog, self BOM, short-up, saha profil ve banko uç snap'ini korur. `test/verticalMoveUprightHeight.test.js` ve `e2e/vertical-move-upright-height.spec.mjs` dikey taşımayı ve sınırları korur.

## Tamamlanma
Kanonik ürün kimliği aynı kalır. Saha örneği ek runtime yeteneğidir; leaf üretim kaydı ikinci Item değildir.
