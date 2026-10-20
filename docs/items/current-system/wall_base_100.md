> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/wall_base_100.md` içindedir.

# wall_base_100 — Tarihî envanter profili

Bu belge `wall_base_100` için `Version2` runtime kodunda çalışan state, behavior, renderer, interaction, persistence ve BOM akışlarını toplar.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `wall_base_100` |
| Etiket | `Panel Bazalı 100` |
| Type | `base-wall` |
| Genişlik | `100 cm` |
| Derinlik | `50 cm` |
| Yükseklik | `350 cm` |

State 7 wall strip'i + `faces.front/left/right` olmak üzere toplam 10 editable surface state taşır. Bütün editable state default `#ffffff`, `imageAssetId=null`, default single image transform ile oluşturulur.

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
| Collision depth | `wall-backbone` |
| Endpoint contact | `standard` |
| Boundary snap | `stand-edge` |
| Side-insert rotation | `inherit` |
| Overlap izinleri | `[]` |
| Wall-overlay host | `true` |
| Wall capacity | `include` |
| Ghost | `silhouette / module-silhouette / opacity 0.38` |

`base-wall` WALL behavior'ı kullanır fakat `collisionDepth = wall-backbone` override'ı vardır. Placement motorunda bu flag fiziksel 50 cm base depth yerine wall backbone collision depth yolunu seçmek için kullanılır.

Runtime placement wall veya free olabilir; move snap `50 cm`, rotation `90°`dir.

## Renderer

`createBaseWallModule()` iki renderer'ı birleştirir:

```text
wall layer → createFlatPanelModule()
base layer → createBaseModule(depth=50cm,height=50cm)
```

Base child grubu Z ekseninde `+0.25 m` kaydırılır; wall panel plane arka tarafta kalırken 50 cm derin base içeri doğru uzanır.

Surface yapısı:

- 7 wall strip surface: `selectionMode=panel`, image/glass/Lightbox/Mesh yollarına girebilir.
- base `front/left/right` face: `selectionMode=module`, color/image kabul eder; panel cover-mode context'i değildir.
- birleşik surface'lerin module type metadata'sı `base-wall` olarak yazılır.

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

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `wall_base_100` için clone edilen normal nested state alanları korunur.

Lightbox/Mesh ownership için scene rebuild sırasında `fabricGroupId` normalizasyonu yapılır. Duplicate'ın eski fabric grubuna yanlış owner olarak katılması engellenir; beklenmeyen clone yüzeylerinde fabric state temizlenebilir.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

Silinen modül multi-module Lightbox/Mesh owner grubunun parçasıysa rebuild sırasında eksik owner yüzey algılandığında kalan fabric ownership de çözülebilir.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `wall_base_100` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

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
recipeId = base-wall-100
moduleType = base-wall
nominalWidthCm = 100
connectionMode = straight
```

| Part ID | Kod adı | Adet | Birim |
|---|---|---:|---|
| `profile_91` | Profil 91 cm | 4 | adet |
| `upright_346_5` | Dikme 346,5 cm | 2 | adet |
| `profile_41_5` | Profil 41,5 cm | 4 | adet |
| `upright_49_5` | Dikme 49,5 cm | 2 | adet |
| `panel_98` | Panel 98 × 47 cm | 7 | adet |
| `panel_48_5` | Panel 48,5 × 47 cm | 2 | adet |
| `connector_start` | Başlangıç Aparatı | 6 | adet |
| `connector_single` | Tekli Aparat | 17 | adet |
| `base_top_107_50` | Baza Üstü 107 × 50 cm | 1 | adet |

Recipe metadata'sında ayrıca:

```text
variants.innerCornerPanelItemKey = panel_corner_92
```

`panel_corner_92` production registry kaydı: `İç Köşe Paneli 92 × 47 cm` (widthCm=92, heightCm=47, depthCm=0.8). Bu part normal `recipe.items` satırlarında yer almaz.

`rawBomDebug.js` seçili modül için `getExpandedModuleRecipe()` çağırıp `recipe.items` satırlarını gösterir. Bu ekranda placement ilişkilerinden ayrıca part dönüşümü yapan bir çağrı yoktur.

## Catalog sidebar / selection feedback

`moduleDragSidebar.js` içinde `wall_base_100` katalog grubu **Panel & Duvar** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

`selectionFeedback.js` base-wall seçiminde `baza ön/sol/sağ panel` veya `alttan N. duvar paneli` rolünü ayırır ve renk + görsel uygulanabilir bilgisini verir.

## Kod kaynakları

- `src/catalog.js`
- `src/designState.js`
- `src/moduleContracts.js`
- `src/moduleBehavior.js`
- `src/modulePlacement.js`
- `src/scene3d.js`
- `src/moduleContextMenu.js`
- `src/main.js`
- `src/moduleRecipes.js`
- `src/items.js`

