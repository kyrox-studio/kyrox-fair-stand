# Fair Stand — Ertelenmiş kararlar ve backlog

> **Ertelenmiş Item / zarf / davranış kararlarının kanonik listesi.** Audit F-* burada tutulmaz → `audit/FINDINGS.md`.
> Özet harita: `kyrox-platform/projects/fair-stand/OPEN_WORK_INVENTORY.md`.

Henüz çözülmemiş veya bilinçli ertelenmiş **Item property**, **stand zarfı / DB**, **runtime davranış** ve **pose/tavan–şerit** işlerinin tek takip listesi.

- Kaynak: ürün kararı + `DATABASE.md`, `ITEMS.md`, `SCENE_POSE.md`, mevcut kod. Tahmin yazılmaz.
- Yeni madde buraya eklenir; gizli paralel liste yok.
- **Yasak (genel):** Bu dosyada karar değişmeden veya kaldırma sırası dışında ilgili alan/tablo/kolon silinmez, taşınmaz, yeniden adlandırılmaz.
- **Implementasyon izni:** Bu dosya + ilgili konu belgesi (`SCENE_POSE.md` pose/snap hedefi); tek başına yeterli değildir.
- **Kapalı maddeler** tekrar listelenmez — yalnız `REFACTOR.md` + § F özeti.

**İlgili belgeler:** `FAIR_STAND_DB_KULLANIM_KILAVUZU.md` (CRM kullanım), `SCENE_POSE.md` (duruş/snap hedef), `DATABASE.md` (tablo envanteri), `ITEMS.md` (onaylı şema + runtime field kuyruğu), `STAND_DIMENSIONS.md` (zarf), `ITEM_FIRST_ROADMAP.md` (item-first checklist), `README.md` (dizin).

---

## A. Tavan / şerit kaldırma sırası (güvenli)

Her item kendi ölçü/BOM’unu taşır; stand tavanı yalnız **max zarf** (örn. 500 cm — clamp/kamera). Global şerit ızgarası ve tavan türevli ürün yüksekliği kalkar.

`SCENE_POSE.md` hedefi ile aynı; **operasyon sırası yalnız burada** canonical’dır.

| Adım | İş | Not |
|---:|---|---|
| 1 | Her item: eksiksiz `scene_dimensions` + yüzey/BOM layout | Örn. `wall_200_250` = 5 panel; gizli 350 / `upright_346_5` / ×7 sözleşmesi biter — **sıradaki kod adımı** |
| 2 | `designState.strips[]` → item surface slot’ları | Eski proje **migration** zorunlu |
| 3 | Raf snap → host item anchor | `snap_target_item_type` / `snap_anchor`; global seam yok |
| 4 | `fair_stand_item_strip_occupancy` + CRM | Aşağı § B.3–B.4 |
| 5 | `fair_stand_dimensions.strip_count` / `strip_height_m` + CHECK | Aşağı § C.1 |
| 6 | Tavan yalnız max zarf | Ürün mesh/collision **tavan fallback okumaz** |

**Kalabilir (min):** bağımsız `height_m` (max), `depth_m` / `frame_*` (ileride tamamen item/zarf sadeleşmesine girebilir).

**Gitmeli:** şerit sayısı/pitch, seam grid, occupancy, “yükseklik yoksa tavan kullan”, 7×50 help.

**Pose/snap (ayrı hat):** `SCENE_POSE.md` § *Uygulama sırası 1–6* — default Z, snap kolonları vb. kısmen kodda; **bu tablo onu tamamlamaz**, şerit/tavan iskeletini söker.

---

## B. Item property kararları

### B.1. `eyeCount`

- **Durum:** SİLİNECEK
- **Karar:** Yerine gerçek glass shelf yerleşim bilgisi (`bodyItems.glassShelfItemKey` vb. ile uyumlu model).
- **Kaynak:** `ITEMS.md` kuyruk (2 vitrin).
- **Yasak:** Yeni dolaylı göz sayacı üretilmez.

### B.2. `dimensions.wallGapCm` (`wall_gap_cm`)

- **Durum:** KORUNACAK
- **Karar:** İleride uygun property grubuna taşınır; `illuminated-foam` tüketicisi korunur.
- **Kaynak:** `ITEMS.md` kuyruk; `DATABASE.md` `fair_stand_item_dimensions`.
- **Yasak:** Madde kapanmadan silinmez.

### B.3. `mountHeightCm` / `dimensions.mount_height_cm` vs `default_z_cm`

- **Durum:** ARAŞTIRILACAK
- **Karar:** Producer/consumer zinciri netleşmeden tek alan seçilmez. Drop/snap hedefi `default_z_cm` (`ITEMS.md` onaylı); seed’de floodlight 350 her iki yerde de durabilir.
- **Kaynak:** `DATABASE.md` (`mount_height_cm` legacy); `ITEMS.md` `defaultZCm`.
- **Yasak:** Biri diğerine alias yazılmadan biri silinmez.

### B.3b. Z clamp politikası → tip davranışı (DB)

- **Durum:** BACKLOG — şimdilik kodda (`2026-10-18`)
- **Bugün kod:**
  - Yerden taban + tepe tavanı aşmaz: kutu / tül / wall-short → `clampFloorRelativeBottomZCm` (max = tavan − gövde)
  - Üst montaj tabanı tavana kadar: `placement=top` / projektör → `clampMountBottomZCm` (max = tavan; gövde düşürmez)
  - Overlay merkez ofset: TV / raf → `clampWallOverlayZCm` (+ sabit 175)
- **Hedef:** Tip scene behavior’da `z_frame` / `z_max` (veya eşdeğeri); motor tek; yeni item için JS özel case yok.
- **Ürün (lamba):** taban 0…stand `height_cm`; tavanı geçmez; default 350 meşru.
- **Yasak:** Her yeni item için sahneye yeni Z if-dalı açmak (geçici top case hariç, DB taşımasına kadar).

### B.4. `stripOccupancy.align`

- **Durum:** KALDIRILACAK (§ A adım 4)
- **Karar:** Tablo kalkınca alan yok; short-up kotu item `default_z_cm` + gövde height.
- **Kaynak:** `DATABASE.md` `fair_stand_item_strip_occupancy` (CHECK yalnız `top`).
- **Yasak:** § A adım 1–3 bitmeden tablo/CRM silinmez.

### B.5. `stripOccupancy.stripCount`

- **Durum:** KALDIRILACAK (§ A adım 4–5)
- **Karar:** Panel adedi ürün BOM/layout’ta; stand `strip_count` (7) ile karışmaz — o da § C.1 ile gider.
- **Kaynak:** `DATABASE.md` (8 short-up satırı).
- **Yasak:** § A adım 1–3 bitmeden silinmez.

### B.6. Panel arası boşluk (runtime vs DB)

- **Durum:** KAPANDI — `fair_stand_dimensions.panel_rail_height_cm` (seed 0.4); bootstrap → `STAND_DIMENSIONS.panelRailHeight`; CRM settings formu
- **Karar:** Tek standart cm (tavanla çarpılmaz). `wallGapCm` (B.2) ayrı ürün alanı.
- **Kaynak:** `STAND_DIMENSIONS.md`; migration `0034_stand_panel_rail_height`

### B.7. Duvar / vitrin seed SKU’ları (gizli 350)

- **Durum:** BACKLOG (§ A adım 1)
- **Karar:** `wall_*`, vitrin, kapı vb. ayrı yükseklik SKU’ları (`wall_200_100`, `wall_200_250`, …); banko modeli (kendi 100 cm) referans.
- **Kaynak:** `SCENE_POSE.md` hedef; mevcut seed `scene height=350`, `upright_346_5`, panel ×7.
- **Yasak:** Tek `wall_200` ile tavan değişimine bağlı “otomatik boy”.

### B.8. `variant` (wall-short-1 / wall-short-2)

- **Durum:** KORUNACAK (şimdilik)
- **Karar:** Occupancy kalkınca yalnız kimlik/seed ayrımı; şerit sayısı anlamı taşımaz.
- **Kaynak:** `ITEMS.md` kuyruk (8 Item).

### B.9. Item snap — item_type + rule_type + rule (P0 kilit)

- **Durum:** UYGULAMA — `fair_stand_item_type` + kural tabloları; item `item_type` FK; motor rule id
- **Ürün kuralı:** CRM’de item type / kural tipi / kural CRUD; item’da Type (key) + requires|provides rule
- **Kimlik:** kataloglarda `key` (unique); ad→slug + elle düzeltme
- **Geometri:** yalnız face / edge enum (CRM select + hint); **mount_mode kaldırıldı**
- **Tip bağı:** kural ↔ tip(ler) M:N (`fair_stand_rule_item_type`); aile tablosu kaldırıldı (`0029`)
- **Hedef:** `SCENE_POSE.md` Snap; `DATABASE.md` tip/kural
- **Raf:** kural `shelf-rail` face=front edge=top → seam / band geometrisi
- **Yasak:** Type→kural runtime map; item üzerinde free-text capability string kolonları

### B.7. Parent BOM ↔ leaf ölçü uyumu (uyarı; auto-fix yok)

- **Durum:** KARAR — uygulama ertelendi (şimdi kod yok)
- **Örnek kanon:** `wall_200` (zarf W=200 / H≈350) + leaf `panel_197` (197×47) BOM `×7`
- **Karar (admin / soft-warning):**
  1. Leaf veya parent ölçü / BOM `quantity` değişince **uyarı** göster; kaydı engellemek zorunda değil (bilerek override serbest).
  2. Yatay örnek: `panel_197.width` 220 olurken parent `wall_200.width` 200 → taşma uyarısı; etkilenen parent’lar listelenir.
  3. Dikey örnek: `quantity × leaf.height` (ilk dilim; boşluk payı sonra netleşir) `> parent.sceneHeight` → taşma uyarısı (`7×47` sığar, `8×47` sığmaz).
  4. **Auto-fix yok:** quantity / leaf / parent ölçü otomatik yeniden yazılmaz.
- **Sahne (ayrı borç):** Sessiz clamp kaldırıldı (2026-09-24): `resolveFlatPanelStripCount` = BOM qty; height = qty × pitch. Soft-warning admin (§ madde) hâlâ kod yok.
- **Kaynak:** `ITEM_FIRST_ROADMAP.md` P1; `wall_200` seed; `items.js` `resolveFlatPanelStripCount`
- **Yasak:** Uyarıyı “geçsin diye” kapatmak; clamp’i ürün özelliği sanmak; auto-recalc quantity

### B.10. `is_render` = çizilir

- **Durum:** KARAR — sahne child mesh henüz yok
- **Karar (2026-09-25):** `is_render=true` ise sistem o SKU’yu çizer. Katalog yalnız sürükle-bırak. Reçetede kullanılan parça `is_render=false` bırakılmaz. `connector`, vitrin gövde, cam raf ve video duvar paneli de true. Zemin false kalır. `shelf_leg` canlı raf reçetesinde liste satırıdır; `is_render` false kalır, sahne çizmez. Bağlayıcının kendi modül fabrikası yoktur.
- **Bugün:** Reçeteli modül, gömülü `is_render` parçayı (`panel`, `separator-panel`, `base-top`, `counter-top`) yüzeye bağlar. Katalog bu kapıya girmez. `connector_*` false, mesh yok.
- **Kaynak:** `ITEMS.md` § isRender; `FAIR_STAND_DB_KULLANIM_KILAVUZU.md` § `is_render`
- **Yasak:** Çizimi katalog kartına bağlamak; `is_render=true` child’ı atlayıp kutu basmak; bir item ailesini kalıcı “çizilmez” ilan etmek

### B.11. Panel → cam dönüşümü BOM’a yansır

- **Durum:** KOD — cam ikizler katalogda; üretim listesi cam şeridi ikize yazar
- **Karar (2026-09-26):** Sahnede bir panel cama çevrilirse üretim listesi reçete toplamını olduğu gibi basmaz. Cam adet, şeridin kendi anahtarından türetilir: `panel_xxx` → `panel_cam_xxx`, `panel_corner_xxx` → `panel_corner_cam_xxx`. Tip `panel-glass`, `is_render` false, malzeme `cam`, renk ve kapak kabulü yok. Ölçü kaynak panelden kopyalanır (derinlik 0,8 cm). Düz aile: `panel_48_5`, `panel_98`, `panel_147_5`, `panel_197`. Köşe ailesi: `panel_corner_42_5`, `panel_corner_92`, `panel_corner_142_5`, `panel_corner_192`. Örnek: `panel_197` reçetede 7; 4 şerit cam ise BOM = `panel_197` × 3 + `panel_cam_197` × 4. Cam adedi reçetedeki panel miktarını geçemez. Separatör paneli bu eşlemeye girmez. Cam SKU elle seçilmez; miktar uydurulmaz.
- **Kaynak:** Üretim listesi; `src/panelGlassBom.js`. Seed `panel_cam_*` migration `0043_panel_glass_family`. Seed `panel_corner_cam_*` migration `0044_panel_corner_glass_family`.
- **Yasak:** `cam_xxx` anahtarı; `panel_corner_cam` yerine `panel_cam_corner`; reçete adedinden fazla cam yazmak; separatör panelini bu ikize bağlamak

### B.11b. Metal separatör — gizli m² kalemi, listede adet satırı

- **Durum:** KOD — 2026-10-08
- **Karar:** Sağ tık `Metal Separatöre Çevir` cam kabul eden paneli tel ızgaraya çevirir. Ctrl ile seçilen eksiksiz dikdörtgen tek ölçüdür. Aynı grup kimliği tek levha demek değildir: grup sonradan fiziksel olarak ayrılırsa (modül taşınır ya da silinir, satırlar arasında boşluk kalır) liste her bitişik bloğu ayrı levha yazar. Bitişiklik, aynı modülde ardışık şerit ve sahnedeki Ctrl seçimiyle aynı placement kuralıdır (`rectSelection.js` `panelModulesConnected`); placement yoksa liste sırasında komşu modül. Örnek: 197 + 98 cm panel tek grupta ama arada 200 cm boşluk → `1 x 197 × 47` + `1 x 98 × 47`, toplam m² aynı (2026-10-17). Çoğaltılan modülün metal grubu yeni kimlik alır; kopya ile orijinal ayrı levhadır (2026-10-16). Kalem `metal_separator`, tip `panel-glass`, katalogda görünmez, birim `metre_kare`, `is_cost_enabled` true. Sunta adedi düşer. Paneller satırı `7 x Metal Separatör 100 × 49,5 cm - metre_kare` yazar. Üretim satırı `3,47 × Metal Separatör · metre_kare · metal_separator` yazar. Ayrı “Toplam m²” cümlesi yazılmaz.
- **Kaynak:** `src/scene3d.js`, `src/panelGlassBom.js`, `src/printAreaBom.js`, `src/rectSelection.js`, `src/productionBomPanel.js`. Migration `0065_metal_separator`, `0066_metal_separator_area`.
- **Yasak:** Katalog kartı açmak; ölçü satırına etiketsiz “Toplam m²” eklemek; birimi adet sayıp fiyatı metre kare sanmak

### B.12. İç köşe — separatör duvarla aynı aparat, paneli değişmez

- **Durum:** KOD — 2026-09-27; üretim listesi iç köşede uygular. Panel adedi reçeteden gelir (yerel seed separatör 50 hâlâ 1×48,5 + 3×98 ise liste onu basar; ×7 örneği canlı katalog satırıdır).
- **Karar:** İç köşede separatör 50, `wall_50` köşesiyle aynı aparat / dikme / profil sonucunu verir. Separatör 100, `wall_100` ile aynı. Separatör paneli `panel_corner_*` olmaz. Sarmaşıklı separatör, aynı genişlikteki düz separatörle aynıdır; reçetedeki sarmaşık kalemi adediyle geçer.
- **Örnek (`wall_200` + separatör, iç köşe):** Dikme 3, başlangıç 4, tekli 14, köşe aparatı 12, çiftli 0. Duvar paneli `panel_corner_192` × 7. Separatör 50: `profile_41_5` × 2, `separator_panel_48_5` × 7. Separatör 100: `profile_91` × 2, `separator_panel_98` × 7. `wall_200` profili `profile_190` × 2. Sarmaşık 50 ve 100 bu iki tablonun aynısıdır.
- **Kaynak:** Üretim listesi köşe turu. Yan yana separatör kuralından ayrı.
- **Yasak:** Separatör panelini köşe paneline çevirmek; separatör 50 reçetesindeki 7 tekliden aparat uydurmak; sarmaşığı düz separatörden farklı aparat vermek

### B.13. Yan yana çiftli ve iç köşe — duvar ailesi

- **Durum:** KOD — 2026-09-27. Duvar eklemi durur. Baza dizisi ve aynı genişlikteki host sırtı `baseRunBom.js` içinde. Short-up yok. F-031 defterde OPEN; kapanış kaydı yok.
- **Karar:** Kilitli çift, tam boy duvar, kapı, separatör (sarmaşık dahil) ve vitrin 2/3 arasındaki her birleşimdir. Separatör, duvar yüzüyle aynı dikme ve aparat hesabını kullanır. Yan yana: ortak dikme, çiftli aparat, paneller aynı kalır. İç köşe: ortak dikme, köşe aparatı, çiftli 0. T: ortak dikme, köşe aparatı, çiftli 0. Düz panel `panel_48_5/98/147_5/197` → `panel_corner_42_5/92/142_5/192`. Kapı ve vitrin `panel_98` → `panel_corner_92`. Separatör paneli değişmez.
- **Yan yana (tek eklem):** Duvar↔duvar ve duvar↔separatör: tekli 12 (6+6), çiftli 7, dikme 3, başlangıç 4. Duvar↔kapı: tekli 8 (6+2), çiftli 3. Duvar↔vitrin 3: tekli 12 (9+3), çiftli 4, başlangıç 6. Duvar↔vitrin 2: tekli 12 (8+4), çiftli 5, başlangıç 6. Aynı yüz hesabı duvarsız çiftte de durur. İki separatör 50: tekli 12, çiftli 7, dikme 3. İki kapı: tekli 4, çiftli 3, dikme 3. Vitrin 2↔vitrin 3: tekli 8, çiftli 4, dikme 3.
- **İç köşe (tek eklem):** Duvar tarafı −6 tekli +6 köşe, kalan tekli 7. Kapı −2/+2. Vitrin 3 −3/+3. Vitrin 2 −4/+4. İki duvar: tekli 14, köşe 12, dikme 3. Duvar+kapı: tekli 10, köşe 8. Duvar+vitrin 3: tekli 11, köşe 9. Duvar+vitrin 2: tekli 12, köşe 10. Separatör köşesi B.12.
- **Ön / arka:** Köşe aparatı yalnız diğer modülün gövdesi bu modülün ön yüzündeyse yazılır. Arkada duran modül tekliyi korur, köşe almaz. Panel değişimi iki katılımcıda da olur. Dikme −1 durur. İki `wall_100`, arka yüz: tekli 20, köşe 6, başlangıç 4, dikme 3.
- **T:** Çiftli 0. Dikme tasarrufu katılımcı sayısı − 1. Köşe, ön yüze bakan ucun kilitli iç köşe deltasıdır. Duvarın ortasına gelen dal: host düz paneli korur ve köşe ödemez, dal öder (dikme 3, çiftli 0, köşe 6). Aynı noktada iki doğrultuda duvar + dal tek T’dir (dikme 4, çiftli 0, köşe 16, başlangıç 8).
- **Baza:** Serbest dizide `n` baza için panel `2n+2`, başlangıç panel × 2, tekli `2n+6`, dikme 49,5 ve profil 41,5 `2n+2`, dışta 2 yanak. Aynı genişlikte duvar, separatör veya vitrin sırtında o bazanın uzun profili 2 kalır, uzun panelden biri düşer. Paylaşılan arka dikme bir kez düşer. Host satırı durur.
- **Kaynak:** `src/relationshipBom.js`, `src/baseRunBom.js`. Test: `test/relationshipBomJoints.test.js`, `test/baseRunBom.test.js`.
- **Yasak:** Aparat adedini kısa reçetedeki tekli sayısından ölçeklemek; short-up uydurmak; separatör panelini köşe paneline çevirmek

### B.15. Aynı genişlikte dikey short kolonu

- **Durum:** KOD — short ailesi, birebir aynı izdüşüm ve genişlikte, Z’de değen veya örtüşen kolonda.
- **Karar:** Kolonda en az bir short varsa profil yalnız en alt ray ve en üst raydır. Başlangıç aparatı yalnız en altta 2’dir. Short, kendisini saran modülün içindeyse kendi profilini ve başlangıcını bırakır. İki raylı duvar veya separatör kolonun en altı ya da en üstü değilse o ray düşer. Kapı kolonunda profil yalnız kapının tek profilidir; üstündeki short profil eklemez. Vitrin kendi profil ve başlangıcını korur. Farklı genişlik, kayık izdüşüm ve Z boşluğu bu düşümü yapmaz. İki short köşesinde ödeyen yüz, panel bandı kadar tekliyi köşeye çevirir: short 1 için 1, short 2 için 2. Tam boy ortağa bakan short yüzü yine 1 öder. Komşu uçtaki tek yuva bir short eklemi alır; aynı uçtaki ikinci short o yuvayı ikinci kez kullanmaz. Short, 346,5 dikmenin üstüne Z’de değerek biniyorsa o kolonun dikmeleri tek kalemdir: 346,5+49,5 → `upright_396`, 346,5+99 → `upright_445_5`, 346,5+99+49,5 → `upright_495`. Her plan ucu bir dikmedir; paylaşılan uç bir kez sayılır. Short gövdenin içindeyse parçalar ayrı kalır. Yalnız short olan kolon birleşmez.
- **Örnek (`wall_200` + short 2 + short 1, hepsi 200, short’lar gövdenin içinde):** Profil 190 × 2, başlangıç × 2. Dikme 346,5 × 2, dikme 99 × 2, dikme 49,5 × 2, panel 197 × 10, tekli × 19. Short’lar duvarın üstüne bindiyse aynı kolon dikme 495 × 2 yazar; 346,5, 99 ve 49,5 kalmaz. Aynı L’nin iki kolu da böyle üst üste ise dikme 495 × 3, köşe 18, tekli 20’dir: duvar köşesi 12, short 2 köşesi 4, short 1 köşesi 2.
- **Kaynak:** `src/relationshipBom.js` `applySameWidthShortColumns`. Test: `test/wallShortRelationshipBom.test.js`.
- **Yasak:** Genişlik farklıyken ray veya dikme birleştirmek; kapı veya vitrin profilini bu kolonla eksiltmek; short gövdenin içindeyken dikmeleri tek kaleme çevirmek; yalnız short kolonuna 396 / 445,5 / 495 yazmak

### B.14. Üretim listesi — proje toplamı

- **Durum:** KOD — 2026-09-27. F-030 defterde OPEN; kapanış kaydı yok.
- **Karar:** `resolveProjectBom` sahnedeki modüllerin reçetelerini toplar, B.13 eklemini ve B.11 cam ayrımını uygular, zemin satırını ve baskı alanını ekler. Liste kayıt bitince yenilenir (elle kayıt ve yaklaşık 30 sn otomatik kayıt). Sürükleme anında yenilenmez.
- **Baskı:** Dijital Baskı, Lightbox Bezi, Mesh - Delikli Branda ve Işıklı Strafor / Logo, birleşik leaf toplamının içinde başlıktır. Ayrı kart değildir. Ölçü, panel kaydında scene dimensions alanı doluysa oradan, boşsa item dimensions alanından gelir. Gruplu görsel veya kumaş bloğu tek parçadır. m² = genişlik × yükseklik / 10000. Satır dosya adı ile başlar; ad çözülemezse Görsel yazar. Görsel yoksa lightbox veya delikli branda satırı panelin hex rengiyle başlar. Aynı dosya veya aynı renk, aynı ölçüde adette birleşir. Farklı dosyalar aynı ölçüde ayrı satırdır. Aynı dosya veya rengin farklı ölçüleri ayrı satırdır; birden fazla ölçü varsa altında o kimliğin toplam m²’si yazar. Bölüm toplamı durur. Lightbox veya delikli branda üzerindeki görsel ikinci kez görsel sayılmaz. Işıklı Strafor / Logo modüldeki `imageAssetId` adını kullanır. Üretim kalemi `illuminated-foam`dır. Boş başlık yazılmaz.
- **Metin:** Metin indir düğmesi listeyi `uretim-listesi.txt` olarak kaydeder. Satır düzeni ekrandakiyle aynıdır.
- **Grup:** Satır item tipine göre gider. `shelf` ve `shelf-accessory` Raflar altındadır. `illuminated-foam` ve `tulle-fabric` Üretim altındadır. Tanımsız tip Extra’ya düşer.
- **Modüller:** Liste tek bir Modüller katında kapalı başlar. Kat açılınca her modül kendi içinde kapalı kalır; açık bırakılan modül kayıt yenilemesinde açık kalır.
- **Pencere:** Sayfa içi kutu tarayıcıdan çıkamaz. Ayrı pencere diğer ekrana taşınır; kayıt o pencereyi de günceller.
- **Raf:** Canlı katalogda `shelf_100` / `shelf_150` / `shelf_200` reçetedir; tahta `shelf_*_self`, ayak `shelf_leg`. Reçete parent satırını basmaz, çocukları basar. Seed hâlâ bu üç rafı reçetesiz yaprak sayar; liste sayfası canlı katalogu okur.
- **Kaynak:** `src/projectBom.js`, `src/printAreaBom.js`, `src/bomLineGroups.js`, `src/productionBomPanel.js`.
- **Yasak:** Baskı alanını ayrı “Baskı alanları” kartı yapmak; camı hem panel hem görsel saymak; short-up eklemi uydurmak

### B.16. Açık standın duvar yüksekliğini sonradan değiştirmek

- **Durum:** BACKLOG — 2026-10-19 (kullanıcı kararı: şimdi gerek yok, ileride olmalı; rakipler yapıyor).
- **Bugün:** Duvar yüksekliği (250–500) yalnız “Sahneyi Oluştur”da seçilir, `stand.wallHeightCm` kaydedilir. Açık standda değiştirmek için mevcut duvar, kapı, vitrin ve kısa duvarların `resolveWallItemKeyForHeight` ile yeni yüksekliğe çevrilmesi ve sahnenin yeniden kurulması gerekir.
- **Kaynak:** `REFACTOR.md` 2026-10-19 Duvar yüksekliği kuralı.

---
## C. Stand zarfı ve DB (Item tablosu değil)

### C.1. `fair_stand_dimensions.strip_count` / `strip_height_m` / height CHECK

- **Durum:** KALDIRILACAK (§ A adım 5)
- **Karar:** Zarf yalnız max `height_m` (+ depth/frame). Ürün panel ızgarası item layout’ta.
- **Kaynak:** `DATABASE.md` § `fair_stand_dimensions`; CRM ayar formu.
- **Yasak:** CHECK kalkmadan seed’de tutarsız height bırakılmaz.

### C.2. Stand tavan fallback (collision / ghost / mesh)

- **Durum:** KALDIRILACAK (§ A adım 6)
- **Karar:** Item’da height yoksa tavan kullanımı biter; eksik ölçü seed/validation hatası.
- **Kaynak:** `SCENE_POSE.md` STAND_DIMENSIONS hedef; `STAND_DIMENSIONS.md`.

### C.3. `TYPE_BEHAVIORS` (placement davranışı)

- **Durum:** KAPANDI — kesit 1+2+3 + overlap FK; JS map yok; motor DB-only
- **Operatör kılavuzu:** `FAIR_STAND_DB_KULLANIM_KILAVUZU.md` (§ tip vs snap)
- **Migration arşivi:** `TYPE_BEHAVIORS_DB_ROADMAP.md`
- **Karar (analiz 2026-09-24):** Snap dilimi şablon. Davranış paketi **`fair_stand_item_type` kolonlarına**. Item override / snap çoklu requires-provides ayrı epic. Export etkilenmez.
- **Kaynak:** `DATABASE.md`; `moduleBehavior.js`; `SCENE_POSE.md` snap şablonu
- **Yasak:** Tip davranışını JS map’e geri almak; enum rename; placement’ı proje ZIP’e gömmek

### C.4. `overlaySnap = 'panel-seam'`

- **Durum:** KAPANDI — `usesPanelSeamOverlaySnap` ← requires `shelf-rail` veya face front/back + edge top (mount_mode yok)
- **Karar:** Raf host + seam geometrisi; type map `overlaySnap` yok
- **Kaynak:** `SCENE_POSE.md` § Snap
- **Kalıntı:** yok — `scene3d` snap meta `requires: 'shelf-rail'` (2026-09-24)

### C.5. `MODULE_CONTRACT_ASSIGNMENTS` (per-itemKey JS allowlist)

- **Durum:** KAPANDI — per-SKU map silindi; `resolveModuleContract` tip + composition’tan türetir (`TYPE_CONTRACT_PROFILE` / recipe|self|decision-required)
- **Kod gerçeği:** `src/moduleContracts.js` governance-only; production import etmez
- **Karar:** Yeni SKU için JS satırı gerekmez (aynı tip). Planter istisnası: `itemKey` …`planter`… → `free-model-color`
- **Kaynak:** `ITEM_FIRST_ROADMAP.md` P2
- **Yasak:** Contract’ı runtime görsel/catalog kaynağı sanmak

---

## D. ITEMS.md runtime kuyruğu (henüz PENDING maddesi yok)

Aşağıdakiler **onaylı şemada değil**; karar verilince B veya C’ye madde açılır veya şemaya alınır. Tam liste: `ITEMS.md` § *Runtime field kuyruğu*.

| Alan / grup | Durum | Not |
|---|---|---|
| `type`, `name`, `unit` | KUYRUK | Davranış/BOM; `type` → C.3 ile ilişkili |
| `composition` / `composition.items` | KUYRUK | Recipe BOM; onaylı parça, tam şema değil |
| `paintable` | KUYRUK | 5 Item; Color mekanizması yok (§ D.1) |
| `modelFile`, `modelRotationYDeg`, `preserveModelScale`, `visualRotationYDeg` | KUYRUK | GLB Item’ları |
| `bodyItems.*` | KUYRUK | Vitrin yan/yatay/cam; B.1 ile kesişir |
| `videoWall.*` | KUYRUK | 2 Item |
| `defaultColor`, `material` | KUYRUK | Renk/malzeme şeması ayrı |

### D.1. Color / Image / Lighting / Delete mekanizmaları

- **Durum:** YAPILMADI
- **Karar:** `ITEMS.md` § *Canonical Mechanism Connections* yer tutucu; config şeması yok.
- **Yasak:** `accepts*` kolonları kaldırılmaz; UI yeteneği master’da kalır.

---

## E. Proje / envanter (Item değil)

### E.1. `fair_stand_projects.organization_id`

- **Durum:** MEVCUT — genişletme kuyruğu
- **Karar:** Core org UUID, FK yok; list/filter/path `{org}/…` çalışıyor. Proje–org bağının ürün kuralları (paylaşım, varsayılan org) ayrı karar.
- **Kaynak:** `DATABASE.md` § `fair_stand_projects` / assets.

---

## F. Kapalı / arşiv (bu dosyada açılmaz)

| Madde | Sonuç |
|---|---|
| § A eski adım 1 — ölü occupancy layout | `REFACTOR.md` 2026-09-22 occupancy |
| `nominalModuleWidthCm` / inner-corner recipe | `REFACTOR.md` 2026-09-20 |
| `composition.moduleType` / `composition.options.shape` / DB `composition_module_type` | Migration `0014`; dump + fixture temiz; bootstrap yalnız `mode` + `items` |
| SCENE_POSE pose adım 7 (ortak kutu primitive) | Örnek; sistemde yok, atlandı |

---

## G. Hızlı çapraz tablo (çakışma kontrolü)

| Konu | PENDING | SCENE_POSE | DATABASE / ITEMS |
|---|---|---|---|
| strip occupancy | B.4–B.5 KALDIRILACAK, § A.4 | Hedefte yok | Tablo + 8 satır |
| mount vs default Z | B.3 ARAŞTIRILACAK | defaultZ drop hedefi | İki kolon |
| wallGap vs panel boşluğu | B.2 koru, B.6 KAPANDI | Standart boşluk = panel_rail | wall_gap_cm ayrı |
| TYPE_BEHAVIORS | C.3 KAPANDI | — | `FAIR_STAND_DB_KULLANIM_KILAVUZU.md` + `TYPE_BEHAVIORS_DB_ROADMAP.md` |
| Contract allowlist | C.5 KAPANDI | — | tip’ten türet (`moduleContracts.js`) |
| Item snap (Profile host) | B.9 UYGULAMA | snap face/edge kuralda | rule FK; legacy `snap_target_item_type` / `snap_anchor` nullable |
| BOM ↔ leaf fit uyarı | B.7 KARAR (admin kod yok; sahne clamp kalktı) | zarf item’da | recipe `quantity` + leaf dims |
| Panel ray boşluğu | B.6 KAPANDI | — | `panel_rail_height_cm` |
| Kaldırma sırası | § A canonical | Hedef metin | strip kolonları § C.1 |

