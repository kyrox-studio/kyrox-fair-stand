# Fair Stand — Full-System Change Impact Sweep

Bu belge, sisteme yapılan **her ekleme, değiştirme, düzeltme, silme, refactor, bugfix, UI değişikliği, state değişikliği, renderer değişikliği, persistence değişikliği, tooling değişikliği ve mimari değişiklik** için zorunlu etki taramasını tanımlar.

Bu kuralın amacı yalnızca "hangi domain etkilenebilir?" sorusunu sormak değildir. Amaç, değişen yüzeyin **gerçekte nerelerde kullanıldığını, hangi mevcut sözleşme/testlerin bu değişikliğe bağlı olduğunu ve browser-visible davranışın gerçek kullanıcı akışında çalışıp çalışmadığını değişiklik kabul edilmeden önce bulmaktır.**

## 1. Temel kural

Guarded bir değişiklik yapıldığında sistem yalnız değişen dosyayı kontrol etmez.

Zorunlu tarama zinciri:

`değişen dosya / symbol / UI id / contract / asset`  
`→ doğrudan referanslar ve import edenler`  
`→ transitive dependents / orchestration yolları`  
`→ mevcut unit/integration/E2E testleri ve source-text assertions`  
`→ canonical docs/contracts`  
`→ audit finding adayları`  
`→ targeted regression`  
`→ full unit/integration test`  
`→ build`  
`→ browser-impact varsa targeted Playwright E2E`

Bu tarama tamamlanmadan implementation kabul edilmez.

## 2. Domain sayısına bağlı değildir

Bu süreç bugün tanımlı domain sayısına sabitlenmez.

`SYSTEM_IMPACT_DOMAINS` registry'sinde bugün kaç domain varsa **tamamı** değerlendirilir. Yarın registry 17 yerine 38 domain içerirse aynı kural registry'nin tamamına uygulanır.

Browser E2E zorunluluğu da sabit change-type listesine değil `SYSTEM_BROWSER_E2E_DOMAINS` registry'sine bağlıdır. Registry genişlerse E2E zorunluluğu yeni browser-impact domainlerini otomatik kapsar.

## 3. Otomatik discovery zorunluluğu

`npm run contract:verify` değişen guarded yüzeyler için en az şu keşifleri yapar:

1. Relative/static import ve export referansları.
2. Dynamic `import()` referansları.
3. `new URL('../src/...', import.meta.url)` ve benzeri source-file referansları.
4. Relative path string referansları.
5. HTML `src` / `href` ve CSS `url(...)` asset referansları.
6. Reverse dependency graph ve transitive dependents.
7. Diff içinde değişen/çıkarılan fonksiyon, class, state/controller/registry/contract/module/factory isimleri.
8. Diff içinde değişen UI `id`, `data-*`, CSS id/class tokenları.
9. Bu tokenları kullanan mevcut source/unit/integration/E2E/doc dosyaları.
10. Audit kayıtlarında aynı tokenlarla ilişkili finding adayları.

Discovery yalnız yeni kodu değil **silinen/eski symbol'leri de** tarar. Böylece refactor sırasında eski implementation adını regex ile bekleyen bir test görünür hale gelir.

`e2e/**` test yüzeyi olarak sınıflandırılır; `playwright.config*` hem test hem architecture yüzeyidir. Bunlar change gate dışında bırakılamaz.

## 4. Zorunlu acknowledgement

`.github/change-contract.json` her değişiklikte `impactAnalysis.mode = "full-system"` taşır.

Ayrıca şu listeler açıkça beyan edilir:

- `impactAnalysis.affectedFiles` — discovery tarafından bulunan ve gözden geçirilmesi gereken code/runtime dependents.
- `impactAnalysis.affectedTests` — değişiklikten etkilenebilecek mevcut unit/integration/E2E testleri + targeted testler.
- `impactAnalysis.affectedDocs` — canonical veya ilişkili doküman/contract yüzeyleri.
- `impactAnalysis.relatedFindings.affected` — gerçekten etkilenen audit finding'leri.
- `impactAnalysis.relatedFindings.reviewedNotAffected` — discovery tarafından aday gösterilen fakat incelenip etkilenmediği doğrulanan finding'ler.

Discovery tarafından bulunan bir yüzey bu beyanlarda yoksa gate **fail-closed** olur.

## 5. Test + E2E kuralı

Bir testin daha önce yeşil olması, yeni mimari için doğru test olduğu anlamına gelmez.

Her değişiklikte:

1. Discovery'nin bulduğu mevcut testler `impactAnalysis.affectedTests` içinde görünür olmalıdır.
2. Değişen davranış için en az bir targeted regression zorunludur.
3. Targeted testlerin tamamı `impactAnalysis.affectedTests` içinde yer almalıdır.
4. Existing test source-shape/implementation-detail assertion içeriyorsa yeni canonical ownership'e göre gözden geçirilir.
5. Test yalnız eski dosya adı, eski factory çağrısı veya eski dispatcher şekli bulunduğu için geçemez.
6. Targeted regression sonrası full `npm test` çalışır.
7. Ardından `npm run build` çalışır.
8. Change contract her zaman `tests.e2e` kararı taşır.
9. `SYSTEM_BROWSER_E2E_DOMAINS` içindeki herhangi bir domain `affected` ise `tests.e2e.required` **true olmak zorundadır**.
10. E2E required ise en az bir `e2e/**` targeted spec beyan edilir ve aynı spec `impactAnalysis.affectedTests` içinde bulunur.
11. Beyan edilen targeted unit/integration/E2E dosyası repoda gerçekten yoksa verifier fail eder.
12. CI sonunda gerçek Chromium üzerinde `npm run e2e` çalışır.

Architecture/tooling-only bir değişiklik browser davranışını etkilemiyorsa `tests.e2e.required: false` yazılabilir; bunun için non-empty gerekçe zorunludur. Baseline E2E suite yine canonical CI'da çalışmaya devam eder.

## 6. UI / buton kuralı

Bir buton, input, menu action, keyboard shortcut veya görünür UI değiştiğinde yalnız HTML/CSS kontrol edilmez.

Tarama en az şunları kapsar:

- DOM id/data attribute referansları,
- event handler / controller,
- çağrılan state veya feature yolu,
- persistence/save-load etkisi,
- undo/restore/delete kapsamı,
- renderer/scene etkisi,
- keyboard/accessibility etkisi,
- ilgili integration/source tests,
- gerçek kullanıcı akışını çalıştıran targeted browser/E2E spec.

**UI/browser-visible değişikliklerde E2E opsiyonel değildir.** Change contract E2E targeted path göstermeden gate geçemez.

UI yalnız DOM'a eklenip event handler bağlanarak tamamlanmış sayılmaz.

## 7. State / API / function kuralı

Bir function, method, state factory, registry veya public API değiştiğinde:

- nerede tanımlı olduğu,
- nerelerde çağrıldığı,
- hangi wrapper/orchestrator üzerinden kullanıldığı,
- hangi module/feature ailesini etkilediği,
- hangi testlerin doğrudan veya source-text üzerinden bağlı olduğu,
- persistence/restore yollarının etkilenip etkilenmediği,
- browser-visible sonucu varsa hangi E2E akışının bunu doğruladığı,
- ilişkili finding/contract'ların etkilenip etkilenmediği

zorunlu olarak gözden geçirilir.

Yeni canonical API eklenip eski çağıran/testler sessizce bırakılmaz.

## 8. Asset / arka plan / model kuralı

`public/**` altında görsel, texture, GLB, font veya benzeri asset değiştiğinde yalnız dosyanın varlığı test edilmez.

Impact sweep:

- asset path'ini kullanan JS/CSS/HTML yüzeylerini,
- onların transitive dependents'larını,
- ilgili mevcut testleri,
- browser-visible sonuç için E2E akışını

incelemek zorundadır.

Örneğin bir arka plan texture'ı değiştiğinde CSS veya renderer referansı bulunup onun browser akışı doğrulanmadan değişiklik tamamlanmış sayılmaz.

## 9. Finding ilişkileri

Bir remediation başka bir finding'in root cause'una dokunuyorsa bu ilişki görünür olmak zorundadır.

Örnek:

`F-010 state construction ownership` değişikliği `createCatalogModuleState` / non-catalog construction yolunu etkiliyorsa, `F-028 Tüm Özellikleri Kaldır + illuminated-foam` finding'i impact sweep sırasında aday olarak görünmeli ve `affected` veya gerekçeli `reviewedNotAffected` olarak ele alınmalıdır.

Finding'ler yalnız sıra numarasına göre bağımsız işler gibi uygulanmaz.

## 10. Fail-closed ilkesi

Aşağıdaki durumlardan biri varsa değişiklik kabul edilmez:

- impact analysis eksikse,
- discovery bulunan code dependent beyan edilmemişse,
- discovery bulunan unit/integration/E2E test beyan edilmemişse,
- discovery bulunan doc/contract gözden geçirilmemişse,
- candidate finding incelenmemişse,
- targeted regression yoksa,
- browser-impact olduğu halde E2E required değilse,
- E2E required olduğu halde targeted `e2e/**` spec yoksa,
- beyan edilen test dosyası repoda yoksa,
- full test başarısızsa,
- build başarısızsa,
- Playwright E2E başarısızsa.

"CI'da sonra çıkar" kabul edilen çalışma yöntemi değildir.

## 11. Browser E2E çalışma şekli

Canonical E2E runner Playwright'tır.

CI:

1. Playwright runner'ın pinned sürümünü kurar.
2. Chromium browser ve Linux browser bağımlılıklarını kurar.
3. Vite uygulamasını gerçek HTTP server üzerinden açar.
4. `e2e/**` spec'lerini headless Chromium'da çalıştırır.
5. Failure durumunda trace/screenshot/video çıktısını artifact olarak saklar.

İlk baseline smoke akışı gerçek kullanıcı gibi:

`uygulamayı aç → stand tipi seç → X/Y gir → proje adını gir → sahneyi oluştur → viewport/toolbar/modül ekleme/status sonucunu doğrula`

Yeni feature/remediation bunun ötesinde bir kullanıcı davranışı değiştiriyorsa kendi targeted E2E akışını eklemek zorundadır; baseline smoke tek başına yeterli sayılmaz.

## 12. Sınır

Static discovery bütün runtime davranışını matematiksel olarak kanıtlayamaz. Reflection, runtime-generated selector/path, browser-only interaction veya external side effect gibi dinamik ilişkiler static scan dışında kalabilir.

Bu nedenle otomatik discovery **minimum zorunlu tabandır**, insan/AI impact review'ının yerine geçmez. Domain classification, contract review, targeted regression, full test/build ve browser-impact durumunda gerçek Playwright E2E birlikte uygulanır.

Playwright E2E de bütün olası kullanıcı kombinasyonlarını matematiksel olarak kanıtlamaz. Değişen davranışa özgü targeted spec seçimi impact analysis'in parçasıdır.

## 13. Zorunlu çalışma sırası

1. Fresh base üzerinden change branch oluştur.
2. Değişikliği tanımla; henüz implementation yazma.
3. Universal domain classification yap.
4. Full-system impact discovery çalıştır.
5. Bulunan callers/dependents/tests/docs/findings listesini incele.
6. Browser-impact domain varsa targeted E2E senaryosunu belirle.
7. Change contract içinde tam impact analysis acknowledgement + `tests.e2e` kararını yaz.
8. Canonical owner ve contract kararlarını ver.
9. Implementation yap.
10. Impact discovery'yi tekrar çalıştır; diff değiştiyse acknowledgement listelerini güncelle.
11. Targeted unit/integration regressionları çalıştır.
12. Full `npm test` çalıştır.
13. Build çalıştır.
14. Playwright E2E çalıştır.
15. PR CI tamamen yeşil olmadan tamamlandı deme.
16. PR CI yeşil geçip merge edilmeden finding kapatma (merge sonrası `main`'de CI tekrar koşmaz; `main` ruleset'i strict zorunlu kontrol ister).

**Kural:** Etki alanı implementation'dan sonra tahmin edilmez; implementation'dan önce keşfedilir ve implementation değiştikçe yeniden hesaplanır. Browser-visible etki varsa gerçek kullanıcı akışı da kod kabul edilmeden önce çalıştırılır.
