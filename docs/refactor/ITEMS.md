# Item

Fair Stand yeni Item modelinin yaşayan canonical sözleşmesi. Audit dökümü değildir.

Stand zarfı Item değildir: `docs/refactor/STAND_DIMENSIONS.md`.
Catalog: `docs/refactor/CATALOG.md`.
Rotation: `docs/refactor/ROTATION.md`.
Admin 3D önizleme + assembly pose + kalıcı kilit: `docs/refactor/ITEM_3D_PREVIEW.md`.
PostgreSQL tabloları: `docs/refactor/DATABASE.md`.
CRM kullanım: `docs/refactor/FAIR_STAND_DB_KULLANIM_KILAVUZU.md` (§4.1b Kopyala, §4.6 montaj kilidi, §5.16b `assembly_parts`).

Item **Kopyala** (admin): shallow — yeni `item_key`/`name`; BOM/assembly/body/video child key’ler paylaşılır; asset `relative_path` paylaşılır; `catalog_item_index` = kategori son + 1. API `POST .../item-records/{sourceKey}/clone`.

---

## Runtime field kuyruğu (şemaya henüz alınmadı)

Karar verilmiş / ertelenmiş maddeler: `docs/refactor/PENDING_ITEM_DECISIONS.md` (§ B Item, § D kuyruk özeti, § A tavan–şerit sırası).

`listRegisteredItems()` 96 satırında duran alanlar. Bu tablo **onaylı şema değildir**. Zamanla, her alan ayrı kararla aşağıdaki “Zorunlu / opsiyonel / Catalog” bölümlerine alınır veya PENDING’de kapatılır.

Kaynak: `src/items.js` taraması (2026-09-17). N = kaç Item’da path var.

Kimlik `getItem(itemKey)` ile okunur. Her field her mekanizmada işlenmez. Placement/collision/moveSnap → tip kaydı `getItemType(type)` (`fair_stand_item_type`); rotation Item; recipe BOM yalnız `composition.items`. Tip vs snap: `FAIR_STAND_DB_KULLANIM_KILAVUZU.md`.

| Field | N | Src’de ne işe yarıyor |
|---|---|---|
| `itemKey` | 96 | Ürün kimliği. `getItem` / `resolveItemKey`. **Şemada onaylı.** |
| `name` | 96 | İnsan adı. Catalog `label`, seçim metni, zemin select. |
| `type` | 96 | Factory + `getItemType` (DB tip davranışı), recipe lookup, `resolveItemKey` adayı. Catalog kart tipi değil. |
| `catalogVisible` | 96 | Katalogda görünsün mü. **Şemada onaylı.** |
| `categoryId` | 96 | Katalog grubu integer id veya `null`. **Şemada onaylı.** |
| `catalogItemIndex` | 96 | Grup içi sıra veya `null`. **Şemada onaylı.** |
| `previewId` | 58 | Kart silüet key. Yalnız görünür Item. **Şemada onaylı.** |
| `unit` | 46 | BOM satır birimi. Recipe’siz Item’da `itemBom` zorunlu sayar. 50 Item’da yok. |
| `dimensions` | 90 | Fiziksel ölçü. 6 Item’da yok (4 connector, `shelf_leg`, `hali`). **Şemada onaylı (opsiyonel).** |
| `dimensions.widthCm` | 71 | Kutu **W** (duvar boyunca). Recipe parent genişliği. |
| `dimensions.depthCm` | 52 | Kutu **D** (içeri). |
| `dimensions.heightCm` | 42 | Kutu **H** (dikey). |
| `dimensions.mountHeightCm` | 1 | `led_floodlight` montaj yüksekliği 350. |
| `dimensions.wallGapCm` | 1 | `illuminated-foam` duvar boşluğu. |
| `sceneDimensions` | 32 | Aynı field adıyla sahne override. **Şemada onaylı (opsiyonel).** |
| `sceneDimensions.widthCm` | 10 | Effective scene width. |
| `sceneDimensions.depthCm` | 24 | Effective scene depth. |
| `sceneDimensions.heightCm` | 24 | Effective scene height. |
| `defaultColor` | 30 | Varsayılan renk (integer hex; DB `default_color`). Zemin de aynı, string değil. |
| `material` | 34 | Üretim malzemesi metni. Vitrin gövde `sunta` kilidi. |
| `composition` | 30 | Bileşik yapı. |
| `composition.mode` | 28 | `recipe` → `resolveItemBom`. |
| `composition.items` | 30 | Çocuk listesi `{itemKey, quantity}`. 28 recipe parent + 2 mobilya kümesi. Recipe tablosu kopyası değil; tek kaynak Item. |
| `assembly.parts` | 0+ | Admin montaj pose + optional `lockGroupId`. BOM değil. **Şemada onaylı** (`fair_stand_item_assembly_parts`). |
| `shape` | 3 | Kök `'L'` (köşe banko). |
| `variant` | 8 | `wall-short-1` / `wall-short-2`. |
| `stripOccupancy.align` | 8 | wall-short `'top'`. |
| `stripOccupancy.stripCount` | 8 | 1 veya 2 şerit. |
| `modelFile` | 9 | GLB adı. |
| `modelRotationYDeg` | 5 | Model Y dönüşü. |
| `preserveModelScale` | 5 | GLB ölçek ezilmesin mi. |
| `visualRotationYDeg` | 3 | Çöp/koltuk görsel Y. |
| `eyeCount` | 2 | Vitrin 2/3 göz. |
| `bodyItems.sideItemKey` | 2 | Vitrin yan sunta. |
| `bodyItems.horizontalItemKey` | 2 | Vitrin yatay sunta. |
| `bodyItems.glassShelfItemKey` | 2 | Cam raf Item. |
| `videoWall.rows` / `videoWall.cols` | 2 | Video wall ızgara. |
| `videoWall.panelItemKey` | 2 | `VIDEO_WALL_PANEL`. |
| `paintable` | 5 | Zemin boyanır mı. |
| `rotationStepDeg` | 61 | Shift+R adımı. Leaf’te yok. **Şemada onaylı (opsiyonel / nullable).** |
| `defaultRotationDeg` | 61 | İlk sahne Z. Leaf’te yok. **Şemada onaylı (opsiyonel / nullable).** |
| `sideInsertRotation` | 61 | `inherit` / `default`. Leaf’te yok. **Şemada onaylı (opsiyonel / nullable).** |

Aşağıdaki bölümler yalnız **karar verilmiş** şemadır. Kuyruktaki bir alan ancak ayrı refactor adımında kabul edilirse oraya geçer.

Ayrıntılı mekanizma sözleşmeleri ayrı dosyadadır. ITEMS.md o dosyaları kopyalamaz; Item config’in hangi mekanizmaya bağlandığını gösterir.

| Belge | Rol |
|---|---|
| `docs/refactor/REFACTOR.md` | Kronolojik değişiklik günlüğü |
| `docs/refactor/ITEMS.md` | Item modelinin güncel canonical sözleşmesi |
| `docs/refactor/CATALOG.md` | Catalog mekanizmasının ayrıntılı sözleşmesi |
| `docs/refactor/ROTATION.md` | Sahne Z dönüş Item parametreleri |
| `docs/refactor/SCENE_POSE.md` | Gövde, kot Z, profil snap (hedef sözleşme) |
| `docs/refactor/STAND_DIMENSIONS.md` | Stand zarfı |

İleride `ROTATION.md`, `COLOR.md`, `IMAGE.md`, `LIGHTING.md`, `DELETE.md` vb. eklendiğinde bu belge yalnız bağlantı satırını tutar.

---

## Item nedir?

BOM, üretim veya maliyet hesabına girebilen her fiziksel ürün/parça bir **Item**’dır.

Tekil kimlik `itemKey`’dir. Label, GLB dosya adı, renderer node adı veya katalog grubu ürün kimliği değildir. `itemKey` / DB `item_key` **her zaman lowercase** (`snake_case` veya mevcut kebab örneği); uppercase SKU yok.

Item, davranış algoritmasını içermez. Item, canonical mechanism’in okuduğu master veriyi ve config parametrelerini taşır.

Item master Catalog’dan bağımsızdır. Bir Item’ın `getItem(itemKey)` ile var olması katalogda görünmesi değildir. `catalogVisible=false` Item’ı AutoDepot, Module Contract, BOM, renderer veya placement’tan kaldırmaz.

---

## Kayıt

Item satırları PostgreSQL `fair_stand` Item store'undadır. `src/catalogBootstrap.js` katalog yükünü alıp `initializeItemRegistry(items)` (`src/items.js`) ile tek kayıt tablosuna yazar. Lookup `getItem(itemKey)` = kayıt tablosu, yoksa duvar yüksekliği türevleri (`buildWallHeightVariants`), yoksa `null`. `listRegisteredItems()` kayıt tablosunun değerleridir. Bootstrap yapılmadan okuma hata verir. Kova map (`LEAF_ITEMS` vb.) yoktur.

---

## Zorunlu temel alanlar

Yeni mimaride şu ana kadar onaylanan zorunlu alanlar:

| Alan | Tip | Kapsam |
|---|---|---|
| `itemKey` | string | Item master — kanonik ürün kimliği |
| `catalogVisible` | boolean | Item master — Catalog config |
| `categoryId` | integer \| null | Item master — Catalog config |
| `catalogItemIndex` | integer \| null | Item master — Catalog config |
| `isRender` | boolean | Item master — bu SKU’nun kendi sahne gövdesi var mı |
| `acceptsColor` | boolean | Item master — renklenebilir mi |
| `acceptsImage` | boolean | Item master — yüzey görseli atanır mı |
| `acceptsLightbox` | boolean | Item master — lightbox / ışıklı kumaş |
| `acceptsGlass` | boolean | Item master — cama çevrilebilir mi |
| `acceptsMesh` | boolean | Item master — delikli branda / mesh kumaş |
| `defaultZCm` | number | Item master — drop `placement.zCm` (yerden kot) |

`itemKey` her Item’da dolu string’dir. Üç katalog alanı her Item’da **alan olarak** zorunludur; görünmeyen Item’da category/index değeri `null` olur. `isRender` ve yüzey yetenekleri her Item’da açık `true`/`false`; `null` yok. `isRender=false` ise beş yüzey bayrağı da `false`. `defaultZCm` her Item’da sayı (yerden cm); yoksa 0.

Görünür Item (`catalogVisible=true`) ek zorunlu Catalog alanı: `previewId`. Gizli Item’da bu alan yoktur.

---

## Opsiyonel alanlar

| Alan | Tip | Kapsam |
|---|---|---|
| `dimensions` | object | Item master — fiziksel ürün ölçüleri |
| `sceneDimensions` | object \| yok | Item master — aynı field setinin runtime override katmanı |
| `rotationStepDeg` | number \| yok | Item master — sahne Z adımı; `ROTATION.md` |
| `defaultRotationDeg` | number \| yok | Item master — ilk Z; `ROTATION.md` |
| `sideInsertRotation` | `inherit` \| `default` \| yok | Item master — yana ek; `ROTATION.md` |

`dimensions` Item’ın gerçek/fiziksel ölçülerini taşır. `sceneDimensions` sahne/runtime’da farklı bir değer gerekiyorsa aynı field adıyla override yazar. Canonical kutu alanları: `widthCm`, `depthCm`, `heightCm` (+ isteğe bağlı `mountHeightCm`, `wallGapCm`). Legacy `lengthCm` / `thicknessCm` kaldırıldı (DB migration `0021`; detay `ITEM_DIMENSIONS.md`). Effective scene field: `sceneDimensions.field ?? dimensions.field ?? MISSING`. Aynı field adı yoksa fallback yoktur.

Duvar otomasyonu Item `dimensions` değildir: kenar kapasitesi `edgeWidthCm`, istenen zincir genişliği `wallWidthCm`, modül yerleşimi `widthCm` — `src/wallReflow.js`, `src/wall.js`, `src/automaticWall.js`.

Eski kayıtlardaki `name`, `type`, `unit`, `composition` vb. runtime’da durur; bu şemaya otomatik alınmadı.

---

## Config blokları

Yeni mimaride onaylı tek config bloğu **Catalog Configuration**’dır.

---

## Catalog Configuration

Ayrıntı: `docs/refactor/CATALOG.md`.

| Field | Amaç |
|---|---|
| `catalogVisible` | Catalog UI’da görünürlük |
| `categoryId` | kategori id |
| `catalogItemIndex` | kategori içi sıra |
| `previewId` | Catalog kart preview renderer key |

Catalog görünümü `Item.type` üzerinden belirlenmez. Catalog preview renderer seçimi yalnız `Item.previewId` üzerinden yapılır.

### catalogVisible

- **Type:** boolean
- **Required:** yes
- **Scope:** Item master
- **Default:** yok; her Item açık değer taşır
- **Amaç:** Item’ın Modül Kataloğu’nda gösterilip gösterilmeyeceğini belirler
- **Canonical consumer:** Catalog mechanism
- **Canonical method:** `listCatalogItems()` / `listCatalogGroups()` — mevcut
- **Method parametresi:** üyelik filtresi (`true` görünür)
- **Runtime behavior üretmez**
- **Başka mekanizmada varlık/kullanılabilirlik üretmez**
- **Kullanıcı değiştirir mi:** hayır
- **Project instance override:** hayır
- **Persistence:** Item master (bugün `src/items.js`); proje blob’una yazılmaz
- **Validation:** `true` veya `false`; `null` yasak
- **Örnek:** `wall_200` → `true`; `panel_197` → `false`

### isRender

- **Type:** boolean
- **Required:** yes
- **Scope:** Item master (`fair_stand_items`; kolon örn. `is_render`)
- **Default:** yok; her Item açık değer taşır
- **Amaç (kilit, 2026-09-25):** `isRender=true` ise sistem bu SKU’yu **çizer**. Katalog / sürükle-bırak bu karara girmez.
- **`true`:** Mesh ve yüzey özellikleri (`default_color`, ölçü, `accepts_*`) bu satırdan. Tek başına modül (`wall_200`) veya parent içinde child (tabla, panel) fark etmez.
- **`false`:** Mesh yok. Reçetede kullanılmayanlar (`floor`, `shelf_leg`) burada kalır. Aile adı yasak değildir; kullanılan parça false bırakılmaz.
- **`catalogVisible`:** yalnız sürükle-bırak kartı. Çizim kuralının parçası değil.
- **Bugün kod:** Factory `isRender` kapısına bakar, kataloga bakmaz. Reçeteli modül (duvar, baza, banko, kapı, separator, vitrin) gömülü `isRender` parçanın `itemKey`, `default_color`, `accepts_*` ve sahne ölçüsünü (`widthCm` / `heightCm` / `depthCm`) yüzeye yazar; kutu o santimi kullanır. Gömülü tipler: `panel`, `separator-panel`, `base-top`, `counter-top`, `connector`, `showcase-board`, `showcase-accessory`, `video-wall-panel`. Profil ve dikme kendi modülüdür. `connector_*` `isRender=true` ama kendi yerleşim tipi olmadığı için tek başına modül olmaz; parent içinde parça kaydıdır. Zemin ve `shelf_leg` reçetede kullanılmadığı için `false` kalır.
- **Yasak:** Çizimi katalog kartına bağlamak; `isRender=true` child’ı parent’ın atlaması; bir aile adını kalıcı “çizilmez” saymak.
- **Canonical consumer:** sahne (hedef: `isRender` mesh, parent içinde de); factory bugün yerleşim tipi olan SKU.
- **Kullanıcı değiştirir mi:** hayır (admin master)
- **Project instance override:** hayır
- **Validation:** `true` veya `false`; `null` yasak
- **Kod:** `itemHasSceneRender` / `createModuleStateFromDescriptor` — `isRender !== true` ise modül state yok. `catalogVisible` bu kapıyı etkilemez.

### defaultZCm

- **Type:** number (cm)
- **Required:** yes (`0` geçerli)
- **Scope:** Item master (`fair_stand_items.default_z_cm`)
- **Default:** `0`; seed `dimensions.mount_height_cm` varsa onu kopyalar (`led_floodlight` 350). Profil ray: `342` (gövde 8, üst kenar 350). Short-up-2: `250` (gövde 100). `KETTLE`: `66` (buzdolabı üst kotu; renderer type istisnası yok).
- **Amaç:** Katalog drop’ta instance `placement.zCm`. Gövde boyu değil; yerden kot
- **`true` örnek:** floodlight 350. Profil 342 (ray gövdesi 8 cm). Tam boy duvar 0. Kettle 66.
- Stand tavanı (`STAND_DIMENSIONS.height`) bu alanı ezmez
- Instance override: kullanıcı Z−/Z+ / overlay sürükleme `placement.zCm` yazar; yeni drop yine master default
- **Canonical consumer:** `applyItemPlacementZCm` / `resolveItemDefaultZCm` — her item drop; overlay mouse ve instance Z ezer
- **Kullanıcı değiştirir mi:** hayır (admin master)
- **Project instance override:** evet (`placement.zCm`)
- **Validation:** sonlu sayı; `null` yok
- **Kod:** adım 4. Snap hedefi adım 5.

### type / itemTypeIds / snapRequiresRuleId / snapProvidesRuleId

- **Type:** `type` = `fair_stand_item_type.key` FK; kuralda `itemTypeIds` M:N
- **Required:** no (requires **veya** provides; ikisi birden yok)
- **Scope:** Item → `fair_stand_item_type` / `fair_stand_rule` (rule_type bugün `snap`)
- **Amaç:** Tip seçimi + kural seçimi; motor **rule id** eşler. Face/edge yalnız `rules[]` kaydında (item’da yok)
- **Kimlik:** Katalog satırlarında alan adı `key` (Kod değil); ad’dan slug, elle düzeltilebilir
- **Örnek:** `led_floodlight` → requires `top-rail` (top/top). `profile_190` → provides `top-rail`. Raf → requires `shelf-rail` (front/top)
- **Canonical consumer:** `getItemSnapSpec` / `snapPlacementToItemAnchor` / `usesPanelSeamOverlaySnap`
- Type→kural JS map yok; seed bir kerelik DATA bağlar
- Yeni item type CRM’de eklenince (aktif) kural formundaki tip listesine gelir

### Yüzey yetenekleri (`accepts*`)

Hepsi boolean, zorunlu, `null` yasak. Item satırı; `item_type` map’i değil. `src/itemCapabilities.js` `item.acceptsColor` / `acceptsImage` / `acceptsGlass` / `acceptsLightbox` / `acceptsMesh` okur.

| Alan | DB kolon (örn.) | Soru |
|---|---|---|
| `acceptsColor` | `accepts_color` | Renk atanır mı? |
| `acceptsImage` | `accepts_image` | Resim / yüzey görseli atanır mı? |
| `acceptsLightbox` | `accepts_lightbox` | Lightbox (ışıklı kumaş) atanır mı? |
| `acceptsGlass` | `accepts_glass` | Cama çevrilebilir mi? |
| `acceptsMesh` | `accepts_mesh` | Delikli branda (mesh) çevrilebilir mi? |

- `isRender=false` (sanal/BOM) → beşinin `false` (connector). Sahne UI’si yok.
- `isRender=true` → her bayrak bağımsız. Örn. profil renk var resim yok; duvar paneli beşine açık olabilir; asılı lightbox kutusu renk+görsel, cam yok.
- Katalog kartı (`catalogVisible`) bunlardan bağımsız.
- Instance: kullanıcı sahnede renk/görsel/cam **seçer**; yetki master’da. Master `false` ise o araç görünmez.
- Motor camı `TYPE_BEHAVIORS` ile açmaz; item `acceptsGlass` kolonunu okur.
- **Kod:** kolon + bootstrap + sahne menü/`apply*` item `accepts*` okur. Ctrl çoklu seçim hâlâ `selectionMode === 'panel'`.

### categoryId

- **Type:** integer \| null
- **Required:** yes (alan zorunlu; görünmeyende değer `null`)
- **Scope:** Item master
- **Default:** yok
- **Amaç:** `catalogVisible=true` Item’ın hangi katalog grubunda duracağını belirler. Değer `Catalog.id` ile eşleşir; UI label saklamaz
- **Canonical consumer:** Catalog mechanism
- **Canonical method:** `listCatalogGroups()` — mevcut
- **Method parametresi:** `categoryId`
- **Davranış / type belirlemez**
- **Kullanıcı değiştirir mi:** hayır
- **Project instance override:** hayır
- **Persistence:** Item master
- **Validation:** görünürken canonical integer id; gizliyken `null`
- **Örnek:** `wall_200` → `1`; `panel_197` → `null`

### catalogItemIndex

- **Type:** integer \| null
- **Required:** yes (alan zorunlu; görünmeyende değer `null`)
- **Scope:** Item master
- **Default:** yok
- **Amaç:** Item’ın kendi katalog kategorisi içindeki 1 tabanlı sırasını belirler
- **Canonical consumer:** Catalog mechanism
- **Canonical method:** `listCatalogGroups()` — mevcut
- **Method parametresi:** kategori içi sıra
- **Kullanıcı değiştirir mi:** hayır
- **Project instance override:** hayır
- **Persistence:** Item master
- **Validation:** görünürken `1..N` kesintisiz, kategoride unique; gizliyken `null`
- **Örnek:** `wall_200` → `1`; `panel_197` → `null`

### previewId

- **Type:** integer
- **Required:** `catalogVisible=true` Item’da yes; gizli Item’da alan yok
- **Scope:** Item master — Catalog config
- **Default:** yok; type fallback yoktur
- **Amaç:** Catalog kart preview tanımı. DB-generated integer id; markup/CSS bootstrap `previewKinds` kaydından gelir
- **Canonical consumer:** Catalog UI (`getCatalogPreview` → generic renderer)
- **Canonical method:** `getCatalogItem` / `listCatalogItems` projection → `createModuleCatalogPreview`
- **Catalog görünümü `Item.type` üzerinden belirlenmez**
- **Catalog preview renderer seçimi yalnız `Item.previewId` üzerinden yapılır**
- **Kullanıcı değiştirir mi:** hayır
- **Project instance override:** hayır
- **Persistence:** Item master
- **Validation:** görünürken bootstrap preview id listesi üyesi; yok/bilinmiyor → fail-fast; gizlide alan yok
- **Örnek:** `KETTLE` → `13`; `TV_42` → `26`; `VIDEO_WALL_2X2` → `28`; `wall_200` → `9`; `profile_190` → `17`

### dimensions

- **Type:** object — kutu `widthCm` / `heightCm` / `depthCm` + isteğe bağlı `mountHeightCm` / `wallGapCm`
- **DB:** `fair_stand_item_dimensions` — kolon yerleşimi: **`docs/refactor/ITEM_DIMENSIONS.md`**
- **Required:** no — güvenilir fiziksel kaynak yoksa alan yazılmaz
- **Scope:** Item master — gerçek/fiziksel ürün ölçüleri
- **Default:** yok; tahmin/`0`/`1`/GLB bbox yasak
- **Amaç:** Ön görünüş kutusu (W duvar boyunca, H dikey, D içeri)
- **Canonical consumer:** `resolveSceneDimensions` (same-field fallback), BOM, factory
- **Canonical method:** `item.dimensions` / `resolveSceneDimensions(item)`
- **Migration:** `0020_item_dims_wh_d_fill` (legacy BOM → W/H/D); `0021_drop_item_length_thickness` (`length_cm` / `thickness_cm` silindi)
- **Kullanıcı değiştirir mi:** hayır (Item master)
- **Project instance override:** hayır; sahne ezmesi `sceneDimensions`’tadır
- **Örnek:** `panel_197` → `{ widthCm: 197, heightCm: 47, depthCm: 0.8 }`; `profile_190` → `{ widthCm: 190, heightCm: 8, depthCm: 8 }`

### sceneDimensions

- **Type:** object — DB/API’de yalnız `widthCm?`, `depthCm?`, `heightCm?` (`fair_stand_item_scene_dimensions`).
- **Required:** no — physical ile aynı field aynı değerdeyse yazılmaz
- **Scope:** Item master — scene/runtime override
- **Default:** yok; `null`, `{}` ve `{ field: null }` override yok demektir
- **Amaç:** Sahnede kullanılacak ölçü. Yalnız physical’dan farklıysa veya scene’in ihtiyaç duyduğu field physical’da aynı isimle yoksa yazılır
- **Canonical consumer:** factory, identity, collision/ghost, Catalog preview hydrate
- **Canonical method:** `resolveSceneDimensions(item)`
- Effective field: `sceneDimensions.field ?? dimensions.field ?? MISSING`
- **Assembly prod:** kayıtlı `assembly.parts` varsa birleşim AABB, effective W/D/H kutusuna non-uniform scale edilir (`computeAssemblySceneFitTransform`). Pivot procedural baza / `applyPlacementToGroup` ile aynı: W/D merkez, H taban 0. MISSING eksen scale edilmez; üçü de MISSING → 1:1 pose (uydurma kutu yok).
- **box-block:** serbest zemin kutu (`box_block` SKU, Panel Ek Modül). Tip davranışı + `rotationStepDeg` / `defaultRotationDeg` / `defaultZCm` / `defaultOpacity` item master (DB). Yüzey bayrakları `acceptsColor`, `acceptsImage`, `acceptsLightbox`, `acceptsMesh` açık; `acceptsGlass` kapalı. Gövde renk ve saydamlığı taşır ve yanmaz. `faces.front/right/back/left` ayrı yüzeydir: görsel, Lightbox ve Mesh o yüze gider; Lightbox ışığı yalnız o yüzde yanar. Sağ tık “Görseli ölçülendir” panel görseli ile Lightbox/Mesh görselinde aynıdır: başlangıç alanın kendi cm ölçüsü, küçültünce tekrar, büyütünce taşma. Ok ile `placement.zCm` tabanı 0 ile tavan eksi kutu yüksekliği arasında yürür. Instance W/D/H/opacity yerleştirme ve “Ölçü / opacity” ile ezilir. `illuminated-foam` (SVG wall-overlay) değil.
- **Recipe/Catalog/type/itemKey/STAND Item-specific scene source değildir**
- **Kullanıcı değiştirir mi:** hayır (Item master)
- **Persistence:** Item master
- **Örnek:** `profile_190` → `{ widthCm: 200, depthCm: 8, heightCm: 8 }` (ray gövdesi; kot `defaultZCm`)

---

## Canonical Mechanism Connections

Item config → canonical mechanism. Gerçekleşmemiş method “var” yazılmaz.

| Item config | Canonical mechanism | Canonical method | Durum |
|---|---|---|---|
| `catalogVisible` / `categoryId` / `catalogItemIndex` | Catalog | `listCatalogCategories` / `listCatalogItems` / `getCatalogItem` / `listCatalogGroups` | mevcut |
| `previewId` | Catalog | `getCatalogItem` / `listCatalogItems` → `getCatalogPreview` / `createModuleCatalogPreview` | mevcut |
| `dimensions` / `sceneDimensions` | Item ölçü | `resolveSceneDimensions` | mevcut |
| `itemKey` | Item identity | `getItem` / `listRegisteredItems` / `resolveItemKey` | mevcut |
| `rotationStepDeg` / `defaultRotationDeg` / `sideInsertRotation` | Rotation | `getModuleRotationStepDeg` / `getModuleDefaultRotationDeg` / `resolveSideInsertRotationDeg` | mevcut (`docs/refactor/ROTATION.md`) |
| color | Color | henüz belirlenmedi | yapılmadı |
| image | Image | henüz belirlenmedi | yapılmadı |
| lighting | Lighting | henüz belirlenmedi | yapılmadı |
| delete | Delete | henüz belirlenmedi | yapılmadı |

Catalog satırı: UI `listCatalogGroups()` + `getCatalogItem()`. Kart descriptor’ı Item master’dan türetilir (`label` = `name`). `listCatalogItems()` mevcuttur.

Item master ile Catalog projection ayrıdır. Projection alias’ları (`label`, kök `widthCm`) Item alanı değildir. Item master Catalog’dan bağımsızdır.

Color / image / lighting / delete satırları yer tutucudur; config şeması değildir. Rotation sözleşmesi `docs/refactor/ROTATION.md`.

---

## Item Schema

Yalnız yeni mimaride onaylanan alanlar.

```text
Item {
  itemKey: string

  catalogVisible: boolean
  categoryId: number | null    // Catalog.id
  catalogItemIndex: integer | null  // kategori içi sıra; Catalog.catalogIndex değil
  previewId?: number           // catalogVisible=true ise zorunlu integer id; gizlide yok
  dimensions?: {
    widthCm?: number
    depthCm?: number
    heightCm?: number
    mountHeightCm?: number
    wallGapCm?: number
  }
  sceneDimensions?: {
    widthCm?: number
    depthCm?: number
    heightCm?: number
  }
  rotationStepDeg?: number
  defaultRotationDeg?: number
  sideInsertRotation?: 'inherit' | 'default'
}
```

96 kayıtlı Item bu şemayı taşır. Katalogda görünen 58 kayıt `catalogVisible=true`, dolu category/index ve `previewId` taşır. `VIDEO_WALL_PANEL` katalog dışıdır (`catalogVisible=false`).

---

## Architectural Rules

- Her ürün/parça Item’dır.
- Item davranışı `type` tarafından belirlenmez.
- Registry grubu Item davranışı belirlemez.
- Catalog category Item davranışı belirlemez.
- Catalog, Item runtime repository değildir.
- `catalogVisible=false` Item’ı yok etmez.
- Item config davranışın parametrelerini taşır.
- Algoritma / canonical mechanism kodda bulunur.
- Aynı davranış için ikinci implementasyon oluşturulmaz.
- Yeni Item eklemek mümkün olduğunca kod değişikliği gerektirmemelidir.
- Item’ın desteklediği capability/config üzerinden mevcut canonical mechanism çalıştırılır.

---

## Validation (onaylı şema)

- Her Item `itemKey` taşır
- Her Item `catalogVisible`, `categoryId`, `catalogItemIndex` alanını taşır
- `catalogVisible=true` → category ve index dolu
- `catalogVisible=true` → `previewId` dolu ve `listCatalogPreviewIds()` üyesi
- `catalogVisible=false` → category ve index `null`
- `catalogVisible=false` → `previewId` alanı yok
- `catalogVisible=false` → Item `getItem` ile durur; `getCatalogItem` null döner
- `catalogWidthCm` yoktur
- Effective scene field yalnız same-field: `sceneDimensions.field ?? dimensions.field ?? MISSING`
- Aynı kategoride duplicate `catalogItemIndex` yasak
- Index her kategoride `1..N` kesintisiz
- Yerleşen 61 Item: `rotationStepDeg`, `defaultRotationDeg`, `sideInsertRotation` birlikte dolu
- Leaf 35 Item: üç rotation alanı yok (null / omit)

Test: `test/itemCatalogFields.test.js`, `test/itemSceneDimensions.test.js`, `test/itemRotation.test.js`
