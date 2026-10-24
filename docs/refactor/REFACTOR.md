# Fair Stand — Item mimarisi refactor günlüğü

Bu dosya Item mimarisine geçişin tek merkezi değişiklik kaydıdır. Audit dökümü değildir; yalnız gerçekten uygulanan adımlar ve o adımdan sonra geçerli kurallar yazılır.

- Item modeli: `docs/refactor/ITEMS.md`
- Katalog mekanizması: `docs/refactor/CATALOG.md`
- Stand zarfı: `docs/refactor/STAND_DIMENSIONS.md`
- Rotation: `docs/refactor/ROTATION.md`
- PostgreSQL tabloları: `docs/refactor/DATABASE.md`
- CRM kullanım kılavuzu: `docs/refactor/FAIR_STAND_DB_KULLANIM_KILAVUZU.md`
- Ertelenmiş kararlar / backlog (tavan–şerit, Item property; tip davranışı C.3 kapandı): `docs/refactor/PENDING_ITEM_DECISIONS.md`
- Item-first checklist: `docs/refactor/ITEM_FIRST_ROADMAP.md`
- Belge dizini: `docs/refactor/README.md`
- Performans yol haritası (tek kaynak platformda; burada yönlendirme): `docs/refactor/PERFORMANCE_ROADMAP.md`

---

## 2026-10-22 — Uzun parça bölünüşü BOM etiketinde (migration 0080)

**Ürün kararı:** 346,5 cm'yi aşan profil ve dikmeler üretim listesinde tek satır kalır, adın yanına parça bölünüşü yazılır: `N × Dikme 495 cm (346,5 + 8 + 140,5)`. BOM miktarı, reçete ve maliyet değişmez.

**DB:** `0080_item_length_parts` — `fair_stand_item_length_parts` (sıralı), yeni `profile_8` (8 cm, gizli, sahnede çizilmez). Alt Item yapısı seçilmedi: sıra kolonu yok ve `itemSnap.js` alt Item'ları snap hattı sayar (uzun dikme kısa panele profil hattı gibi davranırdı).

**Kod:** Katalog verisinde `lengthParts` (item_mapper; admin kopyalama da taşır). `items.js > formatItemLengthParts` parça boylarını (en uzun ölçü) "346,5 + 8 + 140,5" olarak yazar; `productionBomPanel.js > lineLabel` ekranda ve "Metin indir"de adın yanına ekler.
## 2026-10-22 — Kısa panel kartı ve genişlik seçimi (migration 0079)

**Ürün kararı:** Kısa panel profil gibi katalogda tek kartla gelir: Tek Sıra (`wall_100_short_1`, "Panel Tek Sıra 100") ve Çift Sıra (`wall_100_short_2`, "Panel Çift Sıra 100"). Ad sahnedeki öğenin ölçüsünü yazar: kısa panel "Panel Tek Sıra 50 … 200" / "Panel Çift Sıra 50 … 200", profil ve dikme gerçek boyla ("Profil 41,5" … "Profil 487", "Dikme 49,5" … "Dikme 495"); kart da kendi Item adını gösterir. Sağ tık başlığı katalogda gizli Item için Item adını yazar (`getModuleCatalogLabel`). Bırakırken genişlik sorulur: 50 / 100 / 150 / 200. Sağ tık menüsü eklenmez; "Bir daha sorma" tercihi yoktur. **0086 ile değişti:** kart 100 cm bırakılır, pencere açılmaz; genişlik Özellikler panelindeki varyant düğmelerinden seçilir.

**DB:** `0079_wall_short_cards` — diğer altı genişlik katalogda gizlenir (katalog alanları boşaltılır), iki kartın adı değişir, kategori içi görünür sıra 1…n olur. Item'lar, `itemKey`, `variant` ve reçeteler değişmez; otomatik alınlık (`resolveFasciaPanelItemKey`) ve kayıtlı projeler gizli genişlikleri kullanmaya devam eder.

**Kod:** `src/wallShortWidth.js` seçenekleri kartın wall-short varyantından üretir (tam boy `flat-panel` karışmaz). Ortak pencere `src/itemSizeDialog.js` `fieldLabel` / `allowRemember` alır ve yalnız listedeki Item'ı döndürür. `main.js` kısa panelde genişliği `dropCatalogModuleDrag` çağrısından **önce** sorar: profile ve yan panele bağlanma genişliğe göre çözüldüğünden konum seçilen genişlikle hesaplanır; kayıt seçilen genişliğin `itemKey`'iyle yapılır.

## 2026-10-22 — Profil kartı ve boy seçimi (migration 0078)

**Ürün kararı:** Profil dikme gibi tek kartla gelir (`profile_289`); bırakırken boy sorulur. Gerçek boy (BOM) → sahne boyu: 41,5 → 50, 91 → 100, 140,5 → 150, 190 → 200, 239,5 → 250, 289 → 300, 388 → 400, 487 → 500.

**DB:** `0078_profile_lengths` — `profile_289_scene` → `profile_289` (FK ON UPDATE CASCADE; proje ve grup şablonu JSON'unda metin değişimi), `profile_239_5` / `profile_388` / `profile_487` `profile_190`'dan kopyalanır, sahne ölçüleri yazılır, katalogda yalnız `profile_289` görünür. Seed (`catalog_seed_data.py`) ve test fikstürü (`test/fixtures/itemCatalogSeed.json`) aynı son durumu taşır.

**Kod:** Ortak boy penceresi `src/itemSizeDialog.js` (dikme ve profil). `src/profileLength.js`: profil listesi, etiket "gerçek cm (sahnede N cm)", tercih `fairStand.profileLengthItemKey`. `main.js` bırakmada ve sağ tık **Profil boyu…**'nda seçilen boyun `itemKey`'iyle kaydeder. Eski `profile_289_scene` projeleri `designState.js > LEGACY_PROFILE_ITEM_KEYS` ile çevrilir.

## 2026-10-22 — Dikey hareket ve taban referansı DB'den; zemin/tavan ölçüsü; dikme boyu (migration 0076)

**DB:** `fair_stand_items.vertical_move` ve `z_reference` (`0076_vertical_move`; seed `item_vertical_seed.py`, test aynası `test/itemVerticalSeed.mjs`; admin okur/yazar/kopyalar). Kural: TV, strafor, tül, raf, küp blok, LED projektör, profil ve kısa duvarlar dikey taşınır; profil ve kısa duvar `wall-top`.

**Kod:** `itemMovesVertically` (items.js). Ok tuşunda dikey adaylar yalnız bu ayar açıkken (`verticalAllowed`); kısa duvar yolu artık "duvar yerleşimli ve dikey hareketli" her öğede (profil dahil). `resolveItemDefaultZCm` kısa duvar varyant kontrolü yerine `zReference === 'wall-top'`. Profil 250 cm duvarda 240'ta gelir.

**Ölçü katmanı:** Etiketler öğenin sahne ölçüsü (state `widthCm/depthCm/heightCm` = `resolveSceneDimensions`; 90/270° en↔derinlik). Dikey hareketli öğede zemin ve duvar tepesi uzaklığı (`measureFloorCeiling`, `is-height`). Ölçü kutusu üst grubun matrisiyle okunur (ok tuşu sonrası güncel).

**Dikme:** `src/uprightHeight.js`: bırakırken boy penceresi (varsayılan seçili duvarın dikmesi), "Bir daha sorma, aynı ölçüde getir" (localStorage `fairStand.uprightHeightItemKey`), sağ tık "Dikme yüksekliği…" aynı pencere; çentik kalkınca tercih silinir. Kayıt seçilen boyun `itemKey`'iyle yapılır.
## 2026-10-22 — Yeni stand duvarları varsayılan kilitli

Stand oluşturma akışındaki `createAutomaticWallState` otomatik duvarları
mevcut proje örneği alanı `locked: true` ile oluşturur. Otomatik arka/yan duvarlar
ve depo planına göre yeniden oluşturulan duvar parçaları aynı varsayılanı alır.
Lambalar, depo içeriği ve katalogdan elle eklenen modüller bu değişikliğe girmez.
Mevcut kayıtların kilit durumu açılışta değiştirilmez. Sağ tık → **Kilidi aç** ile
taşıma ve silme yeniden kullanılabilir; kilitliyken renk ve görsel düzenlenebilir.
Kilit normal proje kaydıyla korunur; Item, BOM veya Alembic değişikliği yoktur.
Kullanıcı kılavuzu: uygulamadaki **Yardım → Sağ tık menüsü**.
Kılavuzdaki **Ayaklı Vitrin ve Broşürlük** ürün ölçüleri bölümü kaldırıldı;
ürün tanımları kendi Item belgelerinde tutulur.

## 2026-10-22 — Tümünü seçme ve toplu işlemler

Sahne aktifken Ctrl/Cmd+A bütün sahne modüllerini mevcut çoklu seçim mekanizmasıyla
seçer; stand zemini ve zarfı seçilmez. Metin alanları ve sahne dışındaki kontroller
tarayıcının kendi kısayollarını kullanır. Menüden toplu kilit, kilit açma, grup kurma,
tamamı seçilen grupları çözme ve silme yapılır. Seçim çubuğunda ve Delete tuşunda
da toplu silme kullanılabilir. Kilitli öğe içeren silme işlemi bütünüyle reddedilir;
tek onay iptal edilirse seçimdeki hiçbir öğe değişmez.

Grup kilidi yalnız grubun tamamı seçiliyse toplu kilit açma ile kaldırılır.
Toplu çözme yalnız tamamı seçilen gruplara uygulanır; bunlardan biri kilitliyse
hiçbir grup çözülmez. Parçaların konumu korunur ve mevcut kenara bağlanma kuralı
çalışır. İşlemler mevcut proje örneği alanlarını ve geçmiş mekanizmasını kullanır;
yeni DB alanı, Alembic migration veya BOM değişikliği yoktur.

## 2026-10-22 — Bar masası (migration 0075)

`glass_bar_table` "Bar Masası": cam masa ailesinin (`table-glass`) 108 cm ürünü; ayrı tür açılmadı. `0075_glass_bar_table` satırı `glass_table`'dan kopyalar (birim, maliyet bayrağı, önizleme, dönüş, yüzey bayrakları) ve Extra kategorisinin sonuna koyar. `createGlassTableModuleState(descriptor)` kartın `itemKey`'ini kullanır (varsayılan `glass_table`); açılışta aynı ailedeki anahtar korunur; `createGlassTableModule` ve seçim metni Item'ı modülden okur; ayak `heightM - 0.04` uzunluğundadır. Testler: `test/glassBarTable.test.js`, `backend/tests/modules/fair_stand/test_glass_bar_table_migration.py`.

## 2026-10-21 — Zemin ızgarası, tepeden ışık, 10 cm adım, ayaklı vitrin ve broşürlük; kopyada Shift+R

**Izgara:** Stand zemininde 1 m kalın, 50 cm ince çizgi (`createStandFloorGrid`); yalnız stand alanında, seçim ışınına takılmaz. Yalnız yerleştirme önizlemesi (katalog, kopya, taşıma) görünürken çizilir, boşta gizli (`setStandFloorGridActive`, `syncPlacementGhostDom`). Yalnız görüntüdür; Render Al'a girmez.

**Ölçü katmanı:** Tek öğe seçiliyken zeminde taban alanı (turuncu kesikli) ve genişlik/derinlik/yükseklik etiketi (cm; seçim çerçevesinin kutusundan, çerçeve payı düşülür). Yerleştirme önizlemesi görünürken öğeden stand kenarlarına dört uzaklık çizgisi ve metre etiketi (kenara yaslı olan çizilmez). Etiketler DOM (`.scene-measure-label`), çizgiler `measure-overlay`; her çizilen karede güncellenir (`syncMeasureOverlay`), Render Al'a girmez.

**Işık:** Ana yönsel ışık stand merkezine tepeden bakar, hafif öne/sağa eğik (`KEY_LIGHT_OFFSET`, `aimKeyLightAtStand`); gölge kamerası standı kapsar. Editörde gölge kapalı kalır, gölgeler "Render Al" çıktısındadır.

**Adım:** Bütün öğe türlerinde taşıma adımı 10 cm (migration `0073_move_snap_10cm`; seed ve frontend varsayılanı da 10). Banko ve kısa duvarın dikey adımı da 10 cm olur.

**Yeni öğeler (migration `0074_showcase_brochure`):** `floor_showcase_100` "Ayaklı Vitrin 100" (100 × 40, 70 cm gövde + 30 cm cam fanus) ve `brochure_stand` "Broşürlük" (30 × 30 × 150, 5 cep). Tekil Item, BOM 1 adet; serbest yerleşim, taban alanı çakışması. Vitrin gövdesinin ön/sol/sağ yüzü renk, görsel ve Lightbox alır (`faces.front/left/right`, `ensureFloorShowcaseFaces`; panel seçim modu). Prosedürel çizim `createFloorShowcaseModule`, `createBrochureStandModule` (ortak `createFreeItemShell`). Tanım: `docs/items/definitions/floor_showcase_100.md`, `brochure_stand.md`.

**Hata:** Serbest öğe stand kenarına 50 cm'den yakınsa kenara (köşede iki kenara birden) çekiliyordu; sabit `MODULE_PLACEMENT_SNAP_CM` yerine tür adımı (10 cm) kullanılır (`createFreePlacement`, `test/standEdgeSnap.test.js`).

**Hata:** Kopya/katalog yerleştirirken Shift+R seçili kalan asıl öğeyi de döndürüyordu. Yerleştirme dinleyicisi Shift+R'yi yakalama aşamasında tüketir (`moduleDragSidebar.js`, `stopImmediatePropagation`); sahne dinleyicisine ulaşmaz.

## 2026-10-23 — Profil profile her noktada dik bağlanır

Ürün kararı: 2026-10-21 kuralı duvarlar için geçerli kalır; profil ise başka bir profilin her noktasına dik bağlanır (iki profilin arasına, ortasına) ve uç uca eklenir. Çakışma (`collisionSegmentsOverlap`): iki profil dik kesişince birinin ucu birleşimdeyse izin, birbirinin ortasından geçerse (X) çakışma; `isMidWallTeeContact` profil çiftinde dikme mesajını vermez (`isProfilePair`). Yapışma (`getSegmentSnapCoordinates`): profil hedef profile yaklaşınca uçlara ek olarak `PROFILE_TEE_SNAP_STEP_CM` (10 cm) adımla ara noktalar `tee` adayıdır. Profil T bağlantısı için BOM'a ayrı aparat eklenmez.

## 2026-10-21 — Dik bağlantı yalnız dikme olan noktaya

Ürün kararı: tek duvarın ortasında dikme yoktur; dik duvar (kısa ya da tam boy) oraya bağlanamaz. Yerleşim (`collisionSegmentsOverlap`): iki ince duvar dik kesiştiğinde ikisinin de ucu birleşimdeyse (L ya da iki duvarın birleşim ucunda T) izin; yalnız birinin ucu diğerinin ortasındaysa çakışma, mesaj `MID_WALL_TEE_MESSAGE` "Dik bağlantı yalnız dikme olan noktaya yapılır.". Magnetic snap (`getSegmentSnapCoordinates`) yalnız hedefin uçlarını aday üretir; 50 cm'lik ara noktalar kalktı. Kayıtlı eski yerleşimler yerinde kalır; taşınınca yeni kurala uyar. Testler `test/modulePlacement.test.js` ürün kararına göre güncellendi.

## 2026-10-21 — Düz duvara arka yüz paneli

**State:** `flat-panel` (wall_50/100/150/200, kısa duvarlar) isteğe bağlı `backStrips` taşır; yapı `strips` ile aynı, kimlikler ayrı. Alan yoksa arka yüz boştur; eski projeler değişmez, migration yok. Açılışta arka bant sayısı ön yüzü izler (`alignFlatPanelBackStrips`); kopya yeni kimlik alır. Sahip: `src/designState.js` (`supportsFlatPanelBackStrips`, `addFlatPanelBackStrips`, `removeFlatPanelBackStrips`).

**Menü:** Sağ tık "Arka yüze panel ekle / Arka yüz panellerini kaldır" (yalnız düz duvar ailesi; kaldırırken arka yüzde görsel/cam/Lightbox/metal varsa onay).

**Çizim ve seçim:** Arka paneller ön yüzün aynası (profilin 15 mm gerisinde, 4 cm iç pay, −Z'ye bakar; `userData.panelSide = 'back'`). Ön ve arka yüz ayrı seçim düzlemidir (`planeKey` `:back` eki; aralık seçimi çapanın yüzünde kurulur).

**BOM:** Arka bant başına reçete paneli eklenir (`collectBackPanelSurfaces`, `panelLinesFromSurfaces`): `wall_100` iki yüz = 2 × `profile_91`, 2 × `upright_346_5`, 14 × `panel_98`. Cam/metal arka bantlar ayrıca ayrılır; baskı alanı arka görselleri ayrı yüzey olarak sayar. Köşe kuralı yüz bazlı: komşu duvar yüzün önündeyse o yüzün panelleri `panel_corner_*` olur (`partnerOnFront` / `partnerOnBack`, `backSwapModuleIds`). L ve U'da içe bakan yüzler köşe, dışa bakanlar düz; T'de kolun iki yüzü köşe, gövde mevcut T kuralıyla (`payCorner: false`) düz kalır. Bağlantı aparatı kuralı değişmez.

## 2026-10-21 — Raf: Tekli / 2 sıralı / 3 sıralı (migration 0072)

**Katalog:** Raf & Vitrin altında üç kart: `shelf_row_1` Tekli raf, `shelf_row_2` 2 sıralı raf, `shelf_row_3` 3 sıralı raf (**0086 ile değişti:** katalogda yalnız "Raf" kartı `shelf_row_1`; 2 ve 3 sıralı raf `variant` `shelf-row` ile Özellikler panelinde seçilir). Kartta genişlik yok; `shelf_100/150/200` katalogdan çıktı (Tekli kartın ürünleri). Yeni tablo `fair_stand_item_width_variants` kart → ürün eşlemesini tutar; genişlik ürünün `dimensions.widthCm` değeridir (`getWidthVariantFamily`, `resolveWidthVariantItemKey`). Anahtar deseni ve `if (itemKey === …)` yok.

**Ürünler ve BOM:** Tekli raf mevcut `shelf_W` (reçete `shelf_W_self` × 1 + `shelf_leg` × 2/3/3; canlıda vardı, migration yoksa ekler). Sıralı raf `shelf_row_n_W` = `shelf_W` × n: 2 sıralı 150 → 2 tahta + 6 ayak. Sıra sayısı Item kolonu değil, reçeteden okunur (`resolveShelfRows`).

**Yerleşim:** Raf yalnız duvar/panel birleşimine oturur; genişlik takıldığı duvar modülünden çözülür, 50 cm duvar ve duvar dışı reddedilir, başka duvara taşınınca ürün ve genişlik yeniden çözülür (`snapPanelSeamOverlayPlacement` → `resolvedModuleState`). Alt tahta birleşime oturur; üst tahtalar 50 cm arayla ve duvarın içinde kalmalı (`seamsFittingOverlayHeight`).

**Çizim ve ışık:** n ayrı tahta (kalınlık tekli tahtanın ölçüsünden), her sırada LED ve spot; `shelfLightingOn` hepsini birlikte açar. Raf ayağının DB ölçüsü yok; ayak çizilmez, yalnız BOM'dadır.

**Kayıt:** Yeni alan yok; eski `shelf_100/150/200` kayıtları aynen Tekli raf olarak açılır, BOM değişmez.

## 2026-10-21 — Panel duvarı çerçevesi: dört kenar aynı kesit (görünüm)

**Kesit kaynağı:** `resolveProceduralFrameCrossSectionCm` modül reçetesindeki ilk `profile` Item'ının sahne ölçüsünü okur (`depthCm` × `heightCm`; canlı yerel DB'de 10 × 10). Dikmeler de bu kesitle çizilir. Reçetesinde profil olmayan modülde kesit stand `frame_depth_cm` ile kare kutudur. Stand `frame_width_cm` sahnede okunmaz.

**Çerçeve (`addPanelModuleFrame`):** Düz panel, bazalı duvar, kapı ve vitrinde iki dikme ile alt/üst profil aynı kesitte; üst/alt profil artık 0,4 cm ray değil, dikmeyle aynı kalınlıkta. Profil kenarlarında koyu ton kenar çizgisi (`EdgesGeometry`, raycast yok). Panel yüzü profillerin önünde durur ve çerçevenin dış kenarından alt ve üstte 4 cm (`PANEL_FRAME_INSET_M`), sağ ve solda 2 cm (`PANEL_FRAME_SIDE_INSET_M`) içeride biter; en alt ve en üst bant `fitPanelToFrameOpening` (`wallPanelBand.js`) ile kırpılır, aradaki bantlar değişmez. Panel yüzü duvar/profil ön yüzünün 15 mm önündedir (`PANEL_FACE_OFFSET_M`, eskiden 1,5 mm); panel gövdesi reçetedeki `panel` Item kalınlığında (`dimensions.depthCm`, örn. 0,8 cm) yüzün hemen arkasındadır (`resolveRecipePanelThicknessCm`; reçetede panel yoksa eski iç dolgu kutusu). Duvara asılan TV, raf ve strafor (`wallFrontM`) aynı yüze oturur. Çerçeve panelin çevresinde alt/üstte 4 cm, sağ/solda 2 cm şerit olarak görünür. Vitrinde dikme vitrin gövdesinin yüksekliğinde çizilmez (`uprightGap`); orada gövdenin yan tahtaları kenar olur.

**Baza ve banko (düz + L):** Köşe dikmeleri ile alt/üst (L'de orta) raylar aynı kare profil kesitinde (`addBoxModuleFrame`, kenar çizgili); raylar artık 0,2 cm değil. Yüz panelleri profil dış yüzünün 15 mm önünde (`placeBoxPanelFace`) ve çerçevenin dış kenarından alt/üstte 4 cm, sağ/solda 2 cm içeride; gövde reçetedeki panel Item kalınlığında (`resolveBoxPanelBackingDepth`, reçetede panel yoksa 12 mm). Tabla, ölçüler ve BOM değişmez.

**Kanallı profil (`src/profileGeometry.js`):** Bütün prosedürel profil ve dikmeler (duvar/kapı/vitrin/ayırıcı çerçevesi, baza ve banko, tek başına `profile` ve `upright` modülleri) düz kutu yerine kesitten uzatılmış geometri: dört uzun yüzün ortasında 2 cm ağızlı, 1,5 cm derin boyuna kanal (`PROFILE_SLOT_WIDTH_M`, `PROFILE_SLOT_DEPTH_M`; ince kesitte ağız en fazla %40, derinlik %30). Dış ölçü kutuyla aynı. Profil başına çizim çağrısı değişmez (1 mesh + 1 kenar çizgisi); üçgen sayısı ~12'den ~100'e çıkar. Görsel alanı panel yüzünün ölçüsüdür. `panelRailHeight`, strip state, BOM ve kayıt biçimi değişmez.

## 2026-10-20 — Tablet kullanımı 1. aşama: seçim çubuğu, uzun basma, Döndür

**Seçim çubuğu (`selectionToolbar.js`):** Tek öğe seçiliyken üstünde Döndür / Kopyala (sağa) / Sil / ⋯; toplu seçimde yalnız ⋯ (toplu menü). Konumu sahne bildirir: `createStandScene` 6. geri çağrısı `onSelectionAnchor`, her karede seçili modülün tepe ortasının ekran noktası (değişince); sürüklerken gizlenir. Stili modül kendisi ekler (CRM gömülü stil dosyasına girmez).

**Uzun basma:** Dokunmatikte ~0,55 sn basılı tutmak sağ tık menüsünü açar (`openModuleContextMenuAt`); parmak 10 px oynarsa veya kalkarsa iptal, açılırsa başlamış modül sürüklemesi bırakılır; tarayıcının kendi contextmenu olayı ikinci kez açmaz.

**Döndür:** Sağ tık menüsüne eklendi; `scene3d.rotateModuleById` modülü seçip Shift+R ile aynı döndürmeyi yapar. Seçimden menü bağlamı: `scene3d.getSelectionContext`.

**Sağ tık kalır.**

### Depo seçimi tek liste

"Depo eklensin" onay kutusu (`#auto-depot-enabled`) kaldırıldı. `#auto-depot-size` listesinin ilk seçeneği **Depo yok** (`value=""`), ardından 1×1, 1,5×1, 2×1, 2×2 m. Depo seçiliyken altındaki **Depo içeriği eklensin** açılır ve açıklaması (`#auto-depot-contents-hint`) görünür; Depo yok'a dönünce kapanır ve işareti kalkar. Sol menüde alt alta; sihirbazda aynı liste ve kutu. Kayıt biçimi aynı (`stand.depot { enabled, sizeKey, includeContents }`); proje açılınca liste kayda göre dolar. Kutuyu işaretleyen 3 E2E'den yalnız o satır çıktı.

### Yeni proje sihirbazı ve ilk ipuçları

**Sihirbaz** (`src/newProjectWizard.js`): yeni projede (`initialProjectId` yok veya sahne sıfırlanınca) boş sahnenin (`#viewport-empty`) ortasında 3 adım: stand tipi, ölçü (X, Y, duvar yüksekliği, depo), özet + Oluştur. Yeni kurulum yolu yok: seçimleri sol menüdeki alanlara yazar (`input`/`change` olaylarıyla), ölçüyü `readSceneSetupFromControls` ile doğrular, Oluştur mevcut `#create-stage`'e basar (proje adı penceresi, kayıt, revizyon aynı). ✕ ile kapanır, bugünkü boş sahne kartı görünür. Mevcut proje açılınca çıkmaz.

**İlk ipuçları** (`src/onboardingTips.js`): sahne ilk kez kurulup kaydedilince 3 ipucu (katalogdan ekleme, çift tıkla seçim, Kaydet); Tamam / Atla. `localStorage.fairStandTipsSeen = '1'` ile bu tarayıcıda bir daha çıkmaz. Playwright ayarı (`storageState`) ipuçlarını görülmüş sayar ki diğer testlerde tıklamaları örtmesin; `new-project-wizard` E2E'si bunu temizleyip ipuçlarını ayrıca doğrular.

### Tablette iki parmak öğeyi sürüklemez

İki parmakla yakınlaştırırken ilk parmak bir öğeye denk gelince öğe sürükleniyordu; ikinci parmak öğenin üstüne gelince de öğeyi yakalıyordu. Artık ekranda ikinci parmak belirince (`scene3d`, `activeTouchPointers`) başlamış öğe sürüklemesi iptal edilir, öğe (grup sürüklemesinde bütün grup) yerine döner, uzun basma iptal olur ve iki parmak doğrudan kameraya (OrbitControls) verilir: yakınlaştırma / kaydırma çalışır. E2E `pinch-zoom-no-drag` gerçek çoklu dokunuşla (CDP) iki durumu doğrular.

### Konsolda ölçüm satırı yok (varsayılan)

`[Fair Stand ölçüm]` satırları (proje açılışı, sahne hazır, sahne yenileme) artık varsayılan olarak konsola yazılmaz; kullanıcının konsoluna veri gitmez. Ölçüm kaydı (`performance.mark`) aynen tutulur. Konsolda görmek için tarayıcı konsolunda `localStorage.setItem('fairStandTiming', '1')` ve sayfayı yenile; kapatmak için `removeItem`. Ölçüm satırını bekleyen E2E'ler (`project-open-timing`, `catalog-drop-append`) anahtarı açar; anahtarsız satır yazılmadığı ayrıca doğrulanır.

### Üst bant, görünüm küpü ve menü düğmesi çakışmaz

Üst banttaki ipucu yazıları (Modülü tut + sürükle, Ctrl/Cmd + tık, döndür / pan / zoom) kaldırıldı; aynı bilgi kılavuzun Mouse Kontrolleri tablosunda. Görünüm küpü her ekran boyutunda sahnenin sağ üst köşesinde. Bant küpün solunda biter (`--view-cube-reserve`), solda menü aç/kapa düğmesine yer bırakır (`--sidebar-toggle-reserve`), sığmazsa alt satıra kayar; hiçbir boyutta küpün veya düğmenin altına girmez. Menü altta olan dar düzende (≤760 px) aç/kapa düğmesi her durumda sahnenin sol üstündedir. E2E `viewport-chrome-layout`: 7 ekran boyutunda, menü açık ve kapalı çakışma yok.

### Çift tık modülü seçer; Ctrl+tık seçilenin çoğulu; Shift+tık kaldırıldı

**Çift tık / çift dokunuş** (`scene3d`, ~0,35 sn ve 10 px içinde aynı modüle iki basış) modülün tamamını seçer (`selectModuleOnly`, turuncu); tek tık bugünkü gibi paneli seçer. İkinci basış sürükleme başlatmaz; hemen ardından gelen basış da modül seçimini korur. Kopyala / katalog yerleştirme ve Çoklu panel modunda devreye girmez.

**Ctrl/Cmd + tık** seçilenin çoğulu: modülün tamamı seçiliyse (yüzey seçimi yok) tıklanan modülü toplu seçime ekler/çıkarır (`toggleMultiModuleSelection`); yüzey (panel, banko yüzü) seçiliyse veya seçim yoksa bugünkü çoklu panel dikdörtgeni / banko yüzü (`handleSurfaceSelectionAt(..., true)`). Grup ve kilit menüsü (Grup oluştur, Gruba ekle, Seçilenleri kilitle) aynıdır.

**Shift + tık ile modül seçimi kaldırıldı.** Boş alanda Shift kamera kaydırma ve Shift+R aynı. Tablette toplu modül seçimi yine **Çoklu modül** ile. `module-group`, `module-lock`, `group-template` E2E'leri çift tık + Ctrl+tık'a çevrildi (doğrulamalar aynı); `double-click-select` yeni.

### Kopyala: hafıza + art arda yerleştirme (Çoğalt Sağ/Sol kaldırıldı)

Sağ tık menüsündeki **Çoğalt Sağ / Sol** kaldırıldı. Kopyalama yalnız seçim çubuğundaki **Kopyala** ve Ctrl/Cmd + C ile yapılır; sağ tık menüsünde Kopyala yoktur. Kopyala modülü hafızaya alır (`copiedModule`) ve katalogdan dokunarak eklemenin yerleştirme yolunu açar (`moduleDragSidebar.armPlacement`): her tıklama/dokunuş `duplicateModuleState` ile yeni bir kopya üretir ve `scene3d.dropCatalogModuleDrag` ile katalogla aynı kuralla yerleştirir (duvar şeridine araya ekleme dahil). Görseller, renk, cam/Lightbox/metal taşınır; kopya kilitsiz ve grupsuzdur, metal separatör kendi grubunu alır. Art arda sürer; Esc, seçim çubuğundaki **Kopyalamayı bitir** veya katalog kartı bitirir. Ctrl/Cmd + V son kopyayla yeniden başlar. **Grubu çoğalt** aynen kalır. `duplicateContextModule` (yana ekleme) kaldırıldı.

### Otomatik kayıt kapalıyken yalnız Kaydet

Otomatik kayıt **Kapalı** iken proje yalnız **Kaydet** ile kaydedilir; revizyon da yalnız o zaman ilerler. Önceden kapalıyken de kaydeden yollar: görsel ekleme/kaldırma/kullanılan görseli silme (`persistActiveProject`), sekme gizlenince ve editörden çıkınca (`saveNowIfDirty`), Aç / Dışarı Aktar / Sahneyi Oluştur / İçe Aktar / proje seçimi öncesi (`projectActionSaveGuard`). Artık:
- görsel işlemleri kaydetmez (`autosaveController.isAutoSaveOff()`), `saveNowIfDirty` kapalıyken hiçbir şey yapmaz;
- proje işlemleri kaydetmez; kaydedilmemiş değişiklik varsa onay sorar (Dışarı Aktar: son kayıt aktarılır);
- "← Standlar" (sayfa içi geçiş; tarayıcının "Siteden çıkılsın mı?" uyarısı çıkmaz) kaydedilmemiş değişiklik varsa "Kaydetmeden çıkılsın mı?" diye sorar; fair-stand kendi tıklamayı yakalar, CRM'e dokunulmaz. Sekme kapatma / yenileme uyarısı aynen kalır. Tarayıcının geri tuşu bu onaydan geçmez.
Otomatik kayıt açıkken davranış aynıdır. Not: kapalıyken kullanılan görsel silinirse kayıtlı sürüm, Kaydet'e kadar o yüzeyleri görselsiz açar (eksik görsel davranışı).

### 2. aşama: sade menü, dokunmatik çoklu seçim, dokunarak ekleme

**Sade / Gelişmiş menü:** Cam, Metal Separatör, Lightbox, Mesh dönüşümleri ve Lightbox aydınlatması `.module-context-advanced` altına alındı; `Gelişmiş ▸` düğmesi yalnız bu öğede en az biri uygunsa çıkar, açık/kapalı tercihi oturum boyunca hatırlanır. Görünür kalanlar: grup komutları, Kilitle, Döndür, Sil, Çoğalt, Boyutlandır, Görseli ölçülendir, Raf altı ışık, Ekle. Bu butonlara basan 3 E2E (`box-block-corners`, `duplicate-metal-separator`, `metal-separator-bom-gap`) önce Gelişmiş'i açar; doğrulamaları aynı.

**Çoklu panel / Çoklu modül (tablet):** Seçim çubuğundaki düğme seçili olana göre değişir (anchor `kind`). Panel seçiliyse **Çoklu panel** (mavi), tek seferlik, Ctrl + tık ile aynı `selectRectangleTo` dikdörtgeni (komşu modüller ve köşe dahil): kaydırmadan dokunuş önceden seçili panelden (çapa) dokunulan panele kadar seçer; kaydırmada parmağın konduğu panel çapa olur. Parmak kalkınca mod kapanır, sonraki sürükleme yine taşır. Modül seçiliyse **Çoklu modül** (turuncu): dokunuş Shift + tık ile aynı `toggleMultiModuleSelection`; seçim boşalınca kapanır. `scene3d.setMultiSelectMode(false | 'panel' | 'module', { onEnd })`; sahnenin kenarı modda mavi/turuncu. Renk kuralı: mavi = panel/alan, turuncu = modülün tamamı. Bu modlarda uzun basma menüsü başlamaz.

**Modüller arası panel seçiminde çubuk ve ⋯:** Seçili paneller birden fazla modüle yayılınca çubuk o modüllerin üstünde kalır (önceden kayboluyordu) ve ⋯ menüsü çapa panelinin bağlamıyla açılır (sağ tıkla aynı panel işlemleri). Modülün tepesi ekranın üstünde kalırsa (yakınlaşınca) çubuk üst kenara yapışır.

**Dokunarak ekleme:** Katalog kartına tıklamak/dokunmak kartı "yerleştirmeye hazır" yapar (turuncu çerçeve, ipucu metni); sahnede dokunulan nokta sürükle-bırakla aynı `onPreview` / `onDrop` yolundan geçer (capture fazında yakalanır, sahne seçimi ve kameraya gitmez). Tek seferliktir; aynı kart veya Esc iptal eder. Farede imleç gezerken önizleme gösterilir. Sürükle-bırak aynen kalır.

---

## 2026-10-19 — Duvar yüksekliği kuralı (wall ailesi)

**Kural:** Düz duvar (`wall_50/100/150/200_350`) reçetesi DB'de 350 cm (7 bant) olarak kalır. Reçete satırına `per_band` (bant başına adet farkı: panel 1, tekli aparat 2) ve `height_matched` (dikme yüksekliğe göre değişir) eklendi (`0068_wall_band_recipe`). B = yükseklik / 50: panel B, tekli 2B − 1, başlangıç 2, profil 2, dikme 2.

**Dikmeler:** `upright_247_5` (250), `upright_297` (300), `upright_346_5` (350, mevcut), `upright_396` (400), `upright_445_5` (450), `upright_495` (500). Gerçek boy ürün tablosundan ve kural: gerçek boy = duvar yüksekliği × 0,99 (49,5 / 99 dahil hepsi uyar); türetme dikmeyi bu kuralla seçer. upright_396 / upright_445_5 / upright_495 bazı veritabanlarında (kısa duvar dikme yığını) zaten vardı: migration onlara dokunmaz, downgrade yalnız upright_247_5 ve upright_297’yi siler. Gizli Item, fiyat atanmadı.

**Türetme:** `initializeItemRegistry` kuraldan `wall_100_250` … `wall_100_500` üretir (`buildWallHeightVariants`). Türetilen Item `getItem` ile bulunur, `listRegisteredItems` / katalog / admin listesine girmez. `resolveWallItemKeyForHeight` duvarı seçilen yüksekliğe eşler.

**Bağlantılar:** `relationshipBom.js` duvar/ayırıcıda sabit 7 / 13 / 6 yerine reçetenin bant sayısını kullanır: uç yüzey B, standart tekli 2B − 1, köşe aparatı B − 1; eklemde kalkan dikme katılımcının reçetesindeki dikmedir. 350'de sonuç değişmez.

**Stand:** Stand kurulumunda "Duvar yüksekliği" (250–500, varsayılan 350). `currentStand.wallHeightCm` projeyle kaydedilir; eski projede alan yoksa 350. Otomatik duvar ve katalogdan eklenen düz duvar bu yüksekliği alır.

**Kapı ve vitrin (`0069_door_showcase_band_recipe`):** Aynı kural: panel_98 per_band 1, tekli per_band 2, dikme height_matched; kapı kanadı, profil, başlangıç ve vitrin gövde parçaları sabit. Kapı kanadı 4 bant (200 cm), 2 gözlü vitrin 2, 3 gözlü 3 bant tutar; panel = B − tutulan bant. 250 cm: kapı 1 panel / 1 tekli, 2 gözlü 3 / 5, 3 gözlü 2 / 3 (ürün tablosu); 300 kapı 2 panel / 3 tekli. Bağlantıda B panel sayısıdır; 350’de eski sabitleri (kapı 3/5/2, 2 gözlü 5/9/4, 3 gözlü 4/7/3) verir. Kapı modülü panel sayısı ve BOM bant indeksleri bant sayısından; depo kapısı ve depo duvarı stand yüksekliğini alır.

**Kısa duvar:** Standın duvar tepesine hizalanır. DB tabanı 350’ye göredir (short_2 250, short_1 300); `resolveItemDefaultZCm` aynı farkla kaydırır (250’de 150 / 200). Açık standın yüksekliği `setActiveWallLineHeightCm` ile items.js’e verilir.

**Dikme serbest yerleşim:** `magnetic_snap = short-up-joint` (yalnız dikme tipi) artık reddetmez: dikme birleşime yakınsa yapışır, değilse sahneye serbest bırakılır. DB değeri değişmedi; davranış koddadır.

**Ayırıcı 100 (`0070_separator_band_recipe`):** Düz ve sarmaşıklı 100’lük ayırıcı aynı kuralda (separator_panel_98 per_band 1, tekli per_band 2, dikme height_matched; sarmaşık parçası sabit). Kod son ek alır (`wall_separator_100_250_sarmasik`). Çizimde lata sayısı iç yüksekliğe orantılı (350’de 36); sarmaşık GLB 350’ye göre yapıldığı için dikeyde yükseklik / 350 oranında esner.

**Tavan ve projektör:** Stand tavanı (`getStandDimensions().heightCm`) en az seçilen duvar yüksekliğidir (`setStandWallLineHeightCm`); 450 / 500’de modüller DB tavanına (350) kırpılmaz. Üst profil hattı (projektör) türetilmiş duvarda yükseklik farkı kadar kayar (`resolveVirtualTopRailZCm`). Baza host listesi türetilmiş duvarı ana koduyla tanır.

**Ayırıcı 50 (`0071_separator_50_band_recipe`):** Ürün kararı: 50’lik ayırıcı (düz ve sarmaşık) 2 dikme, 2 × profile_41_5, bant başına 1 × separator_panel_48_5, 2 başlangıç, 2B − 1 tekli (250: 5 panel / 9 tekli). 350 reçetesi düzeltildi: tekli 7 → 13; sarmaşıklıda 98’lik paneller silindi, 7 × 48,5. 350’lik projelerde 50’lik ayırıcının üretim listesi değişir; eklem sonuçları 100’lük ayırıcıyla aynı olur.

**Kapsam dışı:** Açık standın yüksekliğini sonradan değiştirmek (backlog, `PENDING_ITEM_DECISIONS.md` B.16); yeni dikmelerin fiyatı.

---

## 2026-10-19 — Editör performansı: ışık/gölge Render Al'da, tek modül güncelleme

**Işık ve gölge:** Editörde ışık gölgesi (`shadowMap.enabled = false`), LED projektör ve raf altı spot ışıkları kapalı. Spot ışıklar `RENDER_ONLY_LIGHT_LAYER` katmanında, editör kamerası bu katmanı görmez; lens ve LED şerit parlamaya devam eder. Render Al (`captureCurrentViewPng`) gölgeyi ve katmanı açıp çizer, sonra kapatır; bu sırada yükleme ekranı gösterilir. Projektör camında `transmission` yok; tek bir `transmission` malzemesi bile sahneyi her karede iki kez çizdirir. Cam masa (`TABLE_GLASS_APPEARANCE`) editörde kırılmasız düz camdır; Render Al çizerken `TABLE_GLASS_RENDER_TRANSMISSION` (0,32) açılır, sonra kapanır.

**Tek modül güncelleme:** Katalogdan bırakma, katalog düğmesiyle ekleme ve çoğaltma, mevcut modüllerin yeri değişmiyorsa yeni modülü sahneye tek başına ekler (`scene3d.appendModule`, `main.commitModuleAddition`). Silme yalnız o modülü kaldırır ve sonraki modüllerin `moduleIndex` değerini yeniler (`scene3d.removeModule`, `main.commitModuleRemoval`). Grup temizliğinin başka modülü değiştirdiği silme ve kumaş kaplamalı modül tam kurulumda kalır. Taşıma ve döndürme zaten sahne içinde tek modül çalışıyordu.

**Program koruma:** `disposeWall` eski nesneleri yeni sahnenin ilk karesinden sonra dispose eder. three.js kullanıcısı kalmayan gölgelendirici programını siler; önceden her tam kurulumda bütün programlar baştan derleniyordu.

**Geri al / ileri al:** `applyDesignSnapshot` kopyadaki modül içerik olarak şimdikiyle aynıysa mevcut nesneyi kullanır (`reuseUnchangedModules`; ekrandaki yüzeyler bu nesnelere bağlıdır) ve sahneyi tam kurulum yerine eşitler (`syncSceneToModules` → `scene3d.syncModules`): aynı nesneyle kalan modüle dokunulmaz, çıkan kaldırılır, yeni/değişen yaratılır; değişen modülde kumaş varsa kaplamalar yeniden kurulur.

**Grup işlemleri ve şeride araya ekleme:** Modülleri yerinde değiştiren bu işlemlerden önce her modülün içeriği (yer ve grup bilgisi hariç) kaydedilir (`captureModuleContent`); sonra `syncSceneAfterModuleChange` sahneyi eşitler. İçeriği değişen modül yeniden yaratılır (`syncModules(modules, { rebuiltIds })`), yalnız yeri değişen sahne nesnesi taşınır (`applyPlacementToGroup`), grup bilgisini sahne canlı okur. Kapsam: grup oluştur, gruba ekle, gruptan çıkar, çöz, çoğalt, sil, şablon yerleştir, şeride araya ekleme.

**İlk kare ölçümü:** "sahne tamamen hazır" satırı açılıştaki çizimi de yazar: kare sayısı ve toplam süre, en ağır kare, derlenen program ve ekran kartına yüklenen doku sayısı. Doku boyutu sınırı gerekmedi: yüklenen görseller zaten 1536 piksele küçültülüyor (`MAX_IMAGE_LONG_EDGE_PX`), katalog GLB dokuları en çok 1024 piksel.

Lokal ölçüm (kullanıcı): projektör bırakma ilk kare 1291–4893 ms (+27–29 program) → 23–36 ms (+0). Konsol: `[Fair Stand ölçüm] sahne yenileme: kurulum · ilk kare · +N program`.

---

## 2026-10-19 — Performans P0: ölçüm, yarım sahne yok, GLB ad koruması

Proje açılışı "Düzenle"den sahne tamamen hazır olana kadar ölçülür ve konsola yazılır (`[Fair Stand ölçüm] …`): editör kodu, katalog, proje verisi, görsel indirme, sahne kurulumu, son görsel / son model. Kod: `src/projectOpenTiming.js` (#296), CRM işareti `fs:editor-route` (kyrox-fair-crm #357).

Sahnedeki görsel ve 3D model yüklemeleri sayılır (`src/sceneAssetLoading.js`: ortak `textureLoader` sarmalayıcısı + `loadItemModel`). Proje, geçmiş revizyon, canlıya dönüş ve içe aktarma yükleme ekranını hepsi gelene kadar açık tutar, ilerleme yazar; yüklenemeyen parça gelmiş sayılır, 30 sn sınırı var. Düzenle ile gelindiğinde yükleme ekranı mount anında görünür (#299).

`test/glbNameContract.test.js`: `scene3d.js`'in adla aradığı GLB parçaları (Eames `plastic_wit`/`Material1`, bar taburesi `Burlington_Leather`, çöp kutusu `Sphere_1`/`Object_5`, bej koltuk `BEIGE_SOFA_MESH`, saksı, sarmaşık) ilgili GLB'de durmalı; model sıkıştırma/yeniden dışa aktarma bunu bozamaz (#297).

Ölçüm sonuçları ve sıradaki işler: `kyrox-platform/projects/fair-stand/PERFORMANCE_ROADMAP.md` § 1.1 ve P0.

## 2026-10-01 — Floor Split V1

Stand zemini modül değildir. Baz kaplama `stand.itemKey` olarak kalır. `stand.floorColor` yalnız baz renktir.

İsteğe bağlı tek override `stand.floorArea`: `{ xCm, yCm, widthCm, depthCm, itemKey, color }`. Dizi değildir. Alan yoksa standın tamamı baz kaplamadır; delik değildir. `archiveVersion` 1 kalır. Eski kayıt `floorArea` taşımıyorsa açılır.

Izgara `STAND_DIMENSION_STEP_CM` (50). Yazılan ölçü ızgara dışıysa reddedilir ve önceki değer kalır. Sürükleyerek çizim `snapCm` ile ızgaraya oturur. Dikdörtgen standın içinde kalır. Aynı anda bir override vardır.

Boyanabilir override rengi `floorArea.color` alanındadır. Parke boyanamaz; renk yazılmaz.

BOM: `floorArea` yoksa veya override `itemKey` baz ile aynıysa eski tam-stand formülü (`resolveFloorBomLine`). m² = x × y / 10000. Karolaj adet = `ceil(x / karoW) × ceil(y / karoD)`. Örnek: 550 × 400 karolaj, alan yok = 24 adet.

Override farklı Item ise `resolveSplitFloorBomLines`. m² baz = (stand alanı − override alanı) / 10000. Karolaj, 50 × 50 hücre havuzundan 100 × 100 karo sayar (`ceil(hücre / 4)`). Örnek: 500 × 500 halı + 200 × 300 karolaj = 19 m² halı + 6 adet karolaj.

Sahne: `activeFloor` tüm stand platformudur. `getGroundPoint` yalnız onu ışınlar. Override ince bir mesh’tir. Sahneyi Sıfırla kurulumu yeniden kurar; `floorArea` düşer.

Kod: `src/floorArea.js`, `src/projectBom.js`, `src/scene3d.js`, `src/main.js`, `src/projectImportValidation.js`. Sözleşme: `docs/items/contract/ITEM_CONTRACT.md`.

Aynı commit: editör başlığı `Maxima Konfigüratörü`. `FAIR STAND / PROTOTİP` satırı kalktı.

---

## 2026-09-24 — Performans yol haritası (belge only)

Prod gözlem: proje açma 5–10 sn; orbit/sürükleme takılması. Kök neden ve P0–P4 iş paketleri `PERFORMANCE_ROADMAP.md` içinde; kod değişikliği yok.

---

## 2026-09-24 — Tip davranışı DB (kesit 1–3 + overlap FK) + belge senkron

Kod (merged): migration `0030`–`0033`; seed `item_type_behavior_seed.py`; motor DB-only (`moduleBehavior.js` + `KNOWN_BEHAVIOR_TYPE_KEYS` fail-fast); CRM Item Type form + overlap multi-select. JS `TYPE_BEHAVIORS` map yok.

Belgeler güncellendi (silinmedi): `DATABASE.md`, `FAIR_STAND_DB_KULLANIM_KILAVUZU.md`, `TYPE_BEHAVIORS_DB_ROADMAP.md` (arşiv), `PENDING` C.3 KAPANDI, `README.md`, `STAND_DIMENSIONS.md`, `ITEMS.md`, `ITEM_FIRST_ROADMAP.md`, `MODULE_BEHAVIOR_STANDARD.md`. `docs/items/**` tarihsel audit — regenerate edilmeden dokunulmadı.

Aynı dilim (devam): `0034_stand_panel_rail_height` (`panel_rail_height_cm` → CRM + `STAND_DIMENSIONS.panelRailHeight`); strip sessiz clamp kalktı (BOM qty otorite); `MODULE_CONTRACT_ASSIGNMENTS` per-SKU silindi → tip’ten türet; `scene3d` `panel-seam` → `requires: 'shelf-rail'`.

---

## 2026-09-23 — Stand `frame_*` kolonları geri (5,5×10)

Migration `0023_restore_stand_frame_columns`. Bootstrap/admin/CRM + `resolveProceduralFrameCrossSectionCm` stand `frameWidthCm`/`frameDepthCm` okur. Leaf 8×8 BOM görsel kaynağı değil (şimdilik). Belge: `STAND_FRAME_REMOVAL.md`.

---

## 2026-09-23 — TEMP: prosedürel frame 5,5×10 cm

*(Superseeded by `0023` DB restore — aynı gün.)* Leaf upright/profile 8×8 BOM kesiti sahnede kalın durduğu için önce kod sabiti, sonra stand kolonları geri alındı.

---

## 2026-09-23 — Item-first yol haritası (karar)

Ürün kararı yazıldı: leaf Item → registry → recipe parent → rotate/defaultZ → capability snap (`provides`/`requires`, örn. projetör ↔ profile `top-rail`). Snap SKU’ya değil aile/capability’ye. Admin parametrik Three.js preview P5 (ertelendi; bugün CSS siluet).

Belge: `docs/refactor/ITEM_FIRST_ROADMAP.md`. `SCENE_POSE.md` snap hedefi ile hizalanacak.

Aynı gün: **Gap / çatışma** notu eklendi — mevcut `snap_target_item_type` vs capability; wall recipe→AABB host; raf `panel-seam` vs panel **front** lokal üst (`shelf-rail`); P0’da A/B kilidi zorunlu. Raf görsel kuralı: N panel → N yatay hat, wall tavanı değil.

**P0 kilitlendi:** `fair_stand_item_type` + rule_type + rule; item Type (key FK) + requires|provides rule FK; kural ↔ tip M:N; motor rule id; CRM CRUD. Aile kaldırıldı (`0029`). Capability string kolon / type map iptal.

## 2026-09-23 — Snap tip/kural tabloları

Migration `0024_item_snap_capability`: ilk snap kataloğu (sonra aile→tip). Runtime rule id eşler. CRM tip/kural tipi/kural sayfaları + item Type select.

Sonra: `0025_drop_rule_sort_index` (kural `sort_index` kalktı; liste `display_name`). `0026_snap_code_to_key` (`code` → `key`; CRM label Key; ad’dan slug). Face/edge CRM’de enum select + hint. `0027` mount_mode drop.

Sanal hat ince ayarı (`itemSnap.js`): recipe host’ta `top-rail` → profile `defaultZCm+height`; `shelf-rail` → panel band seam (AABB tavan değil).

`0028_rule_family_link` → `0029_item_type_catalog`: aile kalktı; `fair_stand_item_type` + `items.item_type` FK + `fair_stand_rule_item_type` M:N. Seed: `top-rail`→profile, `shelf-rail`→panel+separator-panel. CRM kural formunda **çoklu tip** seçimi.

---

## 2026-09-22 — Duvar zinciri: `edgeWidthCm` / `wallWidthCm`

Item `lengthCm` kalktıktan sonra duvar otomasyonundaki eski `lengthCm` adları netleştirildi:

- Segment kapasitesi: `segment.edgeWidthCm` (`wallReflow.js`, `moduleMove.js`).
- Düz / otomatik duvar girdisi: `wallWidthCm` (`wall.js` `validateWallWidth` / `composeStraightWall`, `automaticWall.js`, `main.js`, `featureContracts.js`).
- Modül duvar boyunca ölçüsü: `widthCm` (değişmedi).

Sözleşme: `docs/refactor/STAND_DIMENSIONS.md` (Duvar zinciri genişlik adları).

---

## 2026-09-22 — Item dimensions: legacy BOM kolonları kaldırıldı

- Migration `0021_drop_item_length_thickness`: `fair_stand_item_dimensions` üzerinde `length_cm`, `thickness_cm` yok.
- Önce `0020_item_dims_wh_d_fill` (tarihsel; legacy → W/H/D, fill-only).
- Runtime/seed/API: yalnız `widthCm`, `depthCm`, `heightCm` (+ `mountHeightCm`, `wallGapCm`). Helper modüller (`dimension_normalize`, `dimensionNormalize.js`) kaldırıldı.
- `resolveSceneDimensions` cross-remap yapmaz; same-field merge.
- Detay: `docs/refactor/ITEM_DIMENSIONS.md`, `ITEMS.md`.

---

## 2026-09-22 — Item dimensions W/H/D backfill (veri koruyucu, tarihsel)

- Migration `0020_item_dims_wh_d_fill` (0021 öncesi DB’ler).
- `resolveSceneDimensions` cross-remap yapmaz.

---

## 2026-09-22 — `fair_stand_dimensions` strip kolonları kaldırıldı

Migration `0019_drop_stand_strip_grid`: `strip_count`, `strip_height_cm` silindi. Bootstrap/admin yalnız `heightCm`, `depthCm`, `frameWidthCm`, `frameDepthCm`. Panel pitch: `WALL_PANEL_BAND_PITCH_CM`.

---

## 2026-09-22 — Stand zarfı cm + runtime şerit grid’den kopma (başlangıç)

- DB/API/bootstrap: `fair_stand_dimensions` uzunluk kolonları cm (`0018_stand_dimensions_cm`); JSON `heightCm`, …; admin PUT `height_cm`, …
- Runtime yerleşim pitch: `WALL_PANEL_BAND_PITCH_CM` (`src/wallPanelBand.js`, 50 cm ürün sabiti). `STAND_DIMENSIONS.stripCount` / `.stripHeight` artık `src/` içinde okunmuyor.
- Panel adedi: recipe BOM + item tavanı; seam/snap host modül `strips[]` + `heightCm`; vitrin `strips[]` BOM’dan.

---

## 2026-09-22 — PENDING § A adım 1: ölü occupancy layout

Kaldırıldı: `resolveOccupiedStripLayout` (`scene3d.js`), `getOccupiedStripLayout`, `getStripOccupancyHeightRangeCm` (`stripOccupancy.js`). Canlı yol durur: `normalizeStripOccupancy`, `resolveModuleStripOccupancy`, ghost key, katalog preview.

---

## 2026-09-22 — PENDING § A adım 1 (devam): flat-panel strip slot sayısı BOM’dan

`countRecipeWallPanelSlots` (`items.js`): recipe `composition.items` içinde `panel` / `separator-panel` adetlerini toplar. `createFlatPanelModuleState` önce bunu kullanır; yoksa `scene_dimensions.height_cm` ÷ stand şerit pitch fallback. Recipe panel sayısı kullanıldığında şerit sayısı `min(BOM panel adedi, floor(item heightCm ÷ strip pitch))`; modül yüksekliği `min(şerit × pitch, item heightCm)` — DB tavan (`scene/dimensions height_cm`) aşılmaz. Showcase, kapı, seed SKU bölme ve `strips[]` migration hâlâ backlog (`PENDING_ITEM_DECISIONS.md` § A).

---

## 2026-09-22 — `composition.moduleType` veri temizliği (B.7)

DB kolonu zaten migration `0014_drop_comp_mod_type`. Bootstrap JSON yalnız `composition.mode` + `composition.items` taşır; `composition_module_type` dump + test fixture’dan silindi. L banko kimliği `item.shape`. Detay: `REFACTOR.md` 2026-09-20 inner-corner maddesi ile uyumlu.

---

## 2026-09-22 — Proje SoT (server + disk)

`fair_stand_projects` (JSONB `payload`) + `fair_stand_project_assets` (meta) + disk `{org}/{project}/{asset}.webp`. IndexedDB / `projectStore` önbellek; `projectRemote.js` cache-first + dirty asset sync. Org-scoped Core izinleri: `fair_crm.fair_stand.projects.*`. Eski local-only IDB migrate edilmez. Canonical tablo envanteri: `docs/refactor/DATABASE.md`.

---

## 2026-09-21 — Archive buton görünürlüğü

`fair_stand_settings.export_button_visible` / `import_button_visible`. Catalog bootstrap. Markup `hidden`; runtime ayar `true` ise açar. Canonical: `docs/refactor/DATABASE.md`.

---

## 2026-09-21 — DB tablo/kolon envanteri

Canonical: `docs/refactor/DATABASE.md`. 13 tablo; her kolon nedir / neden / nerede. Çapraz: `models.py` + `item_mapper.py` + production `src/` + `ITEMS.md` / `CATALOG.md` / `ROTATION.md` / `SCENE_POSE.md` / `STAND_DIMENSIONS.md`. Production okumayan kolonlar (kullanılmayan asset rolleri) açık yazılır. Değer kopyası değil.

---

## 2026-09-22 — `connector_type` kaldırıldı

`fair_stand_items.connector_type` / JSON `connectorType` silindi (migration `0016_drop_connector_type`). TEST_ONLY `getConnectorItemKey` / `resolveConnectorBom` ve `test/connectorBom.test.js` de kalktı (katalog kolonunu okumuyorlardı; sabit map). Production BOM zaten `composition.items[].itemKey` (`connector_start` vb.). Dört connector Item kimliği durur.

---

## 2026-09-22 — `panel_role` kaldırıldı

`fair_stand_items.panel_role` / JSON `panelRole` silindi (migration `0015_drop_panel_role`). Eski inner-corner BOM swap etiketiydi; production `src/` okumuyordu. Seed, mapper, admin UI, contract assert’leri temizlendi. `panel_corner_*` Item kimlikleri durur.

---

## 2026-09-21 — Item rotation DB

`rotationStepDeg`, `defaultRotationDeg`, `sideInsertRotation` Item kolonları. Canonical: `docs/refactor/ROTATION.md`. `TYPE_BEHAVIORS` ve banko width/shape rotation ezmesi kalktı.

---

## 2026-09-20 — Stand zarfı `fair_stand_dimensions`

JS sabiti kalktı. Canonical: `docs/refactor/STAND_DIMENSIONS.md`.

---

## 2026-09-20 — Legacy inner-corner + nominalModuleWidthCm kaldırıldı

`nominalModuleWidthCm` / `nominal_module_width_cm` runtime, seed, API ve DB kolonundan silindi. `composition.innerCorner`, `panelVariant: 'inner-corner'` ve inner-corner replacement tabloları kaldırıldı. `expandRecipe` yalnız `composition.items` döner. Eski bootstrap payload’da bu alanlar görülürse registry onları düşürür; BOM değişmez.

Korunan: 96 `itemKey`, `panel_corner_*` Item kayıtları, fiziksel `dimensions` / `sceneDimensions`, normal `wall_200` → `panel_197` × 7. Yeni köşe-duyarlı BOM eklenmedi.

---

## 2026-09-17 — Kapı kanadı width helper kalktı

### Kapsam

`DOOR_LEAF_ITEM_KEYS_BY_MODULE_WIDTH` ve `getDoorLeafItem` silindi. Factory ve `normalizeModuleItemState` kapı kanadını `getItem('door_leaf_100')` ile çözer. Tek kapı `door_100`; 100 dışı `createDoorModuleState` zaten `null`. `surface.itemKey` aynı `door_leaf_100`.

Dokunulmayan: `door_100` / `door_leaf_100` satırları, BOM miktarları, persist schema, renderer `getItem(surface.itemKey)`.

---

## 2026-09-20 — İç-köşe expand ölçü kullanmaz

`expandRecipe` inner-corner’da `nominalModuleWidthCm` okumaz. Inner yoksa (`composition.innerCorner` / `panelItemKey` yok) düz reçete döner, throw yok. Inner varsa reçetedeki tek `panelRole=straight` satırı `innerCorner.panelItemKey` ile değişir; ek satırlar `itemReplacements`.

Dokunulmayan: `composition.items` miktarları, `innerCorner.panelItemKey` değerleri, Item kaydındaki `nominalModuleWidthCm` alanı.

---

## 2026-09-17 — Düz child listesi ve iç-köşe Item’da

### Kapsam

Düz BOM child listesi ve iç-köşe verisi tek kaynak `src/items.js`. `moduleRecipes.js` ikinci ürün tablosu değil; yalnız `expandRecipe` / panelRole eşlemesi kalır. `itemBom` `getItem(parent).composition.items` zorunlu; `catalogRecipe.items` fallback yok.

28 recipe parent `composition.items` (miktar değişmedi). İç-köşe `composition.innerCorner` (recipe.variants birebir): düz wall 50/100/150/200, short-up-1/2 aynı genişlikte aynı köşe paneli, `door_100` / `wall_showcase_100_2` / `wall_showcase_100_3` (`panel_corner_92` + `itemReplacements`). BASE, desk_banko, separator: innerCorner yok.

Raw BOM debug kapı dışındaki type+width yolları `resolveItemBom(itemKey)`. Furniture kümeleri BOM’a açılmaz. `getStraightWallNominalWidthForProfileItem` silindi (src caller yoktu).

Dokunulmayan: Catalog projection, factory/UI, persist `itemKey`, 28 düz listedeki quantity’ler, `composition.mode` / `moduleType` sadeleştirme, VIDEO_WALL, shelf/base-wall recipe (zaten null).

---

## 2026-09-17 — Recipe parent `composition.items`

### Kapsam

28 `composition.mode === 'recipe'` parent, `furniture_sofa_set_classic` gibi `composition.items` taşır. Satırlar mevcut `moduleRecipes` child listesinin kopyasıdır; miktar uydurulmadı. `itemBom` tabanı Item `items`; `expandRecipe` iç-köşe panel/connector varyantını uygular.

Dokunulmayan: 96 `itemKey`, Catalog projection, factory/UI, inner-corner kuralları, `moduleRecipes.js` sahipliği (nominal genişlik / varyant).

---

## 2026-09-17 — Kovalar boşaldı; satırlar ITEMS içinde

### Kapsam

`LEAF_ITEMS` … `COMPOSITE_ITEMS` yok. 96 satır `export const ITEMS` bloğunda. `getItem` / `listFloorItems` / type helper’lar `ITEMS` okur.

Dokunulmayan: 96 Item satırı, Catalog projection, recipe/BOM miktarları, factory/UI davranışı.

---

## 2026-09-17 — Tek ITEMS registry

### Kapsam

Dokuz kova (`LEAF_ITEMS` … `COMPOSITE_ITEMS`) public export değil. Tek tablo `ITEMS`. `getItem` / `listRegisteredItems` bu tablodan okur. `listLeafItems` / `listCompositeItems` kalktı. Testler `getItem` / `listRegisteredItems` / `EXPECTED` key listeleri.

Dokunulmayan: 96 Item satırı, Catalog projection, recipe/BOM miktarları, factory/UI davranışı.

---

## 2026-09-17 — ITEMS.md runtime field kuyruğu

### Kapsam

`docs/refactor/ITEMS.md` en üstüne `src/items.js` 96 satır taraması kondu. Tablo onaylı şema değil; alanlar zamanla ayrı kararla şemaya alınacak. Item satırları ve runtime kod değişmedi.

Dokunulmayan: `src/items.js`, Catalog, recipe/BOM, factory.

---

## 2026-09-17 — Catalog kartı ince projection

### Kapsam

`getCatalogItem` / `listCatalogItems` yalnız `{ itemKey, label, catalogPreview }` döner. Factory DTO Catalog’da yoktur. `createModuleStateFromDescriptor` Item’ı `resolveItemKey` + `getItem` ile çözer; sahne ölçüleri `resolveSceneDimensions`. Catalog preview silüeti `moduleDragSidebar.js` içinde Item’dan hydrate edilir.

Dokunulmayan: `CATALOG_CATEGORIES`, `CATALOG_PREVIEWS` allowlist, 58 üye ve kategori sırası, Item satırları, recipe/BOM, `STAND_DIMENSIONS` / `MODULE_WIDTHS_CM`.

---

## 2026-09-17 — MODULE_CATALOG snapshot export kalktı

### Kapsam

`MODULE_CATALOG` / `MODULE_CATALOG_KEYS` / `MODULE_CATALOG_GROUPS` `src/catalog.js` export değil. Testler `getCatalogItem` / `listCatalogItems` / `listCatalogGroups`. Kart içeriği, 58 üye ve kategori sırası değişmedi.

Dokunulmayan: Catalog projection gövdesi, `getModuleCatalogItem` / `getModuleCatalogLabel`, Item satırları, recipe/BOM, UI.

---

## 2026-09-17 — MODULE_WIDTHS_CM catalog.js’ten çıktı

### Kapsam

Düz duvar compose genişlikleri `src/standDimensions.js` `MODULE_WIDTHS_CM`. `STAND_DIMENSIONS` objesine gömülmedi. Caller: `wall.js` `composeStraightWall`, `standStandardsCopy.js`. `src/catalog.js` export etmez.

Değerler aynı: `[50, 100, 150, 200]` (cm).

Dokunulmayan: Catalog projection API, `STAND_DIMENSIONS` değerleri, Item satırları, recipe/BOM, `validateWallLength` hardcoded 50, `designState` persist alanları.

---

## 2026-09-17 — resolveItemKey Catalog re-export kalktı

### Kapsam

`resolveItemKey` yalnız `src/items.js`. `src/catalog.js` `export { resolveItemKey }` yok. `designState.js` / `main.js` ve testler `items.js`’ten okur. Fonksiyon gövdesi değişmedi.

Dokunulmayan: Catalog projection, `MODULE_WIDTHS_CM`, `STAND_DIMENSIONS`, Item satırları, recipe/BOM, `designState` persist alanları.

---

## 2026-09-17 — STAND_DIMENSIONS catalog.js’ten çıktı

### Kapsam

Stand zarfı sabiti `src/standDimensions.js`. Caller’lar oradan okur. `src/catalog.js` `STAND_DIMENSIONS` export etmez.

Değerler aynı: height 3.5, depth 0.1, stripCount 7, stripHeight 0.5, frameWidth 0.055, frameDepth 0.1 (metre).

Dokunulmayan: Catalog projection API, `MODULE_WIDTHS_CM`, Item satırları, `designState` `STRIP_COUNT = 7`.

---

## 2026-09-17 — catalog.js ölü ölçü alias’ları

### Kapsam

`src/catalog.js` içindeki Item ölçü kopyaları ve çağrılmayan `flatPanelKey` silindi. Catalog projection API değişmedi.

Dokunulmayan: `CATALOG_CATEGORIES`, `CATALOG_PREVIEWS`, `getCatalogItem` / `listCatalogItems` / `listCatalogGroups`, `MODULE_CATALOG*`, `STAND_DIMENSIONS`, `MODULE_WIDTHS_CM`, `resolveItemKey` re-export, Item satırları, recipe/BOM, UI.

### Silinen

- `COUNTER_DIMENSIONS`, furniture `*_DIMENSIONS`, `MINI_FRIDGE_DIMENSIONS`, `COAT_RACK_DIMENSIONS`, `PLASTIC_TRASH_BIN_DIMENSIONS`, `TV_42_DIMENSIONS`, `flatPanelKey`, `getFurnitureClusterQuantity` catalog import
- `BASE_DIMENSIONS`, `LED_FLOODLIGHT_DIMENSIONS`, `SHELF_DIMENSIONS` (testler `getItem`)

### Düzeltme

2026-09-16 kaydı `createShelfModule` için `SHELF_DIMENSIONS.heightsByCountCm[2]` yazıyordu; renderer Item `dimensions` okur. Export yok.

Sözleşme: `docs/refactor/CATALOG.md` — `src/catalog.js` dosya sınırı.

---

## 2026-09-17 — leaf shelf Catalog + panel-seam overlay

### Kapsam

Mevcut leaf Item `shelf_100` / `shelf_150` / `shelf_200` Catalog’da `shelf-showcase` (Raf & Vitrin) altında görünür. Sahnede tek fiziksel raf tahtasıdır. Duvar/panel overlay attachment; Z snap panel internal seam.

Geri getirilmeyen: `wall_shelf_*` composite Item, yeni wall_shelf parent, `SHELF_WIDTH_TO_ITEM_KEY`, `lengthCm→widthCm` cross-field fallback.

Dokunulmayan: `wall_showcase_100_2` / `wall_showcase_100_3`, `glass_shelf`, vitrin recipe/BOM, shelf lighting mekanizması (korundu).

### Davranış

- `sceneDimensions.widthCm` 100/150/200; `heightCm=1.8`; `depthCm` fiziksel 38
- `MODULE_STATE_FACTORIES.shelf` exact `itemKey`
- Tip davranışı (tarihsel `TYPE_BEHAVIORS.shelf`; şimdi DB): `placement=wall-overlay`, `wallCapacity=exclude` — `overlaySnap` tip alanında yok; seam → kural `shelf-rail` / `usesPanelSeamOverlaySnap`
- Geçerli seam: `getStandInternalSeamHeightsCm()` = strip index 1..stripCount-1 (50..300). 0 ve 350 yok.
- Raf alt yüzeyi seam’de; overlay merkez = seam + thickness/2
- Identity: exact `itemKey` → `getItem`; type/width/shelfCount tahmini yok
- Yatay: wall-overlay pointer placement; raf sığdığı wall/panel support span içinde kalır (`shelf.widthCm <= host.widthCm`); host başlangıcına zorlanmaz
- Drop yalnız geçerli seam’de

### Sayılar

kayıtlı Item 96; catalogVisible=true 58; gizli 38 (`VIDEO_WALL_PANEL` dahil); projection 58; COMPOSITE_ITEMS 28; BOM recipe 28; self BOM 12; shelf-showcase 5.

---

## 2026-09-16 — wall_base composite Item kaldırıldı

### Kapsam

Silinen Item: `wall_base_100`, `wall_base_150`, `wall_base_200` (Panel Bazalı 100 / 150 / 200).

Dokunulmayan: `base_100` / `base_150` / `base_200`, leaf `base_top_107_50` / `base_top_157_50` / `base_top_206_50`, `profile_*` / `upright_*` / `panel_*` / `connector_*`, shelf tarafı, genel `base-wall` type/renderer/preview.

### Dead code (yalnız bu 3 Item’a hizmet ediyordu)

- `WALL_BASE_WIDTH_TO_ITEM_KEY`, `resolveBaseWallItemKey`, `createBaseWallModuleState`, `MODULE_STATE_FACTORIES['base-wall']`, `normalizeModuleItemState` type `base-wall` dalı
- `base-wall:100` / `base-wall:150` / `base-wall:200` recipe
- üç `MODULE_CONTRACT_ASSIGNMENTS` kaydı
- `rawBomDebug` Panel Bazalı recipe dalı

### Kalan base-wall mekanizması

- Tip `base-wall` davranışı DB’de (`fair_stand_item_type`; motor `getItemType` / `KNOWN_BEHAVIOR_TYPE_KEYS`) — tarihsel JS map satırı kalktı
- `createBaseWallModule` renderer + `scene3d` type dispatch
- Katalog silüet: `previewId` → bootstrap preview + `createModuleCatalogPreview` (CSS örn. `.module-drag-base-wall`)
- `selectionFeedback` type `base-wall` metni
- `usesWallBackboneCollisionDepth` (type-level, DB `collision_depth`)

### Sayılar

kayıtlı Item 96; catalogVisible=true 55; gizli 41 (`VIDEO_WALL_PANEL` dahil); projection 55; COMPOSITE_ITEMS 28; BOM recipe 28; panel-wall 9.

### Tarihsel audit

`docs/items/audit/**` ve `docs/items/current-system/wall_base_*.md` regenerate edilmedi.

---

## 2026-09-16 — wall_shelf composite Item ve shelfCount kaldırıldı

### Kapsam

Silinen Item: `wall_shelf_2_100`, `wall_shelf_2_150`, `wall_shelf_2_200`, `wall_shelf_3_100`, `wall_shelf_3_150`, `wall_shelf_3_200`.

Silinen alan: `shelfCount` (Item, composition.options, Catalog projection, identity, factory, recipe, renderer userData). Yerine yeni field veya duplicate metadata yazılmadı. Yeni wall_shelf Item üretilmedi.

Dokunulmayan: leaf `shelf_100` / `shelf_150` / `shelf_200`, `wall_showcase_*`, `eyeCount`, `stripOccupancy`, `nominalModuleWidthCm`, `composition.moduleType` alanı, `Recipe.nominalWidthCm`, `sceneDimensions`/`dimensions` şeması.

### Dead code (yalnız bu 6 Item’a hizmet ediyordu)

- `isWallShelfCompositeItem`, `resolveShelfItemKey`, `createShelfModuleState`, `MODULE_STATE_FACTORIES.shelf`, `normalizeModuleItemState` shelf dalı
- altı `shelf:{width}:{count}` recipe + `getModuleRecipe` shelf dalı
- `rawBomDebug` “N raflı” recipe dalı

### Kalan shelf mekanizması

- leaf `shelf_*` + `getItem(itemKey)`
- `createShelfModule` renderer (Item `dimensions`; `SHELF_DIMENSIONS` yok)
- Tip `shelf` davranışı DB’de (`placement` / `wallCapacity` vb.; tarihsel `TYPE_BEHAVIORS.shelf` kalktı)
- Katalog silüet: Item `previewId` → `createModuleCatalogPreview` (string `catalogPreview: 'shelf'` / eski renderer map yok)
- context-menu `toggle-shelf-light` / `shelfLightingOn`

### Sayılar

kayıtlı Item 99; catalogVisible=true 58; gizli 41 (`VIDEO_WALL_PANEL` dahil); projection 58; COMPOSITE_ITEMS 31; BOM recipe 31; shelf-showcase 2.

### Tarihsel audit

`docs/items/audit/**` ve `docs/items/current-system/wall_shelf_*.md` regenerate edilmedi.

---

## 2026-09-16 — Tekrarlayan özel ölçü alanlarının canonical dimensions’a indirgenmesi

### Kaldırılan Item alanları

| Eski alan | Yeni kaynak |
|---|---|
| `dimensions.screenWidthCm` | `dimensions.widthCm` |
| `dimensions.screenHeightCm` | `dimensions.heightCm` |
| `dimensions.catalogHeightCm` | Catalog/runtime `resolveSceneDimensions(item).heightCm`; yeni field yok. TV kart CSS (`module-drag-tv`) değişmedi |
| `dimensions.tableDiameterCm` | `dimensions.widthCm` |
| `videoWall.panelScreenWidthCm` | `VIDEO_WALL_PANEL.dimensions.widthCm` |
| `videoWall.panelScreenHeightCm` | `VIDEO_WALL_PANEL.dimensions.heightCm` |
| `sizeInch` | kimlik `itemKey` (`TV_42` / `TV_55` / `TV_65`); görünen ad `TV 42"` / `TV 55"` / `TV 65"` |
| `composition.nominalWidthCm` | `item.dimensions.widthCm` (`itemBom.resolveRecipe` recipe lookup) |

### Yeni Item

`VIDEO_WALL_PANEL` — `catalogVisible: false`, `name: Video Wall Panel`, `dimensions.widthCm: 108.5`, `dimensions.heightCm: 61`. `depthCm` mevcut kaynakta yok; yazılmadı. `VIDEO_WALL_2X2` / `VIDEO_WALL_3X3` `videoWall.panelItemKey: 'VIDEO_WALL_PANEL'` ile paneli okur. `rows` / `cols` kaldı.

### Dokunulmayanlar

`mountHeightCm`, `wallGapCm`, `nominalModuleWidthCm`, `composition.moduleType`, `Recipe.nominalWidthCm`, `videoWall.rows` / `videoWall.cols`, `sceneDimensions` şeması.

### Doğrulama

- kayıtlı Item 105; catalogVisible=true 64; gizli 41 (`VIDEO_WALL_PANEL` dahil)
- `test/canonicalDimensionDedup.test.js` src runtime eski field yasakları + `wall_200` BOM `dimensions.widthCm`
- `npm test`: 776 pass / 0 fail
- `npm run build`: geçti
- `CHANGE_GATE_BASE=origin/RefactorItem npm run contract:verify`: geçti (`canonical-dimension-dedup`)
- targeted E2E: `e2e/wall-media-items-contract.spec.mjs`, `e2e/furniture-items-contract.spec.mjs`, `e2e/smoke.spec.mjs`, `e2e/wall-flat-panel-items-contract.spec.mjs` — 22 passed

---

## 2026-09-16 — Item physical dimensions ve sceneDimensions override ayrımı

### Neden yapıldı

Item ölçüleri dağınıktı. Profil sahne genişliği Recipe `nominalWidthCm` ve `catalogWidthCm` üzerinden okunuyordu. Dikme oturumu thickness→width/depth, length→height çapraz remap ile üretiliyordu. Catalog kendi footprint’ini bar-stock kuralıyla yazıyordu.

### Yeni kural

Her Item kendi ölçü bilgisinin canonical kaynağıdır. İki katman, aynı field seti:

```text
dimensions        = gerçek/fiziksel ürün ölçüleri
sceneDimensions   = scene/runtime override

canonical fields: widthCm, depthCm, heightCm (+ mountHeightCm, wallGapCm)

effective scene field:
  sceneDimensions.field ?? dimensions.field ?? MISSING
```

Aynı field adı yoksa fallback yoktur. (Eski `lengthCm` / `thicknessCm` BOM alanları 0021 ile kaldırıldı.) Duvar zinciri: `edgeWidthCm`, `wallWidthCm` — Item alanı değil.

### Kaldırılan kaynaklar

- `catalogWidthCm` (dört profil Item’ından silindi)
- `createProfileModuleState` / `normalizeModuleItemState` / `createProfileModule` → `getStraightWallNominalWidthForProfileItem`
- Catalog `assignCatalogFootprint` bar-stock remap ve `catalogWidthCm`
- `getItemIdentityFields` `catalogWidthCm` ve thickness/length remap

### Yazılan sceneDimensions (mevcut runtime davranışına göre)

- dört profil: `{ widthCm: 50|100|150|200, depthCm: 8, heightCm: 350 }`
- `upright_346_5`: `{ widthCm: 8, depthCm: 8, heightCm: 346.5 }` — renderer 10×10×350 görsel zarfı ayrı kavramdır
- tam boy wall/separator/shelf/showcase/door: `{ depthCm: 10, heightCm: 350 }` (width physical’dan)
- short_up: `{ depthCm: 10 }` — height occupancy’dedir, 350 yazılmaz
- TV: `{ heightCm: screenHeightCm }`; video wall: `{ widthCm, heightCm }` panel × ızgara
- `wall_base_*` physical  width×50×350 ile aynı; sceneDimensions yazılmadı

### Canonical method

`resolveSceneDimensions(item)` — consumer’lar ayrı fallback yazmaz.

### Bilinçli sınırlar / LEGACY

- Özel physical alanlar (`screenWidthCm`, `catalogHeightCm`, `mountHeightCm`, `tableDiameterCm`, `wallGapCm`) bu turda 5 alana zorla taşınmadı
- TV Catalog kart yüksekliği UI-only `catalogHeightCm=350` (media metrics); runtime scene height ekrandır
- Ghost numeric-width yolu ve Item scene height MISSING (short_up occupancy) STAND zarfına düşebilir — Item-specific SOT değildir
- `MODULE_COLLISION_DEPTH_CM` wall_base omurga ve genel stand standardı olarak kalır
- 6 Item physical dimensions eksik: `connector_start`, `connector_single`, `connector_double`, `connector_corner`, `shelf_leg`, `hali` — tahmin yazılmadı

### Doğrulama

- kayıtlı Item 104; catalogVisible=true 64; projection 64
- physical `dimensions` 98; `sceneDimensions` 35; MISSING_PHYSICAL 6
- `test/itemSceneDimensions.test.js` same-field / cross-remap / catalogWidthCm / Recipe yasakları
- targeted dimension + catalog + profile/upright/shelf contract testleri: geçti
- `npm test`: 775 pass / 0 fail
- `npm run build`: geçti
- `CHANGE_GATE_BASE=origin/RefactorItem npm run contract:verify`: geçti (`catalog-item-projection`)
- targeted E2E `e2e/smoke.spec.mjs`: geçti

### Sonraki adım

Rotation / color / image / lighting / delete / global `type` kaldırma / SQLite / BOM composition redesign / Catalog preview redesign / renderer architecture bu turda yok.

---

## 2026-09-16 — Catalog preview seçiminin type’tan Item config’e taşınması

### Eski yapı

`createModuleCatalogPreview()` Catalog kart silüetini `module.type` zinciriyle seçiyordu:

- `if (module.type === 'shelf' | sofa-set-classic | sofa-single-classic | sofa-double-classic | coffee-table-classic | table-chair-set-eames | chair | table-glass | bar-stool | mini-fridge | coat-rack | plastic-trash-bin | indoor-plant-1 | kettle | tv | led-floodlight | upright | profile | base-wall | base | counter | separator | door | showcase-2 | showcase-3)`
- `indoor-plant-1` + `modelFile` regex → long planter
- `separator` + `modelFile` → vine CSS
- `tv` + `videoWallRows/Cols` → video-wall CSS
- `showcase-2` / `showcase-3` → `dataset.eyes`
- eşleşmeyen her şey → flat-panel (sessiz type fallback)

Catalog UI “type neymiş?” diye kart tipi, ikon ve CSS kararı veriyordu.

### Yeni yapı

64 görünür Item’a `catalogPreview` yazıldı. Renderer map:

```text
CATALOG_PREVIEW_RENDERERS[item.catalogPreview]
```

*(Sonraki dilim: string `catalogPreview` → integer `previewId` + DB bootstrap preview; JS `CATALOG_PREVIEW_RENDERERS` map kalktı — `createModuleCatalogPreview` / `getCatalogPreview`.)*

Item kendi Catalog görünümünü tarif eder. Catalog yalnız okur ve gösterir.

Güncellenen Item: **64 / 64** görünür. Gizli 40 Item’da `catalogPreview` alanı yok.

Dağılım: `flat-panel` 12, `counter` 6, `shelf` 6, `profile` 4, `tv` 3, `base` 3, `base-wall` 3, `long-planter` 3, `video-wall` 2, `separator` 2, `separator-vine` 2, `showcase` 2; kalan 16 key tek Item (`upright`, `door`, `kettle`, `coat-rack`, `mini-fridge`, `plastic-trash-bin`, `sofa-set`, `sofa-single`, `sofa-double`, `coffee-table`, `table-chair-set`, `chair`, `glass-table`, `bar-stool`, `indoor-plant`, `floodlight`).

### Kaldırılan fallback

- `type` → preview
- `type` → CSS class
- `itemKey` hardcode preview map
- registry group → preview
- görünür Item’da eksik `catalogPreview` için sessiz type fallback

`catalogVisible === true` ve `catalogPreview` yok/bilinmiyor → `getCatalogItem` / `listCatalogItems` fail-fast.

Projection `type` alanı `createModuleStateFromDescriptor` factory uyumu için durur; Catalog UI preview seçiminde kullanılmaz. Global `type` kaldırılmaz.

### Doğrulama

- kayıtlı Item 104; catalogVisible=true 64; projection 64
- 64/64 `catalogPreview` mevcut; gizli 40’ta alan yok
- `test/catalogPreviewConfig.test.js`: type branch yok; 64 kök CSS sınıf regression
- catalogItemProjection / catalogDomainBoundary / itemCatalogFields korundu
- targeted catalog + ilgili preview contract testleri: geçti
- `npm test`: 753 pass / 0 fail
- `npm run build`: geçti
- `CHANGE_GATE_BASE=origin/RefactorItem npm run contract:verify`: geçti (`catalog-item-projection`)
- targeted E2E `e2e/smoke.spec.mjs`: geçti
- GitHub CI `verify` (`b8ff36b`): geçti

### Sonraki adım

Rotation / color / image / lighting / delete / collision / placement / Item Contract mimari refactor / Recipe-BOM refactor / global `type` kaldırma / SQLite bu turda yok.

---

## 2026-09-16 — Catalog domain sınırının runtime mekanizmalarından ayrılması

### Neden yapıldı

Catalog, Item runtime repository’si haline gelmişti. AutoDepot ölçüleri `getCatalogItem` + `catalogVisible` üzerinden okunuyordu. ModuleContracts Item varlığını Catalog projection’a bağlıyordu. Catalog profil kart genişliğini Recipe’den öğreniyordu.

### Kaldırılan bağımlılıklar

- AutoDepot → Catalog: `getCatalogItem` / `MODULE_CATALOG` / `catalogVisible` kaldırıldı
- ModuleContracts → Catalog: `getCatalogItem` kaldırıldı; string `itemKey` `getItem` ile doğrulanır
- Catalog → Recipe: `getStraightWallNominalWidthForProfileItem` kaldırıldı

### Yeni veri kaynakları

- AutoDepot: `getItem('MINI_FRIDGE_AVANTI' | 'COAT_RACK' | 'KETTLE' | 'PLASTIC_TRASH_BIN')` → `item.dimensions.widthCm/depthCm/heightCm`
- ModuleContracts: `getItem(itemKey)` Item master varlığı; descriptor gelirse `resolveItemKey` (Item identity, Catalog üyeliği değil)
- `resolveItemKey` Catalog’dan `src/items.js` Item-domain helper’ına taşındı. `catalogVisible` kontrolü identity çözümlemesine girmez. Catalog re-export yoktur.

### Yeni Item alanı

`catalogWidthCm` — yalnız dört profil Item’ında:

- `profile_41_5` → 50
- `profile_91` → 100
- `profile_140_5` → 150
- `profile_190` → 200

Fiziksel `dimensions.lengthCm` değildir. Katalog kartı / serbest profil oturum genişliğidir. Recipe’den türetilmez.

### Dependency yönü

```text
Item → Catalog
Item → AutoDepot
Item → ModuleContract
Item → Recipe/BOM
```

Yasak: AutoDepot → Catalog, ModuleContract → Catalog, BOM → Catalog, Recipe → Catalog, Catalog → Recipe.

### Doğrulama

- kayıtlı Item 104; catalogVisible=true 64; projection 64
- hardcoded katalog Item key listesi: 0
- 64/64 catalog descriptor regression korundu
- `catalogVisible=false` ≠ Item runtime’da yok
- AutoDepot includeContents konum/ölçü regression’ı birebir
- architecture boundary: `test/catalogDomainBoundary.test.js`
- targeted: catalogItemProjection / catalogCategories / itemCatalogFields / catalogSingleSource / catalogDomainBoundary / autoDepotOrientation / tests/autoDepot — geçti
- `npm test`: 749 pass / 0 fail
- `npm run build`: geçti
- `CHANGE_GATE_BASE=origin/RefactorItem npm run contract:verify`: geçti (`catalog-item-projection`)
- targeted E2E `e2e/smoke.spec.mjs`: geçti
- GitHub CI `verify` (`efec8e1`): geçti

### Sonraki adım

Rotation / color / image / lighting / delete / collision / placement / Item Contract mimari refactor / Recipe-BOM refactor / registry temizliği / SQLite bu turda yok.

---

## 2026-09-16 — MODULE_CATALOG Item tekrarının kaldırılması

### Eski yapı

64 katalog kartı `src/catalog.js` içinde `MODULE_CATALOG` hardcoded key listesi + `create*CatalogItem` builder’ları ile ikinci kez tanımlanıyordu. Item kaydı varken kart descriptor’ı ayrı tutuluyordu.

### Kaldırılan duplicate kaynak

- `MODULE_CATALOG = { wall_200: createFlatPanelCatalogItem('wall_200'), ... }` literal 64 key
- `createFlatPanelCatalogItem`, `createUprightCatalogItem`, `createProfileCatalogItem`, `createShelfCatalogItem`, `createCounterCatalogItem`, `createBaseCatalogItem`, `createBaseWallCatalogItem`, `createSeparatorCatalogItem`, `createWallMediaCatalogItem`, `createTopLightCatalogItem`, `createCommercialCatalogItem`, `createIndoorPlantCatalogItem`, `createFurnitureCatalogItem`

### Yeni canonical method

- `getCatalogItem(itemKey)` — `catalogVisible=true` Item’dan catalog descriptor
- `listCatalogItems()` — görünür Item’lar, kategori `catalogIndex` + `catalogItemIndex` sırası
- `listCatalogGroups()` aynı üyelik alanlarını okur; UI `getCatalogItem` ile kart üretir

### Item’a taşınan gerçek alanlar

Yok. Descriptor alanları zaten Item’da duruyordu (`name`, `dimensions`, `modelFile`, `eyeCount`, `sizeInch`, `videoWall`, `stripOccupancy`, `shape`, `shelfCount`, `variant`, rotation metadata). Projection alias’ı Item’a kopyalanmadı (`label` = `name`; kök `widthCm` = `dimensions.widthCm` veya türetilmiş oturum).

Profil kart `widthCm` Item’da yoktur; düz duvar reçetesi `nominalWidthCm` türevidir. Dikme kesit `widthCm`/`depthCm` (8), boy `heightCm`. TV/video-wall `resolveWallMediaMetrics` türevidir.

### Compatibility export

`MODULE_CATALOG` / `MODULE_CATALOG_KEYS` / `MODULE_CATALOG_GROUPS` kaldı; hardcoded liste değildir, `listCatalogItems` / `listCatalogGroups` türevidir. Mevcut testler bu export’u okumaya devam eder.

### Doğrulama

- kayıtlı Item 104; catalogVisible=true 64; projection 64
- hardcoded katalog Item key listesi: 0
- 64/64 descriptor regression: itemKey/label/widthCm/depthCm/heightCm/type/modelFile/eyeCount/shelfCount/shape/variant/stripOccupancy/unit/TV alanları birebir
- kategori sayısı/sırası/adları/üye sayısı/Item sırası değişmedi
- `npm test`: 740 pass / 0 fail
- `npm run build`: geçti
- `CHANGE_GATE_BASE=origin/RefactorItem npm run contract:verify`: geçti (`catalog-item-projection`)
- targeted E2E `e2e/smoke.spec.mjs`: geçti

### Sonraki adım

SQLite/API yok. Rotation/color/image bu turda yok.

---

## 2026-09-16 — Catalog category modelinin merkezileştirilmesi

### Neden yapıldı

Modül Kataloğu kategori yapısı hardcoded `MODULE_CATALOG_GROUPS` (yalnız `label` + `keys`) olarak duruyordu. Kategori kimliği, UI adı ve yukarıdan aşağıya sıra ayrı canonical alanlar değildi. Item.catalogCategory key’leri vardı ama kategori tanımı merkezi Catalog modelinde açık değildi.

### Hangi eski yapı değişti

- Kaldırılan hardcoded kaynak: `src/catalog.js` içindeki `MODULE_CATALOG_GROUPS` literal listesi (`label` + `keys`)
- Kaldırılan ikinci hardcoded üyelik listesi: ayrı `MODULE_CATALOG_KEYS` literal dizisi
- Sidebar / picker artık `MODULE_CATALOG_GROUPS` sabitini okumaz; `listCatalogGroups()` ve `group.catalogName` okur

### Yeni alanlar

Catalog (canonical kaynak `CATALOG_CATEGORIES`):

- `catalogKey` — stabil kategori kimliği; Item.catalogCategory bu değere bağlanır
- `catalogName` — Modül Ekle panelindeki kategori adı
- `catalogIndex` — kategorilerin 1 tabanlı yukarıdan aşağıya sırası

Item bağlantısı değişmedi: `catalogVisible`, `catalogCategory` → `catalogKey`, `catalogItemIndex` (kategori içi sıra).

Yeni method’lar: `listCatalogCategories()`, `getCatalogCategory(catalogKey)`, `listCatalogGroups()`.

### Gerçek catalogKey’ler

Bu turda yeni key uydurulmadı. Key’ler önceki turda Item kayıtlarına yazılan `catalogCategory` değerleridir.

| catalogKey | catalogName | catalogIndex | Item sayısı |
|---|---|---|---|
| `panel-wall` | Panel & Duvar | 1 | 12 |
| `panel-addon` | Panel Ek Modül | 2 | 13 |
| `shelf-showcase` | Raf & Vitrin | 3 | 8 |
| `counter-base` | Banko & Baza | 4 | 9 |
| `extra` | Extra | 5 | 16 |
| `electronics-lighting` | Elektronik & Aydınlatma | 6 | 6 |

`MODULE_CATALOG_KEYS` artık `listCatalogGroups().flatMap(keys)` türevidir. Global snapshot sırası kategori sırasına hizalandı (eski literal KEYS listesinde raf/vitrin, `wall_base` / `door_100` satırlarından önce duruyordu). Modül Ekle UI kategori sırası, kategori adları ve kategori içi Item sırası değişmedi.

### Yeni kural

- Katalog yalnız UI organizasyonudur
- Kategori adı yalnız `catalogName`
- Kategori sırası yalnız `catalogIndex`
- `catalogCategory` yalnız `catalogKey` saklar; label saklamaz
- `type` / Item Contract / registry grubu kategori belirlemez
- `catalogCategory` rotation / color / image / collision / renderer / placement belirlemez

### Doğrulama

- Catalog category sayısı: 6 (önceki grup sayısıyla aynı)
- `catalogKey` benzersiz: %100
- `catalogName` boş: 0
- `catalogIndex` null: 0
- duplicate `catalogIndex`: 0
- `catalogIndex` sırası: 1..6 kesintisiz
- geçersiz `catalogKey` bakan Item: 0
- `catalogVisible=true` ve geçersiz category: 0
- kategori UI sırası / adları / kategori içi Item sırası / görünen Item sayısı (64): değişmedi
- `npm test`: 737 pass / 0 fail
- `npm run build`: geçti
- `CHANGE_GATE_BASE=origin/RefactorItem npm run contract:verify`: geçti (`catalog-category-model`)
- targeted E2E `e2e/smoke.spec.mjs`: geçti

### Sonraki adım

`listCatalogItems()` henüz ayrı export değildir. Kart descriptor’ı hâlâ `MODULE_CATALOG` üzerindendir. SQLite/API bu turda yoktur.

---

## 2026-09-16 — Item katalog metadata alanları

### Amaç

Katalog görünürlüğünü ve katalog içi konumu Item’ın kendi verisine taşımak. Bu tur katalog UI’yı yeni alanlardan okutmaz; yalnız 104 Item kaydını hazırlar.

### Yapılan değişiklikler

- Eklenen Item alanları: `catalogVisible`, `catalogCategory`, `catalogItemIndex`
- Değer kaynağı: canlı `MODULE_CATALOG_GROUPS` üyeliği ve `MODULE_CATALOG_KEYS` ile aynı grup içi UI sırası
- Kaldırılan alan yok
- `createCommercialCatalogItem` bu üç alanı katalog descriptor’ına kopyalamaz; `MODULE_CATALOG` şekli korunur
- Etkilenen dosyalar: `src/items.js`, `src/catalog.js`, `test/itemCatalogFields.test.js`, `test/shelfLegItemContract.test.js`

Canonical `catalogCategory` key’leri (mevcut 6 grup, yeni grup yok):

| key | grup label | Item sayısı |
|---|---|---|
| `panel-wall` | Panel & Duvar | 12 |
| `panel-addon` | Panel Ek Modül | 13 |
| `shelf-showcase` | Raf & Vitrin | 8 |
| `counter-base` | Banko & Baza | 9 |
| `extra` | Extra | 16 |
| `electronics-lighting` | Elektronik & Aydınlatma | 6 |

`wall_200`: `catalogVisible=true`, `catalogCategory=panel-wall`, `catalogItemIndex=1` (grupta ilk kart).
`panel_197`: `catalogVisible=false`, `catalogCategory=null`, `catalogItemIndex=null`.

### Yeni kural

- `catalogVisible`: Item sol katalogda gösterilecek mi
- `catalogCategory`: Item’ın ait olduğu katalog category key; yalnız UI gruplamasıdır, runtime behavior belirlemez
- `catalogItemIndex`: kendi kategorisi içinde 1 tabanlı sıra
- Bu üç alan type’tan, Item Contract’tan veya registry grubundan türetilmez
- Her Item kendi değerini taşır; ayrı assignment tablosu yoktur
- Katalogda görünmeyen Item: `false / null / null`
- Bu turda katalog UI hâlâ `MODULE_CATALOG_GROUPS` okur

### Doğrulama

- Toplam Item: 104 / 104
- `catalogVisible` / `catalogCategory` / `catalogItemIndex` alanı: 104 / 104
- `catalogVisible=true`: 64 (canlı katalog Item sayısıyla aynı)
- visible=true olup category veya index null: 0
- visible=false olup category veya index dolu: 0
- Aynı kategoride duplicate index: 0
- Her kategoride index 1..N kesintisiz
- Katalog grup sırası, grup içi Item sırası ve görünen Item sayısı değişmedi
- `npm test`: 732 pass / 0 fail
- `npm run build`: geçti
- targeted E2E `e2e/smoke.spec.mjs`: geçti

### Sonraki adım

Katalog UI’yı `MODULE_CATALOG_GROUPS` yerine Item’daki `catalogVisible` / `catalogCategory` / `catalogItemIndex` alanlarından okutmak. Bu adım henüz yapılmaz.

---

## 2026-09-16 — Katalog teknik sözleşmesi

### Amaç

Katalog mekanizmasını kalıcı tek belgede sabitlemek ve refactor günlüğünü `docs/refactor/` altına almak.

### Yapılan değişiklikler

- Eklenen: `docs/refactor/CATALOG.md` (katalog canonical sözleşmesi)
- Taşınan: değişiklik günlüğü `docs/REFACTOR.md` → `docs/refactor/REFACTOR.md`
- `docs/REFACTOR.md` yönlendirme bırakır
- Katalog UI, Item Contract, recipe, behavior, DB/API bu adımda değişmez
- Etkilenen dosyalar: `docs/refactor/CATALOG.md`, `docs/refactor/REFACTOR.md`, `docs/REFACTOR.md`, `test/itemCatalogFields.test.js`

### Yeni kural

- Refactor adımlarının tek günlüğü `docs/refactor/REFACTOR.md`
- Katalog nasıl çalışır / nasıl çalışmalıdır: yalnız `docs/refactor/CATALOG.md`
- Mevcut UI hâlâ `MODULE_CATALOG_GROUPS` okur; `listCatalogItems` / `listCatalogGroups` henüz yoktur

### Doğrulama

- `test/itemCatalogFields.test.js` category key tablosunu canlı gruplarla karşılaştırır
- `listCatalogItems` / `listCatalogGroups` src içinde yok
- `npm test`: 733 pass / 0 fail
- Katalog UI sırası ve Item alanları önceki adımla aynı kalır

### Sonraki adım

`listCatalogItems` / `listCatalogGroups` eklemek ve UI’yı bu API’den okutmak. Bu adım henüz yapılmaz.

---

## 2026-09-16 — Item canonical sözleşmesi

### Amaç

Yeni Item modelinin yaşayan teknik sözleşmesini `docs/refactor/ITEMS.md` altında tutmak. Audit dökümü değildir; yalnız onaylanmış alanlar yazılır.

### Yapılan değişiklikler

- Eklenen: `docs/refactor/ITEMS.md`
- Onaylı şemaya alınan Item alanları: `itemKey`, `catalogVisible`, `catalogCategory`, `catalogItemIndex`
- Eski 188 property / type / registry alanları şemaya taşınmadı
- Catalog ayrıntısı `CATALOG.md`’de kalır; ITEMS.md yalnız config bağlantısını tutar
- Etkilenen dosyalar: `docs/refactor/ITEMS.md`, `docs/refactor/REFACTOR.md`, `docs/REFACTOR.md`, `test/itemCatalogFields.test.js`

### Yeni kural

- Item modelinin tek güncel cevabı `docs/refactor/ITEMS.md`
- Yeni Item alanı/config aynı commit içinde ITEMS.md’ye yazılır
- Gerçekleşmemiş method veya config gerçekleşmiş gibi yazılmaz
- Rotation / color / image / lighting / delete mekanizmaları henüz belirlenmedi

### Doğrulama

- `test/itemCatalogFields.test.js` ITEMS.md katalog alanlarını ve “henüz yok” kaydını doğrular
- `npm test`: 734 pass / 0 fail
- Katalog UI değişmez

### Sonraki adım

`listCatalogItems` / `listCatalogGroups` eklemek. ITEMS.md bağlantı satırı o commit’te “mevcut” yapılır.
