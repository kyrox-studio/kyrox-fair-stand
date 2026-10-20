> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/PLASTIC_TRASH_BIN.md` içindedir. Eski kayıt uyumluluğu kullanıcı kararıyla kapsam dışıdır.

# DEPOT_PLASTIC_TRASH_BIN — Tarihî envanter profili

Bu belge `DEPOT_PLASTIC_TRASH_BIN` için `Version2` runtime kodunda bulunan state, behavior, renderer, interaction ve persistence akışlarını toplar.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `DEPOT_PLASTIC_TRASH_BIN` |
| Etiket | `Çöp Kutusu` |
| Type | `plastic-trash-bin` |
| Genişlik | `40 cm` |
| Derinlik | `40 cm` |
| Yükseklik | `60 cm` |
| Model dosyası | `plastic_trash_bin.glb` |

Varsayılan runtime state:

```text
{
  "id": "<generated>",
  "type": "plastic-trash-bin",
  "widthCm": 40,
  "depthCm": 40,
  "heightCm": 60,
  "modelFile": "plastic_trash_bin.glb",
  "modelRotationYDeg": 0,
  "preserveModelScale": false,
  "catalogKey": "DEPOT_PLASTIC_TRASH_BIN"
}
```

## Sözleşme

| Alan | Kod değeri |
|---|---|
| Profile | `free-model-fixed` |
| State sahibi | `src/designState.js` |
| Kalıcılık | `project-state` |
| Color | `fixed` |
| Image | `none` |
| Renderer politikası | `model` |
| Runtime | `static` |
| Bileşim | `standalone` |
| BOM kipi | `decision-required` |
| BOM kaynağı | `None` |

## Davranış / yerleşim

| Alan | Kod değeri |
|---|---|
| Placement contract | `free` |
| Move snap | `10 cm` |
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
| Wall capacity | `include` |
| Ghost | `silhouette / module-silhouette / opacity 0.38` |

Placement `free` ailesindedir. Move/rotation ve boundary değerleri yukarıdaki behavior tablosundan gelir; `snapPlacementToStand(... forceFree=true/placement free)` yolu stand footprint'ine göre placement üretir. Generic arrow movement de free placement üzerinde collision validation çalıştırır.

## Renderer

`plastic-trash-bin`, `createIndoorPlantModule()` renderer yoluna girer ve `plastic_trash_bin.glb` yükler. Instance `visualRotationYDeg` değeri visual group'u Y ekseninde döndürür; factory başlangıç değerini kanonik Item'daki `visualRotationYDeg=-90` defaultundan üretir ve renderer eksik state alanında aynı Item defaultuna döner. `Sphere_1` adlı node kaldırılır, `Object_5` mesh material'ları beyaza çekilir ve texture map temizlenir. `preserveModelScale=false` olduğu için model hedef 40×40×60 cm box'a fit edilir. Editable color/image surface state'i yoktur.

## Selection / appearance

Contract appearance alanları ve renderer surface/proxy yapısı birlikte uygulanır. Module-selection yüzeyleri panel-selection olmadığı için glass/Lightbox/Mesh context aksiyonlarını açmaz.

Automatic depot `includeContents` aktifken çöp kutusu catalog descriptor ölçü/model alanlarıyla depot spec'ine eklenir.

Katalog kartı `moduleDragSidebar.js` içinde özel `module-drag-trash-bin` siluetiyle gösterilir; wall/panel şerit önizlemesini kullanmaz.

Automatic depot state mappinginde bu içerik `currentModules` içine eklenirken `autoDepot = true` flag'i alır. `FEATURE_CONTRACTS.automaticDepot` contentKinds listesinde bu type yer alır.

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

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `DEPOT_PLASTIC_TRASH_BIN` için clone edilen normal nested state alanları korunur.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `DEPOT_PLASTIC_TRASH_BIN` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

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

`moduleDragSidebar.js` içinde `DEPOT_PLASTIC_TRASH_BIN` katalog grubu **Extra** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

## Kod kaynakları

- `src/catalog.js`
- `src/designState.js`
- `src/moduleContracts.js`
- `src/moduleBehavior.js`
- `src/modulePlacement.js`
- `src/scene3d.js`
- `src/moduleContextMenu.js`
- `src/main.js`
- `src/autoDepot.js`

## Checklist ek envanteri
- Yapı: tekil ticari ürün; mevcut sistemde alt Item reçetesi yok. Parametrik BOM yok.
- Unit: mevcut sistemde YOK; BOM aşamasına geçilmediği için kanonik unit tahmin edilmedi.
- Length/thickness: bu ürünün mevcut business state/descriptor kaynaklarında YOK; üretim paneli ölçüsü uygulanmıyor.
- Material/defaultColor: bağımsız business metadata YOK. GLB malzemeleri ve sidebar renkleri görsel temsildir; kullanıcı renk/image yetkisi yok.
- Property owners: catalog + designState + autoDepot ölçüleri migration öncesi tekrarlanıyordu. Renderer fallback ve seçim metni ayrıca tarandı.
- Factory: createModuleStateFromDescriptor → type factory; ID createId('module'). Placement ve autoDepot flag runtime instance alanlarıdır.
- Overrides: ürün defaultları kanonik Item tanımından gelir; dış descriptor bunların kaynağı olamaz. Factory `visualRotationYDeg` defaultunu instance state'e kopyalar; kontrollü runtime/editor değişikliği bunu daha sonra ezebilir. Placement ve autoDepot flag gibi diğer instance alanları da proje state'inde korunur.
- Relationships: otomatik depo içerik koordinatlarını planlar; kettle/fridge footprint overlap behavior kaynağındadır. Kettle yükseltmesi görsel olarak fridge yüksekliğindedir; persistent host bağı veya otomatik host takip/reflow yok.
- Delete/duplicate: generic context menu; seçimi, sürüklemeyi, klavye rotation/move ve side insertion ortak motorlar yönetir.
- Regression: ilgili ürün testi, commercialItemsContract ve gerçek katalog/depo/persistence E2E kapsamı.
- Açık bulgular: F-014 mevcut `decision-required` durumuyla korunur; F-019 bu dört ürünün tekrar eden state ölçüleri kapsamında etkilenir.
