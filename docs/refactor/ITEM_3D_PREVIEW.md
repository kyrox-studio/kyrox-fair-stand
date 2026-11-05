# Item 3D Önizleme (Admin)


Fair Stand **admin Item düzenleme** ekranındaki canlı 3D önizleme + recipe montaj layout kaydı.

Kodda: `src/itemAdminPreview.js`; CRM admin Item detayında `preview3d` sekmesi (`FairStandItemsAdminPage.tsx`).  
Roadmap dilimi: `ITEM_FIRST_ROADMAP.md` § P5.

Bu dosya **ne yaptık / sistem ne yapabilir / ne yapamaz** için yaşayan not. Audit değil.

---

## Amaç

- Leaf Item: `dimensions` W / D / H ve `defaultColor` ile **BoxGeometry** canlı kutu (admin önizleme scene override kullanmaz).
- Recipe parent: BOM’daki `isRender=true` child’ları **serbest pose** ile yerleştir; kaydet; prod sahne bootstrap sonrası aynı layout’u çiz.
- Admin **full `scene3d` kopyası değildir** — ince Three sahne (`itemAdminPreview.js`).
- `sceneDimensions` yalnız gerçek sahnede; 3D önizleme `dimensions` kullanır.

---

## Dosyalar

| Katman | Yol |
|---|---|
| Preview motor | `kyrox-fair-stand/src/itemAdminPreview.js` |
| Pose merge / normalize | `kyrox-fair-stand/src/itemAssembly.js` |
| Prod tüketim | `kyrox-fair-stand/src/scene3d.js` → `createItemAssemblyModule` (assembly varsa parts mesh) |
| Migration | `0038_item_assembly_parts`, `0039_assembly_rotation_xyz`, `0040_assembly_lock_group` |
| API | `PUT /api/v1/fair-stand/admin/item-records/{itemKey}/assembly` |
| Model / mapper | `FairStandItemAssemblyPartModel`, `item_mapper` → bootstrap `assembly.parts` (+ `lockGroupId`) |
| Lock motor | `kyrox-fair-stand/src/itemAdminAssemblyLock.js` (+ köşe snap `itemAdminCornerSnap.js`) |
| CRM UI | `kyrox-fair-crm/.../FairStandItem3dPreview.tsx`, Items admin sekme `preview3d` |
| Test | `kyrox-fair-stand/test/itemAssembly.test.js`, assembly lock unit testleri |

---

## Koordinat (SCENE_POSE)

Ürün: **X = W**, **Y = D (+öne)**, **Z = H (yerden yükseklik)**.  
Three Y-up: W→+X, H→+Y dünya, D→+Z dünya.

`zCm` = kutunun **tabanı** (yerden). Merkez Three’de `y = zCm/100 + heightM/2`.

Eksen legend (canvas sol alt) + W/D/H okları sabit sahne grubunda.

---

## UI akışı (CRM)

1. **Adım 1 — Kutu:** Envelope = item `dimensions` (W/D/H) + renk. `sceneDimensions` önizlemeye girmez.
2. **Adım 2 — Montaj:** Recipe + en az bir isRender child. Her child instance bir kutu.
3. **Seç:** tık → `itemKey · isim · #instance`.
4. **Taşı:** `G` (TranslateControls).
5. **Döndür:** `R` — **üç eksen, 360°** (serbest Euler).
6. **Açı yaz:** seçili parçada **W° / D° / H°** alanları (Enter/blur). Sürüklerken her frame React güncellemesi yok; bırakınca senkron.
7. **Genişlet / Küçült:** aynı sayfada full-viewport panel (Esc).
8. **Köşe snap:** turuncu AABB köşeleri; kaynak → hedef yapıştır (`C` / buton; rotasyon korunur) → **otomatik kilit** (çift veya gruba ekle).
9. **Gruptan çıkar / Kilidi aç:** N-parça rigid grup (`lock_group_id`); manuel Kilitle hâlâ var (yedek).
10. **Montajı kaydet:** pose **ve** `lock_group_id` listesini API’ye yazar (reload’da grup geri gelir).

Zemin: AABB tabanı `y < 0` olmaz (`clampMeshAboveGround`).

---

## Kayıt modeli

**BOM ayrı kalır** → `fair_stand_item_components` / `composition.items` (child + quantity).  
**Pose ayrı** → `fair_stand_item_assembly_parts`:

| Kolon | Anlam |
|---|---|
| `parent_item_key` | Recipe Item |
| `child_item_key` + `instance_index` | BOM instance kimliği |
| `x_cm`, `y_cm`, `z_cm` | Parent lokal cm |
| `rotation_x_deg` | Ürün W ekseni etrafı → Three `rotation.x` |
| `rotation_y_deg` | Ürün D ekseni etrafı → Three `rotation.z` |
| `rotation_z_deg` | Ürün H ekseni etrafı → Three `rotation.y` (eski tek açı alanı) |
| `lock_group_id` | Aynı id = birlikte kilitli grup (null = serbest). Admin snap kilidi kalıcı. |

GLB / mesh dosyası kaydedilmez; yalnızca sayılar. Mesh’ler runtime’da BoxGeometry (veya ileride child asset).

Bootstrap: parent Item JSON’da `assembly.parts[]`.  
Prod: `itemHasAssemblyLayout` → parts çiz; yoksa legacy gömülü/şerit yolu.  
Prod assembly fit: birleşim AABB → parent `sceneDimensions ?? dimensions` (eksen başına). Pivot = procedural baza ile aynı (W/D merkez, H taban 0). Eksik hedef = scale 1; hepsi boş = 1:1 (uydurma yok). Admin montajda parent hayalet kutu yok.

---

## Yetenekler (bugün)

- [x] Leaf envelope önizleme (WDH + renk)
- [x] Recipe assembly free pose (translate + full Euler)
- [x] Seçim etiketi (`itemKey` / isim)
- [x] Açı alanları W/D/H (yazılabilir + gizmo sonrası okuma)
- [x] Zemin altı engeli
- [x] Same-page expand viewport
- [x] Persist + bootstrap + prod assembly mesh
- [x] `isRender` filtresi (catalogVisible ile karıştırılmaz)
- [x] Admin AABB **köşe snap + yapıştır** (C / buton; 8 köşe; rotasyon korunur; absolute pose)
- [x] Admin **kalıcı kilit grubu** (N parça: Kilitle / Gruba ekle; `lock_group_id` ile Montajı kaydet; reload’da geri)
- [x] ViewCube + Persp/Ortho (ana editör `viewCube.js` / projection-control ile aynı)
- [x] Prod assembly **katalog entegrasyonu**: `assembly.parts` = yalnız pose/kilit. Çizim = canlı child (`isRender`/`isActive`, W/D/H, `defaultColor`, tip, accepts*). `isRender=false` → kayıtlı pose olsa bile görünmez. Profile/upright = `frameColorForModule`; panel = faces + child renk.

---

## Bilinçli sınırlar (yapılmaz / henüz yok)

- Admin ≠ prod `scene3d` (magnetic joint / wall reflow burada yok).
- Kilit **absolute pose + `lock_group_id`** ile kalıcıdır; ayrı “relative constraint / hedef takip” şeması yok (grup üyeleri absolute cm kaydeder).
- Assembly kutuları BoxGeometry — child GLB çizilmez (katalog proxy kutu).
- Panel `faces` sırası BOM instance sırasına map edilir (procedural face adları 1:1 zorunlu değil).
- Stand uygulaması CRM değişikliğini **bootstrap yenileme** sonrası alır (kayıtlı proje mesh’i canlı katalogla rebuild).

---

## isRender vs catalogVisible

| Bayrak | Anlam |
|---|---|
| `isRender` | Sahnede / montaj önizlemede çizilsin mi |
| `catalogVisible` | Katalog menüsünde görünsün mü |

Montaj Adım 2 yalnız `isRender=true` child instance’larını listeler.

---

## Manuel smoke

1. Recipe Item aç → sekme **3D Önizleme**.
2. Adım 1: kutu W/D/H okları + legend.
3. Adım 2: child kutular; tık → seçili satır; G/R; açı yaz; zeminin altına inme.
4. **Montajı kaydet** → DB `fair_stand_item_assembly_parts` (pose + `lock_group_id`).
5. Sayfayı yenile → kilit grupları geri gelmeli.
6. Prod bootstrap sonrası parent yerleştirilince parts layout’u görünür.

---

## Sonraki aday (karar bekler)

Relative constraint / hedef takip (üyeyi host’a bağlayan ayrı şema) — şu an gerek yok; absolute + `lock_group_id` yeterli.

---

## Günlük

| Tarih | Not |
|---|---|
| 2026-09-25 | P5 uygulandı: sekme, assembly tablo/API, prod mesh, WDH eksen, expand, seçim, full Euler + açı UI, zemin clamp. |
| 2026-09-25 | Bu doküman + Cursor plan mirror. |
| 2026-09-25 | Admin köşe snap MVP: `itemAdminCornerSnap.js` + C/buton iki tık yapıştır. |
| 2026-09-25 | Oturum kilidi: snap sonrası Kilitle; kilitli çift rigid-group (hangisi sürüklenirse); persist yok. |
| 2026-09-26 | Kalıcı kilit: `lock_group_id` (migration 0040) + Montajı kaydet; N-üye Gruba ekle / çıkar. |
| 2026-09-26 | Item **Kopyala** (shallow clone API) kılavuzda §4.1b; assembly `lock_group_id` kopyalanır. |
| 2026-09-26 | Prod `createItemAssemblyModule` katalog entegrasyonu: frameColorForModule + faces + canlı child ölçü/renk. |
| 2026-09-26 | Admin 3D önizleme yalnız `dimensions`; `sceneDimensions` gerçek sahnede kalır. |
| 2026-09-26 | Köşe snap sonrası varsayılan otomatik kilit (`lockPendingPair`). |
| 2026-09-26 | Prod assembly AABB → `sceneDimensions ?? dimensions` fit; admin hayalet kutu kaldırıldı. |
| 2026-09-26 | Assembly fit pivot: köşe → merkez (placement / baza ile aynı). |
