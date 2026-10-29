# Fair Stand — Item-first yol haritası (karar + checklist)

**Durum:** ürün kararı (2026-09-23). Uygulama izni için bu belge + ilgili konu belgesi gerekir.  
**Amaç:** Her yeni `wall_*` / SKU için kod yazmamak; leaf → registry → recipe → davranış kurallarını **DB/Item** üzerinden ilerletmek.

İlgili: `ITEMS.md`, `SCENE_POSE.md`, `DATABASE.md`, `PENDING_ITEM_DECISIONS.md`, `ROTATION.md`, `TYPE_BEHAVIORS_DB_ROADMAP.md`.

---

## Karar özeti

1. **Leaf önce.** `profile_*`, `panel_*`, `upright_*` WDH + renk + `item_type` + `is_render` ile Item olarak kaydolur (`item_key` lowercase).
2. **Registry.** Bunlar kanonik `Item{}` kümesidir; lookup yalnız `itemKey`.
3. **Parent = recipe BOM.** `wall_200` gibi item’lar `composition.mode = recipe` + `composition.items` (`{itemKey, quantity}`). Bu **BOM listesi**dir; çocuk pose/offset taşımaz.
4. **Davranış SKU’ya yazılmaz.** Snap tip/kurala yazılır:
   - Projetör: `requires: top-rail` ← tip `profile` kuralda seçiliyse **provides** (+ face/edge kuralda).
   - Raf: `requires: shelf-rail` ← tip `panel` / `separator-panel` → panel **ön yüz lokal üst** (`face: front`, `edge: top`). Wall AABB tavanı değil.
   - Item’daki Provides alanı **opsiyonel override**; boş kalır. Tip çentiği item satırına provides **yazmaz**.
   - Free leaf sahnedeyse aynı kural; wall’da child mesh yoksa hatlar recipe × leaf ölçüden **türetilir** (sanal snap hattı).
5. **Admin 3D preview ertelenir (P5).** Bugün admin “live” = CSS siluet (`preview_id`). Parametrik BoxGeometry / assembly preview istenen ama **veri modeli oturmadan** yapılmaz.

### Bilinçli sınırlar

- BOM’da child olması ≠ sahnede otomatik mesh. Snap için gerekirse **sanal mount hattı** yeterli; tam Lego assembly şart değil.
- Sahneye konmak için `is_render=true` **ve** bilinen `item_type` (factory/behavior) gerekir.
- Her behavior’ı bir anda DB’ye taşımak yoktu; **tip placement paketi** (eski `TYPE_BEHAVIORS`) 0030–0033 ile DB’de. Kalan iş: snap kalıntı / contract / preview (P2–P5).
- Admin preview ≠ prod `scene3d` birebir kopyası olmak zorunda değil.
- Tek kelime `top` / `side` yetmez: projetör üst rayı ile rafın ön-yüz üst dikişi **farklı kural** olmalı (`top-rail` vs `shelf-rail`).

---

## Hedef sözlük (P0)

| Terim | Anlam |
|---|---|
| Leaf | Ölçü/renk sahibi SKU (`profile_*`, `panel_*`, …) |
| Parent / recipe | Çocuk listesi + quantity; BOM kaynağı |
| Item tipi | `fair_stand_item_type.key` (`profile`, `panel`, `upright`, …). Eski “aile” tablosu yok (`0029`) |
| Kural / mount | `fair_stand_rule` (`top-rail`, `shelf-rail`, …) + face/edge |
| Tip → provides | Kuralda seçilen tip(ler) → o tipteki tüm item’lar host (`itemTypeKeys`) |
| Item provides | Opsiyonel override (dropdown); tip yolunu iptal etmez (OR) |
| `requires` | Sürülen item ne arar (tüketici; az sayıda) |
| `face` / `edge` | Kural satırında; item’da değil |
| Sanal snap hattı | Mesh olmadan recipe + leaf ölçüden üretilen mount çizgisi |

---

## Gap / çatışma (yol haritası × kod/DB)

Kaynak: 2026-09-23 tespit; **2026-09-24** kod gerçeğine göre yeniden hizalandı.

### Uyuşanlar / kapananlar (kodda böyle)

- Leaf registry, lowercase `item_key`, WDH/renk/type/`is_render`; Catalog triad + index 1..N (admin).
- Parent **recipe BOM** = `composition.items` + quantity (Item/DB). BOM child ≠ otomatik mesh.
- **Snap (projetör/raf):** tip + kural (`top-rail` / `shelf-rail` + face/edge); `wall_200` adına özel snap if’i yok. Item Provides = opsiyonel OR override.
- Rotation + `defaultZCm` büyük ölçüde Item kolonlarından.
- Admin “live” = CSS siluet (`preview_id`); Three.js P5 erteli.
- Legacy `snap_target_item_type` / `snap_anchor` okunmaz (null).
- Görsel yetenek / katalog: Item’da `accepts*`, `catalogVisible`, `previewId` (DB).

### Kod katmanları (karıştırma)

| Katman | Dosya / yer | Ne işe yarar | Yeni `wall_250` için |
|---|---|---|---|
| Item master | DB / `getItem` | Ölçü, BOM, `accepts*`, catalog, snap rule id | CRM/seed kaydı **yeter** (katalogdan `itemKey` ile) |
| Snap motor | `itemSnap.js` + kural tabloları | Host hattı tip/kuraldan | SKU satırı **gerekmez** |
| Genişlik→SKU (auto-wall) | `resolveAutomaticWallFlatPanelItemKey` ← Item registry | catalogVisible + isRender flat-panel, short-up hariç; width = `dimensions.widthCm`. Explicit `itemKey` map kullanmaz |
| Module contract | `moduleContracts.js` `MODULE_CONTRACT_ASSIGNMENTS` | Governance/test allowlist. Production planner/renderer import etmez; `accepts*` ile çakışır | § C.5 erit |
| Şerit clamp | `resolveFlatPanelStripCount` | `min(BOM qty, floor(H/pitch50))` sessiz kırpma | İstenmez; § B.7 / § A borcu |

### Kısmi / kalan

| Konu | Bugün (kod) | Kalan |
|---|---|---|
| Snap modeli | Tip/kural + rule id | — (placement/moveSnap/magnetic DB’de, C.3 kapandı) |
| Raf kalıntı | `usesPanelSeamOverlaySnap` ← kural | ~~`panel-seam` literal~~ → `requires: 'shelf-rail'` |
| Wall sanal hat | Recipe band / top-rail offset var | Yazılı host modeli + P2 tick + E2E |
| Contract allowlist | Her katalog `itemKey` JS satırı | § C.5: DB/Item yeter; assignment erit |
| Auto-wall width | Item registry lookup | `resolveAutomaticWallFlatPanelItemKey` (hardcoded map yok) |
| Strip / pitch | Sabit 50 + qty clamp | Leaf ölçü + BOM otorite (§ A / B.7) |
| Cycle | Self-parent CHECK | Admin A→B→A |

### Dünya kuralı (hâlâ geçerli)

1. **BOM satırı ≠ snap yüzeyi.** Host = tip provides / override / sanal hat — parent AABB top varsayılan olamaz.
2. **Tek snap otoritesi hedefi.** Raf seam kuraldan (`shelf-rail`); eski `panel-seam` literal süpürüldü.
3. **`top-rail` ≠ `shelf-rail`.** Face/edge zorunlu ayrım.
4. **Kod yazmadan yeni SKU.** Aynı `item_type` → Item kaydı. **Yeni `item_type`:** CRM tip satırı + seed + (gerekirse) factory/renderer; JS tip davranış map’i yok.
5. **Placement tamamı Item’da değil.** Snap dilimi taşındı; collision/magnetic vb. C.3.
6. **Contract ≠ runtime görsel.** Görsel/catalog DB’de; `MODULE_CONTRACT_*` test/governance — ürün otoritesi değil.

### Eksikler (P2 / P4)

- Contract allowlist eritme (§ C.5) + sanal hat yazılı kapanış + cycle admin
- `panel-seam` string süpürme; free leaf + wall E2E
- Strip clamp kaldırma (B.7 / § A) — şimdi kod yok

### Risk

| Pri | Risk | Not |
|---|---|---|
| P4 | Orta | Snap dilimi var; string kalıntı + E2E |
| P1 | Düşük | Catalog bitti; BOM soft-warning kararlı, kod yok |
| P2 | Orta | Contract eritme + wall host yazımı / cycle |
| P3 | Düşük | Rotate/defaultZ yakın |
| P5 | Erteli | Doğru |

**P0 zorunlu seçim:**  
**(KİLİTLENDİ 2026-09-23, uygulandı 2026-09-23/24).** `fair_stand_item_type` + rule_type + rule; item `item_type` → tip.key FK; requires|provides rule FK; kural ↔ tip M:N; motor **rule id**. Face/edge kuralda; CRM CRUD. Tip = provides; item Provides = opsiyonel override (OR). Aile tablosu yok (`0029`). Type→kural runtime map yok.

---

## Checklist (öncelik)

`[x]` uygulananları gösterir; açık maddeler yalnız `kyrox-platform/projects/fair-stand/ROADMAP.md` § 3'tedir.

### P0 — Sözleşme + şema

- [x] Leaf / parent / BOM ayrımı yazılı
- [x] Snap SKU’da değil tip/kuralda
- [x] Admin 3D P5’e alındı
- [x] Gap / çatışma notu (2026-09-23; güncelleme 2026-09-24)
- [x] Sözlük: `top-rail`, `shelf-rail` + face/edge
- [x] P0 seçim A kilitlendi + uygulandı
- [x] `SCENE_POSE.md` / PENDING B.9 / `DATABASE.md` hizası
- [x] DB: `0024`…`0029` (item_type, rule key, mount_mode drop, aile kaldır)
- [x] CRM: item type / rule type / rule CRUD; kuralda çoklu tip; item requires + opsiyonel provides
- [x] Motor: rule registry + tip-based provides + sanal hat ince ayarı (`itemSnap.js`)
- [x] Kural kaydı item Provides’a otomatik yazmaz

### P1 — Leaf Item tek kaynak

- [x] Create: `item_key` ad’dan slug (otomatik) + elle düzenlenebilir + unique / lowercase
- ~~Create’te WDH/renk/`is_render`~~ — gerek yok; edit’te master alan kalır
- [x] Catalog görünürlük: `catalogVisible=true` ⇒ category+index+preview zorunlu (API+CRM); false’ta alanlar silinmez
- [x] `catalogItemIndex`: kategoride unique + görünürlerde 1..N (API shift/compact + CRM 1..N+1)

### P2 — Parent = recipe only

Kod gerçeği: parent BOM + snap kuralı zaten Item/tip’te. P2 kalanı **yan katmanlar + kapanış**.

- [x] Parent BOM = `composition.items` + quantity (Item/DB); snap SKU-özel if değil (P0/P4 dilimi)
- [x] Otomatik duvar width→SKU: Item registry (`resolveAutomaticWallFlatPanelItemKey`); hardcoded `WALL_WIDTH_TO_ITEM_KEY` yok
- [x] `MODULE_CONTRACT_ASSIGNMENTS` erit / type’tan türet (`PENDING` § C.5)

### P3 — Rotate / defaultZ

Açık maddeler: `kyrox-platform/projects/fair-stand/ROADMAP.md` § 3.

### P4 — Snap capability (ince dilim devam)

- [x] Örnek 1 iskeleti: projetör ↔ `top-rail` / profile tip
- [x] Örnek 2 iskeleti: raf ↔ `shelf-rail` / panel tip + seam geometrisi
- [x] Seed: requires/provides + kural face/edge + tip linkleri
- [x] Runtime kalıntı: `panel-seam` string → `requires: 'shelf-rail'` (`scene3d`)

### P5 — Admin canlı preview (sonra)

- [x] Leaf: WDH + renk → BoxGeometry canlı (`itemAdminPreview.js` + CRM sekme `preview3d`)
- [x] Parent: basit assembly doğrulama (free child pose UI)
- [x] Kayıt: `fair_stand_item_assembly_parts` + `PUT .../assembly` + bootstrap `assembly.parts`
- [x] Prod: assembly varsa `scene3d` parts mesh; yoksa eski gömülü/şerit

Branch: `item_3d_preview`. BOM hâlâ `composition.items`; pose ayrı tabloda.
Doküman: `docs/refactor/ITEM_3D_PREVIEW.md` (yetenekler + sınırlar + kayıt modeli).
---

## Bu hafta

1. ~~P0 kilidi + şema/CRM/motor dilimi~~ (yapıldı)
2. P4 kalıntı süpürme + regresyon
3. P2: contract § C.5 + sanal hat kapanış / cycle (sıra ürün)
4. ~~P5 backlog’ta kalsın~~ → `item_3d_preview` branch’te uygulandı (CRM sekme + assembly API + prod mesh)

---

## Yapılmayacaklar (şimdi)

- Tip davranışını JS map’e geri almak (DB `fair_stand_item_type` otorite)
- Admin = full `scene3d` kopyası
- BOM çocuğunu otomatik sahne mesh’i sanmak
- `top-rail` ile `shelf-rail`’i tek `top` altında birleştirmek
- Tip çentiğinde item Provides’a otomatik yazmak
- Testleri “geçsin diye” esnetmek
- P0 kilidi olmadan P4 (artık kilit var)

---

## Günlük

| Tarih | Not |
|---|---|
| 2026-09-23 | Karar: item-first + capability snap + admin 3D P5. Gap: type-target vs capability, wall AABB, raf seam. |
| 2026-09-23 | P0 A kilit: item_type + rule M:N; aile kaldır (`0029`); CRM + motor rule id. |
| 2026-09-24 | Roadmap: tip=provides; P0 kapandı; P4 iskelet. |
| 2026-09-24 | P1: create’te WDH gerekmez; item_key slug otomatik+elle+unique. |
| 2026-09-24 | P1: `catalogVisible=true` ⇒ category+index+preview zorunlu (API+CRM); false’ta alanlar silinmez. |
| 2026-09-24 | P1: `catalogItemIndex` kategoride unique + 1..N (insert/shift + hide compact); CRM 1..N+1. |
| 2026-09-24 | Karar § B.7: BOM↔leaf soft-warning (auto-fix yok); sahne qty clamp istenmez — uygulama erteli. |
| 2026-09-24 | Gap/P2 koda hizalandı: width-map=auto-wall; contract=governance (§ C.5); snap+BOM zaten Item/tip. |
| 2026-09-24 | Auto-wall: `WALL_WIDTH_TO_ITEM_KEY` kaldırıldı → `resolveAutomaticWallFlatPanelItemKey` (DB/Item). |
| 2026-09-24 | Analiz: `TYPE_BEHAVIORS_DB_ROADMAP.md` (placement→item_type; Snap şablon). |
| 2026-09-24 | **Uygulandı:** tip davranışı DB 0030–0033 + overlap FK; kılavuz `FAIR_STAND_DB_KULLANIM_KILAVUZU.md`. |
| 2026-09-25 | P5: Admin 3D önizleme sekmesi + assembly pose tablo/API + prod assembly mesh (`item_3d_preview`). |
