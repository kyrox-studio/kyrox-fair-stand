# Fair Stand — Master Roadmap

> Bu dosya yalnız **üst seviye proje planını** tutar. Detaylar `ROADMAP_PHASE_4.md` ve `kyrox-platform/projects/fair-stand/ROADMAP_PHASE_5_6.md` içindedir. Aynı iş iki roadmap içinde tekrar edilmez.
>
> Roadmap maddeleri yalnız isim benzerliğine göre tamamlandı sayılmaz. Durum işaretleri repository source code + regression testleriyle doğrulanır.
>
> **Production dataset kuralı:** Fiziksel parça ölçüleri, `itemKey` kimlikleri ve recipe miktarları roadmap içinde ikinci bir canonical veri seti olarak tutulmaz. Bu verilerin canonical sahibi PostgreSQL `fair_stand` (Fair Stand API `:8002`) Item / composition kayıtlarıdır. Runtime'da `src/items.js` bu veriden bootstrap edilen Item registry'yi, `src/moduleRecipes.js` Item `composition` satırlarını açan resolver'ı taşır. BOM politika sözleşmesi `src/moduleContracts.js`'dedir (governance; runtime BOM `src/itemBom.js` / `src/projectBom.js`).

## Proje durumu

- **FAZ 1: KAPANDI — 10 Ağustos 2026**
- **FAZ 2: KAPANDI — Yerleşim motoru temeli tamamlandı**
- **FAZ 3: KAPANDI — 26 Ağustos 2026**
- **FAZ 4: AKTİF — Modül reçetesi + Parametrik / Custom / Yapısal Editör**
- **FAZ 5: PLANLANDI — Final BOM / Gerçek Sahne Malzeme Listesi**
- **FAZ 6: PLANLANDI — Maliyet / Fair CRM Entegrasyonu**

### 3 Eylül 2026 implementasyon doğrulaması (veri kaynağı 13 Ekim 2026'da koda göre güncellendi)

FAZ 4 tamamen sıfırdan başlamıyor. Repository incelemesinde şu altyapılar **mevcut ve testli** olarak doğrulandı:

- Item kimliği `itemKey`'dir; Item kaydında `partId` yoktur. Item ve reçete verisi PostgreSQL `fair_stand`'dadır; `src/items.js` bu veriyi bootstrap edip `getItem()` ile sunar. Statik JS Item master (`LEAF_ITEMS` dahil) kaldırıldı.
- Standart panel / profil / dikme / connector Item'ları DB kataloğunda tanımlıdır ve `getItem()` ile çözülür.
- Standart duvar ve diğer modül reçeteleri Item `composition` kaydıdır. Reçete satırları `itemKey` taşır; `src/moduleRecipes.js` içindeki `expandRecipe` child kaydı `getItem()` ile bağlar.
- `test/moduleRecipes.test.js` connector kimliklerini ve standart duvar reçetelerini doğrular.

Buna karşılık aşağıdakiler **henüz tamamlandı kabul edilmez**:

- scene-instance seviyesinde izlenebilir Raw BOM pipeline'ı,
- parametrik definition/config modeli,
- custom module wizard/library,
- explicit `sourceAnchor -> targetAnchor` connection graph,
- connection-semantic tabanlı Final BOM normalization,
- Fair CRM costing entegrasyonu.

Bu ayrımın detaylı checklist karşılığı `ROADMAP_PHASE_4.md` içindedir.

---

# FAZ 4 — Modül Reçetesi + Parametrik / Yapısal Editör

Önce her modülün fiziksel yapısı canonical recipe/part katmanlarında tanımlanır; sonra parametrik/custom sistem bunun üzerine kurulur.

Ana işler:

1. Panel / dikme / profil / aparat parça modeli — **KISMEN / temel sözlük mevcut**.
2. Standart duvar reçeteleri — **MEVCUT / TESTLİ**.
3. Module Recipe + Raw BOM motoru — **KISMEN / recipe registry mevcut, instance Raw BOM tamamlanmadı**.
4. Parametrik Core / Rule Engine — **PLANLANDI**.
5. Custom Modül Wizard — **PLANLANDI**.
6. Raflı Duvar parametrik pilotu — **PLANLANDI**.
7. Anchor / Connection Graph ve iç köşe / inline semantiği — **PLANLANDI**.
8. İki nokta arasında kayıt/profil aracı — **PLANLANDI**.
9. Custom Module Library — **PLANLANDI**.
10. Project save/load + versioning — **mevcut proje storage altyapısından ayrı FAZ 4 parametrik round-trip kapsamı henüz tamamlanmadı**.
11. Regresyon ve FAZ 4 kapanışı — **PLANLANDI**.

**FAZ 4 çıktısı:** Her modül kendi fiziksel reçetesini/Raw BOM'unu bilir ve sahnedeki gerçek bağlantılar açık connection graph olarak saklanır.

Detay: `ROADMAP_PHASE_4.md`

---

# FAZ 5 — Final BOM / Gerçek Sahne Malzeme Listesi

FAZ 4'te kendi reçetesini bilen modüllerin sahne seviyesinde gerçek toplamı hesaplanır.

Ana işler:

1. Tüm instance Raw BOM'larını toplama.
2. Connection graph analizi.
3. Normal / iç-köşe panel varyantlarının sahne bağlamında doğrulanması.
4. Tekli / köşe / çiftli / başlangıç aparatlarının nihai kullanımı.
5. Ortak dikme / profil / aparat normalization.
6. Final BOM.
7. Panel/yüzey m² miktarları.
8. Gerçek Excel ile satır satır doğrulama.
9. Gerçek kabul senaryoları.

**FAZ 5 çıktısı:** Fiyatsız ama doğru fiziksel malzeme ve miktar listesi.

Detay: `kyrox-platform/projects/fair-stand/ROADMAP_PHASE_5_6.md`

---

# FAZ 6 — Maliyet / Fair CRM Entegrasyonu

FAZ 5 Final BOM'u ticari veriye dönüştürülür.

Ana işler:

1. Fair CRM / Kyrox Core platform entegrasyonu.
2. Part ID → Fair CRM catalog/fiyat eşlemesi.
3. Hazır sahne objelerinin ticari miktarı.
4. Fire / minimum sipariş kuralları.
5. İşçilik, nakliye, kurulum, elektrik vb. ek maliyetler.
6. Costing engine.
7. Eksik catalog/fiyat uyarıları.
8. Project / BOM / Cost revision ve audit.

**FAZ 6 çıktısı:** Doğrulanmış malzeme listesinden izlenebilir ve deterministik proje maliyeti.

Detay: `kyrox-platform/projects/fair-stand/ROADMAP_PHASE_5_6.md`

---

# Aktif geliştirme sırası

1. **FAZ 4 / Sprint 1 — Mevcut Production Parts temelini eksik contract'larla tamamla**
2. **FAZ 4 / Sprint 2 — Mevcut Module Recipe registry'sini gerçek instance Raw BOM motoruna tamamla**
3. **FAZ 4 / Sprint 3 — Parametrik Core / Rule Engine**
4. **FAZ 4 / Sprint 4 — Custom Wizard + Raflı Duvar**
5. **FAZ 4 / Sprint 5 — Anchor / Connection Graph**
6. **FAZ 4 / Sprint 6 — İki Noktalı Profil Aracı**
7. **FAZ 4 / Sprint 7 — Custom Library + Save/Load / Versioning**
8. **FAZ 4 / Sprint 8 — Regresyon ve kapanış**
9. **FAZ 5 — Final BOM / Assembly Normalization / Excel doğrulaması**
10. **FAZ 6 — Fair CRM / Costing / Revision-Audit**

---

# Production source-of-truth

Roadmap, üretim veri tablosu değildir. Güncel üretim gerçekleri aşağıdaki canonical kaynaklardan okunur:

- PostgreSQL `fair_stand` (Fair Stand API `:8002`) — kanonik `itemKey` kimlikleri, type, birim, fiziksel metadata ve Item `composition` (reçete) satırları,
- `src/items.js` — bu veriden bootstrap edilen runtime Item registry'si (`getItem()`); ikinci master değildir,
- `src/moduleRecipes.js` — `composition` satırlarını `itemKey` üzerinden açan resolver (`expandRecipe`),
- `src/moduleContracts.js` — modülün BOM politika sözleşmesi (`recipe`, `decision-required` vb.; governance, runtime BOM `src/itemBom.js` / `src/projectBom.js` onu import etmez),
- `test/moduleRecipes.test.js` ve ilgili contract testleri — bu veri/ilişkilerin regresyon güvencesi.

Roadmap içinde sabit panel/profil/dikme ölçüleri veya belirli bir duvarın parça adetleri tekrar yazılmaz. Üretim dataset'i değişirse yalnız canonical veri (Alembic migration / Admin) ve onu doğrulayan testler değiştirilir; roadmap yalnız plan/acceptance durumunu anlatır.

Köşe ve modül birleşimlerinin üretim kararı da doğrulanmış canonical veri olmadan roadmap metninden türetilmez.

---

# Kapanış checkpoint'i

FAZ 3 kapanış checkpoint commit'i:

`786672b5 — FAZ 3 Completed`
