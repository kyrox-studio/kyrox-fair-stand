> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/wall_separator_50_sarmasik.md` içindedir.

# wall_separator_50_sarmasik — Tarihî envanter profili

Bu belge `wall_separator_50_sarmasik` için `Version2` runtime kodunda bulunan davranışı toplar. Yeni davranış/audit yorumu eklemez.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `wall_separator_50_sarmasik` |
| Etiket | `Separatör 50 Sarmaşık` |
| Type | `separator` |
| Genişlik | `50 cm` |
| Model dosyası | `wall_separator_50_sarmasik.glb` |

Oluşturma state:

```text
id = generated
type = separator
widthCm = 50
modelFile = wall_separator_50_sarmasik.glb
surface.id = generated
surface.color = #c79b63
catalogKey = wall_separator_50_sarmasik
```

Separator state'inde `imageAssetId` yoktur.

## Sözleşme

| Alan | Kod değeri |
|---|---|
| Profile | `wall-color-only` |
| State sahibi | `src/designState.js` |
| Kalıcılık | `project-state` |
| Color | `editable` |
| Image | `none` |
| Renderer politikası | `procedural-or-model` |
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

Separator WALL behavior kullanır. `snapPlacementToStand()` nedeniyle runtime placement `back/left/right` yanında `free` de olabilir. Wall snap `50 cm`, neighbor snap `30 cm`, move snap `50 cm`, rotation step `90°`dir. Free context insertion ile wall continuous insertion yolları placement `wallId` değerine göre ayrılır.

## Renderer

`createSeparatorModule()` procedural frame ve slat geometri oluşturur:

- stand height `350 cm`, depth `10 cm`,
- dikey frame genişliği catalog `frameWidth = 5.5 cm`,
- frame depth `10 cm`,
- `36` yatay slat,
- slat yüksekliği `3.5 cm`,
- slat gap `6 cm`,
- tek editable `surface.color` bütün slat color target'larına uygulanır,
- selection yüzeyi `selectionMode = module`, `acceptsImage = false`.

Sarmaşık varyantında `wall_separator_50_sarmasik.glb` ayrıca GLB olarak yüklenir. Renderer modelde yalnız adı `Vines_FIXED_` ile başlayan mesh'leri görünür bırakır; bu dekoratif mesh'lerde raycast devre dışıdır. Model yüklenemezse veya uygun mesh bulunmazsa console warning üretilir. Procedural separator frame/slat yapısı yine oluşturulur.

## Selection / appearance

Selection module seviyesindedir; panel-selection olmadığı için glass/Lightbox/Mesh context aksiyonları açılmaz. `appearance.color = editable`, `appearance.image = none`dir. Görsel asset state'i yoktur.

## Overlay host

Behavior `supportsWallOverlayMount = true` döndürür; separator wall-overlay destek ailesine dahildir.

## Context menu

`moduleContextMenu.js` içindeki modül menüsü şu temel aksiyonları içerir:

```text
Döndür
Sil
Ekle Sağ Tarafa…
Ekle Sol Tarafa…
```

Picker `MODULE_CATALOG_KEYS` listesinin tamamını gösterir; aynı katalog kaydı birden fazla kez seçilebilir, seçim chip'leri drag ile sıralanabilir. Sağ ekleme isteğinde picker gönderim sırasını ters çevirir; `main.js` placement yoluna göre continuous-wall veya free-side insertion planını kullanır.

`allowSideInsert` behavior alanı context menu butonlarını gizlemek için kullanılmıyor; menü HTML'inde ekleme/çoğaltma aksiyonları genel olarak bulunuyor.

## Duplicate / delete

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `wall_separator_50_sarmasik` için clone edilen normal nested state alanları korunur.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `wall_separator_50_sarmasik` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

Proje restore sırasında modüller clone edilir ve `resolveModuleCatalogKey(moduleState)` tekrar çalıştırılır. Asset'ler scene rebuild edilmeden önce yüklenir. Autosave signature `stand` ve `modules` state'ini kapsar.

ZIP export yapısı:

```text
project.json
assets/*
```

`Tüm Özellikleri Kaldır` akışında katalog modülleri `createCatalogModuleState(module, { preservePlacement: true })` ile default state'ten yeniden oluşturulur; placement korunur, instance/surface kimlikleri ve düzenlenebilir state defaultlara döner.

## BOM / production recipe

```text
recipeId = separator-50
moduleType = separator
nominalWidthCm = 50
connectionMode = straight
```

| Part ID | Kod adı | Adet | Birim |
|---|---|---:|---|
| `profile_41_5` | Profil 41,5 cm | 2 | adet |
| `upright_346_5` | Dikme 346,5 cm | 2 | adet |
| `separator_panel_48_5` | Separatör Paneli 48,5 × 47 cm | 1 | adet |
| `separator_panel_98` | Separatör Paneli 98 × 47 cm | 3 | adet |
| `connector_start` | Başlangıç Aparatı | 2 | adet |
| `connector_single` | Tekli Aparat | 7 | adet |

`rawBomDebug.js` seçili modül için `getExpandedModuleRecipe()` çağırıp `recipe.items` satırlarını gösterir. Bu ekranda placement ilişkilerinden ayrıca part dönüşümü yapan bir çağrı yoktur.

## Catalog sidebar / selection feedback

`moduleDragSidebar.js` içinde `wall_separator_50_sarmasik` katalog grubu **Panel & Duvar** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

`selectionFeedback.js` bu Item için kullanıcıya şu bilgi sınıfını üretir: `Separatör 50 cm · yalnızca renk uygulanabilir.`

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

