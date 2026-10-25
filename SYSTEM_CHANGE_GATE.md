# Fair Stand — Universal System Change Gate

> Bu belge `SYSTEM_DEVELOPMENT_CONTRACT.md` üzerindeki üst seviye geliştirme kapısıdır.
>
> Amaç mevcut sistemi bu dosyada denetlemek değildir. Amaç, bundan sonra insan veya AI tarafından yapılan her anlamlı değişikliğin **önce etkisini beyan etmesini**, sonra `SYSTEM_IMPACT_SWEEP.md` kurallarına göre gerçek bağımlılıklarını taramasını, uygulanmasını ve gate/test/build/E2E zinciri tarafından doğrulanmasını sağlamaktır.

---

# 1. Temel kural

Fair Stand'a yeni bir şey eklemek sadece "kod yazmak" değildir.

Aşağıdakilerin tamamı change contract kapsamına girer:

- yeni katalog modülü veya varyantı,
- yeni feature / otomasyon / scene composition,
- yeni UI butonu, input, select, context-menu action veya kısayol,
- yeni state alanı,
- save/load davranışı,
- renderer / GLB / procedural geometri değişikliği,
- placement / move / rotation / collision davranışı,
- BOM / recipe / production part değişikliği,
- asset / arka plan / texture / model ekleme veya değiştirme,
- import/export formatı,
- storage / IndexedDB davranışı,
- performans veya accessibility etkisi,
- mimari refactor,
- build / CI / script / dependency değişikliği,
- bugfix.

**Kural:** Guarded sistem dosyaları değişiyorsa `.github/change-contract.json` aynı değişiklik setinde güncellenmeden değişiklik kabul edilmez.

**Ek kural:** Domain beyanı tek başına yeterli değildir. Değişen yüzeyin gerçek callers/dependents/tests/docs/findings ilişkisi `SYSTEM_IMPACT_SWEEP.md` ve `scripts/change-impact-analysis.mjs` üzerinden taranır; bulunan yüzeyler açıkça review edilmeden gate geçmez.

**Browser kuralı:** `SYSTEM_BROWSER_E2E_DOMAINS` registry'sindeki herhangi bir domain `affected` ise targeted Playwright E2E zorunludur. `tests.e2e.required=false` ile geçilemez.

---

# 2. Zorunlu çalışma sırası

İnsan veya AI:

1. `PROJECT_RULES.md` oku.
2. `ARCHITECTURE_RULES.md` oku.
3. `SYSTEM_DEVELOPMENT_CONTRACT.md` oku.
4. Bu `SYSTEM_CHANGE_GATE.md` dosyasını oku.
5. `SYSTEM_IMPACT_SWEEP.md` dosyasını oku.
6. Değişikliği sınıflandır.
7. `.github/change-contract.json` içinde registry'de tanımlı **bütün** impact domain'lerini tek tek `affected` veya `not-applicable` olarak işaretle.
8. `tests` domain'ini her değişiklikte `affected` olarak işaretle.
9. Canonical owner/source-of-truth dosyalarını belirt.
10. Risk, migration ve rollback kararlarını belirt.
11. İlk affected-file/surface tahminini çıkar; implementation başlamadan önce callers/dependents/tests/contracts/findings yönünden impact review yap.
12. En az bir non-empty targeted unit/integration regression test path'i belirt.
13. Browser-impact domain varsa `tests.e2e.required=true` ve en az bir targeted `e2e/**` spec belirt; browser-impact yoksa `required=false` için gerekçe yaz.
14. Implementation yap.
15. `npm run contract:verify` çalıştır; verifier gerçek diff üzerinden full-system impact discovery'yi yeniden hesaplar.
16. Discovery'nin bulduğu code/runtime dependents, existing unit/integration/E2E tests, docs/contracts ve candidate findings'in tamamını `.github/change-contract.json` içindeki `impactAnalysis` alanında review et.
17. Gate'i tekrar çalıştır; undeclared discovery sonucu kalmamalı.
18. Targeted regression testlerini çalıştır.
19. Full `npm test` çalıştır.
20. `npm run build` çalıştır.
21. Browser E2E suite'i `npm run e2e` ile gerçek Chromium üzerinde çalıştır.
22. Change gate + targeted regression + full test + build + E2E yeşil olmadan tamamlandı deme.

---

# 3. Universal impact domain'leri

Her change contract `src/systemChangeContract.js` içindeki `SYSTEM_IMPACT_DOMAINS` registry'sinde tanımlı alanların **tamamı** için karar taşır.

Bugünkü registry:

| Domain | Soru |
|---|---|
| `catalog` | Katalog kimliği/descriptörü değişiyor mu? |
| `behavior` | Move/rotation/collision/interaction davranışı değişiyor mu? |
| `state` | Runtime/project state yapısı değişiyor mu? |
| `placement` | Yerleştirme/snap/reflow geometrisi değişiyor mu? |
| `renderer` | Three.js/GLB/procedural render davranışı değişiyor mu? |
| `persistence` | Save/load/autosave/restore etkileniyor mu? |
| `bom` | Recipe/production part/final BOM politikası etkileniyor mu? |
| `ui` | Buton/input/select/menu/feedback/shortcut etkileniyor mu? |
| `composition` | Bir feature birden fazla modül/sistem oluşturuyor veya koordine ediyor mu? |
| `assets` | `public/` asset/model/image tarafı değişiyor mu? |
| `storage` | IndexedDB/asset/project storage etkileniyor mu? |
| `importExport` | ZIP/project schema/import/export etkileniyor mu? |
| `performance` | Render/runtime/bundle maliyeti değişiyor mu? |
| `accessibility` | Keyboard/ARIA/focus/label davranışı etkileniyor mu? |
| `architecture` | Source-of-truth, ownership, dependency veya build mimarisi değişiyor mu? |
| `security` | Yetki, veri sınırı, dış kaynak, input validation veya güvenlik etkisi var mı? |
| `tests` | Bu değişikliği koruyan regression/test sözleşmesi nedir? |

Bir alan unutulduğu için boş bırakılamaz. Uygulanmıyorsa açıkça `not-applicable` yazılır; **tek istisna `tests` domain'idir ve her change contract için `affected` olmak zorundadır.**

Domain sayısı hard-code edilmiş bir süreç kuralı değildir. Registry yarın yeni domainlerle genişlerse change contract yeni registry'nin tamamını değerlendirmek zorundadır.

**Güvenlik kontrolleri:** `impact.security = affected` olan her change contract `security.controls` içinde KYROX ortak kataloğunun SEC-01…SEC-22 kimliklerinin tamamını `required` veya `na` olarak sınıflandırır. Kurallar ve kanıt kaydı tek kaynaktadır: `kyrox-platform/standards/security/SECURITY_PROGRAM.md`; burada kopyalanmaz. `required` en az bir çözümlenen test referansı (`dosya` veya `dosya::test adı`), `na` en az 20 karakterlik somut mimari gerekçe ister ("UI gizli", "testler yeşil", "sonra bakarız", "TBD" gibi gerekçeler reddedilir). `impact.security = not-applicable` iken `required` kontrol yazılamaz. Gate yalnız kaydın bütünlüğünü ve test referansının varlığını kanıtlar; testin geçmesi `npm test` / `pytest` adımlarının işidir ve bu kontrol "sistem güvenli" kanıtı değildir.

Browser E2E zorunluluğuna hangi domainlerin girdiği de ayrı registry olan `SYSTEM_BROWSER_E2E_DOMAINS` ile tanımlıdır. Bugün product/browser-visible alanlar burada bulunur; yarın registry değişirse validator yeni listeyi otomatik uygular.

---

# 4. Change türleri

Makine tarafından tanınan change türleri:

- `module`
- `feature`
- `ui-control`
- `state-change`
- `renderer-change`
- `persistence-change`
- `bom-change`
- `architecture`
- `tooling`
- `bugfix`
- `refactor`

Tür bazı domain kararlarını zorunlu kılar. Örneğin:

- `ui-control` → `ui: affected`
- `state-change` → `state: affected`
- `renderer-change` → `renderer: affected`
- `persistence-change` → `persistence: affected`
- `bom-change` → `bom: affected`
- `architecture` / `tooling` → `architecture: affected`
- bütün change türleri → `tests: affected`

E2E zorunluluğu change type adına göre değil **gerçek affected domainlere göre** hesaplanır.

---

# 5. Path-aware domain wall + full-system dependency wall + browser wall

Sadece geliştiricinin beyanına güvenilmez.

Üç ayrı makine duvarı vardır:

1. **Path/domain wall:** `scripts/verify-change-contract.mjs`, değişen dosyalardan zorunlu impact domain'lerini türetir. Canonical mapping `src/systemChangeContract.js` içindedir.
2. **Full-system dependency wall:** `scripts/change-impact-analysis.mjs`, değişen yüzeyin callers/dependents/source-text tests/token references/docs/findings ilişkisini keşfeder ve `.github/change-contract.json > impactAnalysis` beyanıyla karşılaştırır.
3. **Browser/E2E wall:** `src/systemChangeContract.js`, product/browser-impact domainlerinden biri affected ise targeted `e2e/**` spec'i zorunlu kılar; canonical CI Playwright ile gerçek Chromium'da çalıştırır.

Path/domain kuralları:

- mevcut `src/` dosyalarının tamamı explicit ownership-derived domain mapping taşır; yeni bir `src/` dosyası mapping eklenmeden regression suite geçmez,
- multi-responsibility source dosyaları bilinen bütün kritik domain'lerini zorunlu kılar,
- `public/**` → `assets`,
- `test/**`, legacy `tests/**` ve `e2e/**` → `tests`,
- `playwright.config*` → `architecture + tests`,
- `README.md`, `PROJECT_RULES.md`, `ARCHITECTURE_RULES.md`, `SYSTEM_DEVELOPMENT_CONTRACT.md`, `SYSTEM_CHANGE_GATE.md`, `SYSTEM_IMPACT_SWEEP.md`, `MODULE_BEHAVIOR_STANDARD.md`, `SYSTEM_AUDIT_CHECKLIST.md` → `architecture`,
- `package.json`, `package-lock.json`, `scripts/**`, `.github/workflows/**`, `vite.config*` → `architecture`,
- `index.html` → `ui`.

Dosya yolu bir domain'i zorunlu kılıyorsa change contract bunu `not-applicable` diyerek geçemez.

Full-system dependency kuralları `SYSTEM_IMPACT_SWEEP.md` içindedir. Discovery tarafından bulunan yüzeylerden biri acknowledgement listelerinde yoksa verifier fail-closed olur.

---

# 6. UI / browser için özel kural

Yeni bir buton "küçük değişiklik" sayılmaz.

Örneğin yeni bir "Depoyu Temizle" butonu eklenecekse change contract en az şunları cevaplamalıdır:

- UI owner neresi?
- Hangi state/feature çağrısını tetikliyor?
- Persistence etkisi var mı?
- Undo/restore veya project isolation etkisi var mı?
- Keyboard/accessibility davranışı var mı?
- Hangi unit/integration regression bunu koruyor?
- Hangi **Playwright E2E** gerçek kullanıcı akışını doğruluyor?

Ayrıca full-system impact sweep değişen UI `id`, `data-*` ve ilgili implementation tokenlarını kullanarak handler/controller/test referanslarını arar.

**UI/browser-visible değişiklik targeted E2E olmadan tamamlanmış sayılmaz.**

---

# 7. Asset / arka plan / model için özel kural

Bir background, texture, image, GLB veya başka `public/**` asset'i değişirse sistem:

- bu path'i kullanan JS/CSS/HTML referanslarını,
- onların transitive callers/dependents'larını,
- ilgili mevcut unit/integration/E2E testlerini,
- browser-visible sonucu

kontrol etmek zorundadır.

Asset değişikliği `assets: affected` olduğu için browser E2E trigger eder. Yalnız "dosya var" testi yeterli değildir.

---

# 8. Modül ve feature contract'larıyla ilişki

Bu gate mevcut contract'ların yerine geçmez.

- Module-level detay → `src/moduleContracts.js`
- Feature/composition detay → `src/featureContracts.js`
- Universal değişiklik etkisi → `.github/change-contract.json`
- Universal schema/validator/path map/E2E trigger → `src/systemChangeContract.js`
- Cross-system dependency/test/finding discovery → `SYSTEM_IMPACT_SWEEP.md` + `scripts/change-impact-analysis.mjs`
- Browser user-flow verification → `playwright.config.mjs` + `e2e/**`

Örneğin yeni çöp kovası eklenirken:

1. Universal change contract açılır.
2. `module` olarak sınıflandırılır.
3. catalog/behavior/state/renderer/persistence/BOM/UI vb. etkiler beyan edilir.
4. Full-system impact discovery ile mevcut dependents/tests/contracts gözden geçirilir.
5. `tests: affected`, affected-test inventory ve targeted regression path'i yazılır.
6. Product/browser domainleri affected olduğu için targeted E2E spec yazılır.
7. Sonra `moduleContracts.js` içindeki gerçek modül contract'ı oluşturulur.
8. Implementation sonrası discovery yeniden hesaplanır.
9. Targeted regression + full test + build + E2E yapılır.

---

# 9. CI ve local verifier davranışı

## CI

`CHANGE_GATE_BASE` set ise verifier GitHub `push` `before..after` penceresini kullanmaz; local merge-base + working tree kullanır. Canonical CI bu değişkeni set etmez: `pull_request` GitHub PR base SHA'sını, `push` `before..after` penceresini kullanır.

`CHANGE_GATE_BASE` yoksa PR/`main` push GitHub event SHA'larından çözülür ve şunları denetler:

1. Guarded dosya değişmişse `.github/change-contract.json` aynı diff içinde değişmiş mi?
2. Contract schema eksiksiz mi?
3. Registry'deki bütün impact domain'leri explicit mi?
4. `tests: affected` mı?
5. `impactAnalysis.mode = full-system` mı?
6. En az bir targeted regression path'i var mı?
7. Targeted regressions affected-test inventory içinde mi?
8. `tests.e2e` kararı var mı?
9. Browser-impact domain varsa E2E `required=true` mı?
10. E2E required ise en az bir `e2e/**` targeted spec var mı ve affected-test inventory içinde mi?
11. Beyan edilen targeted unit/integration/E2E dosyaları repoda gerçekten var mı?
12. Change kind ile zorunlu domain'ler uyumlu mu?
13. Path-aware zorunlu domain'ler `affected` mı?
14. Reverse dependency/token/source-text scan tarafından bulunan code dependents beyan edilmiş mi?
15. Discovery tarafından bulunan existing unit/integration/E2E tests beyan edilmiş mi?
16. Discovery tarafından bulunan docs/contracts review edilmiş mi?
17. Discovery tarafından bulunan candidate findings `affected` veya `reviewedNotAffected` olarak ele alınmış mı?
18. Full-suite ve build policy `true` mu?

Ardından canonical CI sırası:

`contract gate → npm ci → npm test → python -m pytest → npm run build → Playwright runner → Chromium → npm run e2e`

E2E failure olursa `playwright-report/` ve `test-results/` trace/screenshot/video kanıtı GitHub Actions artifact olarak saklanır.

## Local

CI environment değişkenleri yoksa `npm run contract:verify` diff enforcement'ı **atlamaz**.

Verifier:

- feature branch'te `main` veya `origin/main` ile merge-base üzerinden committed farkı bulur,
- mevcut `main` branch'inde mümkünse `origin/main` ile local commit farkını karşılaştırır,
- staged değişiklikleri ekler,
- unstaged değişiklikleri ekler,
- untracked dosyaları ekler,
- bütün dosya listesini tekilleştirip aynı guarded/path-domain kurallarından geçirir,
- repository text/reference graph'ını çıkarır,
- reverse dependents ve source-text test referanslarını bulur,
- implementation difflerinden symbol/UI tokenları çıkarır,
- docs/contracts ve candidate audit finding yüzeylerini çıkarır,
- targeted regression/E2E dosyalarının gerçekten var olduğunu doğrular,
- declaration eksikse fail-closed olur.

E2E'yi local çalıştırmak için Playwright runner bir kez `npm run e2e:deps` ile, Chromium ise `npm run e2e:install` ile kurulabilir; ardından `npm run e2e` çalıştırılır.

Gerekirse base açıkça `CHANGE_GATE_BASE=<git-ref> npm run contract:verify` ile verilebilir.

Local base çözülemiyorsa verifier sessizce schema-only success vermez; **fail-closed** olur ve `CHANGE_GATE_BASE` veya `main` ref'i ister.

---

# 10. Bu dosya ne değildir?

Bu dosya:

- mevcut sistemin audit sonucu değildir,
- mevcut bütün UI kontrollerinin envanteri değildir,
- mevcut bütün state alanlarının doğrulandığı anlamına gelmez,
- mevcut bütün renderer/placement/BOM alanlarının temiz olduğu iddiası değildir,
- static dependency scan'in bütün browser/runtime davranışını tek başına kanıtladığı iddiası değildir,
- tek bir baseline E2E smoke testinin bütün feature akışlarını garanti ettiği iddiası değildir.

Static discovery zorunlu minimum tabandır. Browser-impact olduğunda değişen davranışa özel targeted E2E ayrıca zorunludur.

Bu belge yeni değişikliklerin kabul kapısını tanımlar. Mevcut sistemin audit/remediation durumu `SYSTEM_AUDIT_CHECKLIST.md` ve `audit/` kayıtlarında tutulur.

---

# 11. Audit statüleri

Alanlar denetlenirken kullanılan statüler:

- `AUDITED_OK` — contract ve implementation uyumlu.
- `GAP` — eksik veya drift var.
- `DECISION_REQUIRED` — ürün/iş kararı gerekiyor.
- `NOT_APPLICABLE` — bu alan gerçekten uygulanmıyor.
- `NOT_AUDITED` — henüz kontrol edilmedi.

**Kural:** `NOT_AUDITED`, "sorun yok" anlamına gelmez.
