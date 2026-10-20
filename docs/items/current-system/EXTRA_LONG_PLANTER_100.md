> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/EXTRA_LONG_PLANTER_100.md` içindedir.

# EXTRA_LONG_PLANTER_100 — Tarihî envanter profili

Bu belge `EXTRA_LONG_PLANTER_100` için `Version2` runtime kodunda bulunan state, behavior, renderer, interaction ve persistence akışlarını toplar.

## Kimlik / state

| Alan | Kod değeri |
|---|---|
| Katalog anahtarı | `EXTRA_LONG_PLANTER_100` |
| Etiket | `Uzun Saksı 100` |
| Type | `indoor-plant-1` |
| Genişlik | `100 cm` |
| Derinlik | `30 cm` |
| Yükseklik | `30 cm` |
| Model dosyası | `saksi_bitkili_100x30x30.glb` |

Varsayılan runtime state:

```text
{
  "id": "<generated>",
  "type": "indoor-plant-1",
  "widthCm": 100,
  "depthCm": 30,
  "heightCm": 30,
  "modelFile": "saksi_bitkili_100x30x30.glb",
  "modelRotationYDeg": 90,
  "preserveModelScale": true,
  "surface": {
    "id": "<generated>",
    "color": "#ffffff"
  },
  "catalogKey": "EXTRA_LONG_PLANTER_100"
}
```

## Sözleşme

| Alan | Kod değeri |
|---|---|
| Profile | `free-model-color` |
| State sahibi | `src/designState.js` |
| Kalıcılık | `project-state` |
| Color | `editable` |
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
| Collision contract | `footprint` |
| Magnetic snap | `standard` |
| Connection endpoint | `segment` |
| Collision depth | `physical` |
| Endpoint contact | `thin-wall-endpoint` |
| Boundary snap | `stand-edge` |
| Side-insert rotation | `inherit` |
| Overlap izinleri | `[]` |
| Wall-overlay host | `false` |
| Wall capacity | `include` |
| Ghost | `silhouette / module-silhouette / opacity 0.38` |

Placement `free` ailesindedir. Move/rotation ve boundary değerleri yukarıdaki behavior tablosundan gelir; `snapPlacementToStand(... forceFree=true/placement free)` yolu stand footprint'ine göre placement üretir. Generic arrow movement de free placement üzerinde collision validation çalıştırır.

## Renderer

Renderer `createIndoorPlantModule()` üzerinden `saksi_bitkili_100x30x30.glb` yükler. `preserveModelScale=true`, `modelRotationYDeg=90` state'indedir. Renderer planter/pot mesh adlarını tespit edip bunları `colorTargets` olarak surface state'e bağlar; image editable değildir. Selection module seviyesindedir.

## Selection / appearance

Contract appearance alanları ve renderer surface/proxy yapısı birlikte uygulanır. Module-selection yüzeyleri panel-selection olmadığı için glass/Lightbox/Mesh context aksiyonlarını açmaz.

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

`duplicateModuleState()` state'i JSON clone eder, yeni module `id` üretir ve varsa strip/face/surface kimliklerini yeniler. `EXTRA_LONG_PLANTER_100` için clone edilen normal nested state alanları korunur.

`Sil` aksiyonu hedef modülü `currentModules` listesinden çıkarıp scene'i yeniden kurar. Delete sonrası bütün duvarı otomatik compact eden genel bir çağrı yapılmaz.

## Kalıcılık / kayıt / yükleme

`buildProjectSnapshot()` bütün `currentModules` dizisini JSON clone ile proje snapshot'ındaki `modules` alanına yazar. `EXTRA_LONG_PLANTER_100` state'i placement ve nested state alanlarıyla birlikte burada saklanır.

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

`moduleDragSidebar.js` içinde `EXTRA_LONG_PLANTER_100` katalog grubu **Extra** altında yer alır. Catalog card drag akışı `Shift+R` ile behavior rotation step'ini kullanır; ghost/placement preview `scene3d.previewCatalogModuleDrag()` yoluna gider.

`selectionFeedback.js` state'te `surface` bulunan indoor-plant için `Uzun Saksı <width>` ve `saksı gövdesi · renk uygulanabilir` bilgisini verir.

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

