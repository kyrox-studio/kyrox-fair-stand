> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/illuminated-foam.md` içindedir.

# illuminated-foam — Tarihî envanter profili

Bu belge `illuminated-foam` için `Version2` runtime kodunda çalışan non-catalog SVG → Işıklı Strafor akışını toplar.

## Kimlik / oluşturma yolu

`illuminated-foam` `MODULE_CATALOG` içinde kayıtlı değildir; `NON_CATALOG_MODULE_CONTRACTS` ile contract alır. Asset library'de SVG görsele right-click edildiğinde `Işıklı Strafor` aksiyonu görünür ve oluşturma akışı başlar.

Boyut dialog limitleri:

```text
width: 10..5000 cm
height: 5..350 cm
default width: 200 cm
default height: SVG aspect ratio üzerinden
```

Factory default state:

```text
id = generated
type = illuminated-foam
imageAssetId = required asset id
widthCm = 200 (default)
heightCm = 50 (factory fallback)
depthCm = 3.5
wallGapCm = 1.5
haloColor = #ffffff
```

## Sözleşme

| Alan | Kod değeri |
|---|---|
| Profile | `wall-overlay-image` |
| State sahibi | `src/designState.js` |
| Kalıcılık | `project-state` |
| Color | `halo-only` |
| Image | `required` |
| Renderer politikası | `specialized-overlay` |
| Runtime | `static` |
| Bileşim | `standalone` |
| BOM kipi | `decision-required` |
| BOM kaynağı | `None` |

## Davranış / yerleşim

| Alan | Kod değeri |
|---|---|
| Placement contract | `wall-overlay` |
| Move snap | `10 cm` |
| Rotation step | `90°` |
| Default rotation | `0°` |
| Side insert flag | `false` |
| Collision contract | `none` |
| Magnetic snap | `none` |
| Connection endpoint | `segment` |
| Collision depth | `physical` |
| Endpoint contact | `standard` |
| Boundary snap | `stand-edge` |
| Side-insert rotation | `inherit` |
| Overlap izinleri | `[]` |
| Wall-overlay host | `false` |
| Wall capacity | `include` |
| Ghost | `silhouette / module-silhouette / opacity 0.38` |

Wall-overlay placement, 10 cm move snap, 90° rotation, collision/magnetic snap none. Drag wall yüzeyi veya destek paneli üzerine bağlanabilir; free placement yolu da vardır. `wallGapCm` body back plane'i wall front'tan öne taşır.

## Renderer

`createIlluminatedFoamModule()` asset URL'den SVG yükler. SVGLoader ile fill'i görünen path'ler Shape'e çevrilir ve depth kadar extrude edilir. Oluşan geometri girilen width/height ölçüsüne scale edilir.

Halo için SVG'den CanvasTexture üretilir; blur uygulanır, additive blending ve opacity `0.72` kullanılır. `haloColor` state'i halo material color'ını kontrol eder.

Hitbox `selectionMode=module`, `acceptsImage=false`; image görsel editörüyle değil `imageAssetId` required source üzerinden renderer'a gelir.

## Özel UI

Context menu `Boyutlandır…` aksiyonunu gösterir; width/height state'i değiştirilip scene rebuild edilir. Ayrıca foam light color input `haloColor` state'ini canlı günceller.

## Context menu

`moduleContextMenu.js` içindeki modül menüsü şu temel aksiyonları içerir:

```text
Döndür
Sil
Ekle Sağ Tarafa…
Ekle Sol Tarafa…
```

`type = illuminated-foam` için ayrıca:

```text
Boyutlandır…
```

Picker `MODULE_CATALOG_KEYS` listesinin tamamını gösterir; aynı katalog kaydı birden fazla kez seçilebilir, seçim chip'leri drag ile sıralanabilir. Sağ ekleme isteğinde picker gönderim sırasını ters çevirir; `main.js` placement yoluna göre continuous-wall veya free-side insertion planını kullanır.

`allowSideInsert` behavior alanı context menu butonlarını gizlemek için kullanılmıyor; menü HTML'inde ekleme/çoğaltma aksiyonları genel olarak bulunuyor.

## Duplicate / delete

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `illuminated-foam` için clone edilen normal nested state alanları korunur.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `illuminated-foam` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

Proje restore sırasında modüller clone edilir ve `resolveModuleCatalogKey(moduleState)` tekrar çalıştırılır. Asset'ler scene rebuild edilmeden önce yüklenir. Autosave signature `stand` ve `modules` state'ini kapsar.

ZIP export yapısı:

```text
project.json
assets/*
```

ZIP import sırasında recursive asset remap özel olarak `imageAssetId` key'ini dönüştürür. Kodun asset-reference temizleme walker'ı ise `imageAssetId` ve `fabricImageAssetId` alanlarını tanır. Bu iki akışın anahtar listesi aynı değildir.

`Tüm Özellikleri Kaldır` akışında `illuminated-foam` kayıtları reset factory'siyle yeniden yaratılmaz; filtrelenerek sahneden kaldırılır.

## BOM

Kodda bu Item için recipe yoktur.

```text
bom.mode = decision-required
bom.source = None
```

`moduleContracts.js` içindeki mevcut reason:

> Existing module has no kanonik BOM policy yet; decide recipe, commercial-item, or explicit exclusion before Final BOM integration.

Bu dosyada olmayan bir BOM satırı eklenmemiştir.

## Kod kaynakları

- `src/moduleContracts.js`
- `src/moduleBehavior.js`
- `src/designState.js`
- `src/scene3d.js`
- `src/moduleContextMenu.js`
- `src/main.js`
- `src/assetStore.js`
