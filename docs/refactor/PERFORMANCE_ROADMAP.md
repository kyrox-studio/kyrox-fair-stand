# Fair Stand — performans + ürün yol haritası

**Durum:** Aktif plan (kod bu belgede backlog; uygulama ayrı PR).  
**Kaynak:** Prod gözlem (2026-09-24) + kod + rakip tarayıcı analizi (2026-10-18).  
**Hedef ölçek:** Eşzamanlı ~100 aktif stand tasarımı.

**İzlenen rakipler (canlı app):**

| Ürün | Firma / ekosistem | App URL |
|---|---|---|
| Booth Designer | Exphora | https://boothdesign.app/app/ |
| Stand Builder | AetherEx | https://www.standbuilder.app/app |

Detaylı stack / ürün / performans analizi → **§ 7 (belge sonu)**.

İlgili: [`audit/evidence/A17_PERFORMANCE_BUNDLE_RENDER_LIFECYCLE.md`](../../audit/evidence/A17_PERFORMANCE_BUNDLE_RENDER_LIFECYCLE.md), `PENDING_ITEM_DECISIONS.md` B.3b.

---

## 0. Teşhis (rakip vs biz)

Rakip hızlı çünkü **transform in-place** + **düşük kalite varsayılanı** + daha az üretim state’i.  
Biz hantal çünkü birçok UI aksiyonunda `disposeWall` + tam `buildWall`. Stack aynı aile (Three.js) — sorun güncelleme yolu.

| Konu | BoothDesign | StandBuilder | Kyrox | Alınacak |
|---|---|---|---|---|
| Sahne update | Taşı = mesh UUID reuse | R3F demand render | Sık full rebuild | Incremental (P3) |
| Kalite | Varsayılan FAST | Hafif satış sahnesi | PCF 2048 | `low` / `balanced` / `high` (P1) |
| Ürün | Modüler sistem + BOM + quote | Planlama + fiyat | Üretim konfigüratörü | Derinliği koru; hız katmanı |

**Bilinçli erteleme:** R3F rewrite yok. Unity yok. Dimension gizmo P3 sonrası.

---

## 1. Gözlemlenen belirtiler

| Belirti | Şiddet | Not |
|---|---|---|
| Kayıtlı projeyi sahneye açma | **5–10 sn** | En acil UX (P0) |
| Sahneyi döndürme (orbit) | Takılma | Gölge + render throttle (P1) |
| Modül sürükleme | Ara sıra spike | Snap + rebuild çakışması (P2) |
| Nedensiz donma | Bazen | Arka plan `rebuildWall` / texture |

---

## 2. Kök nedenler (özet)

1. **Proje açma:** sıralı asset HTTP + tam `buildWall`.  
2. **Orbit:** `shadowMap` 2048 + çok mesh cast/receive.  
3. **UI:** `main.js` → sık `rebuildWall()` (dispose + tüm fabrikalar).  
4. CRM iframe / bundle: ikincil.

### 2.1 Proje açma pipeline (detay)

Sıra: `openStoredProject` → `loadProject` → `restoreProject` → `loadAssetsForActiveProject` → `createStage` → **`rebuildWall` / `buildWall`**.

| Katman | Dosya / fonksiyon | Sorun |
|---|---|---|
| Remote proje + görseller | `projectRemote.js` → `cacheProjectAndAssets` | Her açılışta API; görseller sıralı HTTP |
| Görsel kayıt | `main.js` → `registerAsset` | Her asset için `createObjectURL` |
| Sahne rebuild | `scene3d.js` → `buildWall` | `disposeWall` + tüm modül fabrikası |
| Panel texture | `applyStoredImage` / `createFittedCanvas` | Ana thread |
| GLB | `loadGltfScene` / `loadItemModel` | İlk parse pahalı |

### 2.2 Orbit

| Ayar | Etki |
|---|---|
| PCF shadow, 2048 map | GPU maliyeti yüksek |
| Çok mesh cast/receiveShadow | Her frame shadow pass |
| Render cap ~50 fps aktif / ~4 fps idle | Orbit atlamalı hissedilebilir |

### 2.3 Sürükleme / rebuild

- `pointermove`: snap, ghost, duvar hattı.  
- Birçok UI aksiyonu → **`rebuildWall()`**; orbit/sürükle ile çakışınca donma.

---

## 3. Fazlar (sıra sert)

### P0 — Proje açma (hedef tipik &lt; 2–3 sn)

1. Asset cache: `updatedAt` + metadata aynıysa HTTP yok.  
2. Paralel indirme (concurrency 4–6).  
3. Aşamalı overlay.  
4. `performance.mark` (loadProject / cacheAssets / buildWall).

**Kod:** `projectRemote.js`, `main.js`. **Durum:** BACKLOG.

### P1 — Orbit / kalite profili

1. Profiller: `high` / `balanced` (shadow 1024) / `low` (gölge kapalı).  
2. Varsayılan **`balanced`**.  
3. Orbit sırasında `balanced`/`low` için gölge geçici kapalı.  
4. UI: sahne köşesinde Hızlı / Denge / Yüksek.

**Kod:** `visualQuality` + `scene3d.js`. **Durum:** BACKLOG.

### P2 — `rebuildWall` budama

1. Aynı frame’de debounce (rAF coalesce).  
2. Sonra: renk / glass kısmi update (tam build yok).  
3. Drag snap throttle.

**Kod:** `main.js` (+ sonra scene3d). **Durum:** BACKLOG.

### P3 — Incremental scene graph

Ekle / sil / taşı = tek modül grubu; `disposeWall` yalnız stand tipi / hard reset. Instancing, Draco.

**Durum:** BACKLOG (P2 partial sonrası).

### P4 — Ürün / veri (paralel)

| Madde | Not |
|---|---|
| B.3b Z clamp → tip davranışı (DB) | Lamba mount-bottom şimdilik kodda (PR #291) |
| PENDING §A adım 1 | scene_dimensions + yüzey/BOM |
| B.3 mount vs `default_z_cm` | Araştırma |
| CRM lazy Fair Stand route | Bundle; sahne takılmasını çözmez |

---

## 4. 4 haftalık iskelet

| Hafta | Odak | Başarı |
|---:|---|---|
| 1 | P0 asset cache + paralel | 20 görsel 2. açılış &lt; 1.5 sn |
| 2 | P1 kalite + orbit | balanced/low’da akıcı orbit |
| 3 | P2 partial renk/glass | Renkte `buildWall` yok |
| 4 | P2 genişletme veya P3 spike | rebuild çağrı sayısı ↓ |

---

## 5. Doğrulama kapısı

- [ ] Proje 0 görsel: açılış &lt; 1 sn  
- [ ] Proje 20 görsel: 2. açılış &lt; 1.5 sn; gereksiz asset GET yok  
- [ ] Kalite profili UI + unit test  
- [ ] `rebuildWall` aynı frame coalesce  
- [ ] Orbit: balanced’ta akıcı his  
- [ ] 30 modül: hâlâ full yol varsa `buildWall` &lt; 500 ms  

**Ölçek (ops, P4+):** 50 eşzamanlı bootstrap + 20 eşzamanlı proje açma p95 hedefe uyum; asset CDN / rate limit.

---

## 6. Güncelleme kuralı

Performans PR merge → ilgili P* **YAPILDI** + tarih; `REFACTOR.md` bir satır.

---

## 7. Rakip analizi (2026-10-18)

Tarayıcıda canlı app + bundle / runtime incelemesi. Tahmin yazılmaz; gözlemlenenler aşağıda.  
Yeniden doğrulama: URL’ler değişirse bu bölüm güncellenir.

### 7.1. Booth Designer — Exphora

- **URL:** https://boothdesign.app/app/  
- **Marka / sürüm ipucu:** “Booth Designer · Exphora”, UI’da `v17.10`.  
- **Ürün tipi:** Modüler fuar sistemi konfigüratörü (Aluvision, beMatrix, Octanorm, Maxima, Canopy…). Inline / Corner / Peninsula / Island; ölçü ft↔m; panel / kaplama / zemin / tavan / kapı / raf-TV / depo; kg özet; BOM; artwork / print list; quote; Operation sekmeleri.  
- **Katalog:** Exphora furniture API — Displays2go, IKEA, T-EXO, Amazon vb. GLB (`files.exphora.app`). Ürün ölçüsü gerçek SKU; düzenlenemez; fiyat/SKU paneli.  
- **Stack (gözlem):**
  - Vanilla JS (React/Vue fiber yok; `#app`)
  - Three.js **r169** CDN `importmap` (jsDelivr) + OrbitControls, GLTFLoader, DRACOLoader, **USDZExporter** (AR)
  - Uygulama çekirdeği: `/api/js/core.*.js` (token’lı; dışarıdan 403)
  - Backend/katalog: `exphora.com` REST; analytics GA + Facebook Pixel
  - TR kod izleri (hata/event alan adları, fonksiyon isimleri)
- **Performans gözlemi:**
  - Visual quality varsayılan **FAST** (gölge / AA kapalı; “High” seçilebilir)
  - Transform (pozisyon): mesh UUID **%100 reuse** — sahne yıkılmıyor
  - Booth tipi / sistem değişimi: kısmi yenileme (~60 ms sync tıklama; mesh sayısı değişir, bir kısmı reuse)
  - Ağır sahne mümkün (~3M+ üçgen, çok texture) ama FAST + incremental his
- **Çıktılar:** BOM / CSV, artwork list, quote, AR (QR), snapshot, turntable video, share link, PDF/print (Tools menüsü).
- **Bizim için ders:** Incremental graph + varsayılan düşük kalite; üretim derinliğini kopyalamadan hız katmanı.

### 7.2. Stand Builder — AetherEx

- **URL:** https://www.standbuilder.app/app  
- **Marka:** AetherEx / StandBuilder; pazarlama: planlama, anlık fiyat, şablon.  
- **Ürün tipi:** Satış / erken planlama aracı — booth boyutu, duvar, mobilya, storage, TV setleri, fiyat (€); üretim panel şeridi / ilişki BOM yok.  
- **Stack (gözlem):**
  - React SPA (`#root`, `createRoot`) + **Vite** hashed assets (`/assets/index-*.js`)
  - **Three.js r165** + **React Three Fiber** (`@react-three/fiber`; canvas’ta `gl` / `camera` props)
  - GLB modeller + Google Draco 1.5.5
  - i18next, Redux izi, leva, postprocessing, react-helmet
  - Backend: **Supabase** (`api.aetherex.app/rest/v1/...`)
  - Host: **Vercel** (`_vercel/insights`, speed-insights); Sentry; GA
- **Performans gözlemi:** Hazır GLB + hafif sahne + R3F demand render; full dispose/rebuild modeli yok. “Hızlı his” büyük ölçüde ürün kapsamından (satış sahnesi) gelir.
- **Bizim için ders:** R3F zorunlu değil (BoothDesign vanilla ile de hızlı). Kapsam sadeleştirmesi ≠ hedefimiz; biz üretim state’ini koruyup update yolunu düzeltiriz.

### 7.3. Üçlü özet

| | BoothDesign | StandBuilder | Kyrox Fair Stand |
|---|---|---|---|
| Odak | Modüler sistem + quote | Erken planlama + fiyat | Üretim konfigüratörü |
| 3D | Three vanilla CDN | Three + R3F + Vite | Three (scene3d monolit) |
| Update | In-place / kısmi | Demand render | Sık `rebuildWall` |
| Kalite varsayılan | FAST | Hafif sahne | Yüksek gölge (hedef: balanced) |
| BOM | Sistem + satır | Sepet / fiyat | Panel / ilişki / üretim |

**Sonuç (ürün kararı değil, hız stratejisi):** Rakibi kopyalamıyoruz. P0 asset cache, P1 kalite/orbit, P2 rebuild budama, P3 incremental — § 3 sırası geçerli.
