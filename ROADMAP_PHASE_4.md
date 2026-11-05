# Fair Stand — FAZ 4 Roadmap

> **Tek kaynak:** Bu belge FAZ 4'ün detaylı uygulama planıdır. `ROADMAP.md` yalnız üst seviye durum/özet tutar. Nihai sahne BOM'u ve maliyet işleri `kyrox-platform/projects/fair-stand/ROADMAP_PHASE_5_6.md` içindedir.
>
> Checkbox'lar yalnız source code ve regression testleriyle doğrulanmış mevcut implementasyonu gösterir. Kısmi altyapı varsa madde tamamlandı sayılmaz; açıklama notuyla belirtilir.
>
> **Production dataset kuralı:** Fiziksel parça ölçüleri ve recipe adetleri bu roadmap içinde kopyalanmaz. Canonical üretim ve recipe verisi PostgreSQL `fair_stand` Item / `composition` kayıtlarıdır; runtime'da `src/items.js` (bootstrap edilen registry) ve `src/moduleRecipes.js` (`expandRecipe` resolver) üzerinden okunur. BOM politika sözleşmesi `src/moduleContracts.js`'dedir (governance; runtime BOM `src/itemBom.js` / `src/projectBom.js`).

## FAZ 4 ana hedefi

FAZ 4'ün görevi yalnız parametrik geometri üretmek değildir. Önce modüllerin **gerçek fiziksel reçetesini** canonical production/recipe katmanlarında tanımlamak, sonra bu reçeteyi parametrik/custom yapıya bağlamak ve sahnedeki gerçek bağlantıları güvenilir biçimde saklamaktır.

FAZ 4 sonunda bir modül kendi başına şu sorulara cevap verebilmelidir:

- Hangi fiziksel parçalardan oluşuyor?
- Hangi kanonik `itemKey` kimliklerini kullanıyor?
- Hangi başlangıç / tekli / köşe / çiftli bağlantı semantiğine sahip?
- Parametre değişirse kendi Raw BOM / module recipe çıktısı nasıl değişiyor?
- Sahnedeki başka modüllere nereden ve nasıl bağlı?

**FAZ 4'te yapılmayacaklar:** tüm sahnenin ortak parça düşümü/normalization sonucu olan Final BOM, fiyat/maliyet, fire, işçilik, Fair CRM fiyatlandırması.

## 3 Eylül 2026 doğrulanmış mevcut temel

- Item kimliği `itemKey`'dir; Item kaydında `partId` yoktur. Item verisi PostgreSQL `fair_stand`'dadır; `src/items.js` bunu bootstrap edip `getItem()` ile sunar. Statik `LEAF_ITEMS` master'ı kaldırıldı.
- Panel, profil, dikme ve connector Item'ları DB kataloğunda tanımlıdır ve `getItem()` ile çözülür.
- Standart duvar ve diğer modül reçeteleri Item `composition` kaydıdır; `src/moduleRecipes.js` bunları `expandRecipe` ile açar.
- `test/moduleRecipes.test.js` `itemKey` kimliğini ve standart duvar recipe ilişkilerini doğruluyor.
- Bu mevcut temel **scene instance Raw BOM**, parametrik config, custom definition ve connection graph anlamına gelmez; ilgili maddeler açık kalır.

---

# Temel mimari kuralları

- Üretim reçetesi geometri kodundan bağımsız bir veri modeli olur.
- Three.js mesh isimleri hiçbir zaman üretim parçası kimliği olmaz.
- Base definition, custom definition ve scene instance birbirinden ayrılır.
- Custom modülün geometry ve Raw BOM çıktısı aynı parametrik config'ten deterministik üretilir.
- Wizard ve sahne içi düzenleme aynı Rule Engine ve aynı recipe motorunu kullanır.
- Connection graph koordinat yakınlığı değil açık `sourceAnchor -> targetAnchor` ilişkisi taşır.
- Nihai sahne BOM'u ancak FAZ 5'te connection graph üzerinden normalize edilir.

---

# Sprint 1 — Üretim Parça Modeli + Standart Modül Reçeteleri

**Hedef:** Panel, dikme, profil ve aparat sistemini canonical üretim verisi ve testlerle güvenilir hale getirmek.

## 1.1 — Part / Material Definition

- [ ] Stabil kimlik / `materialId` modeli. — **Kısmi:** kanonik kimlik `itemKey`; Item kaydında `partId` yok; `materialId` contract'ı doğrulanmadı.
- [ ] Parça kategorileri en az: `panel`, `upright`, `profile`, `connector`, `shelf`, `lighting`. — **Kısmi:** temel üretim kategorileri mevcut; tüm hedef kategori seti tamamlandı sayılmıyor.
- [ ] Birimler: en az `adet`, `m`, `m²`, `set`. — **Kısmi:** mevcut leaf Item kayıtları ağırlıklı `adet` kullanıyor.
- [x] Gerçek fiziksel ölçüler canonical production metadata olarak tutulur.
- [ ] Opsiyonel `catalogRef` alanı ileride Fair CRM eşlemesi için hazır olur.
- [x] Üretim parçası kimliği Three.js implementation'ından bağımsızdır.

## 1.2 — Fiziksel standartların canonical sahibi

Bu roadmap fiziksel ölçü tablosu tutmaz.

- Production part kimliği, birimi ve fiziksel metadata: PostgreSQL `fair_stand` Item kaydı; runtime erişimi `src/items.js` / `getItem()`
- Modülün hangi part'ı hangi miktarda kullandığı: Item `composition` kaydı; runtime çözümü `src/moduleRecipes.js`
- Bu ilişkilerin regression doğrulaması: `test/moduleRecipes.test.js` ve ilgili contract testleri

**Kabul kriteri:** Standart üretim ailelerinin ihtiyaç duyduğu fiziksel metadata `src/items.js` / `getItem()` üzerinden çözülebilmeli ve recipe katmanı aynı `itemKey` kimliklerini kullanmalıdır. Roadmap'te bunların ikinci bir sabit sayı tablosu bulunmamalıdır.

## 1.3 — Aparat sözlüğü

- [x] Başlangıç aparatı `getItem('connector_start')` ile tanımlı.
- [x] Tekli / düz bağlantı aparatı `getItem('connector_single')` ile tanımlı.
- [x] Köşe bağlantı aparatı `getItem('connector_corner')` ile tanımlı.
- [x] Çiftli bağlantı aparatı `getItem('connector_double')` ile tanımlı.

Bağlantı aparatlarının gerçek sahne kullanım adedi yalnız module recipe ve ileride connection graph / Final BOM semantiğinden türetilir. Roadmap bu adetleri veya üretim formülünü ikinci kez tanımlamaz.

## 1.4 — Standart duvar recipe contract'ı

Standart duvar recipe tanımları canonical olarak DB'deki Item `composition` kayıtlarıdır ve `src/moduleRecipes.js` ile açılır. Fiziksel parça metadata'sı `src/items.js` üzerinden çözülür.

**Implementasyon durumu:** Standart duvar recipe aileleri kodda mevcut ve regression testleriyle doğrulanıyor.

**Kural:** Köşe ve modül birleşimlerinin adet reçeteleri gerçek üretim verisi ve explicit connection semantics ile doğrulanmadan tahmin edilip kodlanmaz.

**Sprint çıkışı:** Standart duvar ailesi için fiziksel parça sözlüğü ve doğrulanmış module recipe sistemi hazır olur; gerçek ölçü/miktar dataseti roadmap'te kopyalanmaz.

---

# Sprint 2 — Module Recipe / Raw BOM Motoru

**Hedef:** Her modülün kendi başına hangi fiziksel parçalardan oluştuğunu deterministik hesaplamak.

- [x] `ModuleRecipeDefinition` / eşdeğer model. — Mevcut implementation registry/object tabanlı recipe tanımı kullanıyor.
- [ ] Sabit adet + parametrik formül desteği. — Sabit/variant reçeteler mevcut; genel parametrik formül contract'ı tamamlandı sayılmıyor.
- [ ] Recipe çıktısı en az `itemKey`, `quantity`, `unit`, `dimensions`, `catalogRef` alanlarını taşıyabilir. — `itemKey`, `quantity` ve `expandRecipe` ile `part: getItem(...)` mevcut; `catalogRef` hedefi tamamlanmadı.
- [ ] Her scene instance bağımsız **Raw BOM** üretebilir.
- [ ] Raw BOM hangi instance/recipe'den geldiğini izlenebilir tutar.
- [ ] Parametre değişince Raw BOM otomatik değişir.
- [ ] Geometry ve Raw BOM aynı parametrik config'ten türetilir.
- [ ] Aynı input aynı geometry + aynı Raw BOM çıktısını verir.
- [ ] Unit testler. — Recipe / Item contract testleri mevcut; Raw BOM pipeline testleri henüz bu sprint maddesini kapatacak kapsamda değil.

**Sprint çıkışı:** Bir modülü sahneye koymadan bile `bu modül = şu parçalar` sonucu deterministik alınabilir.

---

# Sprint 3 — Parametrik Core / Rule Engine

**Hedef:** Üretim reçetesi bilen modülü parametrik hale getirmek.

- [ ] `ParametricModuleDefinition` ortak modeli.
- [ ] `BaseDefinition`, `CustomDefinition`, `SceneInstance` ayrımı.
- [ ] Stabil `definitionId`, `baseDefinitionId`, `instanceId`.
- [ ] `schemaVersion` / migration metadata'sı.
- [ ] Ana ölçüler için genel constraint sistemi; her modül tipi kendi izin verilen aralığını/adımını canonical definition'da tanımlar.
- [ ] Validation sonucu yalnız true/false değil, kural kodu ve açıklanabilir neden döndürür.
- [ ] Ölçü, placement/collision ve modül-spesifik kurallar tek Rule Engine'de birleşir.
- [ ] Parametrik config hem geometry hem Raw BOM üretiminde kullanılır.
- [ ] Unit testler.

**Sprint çıkışı:** Parametrik bir definition değiştiğinde geometry ve modül reçetesi birlikte ve tutarlı yeniden üretilebilir.

---

# Sprint 4 — Custom Modül Wizard + Raflı Duvar Pilotu

## Custom Modül Wizard

- [ ] Base modülden `Custom oluştur` akışı.
- [ ] Yalnız izin verilen parametreler gösterilir.
- [ ] Anlık constraint doğrulaması.
- [ ] Live/ghost preview.
- [ ] Geçersiz config kaydedilemez; nedeni açık gösterilir.
- [ ] Raw BOM / module recipe preview ileride UI'da gösterilebilir olacak şekilde hazır tutulur.
- [ ] Kaydedilmiş custom modül tekrar açılıp düzenlenebilir.
- [ ] `Sadece bu instance'ı düzenle` ile `custom definition'ı düzenle` ayrımı açık olur.

## Raflı Duvar pilotu

- [ ] Raflı duvar ayrı base geometri değil, duvarın parametrik varyasyonudur.
- [ ] Parametreler: başlangıç yüksekliği, raf aralığı, raf adedi.
- [ ] Raf zemine/en alt profile veya en üst profile doğrudan yerleşemez.
- [ ] Raf aralıkları modülün canonical constraint'i üzerinden doğrulanır; sabit üretim ölçüsü roadmap'te ikinci kez tutulmaz.
- [ ] `lighting: none | led` ile tek modelde ışıklı/ışıksız seçenek.
- [ ] LED state'i geometry, Raw BOM metadata, preview ve save/load içinde korunur.
- [ ] LED için ileride gerçek parçalara dönüşecek semantic metadata tutulur.

**Sprint çıkışı:** Custom modül yalnız görsel değil, kendi fiziksel reçetesini de bilen parametrik varyasyon olur.

---

# Sprint 5 — Anchor / Connection Graph

**Hedef:** Modüllerin sahnedeki gerçek yapısal ilişkisini bilmek.

- [ ] Duvar, separatör ve yapısal profiller tipli anchor/connection point üretir.
- [ ] Anchor dünya konumu, yön/normal, tip ve izin verilen hedef tiplerini taşır.
- [ ] Magnetic snap uyumlu anchor'lar üzerinden çalışır.
- [ ] Bağlantı state'i gerçek `sourceAnchor -> targetAnchor` referansı saklar.
- [ ] Modül taşınır/döndürülürse bağlantı yeniden hesaplanır veya invalid-state oluşur.
- [ ] Save/load sonrasında aynı connection graph geri kurulur.

## Üretim semantiği

- [ ] `INNER_CORNER`: iç köşe yapısal birleşimi.
- [ ] `INLINE_JOIN`: aynı doğrultuda iki ayrı modül birleşimi.
- [ ] Standart panel dizisi içi bağlantı ile modüller arası bağlantı ayrılır.
- [ ] `START_OF_RUN` gibi reçeteyi etkileyen semantic flag'ler desteklenebilir.
- [ ] Ayrı `OUTER_CORNER` sınıfı gerçek üretim ihtiyacı doğrulanmadan oluşturulmaz.
- [ ] Sınıflandırma görsel tahminle değil anchor yönleri ve geometri üzerinden deterministik yapılır.

**Önemli sınır:** Connection graph, modülün Raw BOM'unu ve bağlantı tipini bilir; ancak tüm sahnedeki ortak dikme/aparat düşümü ve Final BOM hesabı FAZ 5'tedir.

**Sprint çıkışı:** Gerçek projelerde sistem manuel işaretleme olmadan iç köşe ve inline birleşimleri tespit edebilir.

---

# Sprint 6 — İki Noktalı Kayıt / Profil Aracı

- [ ] İlk anchor başlangıç noktası.
- [ ] `Shift + ikinci anchor` bitiş noktası.
- [ ] Ghost preview.
- [ ] `Esc` iptal.
- [ ] Uzunluk, yön ve transform iki anchor'dan otomatik hesaplanır.
- [ ] Profil tipi/kesiti desteklenen katalog tanımından seçilebilir.
- [ ] Min/max uzunluk, collision ve stand sınırı Rule Engine'den doğrulanır.
- [ ] Profil iki anchor referansını state'te saklar.
- [ ] Bağlı modül hareketinde profil yeniden hesaplanır veya invalid-state oluşur.
- [ ] Profil kendi Raw BOM/part metadata'sını taşıyabilir.

---

# Sprint 7 — Custom Module Library + Project Save/Load / Versioning

## Custom Module Library

- [ ] Create / edit / duplicate / rename / delete.
- [ ] Ad, kategori, açıklama, base module referansı ve parametrik config.
- [ ] Base modüller read-only.
- [ ] `Base Modüller` / `Custom Modüller` ayrımı.
- [ ] `CustomModuleRepository` contract.
- [ ] Local/browser persistence adapter.
- [ ] Business logic storage API'sine doğrudan bağlanmaz.

## Project Save/Load + Versioning

- [ ] Definition / instance ayrımı proje dosyasında korunur.
- [ ] Parametrik instance snapshot saklanır.
- [ ] Schema version state'e yazılır.
- [ ] Migration/fallback stratejisi.
- [ ] Raw BOM üretmek için gereken recipe/config metadata kaybolmaz.
- [ ] Anchor/connection graph round-trip sonrasında aynı kalır.
- [ ] Connection semantics export/import sonrasında korunur.

---

# Sprint 8 — Regresyon + FAZ 4 Kapanışı

- [x] Standart duvar recipe testleri.
- [ ] Raw BOM determinism testleri.
- [ ] Parametric config değişiminde geometry + Raw BOM birlikte değişim testleri.
- [ ] Wizard/live preview testleri.
- [ ] Raflı duvar/LED state testleri.
- [ ] Anchor compatibility / snap testleri.
- [ ] İç köşe / inline sınıflandırma testleri.
- [ ] İki noktalı profil testleri.
- [ ] Custom library lifecycle testleri.
- [ ] Project save/load round-trip testleri.
- [ ] Mevcut base modüllerde renk, görsel, cam, selection, drag/drop, snap ve placement regresyonu olmayacak.
- [ ] `npm test` ve `npm run build` temiz olmadan FAZ 4 kapanmayacak.

## FAZ 4 kapanış kabulü

Bir modül ve bir proje için sistem aşağıdakileri kayıpsız ve deterministik sunabilmeli:

- modül/instance kimlikleri,
- parametrik config,
- kanonik `itemKey` referansları,
- modül seviyesinde doğru Raw BOM / recipe,
- `sourceAnchor -> targetAnchor` connection graph,
- `INNER_CORNER`, `INLINE_JOIN` gibi üretim semantiği,
- save/load sonrası aynı recipe + bağlantı state'i.

**FAZ 4 kapanışında Final BOM veya maliyet zorunlu değildir.**
