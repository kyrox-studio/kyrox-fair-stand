# Fair Stand — Tam Sistem Audit Bulgu Defteri

> **Açık audit bulgularının kanonik defteri.** Yeni F-* burada açılır/kapanır.
>
> Okuma sırası (açık iş):
> 1. Özet harita → `kyrox-platform/projects/fair-stand/OPEN_WORK_INVENTORY.md`
> 2. Bu dosya → açık / kapalı F-*
> 3. Ertelenmiş karar → `docs/refactor/PENDING_ITEM_DECISIONS.md`
>
> **Bakma (bayat sayaç):** `SYSTEM_AUDIT_CHECKLIST.md`, `audit/FULL_SWEEP_STATE.md`, eski `audit/evidence/*` OPEN satırları.

Güncel ürün okuması: `audit/SISTEM_MUTABAKAT_RAPORU.md` (2026-09-12, Version2).  
Tarihî audit tabanı (A00–A24 kanıt SHA): `ROG e7647326668ab25c96f3a3139f0d855c03176325` — o taramanın mühürü; bugünkü katalog/E2E/Item kimliği için kullanılmaz.

Mod: **AUDIT TAMAM / DEFTER KODA EŞİTLENDİ (A) / ÜRÜN REMEDİASYONU DEVAM**

Ayrıntılı tarihî kanıt `audit/evidence/` altındadır. Remediasyon kapanış kanıtı `audit/remediation/` altındadır.

## Özet

- Toplam bulgu: **49** (`F-000` + `F-001` … `F-048`)
- Kapalı (kod/sözleşme duruyor): **35** — D’den F-017, F-022, F-029, F-032; C’den F-036, F-037, F-038; F-043 kök `LICENSE`; F-042 SHA pin geri alındı
- Kapsam dışı (GitHub ayarı / uzak dal; ürün kodu değil): **F-041 kapanış kaydı durur; F-044 ürün backlog’u değil**
- Açık ürün bulgusu: **11** (F-044 hariç; F-034 bu kümede değil)
- Kabul edilen risk: **1** — F-034 `ACCEPTED_RISK`. `CLOSED` sayacına eklenmez; uygulama/test/CI kanıtı yoktur
- Açık P0: **0**
- Açık P1: **6**
- Açık P2: **5** (F-044 kapsam dışı; F-034 açık P2 değildir)
- Açık P3: **0**
- Sonraki ürün işi: `SISTEM_MUTABAKAT_RAPORU.md` D (kalan mimari) veya E (BOM kararı). **C uygulandı (F-043 kapandı; ESLint açık). F-034 kabul edilen risktir.**
- F-014 hâlâ `decision-required` (18 katalog + foam). Self dörtlü F-014’ten çıktı; finding kapanmaz.

## Bulgular

| ID | Sev | Özet | Durum |
|---|---|---|---|
| F-000 | P1 | Kanonik Item sözleşmesini ekle ve repo giriş noktalarında zorunlu kıl | **CLOSED** — `ITEM_CONTRACT.md` + `AGENTS.md` + giriş testleri; `audit/SISTEM_MUTABAKAT_RAPORU.md` |
| F-001 | P1 | `SYSTEM_MODULE_CATALOG.md` runtime katalog/BOM politikasına göre bayat | **CLOSED** — `audit/remediation/A01_F001_CLOSURE.md` |
| F-002 | P2 | Tarihî/repo-ilerleme belgeleri güncel gerçek sanılabilir | **CLOSED** — `audit/remediation/A01_F002_CLOSURE.md` |
| F-003 | P2 | Yol haritaları kanonik üretim ölçü/reçete gerçeklerini kopyalıyor | **CLOSED** — `audit/remediation/A01_F003_CLOSURE.md` |
| F-004 | P2 | README/geliştirici giriş noktası evrensel change-gate iş akışından önce | **CLOSED** — `audit/remediation/A01_F004_CLOSURE.md` |
| F-005 | P1 | Change-gate yol/alan duvarı eksik; 20/51 `src/` dosyasında zorunlu eşleme yok | **CLOSED** — `audit/remediation/A02_F005_CLOSURE.md` |
| F-006 | P1 | Kanonik kural/kapı Markdown’ı change-gate ile korunmuyor | **CLOSED** — `audit/remediation/A02_F006_CLOSURE.md` |
| F-007 | P2 | `test/` ve `tests/` change-gate korumalı-dosya yönetiminin dışında | **CLOSED** — `audit/remediation/A02_F007_CLOSURE.md` |
| F-008 | P2 | Hedefli regresyon bildirimi boş kalabilir; test etkisi makine zorunlu değil | **CLOSED** — `audit/remediation/A02_F008_CLOSURE.md` |
| F-009 | P2 | Yerel `contract:verify` CI/env dışında diff denetimini atlayabilir | **CLOSED** — `audit/remediation/A02_F009_CLOSURE.md` |
| F-010 | P1 | `main.js` paralel/gizli runtime modül-state oluşturma kaydı içeriyor | **CLOSED** — `audit/remediation/A03_F010_CLOSURE.md` |
| F-011 | P1 | Modüle özel yerleşim/etkileşim politikası davranış sözleşmesinin dışında parçalı | **CLOSED** — `audit/remediation/A03_F011_CLOSURE.md` |
| F-012 | P2 | Stand sahne-çevre kuralı kurulum ile renderer arasında kopyalanmış | **CLOSED** — `audit/remediation/A03_F012_CLOSURE.md` |
| F-013 | P2 | `catalogKey` yokken düz vs sarmaşık separatör katalog kimliği belirsiz | **CLOSED** — `audit/remediation/A04_F013_CLOSURE.md` |
| F-014 | P1 | 18 aktif modül sözleşmesi nihai BOM sınıflandırması gerektiriyor | OPEN / DECISION_REQUIRED |
| F-015 | P1 | `allowSideInsert:false` bildirilmiş ama bağlam/runtime eklemede uygulanmıyor | **CLOSED** — menü gizler; `flushCatalogModuleAdds` reddeder |
| F-016 | P2 | Sağ duvar köşe yön çatışması: 90° yardımcı vs 270° aktif yerleşim/reflow | **CLOSED** — `audit/remediation/A04_F016_CLOSURE.md` |
| F-016 | P2 | Sağ duvar köşe yön çatışması: 90° yardımcı vs 270° aktif yerleşim/reflow | **CLOSED** — `audit/remediation/A04_F016_CLOSURE.md` |
| F-017 | P2 | Renderer kalıcı düzenlenebilir state’i doğrudan değiştiriyor | **CLOSED** — kopya `surfaceState`; yazı `persistentSurfaceState` / `designState` |
| F-018 | P2 | Yapısal strip/panel sayısı katalog ile state oluşturucuları arasında kopyalı | OPEN |
| F-019 | P1 | Katalog/runtime ölçüler state oluşturucularında kopyalı/hard-coded | **CLOSED** — ölçü sahibi Item (`items.js`); şerit `7` kopyası F-018 |
| F-020 | P1 | Bekleyen otomatik kayıt proje değiştir/aç sırasında iptal/kayıp olabilir | **CLOSED** — `audit/remediation/A08_F020_CLOSURE.md` |
| F-021 | P2 | Proje `version` alanı var; kanonik doğrulama/migration hattı yok | OPEN |
| F-022 | P2 | Her özel modül ailesi için tam kalıcılık gidiş-dönüş sözleşmesi yok | **CLOSED** — `test/modulePersistenceRoundTrip.test.js`. Vitrin gövde görseli ayrı ürün kararı |
| F-023 | P2 | Tüm proje silme, proje ve asset store’lar arasında atomik değil | **CLOSED** — `audit/remediation/A08_F023_CLOSURE.md` |
| F-024 | P2 | Model yükleme hatası görünmez modül bırakabilir; reddedilen loader promise’leri önbellekte kalır | **CLOSED** — `loadGltfScene` reddinde cache siler; `#stage-result` |
| F-025 | P1 | Üretim giriş noktası görünür `rawBomDebug.js` UI yükler | **CLOSED** — `index.html` yüklemez; yalnız `DEV` + `?rawBom` |
| F-026 | P2 | Kullanıcıya görünen standart/özellik gerçekleri statik HTML metin olarak kopyalı | **CLOSED** — `standStandardsCopy.js` ← `STAND_DIMENSIONS` (`src/standDimensions.js`) / `standSetup` / karolaj |
| F-027 | P1 | “Duvarı temizle” etiket/onay kapsamının ötesinde tüm modülleri siler | **CLOSED** — `audit/remediation/A10_F027_CLOSURE.md` |
| F-028 | P1 | “Tüm Özellikleri Kaldır” `illuminated-foam` varken başarısız olabilir | **CLOSED** — `audit/remediation/A10_F028_CLOSURE.md` |
| F-029 | P1 | Aktif otomatik-duvar bileşiminin açık özellik sözleşmesi yok | **CLOSED** — `FEATURE_CONTRACTS.automaticWall`; depo `contentCatalogKeys` dört Item |
| F-030 | P1 | Kanonik proje düzeyi Final BOM üreteci yok | **OPEN** — `resolveProjectBom` modül satırlarını, eklem düzeltmesini, cam ayrımını, zemini ve baskı alanını toplar. Kapanış kaydı yok |
| F-031 | P1 | İlişki/köşe bağlantı parçaları proje ilişkilerinden türetilmiyor | **OPEN** — `relationshipBom.js` yan yana çiftli, iç köşe, T ve ön/arka yüzü uygular. Baza ve short-up dışarıda. Kapanış kaydı yok |
| F-032 | P2 | IndexedDB şema/migration sahipliği store’lar arasında kopyalı | **CLOSED** — `configuratorDb.js` tek open/upgrade |
| F-033 | P2 | `public/` altında ~30.64 MiB park edilmiş/atıfta bulunulmayan varlık üretimle gidiyor | **CLOSED** — `audit/remediation/A13_F033_CLOSURE.md` |
| F-034 | P2 | Genel model/varlık kökeni ve lisans envanteri eksik | **ACCEPTED_RISK** — `audit/remediation/A13_F034_CLOSURE.md`. Envanter `docs/assets/PUBLIC_MODEL_ATTRIBUTION.md`; 9 GLB atıfsız kalır. `CLOSED` değil |
| F-035 | P2 | ZIP arşiv sürüm/şemasının ortak kanonik sahibi/migration kaydı yok | OPEN |
| F-036 | P1 | İçe aktarılan proje/modül state yapısal alan doğrulaması olmadan persist ediliyor | **CLOSED** — `projectImportValidation.js` |
| F-037 | P1 | ZIP/görsel içe aktarmada açık adet/boyut/kaynak limiti/içerik politikası yok | **CLOSED** — ZIP/`assets/` yolu, `image/*`, zip MIME; MB/adet uydurulmadı |
| F-038 | P2 | Bağımlılık/güvenlik danışma taraması CI’da zorunlu değil | **CLOSED** — `npm run audit:deps` CI |
| F-039 | P2 | Dinamik modal/bağlam menüsü odak/erişilebilirlik semantiği tutarsız | **CLOSED** — foam dialog + bağlam menüsü `role`/`Escape`; tam odak tuzağı yok |
| F-040 | P1 | “Tarayıcı E2E yok” iddiası; kalan boşluk ZIP/GLB-fail spec | **OPEN** — Playwright spec + CI var; ZIP ve GLB hata yolu e2e yok |
| F-041 | P1 | ROG korumasız; yeşil CI/change-gate merge/doğrudan push öncesi zorunlu değil | **CLOSED** — kapanış MD var; GitHub ruleset ürün kodu değil (`SISTEM_MUTABAKAT_RAPORU.md`) |
| F-042 | P1 | Sunucu deploy yolu commit’e pinli değil ve CI kapısı/test zincirinden zayıf | **OPEN** — SHA yok; origin default (`origin/HEAD`) ucu çekilir. CI deploy kapısı yok |
| F-043 | P2 | Açık repoda kök yazılım lisansı kararı/dosyası yok | **CLOSED** — `audit/remediation/A21_F043_CLOSURE.md`. Proprietary / all rights reserved; açık kaynak izni yok |
| F-044 | P2 | Birçok merge edilmiş/geçersiz dal duruyor | **KAPSAM_DIŞI** — GitHub dal hijyeni; ürün kodu değil |
| F-045 | P2 | Tarihî kaynak-yeniden-yazan yama betikleri kanonik araçların yanında duruyor | **CLOSED** — DECISION-07 ARCHIVE; `scripts/archive/` + README; npm/CI yok |
| F-046 | P2 | Kanonik CI zincirinde lint/format/statik-kalite kapısı yok | **OPEN** — `syntax:check` eklendi; ESLint/format yok |
| F-047 | P2 | Katalog-dışı runtime nesne genişlemesinin açık kanonik kabul/sözleşme kuralı yok; güncel örnek `illuminated-foam` (ışıklı strafor/logo) | **OPEN** — foam’un `NON_CATALOG_MODULE_CONTRACTS` kaydı var; yeni katalog-dışı nesne kapısı yok |
| F-048 | P1 | Hiçbir modül veya sistemin eklediği öğe, açık kanonik BOM politikası/sınıflandırması olmadan var olamaz | OPEN |

## Alanlar arası remediasyon kümeleri

1. Kullanıcıya görünen (B): **uygulandı** — F-015, F-025, F-026, F-024, F-039. F-040 kalan ZIP/GLB e2e.
2. Kalıcılık/import: F-021/F-035. F-022, F-032, F-036, F-037 kapandı.
3. BOM (E, ürün kararı): F-014/F-048 açık. F-030/F-031 kodu üretim listesinde; ikisi de OPEN (baza ve short-up F-031 dışında, kapanış kaydı yok). F-029 kapandı (özellik sözleşmesi).
4. Mimari borç: F-018/F-047 kural. F-017 kapandı.
5. Hijyen: F-034 `ACCEPTED_RISK` (metadata tamamlanmadı). F-042, F-046 ESLint açık. F-043 kapandı. F-045 arşivlendi. F-038 kapandı. F-044 kapsam dışı.

Bir bulgu ancak uygulama, varsa hedefli regresyon, tam test/build, PR CI ve gerekli merge-sonrası doğrulama kanıtından sonra `CLOSED` olur. `ACCEPTED_RISK` bu kanıtın yerine geçmez; bulgu silinmez, açık kümeden çıkar ve kalan risk kapanış kaydında durur.
