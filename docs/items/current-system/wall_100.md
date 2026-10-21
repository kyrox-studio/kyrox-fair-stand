> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/wall_100.md` içindedir.

# wall_100 — Tarihî envanter profili

Bu belge `wall_100` için `Version2` runtime kodunda bugün gerçekten bulunan state, behavior, placement, interaction, renderer, persistence ve BOM akışlarını toplar. Yeni davranış tanımlamaz; yorum/audit kaynağı kullanmaz.

## Kimlik

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `wall_100` |
| Etiket | `Panel 100` |
| Type | `flat-panel` |
| Nominal genişlik | `100 cm` |
| Stand yüksekliği | `350 cm` |
| Nominal duvar derinliği | `10 cm` |
| Strip/panel state sayısı | `7` |
| Strip yüksekliği | `50 cm` |

Runtime state'te `itemKey` / `class` alanı yoktur. Kimlik için `catalogKey = wall_100` ve `type = flat-panel` kullanılır.

## Oluşturma / varsayılan state

`createFlatPanelModuleState(100)` temel olarak:

```text
id = generated
type = flat-panel
widthCm = 100
strips[0..6]
```

Her strip:

```text
id = generated
stripIndex = 0..6
color = #ffffff
imageAssetId = null
imageTransform = { mode: single, offsetX: 0, offsetY: 0, repeatX: 1, repeatY: 1, rotation: 0 }
```

`catalogKey` factory'nin içinde değil, `createModuleStateFromDescriptor()` içindeki `resolveModuleCatalogKey()` sonucuyla state'e eklenir.

## Sözleşme

| Alan | Kod değeri |
|---|---|
| Profile | `wall-editable` |
| State sahibi | `src/designState.js` |
| Kalıcılık | `project-state` |
| Color | `editable` |
| Image | `editable` |
| Renderer politikası | `procedural-or-specialized` |
| Runtime | `static` |
| Bileşim | `standalone` |
| BOM kipi | `recipe` |
| BOM kaynağı | `src/moduleRecipes.js` |

## Behavior

| Alan | Kod değeri |
|---|---|
| Placement contract | `wall` |
| Move snap | `50 cm` |
| Rotation step | `90°` |
| Default rotation | `0°` |
| Side insert flag | `true` |
| Collision contract | `segment` |
| Magnetic snap | `standard` |
| Connection endpoint | `segment` |
| Collision depth | `physical` |
| Endpoint contact | `standard` |
| Boundary snap | `stand-edge` |
| Side-insert rotation | `inherit` |
| Overlap izinleri | `[]` |
| Wall-overlay host | `true` |
| Wall capacity | `include` |
| Ghost | `silhouette / module-silhouette / opacity 0.38` |

`behavior.placement = wall` olmasına rağmen `snapPlacementToStand()` allowed wall sınırına yeterince yakın olmayan fakat stand alanına sığan modül için `wallId = free` placement döndürebilir.

## Placement / rotation / hareket

Stand tipine göre allowed wall kimlikleri kodda:

```text
back-wall → back, free
l-left    → back, left, free
l-right   → back, right, free
u-stand   → back, left, right, free
island    → free
```

Wall snap mesafesi `50 cm`, module-neighbor snap mesafesi `30 cm`dir. Wall orientation değerleri `back=0°`, `left=90°`, `right=270°`dir. `wall_100` rotation step'i `90°`, move snap'i `50 cm`dir.

Yön tuşu hareket yolunda non-overlay module için yeni placement `wallId = free` olarak kurulabilir; collision validation sonrası module serbest placement'a geçebilir.

Wall placement'ta context insertion/move continuous-wall planına girer. `wallId = free` context'te sağ/sol ekleme ve duplicate `planFreeSideInsertion()` yoluna gider. Delete akışı global compact/reflow çağırmaz.

Magnetic snap motoru uygun durumda end-to-end, corner ve T adayları üretebilir.

## Otomatik oluşma

`composeStraightWall()` mevcut `MODULE_WIDTHS_CM = [50,100,150,200]` değerlerini büyükten küçüğe kullanır. Uygun stand uzunluklarında `100 cm` flat-panel otomatik stand duvarının parçası olarak üretilebilir.

Automatic depot tarafında da wall spec'leri `flat-panel` state'e çevrilir. Bu kayıtlarda placement `free` olabilir; otomatik depo state'inde `autoDepot` ve arka depo duvarında uygun kayıtta `autoDepotBack` flag'i eklenir.

## Procedural renderer

`wall_100` GLB kullanmaz; `createFlatPanelModule()` ile procedural oluşturulur.

| Renderer alanı | Kod değeri |
|---|---:|
| Nominal width | `100 cm` |
| Yükseklik | `350 cm` |
| Frame depth | reçete profil sahne kesiti (yerel DB `10 cm`) |
| Dikey profil genişliği | reçete profil sahne kesiti (yerel DB `10 cm`) |
| Dikey profil adedi | `2` |
| Alt/üst profil yüksekliği | dikmeyle aynı kesit |
| Ara yatay rail | `yok` |
| Render panel genişliği | `92 cm` (dört yanda 4 cm iç pay) |
| Render panel yüksekliği | bant `49.6 cm`; en alt ve en üst bant 4 cm kısa |
| Panel gövdesi | reçete `panel_*` kalınlığı (`0.8 cm`), yüz profilin 15 mm önünde |
| Render panel sayısı | `7` |

Çerçeve görünümü (2026-10-21, `addPanelModuleFrame`): iki dikme ile alt/üst profil aynı kare kesitte çizilir; kesit reçetedeki `profile_*` Item'ının sahne ölçüsüdür (`resolveProceduralFrameCrossSectionCm`, depth × height; yerel DB'de 10 × 10). Profiller kanallıdır (`src/profileGeometry.js`: dört yüzde 2 cm ağız, 1,5 cm derinlik). Panel yüzü profil yüzünün 15 mm önünde ve çerçevenin dış kenarından dört yanda 4 cm içeride biter; en alt ve en üst bant bu 4 cm kadar kısalır. Panel gövdesi reçetedeki `panel_*` Item kalınlığındadır (0,8 cm). Yalnız görünüm; strip state ve BOM değişmez.

Renderer yalnız alt ve üst profili üretir. Her strip yüzeyi `selectionMode = panel`, `acceptsImage = true` ile oluşturulur. Eksik strip state'i varsa o panel atlanır ve console warning yazılır.

## Selection / panel işlemleri

Tek panel selection vardır. Ctrl/Cmd range selection ile tam rectangle selection ayrı kurallardır:

- `createPanelRangeSelection()` aralıkta panel olmayan hücre varsa mevcut panelleri seçmeye devam edebilir.
- `createRectSelection()` tam grid ister; eksik hücre varsa geçersiz döner.
- Free placement panel zincirlerinde `createConnectedPanelModulePath()` aynı eksendeki endpoint temaslarını ve dik eksendeki endpoint kesişimlerini bağlı path olarak çözebilir; default tolerance `10.5 cm`dir.

## Color / image

Panel rengi editable'dır. `applyColorOverride()` hedef panelde:

```text
color = yeni renk
imageAssetId = null
imageTransform = default single transform
```

uygular. UI renk girişi color picker yanında HEX, RGB ve CMYK kontrollerinden de uygulanabilir.

Panel görselleri `imageAssetId` + `imageTransform` state'iyle tutulur. Ana UI seçili panel/panel bloğuna `cover`, `contain`, clear ve rectangle image layout uygular. Scene ayrıca horizontal image API export eder.

## Glass / Lightbox / Mesh

Panel right-click context'i glass, Lightbox ve Mesh aksiyonlarını açabilir.

Lightbox/Mesh oluşturmak için en az 2 panel, aynı fiziksel düzlem ve geçerli tam rectangle block gerekir. Fabric state alanları kodda:

```text
fabricGroupId
fabricType
fabricColor
fabricImageAssetId
fabricImageFit
fabricLightingOn
fabricOwnerSurfaceIds
fabricOwnerModuleIds
```

Lightbox tek continuous plane üretir; lighting state emissive görünümü kontrol eder. Mesh tek continuous plane üretir; aktif material `transparent=true`, `opacity≈0.48`, `depthWrite=false`, emissive kapalıdır. `createMeshBrandaAlphaMap()` helper'ı kodda bulunur fakat aktif Mesh material yolunda `alphaMap` olarak bağlanmaz.

Cover-mode geçişlerinde glass ve fabric state birbirini temizleyen yollar kullanır. Multi-module tek parça fabric grubunda `moduleIds.size > 1` olduğunda ilgili module move/rotation kilidi uygulanabilir.

## Wall-overlay host

`supportsWallOverlayMount = true`. TV ve illuminated-foam gibi wall-overlay modüller duvara veya free placement'taki destek panelinin ön yüzüne bağlanabilir. Overlay modül `wall_100` recipe'sine otomatik eklenmez.

## Context menu

`moduleContextMenu.js` içindeki modül menüsü şu temel aksiyonları içerir:

```text
Döndür
Sil
Ekle Sağ Tarafa…
Ekle Sol Tarafa…
```

Right-click edilen yüzey `selectionMode = panel` ise ayrıca:

```text
Cam Panele Çevir / Normal Panele Çevir
Lightbox Kumaşa Çevir / Lightbox Kumaştan Çıkar
Mesh (Delikli) Brandaya Çevir / Mesh Brandadan Çıkar
Lightbox aydınlatmayı aç / kapat
```

Picker `MODULE_CATALOG_KEYS` listesinin tamamını gösterir; aynı katalog kaydı birden fazla kez seçilebilir, seçim chip'leri drag ile sıralanabilir. Sağ ekleme isteğinde picker gönderim sırasını ters çevirir; `main.js` placement yoluna göre continuous-wall veya free-side insertion planını kullanır.

`allowSideInsert` behavior alanı context menu butonlarını gizlemek için kullanılmıyor; menü HTML'inde ekleme/çoğaltma aksiyonları genel olarak bulunuyor.

## Duplicate / delete

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `wall_100` için clone edilen normal nested state alanları korunur.

Lightbox/Mesh ownership için scene rebuild sırasında `fabricGroupId` normalizasyonu yapılır. Duplicate'ın eski fabric grubuna yanlış owner olarak katılması engellenir; beklenmeyen clone yüzeylerinde fabric state temizlenebilir.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

Silinen modül multi-module Lightbox/Mesh owner grubunun parçasıysa rebuild sırasında eksik owner yüzey algılandığında kalan fabric ownership de çözülebilir.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `wall_100` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

Proje restore sırasında modüller clone edilir ve `resolveModuleCatalogKey(moduleState)` tekrar çalıştırılır. Asset'ler scene rebuild edilmeden önce yüklenir. Autosave signature `stand` ve `modules` state'ini kapsar.

ZIP export yapısı:

```text
project.json
assets/*
```

ZIP import sırasında recursive asset remap özel olarak `imageAssetId` key'ini dönüştürür. Kodun asset-reference temizleme walker'ı ise `imageAssetId` ve `fabricImageAssetId` alanlarını tanır. Bu iki akışın anahtar listesi aynı değildir.

`Tüm Özellikleri Kaldır` akışında katalog modülleri `createCatalogModuleState(module, { preservePlacement: true })` ile default state'ten yeniden oluşturulur; placement korunur, instance/surface kimlikleri ve düzenlenebilir state defaultlara döner.

## BOM / production recipe

```text
recipeId = wall-straight-100
moduleType = wall
nominalWidthCm = 100
connectionMode = straight
```

| Part ID | Kod adı | Adet | Birim |
|---|---|---:|---|
| `profile_91` | Profil 91 cm | 2 | adet |
| `upright_346_5` | Dikme 346,5 cm | 2 | adet |
| `panel_98` | Panel 98 × 47 cm | 7 | adet |
| `connector_start` | Başlangıç Aparatı | 2 | adet |
| `connector_single` | Tekli Aparat | 13 | adet |

Recipe metadata'sında ayrıca:

```text
variants.innerCornerPanelItemKey = panel_corner_92
```

`panel_corner_92` production registry kaydı: `İç Köşe Paneli 92 × 47 cm` (widthCm=92, heightCm=47, depthCm=0.8). Bu part normal `recipe.items` satırlarında yer almaz.

`rawBomDebug.js` seçili modül için `getExpandedModuleRecipe()` çağırıp `recipe.items` satırlarını gösterir. Bu ekranda placement ilişkilerinden ayrıca part dönüşümü yapan bir çağrı yoktur.

## Catalog sidebar / selection feedback

`moduleDragSidebar.js` içinde `wall_100` katalog grubu **Panel & Duvar** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

Flat-panel selection feedback width ve strip numarasını gösterir; Ctrl/Cmd ile çoklu seçim ipucu verir.

## Kod kaynakları

- `src/catalog.js`
- `src/designState.js`
- `src/moduleContracts.js`
- `src/moduleBehavior.js`
- `src/modulePlacement.js`
- `src/moduleMove.js`
- `src/wallReflow.js`
- `src/automaticWall.js`
- `src/autoDepot.js`
- `src/scene3d.js`
- `src/moduleContextMenu.js`
- `src/main.js`
- `src/moduleRecipes.js`
- `src/items.js`
- `src/rawBomDebug.js`
- `src/imageAssetReferences.js`
