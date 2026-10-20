> Migration öncesi envanterdir; aktif kanonik tanım `../definitions/wall_200.md` içindedir.

# wall_200 — Tarihî envanter profili

Bu belge `wall_200` için mevcut çalışan sistemdeki kimlik, state, davranış, placement, context menu, panel işlemleri, görünüm, persistence ve BOM gerçeklerini tek yerde toplar.

> Bu dosya yeni davranış tanımlamaz. `Version2` runtime kodunda bugün gerçekten çalışan davranışı tarif eder. Testler yalnız destekleyici kanıttır; kaynak önceliği runtime kodudur.

## 1. Kimlik

| Alan | Mevcut değer |
|---|---|
| Katalog anahtarı | `wall_200` |
| Etiket | `Panel 200` |
| Type | `flat-panel` |
| Nominal genişlik | `200 cm` |
| Stand yüksekliği | `350 cm` |
| Nominal duvar derinliği | `10 cm` |
| Panel sırası | `7` |
| Her sıra yüksekliği | `50 cm` |

Katalog tanımı:

```js
wall_200: { type: 'flat-panel', widthCm: 200, label: 'Panel 200' }
```

Runtime kimliği ile Item-contract kimliğini ayırmak gerekir:

```text
Runtime state:
  catalogKey = wall_200
  type = flat-panel

Item-contract karşılığı:
  itemKey = wall_200
  class = composite Item
```

`itemKey` ve `class` bugün runtime state alanı değildir; Item mimarisi seviyesindeki kavramsal kimliktir.

Kanonik kaynaklar:

- `src/catalog.js`
- `src/moduleContracts.js`
- `src/moduleBehavior.js`
- `src/designState.js`

---

## 2. Proje instance state'i

`createFlatPanelModuleState(200)` temel olarak şu state'i üretir:

```text
id
type = flat-panel
widthCm = 200
strips[0..6]
```

`catalogKey = wall_200`, doğrudan factory içinde yazılmaz. `createModuleStateFromDescriptor()` descriptor'ı katalog resolver'ından geçirerek state'e ekler.

Her strip/panel state'i:

```text
id
stripIndex
color
imageAssetId
imageTransform
```

Default image transform:

```text
mode = single
offsetX = 0
offsetY = 0
repeatX = 1
repeatY = 1
rotation = 0
```

Mevcut varsayılanlar:

- 7 düzenlenebilir panel vardır.
- Default panel rengi `#ffffff`.
- Default görsel yoktur.
- Her panel bağımsız state taşır.
- Placement daha sonra eklenir.

Kaynak:

- `src/designState.js`

---

## 3. Contract profili

`moduleContracts.js` açısından `wall_200`:

```text
profile = wall-editable
state.owner = src/designState.js
state.persistence = project-state
appearance.color = editable
appearance.image = editable
renderer.mode = procedural-or-specialized
runtime.mode = static
composition.mode = standalone
bom.mode = recipe
bom.source = src/moduleRecipes.js
```

Gerçek sahne renderer'ı `wall_200` için procedural `createFlatPanelModule()` yolunu kullanır.

Kaynak:

- `src/moduleContracts.js`
- `src/scene3d.js`

---

## 4. Kanonik behavior

`wall_200`, `flat-panel` olduğu için `WALL_BEHAVIOR` kullanır.

| Davranış | Değer |
|---|---|
| Placement contract | `wall` |
| Hareket snap | `50 cm` |
| Rotation step | `90°` |
| Default rotation | `0°` |
| Side insert | `true` |
| Collision | `segment` |
| Magnetic snap | `standard` |
| Connection endpoint | `segment` |
| Collision depth | `physical` |
| Endpoint contact | `standard` |
| Boundary snap | `stand-edge` |
| Side insert rotation | `inherit` |
| Overlap izinleri | Yok |
| Wall overlay mount | `true` |
| Wall capacity | `include` |
| Ghost | `silhouette` |
| Ghost renderer | `module-silhouette` |
| Ghost opacity | `0.38` |

Önemli ayrım:

```text
behavior.placement = wall
```

olmasına rağmen runtime placement motoru gerektiğinde `wallId = free` placement da üretebilir. Yani behavior ailesi wall'dır; fakat gerçek proje state'i yalnız `back/left/right` ile sınırlı değildir.

Kaynak:

- `src/moduleBehavior.js`
- `src/modulePlacement.js`

---

## 5. Rotation

`wall_200` 90° adımlarla döner:

```text
0° → 90° → 180° → 270° → 0°
```

Kanonik duvar orientation'ları:

```text
back  =   0°
left  =  90°
right = 270°
```

Katalogdan sürükleme sırasında:

```text
Shift + R → 90° adımlı rotation
```

Sahnedeki module rotation yolu da aynı behavior resolver'ını kullanır.

Context menüde ayrı `Sağa Döndür` / `Sola Döndür` butonu yoktur.

Kaynaklar:

- `src/moduleBehavior.js`
- `src/moduleDragSidebar.js`
- `src/scene3d.js`

---

## 6. Placement — back / left / right / free

Placement state:

```text
xCm
yCm
zCm
rotationZDeg
wallId
```

Gerçek runtime'da `wall_200` şu `wallId` değerlerini alabilir:

```text
back
left
right
free
```

Wall snap uygun olduğunda placement arka/sol/sağ duvara bağlanır. Uygun wall placement oluşmadığında ve modül aktif stand alanına sığıyorsa `free` placement üretilebilir.

Bu nedenle aşağıdaki ifade tek başına yeterli değildir:

```text
placement = wall
```

Doğru yorum:

```text
Behavior family = wall
Runtime placement state = wall veya free olabilir
```

Kaynak:

- `src/modulePlacement.js`

---

## 7. Hareket

Kanonik move snap:

```text
50 cm
```

Duvar zinciri üzerindeki hareket akışı:

```text
istenen yeni placement
↓
placement validation
↓
uygunsa taşı
↓
çakışma / zincir ihtiyacı varsa continuous wall plan
↓
gerekli komşu modülleri reflow et
```

Ek runtime davranışı:

- Yön tuşu hareket yolunda yeni placement açıkça `wallId = free` olarak kurulabilir.
- Dolayısıyla duvara bağlı bir `wall_200` serbest placement'a geçirilebilir.
- Free placement'taki modüller continuous-wall motorundan farklı placement akışları kullanır.

Silme sonrası global compact/reflow yoktur.

Kaynaklar:

- `src/scene3d.js`
- `src/modulePlacement.js`
- `src/wallReflow.js`

---

## 8. Magnetic module snap

`wall_200` için:

```text
magneticSnap = standard
connectionEndpoint = segment
```

Runtime placement motoru modüller arasında aday bağlantılar üretebilir:

- aynı eksende gerçek uç-uca bağlantı,
- 90° köşe bağlantısı,
- uygun durumda T bağlantısı,
- stand boundary bağlantısı.

Bu davranış yalnız wall chain placement'ından ibaret değildir; free placement tarafında da module-to-module snap hesapları vardır.

Kaynak:

- `src/modulePlacement.js`

---

## 9. Continuous wall / reflow

`wall_200` aktif continuous-wall zincirinin parçasıdır.

Context insertion ve katalog append akışları gerektiğinde `planContinuousWallInsertion()` kullanır.

Reflow sırasında:

- mevcut modüller,
- yeni modül,
- target modül,
- stand tipi,
- X/Y stand kapasitesi

birlikte değerlendirilir.

Bir modül silindiğinde kalan zincir otomatik sıkıştırılmaz.

Kaynaklar:

- `src/main.js`
- `src/wallReflow.js`

---

## 10. Free side insertion

`wall_200` `wallId = free` durumundaysa context `Ekle Sağ/Sol` ve duplicate işlemleri continuous wall motorunu kullanmaz.

Bu durumda:

```text
planFreeSideInsertion()
```

yolu kullanılır.

Yani aynı Item için iki farklı ilişki/ekleme yolu vardır:

```text
wall placement → continuous wall insertion/reflow
free placement → free side insertion
```

Kaynaklar:

- `src/main.js`
- `src/modulePlacement.js`

---

## 11. Otomatik stand duvarı üretimi

`wall_200` yalnız kullanıcı tarafından katalogdan eklenmez.

Yeni non-island stand oluşturulurken automatic wall composer duvarı mevcut genişliklerden oluşturur. Genişlik önceliği büyükten küçüğe ilerler:

```text
200
150
100
50
```

Dolayısıyla uygun stand uzunluğunda `wall_200` otomatik olarak state'e eklenebilir.

Automatic wall sonucu gerçek state'e şu yol üzerinden çevrilir:

```text
composeAutomaticStandWall()
→ width listesi / placement listesi
→ createModuleStateFromDescriptor({ type: 'flat-panel', widthCm })
→ appendAutomaticWallLamps()
→ her kesintisiz sırt/sol/sağ flat-panel koşusunda 150 cm'de bir led-floodlight
```

Depo arka duvarı ve depo yan paneli bu 150 cm sayımına girmez. 150 cm'den kısa koşuya lamba konmaz. Ada standta duvar olmadığı için bu lamba da oluşmaz.

Kaynaklar:

- `src/automaticWall.js`
- `src/main.js`

---

## 12. Otomatik depo ile oluşan wall_200

Automatic depot aktif olduğunda sistem ayrıca `flat-panel` duvar state'leri üretebilir.

Runtime flag'leri:

```text
autoDepot = true
autoDepotBack = true   // arka depo duvarı için uygun kayıtta
```

Bu flag'ler runtime state'in parçasıdır; `wall_200` normal katalog Item'ından farklı bir `type` üretmez.

Kaynaklar:

- `src/autoDepot.js`
- `src/main.js`

---

## 13. Procedural renderer

`wall_200` GLB modeli değildir. `scene3d.js` içinde `createFlatPanelModule()` ile procedural oluşturulur.

Mevcut renderer geometrisi:

| Özellik | Mevcut runtime değeri |
|---|---:|
| Nominal genişlik | `200 cm` |
| Yükseklik | `350 cm` |
| Nominal frame depth | `10 cm` |
| Dikey profil genişliği | `4 cm` |
| Dikey profil adedi | `2` |
| Panel sırası | `7` |
| Render panel iç genişliği | yaklaşık `190.8 cm` |
| Render panel yüksekliği | yaklaşık `49.6 cm` |
| Panel backing depth | yaklaşık `7.4 cm` |

Renderer en alt ve en üst rail'i üretir. Ara 50 cm bölümlerde ayrı yatay profil geometrisi oluşturmaz; panel sıraları state/selection açısından yine 7 adettir.

Panel state eksikse ilgili panel normal biçimde üretilemez ve renderer bunu hata/uyarı olarak ele alır.

Kaynak:

- `src/scene3d.js`

---

## 14. Sol click / selection

`wall_200` 7 seçilebilir panel yüzeyi taşır.

Panel yüzeyleri:

```text
selectionMode = panel
```

olarak oluşturulur.

Normal click davranışı drag çözümünden sonra selection'a dönüşür.

Kaynak:

- `src/scene3d.js`

---

## 15. Ctrl/Cmd çoklu panel selection

İki farklı selection kuralını ayırmak gerekir.

### Panel range selection

`createPanelRangeSelection()`:

- anchor ve target panel arasında module/strip aralığı kurar,
- aralıkta panel olmayan hücreler varsa yalnız gerçekten var olan panelleri seçebilir,
- eksik panel hücresi range selection'ı otomatik bozmaz.

### Tam rectangle selection

`createRectSelection()`:

- beklenen bütün hücrelerin bulunmasını ister,
- herhangi bir hücre eksikse selection geçersizdir,
- Lightbox/Mesh gibi tam blok isteyen işlemler bu daha katı kurala dayanır.

Bu iki davranış aynı değildir.

Kaynak:

- `src/rectSelection.js`
- `src/scene3d.js`

---

## 16. Connected panel path

Free placement'taki bağlı panel modülleri için `createConnectedPanelModulePath()` kullanılır.

Bağlantı graph'ı:

- aynı eksendeki uç temaslarını,
- farklı eksendeki endpoint kesişimlerini

bağlantı olarak değerlendirebilir.

Bu sayede `wallId = free` olan panel gruplarında da bağlı yüzey selection yolu kurulabilir.

Kaynak:

- `src/rectSelection.js`
- `src/scene3d.js`

---

## 17. Mouse / kamera davranışı

Scene genel mapping:

```text
Sol mouse drag  → kamera rotate
Orta mouse      → pan
Sağ mouse       → OrbitControls'a verilmez
```

Sağ mouse modül/panel context-menu interaction akışı için kullanılır.

Kaynak:

- `src/scene3d.js`

---

## 18. Context menu

`wall_200` üzerinde mevcut module context aksiyonları:

```text
Döndür
Sil
Ekle Sağ Tarafa…
Ekle Sol Tarafa…
```

Panel seviyesinde uygun selection olduğunda:

```text
Cam Panele Çevir
Normal Panele Çevir

Lightbox Kumaşa Çevir
Lightbox Kumaştan Çıkar

Mesh (Delikli) Brandaya Çevir
Mesh Brandadan Çıkar

Lightbox aydınlatmayı aç
Lightbox aydınlatmayı kapat
```

`wall_200` için görünmeyen özel komutlar:

```text
Boyutlandır…        → illuminated-foam
Raf altı aydınlatma → shelf
```

Kaynak:

- `src/moduleContextMenu.js`

---

## 19. Context picker / sağ-sol Item ekleme

`wall_200` için:

```text
allowSideInsert = true
```

Picker davranışı:

- `MODULE_CATALOG_KEYS` içindeki katalog Item'larını gösterir,
- yalnız wall ailesiyle sınırlı değildir,
- birden fazla Item seçilebilir,
- aynı Item birden fazla kez seçilebilir,
- seçim sırası drag ile değiştirilebilir,
- batch insertion validation yapılır,
- sağ insertion sırasında sıra placement akışına göre ters çevrilebilir.

Wall orientation görsel sağ/sol yönünü chain yönüne normalize edebilir.

Kaynaklar:

- `src/moduleContextMenu.js`
- `src/main.js`
- `src/wallReflow.js`

---

## 20. Çoğaltma

Duplicate işlemi state'i JSON clone olarak çoğaltır ve yeni kimlikler üretir.

Normalde korunur:

- panel renkleri,
- `imageAssetId`,
- `imageTransform`,
- glass state,
- diğer normal nested surface state alanları,
- placement/template state'in clone edilmiş hali.

Yenilenir:

- module `id`,
- strip/surface `id` değerleri.

### Lightbox / Mesh istisnası

Lightbox/Mesh ownership aynen clone edilmez.

Scene rebuild sırasında duplicate'ın eski `fabricGroupId` ile orijinal fiziksel kumaş grubuna yanlışlıkla katılması engellenir. Beklenmeyen clone yüzeylerinde fabric state temizlenir.

Bu nedenle:

```text
"duplicate tüm design state'i birebir korur"
```

ifadesi Lightbox/Mesh için doğru değildir.

Kaynaklar:

- `src/designState.js`
- `src/scene3d.js`

---

## 21. Silme

`Sil` komutu mevcuttur.

Silmeden önce confirmation gösterilir. Onay sonrası temel akış:

```text
currentModules.splice(...)
rebuildWall(...)
```

Mevcut fiziksel davranış:

- hedef module listeden çıkarılır,
- kalan duvar otomatik compact edilmez,
- global delete-reflow yoktur.

### Multi-module Lightbox/Mesh yan etkisi

Silinen `wall_200`, birden fazla modüle yayılan tek parça Lightbox/Mesh grubunun owner'larından biriyse rebuild sırasında eksik owner surface algılanır.

Bu durumda kalan owner yüzeylerdeki ilgili fabric group da dissolve edilir.

Yani fiziksel module silme yalnız hedef module'ü listeden çıkarır; fakat ilişkiye bağlı tek-parça fabric state kalan modüllerde de temizlenebilir.

Kaynaklar:

- `src/main.js`
- `src/scene3d.js`

---

## 22. Panel rengi

`wall_200` için:

```text
appearance.color = editable
```

Yedi panel ayrı renk state'i taşır.

Bir panele `applyColorOverride()` ile renk uygulandığında aynı paneldeki görsel state'i temizlenir:

```text
color = yeni renk
imageAssetId = null
imageTransform = default single transform
```

Diğer paneller etkilenmez.

UI tarafında renk yalnız native color picker ile değil, HEX / RGB / CMYK girişleriyle de uygulanabilir.

Kaynaklar:

- `src/designState.js`
- `src/colorEditorController.js`
- `src/main.js`

---

## 23. Panel görseli

`wall_200` için:

```text
appearance.image = editable
```

Panel state'i:

```text
imageAssetId
imageTransform
```

taşır.

Mevcut UI/scene işlemleri:

- görsel yükleme ve asset library,
- seçili panel/panel bloğuna görsel uygulama,
- `cover`,
- `contain`,
- görsel temizleme,
- rectangle image layout,
- fabric group üzerine görsel uygulama.

`scene3d` ayrıca horizontal image API'si export eder; mevcut ana UI akışı panel seçimlerinde `applyRectImageAsset()` kullanır.

Kaynaklar:

- `src/main.js`
- `src/scene3d.js`
- `src/imageFit.js`
- `src/horizontalImageLayout.js`
- `src/rectImageLayout.js`

---

## 24. Cam panel

Panel context menüsünden:

```text
Cam Panele Çevir
Normal Panele Çevir
```

kullanılabilir.

Görsel ve glass aynı panel state'inde birlikte bulunabilir; glass açmak görseli zorunlu olarak silmez.

Kaynak:

- `src/scene3d.js`
- `src/moduleContextMenu.js`

---

## 25. Lightbox kumaş

Lightbox için seçim:

- en az 2 panel,
- aynı fiziksel düzlem,
- geçerli tam rectangle block

olmalıdır.

Seçili blok üzerinde tek continuous overlay oluşturulur.

Fabric state şu alanları kullanabilir:

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

Lightbox davranışı:

- tek parça plane,
- normal durumda opak,
- lighting açılabilir/kapatılabilir,
- görsel varsa kumaş yüzeyinde kullanılabilir,
- lighting aktifken emissive görünüm uygulanır.

Kaynak:

- `src/scene3d.js`

---

## 26. Mesh / delikli branda

Mesh için de tam rectangle block gerekir ve tek continuous plane oluşturulur.

Aktif runtime material davranışı:

```text
transparent = true
opacity ≈ 0.48
depthWrite = false
emissive = kapalı
```

Mesh backing yüzeyleri gizlenir; deliklerden gerçek sahnenin görünmesi hedeflenir.

Kodda `createMeshBrandaAlphaMap()` isimli perforation mask üreten bir yardımcı fonksiyon bulunur; ancak mevcut aktif Mesh material yolunda `alphaMap` olarak bağlanmaz.

Dolayısıyla bugün çalışan renderer açısından:

```text
ayrı aktif perforation alpha-mask yok
```

Kaynak:

- `src/scene3d.js`

---

## 27. Cam / Lightbox / Mesh exclusivity

Bu üç cover mode bağımsız şekilde üst üste yığılmaz.

Mevcut kural:

```text
Cam açılırsa       → aktif Lightbox/Mesh kaldırılır
Lightbox açılırsa  → glass kaldırılır
Mesh açılırsa      → glass kaldırılır
```

Lightbox ve Mesh aynı fabric ownership sistemini kullanır; `fabricType` ile ayrılır.

Kaynak:

- `src/scene3d.js`

---

## 28. Multi-module Lightbox/Mesh hareket kilidi

Tek parça Lightbox veya Mesh birden fazla module yayılmışsa fabric ownership ilişkisi hareketi etkiler.

Runtime lock:

```text
aynı fabricGroupId içindeki moduleIds.size > 1
→ ilgili module move/rotation engellenebilir
```

Ama fabric yalnız tek `wall_200` içindeki birden fazla panelden oluşuyorsa bu multi-module kilidi oluşmaz.

Kaynak:

- `src/scene3d.js`

---

## 29. Wall-overlay taşıyıcılığı

`wall_200` behavior:

```text
supportsWallOverlayMount = true
```

TV ve illuminated-foam gibi wall-overlay Item'lar bu panel ailesine bağlanabilir.

Ek runtime davranışı:

- `wall_200` `wallId = free` durumundayken de scene hit-test'i onu destek paneli olarak kullanabilir,
- TV / illuminated-foam serbest panelin ön yüzüne bağlanabilir.

Overlay Item ayrı module/state'tir ve `wall_200` base recipe'sine otomatik dahil olmaz.

Kaynaklar:

- `src/moduleBehavior.js`
- `src/scene3d.js`

---

## 30. Collision

Mevcut behavior contract:

```text
collision = segment
collisionDepth = physical
connectionEndpoint = segment
endpointContact = standard
overlapWithTypes = []
```

`wall_200` placement validation içinde fiziksel duvar/panel segmenti olarak değerlendirilir.

Kaynaklar:

- `src/moduleBehavior.js`
- `src/modulePlacement.js`

---

## 31. Ghost / sürükleme önizlemesi

Kanonik ghost:

```text
kind = silhouette
renderer = module-silhouette
opacity = 0.38
```

Catalog drag ve module drag preview akışında silhouette sistemi kullanılır.

Kaynaklar:

- `src/moduleBehavior.js`
- `src/scene3d.js`

---

## 32. Proje save / load / autosave

`wall_200` nested state'i proje snapshot'ında `modules` içinde JSON clone olarak saklanır.

Snapshot temel yapısı:

```text
id
name
version
createdAt
stand
modules
```

`wall_200` için persistence kapsamında şunlar korunabilir:

- placement,
- panel renkleri,
- image asset referansları,
- image transform,
- glass/fabric state,
- fabric ownership state,
- runtime'da state'e yazılmış diğer persistent alanlar.

Proje açılırken module state'leri yeniden katalog resolver'ından geçirilir. Böylece descriptor'dan `catalogKey = wall_200` tekrar çözülebilir.

Asset URL'leri scene rebuild'den önce yüklenir.

Autosave signature `stand` ve bütün `modules` state'ini içerir.

Kaynak:

- `src/main.js`
- `src/projectStore.js`

---

## 33. ZIP export / import

Export paketi:

```text
project.json
assets/*
```

şeklindedir.

Normal panel görsel referansları import sırasında yeni asset ID'lerine remap edilir.

### Mevcut açık nokta

`remapAssetIdsInValue()` bugün yalnız şu key'i özel olarak remap eder:

```text
imageAssetId
```

Buna karşılık gerçek asset-reference sistemi şu iki alanı da asset referansı sayar:

```text
imageAssetId
fabricImageAssetId
```

Dolayısıyla Lightbox/Mesh üzerindeki `fabricImageAssetId`, normal panel `imageAssetId` ile aynı import remap yolundan geçmez.

Bu current runtime/persistence uyumsuzluğudur ve Item persistence contract'ında ayrıca ele alınmalıdır.

Kaynaklar:

- `src/main.js`
- `src/imageAssetReferences.js`

---

## 34. Görsel asset silme

Asset library'den kullanılan bir görsel silinirse sistem:

- scene üzerindeki görsel referansını temizler,
- `currentModules` ve `currentStand` içindeki asset referanslarını temizler,
- kayıtlı projede önce state'i persist edebilir,
- ardından asset blob'unu storage'dan kaldırır.

Reference walker hem:

```text
imageAssetId
fabricImageAssetId
```

alanlarını destekler.

Kaynaklar:

- `src/main.js`
- `src/imageAssetReferences.js`
- `src/assetStore.js`

---

## 35. “Tüm Özellikleri Kaldır” davranışı

Bu işlem mevcut `wall_200` state'ini alan alan temizlemek yerine factory üzerinden yeni default state üretir.

`wall_200` için sonuç:

```text
yeni module id
yeni surface id'leri
default beyaz paneller
image yok
glass yok
Lightbox/Mesh yok
placement korunur
```

Yani identity instance seviyesi yenilenir; fiziksel placement/dizilim korunur.

Illuminated-foam bu reset akışında ayrıca sahneden kaldırılır; normal `wall_200` yeniden üretilir.

Kaynak:

- `src/main.js`
- `src/designState.js`

---

## 36. “Sahneyi Sıfırla” davranışı

`Sahneyi Sıfırla`, “Tüm Özellikleri Kaldır” ile aynı işlem değildir.

Bu akış mevcut stand setup'ını tekrar okuyup sahneyi baştan oluşturur:

```text
currentModules = []
→ stage yeniden oluştur
→ automatic wall yeniden oluştur
→ varsa automatic depot yeniden oluştur
→ wall rebuild
```

Dolayısıyla otomatik üretilmiş `wall_200` instance'ları yeni ID'lerle tekrar oluşabilir.

Kaynak:

- `src/main.js`

---

## 37. BOM — normal straight wall_200 recipe

`wall_200` kanonik recipe:

```text
recipeId = wall-straight-200
moduleType = wall
nominalWidthCm = 200
connectionMode = straight
```

Normal recipe items:

| Alt kalem | Miktar |
|---|---:|
| `profile_190` | 2 |
| `upright_346_5` | 2 |
| `panel_197` | 7 |
| `connector_start` | 2 |
| `connector_single` | 13 |

Production part değerleri:

| Part | Temel tanım |
|---|---|
| `profile_190` | 190 cm profil |
| `upright_346_5` | 346,5 cm dikme |
| `panel_197` | 197 × 47 × 0,8 cm panel |
| `panel_corner_192` | 192 × 47 × 0,8 cm iç köşe paneli |

Kaynaklar:

- `src/moduleRecipes.js`
- `src/items.js`

---

## 38. Inner-corner panel varyantı

`wall_200` recipe metadata'sında:

```text
variants.innerCornerPanelPartId = panel_corner_192
```

vardır.

Ancak `panel_corner_192` normal `recipe.items` listesinde yer almaz.

Bu nedenle yalnız metadata'nın mevcut olması şu anlama gelmez:

```text
runtime Raw BOM gerçek placement ilişkisini okuyup panel_197'yi otomatik panel_corner_192 ile değiştiriyor
```

Bu dönüşüm bugün kanonik project Final BOM seviyesinde tamamlanmış değildir.

Kaynak:

- `src/moduleRecipes.js`

---

## 39. Raw BOM debug

Sistemde `Üretim Listesi · Debug` paneli vardır.

Düz 200 cm wall selection için mevcut recipe şu şekilde çözülür:

```js
getExpandedModuleRecipe('wall', 200)
```

`expandRecipe()` yalnız `recipe.items` satırlarını production part registry ile genişletir.

Dolayısıyla Raw BOM:

- normal straight recipe items'ı gösterir,
- placement graph'ından gerçek köşe ilişkisi türetmez,
- `innerCornerPanelPartId` metadata'sını otomatik replacement'a çevirmek zorunda değildir,
- kanonik project-level Final BOM değildir.

Kaynaklar:

- `src/rawBomDebug.js`
- `src/moduleRecipes.js`

---

## 40. Connector relationship BOM durumu

Production registry'de şu connector Item/part kayıtları vardır:

```text
connector_start
connector_single
connector_double
connector_corner
```

Normal `wall_200` straight recipe'sinde ise yalnız:

```text
connector_start
connector_single
```

vardır.

Gerçek project placement/köşe ilişkisini okuyup:

```text
connector_single
connector_double
connector_corner
```

adetlerini kanonik Final BOM'a dönüştüren tam project-level ilişki resolver'ı henüz yoktur.

Kaynaklar:

- `src/items.js`
- `src/moduleRecipes.js`
- `audit/FINDINGS.md`

---

## 41. Mevcut yetenek özeti

| İşlem | Durum |
|---|---|
| Back duvara yerleştir | ✅ |
| Sol duvara yerleştir | ✅ |
| Sağ duvara yerleştir | ✅ |
| Free placement | ✅ |
| Taşı | ✅ |
| 50 cm move snap | ✅ |
| 90° döndür | ✅ |
| Shift+R rotation | ✅ |
| Yön tuşuyla hareket | ✅ |
| Continuous wall reflow | ✅ |
| Free side insertion | ✅ |
| Magnetic module snap | ✅ |
| Yanına Item/modül ekle | ✅ |
| Picker'dan çoklu Item ekle | ✅ |
| Sağ tarafa çoğalt | ✅ |
| Sol tarafa çoğalt | ✅ |
| Sil | ✅ |
| Delete sonrası global compact | ❌ |
| Otomatik stand duvarında oluşma | ✅ |
| Otomatik depo duvarında oluşma | ✅ |
| Panel tek tek seç | ✅ |
| Çoklu panel range seç | ✅ |
| Tam rectangle selection | ✅ |
| Connected free-panel path | ✅ |
| Panel rengini değiştir | ✅ |
| HEX/RGB/CMYK renk uygula | ✅ |
| Panel görseli ekle | ✅ |
| Görsel cover/contain | ✅ |
| Görsel temizle | ✅ |
| Cam panele çevir | ✅ |
| Lightbox kumaş oluştur | ✅ |
| Lightbox aydınlat | ✅ |
| Mesh branda oluştur | ✅ |
| Aktif perforation alpha-mask | ❌ |
| Multi-module fabric move/rotation lock | ✅ |
| Free wall overlay host | ✅ |
| TV/foam wall-overlay taşı | ✅ |
| Boyutlandır context komutu | ❌ |
| Raf altı ışığı | ❌ |
| Context menüden rotate butonu | ❌ |
| Save/load project state | ✅ |
| Autosave state takibi | ✅ |
| ZIP export/import | ✅ |
| `fabricImageAssetId` import remap | ❌ |
| “Tüm Özellikleri Kaldır” reset | ✅ |
| Raw BOM recipe | ✅ |
| Köşe panel varyant metadata'sı | ✅ |
| Relationship'tan otomatik tam connector BOM | ❌ |
| Kanonik project Final BOM | ❌ |

---

## 42. Item mimarisi açısından toplu görünüm

```text
wall_200
│
├── IDENTITY
│   ├── runtime catalogKey: wall_200
│   ├── contract itemKey: wall_200
│   └── type: flat-panel
│
├── STATE
│   ├── instance id
│   ├── widthCm: 200
│   ├── placement
│   └── 7 editable panel state
│
├── PLACEMENT
│   ├── back / left / right
│   ├── free
│   ├── continuous wall reflow
│   └── free side insertion
│
├── BEHAVIOR
│   ├── 50 cm move snap
│   ├── 90° rotation
│   ├── collision
│   ├── magnetic snap
│   ├── side insertion
│   └── overlay host
│
├── INTERACTION
│   ├── select
│   ├── range / rectangle select
│   ├── delete
│   ├── duplicate
│   ├── add left/right
│   └── context menu
│
├── APPEARANCE
│   ├── color
│   ├── image
│   ├── glass
│   ├── lightbox
│   └── mesh
│
├── PERSISTENCE
│   ├── project state
│   ├── autosave
│   ├── ZIP export/import
│   └── asset references
│
├── BOM
│   ├── straight base recipe
│   ├── terminal production parts
│   └── corner panel variant metadata
│
└── PROJECT RELATIONSHIPS
    ├── neighboring Items
    ├── wall/corner state
    ├── overlay Items
    ├── fabric ownership
    └── relationship-derived Final BOM  ← henüz eksik
```

---

## 43. Açık mimari bulgular

`wall_200` Item mimarisine taşınırken mevcut audit bulgularından özellikle şunlar etkilidir:

```text
F-017 — Renderer directly mutates persistent editable state.
F-018 — Structural strip/panel count duplicated between catalog and state factories.
F-019 — Catalog/runtime dimensions duplicated/hard-coded in state factories.
F-030 — No canonical project-level Final BOM generator.
F-031 — Relationship/corner connector parts not derived from project relationships.
```

Bu runtime taramasında ayrıca persistence tarafında şu uyumsuzluk açıkça görülür:

```text
ZIP import asset remap:
imageAssetId        → remap edilir
fabricImageAssetId  → aynı özel remap yoluna dahil değildir
```

Bu belge `wall_200` için mevcut sistemi tanımlar; yeni Item contract implementasyonu yapılırken bu davranışların hangilerinin korunacağı ve hangilerinin kanonik hale getirileceği ayrıca kararlaştırılmalıdır.
