# Fair Stand — Release Hardening Roadmap

> Amaç: FAZ 4/5/6 ürün geliştirmesine devam etmeden önce mevcut çalışan ürünü kullanıcı testine ve satışa daha güvenli hale getirmek.
>
> Bu dosya yeni feature roadmap'i değildir. Mevcut sistemde doğrulanmış runtime/UI kusurları, production kalıntıları, repository hijyeni ve release güvenlik kapılarını takip eder.
>
> Güncel ürün sırası: `audit/SISTEM_MUTABAKAT_RAPORU.md`. GitHub ruleset / dal temizliği ürün kodu değildir (madde 6–7).

## Başlangıç durumu — 3 Eylül 2026

- `ROG` canonical CI yeşil.
- Canonical CI: `npm ci` → `npm test` → `npm run build`.
- Açık PR/issue yok.
- Mevcut Node test paketi geniş regresyon coverage sağlıyor.
- Büyük `main.js` / `scene3d.js` refactorları release hardening sırasında yapılmayacak; yalnız düşük riskli ve doğrulanmış düzeltmeler yapılacak.

---

# P0 — Kullanıcı testi / satış öncesi kapatılacaklar

## 1. Initial selection-state contract'ını düzelt

Durum: **KAPANDI** — `index.html` `#selection-info` metni `DEFAULT_SELECTION_HINT` ile aynı; `test/visibleUiContract.test.js` + `e2e/visible-ui-b.spec.mjs`.

## 2. Production'daki Raw BOM debug panelini kaldır / DEV-only yap

Durum: **KAPANDI** — `index.html` `rawBomDebug.js` yüklemez. Panel yalnız `import.meta.env.DEV && ?rawBom`. Production build’de Vite `DEV=false`.

## 3. Selection feedback ownership sızıntısını kapat

Durum: **AÇIK**

Problem:

- Selection mesajlarının canonical formatter'ı `selectionFeedback.js` içine taşındı.
- Ancak Işıklı Strafor ışık rengi değişiminde `main.js` aynı seçim mesajını tekrar elle oluşturuyor.

Yapılacak:

- Mesaj üretimi tek formatter katmanından geçirilecek.
- `main.js` yalnız state/UI wiring yapacak.
- Başka `main.js` refactorı bu işin içine alınmayacak.

## 4. Critical browser smoke test ekle

Durum: **KAPANDI (koşum)** — `e2e/` Playwright spec + CI `npm run e2e`. F-040 “E2E yok” iddiası yanlış.

Kalan: ZIP import/export ve GLB yükleme hatası için hedefli spec yok (`audit/FINDINGS.md` F-040).

Minimum smoke akışı:

1. Stand tipi ve ölçü gir.
2. Sahneyi oluştur.
3. Katalogdan modül ekle.
4. Modülü seç / taşı / döndür.
5. Renk veya görsel uygula.
6. Projeyi kaydet.
7. Kayıtlı projeyi tekrar aç.
8. ZIP export/import round-trip kontrol et.

Tercih: Playwright ile küçük, stabil bir release smoke suite.

---

# P1 — Release güvenliği ve repository hijyeni

## 5. Doğrulanmış dead code'u kaldır

Durum: **AÇIK**

İlk doğrulanmış örnek:

- `main.js` içindeki `syncWallLengthFromSetup()` kapasite hesaplıyor fakat sonucu kullanmadan bitiyor; aktif kullanım bulunmadı.

Kural:

- Yalnız gerçekten kullanılmadığı source/test ile doğrulanan kod kaldırılacak.
- Bu başlık genel refactor bahanesine çevrilmeyecek.

## 6. ROG branch protection / required CI

Durum: **KAPSAM_DIŞI** — GitHub ruleset; ürün kodu değil. `audit/SISTEM_MUTABAKAT_RAPORU.md`.

Mevcut durum:

- `ROG` protected değil.
- Canonical CI var fakat merge/push için zorunlu gate değil.

Hedef:

- PR üzerinden değişiklik.
- `CI / verify` required status check.
- Force push kapalı.
- Core branch'e doğrudan yanlış push riski azaltılmış olacak.

## 7. Merge edilmiş branch kalıntılarını temizle

Durum: **KAPSAM_DIŞI** — GitHub dal hijyeni; ürün kodu değil. Origin head 2026-09-12: `ROG` + `Version2`.

Mevcut durum:

- Çok sayıda eski `feature/`, `fix/`, `refactor/`, `docs/`, `cleanup/` branch'i merge sonrası duruyor.
- Repository ayarında merge sonrası branch otomatik silme kapalı.

Yapılacak:

- ROG'a tamamen merge edilmiş branch'ler doğrulanıp silinecek.
- Uygunsa merge sonrası otomatik branch silme açılacak.

## 8. Legacy patch / trigger scriptlerini sınıflandır ve temizle

Durum: **UYGULANDI (DECISION-07 ARCHIVE)** — Üç Python yama betiği `scripts/archive/` altına taşındı; `scripts/archive/README.md` aktif tooling olmadıklarını yazar. `package.json`/CI çalıştırmaz. F-045 kapatıldı. `scripts/video-wall-build-trigger.txt` **SCRIPT_ONLY_STALE** durur (`SAFE_TO_REMOVE = 0`). **Çalıştırmayın.**

Doğrulanmış kalıntılar:

- `scripts/archive/add-tv-sizes.py` — arşiv; aktif `scripts/` yüzeyi değil
- `scripts/archive/add-video-wall-2x2.py` — arşiv
- `scripts/archive/fix-tv-screen-face.py` — arşiv
- `scripts/video-wall-build-trigger.txt` — SCRIPT_ONLY_STALE; roadmap referansı var, silinmedi

Not:

- `scripts/install-server.sh` gerçek operasyon/deploy scriptidir; legacy patch dosyalarıyla aynı şekilde ele alınmayacak.
- Tarihsel değer varsa Git history zaten korur.

## 9. Test klasörü standardını tekleştir

Durum: **A uygulandı (kısmi)** — `tests/autoDepot.test.js` ve `tests/moduleBehavior.test.js` `test/` altına taşındı. `FEATURE_CONTRACTS.automaticDepot.tests.regressionFiles` güncellendi. `src/groundLayout.js` TEST_SUPPORT olarak duruyor (DECISION-04/05). `src/cornerPlacement.js` hiçbir kaynak ya da testten import edilmediği için 2026-10-23 ölü kod taramasında silindi; `test/cornerPlacement.test.js` üretim yolunun onu import etmediğini korumaya devam eder.

## 10. Stale audit/cleanup dokümanlarını historical hale getir

Durum: **KISMEN / A uygulandı** — `FRESH_REPOSITORY_REVIEW.md` historical banner; `FINDINGS`/`FULL_SWEEP`/`A24`/checklist 2026-09-12 mühürlendi. `Changelog` bu change set’te tarihî işaretlenir.

Problem:

- `REPOSITORY_CLEANUP_PROGRESS.md` güncel merge seviyesinin gerisinde.
- `FRESH_REPOSITORY_REVIEW.md` geçmiş snapshot olmasına rağmen adı/formatı güncel audit gibi algılanabiliyor.

Yapılacak:

- Aktif source-of-truth olmadıkları açıkça işaretlenecek veya history klasörüne taşınacak.
- Güncel release hardening takibi bu dosyada yapılacak.

## 11. Public repository / license kararını kesinleştir

Durum: **KARAR GEREKİYOR**

Mevcut durum:

- Repository public.
- Repository seviyesinde lisans tanımlı görünmüyor.

Karar:

- Ticari kaynak kodun public olması bilinçli ise bunu koru ve lisans politikasını netleştir.
- Kapalı kaynak olması gerekiyorsa satıştan önce repository visibility/deployment akışını buna göre düzenle.

## 12. Kullanılmayan büyük public assetleri temizle

Durum: **KISMEN** — `indoor_plants2.glb` ağaçta yok (F-033 kapanışı). Diğer parked asset tarama bu A belgesinde yeniden yapılmadı.

Doğrulanmış/şüpheli örnekler:

- `public/models/indoor_plants2.glb` — runtime'dan kaldırılmış model, gelecekte kullanım için parked.
- `public/textures/exhibition-floor.jpg` — runtime optimized sürümü kullanıyor.
- Diğer alternatif/parked GLB'ler source referanslarıyla tek tek doğrulanacak.

Yapılacak:

- Kullanılmayan assetler production `public/` ağacından çıkarılacak veya ayrı archive/source alanına taşınacak.
- Kullanılan büyük GLB'ler için gerekiyorsa optimize/lazy-load değerlendirmesi yapılacak.

## 13. Minimal static quality gate ekle

Durum: **AÇIK**

Hedef:

- ESLint veya eşdeğer statik kontrol.
- İlk aşamada büyük style/format churn yaratmadan gerçek hata sınıflarını yakalayan küçük kural seti.
- CI hedefi: static check → test → build.

## 14. Deploy akışını explicit release SHA/branch ile sabitle

Durum: **AÇIK**

Mevcut `install-server.sh` bulunduğu checkout üzerinde `git pull --ff-only` + `npm ci` + `npm run build` çalıştırıyor.

Hedef:

- Deploy kaynağı explicit `ROG` veya release tag/SHA olsun.
- Mümkünse yalnız canonical CI'dan geçmiş SHA deploy edilsin.
- Production deploy öncesi minimum doğrulama kapısı belirlensin.

---

# P2 — Release sonrasına bırakılabilecek teknik borç

## 15. `main.js` sorumluluk azaltmaya kontrollü devam

Durum: **RELEASE SONRASI**

- Tek seferde büyük refactor yapılmayacak.
- Yalnız bağımsız, testlenebilir, davranış değiştirmeyen küçük sorumluluklar çıkarılacak.

## 16. `scene3d.js` renderer ayrıştırması

Durum: **RELEASE SONRASI**

- `scene3d.js` büyük ve module-specific renderer sorumluluğu yüksek.
- Ancak kullanıcı testi öncesi geniş refactor yapılmayacak.
- Renderer extraction işi ayrı regression testleriyle küçük PR'lara bölünecek.

---

# Uygulama sırası

1. Initial selection-state düzeltmesi.
2. Raw BOM debug production temizliği.
3. Işıklı Strafor selection feedback duplicate'ını kaldır.
4. Browser smoke suite.
5. Dead code doğrulama/temizliği.
6. ROG branch protection + required CI.
7. Merge edilmiş branch temizliği.
8. Legacy scripts + test klasörü temizliği.
9. Stale audit dokümanlarının historical sınıflandırması.
10. Büyük/unused public asset temizliği.
11. Minimal static quality gate.
12. Deploy hardening.
13. Public/private + license kararının kesinleştirilmesi.
14. Release gate tamamlandıktan sonra aktif ürün roadmap'ine geri dön.

---

# Release gate

Aşağıdakiler tamamlanmadan `release hardening tamamlandı` denmez:

- [ ] Canonical CI yeşil.
- [ ] Initial selection-state bug kapalı.
- [ ] Production debug paneli kapalı veya DEV-only.
- [ ] Critical browser smoke suite yeşil.
- [ ] ROG için required CI gate aktif.
- [ ] Doğrulanmış legacy branch/script kalıntıları temiz.
- [ ] Kullanılmayan büyük public assetler sınıflandırılmış/temizlenmiş.
- [ ] Deploy kaynağı explicit ve tekrar üretilebilir.
- [ ] Public/private ve license kararı bilinçli olarak verilmiş.

Bu maddeler release stabilizasyonu içindir; FAZ 4/5/6 kapsamındaki parametrik sistem, Final BOM ve Fair CRM/Costing işleri bu dosyanın kapsamı dışındadır.
