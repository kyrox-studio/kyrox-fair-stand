> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/BASE_200.md` içindedir.`n`n# BASE_200 — Tarihî envanter profili

Bu belge `BASE_200` için `Version2` runtime kodunda bulunan state, behavior, renderer, interaction, persistence ve BOM akışlarını toplar.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `BASE_200` |
| Etiket | `Baza 200` |
| Type | `base` |
| Genişlik | `200 cm` |
| Derinlik | `50 cm` |
| Yükseklik | `50 cm` |

Factory `faces.front`, `faces.left`, `faces.right` olmak üzere 3 editable yüzey state'i üretir. Her biri default beyaz, imageAssetId null ve default single image transform taşır.

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

## Davranış / yerleşim

| Alan | Kod değeri |
|---|---|
| Placement contract | `free` |
| Move snap | `50 cm` |
| Rotation step | `90°` |
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

Base `free` placement, 50 cm move snap, 90° rotation, footprint collision, standard magnetic snap ve `connectionEndpoint=logical-fixture` kullanır.

## Renderer

`createBaseModule()` procedural baza oluşturur:

- 4 corner post,
- köşe dikmeleri ve alt/üst raylar aynı kare kanallı profil kesitinde (`addBoxModuleFrame`; reçetedeki `profile_*` sahne ölçüsü),
- yüz panelleri profil dış yüzünün 15 mm önünde ve çerçevenin dış kenarından alt/üstte 4 cm, sağ/solda 3 cm içeride (`placeBoxPanelFace`); gövde reçetedeki `panel_*` kalınlığında,
- bottom + top rail; middle rail yok,
- top thickness `3.5 cm`,
- top overhang `2 cm`,
- üç editable panel yüzeyi: front / left / right,
- yüzeyler `selectionMode=module`, `acceptsImage=true`.

Glass/Lightbox/Mesh yalnız panel-selection yüzeylerinde açıldığı için base yüzeylerinde bu context aksiyonları yoktur.

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

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `BASE_200` için clone edilen normal nested state alanları korunur.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `BASE_200` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

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
recipeId = base-200
moduleType = base
nominalWidthCm = 200
connectionMode = —
```

| Part ID | Kod adı | Adet | Birim |
|---|---|---:|---|
| `profile_190` | Profil 190 cm | 4 | adet |
| `profile_41_5` | Profil 41,5 cm | 4 | adet |
| `upright_49_5` | Dikme 49,5 cm | 4 | adet |
| `panel_197` | Panel 197 × 47 cm | 2 | adet |
| `panel_48_5` | Panel 48,5 × 47 cm | 2 | adet |
| `connector_start` | Başlangıç Aparatı | 8 | adet |
| `connector_single` | Tekli Aparat | 8 | adet |
| `base_top_206_50` | Baza Üstü 206 × 50 cm | 1 | adet |

`rawBomDebug.js` seçili modül için `getExpandedModuleRecipe()` çağırıp `recipe.items` satırlarını gösterir. Bu ekranda placement ilişkilerinden ayrıca part dönüşümü yapan bir çağrı yoktur.

## Catalog sidebar / selection feedback

`moduleDragSidebar.js` içinde `BASE_200` katalog grubu **Banko & Baza** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

`selectionFeedback.js` base seçiminde ön/sol/sağ panel rolünü ve renk + görsel uygulanabilir bilgisini verir.

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
