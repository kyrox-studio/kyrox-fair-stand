# Fair Stand — Repository Cleanup Progress

> **HISTORICAL PROGRESS SNAPSHOT — AKTİF İŞ TAKİP DOSYASI DEĞİLDİR.**
>
> Bu dosya eski cleanup döneminde “nerede kalındı / sırada ne var” kaydı olarak kullanılmıştır. İçindeki pending/next-work ifadeleri artık güncel değildir ve yeni iş planı olarak kullanılmamalıdır.
>
> Açık audit bulguları `audit/FINDINGS.md`'dedir; `audit/FULL_SWEEP_STATE.md` A00–A24 tarihî mührüdür. İş listesi `kyrox-platform/projects/fair-stand/ROADMAP.md`; canonical geliştirme kuralları için `SYSTEM_DEVELOPMENT_CONTRACT.md` ve `SYSTEM_CHANGE_GATE.md` kullanılır. Bu dosya yalnız geçmiş cleanup sırasını ve PR geçmişini korur.

---

Bu dosya, fresh repository incelemesi sonrasında nerede kalındığını ve sıradaki işleri takip etmek için tutulur.

Ayrıntılı ilk teknik rapor: `FRESH_REPOSITORY_REVIEW.md`

## Öncelik sırası

### P0

1. GitHub Actions/workflow temizliği.
2. Tek canonical CI ve deterministik `npm ci` akışı.
3. `PROJECT_RULES.md`, `ARCHITECTURE_RULES.md`, `MODULE_BEHAVIOR_STANDARD.md` contract drift temizliği.

### P1

1. README'yi mevcut ürün seviyesine göre yeniden yaz.
2. Dokümantasyonu kayıpsız sınıflandır; eski/uyumsuz bilgiyi sessizce silme.
3. ROADMAP'i gerçek implementasyon durumuyla eşleştir.
4. Catalog → module behavior coverage testi ekle.
5. `main.js` içine yeni sorumluluk eklememeye başla; yeni controller/helper'ları ayrı dosyalara çıkar.

### P2 / P3

- `scene3d.js` renderer sorumluluklarını kademeli böl.
- `SYSTEM_MODULE_CATALOG.md` dokümanını koddan generate etmeyi değerlendir.
- ESLint / Prettier / JSDoc contract desteği ekle.
- `src/` ve `test/` yapısını domain bazlı düzenle.

---

## P0 — GitHub Actions temizliği

Durum: **TAMAMLANDI**

Merge: PR #3

- Eski tek-seferlik workflow/scriptler kaldırıldı.
- Tek canonical `.github/workflows/ci.yml` bırakıldı.
- CI Node 22 + `npm ci` + `npm test` + `npm run build` kullanıyor.

---

## P0 — Documentation / contract cleanup

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #4

---

## P1 — Catalog → module behavior contract coverage

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #5

---

## P1 — README güncellemesi

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #6

---

## P1 — Kayıpsız dokümantasyon sınıflandırması

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #7

Merge commit: `0f99b8cfa58fd14cf6bb5a992e52e2d0f2b89eb5`

- `PRODUCT_FUTURE.md`, `LEGACY_TRASH.md`, `RENDER_FUTURE_BACKLOG.md` oluşturuldu.
- `MILESTONES.md` tarihsel kayıt olarak netleştirildi.

---

## P1 — Roadmap implementation reconciliation

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #8

Merge commit: `537622c6bdf5384be7e12456866a20ab58014ef3`

---

## P1 — `main.js` sorumluluk azaltma / project naming extraction

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #9

Merge commit: `fa8e12f877bc27e91d67e9c59a8a8772fe02c28d`

- `src/projectNaming.js` ve `test/projectNaming.test.js` eklendi.
- Project naming/modal sorumlulukları `main.js` dışına taşındı.

---

## P1 — Autosave controller contract

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #10

Merge commit: `006917a74c9e9b24db3ae056efd984a4c5f126b2`

- `src/autosaveController.js` eklendi.
- 5 saniye debounce / 1 saniye watch contract'ı testlerle sabitlendi.

---

## P1 — Autosave controller integration

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #11

Merge commit: `fa8f518825d9efd2a15c548f078e316cef0e4502`

- `main.js` autosave lifecycle'ı `createAutosaveController()` üzerinden çalışıyor.
- Legacy autosave globals ve duplicate timer loop kaldırıldı.
- Create/restore/manual-save/rename/asset-delete coordination noktaları korundu.
- `test/autosaveMainIntegration.test.js` legacy döngünün geri gelmesini engelliyor.
- `docs/AUTOSAVE_INTEGRATION_NOTES.md` davranış invariant'larını kaydediyor.

---

## P1 — Project UI helper extraction

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #12

Merge commit: `c46ee5cc117df5d8b1625924bc6c072bdeec571d`

- `src/projectUi.js` oluşturuldu.
- `setButtonBusy()` ve project loading overlay show/hide davranışı `main.js` dışına taşındı.
- Unit + integration guard testleri eklendi.

---

## Feature / UX araya giren işler

Cleanup planını iptal etmeden, kullanıcı tarafındaki ihtiyaçlar nedeniyle PR #13–#20 arası aşağıdaki işler ROG'a alındı:

- PR #13–#14: kayıtlı proje dropdown geçişi + yardım kılavuzu.
- PR #15–#17: kamera kısayolları ve `Shift+R` saat yönü standardı.
- PR #18–#20: sürükleme ve sabit seçili modül rotasyonunun invalid ara açılardan devam etmesi.

---

## P1 — Color editor input helper extraction

Durum: **TAMAMLANDI / CI DOĞRULANDI**

Merge: PR #21

Merge commit: `4ddb846c2e9ae773593ebad2e299a370b09af668`

- `src/colorEditorInputs.js` eklendi.
- Numeric RGB/CMYK input grubu okuma `readNumberGroup()` helper'ına taşındı.
- CMYK clamp/round işlemi `normalizeCmykValues()` helper'ına taşındı.
- Saf input contract testleri eklendi.

---

## P1 — Color editor synchronization controller extraction

Durum: **UYGULANDI — PR/CANONICAL CI BEKLİYOR**

Branch: `refactor/extract-color-editor-controller`

Amaç: color editor'ın HEX/RGB/CMYK DOM senkronizasyonunu ve dönüşüm orchestration'ını `main.js` dışına almak; scene selection/application kurallarını `main.js` içinde bırakmak.

Yapılanlar:

- `src/colorEditorController.js` eklendi.
- HEX → RGB/CMYK senkronizasyonu controller'a taşındı.
- RGB input → HEX ve CMYK input → RGB/HEX akışları controller'a taşındı.
- `applyActiveColorToSelection()` ve floor/surface selection kuralları `main.js` içinde bırakıldı; controller yalnız `onApply` callback'i çağırıyor.
- Eski callback return semantiği korundu: RGB/CMYK input handler'ları `undefined`, HEX sync ise başarı durumunda boolean döndürüyor.
- Unit testleri ve layering/integration guard testleri eklendi/güncellendi.
- Guarded branch patch üzerinde `npm ci`, `npm test`, `npm run build` başarılı geçti.
- Geçici patch workflow final branch tree'sinden kaldırıldı.

## Sıradaki İş

1. Color editor synchronization controller extraction için PR aç.
2. Latest-head canonical CI'da `npm ci`, `npm test`, `npm run build` başarılarını doğrula.
3. Başarılıysa ROG'a merge et.
4. Sonraki adımda color editor event-listener wiring'ini controller'a taşımaya değip değmediğini coupling açısından değerlendir; gereksiz soyutlama yaratıyorsa color editor'ı burada bırakıp sıradaki düşük riskli `main.js` sorumluluğuna geç.
