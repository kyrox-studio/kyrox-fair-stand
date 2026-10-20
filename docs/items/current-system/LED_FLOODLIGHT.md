> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/led_floodlight.md` içindedir. Eski katalog anahtarı `LED_FLOODLIGHT` idi.

# LED_FLOODLIGHT — Tarihî envanter profili

Bu belge `LED_FLOODLIGHT` için `Version2` runtime kodunda bulunan state, top-placement, renderer, interaction ve persistence akışlarını toplar.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `LED_FLOODLIGHT` |
| Etiket | `LED Projektör` |
| Type | `led-floodlight` |
| Genişlik | `50 cm` |
| Derinlik | `20 cm` |
| Yükseklik | `35 cm` |
| Mount/top height | `350 cm` |

State `surface.color = #17191c` taşır.

## Sözleşme

| Alan | Kod değeri |
|---|---|
| Profile | `top-light` |
| State sahibi | `src/designState.js` |
| Kalıcılık | `project-state` |
| Color | `state-backed` |
| Image | `none` |
| Renderer politikası | `procedural` |
| Runtime | `static` |
| Bileşim | `standalone` |
| BOM kipi | `decision-required` |
| BOM kaynağı | `None` |

## Davranış / yerleşim

| Alan | Kod değeri |
|---|---|
| Placement contract | `top` |
| Move snap | `20 cm` |
| Rotation step | `90°` |
| Default rotation | `0°` |
| Side insert flag | `true` |
| Collision contract | `none` |
| Magnetic snap | `none` |
| Connection endpoint | `segment` |
| Collision depth | `physical` |
| Endpoint contact | `standard` |
| Boundary snap | `stand-edge` |
| Side-insert rotation | `inherit` |
| Overlap izinleri | `[]` |
| Wall-overlay host | `false` |
| Wall capacity | `exclude` |
| Ghost | `silhouette / module-silhouette / opacity 0.38` |

Placement family `top`tır. Move snap `20 cm`, rotation `90°`, collision `none`, magnetic snap `none`, wallCapacity `exclude`dur.

Top drag plane `zCm=350` kullanır. Top placement wall sınırına yaklaşık `30 cm` içinde ise back/left/right wall kimliği alabilir; aksi halde top plane üzerinde `wallId=free` placement oluşabilir. Generic arrow move yolu da free placement yazabilir.

## Renderer

`createLedFloodlightModule()` procedural gövde/bracket/lens oluşturur. Lens emissive material taşır. LED noktaları nested loop ile 5 sıra × 9 kolon = **45** küçük LED point olarak üretilir. Renderer ayrıca intensity `44`, distance `5.6` olan spotlight oluşturur.

Selection lens üzerinden `selectionMode=module`, `acceptsImage=false` çalışır. Surface state lens selection'a bağlanır; renderer `colorTargets=[]` verdiği için generic color uygulaması seçili lens material üzerinde state color'ı uygular, body/bracket material'ı bu target listesinde değildir.

Context menu'de LED'e özel light on/off butonu yoktur; spotlight renderer tarafından doğrudan oluşturulur.

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

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `LED_FLOODLIGHT` için clone edilen normal nested state alanları korunur.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `LED_FLOODLIGHT` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

Proje restore sırasında modüller clone edilir ve `resolveModuleCatalogKey(moduleState)` tekrar çalıştırılır. Asset'ler scene rebuild edilmeden önce yüklenir. Autosave signature `stand` ve `modules` state'ini kapsar.

ZIP export yapısı:

```text
project.json
assets/*
```

`Tüm Özellikleri Kaldır` akışında katalog modülleri `createCatalogModuleState(module, { preservePlacement: true })` ile default state'ten yeniden oluşturulur; placement korunur, instance/surface kimlikleri ve düzenlenebilir state defaultlara döner.

## BOM

Kodda bu Item için recipe yoktur.

```text
bom.mode = decision-required
bom.source = None
```

`moduleContracts.js` içindeki mevcut reason:

> Existing module has no kanonik BOM policy yet; decide recipe, commercial-item, or explicit exclusion before Final BOM integration.

Bu dosyada olmayan bir BOM satırı eklenmemiştir.

## Catalog sidebar / selection feedback

`moduleDragSidebar.js` içinde `LED_FLOODLIGHT` katalog grubu **Elektronik & Aydınlatma** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

`selectionFeedback.js` bu Item için kullanıcıya şu bilgi sınıfını üretir: `LED Projektör · 350 cm üst profile bağlı aydınlatma.`

## Kod kaynakları

- `src/catalog.js`
- `src/designState.js`
- `src/moduleContracts.js`
- `src/moduleBehavior.js`
- `src/modulePlacement.js`
- `src/scene3d.js`
- `src/moduleContextMenu.js`
- `src/main.js`
