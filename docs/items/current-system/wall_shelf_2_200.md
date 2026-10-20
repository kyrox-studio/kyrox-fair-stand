> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/wall_shelf_2_200.md` içindedir.

# wall_shelf_2_200 — Tarihî envanter profili

Bu belge `wall_shelf_2_200` için `Version2` runtime kodunda çalışan bütün ana akışları toplar.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `wall_shelf_2_200` |
| Etiket | `Raf 200 · 2 Raf` |
| Type | `shelf` |
| Genişlik | `200 cm` |
| Shelf count | `2` |
| Shelf projection | `38 cm` |
| Shelf thickness | `3 cm` |

Oluşturma state:

```text
id = generated
type = shelf
widthCm = 200
shelfCount = 2
shelfLightingOn = false
strips[0..6] = 7 editable panel state
catalogKey = wall_shelf_2_200
```

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

## Davranış / yerleşim

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

Shelf WALL behavior kullanır. Runtime wall/free placement, 50 cm move snap, 90° rotation, continuous-wall/free-side insertion ve wall-overlay host davranışlarına dahildir.

## Renderer

`createShelfModule()` önce `createFlatPanelModule()` çağırır; yani 7 editable wall paneli, iki dikey profil ve alt/üst rail tabanı korunur.

Ek shelf geometri:

```text
shelf heights = 100, 150 cm
shelf projection = 38 cm
shelf thickness = 3 cm
```

Her shelf için yalnız kanonik sunta shelf mesh'i oluşturulur; renderer ayrı alüminyum front profile eklemez. Her shelf yanında bir LED strip ve iki spotlight oluşturulur. Bütün shelf light görünürlüğü tek `moduleState.shelfLightingOn` boolean'ı ile kontrol edilir.

## Selection / appearance

7 wall paneli `selectionMode=panel`, `acceptsImage=true` olduğu için color/image/glass/Lightbox/Mesh destekler. Shelf geometrisinin kendisi panel selection state'i değildir.

Context menu `type=shelf` için `Raf altı aydınlatmayı aç/kapat` aksiyonunu gösterir. Bu aksiyon `shelfLightingOn` state'ini değiştirir.

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

`type = shelf` için ayrıca:

```text
Raf altı aydınlatmayı aç / kapat
```

Picker `MODULE_CATALOG_KEYS` listesinin tamamını gösterir; aynı katalog kaydı birden fazla kez seçilebilir, seçim chip'leri drag ile sıralanabilir. Sağ ekleme isteğinde picker gönderim sırasını ters çevirir; `main.js` placement yoluna göre continuous-wall veya free-side insertion planını kullanır.

`allowSideInsert` behavior alanı context menu butonlarını gizlemek için kullanılmıyor; menü HTML'inde ekleme/çoğaltma aksiyonları genel olarak bulunuyor.

## Duplicate / delete

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `wall_shelf_2_200` için clone edilen normal nested state alanları korunur.

Lightbox/Mesh ownership için scene rebuild sırasında `fabricGroupId` normalizasyonu yapılır. Duplicate'ın eski fabric grubuna yanlış owner olarak katılması engellenir; beklenmeyen clone yüzeylerinde fabric state temizlenebilir.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

Silinen modül multi-module Lightbox/Mesh owner grubunun parçasıysa rebuild sırasında eksik owner yüzey algılandığında kalan fabric ownership de çözülebilir.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `wall_shelf_2_200` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

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
recipeId = shelf-wall-200-2
moduleType = shelf
nominalWidthCm = 200
connectionMode = straight
```

| Part ID | Kod adı | Adet | Birim |
|---|---|---:|---|
| `profile_190` | Profil 190 cm | 2 | adet |
| `upright_346_5` | Dikme 346,5 cm | 2 | adet |
| `panel_197` | Panel 197 × 47 cm | 7 | adet |
| `connector_start` | Başlangıç Aparatı | 2 | adet |
| `connector_single` | Tekli Aparat | 13 | adet |
| `shelf_200` | Raf 200 cm | 2 | adet |
| `shelf_leg` | Raf Ayağı | 6 | adet |

Recipe metadata'sında ayrıca:

```text
variants.innerCornerPanelItemKey = panel_corner_192
```

`panel_corner_192` production registry kaydı: `İç Köşe Paneli 192 × 47 cm` (widthCm=192, heightCm=47, depthCm=0.8). Bu part normal `recipe.items` satırlarında yer almaz.

`rawBomDebug.js` seçili modül için `getExpandedModuleRecipe()` çağırıp `recipe.items` satırlarını gösterir. Bu ekranda placement ilişkilerinden ayrıca part dönüşümü yapan bir çağrı yoktur.

Recipe içindeki shelf-specific satırlar:

```text
shelf_200 × 2
shelf_leg × 6
```

## Catalog sidebar / selection feedback

`moduleDragSidebar.js` içinde `wall_shelf_2_200` katalog grubu **Raf & Vitrin** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

`selectionFeedback.js` shelf selection'ında width, shelfCount ve alttan strip numarasını gösterir; yüzey için renk + görsel uygulanabilir bilgisini verir.

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

