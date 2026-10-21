> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/desk_banko_200.md` içindedir.

# desk_banko_200 — Tarihî envanter profili

Bu belge `desk_banko_200` için `Version2` runtime kodunda çalışan state, placement, renderer, interaction, persistence ve BOM akışlarını toplar.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `desk_banko_200` |
| Etiket | `Banko 200` |
| Type | `counter` |
| Shape | `straight` |
| Genişlik | `200 cm` |
| Derinlik | `50 cm` |
| Yükseklik | `100 cm` |
| Editable face count | `6` |

Factory straight counter için `frontLower/frontUpper/leftLower/leftUpper/rightLower/rightUpper` olmak üzere 6 editable face oluşturur. L shape ayrıca `returnLower/returnUpper` ekleyerek 8 face oluşturur. Her face default beyaz ve image-editable state taşır.

## Sözleşme

| Alan | Kod değeri |
|---|---|
| Profile | `free-editable` |
| State sahibi | `src/designState.js` |
| Kalıcılık | `project-state` |
| Color | `editable` |
| Image | `editable` |
| Renderer politikası | `procedural` |
| Runtime | `static` |
| Bileşim | `standalone` |
| BOM kipi | `recipe` |
| BOM kaynağı | `src/moduleRecipes.js` |

## Behavior

| Alan | Kod değeri |
|---|---|
| Placement contract | `free` |
| Move snap | `50 cm` |
| Rotation step | `45°` |
| Default rotation | `0°` |
| Side insert flag | `true` |
| Collision contract | `footprint` |
| Magnetic snap | `standard` |
| Connection endpoint | `logical-fixture` |
| Collision depth | `physical` |
| Endpoint contact | `standard` |
| Boundary snap | `stand-edge` |
| Side-insert rotation | `inherit` |
| Overlap izinleri | `[]` |
| Wall-overlay host | `false` |
| Wall capacity | `include` |
| Ghost | `silhouette / module-silhouette / opacity 0.38` |

Counter placement `free`dir. Connection endpoint `logical-fixture` olarak tanımlıdır. Collision strategy footprint'tir; magnetic snap standard'dır.

Straight 100/150/200 counter için `getModuleBehavior()` rotation step'i `45°` yapar; default rotation `0°`dir.

Move snap `50 cm`dir. Free placement stand sınırları içinde footprint ile clamp/snap edilir. Magnetic snap motoru logical fixture endpoint yüzleri için ayrıca fixture-side/corner-face adayları üretebilir.

## Renderer

`createCounterModule()` straight geometri oluşturur:

- width `200 cm`, depth `50 cm`, height `100 cm`,
- 4 corner post,
- köşe dikmeleri ve alt/üst raylar aynı kare kanallı profil kesitinde (`addBoxModuleFrame`; reçetedeki `profile_*` sahne ölçüsü),
- yüz panelleri profil dış yüzünün 15 mm önünde ve çerçevenin dış kenarından dört yanda 4 cm içeride (`placeBoxPanelFace`); gövde reçetedeki `panel_*` kalınlığında,
- yalnız bottom + top rail (middle rail yok),
- top thickness `4 cm`, overhang `2 cm`,
- 6 editable face,
- editable yüzeyler `selectionMode=module`, `acceptsImage=true`.

## Selection / color / image

Counter faces panel-selection değildir; bu yüzden glass/Lightbox/Mesh context aksiyonları açılmaz. Color ve image editable'dır.

Ctrl/Cmd ile counter yüzeylerinde çoklu selection toggling yolu vardır. `main.applyActiveImageToSelection()` seçili yüzeylerin hepsi `moduleType=counter` ise yüzeyleri `surfaceRole` bazında gruplar ve her face grubu için rectangle image uygulaması çağırır.

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

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `desk_banko_200` için clone edilen normal nested state alanları korunur.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `desk_banko_200` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

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
recipeId = counter-200
moduleType = counter
nominalWidthCm = 200
connectionMode = —
```

| Part ID | Kod adı | Adet | Birim |
|---|---|---:|---|
| `profile_190` | Profil 190 cm | 3 | adet |
| `profile_41_5` | Profil 41,5 cm | 4 | adet |
| `upright_99` | Dikme 99 cm | 4 | adet |
| `panel_197` | Panel 197 × 47 cm | 2 | adet |
| `panel_48_5` | Panel 48,5 × 47 cm | 4 | adet |
| `connector_start` | Başlangıç Aparatı | 6 | adet |
| `connector_single` | Tekli Aparat | 12 | adet |
| `counter_top_210_60` | Banko Üstü 210 × 60 cm | 1 | adet |

`rawBomDebug.js` seçili modül için `getExpandedModuleRecipe()` çağırıp `recipe.items` satırlarını gösterir. Bu ekranda placement ilişkilerinden ayrıca part dönüşümü yapan bir çağrı yoktur.

## Catalog sidebar / selection feedback

`moduleDragSidebar.js` içinde `desk_banko_200` katalog grubu **Banko & Baza** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

`selectionFeedback.js` counter seçiminde shape'e göre `Banko W cm` veya `Köşe Banko W×D`, face role'e göre ön/sol/sağ/L dönüş metni üretir; renk + görsel uygulanabilir bilgisini verir.

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
