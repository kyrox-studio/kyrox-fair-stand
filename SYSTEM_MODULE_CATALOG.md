# Fair Stand — Sistem Modül Kataloğu Referansı

Bu dosya insan/AI için **okunabilir katalog indeksi**dir. Runtime source-of-truth değildir.

## Canonical sahipler

- Item ve Category verisi: PostgreSQL `fair_stand` (Fair Stand API `:8002`), runtime'a bootstrap edilir
- Katalog projeksiyonu (Item ve Category bootstrap'inden): `src/catalog.js`
- Modül contract/profile/BOM politikası: `src/moduleContracts.js`
- Gerçek BOM reçeteleri: Item `composition` kaydı; resolver `src/moduleRecipes.js`
- Üretim parçaları ve gerçek üretim ölçüleri: DB Item kaydı; runtime registry `src/items.js`
- State factory/defaultları: `src/designState.js`
- Placement/behavior: `src/moduleBehavior.js` + placement core

**Kural:** Bu dokümanda üretim reçetesi miktarları veya fiziksel parça ölçüleri ikinci bir canonical veri seti olarak tutulmaz. Böyle bir bilgi gerektiğinde yukarıdaki kod sahipleri okunur.

## Güncel katalog özeti

Bu snapshot `Version2` üzerindeki `MODULE_CATALOG_KEYS` ve `MODULE_CONTRACT_ASSIGNMENTS` ile eşleşmek zorundadır; `test/systemModuleCatalogDoc.test.js` drift olduğunda CI'yi kırar.

- Catalog entries: **35**
- BOM mode `recipe`: **9**
- BOM mode `self`: **10**
- BOM mode `decision-required`: **16**
- Explicit contract runtime module: **1** (`illuminated-foam`; 0084 ile katalog kartı)
- Explicit contract module BOM mode `decision-required`: **1**

> `decision-required` bir hata etiketi değildir. Recipe, commercial-item veya explicit exclusion ürün/üretim kararı verilmeden Final BOM politikası uydurulmayacağı anlamına gelir.

## Katalog anahtarları

Aşağıdaki blok test tarafından `MODULE_CATALOG_KEYS` ile **sıra dahil birebir** karşılaştırılır.

<!-- catalog-keys:start -->
- `wall_100_350`
- `wall_separator_100_350`
- `wall_door_100_350`
- `wall_showcase_100_3_350`
- `wall_100_short_2`
- `wall_100_short_1`
- `upright_346_5`
- `profile_289`
- `box_block`
- `shelf_row_1`
- `desk_banko_100`
- `desk_banko_100_l`
- `base_100`
- `floor_showcase_100`
- `furniture_sofa_set_classic`
- `furniture_sofa_single_classic`
- `furniture_sofa_double_classic`
- `furniture_coffee_table_classic`
- `furniture_table_chair_set_eames`
- `chair_eames`
- `glass_table`
- `furniture_bar_stool_classic`
- `mini_fridge_avanti`
- `kettle`
- `coat_rack`
- `plastic_trash_bin`
- `extra_indoor_plant_1`
- `extra_long_planter_100`
- `tulle_fabric`
- `brochure_stand`
- `glass_bar_table`
- `tv_42`
- `video_wall_2x2`
- `led_floodlight`
- `illuminated-foam`
<!-- catalog-keys:end -->

## Güncel aile görünümü

Bu bölüm navigasyon içindir; ölçü/recipe source-of-truth değildir.

### Panel & Duvar

`wall_100_350`, `wall_separator_100_350`, `wall_door_100_350`

Panel ve Separatör kartı aile başına tek (migration `0082_panel_separator_cards`): `wall_100_350` (kart başlığı "Panel") ve `wall_separator_100_350` ("Separatör"). Kart bırakılınca 100'lük konur; genişlik Özellikler panelindeki varyant düğmelerinden seçilir: Panel 50 / 100 / 150 / 200 (`variant` `wall-panel`), Separatör 50 / 100 (`wall-separator`); paneldeki "Sarmaşıklı" çentiği aynı genişliğin sarmaşıklı Item'ını (`wall-separator-sarmasik`) seçer. 0086 ile aynı düzen Vitrin (`wall-showcase`, kart 3 göz, Panel & Duvar altında), Raf (`shelf-row`, kart tekli), TV (`tv`, kart 42"), Video Wall (`video-wall`, kart 2×2) ve Uzun Saksı (`long-planter`, kart 100) için geçerlidir; Ayaklı Vitrin Banko & Baza altındadır. Diğer genişlikler ve iki sarmaşıklı separatör katalogda gizli Item'dır; ad, `itemKey`, reçete ve kayıtlı projeler değişmez (`src/catalogWidthFamily.js`).

### Panel Ek Modül

`wall_100_short_2`, `wall_100_short_1`, `upright_346_5`, `profile_289`, `box_block`

Profil kartı tek (`profile_289`, dikmedeki gibi): bırakılırken boy sorulur. Gerçek boy → sahne boyu: `profile_41_5` 41,5 → 50, `profile_91` 91 → 100, `profile_140_5` 140,5 → 150, `profile_190` 190 → 200, `profile_239_5` 239,5 → 250, `profile_289` 289 → 300, `profile_388` 388 → 400, `profile_487` 487 → 500 (`src/profileLength.js`, migration `0078_profile_lengths`).

Kısa panel kartı varyant başına tek: `wall_100_short_1` (Tek Sıra), `wall_100_short_2` (Çift Sıra). Ölçü soran kartların (kısa panel, profil `profile_289`, dikme `upright_346_5`) katalog başlığı Item adının sonundaki ölçüyü yazmaz ("Panel Tek Sıra", "Profil", "Dikme"; `catalog.js` `catalogCardLabel`); sahnedeki parça, sağ tık başlığı ve BOM Item adını kullanır. Ad sahnedeki öğenin ölçüsünü yazar: kısa panel "Panel Tek/Çift Sıra W", profil ve dikme gerçek boyla ("Profil 41,5", "Dikme 346,5"). Bırakılırken genişlik (50 / 100 / 150 / 200) konum hesabından önce sorulur; diğer genişlikler (`wall_50/150/200_short_1/2`) katalogda gizli Item'dır, otomatik alınlık ve kayıtlı projeler onları kullanmaya devam eder (`src/wallShortWidth.js`, migration `0079_wall_short_cards`). BOM'da aynı hatta ve aynı ray yüksekliğinde uç uca duran kısa panellerin profili taşıyıcıdan taşıyıcıya tek parçadır: bandı taşıyan dikme ya da ucu oraya gelen tam boy duvar/ayırıcı/vitrin hattı böler; her panel o raydan kendi profilini düşer, açıklık sahne boyuna göre en uzun uygun profil + kalan parça olarak girer (500 → `profile_487`, 800 → `profile_487` + `profile_289`). Tek ve Çift Sıra yan yana yalnız hizalı üst rayı paylaşır; rayı profil rayına ya da kolona geçmiş panel hatta girmez (`applyShortRunProfiles`, `src/relationshipBom.js`). Sahnede kısa panelin üst/alt bağlantı çizgisine konan profil (gövdenin kenarıyla içeriden hizalı ya da dışarıdan değen) paneli kapsıyorsa o raydaki panel profilini düşürür; örn. 400'lük profil altındaki 200'lük panelin 190'ını alır (`applyProfileRail`).

### Raf & Vitrin

`wall_showcase_100_3`, `wall_showcase_100_2`, `shelf_row_1`, `shelf_row_2`, `shelf_row_3`, `floor_showcase_100`

### Banko & Baza

`desk_banko_100`, `desk_banko_100_l`, `base_100`

Banko, Köşe Banko ve Baza kartı aile başına tek (migration `0083_banko_base_cards`): `desk_banko_100` ("Banko"), `desk_banko_100_l` ("Köşe Banko"), `base_100` ("Baza"); sürükleme önizlemesi ve varsayılan ölçü 100. Sahneye konurken ölçü (100 / 150 / 200) sorulur (`variant` `desk-banko`, `desk-banko-l`, `base`); 150 ve 200 katalogda gizli Item'dır, ad/reçete/kayıtlı projeler değişmez (`src/catalogWidthFamily.js`).

### Mobilya / Depo / Bitki

`furniture_sofa_set_classic`, `furniture_sofa_single_classic`, `furniture_sofa_double_classic`, `furniture_coffee_table_classic`, `furniture_table_chair_set_eames`, `chair_eames`, `glass_table`, `furniture_bar_stool_classic`, `mini_fridge_avanti`, `kettle`, `coat_rack`, `plastic_trash_bin`, `extra_indoor_plant_1`, `extra_long_planter_100`, `extra_long_planter_150`, `extra_long_planter_200`, `tulle_fabric`, `brochure_stand`, `glass_bar_table`

### Medya / Işık

`tv_42`, `tv_55`, `video_wall_2x2`, `video_wall_3x3`, `tv_65`, `led_floodlight`, `illuminated-foam`

## BOM politika özeti

### `recipe` — 28 katalog kaydı

Duvar/panel, separatör, vitrin, depo kapısı, düz/L banko ve baza ailelerinin contract'ı `recipe` modundadır. Gerçek recipe çözümü `src/moduleRecipes.js` tarafından yapılır ve contract testleri recipe-backed kayıtların gerçekten resolve olduğunu doğrular.

### `self` — 14 katalog kaydı

`mini_fridge_avanti`, `kettle`, `coat_rack`, `floor_showcase_100`, `brochure_stand`, `plastic_trash_bin`, `box_block`, `upright_346_5` ve bütün `profile_*` boyları (`profile_41_5` … `profile_487`) leaf/self BOM Item'dır. Canonical birim `adet`; `src/itemBom.js > resolveItemBom(itemKey)` aynı `itemKey` için `quantity=1` üretir. Child recipe yoktur. Parent duvar reçetelerindeki `upright_346_5 ×2` ve `profile_*` parent miktarları bu saha örneğinden ayrıdır.

### `decision-required` — 20 katalog kaydı

Şu katalog aileleri için Final BOM sınıflandırması henüz ürün/üretim kararı bekler:

- mobilya setleri / tekli-çiftli koltuk / sehpa / Eames sandalye / cam masa / bar masası / bar taburesi
- yapay bitki / uzun saksılar
- TV 42 / 55 / 65
- Video Wall 2×2 / 3×3
- LED projektör
- Tül (`tulle_fabric`): sahne miktarı `src/projectBom.js` içinde en × boy / 10000 m² olarak aynı `itemKey` satırına yazılır

Bu kayıtlar için bu doküman **commercial-item / recipe / excluded** kararı uydurmaz. Canonical mevcut durum `src/moduleContracts.js` içindeki `decision-required` politikasıdır.

## Explicit contract runtime modülü

`illuminated-foam` 0084 ile Elektronik & Aydınlatma kategorisinde katalog kartıdır; logo görseli Özellikler panelinin görsel bölümünden (yalnız SVG) seçilir. Contract'ı tip kaydından değil `src/moduleContracts.js` içindeki `NON_CATALOG_MODULE_CONTRACTS` üzerinden explicit gelir ve BOM politikası şu anda `decision-required` durumundadır.

## Değişiklik kuralı

Yeni katalog modülü veya katalog kimliği değişikliği yapıldığında:

1. canonical değişiklik `src/catalog.js` ve ilgili contract sahiplerinde yapılır;
2. gerekli state/behavior/renderer/persistence/BOM etkileri change contract'ta beyan edilir;
3. bu dokümandaki katalog anahtarı snapshot'ı güncellenir;
4. `npm test` içindeki `systemModuleCatalogDoc` regresyonu snapshot ile runtime katalog arasında drift olmadığını doğrular;
5. full test + build yeşil olmadan değişiklik tamamlanmış sayılmaz.

### Raf aile kartları ve üretim ürünleri (0072)

`shelf_row_1`, `shelf_row_2`, `shelf_row_3` katalog aile kartlarıdır; kendi başlarına üretim ürünü olarak sahneye kaydedilmezler. `fair_stand_item_width_variants` eşlemesi hedef duvar genişliğinden `shelf_W` veya `shelf_row_n_W` ürününü seçer. Üretim ürünleri recipe BOM kullanır: sıralı raf → tekli raf × sıra adedi → tahta + ayaklar. Kartın governance BOM profilini gerçek üretim reçetesi olarak kullanma. Tahta sahne ölçüleri `sceneDimensions ?? dimensions`; BOM fiziksel/reçete kaynağını korur.