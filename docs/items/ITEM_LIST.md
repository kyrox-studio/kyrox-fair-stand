# Item Yapılandırması — Item Envanteri ve Migration Listesi

Bu belge Item Contract migrationında izlenecek Item envanterini tutar.

> Satırdaki “Tamam” işareti gecikebilir. Güncel kimlik/BOM: `docs/items/definitions/` + `src/items.js` / `src/moduleContracts.js`. Test-kilitli katalog özeti: `SYSTEM_MODULE_CATALOG.md`. Canlı sıra: `audit/SISTEM_MUTABAKAT_RAPORU.md`. A–Z özellik haritası (tarihsel audit snapshot; regenerate edilmedi): `docs/items/audit/README.md`. Kayıtlı Item: 96 (`VIDEO_WALL_PANEL` katalog dışı).

Temel model:

- sistemde BOM, üretim veya maliyet hesabına giren her fiziksel öğe `Item`dır,
- başka Item bileşimi içermeyenler **Tekil Item**,
- başka Item'lardan oluşanlar **Bileşik Item**dır,
- "alt Item" ayrı bir sınıf değil, bir Item'ın parent/bileşik Item içindeki kullanım rolüdür,
- migration bottom-up ilerler; ilk pilot `connector_start`tır,
- ilk pilot dışındaki kesin sıra mevcut kod zinciri incelendikçe belirlenir; bu liste tahmini sıra dayatmaz.

## A. Production / alt Item envanteri

Aşağıdaki Item'lar bugün `src/items.js` içinde `LEAF_ITEMS` olarak canonical production metadata bulunan ve bileşik Item reçetelerinde kullanılabilen fiziksel Item'lardır.

| Item key | Type / rol | Migration notu |
|---|---|---|
| `connector_start` | `connector` | **Tamam — ilk pilot** |
| `connector_single` | `connector` | **Tamam — 27 aktif recipe canonical `itemKey`** |
| `connector_double` | `connector` | **Tamam — canonical `itemKey` + explicit connector BOM resolver; fixed parent recipe kullanımı bugün uygulanmıyor, quantity uydurulmaz** |
| `connector_corner` | `connector` | **Tamam — canonical `itemKey` + explicit connector BOM resolver; fixed parent recipe kullanımı bugün uygulanmıyor, quantity uydurulmaz** |
| `upright_346_5` | `upright` | **Tamam — canonical `itemKey`; 18 aktif recipe içinde ×2** |
| `upright_99` | `upright` | **Tamam — canonical `itemKey`; 3 düz bankoda ×4, 3 L bankoda ×5** |
| `upright_49_5` | `upright` | **Tamam — canonical `itemKey`; 3 base içinde ×4** |
| `profile_41_5` | `profile` | **Tamam — canonical `itemKey`; 14 doğrulanmış parent recipe quantity parity korunur; `widthCm=41.5`, `depthCm=8`, `heightCm=8`; saha katalog self ×1** |
| `profile_91` | `profile` | **Tamam — canonical `itemKey`; 12 doğrulanmış parent recipe quantity parity korunur; `widthCm=91`, `depthCm=8`, `heightCm=8`; saha katalog self ×1** |
| `profile_140_5` | `profile` | **Tamam — canonical `itemKey`; 8 doğrulanmış parent recipe quantity parity korunur; `widthCm=140.5`, `depthCm=8`, `heightCm=8`; saha katalog self ×1** |
| `profile_190` | `profile` | **Tamam — canonical `itemKey`; 7 aktif 200 cm recipe içinde doğrulanmış miktarlar korunur; `190 × 8 cm` üretim ölçüsü; saha katalog self ×1** |
| `profile_239_5` | `profile` | **Tamam — canonical `itemKey`; gerçek 239,5 cm → sahne 250 cm; katalogda gizli, boy penceresinden; saha self ×1** |
| `profile_289` | `profile` | **Tamam — canonical `itemKey`; gerçek 289 cm → sahne 300 cm; katalogdaki tek profil kartı; saha self ×1** |
| `profile_388` | `profile` | **Tamam — canonical `itemKey`; gerçek 388 cm → sahne 400 cm; katalogda gizli, boy penceresinden; saha self ×1** |
| `profile_487` | `profile` | **Tamam — canonical `itemKey`; gerçek 487 cm → sahne 500 cm; katalogda gizli, boy penceresinden; saha self ×1** |
| `panel_48_5` | `panel` | **Tamam — canonical `itemKey`; 13 doğrulanmış parent recipe quantity parity korunur** |
| `panel_98` | `panel` | **Tamam — canonical `itemKey`; 10 doğrulanmış parent recipe quantity parity korunur** |
| `panel_147_5` | `panel` | **Tamam — canonical `itemKey`; 7 doğrulanmış parent recipe quantity parity korunur** |
| `panel_197` | `panel` | **Tamam — canonical `itemKey`; 7 aktif 200 cm recipe içinde doğrulanmış miktarlar korunur** |
| `panel_corner_42_5` | `panel` | **Tamam — canonical `itemKey`; 1 doğrulanmış 50 cm recipe variant referansı; `panel_48_5` miktarı 1:1 replacement** |
| `panel_corner_92` | `panel` | **Tamam — canonical `itemKey`; 7 doğrulanmış 100 cm recipe variant referansı; `panel_98` miktarı 1:1 replacement** |
| `panel_corner_142_5` | `panel` | **Tamam — canonical `itemKey`; 4 doğrulanmış 150 cm recipe variant referansı; `panel_147_5` miktarı 1:1 replacement** |
| `panel_corner_192` | `panel` | **Tamam — canonical `itemKey`; 4 doğrulanmış 200 cm recipe variant referansı; inner-corner BOM'da `panel_197` miktarı 1:1 korunarak replacement** |
| `separator_panel_48_5` | `separator-panel` | **Tamam — canonical `itemKey`; `48.5 × 47 × 0.8 cm`; separator-50 içinde ×1 quantity parity** |
| `separator_panel_98` | `separator-panel` | **Tamam — canonical `itemKey`; `98 × 47 × 0.8 cm`; separator-50 içinde ×3, separator-100 içinde ×7 quantity parity** |
| `door_leaf_100` | `door-leaf` | **Tamam — canonical ahşap kapı kanadı; `100 × 200 × 8 cm`; beyaz default; renk + görsel override; door recipe ×1** |
| `shelf_100` | `shelf` | **Tamam — canonical `itemKey`; `100 × 38 × 1.8 cm`; sunta; beyaz default; Catalog `shelf-showcase`; self BOM `1 adet`** |
| `shelf_150` | `shelf` | **Tamam — canonical `itemKey`; `150 × 38 × 1.8 cm`; sunta; beyaz default; Catalog `shelf-showcase`; self BOM `1 adet`** |
| `shelf_200` | `shelf` | **Tamam — canonical `itemKey`; `200 × 38 × 1.8 cm`; sunta; beyaz default; Catalog `shelf-showcase`; self BOM `1 adet`** |
| `shelf_leg` | `shelf-accessory` | **Tamam — canonical `itemKey`; yalnız doğrulanmış kimlik/ad/type/unit; shelf recipes 4/4/6/6/6/9 quantity parity; dimensions/material/weight/color henüz tanımlı değil** |
| `showcase_side_94_6_30` | `showcase-board` | **Canonical leaf tamam — `94.6 × 30 × 1.8 cm`; sunta; beyaz default; bireysel renk capability yok; parent `wall_showcase_100_2` recipe/renderer/tek gövde renk override cutover'u tamam** |
| `showcase_side_143_5_30` | `showcase-board` | **Canonical leaf tamam — `143.5 × 30 × 1.8 cm`; sunta; beyaz default; bireysel renk capability yok; parent `wall_showcase_100_3` recipe/renderer/tek gövde renk override cutover'u tamam** |
| `showcase_horizontal_87_4_30` | `showcase-board` | **Canonical leaf tamam — `87.4 × 30 × 1.8 cm`; sunta; beyaz default; iki wall_showcase parent'ta ortak üst/alt board; parent cutover tamam** |
| `glass_shelf` | `showcase-accessory` | **Tamam — canonical `itemKey`; `87.3 × 28.5 × 0.6 cm`; cam; wall_showcase recipes içinde doğrulanmış ×1/×2; renderer canonical ölçü/material tüketimi** |
| `counter_top_110_60` | `counter-top` | **Tamam — canonical `itemKey`; `110 × 60 × 1.8 cm`; düz 100 + L100 içinde ×1 quantity parity** |
| `counter_top_52_60` | `counter-top` | **Tamam — canonical `itemKey`; `52 × 60 × 1.8 cm`; L100 içinde ×1 quantity parity** |
| `counter_top_160_60` | `counter-top` | **Tamam — canonical `itemKey`; `160 × 60 × 1.8 cm`; düz 150 + L150 içinde ×1 quantity parity** |
| `counter_top_102_60` | `counter-top` | **Tamam — canonical `itemKey`; `102 × 60 × 1.8 cm`; L150 içinde ×1 quantity parity** |
| `counter_top_210_60` | `counter-top` | **Tamam — canonical `itemKey`; `210 × 60 × 1.8 cm`; düz 200 + L200 içinde ×1 quantity parity** |
| `counter_top_150_60` | `counter-top` | **Tamam — canonical `itemKey`; `150 × 60 × 1.8 cm`; L200 içinde ×1 quantity parity** |
| `base_top_107_50` | `base-top` | **Tamam — canonical `itemKey`; `107 × 50 × 1.8 cm`; BASE_100 içinde ×1 quantity parity** |
| `base_top_157_50` | `base-top` | **Tamam — canonical `itemKey`; `157 × 50 × 1.8 cm`; BASE_150 içinde ×1 quantity parity** |
| `base_top_206_50` | `base-top` | **Tamam — canonical `itemKey`; `206 × 50 × 1.8 cm`; BASE_200 içinde ×1 quantity parity** |

## B. Üst seviye / catalog Item envanteri

Aşağıdaki mevcut liste korunur. Bu Item'ların Tekil/Bileşik ve parametrik durumu her Item incelenirken mevcut koddan doğrulanır; isim veya catalog konumundan tahmin edilmez.

| # | Item key | Adı | Type / Not |
|---:|---|---|---|
| 1 | `wall_200` | Panel 200 | `flat-panel` |
| 2 | `wall_150` | Panel 150 | `flat-panel` |
| 3 | `wall_100` | Panel 100 | `flat-panel` |
| 4 | `wall_50` | Panel 50 | `flat-panel` |
| 5 | `wall_200_short_up_2` | Panel 200 Short Up 2 | `flat-panel` · `short-up-2` |
| 6 | `wall_150_short_up_2` | Panel 150 Short Up 2 | `flat-panel` · `short-up-2` |
| 7 | `wall_100_short_up_2` | Panel 100 Short Up 2 | `flat-panel` · `short-up-2` |
| 8 | `wall_50_short_up_2` | Panel 50 Short Up 2 | `flat-panel` · `short-up-2` |
| 9 | `wall_200_short_up_1` | Panel 200 Short Up 1 | `flat-panel` · `short-up-1` |
| 10 | `wall_150_short_up_1` | Panel 150 Short Up 1 | `flat-panel` · `short-up-1` |
| 11 | `wall_100_short_up_1` | Panel 100 Short Up 1 | `flat-panel` · `short-up-1` |
| 12 | `wall_50_short_up_1` | Panel 50 Short Up 1 | `flat-panel` · `short-up-1` |
| 13 | `wall_separator_100` | Separatör 100 | `separator` |
| 14 | `wall_separator_50` | Separatör 50 | `separator` |
| 15 | `wall_separator_100_sarmasik` | Separatör 100 Sarmaşık | `separator` |
| 16 | `wall_separator_50_sarmasik` | Separatör 50 Sarmaşık | `separator` |
| 17 | `wall_showcase_100_3` | 3 Gözlü Vitrin 100 | **`showcase-3` · Bileşik Item · BASE + inner-corner BOM tamam** |
| 18 | `wall_showcase_100_2` | 2 Gözlü Vitrin 100 | **`showcase-2` · Bileşik Item · BASE + inner-corner BOM tamam** |
| 28 | `door_100` | Depo Kapısı 100 | **`door` · Bileşik Item · Tamam** |
| 29 | `desk_banko_200` | Banko 200 | **`counter` · Bileşik Item · Tamam** |
| 30 | `desk_banko_150` | Banko 150 | **`counter` · Bileşik Item · Tamam** |
| 31 | `desk_banko_100` | Banko 100 | **`counter` · Bileşik Item · Tamam** |
| 32 | `desk_banko_200_L` | Köşe Banko 200×200 | `counter` |
| 33 | `desk_banko_150_L` | Köşe Banko 150×150 | `counter` |
| 34 | `desk_banko_100_L` | Köşe Banko 100×100 | `counter` |
| 35 | `BASE_200` | Baza 200 | `base` |
| 36 | `BASE_150` | Baza 150 | `base` |
| 37 | `BASE_100` | Baza 100 | `base` |
| 38 | `furniture_sofa_set_classic` | Koltuk Takımı | **`sofa-set-classic` · Item kümesi** |
| 39 | `furniture_sofa_single_classic` | Tekli Koltuk | **`sofa-single-classic` · Tekil Item** |
| 40 | `furniture_sofa_double_classic` | Çiftli Koltuk | **`sofa-double-classic` · Tekil Item** |
| 41 | `furniture_coffee_table_classic` | Sehpa | **`coffee-table-classic` · Tekil Item** |
| 42 | `furniture_table_chair_set_eames` | Eames Masa Sandalye Takımı | **`table-chair-set-eames` · Item kümesi** |
| 43 | `chair_eames` | Eames Sandalye | **`chair` · Tekil Item** |
| 44 | `glass_table` | Cam Masa | **`table-glass` · Tekil Item** |
| 44a | `glass_bar_table` | Bar Masası | **`table-glass` · Tekil Item** · cam masa ile aynı, yükseklik 108 cm (0075) |
| 45 | `furniture_bar_stool_classic` | Bar Taburesi | `bar-stool` |
| 46 | `MINI_FRIDGE_AVANTI` | Mini Buzdolabı | **`mini-fridge` · Tekil Item · Tamam · self BOM `1 adet`** |
| 47 | `KETTLE` | Kettle | **`kettle` · Tekil Item · Tamam · self BOM `1 adet`** |
| 48 | `COAT_RACK` | Askılık | **`coat-rack` · Tekil Item · Tamam · self BOM `1 adet`** |
| 48a | `floor_showcase_100` | Ayaklı Vitrin 100 | **`floor-showcase` · Tekil Item · Tamam · self BOM `1 adet`** (0074) |
| 48b | `brochure_stand` | Broşürlük | **`brochure-stand` · Tekil Item · Tamam · self BOM `1 adet`** (0074) |
| 49 | `PLASTIC_TRASH_BIN` | Çöp Kutusu | **`plastic-trash-bin` · Tekil Item · Tamam · self BOM `1 adet`** |
| 50 | `EXTRA_INDOOR_PLANT_1` | Yapay Çiçek 1 | `indoor-plant-1` |
| 51 | `EXTRA_LONG_PLANTER_100` | Uzun Saksı 100 | `indoor-plant-1` |
| 52 | `EXTRA_LONG_PLANTER_150` | Uzun Saksı 150 | `indoor-plant-1` |
| 53 | `EXTRA_LONG_PLANTER_200` | Uzun Saksı 200 | `indoor-plant-1` |
| 54 | `TV_42` | TV 42" | `tv` |
| 55 | `TV_55` | TV 55" | `tv` |
| 56 | `VIDEO_WALL_2X2` | Video Wall 2×2 | `tv` |
| 57 | `VIDEO_WALL_3X3` | Video Wall 3×3 | `tv` |
| — | `VIDEO_WALL_PANEL` | Video Wall Panel | `video-wall-panel` · tekil panel Item · katalog dışı; `videoWall.panelItemKey` |
| 58 | `TV_65` | TV 65" | `tv` |
| 59 | `led_floodlight` | LED Projektör | **`led-floodlight` · Tekil Item** |
| 60 | `illuminated-foam` | Işıklı Strafor / Logo | **`illuminated-foam` · Tekil Item · katalog dışı** |
| 61 | `karolaj` | Karolaj | **`floor` · Tekil Item · katalog dışı** |
| 62 | `hali` | Halı | **`floor` · Tekil Item · katalog dışı** |
| 63 | `parke-acik` | Beyaz Meşe | **`floor` · Tekil Item · katalog dışı** |
| 64 | `parke-sari` | Sarı Meşe | **`floor` · Tekil Item · katalog dışı** |
| 65 | `parke-beton` | Beton Parke | **`floor` · Tekil Item · katalog dışı** |
