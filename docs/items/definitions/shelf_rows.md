# Raf aile kartları ve sıralı ürünler

Kanonik kaynak DB Item store ve `fair_stand_item_width_variants` ilişkileridir. Bu belge yeni bir ürün/ölçü kaynağı değildir.

| Katalog kartı | Hedef duvardan seçilen ürün |
|---|---|
| `shelf_row_1` — Tekli raf | `shelf_100`, `shelf_150`, `shelf_200` |
| `shelf_row_2` — 2 sıralı raf | `shelf_row_2_100`, `shelf_row_2_150`, `shelf_row_2_200` |
| `shelf_row_3` — 3 sıralı raf | `shelf_row_3_100`, `shelf_row_3_150`, `shelf_row_3_200` |

Genişlik seçimi key deseninden üretilmez; DB eşlemesi ve varyantın fiziksel genişliği kullanılır. 50 cm duvara eşleşme yoktur. Kart önizleme state'i en dar üründen başlar; bırakma ve başka duvara taşıma hedef genişliği yeniden çözer. Kayda gerçek üretim ürününün `itemKey` alanı yazılır; kopyalama da aynı yerleştirme yolundan geçer.

Her ürün `shelf` davranış ailesindedir, duvar zinciri kapasitesini tüketmez, panel birleşimine oturur. 2/3 sıralı ürün reçetesi tekli rafı adedi kadar içerir. Tekli raf reçetesi terminal `shelf_W_self` tahtasını ve kayıtlı adet `shelf_leg` içerir. Birimler `adet`; BOM sahne geometrisinden türetilmez.

Snap, mevcut iki panelin ortak üst/alt kenarına göre hesaplanır; panel bölgesinin dış alt ve dış üst sınırı geçerli birleşim değildir. Kapı üstünde yalnız gerçekten bulunan üst panel bantlarının indeksleri kullanılır; üst panel sayısı tüm kapı yüksekliğine yayılmaz. Kural standın tüm desteklenen yüksekliklerinde aynıdır. Aynı yerdeki raf tahtaları çakışıyorsa yeni bırakma veya klavyeyle taşıma reddedilir; sıralı rafın her tahtası ayrı kontrol edilir. Taşınan raf kendi kendisiyle çarpışma sayılmaz.

Çizici reçeteyi terminal tahtaya kadar izler. Her tahta için alan bazında `sceneDimensions ?? dimensions` okunur; parent rafın ölçüsü tahta kalınlığının yerine geçmez. Tekli rafın görsel yüksekliği tahta kalınlığıdır; sıralı ürünün toplam yüksekliği kendi sahne/fiziksel ölçüsüdür. Tahtalar bu zarf içinde eşit aralıkla çizilir. Seçim kutusu toplam zarfı kapsar. Her sırada LED ve spot vardır; `shelfLightingOn` hepsini kontrol eder.

Kayıt biçimine yeni alan eklenmez. Eski tekli raf kimlikleri geçerlidir. Migration `0072_shelf_rows` mevcut ölçü ezmelerini korur; veri kaybı olmadan tekrarlanabilir.

Regresyon: `test/shelfWidthVariantPlacement.test.js`, `test/shelfRowsRender.test.js`, `test/shelfRecipeBom.test.js`, `e2e/shelf-items-contract.spec.mjs`, `e2e/shelf-width-variant.spec.mjs`, `backend/tests/modules/fair_stand/test_shelf_rows_migration.py`.
