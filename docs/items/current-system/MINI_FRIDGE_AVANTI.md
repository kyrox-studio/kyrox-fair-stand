> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/MINI_FRIDGE_AVANTI.md` içindedir. Eski kayıt uyumluluğu kullanıcı kararıyla kapsam dışıdır.

# DEPOT_MINI_FRIDGE_AVANTI — Tarihî envanter profili

Bu belge `DEPOT_MINI_FRIDGE_AVANTI` için `Version2` runtime kodunda bulunan state, behavior, renderer, interaction ve persistence akışlarını toplar.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `DEPOT_MINI_FRIDGE_AVANTI` |
| Etiket | `Mini Buzdolabı` |
| Type | `mini-fridge` |
| Genişlik | `50 cm` |
| Derinlik | `50 cm` |
| Yükseklik | `66 cm` |
| Model dosyası | `None` |

Varsayılan runtime state:

```text
{
  "id": "<generated>",
  "type": "mini-fridge",
  "widthCm": 50,
  "depthCm": 50,
  "heightCm": 66,
  "catalogKey": "DEPOT_MINI_FRIDGE_AVANTI"
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
| Overlap izinleri | `kettle` |
| Wall-overlay host | `false` |
| Wall capacity | `include` |
| Ghost | `silhouette / module-silhouette / opacity 0.38` |

Placement `free` ailesindedir. Move/rotation ve boundary değerleri yukarıdaki behavior tablosundan gelir; `snapPlacementToStand(... forceFree=true/placement free)` yolu stand footprint'ine göre placement üretir. Generic arrow movement de free placement üzerinde collision validation çalıştırır.

## Renderer

Renderer `public/models/80s_avanti_mini_fridge.glb` yükler, modeli hedef 66 cm yüksekliğe uniform scale eder ve ayak altını Y=0'a oturtur. Runtime state/catalog footprint 50×50×66 cm'dir. Selection-feedback metninde mini buzdolabı için ayrıca `45 × 43 × 66 cm` sabit metni vardır; bu değer state width/depth alanlarından ayrı bir UI metnidir. Image/color surface state'i yoktur.

## Selection / appearance

Contract appearance alanları ve renderer surface/proxy yapısı birlikte uygulanır. Module-selection yüzeyleri panel-selection olmadığı için glass/Lightbox/Mesh context aksiyonlarını açmaz.

Automatic depot `includeContents` aktifken mini-fridge spec'i üretilir. Kettle placement'ı aynı depot pack içinde fridge üstüne gelecek x/y ile hazırlanır.

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

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `DEPOT_MINI_FRIDGE_AVANTI` için clone edilen normal nested state alanları korunur.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `DEPOT_MINI_FRIDGE_AVANTI` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

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

`moduleDragSidebar.js` içinde `DEPOT_MINI_FRIDGE_AVANTI` katalog grubu **Extra** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

`selectionFeedback.js` bu Item için kullanıcıya şu bilgi sınıfını üretir: `Mini Buzdolabı · 45 × 43 × 66 cm · GLB model. (UI feedback sabit metni)`

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
- Overrides: kayıtlı instance alanları JSON snapshot ile korunur. Trash descriptor ölçü/model ayarları dışında ürün ölçüsü için kullanıcı düzenleme kontrolü yok.
- Relationships: otomatik depo içerik koordinatlarını planlar; kettle/fridge footprint overlap behavior kaynağındadır. Kettle yükseltmesi görsel olarak fridge yüksekliğindedir; persistent host bağı veya otomatik host takip/reflow yok.
- Delete/duplicate: generic context menu; seçimi, sürüklemeyi, klavye rotation/move ve side insertion ortak motorlar yönetir.
- Regression: ilgili ürün testi, commercialItemsContract ve gerçek katalog/depo/persistence E2E kapsamı.
- Açık bulgular: F-014 mevcut `decision-required` durumuyla korunur; F-019 bu dört ürünün tekrar eden state ölçüleri kapsamında etkilenir.
