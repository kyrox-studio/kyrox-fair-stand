# Fair Stand

Fair Stand, gerçek Maxima fuar standı modüllerini temel alan **kural tabanlı 3D stand konfigüratörüdür**.

Amaç serbest çizim yapmak değil; katalogda tanımlı gerçek modülleri, placement/collision kurallarını ve üretim reçetelerini kullanarak geçerli stand tasarımları oluşturmaktır.

## Güncel durum

Repository ilk MVP taslağının ötesindedir. Mevcut uygulama aşağıdaki ana yetenekleri içerir:

- Gerçek zamanlı Three.js 3D stand sahnesi.
- Ortak placement, snap, connection ve collision altyapısı.
- Module type'a göre merkezi behavior registry.
- Dikme ve profil katalogda tek kartla gelir; bırakırken boy sorulur (ortak pencere `src/itemSizeDialog.js`; `src/uprightHeight.js`, `src/profileLength.js`). Profil gerçek boy → sahne boyu: 41,5 → 50 … 289 → 300, 388 → 400, 487 → 500 (migration `0078_profile_lengths`). 346,5 cm'yi aşan profil/dikme Üretim Listesi'nde tek satır kalır, adın yanında parça bölünüşü yazar (`Dikme 495 cm (346,5 + 8 + 140,5)`; `fair_stand_item_length_parts`, migration `0080_item_length_parts`).
- Kısa panel katalogda Tek Sıra / Çift Sıra için birer kartla gelir ("Panel Tek Sıra 100", "Panel Çift Sıra 100"); ad sahnedeki öğenin ölçüsünü yazar: "Panel Tek Sıra 200", "Profil 388", "Dikme 346,5"; bırakırken genişlik (50 / 100 / 150 / 200) konum hesabından önce sorulur (`src/wallShortWidth.js`, migration `0079_wall_short_cards`).
- Otomatik duvar, depo ve alınlık yerleşim yardımcıları (alınlık: açık kenarlara tek/çift sıra wall-short + açık köşelere dikme; destekler arası en çok 500 cm, ara dikmeler eşit aralıklı, dolgu parçaları ortaya doğru — `src/autoFascia.js`). Uç uca kısa panellerin (Tek ve Çift Sıra) üst/alt profili BOM'da taşıyıcıdan taşıyıcıya (dikme ya da tam boy duvar ucu) tek profil olur; tam boy yoksa en uzun uygun profil + kalan parça (400 → `profile_388`, 450 → `profile_388` + `profile_41_5`); kısa panelin bağlantı çizgisine konan, paneli kapsayan profil o raydaki panel profilini düşürür — `src/relationshipBom.js`.
- Panel, separatör, vitrin, raf, depo kapısı, panel bazalı duvar, banko ve baza modülleri.
- Mobilya, depo ekipmanı, bitki/saksı, TV/video-wall ve LED projektör katalog öğeleri.
- Renk, görsel ve editable surface state altyapısı.
- Öğe kilidi: kilitli öğe taşınmaz, döndürülmez, silinmez ve zincir kaydırmasıyla oynamaz. Çift tıkla modülü seçip Ctrl/Cmd+tık ile toplu seçerek toplu kilitleme yapılır (`src/moduleLock.js`).
- Geri al / İleri al (Ctrl+Z / Ctrl+Y, üst bant düğmeleri): tasarımın son 50 adımı; kaydedilmez (`src/designHistory.js`).
- Gruplar: çift tık + Ctrl/Cmd+tık seçimi → sağ tık → Grup oluştur. Öğeden bağımsız; her üyede `group: { id, name, locked, fromWallId? }`. Grup her yöne taşınır ve çoğaltılır, tek kısıt stand alanı; kenara bağlı duvar parçaları gruplanınca serbest öğeye çevrilir. Grup kilidi bütün üyeleri kilitler. Gruptaki öğede Shift+R bütün grubu üye merkezlerinin ortası etrafında 45° döndürür (tek kısıt stand alanı).
- Kurumsal grup şablonu: Gruplar kartı → Şablon olarak kaydet; Şablonlarım kartı → Yerleştir / Adlandır / Sil. Şablon Item değildir; parçaların itemKey, ölçü, göreli konum, açı, renk, cam panel ve metal separatör atamasını tutar; lightbox/mesh kumaş ve görselleri tutmaz (`src/groupTemplates.js`, `src/groupTemplateRemote.js`, `src/groupTemplatePanel.js`). Sunucu: `fair_stand_group_templates` (migration `0067`), API `/api/v1/fair-stand/group-templates`, organizasyon kapsamlı, proje yetkileriyle. Kenar çubuğunda Gruplar kartı (`src/moduleGroups.js`, `src/moduleGroupPanel.js`).
- Otomatik kayıt süresi (Proje kartı → Otomatik kayıt): Kapalı / 3 / 5 / 7 / 10 dk, varsayılan 3 dk; seçim tarayıcıda (`localStorage` `fairStand.autosaveMinutes`) tutulur (`src/autosaveSettings.js`). Kaydedilmemiş değişiklik sekme gizlenince veya editörden çıkılınca kaydedilir; sayfa kapatılırken tarayıcı uyarır.
- Eksik görsel: proje açılırken indirilemeyen görsel (sunucuda dosya yok) açılışı engellemez. Yüzey kendi rengiyle çizilir, durum satırı eksik sayıyı yazar; `imageAssetId` bağlantısı projede korunur (`src/projectRemote.js` `cacheProjectAndAssets`, `src/scene3d.js` `applyStoredImage`).
- İçe aktarma müşteri ister: paket ve açık editör müşterisizse sunucu hatası yerine yol gösteren mesaj çıkar.
- Recipe / production-parts tabanlı BOM ve üretim verisi altyapısı.
- Proje ve asset yönetimi için ayrı state/storage katmanları.
- Module/feature contract altyapısı, universal system change gate ve full-system impact sweep.
- Node regression test paketi ve Playwright tabanlı gerçek-browser E2E katmanı.
- Canonical GitHub Actions CI.

> Modül bazlı kesin placement, snap, rotation, collision, production ölçüsü veya recipe adetleri README içinde tekrar tutulmaz. Bunların canonical kaynakları ilgili runtime/contract dosyalarıdır.

## Teknoloji

- JavaScript ES Modules
- Three.js
- Vite
- FastAPI catalog API (`:8002`) + PostgreSQL `fair_stand`
- Node.js built-in test runner (`node --test`)
- pytest (backend catalog API)
- Playwright + Chromium E2E
- JSZip
- GitHub Actions

## Kurulum

CI Node 22 kullanır.

```bash
npm ci
npm run dev
```

Vite geliştirme sunucusunun verdiği local adresi tarayıcıda açın.

## Komutlar

```bash
npm run dev              # local development server
npm run contract:verify  # schema + diff + full-system impact verification
npm test                 # unit/integration regression suite
cd backend && pytest     # catalog API tests (Fair Stand FastAPI)
npm run build            # production build
npm run e2e:deps         # pinned Playwright test runner'ı local node_modules'a kur
npm run e2e:install      # Chromium browser binary'sini kur
npm run e2e              # real-browser Playwright E2E suite
npm run preview          # built application preview
```

## Zorunlu değişiklik akışı

İnsan veya AI bir guarded değişiklikte şu katmanları izler:

1. `SYSTEM_CHANGE_GATE.md` — universal değişiklik kabul kapısı.
2. `SYSTEM_IMPACT_SWEEP.md` — değişen dosya/symbol/UI/asset yüzeyinden callers, transitive dependents, mevcut testler, docs/contracts ve audit finding adaylarının tam taraması.
3. `.github/change-contract.json` — impact ve review kararlarının machine-readable deklarasyonu.
4. `SYSTEM_DEVELOPMENT_CONTRACT.md` — module / feature / core değişikliğinin domain contract'ları.
5. İlgili canonical owner dosyaları güncellenir.
6. Değişen davranış için targeted regression eklenir/güncellenir.
7. `SYSTEM_BROWSER_E2E_DOMAINS` registry'sindeki bir browser-impact domain etkileniyorsa değişikliğe özel targeted E2E yazılır.
8. Full test + build + Playwright E2E çalıştırılır.
9. PR canonical CI'dan tamamen yeşil geçmeden merge edilmez.

Impact domain sayısı sabit değildir. `.github/change-contract.json`, `src/systemChangeContract.js` içindeki `SYSTEM_IMPACT_DOMAINS` registry'sinde o anda tanımlı **bütün domainler** için karar taşır. Browser E2E zorunluluğu da `SYSTEM_BROWSER_E2E_DOMAINS` registry'sinden hesaplanır.

Canonical CI şu sırayı çalıştırır:

```text
checkout (full git history)
→ npm run contract:verify
→ npm ci
→ npm test
→ python -m pytest (backend/)
→ npm run build
→ Playwright runner kurulumu
→ Chromium kurulumu
→ npm run e2e
```

E2E failure olduğunda Playwright trace/screenshot/video kanıtları GitHub Actions artifact olarak saklanır. Böylece browser akışındaki gerçek hata CI logu ve görsel kanıt üzerinden incelenebilir.

`npm run contract:verify` local ortamda da committed/staged/unstaged/untracked farkları fail-closed biçimde denetler. Gerekirse base açıkça `CHANGE_GATE_BASE=<git-ref>` ile verilebilir.

## Temel mimari

Sistem, tek bir dosyanın bütün ürün kurallarını taşıması yerine sorumlulukları ayırır.

### Catalog

`src/catalog.js`

Kullanıcıya sunulan katalog kimlikleri, nominal ölçüler ve catalog metadata burada tutulur. Nominal katalog/placement ölçüsü ile gerçek üretim kesim ölçüsü aynı kavram değildir.

### Module contract

`src/moduleContracts.js`

Her katalog anahtarının profile, state/appearance/renderer/runtime/composition ve BOM policy sözleşmesini açıklar. Katalog dışı explicit runtime modülleri de burada ayrı registry üzerinden contract taşır.

### Feature contract

`src/featureContracts.js`

Birden fazla modülü/domaini koordine eden scene-composition özelliklerinin contract sahibidir.

### Module behavior

`src/moduleBehavior.js`

Module type'a göre değişen editor davranışlarının canonical kaynağıdır:

- placement mode,
- move snap,
- side insertion,
- collision strategy,
- ghost strategy.

Sahne Z dönüş adımı / varsayılan / yan ek Item kolonlarıdır: `docs/refactor/ROTATION.md`. `TYPE_BEHAVIORS` rotation taşımaz. Getter'lar `src/moduleBehavior.js` içindedir.

Katalogdaki her mevcut runtime type explicit behavior coverage taşımak zorundadır.

### Placement / connection

Placement core stand sınırı, snap, bağlantı geometrisi, collision ve reflow gibi geometrik kuralları doğrular. Behavior registry hangi stratejinin kullanılacağını seçebilir; gerçek geometrik hesap placement katmanında kalır.

### State

State construction'ın canonical sahibi `src/designState.js` ve ilgili state factory/registry yapısıdır. Runtime-derived veya renderer-only değerler gereksiz yere persisted state'e dönüştürülmemelidir.

### Renderer

`src/scene3d.js` Three.js sahnesini ve module rendering akışını yönetir. Placement veya üretim kuralı renderer'ın tek sorumluluğu haline getirilmemelidir.

Işık: editörde ortam (hemisphere) ve tepeden ana ışık (directional) yanar, gölge kapalıdır. Projektör ve raf altı spotları `RENDER_ONLY_LIGHT_LAYER` katmanındadır; yalnız **Render Al** (`captureCurrentViewPng`) çizerken açılır. Stand tepe spotu (`STAND_TOP_SPOT`, gölge atmaz) kendi `STAGE_LIGHT_LAYER` katmanındadır ve stand ölçüsüne göre zemine ışık havuzu düşürür. `applyStageLighting` bu katmanı açar ve ortam ışığını ters çevirir (`STAGE_HEMISPHERE`: gök rengi koyu, yer rengi açık; zemin ve hol karanlık, alınlık gibi dikey yüzler aydınlık). Editörde sahne ışığı açıkken ana ışık kapalıdır, ışık sayısı kapalı editörle aynı kalır (yavaş cihazda dokunma gecikmesin); Render Al'da ana ışık gölge için `RENDER_KEY_LIGHT_DIM` oranında yanar. Render Al çizerken her zaman, editörde varsayılan açıktır ve üst banttaki **Sahne Işığı** düğmesiyle (`setStageLightPreview`) kapatılabilir. Önizleme oturumluktur, projeye kaydedilmez; Render Al bitince önizlemenin son durumuna dönülür.

Alınlık gövdesi: otomatik alınlık panellerinin (`autoFascia`) arka yüz paneli yoktur; içeriden görünen gövde `FASCIA_BACK_COLOR` açık renkle çizilir (diğer panellerde `PANEL_BACK_COLOR`). Yalnız görünümdür; BOM ve arka yüz paneli değişmez.

Kamera derinliği: perspektif kameranın `near` değeri bakılan noktaya uzaklığın %1'idir (`PERSPECTIVE_NEAR`, 0.05–1 m; `syncPerspectiveNear`). Sabit 0.05 m'de büyük standlarda uzak panellerin yüzü ile gövdesi arasındaki 3 mm boşluk titriyordu (z-fighting); yakın çekimde near 0.05 m kalır.

### Production / BOM

- PostgreSQL `fair_stand` — Item master ve Item `composition` (reçete/part miktarı) verisi; Fair Stand API (`:8002`) üzerinden bootstrap edilir.
- `src/items.js` — bootstrap edilen runtime Item registry'si: leaf/production metadata, commercial, wall-media ve composite parents. Statik master değildir.
- `src/moduleRecipes.js` — `composition` satırlarını `itemKey` üzerinden açan resolver.
- `src/moduleContracts.js` — modülün BOM policy'si.

Roadmap veya README bu verilerin ikinci sabit kopyası değildir.

### Persistence / storage

Project state ve asset blob storage ayrı katmanlarda tutulur. Project switch/save/load/import-export gibi cross-domain akışlar ilgili persistence/storage contract ve regression testleriyle korunur.

## Koordinat standardı

- X/Y: zemin düzlemi
- Z: yükseklik
- Plan dönüşü: Z ekseni etrafında

Dönüş adımı ve movement snap global sabit değildir. Modül davranışı `src/moduleBehavior.js` üzerinden okunmalıdır.

## Yeni modül / feature eklerken

Yeni iş yalnız katalog satırı veya UI butonu eklemek değildir.

Önce universal change declaration hazırlanır:

1. `SYSTEM_CHANGE_GATE.md` ve `SYSTEM_IMPACT_SWEEP.md` okunur.
2. `SYSTEM_IMPACT_DOMAINS` registry'sindeki bütün domainler için `affected` / `not-applicable` kararı verilir.
3. Reverse dependency/test/doc/finding discovery çalıştırılır ve `.github/change-contract.json` içinde acknowledgement yapılır.
4. Browser-impact domain varsa `tests.e2e.required=true` ve değişikliğe özel targeted `e2e/**` spec beyan edilir.
5. Sonra `SYSTEM_DEVELOPMENT_CONTRACT.md` içindeki module/feature/core contract akışı uygulanır.

Bir katalog modülü için en az şu alanlar kontrol edilir:

- catalog identity / descriptor,
- module contract/profile,
- state construction,
- explicit behavior,
- placement/collision etkisi,
- renderer/routing,
- persistence,
- BOM policy / recipe,
- composition/dependency,
- affected existing tests,
- targeted regression,
- targeted E2E browser akışı.

Bir feature birden fazla modülü/domaini koordine ediyorsa `src/featureContracts.js` contract'ı ayrıca kontrol edilir.

## Repository belgeleri

### Açık iş — tek kaynak (oturum buradan başlar)

Dağınık not / bayat sayaç karışıklığını önlemek için:

1. **Özet harita** — `kyrox-platform/projects/fair-stand/OPEN_WORK_INVENTORY.md` (iş kuyruğu değil; harita)
2. **Açık audit bulguları** — `audit/FINDINGS.md` (F-* aç/kapa yalnız burada)
3. **Ertelenmiş kararlar** — `docs/refactor/PENDING_ITEM_DECISIONS.md`

**Bakma (tarihî / ikinci kopya):** `SYSTEM_AUDIT_CHECKLIST.md`, `audit/FULL_SWEEP_STATE.md`, eski `audit/evidence/*` OPEN satırları. Bunlardaki OPEN/IN_PROGRESS sayaçları güncel backlog değildir.

### Canonical bugün

- `PROJECT_RULES.md` — global product invariant'ları.
- `ARCHITECTURE_RULES.md` — sistem katmanları ve source-of-truth sınırları.
- `SYSTEM_CHANGE_GATE.md` — universal system-change kabul sözleşmesi.
- `SYSTEM_IMPACT_SWEEP.md` — reverse dependency/test/doc/finding + browser-impact tarama sözleşmesi.
- `SYSTEM_DEVELOPMENT_CONTRACT.md` — module/feature/core geliştirme sözleşmesi.
- `MODULE_BEHAVIOR_STANDARD.md` — module behavior registry sözleşmesi.
- `SYSTEM_MODULE_CATALOG.md` — runtime catalog/contracts ile test edilen okunabilir katalog indeksi; runtime source-of-truth değildir.
- `audit/FINDINGS.md` — açık/kapalı audit bulgu defteri (kanonik).
- `docs/refactor/PENDING_ITEM_DECISIONS.md` — ertelenmiş Item/zarf kararları (kanonik).
- `SYSTEM_AUDIT_CHECKLIST.md` — A00–A24 tarihî metodoloji şablonu; açık iş takipçisi değil.
- `audit/FULL_SWEEP_STATE.md` — A00–A24 tarihî mühür; açık iş takipçisi değil.

### Plan / gelecek

- `ROADMAP.md` — aktif üst seviye ürün/teknik plan.
- `ROADMAP_PHASE_4.md` — FAZ 4 ayrıntılı planı.
- FAZ 5–6 ayrıntılı planı, gelecek ürün gereksinimleri ve render backlog'u `kyrox-platform` deposundadır: `projects/fair-stand/ROADMAP_PHASE_5_6.md`, `PRODUCT_FUTURE.md`, `RENDER_FUTURE_BACKLOG.md`.
- Sahne editörü planı (kilit, geri al, grup, çok duvarlı grup, kurumsal şablon) de `kyrox-platform` deposundadır: `projects/fair-stand/GROUP_LOCK_ROADMAP.md`. Faz 1 (kilit) ve Faz 2 (geri al / ileri al) uygulandı.

### Historical / legacy

- Tarihsel kayıtlar (`MILESTONES.md`, Ağustos 2026 changelog'u, `LEGACY_TRASH.md`, BASE migration handoff) `kyrox-platform` deposunda `archive/fair-stand/` altındadır.
- `FRESH_REPOSITORY_REVIEW.md` — explicit historical repository-review snapshot.
- `REPOSITORY_CLEANUP_PROGRESS.md` — explicit historical cleanup-progress snapshot.

Historical dosyalardaki “mevcut / sıradaki iş” ifadeleri current Version2 truth'u olarak kullanılmaz.

## Geliştirme politikası

Standart akış:

```text
fresh main
→ branch
→ SYSTEM_CHANGE_GATE domain declaration
→ SYSTEM_IMPACT_SWEEP dependency/test/finding discovery
→ module/feature/core contract kararı
→ implementation
→ impact sweep tekrar
→ targeted regression
→ browser-impact ise targeted E2E
→ npm test
→ npm run build
→ npm run e2e
→ PR
→ canonical CI
→ merge (yalnız PR CI yeşilken; main'de tekrar koşu yok)
```

Core placement, behavior, catalog, persistence, renderer, BOM veya başka bir domain değişiyorsa ilgili regression aynı PR içinde eklenmeli/güncellenmelidir. Browser-visible etkisi olan değişiklik kendi Playwright E2E akışını da aynı PR içinde taşır.

## Product invariant'ları

Kısa özet:

- Kullanıcı açıkça istemedikçe silinen modülün oluşturduğu boşluk otomatik kapatılmaz.
- Auto-compaction varsayılan davranış değildir.
- `wallId` placement metadata'sıdır; ayrı ürün sınıfı değildir.
- Nominal placement ölçüsü, fiziksel footprint ve production/BOM ölçüsü birbirinden farklı olabilir.
- Module-specific davranışlar global varsayımlara göre değil behavior registry üzerinden belirlenir.

Ayrıntılı canonical kurallar için `PROJECT_RULES.md`, `ARCHITECTURE_RULES.md`, `SYSTEM_CHANGE_GATE.md`, `SYSTEM_IMPACT_SWEEP.md`, `SYSTEM_DEVELOPMENT_CONTRACT.md` ve `MODULE_BEHAVIOR_STANDARD.md` dosyalarına bakın.
