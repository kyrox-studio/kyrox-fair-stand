# Fair Stand — Fresh Repository Review

> **HISTORICAL SNAPSHOT — CURRENT SOURCE OF TRUTH DEĞİLDİR.**
>
> Bu dosya repository'nin daha önceki bir durumuna ait inceleme kaydıdır. İçindeki “mevcut”, “şu anda”, öncelik ve öneri ifadeleri **bugünkü durumu temsil etmez** ve yeni iş planı olarak kullanılmamalıdır.
>
> Güncel durum: iş listesi `kyrox-platform/projects/fair-stand/ROADMAP.md`, açık bulgular `audit/FINDINGS.md`, kurallar `PROJECT_RULES.md`, `ARCHITECTURE_RULES.md`, `SYSTEM_DEVELOPMENT_CONTRACT.md` ve `SYSTEM_CHANGE_GATE.md`. `audit/FULL_SWEEP_STATE.md` A00–A24 tarihî mührüdür. Bu historical kayıt yalnız geçmiş kararların/tespitlerin bağlamını korumak için tutulur.

---

> Bu rapor, mevcut geliştirme geçmişinden bağımsız, repository'ye fresh bir gözle bakılarak hazırlanmıştır. Amaç çalışan özellikleri yeniden tasarlamak değil; saçma, çelişkili, eskimiş, riskli veya iyileştirilebilir alanları tespit edip uygulanabilir bir temizlik/refactor sırası çıkarmaktır.

## Genel Sonuç

Proje çalışıyor ve ciddi miktarda regresyon testi bulunuyor. Ancak repository artık hızlı özellik eklenen prototip seviyesinden, bakım maliyeti yükselmeye başlayan ürün seviyesine geçmiş durumda.

En büyük risk tek tek buglar değil:

- aynı davranışın birden fazla yerde tarif edilmesi,
- dokümantasyon ile runtime davranışı arasındaki contract drift,
- geçmiş tek-seferlik GitHub Actions workflow'larının repository içinde kalması,
- `main.js` ve `scene3d.js` gibi core dosyaların çok fazla sorumluluk taşıması,
- module type özel davranışların tekrar dağınık `if` kontrollerine dönüşme riski,
- README / roadmap / changelog gibi belgelerin güncel kod seviyesinin gerisinde kalmasıdır.

Genel repo sağlığı yaklaşık **7/10** olarak değerlendirilebilir. Temel mimari yanlış değildir. Özellikle `moduleBehavior`, test altyapısı ve recipe/catalog ayrımı doğru yöndedir. En büyük kazanım yeni feature eklemekten önce repository hijyeni ve canonical contract temizliği yapmaktır.

---

# 1. `PROJECT_RULES.md` şu haliyle problemli

`PROJECT_RULES.md` kendisini kesin ve bağlayıcı proje kuralları olarak tanımlıyor ve örneğin tüm modüllerin 90° adımlarla dönmesini genel standart haline getiriyor.

Ancak gerçek runtime davranışı artık bundan farklıdır:

- Bar taburesi 45° dönebiliyor.
- Düz bankolar belirli durumlarda 45° dönebiliyor.
- Bazı serbest modüller 10 cm hareket snap'i kullanıyor.
- LED projektör 20 cm hareket ediyor.
- `wall-overlay` ayrı bir placement davranışı olarak bulunuyor.
- Kettle için collision davranışı `none` olabiliyor.

Bu nedenle `PROJECT_RULES.md` ile gerçek kod arasında contract drift oluşmuş durumda.

## Öneri

Dosya doğrudan silinmemeli; fakat mevcut haliyle de bırakılmamalıdır.

`PROJECT_RULES.md` yalnız gerçekten global ve ürün seviyesinde değişmez kabul edilen invariant'ları tutmalıdır.

Burada kalabilecek örnekler:

- X/Y zemin düzlemi, Z yükseklik koordinat standardı.
- Silinen modülün boşluğunun kullanıcı istemedikçe otomatik kapatılmaması.
- Kullanıcı açıkça istemedikçe auto-compaction yapılmaması.
- Aynı modül ailesinin ortak placement altyapısını kullanması.
- Nominal placement ölçüsü ile üretim/BOM ölçüsünün aynı kavram olmaması.

Buradan çıkarılması gerekenler:

- tüm modüller 90° döner gibi artık doğru olmayan genellemeler,
- tüm modüller 50 cm grid kullanır gibi modül özel davranışları,
- module-type özel collision kuralları,
- spesifik banko/baza/raf ölçüleri,
- runtime behavior registry tarafından belirlenen özellikler.

Bu davranışların gerçek kaynağı `moduleBehavior.js`, catalog, state ve recipe katmanları olmalıdır.

---

# 2. Aynı sistem için birden fazla “gerçek kaynak” oluşmuş

Repository'de aynı veya yakın davranışları tarif eden en az üç doküman bulunuyor:

1. `PROJECT_RULES.md`
2. `ARCHITECTURE_RULES.md`
3. `MODULE_BEHAVIOR_STANDARD.md`

Bu dosyaların sorumluluk sınırları net değildir.

`ARCHITECTURE_RULES.md` mevcut kod davranışlarını belgelemeyi amaçlıyor. `MODULE_BEHAVIOR_STANDARD.md` ise module type özel editor davranışlarının `src/moduleBehavior.js` üzerinden yönetilmesini söylüyor.

Gerçek kod giderek ikinci modele yaklaşmış durumda. Bu nedenle aynı davranışın iki veya üç farklı Markdown dosyasında manuel olarak tutulması gelecekte tekrar drift oluşturacaktır.

## Önerilen yapı

### `ARCHITECTURE.md`

Şunları anlatmalı:

- sistem katmanları,
- state → placement → renderer → storage akışı,
- ana domain sınırları,
- global invariant'lar,
- hangi dosyanın hangi konuda source of truth olduğu.

### `MODULE_BEHAVIOR_STANDARD.md`

Kalabilir ve doğrudan `moduleBehavior.js` sözleşmesini tarif edebilir.

### `PROJECT_RULES.md`

İki seçenek vardır:

- tamamen kaldırmak,
- veya çok küçük bir “product invariants” dokümanına dönüştürmek.

Tercih edilen yaklaşım ikinci seçenektir: dosyayı küçültmek ve yalnız gerçekten global kuralları bırakmak.

---

# 3. `.github/workflows` klasörü ciddi şekilde temizlenmeli

Repository'de normal CI workflow'larının yanında geçmişte belirli tek-seferlik düzeltmeler için oluşturulmuş çok sayıda workflow bulunmaktadır.

Örnekler:

- `add-coat-rack.yml`
- `add-fridge-top-label.yml`
- `add-tv-sizes.yml`
- `add-video-wall-2x2.yml`
- `fix-beige-mesh-render.yml`
- `fix-furniture-ids.yml`
- `fix-kettle-fridge-stack.yml`
- `inspect-tv-object5.yml`
- `inspect-tv-tests.yml`
- `rename-counter-ids.yml`
- `run-video-wall-2x2-patch.yml`
- `tv-screen-direct-v2.yml`
- `tv-screen-final-fix.yml`
- `tv-screen-source-fix.yml`

Bunlar kalıcı CI pipeline'ının parçası olmamalıdır.

## Riskler

- gereksiz workflow tetiklenmesi,
- Actions ekranında anlamsız kırmızı/yeşil geçmiş,
- repository'nin gerçekte bozuk olmadığı halde bozuk görünmesi,
- bakım yükü,
- gelecekte eski bir patch workflow'un yanlışlıkla tekrar çalıştırılması,
- hangi workflow'un canonical olduğunun belirsizleşmesi.

## Öneri

`.github/workflows/` içinde ideal olarak yalnız:

- `ci.yml`
- gerekiyorsa `deploy.yml`

kalmalıdır.

Geçmiş tek-seferlik patch workflow/scriptleri silinebilir. Bunların geçmişi zaten Git history içinde korunmaktadır.

Bu repository için en düşük riskli ve en yüksek getirili temizliklerden biridir.

---

# 4. CI deterministik hale getirilmeli

Mevcut Build workflow dependency kurulumu için:

```bash
npm install
```

kullanıyor.

Repository'de lockfile bulunduğu için CI ortamında daha doğru tercih:

```bash
npm ci
npm test
npm run build
```

olmalıdır.

## Ek öneri

Repository büyüklüğü artık yalnız test + build kontrolünün ötesine geçmiştir.

En azından şu komut hedeflenmelidir:

```bash
npm run check
```

ve altında:

- lint,
- test,
- build

çalışmalıdır.

Uzun vadede ESLint eklenmesi faydalıdır.

Prettier da format drift'ini azaltabilir.

---

# 5. `main.js` çok fazla sorumluluk taşıyor

`main.js` artık yalnız application bootstrap dosyası değildir.

Aynı dosyada:

- DOM wiring,
- project state,
- autosave,
- asset library,
- color editor,
- module creation,
- context menu,
- project naming,
- stage/depot setup,
- placement operasyonları,
- scene callback'leri

bulunmaktadır.

Bu yapı büyüdükçe `main.js` bir **God Controller** haline gelmektedir.

## Öneri

Tek seferde büyük refactor yapılmamalıdır. Çalışan sistemi gereksiz yere kırmak doğru olmaz.

Ancak bundan sonra yeni özelliklerin doğrudan `main.js` içine eklenmesi durdurulmalıdır.

Hedef yapı örneği:

```text
src/app/
  projectController.js
  projectNaming.js
  autosaveController.js
  assetController.js
  selectionController.js
  stageController.js
```

`main.js` zamanla yalnız bootstrap ve dependency wiring yapmalıdır.

---

# 6. `scene3d.js` ikinci büyük monolit

`scene3d.js` içinde aynı anda:

- Three.js scene setup,
- camera,
- floor,
- lighting,
- model loader'ları,
- TV,
- Eames,
- bar stool,
- fridge,
- rack,
- kettle,
- plant,
- sofa,
- placement/ghost interaction,
- render davranışları

bulunmaktadır.

Bu dosya renderer katmanının çok fazla module-specific bilgi taşımasına neden olmaktadır.

## Hedef yapı

Zaman içinde örneğin:

```text
src/renderers/
  wallRenderer.js
  furnitureRenderer.js
  tvRenderer.js
  foamRenderer.js
  lightboxRenderer.js
  floorRenderer.js
```

şeklinde ayrıştırılabilir.

Renderer seçimi mümkün olduğunca registry üzerinden yapılmalıdır.

Bu refactor P0 değildir; kontrollü ve test destekli yapılmalıdır.

---

# 7. `moduleBehavior.js` doğru yönde fakat daha sıkı hale getirilmeli

`moduleBehavior.js` projedeki doğru mimari kararlardan biridir.

Placement, move snap, rotation, collision ve ghost davranışlarının type registry içinde tutulması dağınık type check'leri azaltmaktadır.

Ancak mevcut default davranış bilinmeyen bir module type için sessizce wall davranışına düşebilmektedir.

Bu production sistemde risklidir.

Örneğin yeni bir katalog modülü eklenir fakat behavior kaydı unutulursa modül sessizce yanlış placement davranışı alabilir.

## Öneri

En azından test seviyesinde şu contract zorunlu hale getirilmelidir:

> Catalog'da bulunan her module type açıkça behavior registry tarafından tanınmalıdır veya bilinçli bir default davranış kullandığı açıkça test edilmelidir.

Development ortamında bilinmeyen type için warning veya error üretmek de değerlendirilebilir.

Bu sayede “yeni modül ekledik ama default behavior aldı” sınıfındaki buglar engellenir.

---

# 8. Test altyapısı güçlü; organizasyonu ileride iyileştirilebilir

Repository'de ciddi miktarda regresyon testi bulunması önemli bir avantajdır.

Test kapsamı şu alanlara kadar uzanmaktadır:

- depot,
- automatic wall,
- base,
- catalog,
- rendering contracts,
- placement,
- recipes,
- bundle loading,
- module-specific regressions.

Bu yapı korunmalıdır.

Ancak test sayısı büyüdükçe düz `test/` klasörü içinde feature ve bug-fix isimleri bulunabilirliği azaltacaktır.

Uzun vadeli hedef:

```text
test/
  placement/
  catalog/
  depot/
  recipes/
  rendering/
  project/
```

şeklinde domain bazlı organizasyon olabilir.

Bu acil değildir; P2/P3 seviyesinde temizliktir.

---

# 9. README güncel ürünü doğru anlatmıyor

README büyük ölçüde projenin ilk MVP planını ve gelecek zamanlı hedeflerini anlatmaktadır.

Ancak repository bugün çok daha ileridedir ve örneğin:

- project storage,
- project isolation,
- asset yönetimi,
- render,
- automatic depot,
- lightbox,
- mesh,
- illuminated foam,
- video wall,
- BOM recipes,
- production parts,
- furniture modules,
- automatic project naming

gibi özellikler içermektedir.

Bu nedenle README onboarding belgesi olarak artık güvenilir değildir.

## Öneri

README baştan güncellenmelidir:

1. Fair Stand nedir?
2. Güncel feature listesi.
3. Local kurulum.
4. Test/build komutları.
5. Mimari harita.
6. Ana domain kavramları.
7. Dokümantasyon bağlantıları.
8. Branch/development policy.

Eski ürün vizyonu gerekiyorsa:

```text
docs/history/initial-concept.md
```

gibi tarihsel bir belgeye taşınabilir.

---

# 10. Roadmap gerçek implementasyon durumu ile yeniden eşleştirilmeli

`ROADMAP.md` hâlâ FAZ 4 içinde recipe, parametrik core, connection graph vb. işleri aktif/gelecek işler olarak göstermektedir.

Ancak repository'de module recipes, production parts ve FAZ 4 kapsamına giren birçok altyapı halihazırda bulunmaktadır.

Bu nedenle roadmap'in current-state kısmı tekrar doğrulanmalıdır.

## Risk

Roadmap yanlışsa yeni geliştirici veya AI ajanı:

- zaten yapılmış işi tekrar planlayabilir,
- yanlış öncelik çıkarabilir,
- mevcut mimariyi yanlış anlayabilir.

Roadmap yalnız gelecekte yapılacak işi göstermeli; tamamlanmış iş açıkça kapatılmalıdır.

---

# 11. `Changelog.md` gerçek changelog olmaktan çıkmış

Mevcut changelog başlangıçtan itibaren yüzlerce mikro geliştirmeyi kronolojik olarak kaydeden bir development journal haline gelmiştir.

Bu tarihsel açıdan faydalıdır fakat modern changelog olarak kullanışlı değildir.

## Öneri

Mevcut ayrıntılı günlük:

```text
docs/history/development-log.md
```

altına taşınabilir.

Yeni `CHANGELOG.md` sürüm/feature bazlı tutulabilir:

```markdown
## Unreleased

### Added
### Changed
### Fixed
```

Böylece kullanıcı ve geliştirici için gerçek değişiklik özeti okunabilir hale gelir.

---

# 12. `SYSTEM_MODULE_CATALOG.md` mümkünse otomatik üretilmeli

Bu doküman modül sayısı, BOM recipe durumu, nominal ölçüler ve üretim bilgileri gibi koddan türetilebilecek çok sayıda veri içeriyor.

Bu tür bilgilerin manuel Markdown içinde tutulması drift riski oluşturur.

Gerçek kaynak zaten büyük ölçüde:

- `catalog.js`,
- `moduleRecipes.js`,
- `productionParts.js`,
- `designState.js`

içindedir.

## Öneri

İleride:

```bash
npm run docs:catalog
```

benzeri bir script catalog + recipe state'ten Markdown üretebilir.

Böylece `SYSTEM_MODULE_CATALOG.md` source of truth olmaktan çıkar ve gerçek koddan üretilen rapora dönüşür.

---

# 13. Dağınık module type kontrollerinin yeniden çoğalması engellenmeli

`MODULE_BEHAVIOR_STANDARD.md` doğru şekilde module-specific editor davranışlarının dağınık type check'leri yerine registry üzerinden yönetilmesini hedeflemektedir.

Bu prensip korunmalıdır.

`scene3d.js`, `main.js`, catalog ve yeni modüller büyüdükçe şu tip yapıların tekrar çoğalması riski vardır:

```js
if (module.type === '...') {
  ...
}
```

## Uzun vadeli hedef

Tek seferde uygulanması gerekmese de sistem şu modele yaklaşabilir:

```js
MODULE_DEFINITIONS[type] = {
  behavior,
  renderer,
  stateFactory,
  catalog,
  recipe,
  editorCapabilities,
};
```

Bu sayede yeni bir modül eklenirken davranış, renderer, state ve recipe sözleşmeleri tek noktadan takip edilebilir.

Bu büyük bir refactor olduğu için kademeli yapılmalıdır.

---

# 14. Static typing / contract desteği artık faydalı olur

Kod JavaScript'tir ve sistem büyüdükçe çok sayıda implicit object contract oluşmuştur.

Örnek kavramlar:

- ModuleState
- Placement
- Stand
- ProjectState
- CatalogItem
- ModuleBehavior
- SurfaceState

Tam TypeScript migration şu anda zorunlu değildir ve gereksiz risk oluşturabilir.

Ancak JSDoc typedef'leri eklemek IDE desteğini ve refactor güvenliğini ciddi artırabilir.

Özellikle core state ve placement yapılarına JSDoc type contract eklenmesi önerilir.

---

# 15. `src/` klasörü domain bazlı yapıya doğru evrilmeli

Repository büyüdükçe `src/` kökünde çok sayıda farklı sorumluluğa sahip dosya birikmiştir.

Uzun vadeli hedef örneği:

```text
src/
  app/
  catalog/
  placement/
  render/
  project/
  assets/
  modules/
  depot/
  ui/
  utils/
```

Ancak mevcut dosyaları topluca taşımak gereksiz regression riski yaratır.

Daha güvenli yaklaşım:

- mevcut çalışan dosyaları hemen taşımamak,
- yeni domain dosyalarını doğru klasörlere koymak,
- büyük dosyalar bölündükçe ilgili domain klasörüne geçirmek.

---

# 16. Asset / repository boyutu için politika belirlenmeli

Repository içinde GLB modeller ve diğer binary asset'ler bulunmaktadır.

Bu şu anda tek başına hata değildir; fakat proje büyüdükçe Git repository boyutu hızla artabilir.

Şimdiden şu politika belirlenebilir:

- production'da kullanılan makul boyutlu optimize GLB dosyaları repository içinde kalabilir,
- büyük source model / FBX / Blender çalışma dosyaları repository dışında tutulmalı,
- ihtiyaç oluşursa Git LFS değerlendirilmeli,
- production asset'leri optimize edilmeden eklenmemeli.

Bu acil değildir fakat ileride clone/deploy sürelerini etkileyebilir.

---

# 17. Branch ve geliştirme modeli sadeleştirilmeli

Aktif branch olarak `ROG` kullanılması teknik olarak sorun değildir.

Ancak proje büyüdükçe doğrudan ana çalışma branch'ine tek-seferlik Actions patch'leri göndermek repository history ve CI görünümünü kirletmektedir.

Daha sürdürülebilir model:

```text
ROG
feature/*
fix/*
```

ve:

- branch,
- PR,
- canonical CI,
- merge

akışıdır.

Bu özellikle daha büyük refactor ve mimari temizliklerde güvenliği artıracaktır.

---

# Önerilen Öncelik Sırası

| Öncelik | İş | Risk / Kazanç |
|---|---|---|
| **P0** | Eski tek-seferlik GitHub workflow/scriptlerini temizle | Çok yüksek kazanç, düşük risk |
| **P0** | `PROJECT_RULES` / `ARCHITECTURE_RULES` / `MODULE_BEHAVIOR_STANDARD` çelişkisini çöz | Yanlış geliştirme riskini azaltır |
| **P0** | CI'ı `npm ci` kullanan tek canonical workflow'a indir | Deterministik build |
| **P1** | README'yi mevcut ürüne göre yeniden yaz | Repo anlaşılabilirliği |
| **P1** | Roadmap'i gerçek implementasyon durumuyla eşleştir | Yanlış planlamayı önler |
| **P1** | Catalog → behavior coverage testi ekle | Yeni modül regressions |
| **P1** | `main.js` içine yeni sorumluluk eklemeyi durdur; controller ayrımına başla | Uzun vadeli bakım |
| **P2** | `scene3d.js` renderer'larını kademeli böl | Büyük refactor, kontrollü yapılmalı |
| **P2** | Module catalog dokümanını koddan generate et | Documentation drift azalır |
| **P2** | ESLint / Prettier / JSDoc contract desteği | Refactor güvenliği |
| **P3** | `src/` ve `test/` klasörlerini domain bazlı düzenle | Repository temizliği |

---

# `PROJECT_RULES.md` İçin Net Karar

**Direkt silinmemeli.**

Ancak bugünkü haliyle de bırakılmamalıdır.

Önerilen yaklaşım:

1. Dosyanın büyük kısmındaki module-specific ve artık yanlış genellemeleri kaldır.
2. Yalnız gerçekten global product invariant'larını bırak.
3. Runtime module behavior için `moduleBehavior.js` + regresyon testlerini canonical kaynak kabul et.
4. `ARCHITECTURE_RULES.md` dosyasını mevcut davranışların ikinci kopyası olmaktan çıkarıp gerçek sistem mimarisi dokümanına dönüştür.
5. Dokümantasyonda her konuda yalnız bir canonical source tanımla.

Çünkü yanlış veya drift etmiş “kesin kurallar” dokümanı, hiç doküman olmamasından daha tehlikelidir.

---

# Genel Teknik Değerlendirme

## Güçlü taraflar

- Ciddi regresyon testi birikimi var.
- `moduleBehavior` registry yaklaşımı doğru yönde.
- Catalog / state / recipe / production parts ayrımı oluşmaya başlamış.
- Placement sistemi önemli ölçüde merkezi hale getirilmiş.
- Proje artık yalnız görsel demo değil; domain kuralları olan gerçek bir konfigüratöre dönüşmüş.

## Zayıf taraflar

- Repository hızlı geliştirme döneminden kalan geçici dosyaları taşıyor.
- Dokümantasyon kaynakları çoğalmış ve bazıları runtime ile çelişiyor.
- `main.js` ve `scene3d.js` çok fazla sorumluluk taşıyor.
- README ve roadmap mevcut ürün seviyesinin gerisinde.
- CI / workflow yapısı gereğinden kirli.
- Yeni module type'ların yanlış default davranış almasını tamamen engelleyen sıkı contract henüz yok.

## Sonuç

Şu aşamada en doğru strateji büyük bir yeniden yazım değildir.

Önce:

1. repository hijyeni,
2. canonical contract temizliği,
3. CI sadeleştirmesi,
4. documentation güncellemesi,
5. davranış registry güvenliği

yapılmalıdır.

Ardından `main.js` ve `scene3d.js` kademeli olarak parçalanabilir.

Bu yaklaşım mevcut çalışan özellikleri korurken teknik borcun büyümesini durdurur.