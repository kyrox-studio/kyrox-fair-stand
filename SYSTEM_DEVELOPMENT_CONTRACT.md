# Fair Stand — System Development Contract

> **Bu belge module / feature / core implementasyon sözleşmesidir.**
>
> Her değişiklik bundan **önce** `SYSTEM_CHANGE_GATE.md` üzerinden universal impact classification alır, `SYSTEM_IMPACT_SWEEP.md` ile dependency/test/finding taramasından geçer ve `.github/change-contract.json` içinde machine-readable olarak beyan edilir.
>
> BOM, üretim veya maliyet hesabına girebilen fiziksel ürün/zemin/malzeme/kombinasyon işleri ayrıca **implementasyondan önce `ITEM_CONTRACT.md` sözleşmesini uygulamak zorundadır**.

Amaç, insan veya AI tarafından sisteme yeni modül, feature, otomasyon, Item veya davranış eklenirken yalnız değiştirilen dosyaya bakıp başka sorumlulukların geride bırakılmasını engellemektir.

---

# 1. Bu contract neden var?

Fair Stand'da bir değişiklik yalnızca tek bir dosya veya 3D obje değildir. Aynı değişiklik katalog, state, placement, behavior, renderer, persistence, BOM, composition, UI, asset, storage, import/export, accessibility ve test yüzeylerini birlikte etkileyebilir.

Bu nedenle "modeli sahneye ekledim", "butonu bağladım" veya "fonksiyonu refactor ettim" tek başına tamamlanmış iş değildir.

Universal gate gerçek etki alanını ve bağımlılıkları bulur; `ITEM_CONTRACT.md` fiziksel/BOM kapsamındaki öğelerin kök semantiğini belirler; bu belge module/feature/core katmanında bu etkilerin nasıl uygulanacağını tanımlar.

---

# 2. Canonical source-of-truth dağılımı

| Konu | Canonical kaynak |
|---|---|
| Item kök semantiği / itemKey-type-instance / BOM ownership | `ITEM_CONTRACT.md` |
| Universal impact domain registry | `src/systemChangeContract.js > SYSTEM_IMPACT_DOMAINS` |
| Browser E2E trigger registry | `src/systemChangeContract.js > SYSTEM_BROWSER_E2E_DOMAINS` |
| Universal değişiklik kabul kapısı | `SYSTEM_CHANGE_GATE.md` + `.github/change-contract.json` |
| Full dependency/test/finding discovery | `SYSTEM_IMPACT_SWEEP.md` + `scripts/change-impact-analysis.mjs` |
| Global ürün invariantları | `PROJECT_RULES.md` |
| Mimari sınırlar | `ARCHITECTURE_RULES.md` |
| Katalog kimliği / nominal descriptor | `src/catalog.js` |
| Modül contract profile / politika ataması (GOVERNANCE spec; runtime SoT değil) | `src/moduleContracts.js` |
| Feature / composition contract (GOVERNANCE; planner runtime okumaz) | `src/featureContracts.js` |
| Placement / move snap / collision / ghost | `src/moduleBehavior.js` + placement core (`wallReflow.js` production insert) |
| Sahne Z rotation (step / default / sideInsert) | Item kolonları → `docs/refactor/ROTATION.md`; getter `src/moduleBehavior.js` |
| Runtime module state construction | `src/designState.js` |
| Üretim reçetesi / runtime BOM | `src/moduleRecipes.js` + `src/itemBom.js` |
| Üretim parçası / Item registry | `src/items.js` |
| Item yüzey image/color yeteneği | `src/itemCapabilities.js` (`scene3d` `acceptsImage` türevi) |
| Otomatik depo planı (runtime) | `src/autoDepot.js` |
| Otomatik duvar planı (runtime) | `src/automaticWall.js` |
| BOM kullanıcı UI | Yok (DEV `?rawBom` debug; production UI ertelendi) |
| Unit/integration regression | `test/` |
| Real-browser regression | `e2e/` + `playwright.config.mjs` |

**Kural:** Bir runtime değeri canonical kod kaynağında varsa Markdown içine ikinci sabit kaynak olarak kopyalanmaz.

---

# 3. Değişiklik önce sınıflandırılır

İki aşama zorunludur:

1. **Universal:** `SYSTEM_IMPACT_DOMAINS` registry'sinde o anda tanımlı bütün domainler için `affected` / `not-applicable` kararı verilir. Domain sayısı sabit değildir.
2. **Domain:** İş Item / module / variant / runtime-module / feature-composition / core-change sınıflarından uygun olanıyla uygulanır.

Browser-visible etki varsa `SYSTEM_BROWSER_E2E_DOMAINS` registry'si E2E'yi otomatik zorunlu kılar.

## A. Yeni Item

BOM, üretim veya maliyet hesabına girebilen yeni fiziksel ürün, zemin, malzeme, kombinasyon veya runtime öğesinde önce `ITEM_CONTRACT.md` uygulanır. En az canonical `itemKey`, `type`, state/parametre sahipliği, tekil/bileşik/parametrik yapı, BOM recipe/resolver, quantity+unit, project instance ayrımı, behavior family, render/persistence ve test etkileri karara bağlanır.

Catalog, renderer, GLB veya UI eklemek tek başına yeni Item implementasyonu değildir.

## B. Yeni katalog modülü

`MODULE_CATALOG` + explicit module contract + behavior + state construction + renderer + persistence + BOM policy + targeted regression + targeted E2E gerekir. Fiziksel/BOM kapsamındaysa ayrıca Item contract'ı zorunludur.

## C. Mevcut modül varyantı

Mevcut profile gerçekten uyuyorsa inheritance kullanılabilir. Uymuyorsa yeni davranış ailesi/profile değerlendirilir; sürekli item-level override normal genişleme yolu değildir. Varyantın browser akışı değişiyorsa E2E aynı PR'da güncellenir.

## D. Katalog dışı runtime modülü

Katalogda görünmese bile explicit module contract ve canonical state construction zorunludur. Mevcut örnek `illuminated-foam` ailesidir. BOM/maliyet kapsamındaki runtime modülü aynı zamanda Item contract'ını taşır.

## E. Feature / scene composition

Birden fazla modülü/domaini koordine eden işler `src/featureContracts.js` içinde feature contract taşır. UI callback veya renderer içine gizlenmiş composition kuralı kabul edilmez.

## F. Core davranış değişikliği

Rotation, collision, placement, state construction veya benzeri core değişiklikte önce mevcut core contract'ın ihtiyacı ifade edip edemediği kontrol edilir. Edemiyorsa canonical contract genişletilir; type-specific dağınık `if` ile başlanmaz.

---

# 4. Her Item/modül/feature için cevaplanması gereken alanlar

## 4.1 Identity

Item kapsamındaysa:

- canonical `itemKey` nedir?
- runtime `type` / behavior family nedir?
- project instance `id` canonical ürün kimliğinden nasıl ayrılır?
- persist edilen ürün kimliği yalnız `itemKey` mı; Category `id` veya eski `catalogKey` ürün kimliği olarak okunuyor veya yazılıyor mu?

Module-only kapsamda mevcut catalog identity kuralları korunur.

## 4.2 Profile / inheritance

- Hangi profile/type family kullanılıyor?
- Hangi davranışlar miras alınıyor?
- Davranış gerçekten farklıysa yeni family gerekiyor mu?
- Item-specific override yerine family-level contract kurulabilir mi?

## 4.3 State

- State construction canonical olarak nerede?
- Hangi alanlar persisted?
- Hangi alanlar runtime-derived?
- Project instance ölçü/adet/konfigürasyonu canonical Item tanımından ayrılmış mı?
- Save/load round-trip sonrası anlam korunuyor mu?

## 4.4 Placement / movement / rotation / collision

- placement mode nedir?
- move snap nedir?
- rotation step/default/sideInsert nedir? (`docs/refactor/ROTATION.md`; Item kolonları, `TYPE_BEHAVIORS` değil)
- collision strategy nedir?
- side insert var mı?
- ghost nasıl davranır?

Item/module-specific farklar `src/moduleBehavior.js` ve placement core üzerinden ifade edilir. Context-menu görünürlüğü ve runtime enforcement aynı canonical capability/behavior kaynağını tüketmelidir.

## 4.5 Appearance

- renk editable mı?
- görsel editable mı?
- fixed mi?
- birden fazla editable surface var mı?
- renderer hangi state'i okuyor?

## 4.6 Renderer / assets

- procedural mı, GLB/model mi?
- asset path'i nedir?
- specialized renderer var mı?
- asset değişikliği hangi JS/CSS/HTML/browser akışını etkiliyor?

Renderer ürün kuralının veya BOM hesabının tek sahibi haline getirilmez. BOM render/mesh/texture görünümünden türetilmez.

## 4.7 Persistence / storage

- Proje kaydına giriyor mu?
- Save/load/autosave/project switch etkileniyor mu?
- Runtime-derived alan yanlışlıkla persist ediliyor mu?

## 4.8 BOM policy

Her fiziksel Item/modül BOM'a nasıl dönüştüğünü canonical olarak tanımlamalıdır.

Mevcut module contract politikaları:

- `recipe`
- `self`
- `commercial-item`
- `excluded`

Item seviyesinde BOM resolver tekil, bileşik veya parametrik olabilir. Terminal BOM kalemleri canonical kimlik + `quantity` + canonical `unit` taşır. Bileşik Item çözümü recursive olabilir; cycle yasaktır.

`decision-required` production-ready yeni iş için kabul edilen son durum değildir.

BOM ile pricing/costing ayrıdır; fiyat değişikliği BOM recipe'sini değiştirmez.

## 4.9 Runtime behavior

- static mi?
- timer/clock/animation var mı?
- runtime dış kaynağı var mı?
- persisted state ile runtime-derived değer ayrılmış mı?

## 4.10 Composition / dependencies

- başka Item/modül oluşturuyor mu?
- parent/child veya component ilişkisi var mı?
- hangi wrapper/orchestrator çağırıyor?
- reverse dependents neler?

Bu liste tahminle yazılmaz; `SYSTEM_IMPACT_SWEEP.md` discovery sonucu ile karşılaştırılır.

## 4.11 Tests + browser E2E

Her değişiklik için:

- mevcut etkilenen test inventory'si,
- değişen davranışın targeted regression testi,
- full `npm test`,
- `npm run build`,
- canonical Playwright E2E suite

zorunludur.

`SYSTEM_BROWSER_E2E_DOMAINS` içindeki herhangi bir domain `affected` ise ayrıca **değişikliğe özel targeted `e2e/**` spec** zorunludur. Baseline smoke tek başına yeni browser davranışının kanıtı sayılmaz.

Save/load etkileniyorsa persistence round-trip; BOM etkileniyorsa Item/recipe/BOM quantity+unit contract; UI/renderer/placement etkileniyorsa gerçek kullanıcı akışı ayrıca doğrulanır.

---

# 5. Enforced module gate

`src/moduleContracts.js` **GOVERNANCE / spec** katmanıdır; runtime BOM veya behavior source-of-truth değildir.

İki katman kullanır:

1. `MODULE_CONTRACT_PROFILES`
2. `MODULE_CONTRACT_ASSIGNMENTS`

`test/systemDevelopmentContract.test.js` katalog öğelerinin explicit contract ataması taşımasını, gerekli policy bölümlerini resolve etmesini, recipe-backed modüllerin gerçek Item `composition.items` reçetesini çözmesini ve katalog dışı runtime modüllerinin explicit contract taşımasını zorlar.

Production `src/itemBom.js` ve `src/moduleBehavior.js` `moduleContracts.js` import etmez. Contract registry runtime’ın ikinci implementasyonu yapılmaz.

Bu module gate universal change gate'in veya `ITEM_CONTRACT.md` kapsamındaki Item gate'in yerine geçmez; onların altında domain-specific enforcement katmanıdır.

---

# 6. Feature / composition gate

`src/featureContracts.js` **GOVERNANCE** katmanıdır. `autoDepot.js` / `automaticWall.js` planner’ları registry’yi runtime’da okumaz.

Bir işlem tek modül davranışından fazlasını yönetiyorsa feature contract kaydı tutulur; testler planner çıktısını bu sözleşmeyle karşılaştırır.

Mevcut `automatic-depot` feature contract'ı structural output ve içerik ailelerini açıkça tanımlar. `automatic-wall` structural kind olarak `flat-panel`, lighting kind olarak `led-floodlight` tanımlar. Non-island stand kurulunca duvar panelleri `composeAutomaticStandWall` ile yazılır; ardından `appendAutomaticWallLamps` her kesintisiz sırt, sol ve sağ `flat-panel` koşusunda `AUTOMATIC_WALL_LAMP_INTERVAL_CM` (150) başına bir `led_floodlight` ekler. Depo arka duvarı ve depo yanı bu sayıma girmez. 150 cm'den kısa koşuya lamba konmaz. Ada standta duvar ve bu lamba oluşmaz. Lamba `itemKey` değeri `led_floodlight` kalır, yerleşimi üst profile snap edilir ve proje state'ine girer. Planner ile contract drift ederse regression kırılmalıdır.

Feature browser-visible ise Playwright E2E gerçek kullanıcı akışını da doğrular.

---

# 7. Örnek — yeni Item / modül

Yeni bir çöp kovası eklendiğinde yalnız catalog + GLB yeterli değildir.

Zorunlu zincir:

`Item contract → impact sweep → itemKey/type → module contract → behavior → state construction → renderer/asset → persistence → BOM quantity+unit → affected existing tests → targeted regression → targeted E2E → full CI`

Yeni bir cam zemin eklendiğinde de yalnız `floorType === 'glass'` branch'i eklenmez; `itemKey`, `type=floor`, state/ölçü parametreleri, BOM resolver, behavior/capability, render, persistence ve test sözleşmeleri birlikte tanımlanır.

---

# 8. Örnek — canlı duvar saati

Canlı saat için runtime time değeri persisted state'e yazılmaz. Config persist edilir; anlık zaman runtime'da hesaplanır. Browser interaction/render değiştiği için targeted E2E zorunludur.

---

# 9. Örnek — otomatik depo

Depo içeriği değişirse yalnız renderer içine obje eklenmez.

1. Universal impact + full-system discovery yapılır.
2. Yeni/etkilenen fiziksel öğeler için `ITEM_CONTRACT.md` uygulanır.
3. `automatic-depot` feature contract güncellenir.
4. Planner ve canonical state construction yolu güncellenir.
5. Existing dependent tests review edilir.
6. Targeted unit/integration regression yazılır.
7. Gerçek UI akışını doğrulayan targeted E2E yazılır.
8. Full test + build + E2E çalışır.

---

# 10. Yeni iş için zorunlu çalışma sırası

1. Fresh `main` üzerinden branch oluştur.
2. `SYSTEM_CHANGE_GATE.md` ve `SYSTEM_IMPACT_SWEEP.md` oku.
3. İş BOM/üretim/maliyet kapsamındaki fiziksel öğeyi etkiliyorsa `ITEM_CONTRACT.md` oku ve Item kararlarını ver.
4. `SYSTEM_IMPACT_DOMAINS` registry'sindeki bütün domainleri sınıflandır.
5. İlk reverse dependency/test/doc/finding taramasını çıkar.
6. `.github/change-contract.json` içinde impact + acknowledgement yaz.
7. Browser-impact varsa `tests.e2e.required=true` ve targeted E2E path belirle.
8. İlgili Item/module/feature/core contract kararlarını ver.
9. Implementation yap.
10. `npm run contract:verify` ile gerçek diff üzerinden impact sweep'i yeniden hesapla.
11. Yeni bulunan caller/test/doc/finding yüzeylerini review edip contract'ı güncelle.
12. Targeted regressionları çalıştır.
13. `npm test` çalıştır.
14. `cd backend && python -m pytest` çalıştır.
15. `npm run build` çalıştır.
16. Playwright/Chromium hazır değilse local runner/browser dependency'lerini kur.
17. `npm run e2e` çalıştır.
18. PR aç; canonical CI'nın `contract:verify → npm ci → npm test → python -m pytest → npm run build → Chromium → npm run e2e` zinciri yeşil olmalı.
19. PR CI yeşil olmadan merge yapılmaz; `main` ruleset'i (zorunlu kontrol + strict) bunu zorlar. Merge edilen ağaç PR'da test edilen ağaçla aynıdır, merge sonrası `main`'de CI tekrar koşmaz.

---

# 11. Yasaklanan geliştirme kalıpları

- Universal impact declaration veya full-system sweep olmadan guarded değişiklik tamamlamak.
- `ITEM_CONTRACT.md` kapsamındaki fiziksel öğeyi Item gate dışında eklemek.
- Yeni Item'ı yalnız catalog/renderer/GLB/UI ekleyerek tamamlanmış saymak.
- `itemKey` yerine label, model filename veya renderer node adını canonical ürün kimliği yapmak.
- Registry'deki bir domaini gerçeğe aykırı `not-applicable` işaretlemek.
- Caller/dependent/test discovery sonucunu görmezden gelmek.
- Yeni canonical API ekleyip eski source-shape testlerini sessizce bırakmak.
- Catalog'a yeni modül ekleyip module contract eklememek.
- Yeni modülü varsayılan behavior'a sessizce bırakmak.
- Rotation/collision/snap/state construction/context-menu capability gibi davranışı dağınık item/type-specific `if` ile çözmek.
- Aynı davranış ailesi içinde item-level override'ı normal genişleme yöntemi yapmak.
- BOM kararını atlamak veya unitsiz quantity üretmek.
- BOM'u renderer/mesh/texture üzerinden türetmek.
- BOM recipe ile fiyatlandırmayı aynı canonical kaynakta birleştirmek.
- Runtime-derived değeri gereksiz yere project state'e kaydetmek.
- Multi-module automation kuralını yalnız UI callback içine gömmek.
- Targeted regression olmadan davranış değişikliği tamamlamak.
- Browser-impact değişiklikte targeted E2E olmadan işi tamamlamak.
- Full test/build/E2E veya PR CI doğrulanmadan işi kapalı saymak.

---

# 12. Genişleme ilkesi

Bu contract sabit domain sayısına veya bugünkü modül/Item listesine bağlı değildir. Yeni domain, browser capability, Item family, contract türü veya test katmanı eklendiğinde canonical registry/schema genişletilir; validator ve regression suite yeni sözleşmeyi otomatik zorlar.

Contract registry runtime davranışının ikinci implementasyonu haline getirilmez; canonical source-of-truth sahipliği korunur.
