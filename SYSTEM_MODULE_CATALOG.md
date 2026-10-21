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

- Catalog entries: **60**
- BOM mode `recipe`: **28**
- BOM mode `self`: **13**
- BOM mode `decision-required`: **19**
- Katalog dışı explicit runtime module: **1** (`illuminated-foam`)
- Katalog dışı module BOM mode `decision-required`: **1**

> `decision-required` bir hata etiketi değildir. Recipe, commercial-item veya explicit exclusion ürün/üretim kararı verilmeden Final BOM politikası uydurulmayacağı anlamına gelir.

## Katalog anahtarları

Aşağıdaki blok test tarafından `MODULE_CATALOG_KEYS` ile **sıra dahil birebir** karşılaştırılır.

<!-- catalog-keys:start -->
- `wall_200_350`
- `wall_150_350`
- `wall_100_350`
- `wall_50_350`
- `wall_separator_100_350`
- `wall_separator_50_350`
- `wall_separator_100_350_sarmasik`
- `wall_separator_50_350_sarmasik`
- `wall_door_100_350`
- `wall_200_short_2`
- `wall_150_short_2`
- `wall_100_short_2`
- `wall_50_short_2`
- `wall_200_short_1`
- `wall_150_short_1`
- `wall_100_short_1`
- `wall_50_short_1`
- `upright_346_5`
- `profile_190`
- `profile_140_5`
- `profile_91`
- `profile_41_5`
- `box_block`
- `wall_showcase_100_3_350`
- `wall_showcase_100_2_350`
- `shelf_row_1`
- `shelf_row_2`
- `shelf_row_3`
- `desk_banko_200`
- `desk_banko_150`
- `desk_banko_100`
- `desk_banko_200_l`
- `desk_banko_150_l`
- `desk_banko_100_l`
- `base_200`
- `base_150`
- `base_100`
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
- `extra_long_planter_150`
- `extra_long_planter_200`
- `tulle_fabric`
- `tv_42`
- `tv_55`
- `video_wall_2x2`
- `video_wall_3x3`
- `tv_65`
- `led_floodlight`
<!-- catalog-keys:end -->

## Güncel aile görünümü

Bu bölüm navigasyon içindir; ölçü/recipe source-of-truth değildir.

### Panel & Duvar

`wall_200_350`, `wall_150_350`, `wall_100_350`, `wall_50_350`, `wall_separator_100_350`, `wall_separator_50_350`, `wall_separator_100_350_sarmasik`, `wall_separator_50_350_sarmasik`, `wall_door_100_350`

### Panel Ek Modül

`wall_200_short_2`, `wall_150_short_2`, `wall_100_short_2`, `wall_50_short_2`, `wall_200_short_1`, `wall_150_short_1`, `wall_100_short_1`, `wall_50_short_1`, `upright_346_5`, `profile_190`, `profile_140_5`, `profile_91`, `profile_41_5`, `box_block`

### Raf & Vitrin

`wall_showcase_100_3`, `wall_showcase_100_2`, `shelf_row_1`, `shelf_row_2`, `shelf_row_3`

### Banko & Baza

`desk_banko_200`, `desk_banko_150`, `desk_banko_100`, `desk_banko_200_l`, `desk_banko_150_l`, `desk_banko_100_l`, `base_200`, `base_150`, `base_100`

### Mobilya / Depo / Bitki

`furniture_sofa_set_classic`, `furniture_sofa_single_classic`, `furniture_sofa_double_classic`, `furniture_coffee_table_classic`, `furniture_table_chair_set_eames`, `chair_eames`, `glass_table`, `furniture_bar_stool_classic`, `mini_fridge_avanti`, `kettle`, `coat_rack`, `plastic_trash_bin`, `extra_indoor_plant_1`, `extra_long_planter_100`, `extra_long_planter_150`, `extra_long_planter_200`, `tulle_fabric`

### Medya / Işık

`tv_42`, `tv_55`, `video_wall_2x2`, `video_wall_3x3`, `tv_65`, `led_floodlight`

## BOM politika özeti

### `recipe` — 28 katalog kaydı

Duvar/panel, separatör, vitrin, depo kapısı, düz/L banko ve baza ailelerinin contract'ı `recipe` modundadır. Gerçek recipe çözümü `src/moduleRecipes.js` tarafından yapılır ve contract testleri recipe-backed kayıtların gerçekten resolve olduğunu doğrular.

### `self` — 12 katalog kaydı

`mini_fridge_avanti`, `kettle`, `coat_rack`, `plastic_trash_bin`, `box_block`, `upright_346_5`, `profile_190`, `profile_140_5`, `profile_91`, `profile_41_5` leaf/self BOM Item'dır. Canonical birim `adet`; `src/itemBom.js > resolveItemBom(itemKey)` aynı `itemKey` için `quantity=1` üretir. Child recipe yoktur. Parent duvar reçetelerindeki `upright_346_5 ×2` ve `profile_*` parent miktarları bu saha örneğinden ayrıdır.

### `decision-required` — 19 katalog kaydı

Şu katalog aileleri için Final BOM sınıflandırması henüz ürün/üretim kararı bekler:

- mobilya setleri / tekli-çiftli koltuk / sehpa / Eames sandalye / cam masa / bar taburesi
- yapay bitki / uzun saksılar
- TV 42 / 55 / 65
- Video Wall 2×2 / 3×3
- LED projektör
- Tül (`tulle_fabric`): sahne miktarı `src/projectBom.js` içinde en × boy / 10000 m² olarak aynı `itemKey` satırına yazılır

Bu kayıtlar için bu doküman **commercial-item / recipe / excluded** kararı uydurmaz. Canonical mevcut durum `src/moduleContracts.js` içindeki `decision-required` politikasıdır.

## Katalog dışı runtime modülü

`illuminated-foam` katalog anahtarı değildir. `src/moduleContracts.js` içindeki `NON_CATALOG_MODULE_CONTRACTS` üzerinden explicit contract taşır ve BOM politikası şu anda `decision-required` durumundadır.

## Değişiklik kuralı

Yeni katalog modülü veya katalog kimliği değişikliği yapıldığında:

1. canonical değişiklik `src/catalog.js` ve ilgili contract sahiplerinde yapılır;
2. gerekli state/behavior/renderer/persistence/BOM etkileri change contract'ta beyan edilir;
3. bu dokümandaki katalog anahtarı snapshot'ı güncellenir;
4. `npm test` içindeki `systemModuleCatalogDoc` regresyonu snapshot ile runtime katalog arasında drift olmadığını doğrular;
5. full test + build yeşil olmadan değişiklik tamamlanmış sayılmaz.

### Raf aile kartları ve üretim ürünleri (0072)

`shelf_row_1`, `shelf_row_2`, `shelf_row_3` katalog aile kartlarıdır; kendi başlarına üretim ürünü olarak sahneye kaydedilmezler. `fair_stand_item_width_variants` eşlemesi hedef duvar genişliğinden `shelf_W` veya `shelf_row_n_W` ürününü seçer. Üretim ürünleri recipe BOM kullanır: sıralı raf → tekli raf × sıra adedi → tahta + ayaklar. Kartın governance BOM profilini gerçek üretim reçetesi olarak kullanma. Tahta sahne ölçüleri `sceneDimensions ?? dimensions`; BOM fiziksel/reçete kaynağını korur.