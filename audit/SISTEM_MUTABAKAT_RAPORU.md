# Fair Stand — Sistem mutabakat raporu

Tarih: 2026-09-12  
Taban: lokal `Version2` ağacı (`a2c6a75` + bu belge). Kod yazılmadı.  
Kaynak: bu makinedeki MD + `src/` + `test/` + `e2e/` + `scripts/` + `index.html` + `.github/workflows/ci.yml`.  
**Kapsam dışı (senin ürün kodun değil):** GitHub ruleset, dal koruması, uzak dal listesi, F-041, F-044. Bu dosyada acil iş sayılmaz.

> **2026-10-18 — açık iş okuma sırası:** özet `kyrox-platform/projects/fair-stand/OPEN_WORK_INVENTORY.md` → `audit/FINDINGS.md` → `docs/refactor/PENDING_ITEM_DECISIONS.md`. Checklist / FULL_SWEEP bayat sayaçtır; oturum oradan başlamaz.

Bu dosya 2026-09-12 mutabakat mühürüdür. Önceki çift rapor (`SISTEM_MUTABAKAT` + `SISTEM_TOPARLAMA`) birleştirildi; ruleset/dal iddiaları atıldı; lokal tarama ile düzeltilen sapmalar işlendi.

---

## 1. Tek cümle

Sistem çalışıyor. Karmaşa: eski audit / `current-system` / checklist kapanmış işi açık gösteriyor; gerçek açık iş (debug BOM, yan ekleme, seçim metni, import, Final BOM kararı) bunun altında kalıyor. Önce defteri koda eşitle, sonra kalan kod P1’lere gir.

---

## 2. Şimdi bakılması gerekenler

| Sıra | Ne | Tür | Kanıt |
|---:|---|---|---|
| 1 | Audit defterini koda eşitle | Belge | **A uygulandı.** FINDINGS koda eşit; `FULL_SWEEP` tarihî mühür. |
| 2 | Üretimde Raw BOM debug | Kod | **B uygulandı.** `index.html` yüklemez; `DEV` + `?rawBom`. F-025 kapalı. |
| 3 | Overlay yan ekleme menüde açık | Kod | **B uygulandı.** Menü gizler; `flushCatalogModuleAdds` reddeder. F-015 kapalı. |
| 4 | İlk seçim metni iki kaynak | Kod | **B uygulandı.** `index.html` = `DEFAULT_SELECTION_HINT`. |
| 5 | Standart/yardım ölçü kopyası | Kod | **B uygulandı.** `standStandardsCopy.js`. F-026 kapalı. |
| 6 | ZIP import şema/limit yok | Kod | `archiveVersion === 1` + `project.id`. `restoreProject()` `stand`/`modules` doğrulamaz. F-036 / F-037. |
| 7 | GLB hata sessiz | Kod | **B uygulandı.** `loadGltfScene` cache siler; `#stage-result`. F-024 kapalı. |
| 8 | Belge gövdesi “şu anki sistem” | Belge | `current-system` 94 dosya: 53 tarihî şerit, 41 şeritsiz; gövde `catalogKey` / `DEPOT_*`. `definitions` zemin kartları `floorType` persist der; kod `stand.itemKey` yazar. |
| 9 | Otomatik duvar feature contract yok | Kod | **D uygulandı.** `FEATURE_CONTRACTS.automaticWall`. F-029 kapalı. |
| 10 | Proje Final BOM | Kod | **2026-09-27:** `resolveProjectBom` toplar (eklem, cam, zemin, baskı). F-030 / F-031 defterde OPEN; baza ve short-up eklem dışı. F-014 / F-048 durur. Miktar uydurulmaz. |

---

## 3. Sistem iskeleti (güncel kod)

1. Kimlik: `itemKey`. `src/` içinde `catalogKey` yok. Zemin persist `stand.itemKey`; eski `floorType` hydrate + silinir. UI select id `floor-type`.
2. Katalog: **51** anahtar (`SYSTEM_MODULE_CATALOG.md` test kilitli). BOM: **29 recipe / 4 self / 18 decision-required**. Katalog dışı: `illuminated-foam` (contract var, BOM `decision-required`). Zemin: 5 Item, katalog dışı, `unit` yok.
3. Self BOM bitmiş: `COAT_RACK`, `KETTLE`, `MINI_FRIDGE_AVANTI`, `PLASTIC_TRASH_BIN` — `unit: 'adet'`, `resolveItemBom` ×1.
4. State: `designState.js` `MODULE_STATE_FACTORIES` (25 type). `createModuleStateFromDescriptor`. F-010 kapalı.
5. Davranış: `moduleBehavior.js`. Overlay tv + foam. Bar taburesi / tekli koltuk 45°. Yan ekleme `allowsModuleSideInsert` ile menü ve catalog flush’ta zorlanır.
6. BOM: recipe `moduleRecipes.js`; leaf `itemBom.js`. Debug tüketici `rawBomDebug.js` yalnız `DEV`+`?rawBom`. Proje toplamı `resolveProjectBom`; eklem `relationshipBom.js` (F-030 / F-031 kodu var, defter OPEN, baza ve short-up yok).
7. Özellik: `automatic-depot` + `automatic-wall`. Depo `contentCatalogKeys` dört ticari Item.
8. Kalıcılık: snapshot `version: 1`. IndexedDB `fair-stand-configurator` v2; `openDb` sahibi `configuratorDb.js`.
9. Kapı: `npm run contract:verify` + `ci.yml` (Version2 push/PR: gate → test → build → e2e). `package.json` lint/`npm audit` yok. Change-contract bu set: `visible-ui-b-with-ledger-a`.
10. E2E: Playwright spec + CI. “E2E yok” yanlış. ZIP ve GLB-fail spec yok.
11. `scripts/install-server.sh` repoda: `git pull` + build, SHA pin yok (F-042, düşük öncelik, senin sunucu script’in).

---

## 4. F-serisi (ledger vs kod)

Ledger `FINDINGS.md`: 49 bulgu, “açık 29 / kapalı 20”. Aşağıdaki hüküm lokal koda göredir.

### Kapalı — kodda duruyor

F-001 … F-013, F-016, F-020, F-023, F-027, F-028, F-033.

F-010: merkezi factory + `e2e/f010-module-construction.spec.mjs`. Sırt Duvar kaydı panellerle birlikte `led_floodlight` taşır. Kapanış MD’deki 45 katalog / `catalogKey` cümlesi tarihî dipnottur.

F-013: separatör `itemKey` + `modelFile`. Runtime `catalogKey` yok.

### Ledger OPEN — iddia yanlış (defter düzelt)

| ID | Gerçek |
|---|---|
| F-000 FIRST | `ITEM_CONTRACT.md` + `AGENTS.md` + giriş testleri var. İlk iş değil. |
| F-019 | Ölçü `items.js`; fabrikalar `getItem`. Şerit `7` kopyası F-018. |
| F-040 “E2E yok” | 25 spec + CI. Kritik boşluk (ZIP, GLB fail) ayrı. |
| F-047 kısmen | Foam’un explicit contract’ı var. “Yeni katalog-dışı nesne kapısız eklenemez” kuralı yok. |

F-041 / F-044: GitHub ayarı / uzak dal. Bu raporda yok.

### Ledger OPEN — gerçek iş

Ürün kararı: F-014 (18 katalog + foam `decision-required`), F-048 (evrensel BOM kapısı yok). F-043 kapandı: kök `LICENSE` proprietary / all rights reserved. F-034 `ACCEPTED_RISK` — `audit/remediation/A13_F034_CLOSURE.md`; 9 GLB atıfsız kalır.

Kod/UI: F-018, F-021, F-035, F-042, F-046. F-015, F-017, F-022, F-024, F-025, F-026, F-029, F-032, F-036/037, F-038, F-039, F-045 kapandı. F-030 / F-031 kodu üretim listesinde; ikisi OPEN (baza ve short-up dışarıda, kapanış kaydı yok).

### Ledger’de numarasız sapmalar

- Seçim hint çift kaynak.
- `ITEM_LIST.md` birçok bileşik Item’ı “Tamam” demiyor; definition + recipe test var.
- Foam ölçü dialog `main.js` inline, max yükseklik 350 sabit.
- Kanonik zemin MD `floorType`.

---

## 5. Belge sapması (kodla uyumsuz)

Güncel: `ITEM_CONTRACT.md`, `AGENTS.md`, `SYSTEM_CHANGE_GATE.md`, `SYSTEM_MODULE_CATALOG.md`, `src/*`. `definitions/` ticari dörtlü ve duvar kartları güncel; **zemin kartları sapıyor.**

| Belge | Sapma |
|---|---|
| `FINDINGS.md` | F-000 FIRST; F-019/F-040; şişik “29 açık”. |
| `FULL_SWEEP_STATE.md` | Kapalı 13; F-014 = 17; A04; F-000/047/048 yok. |
| `SYSTEM_AUDIT_CHECKLIST.md` | IN_PROGRESS, A03.01. **En tehlikeli ikinci kopya.** |
| `audit/evidence/A24` | 46 açık; “E2E yok”; düzeltme sırası F-010. Tarihî SHA mühürle. |
| `A04` / `A07` / `A08` / `A12` / `A19` | 45 katalog, `catalogKey`, 17 decision-required, E2E yok. |
| `current-system` (94) | 53 şerit / 41 yok; gövde `catalogKey` / `DEPOT_*`. Başlık “Mevcut Sistem Profili”. |
| `definitions/{karolaj,hali,parke-*}` | Persist `currentStand.floorType`. Kod: `itemKey`. |
| `door_100_full_system_audit.md`, baza handoff | `catalogKey`. |
| `A04_F013` kapanış | 45 katalog; `catalogKey` zorunlu. `A03_F010` güncel kimliği `itemKey` ve otomatik `led_floodlight` olarak yazar. |
| `RELEASE_HARDENING_ROADMAP.md` | #1 seçim hint ve #2 debug BOM hâlâ doğru açık. “E2E yok” / `indoor_plants2.glb` yanlış (`indoor_plants2` ağaçta yok). |
| `Changelog.md` | Ağustos 2026’da durur. |
| `FRESH_REPOSITORY_REVIEW.md` | Historical banner; gövde “şu anda”; `FINDINGS`’e yönlendirir. |
| `ITEM_LIST.md` | Migration durumu geride. |
| `change-contract.json` | Son işin sözleşmesi diskte kalmış. |

`PRODUCT_FUTURE.md` / `LEGACY_TRASH.md` kasıtlı gelecek. `ROADMAP.md` “proje Final BOM yok” doğru.

---

## 6. Yazılmış “eksik”, kodda bitmiş

F-000 Item sözleşmesi; F-010 factory; F-011 davranış merkezi; F-012 `SCENE_SURROUND_M = 1`; F-013 `itemKey`; F-019 genel ölçü; F-020/023/027/028; F-033 atıl `indoor_plants2`; F-040 E2E yok iddiası; ticari dörtlü self BOM; foam contract; current-system ticari şeridi (şerit var, gövde eski).

---

## 7. Toparlama sırası

### A — Belge (önce, onayınla, kod yok)

1. `FINDINGS` + `FULL_SWEEP` + A24 mühür/eşitle (F-041/F-044’ü ürün işi sanma).
2. Checklist: “kullanma, ikinci kopya” veya hizala.
3. `current-system`: 41 şeritsiz dosyaya tarihî şerit; başlık “mevcut sistem” olmasın; gövde `catalogKey` tarihî örnek.
4. Zemin `definitions/` persist = `stand.itemKey`.
5. Hardening: #1/#2 B ile kapandı.
6. `A03_F010` 45/`catalogKey` dipnotu yazıldı. `A04_F013` kapanışı duruyor.
7. `ITEM_LIST` + `Changelog` + baza handoff.

### B — Kullanıcıya görünen kod

**Uygulandı:** F-025, F-015, seçim hint, F-026, F-024, F-039. F-040 ZIP/GLB-fail e2e açık.

### C — Veri / hijyen

**Uygulandı:** F-036, F-037 (yol/tip; MB uydurulmadı), F-038, F-043 (`LICENSE`). SHA pin **geri alındı** (F-042 açık). F-034 envanteri durur; durum `ACCEPTED_RISK`. **Açık karar:** F-046 ESLint/format.

### D — Mimari borç

**Uygulandı:** F-017 (renderer kopya; kalıcı yazı `designState` bağında); F-022 aile gidiş-dönüş testi; F-029 `automatic-wall` + depo dört Item; F-032 IndexedDB `configuratorDb.js`. Kalan: F-018, F-021/035, F-045.

### E — Item / BOM (ürün kararı, uydurma yok)

F-014 / F-048 açık: kalan Extra self mi; takımlar recipe mi set self mi. F-030 / F-031 kodu var (`resolveProjectBom`, `relationshipBom.js`); kapanış yok. Baza ve short-up eklem dışı.

---

## 8. Dokunulmayanlar

Extra katalog UI isimleri; type-aile `if` refactor; `moduleRecipes.js` miktarları; fiyat/CRM/`PRODUCT_FUTURE`; GitHub ruleset/dal; `main.js`/`scene3d.js` büyük refactor.

---

## 9. Sayaç

| | |
|---|---|
| Katalog | 51 |
| recipe / self / decision-required | 29 / 4 / 18 |
| Foam | 1, decision-required |
| Zemin Item | 5 |
| Factory type | 25 |
| E2E spec | 25 |
| current-system | 94 (53 şerit / 41 yok) |
| definitions | 97 |
| Attribution txt | 4 |
| LICENSE | proprietary / all rights reserved |

P0 yeni F yok. Acil: defter, debug BOM, yan ekleme, seçim hint, import, sessiz GLB.

---

## 10. Sonraki adım

**A uygulandı (bu change set).** Canlı okuma: bu dosya + `audit/FINDINGS.md`.  
Sonra onayınla **B** (görünen UI) veya **E** (BOM kararı). Checklist/A03.01’e gidilmez.
