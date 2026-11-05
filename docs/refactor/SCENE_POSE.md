# Scene pose

Item gövdesi, sahne kotu, snap. Stand zarfı değildir (`STAND_DIMENSIONS.md`).
Rotation ayrı: `ROTATION.md`.
Kolon envanteri: `DATABASE.md`.

Üç kural ve uygulama sırasının 1–6. adımları kodda uygulandı (§ Uygulama sırası).

**Backlog / kaldırma sırası / ertelenen property’ler:** `PENDING_ITEM_DECISIONS.md` (canonical iş sırası § A).

---

## Üç kural

1. **Gövde** — item kaç cm: `dimensions` / `scene_dimensions`.
2. **Duruş** — sahnede nerede, özellikle Z (yerden kot). Sürükleince `placement` oluşur; Z’nin default’u item’dan gelir, stand tavanından değil.
3. **Snap** — sihirli kota değil. Kime yapışacağı **DB snap kuralından** (sürülen item’ın `snap_requires_rule_id` ↔ host `snap_provides_rule_id` / kural tipleri; § Snap). Kodda `profile` / `profile_190` sabiti yok.

Eksen (placement, Max/SketchUp): **X** genişlik, **Y** derinlik (0 = arka duvar, +Y öne), **Z** yerden yukarı.

Motor Three.js Y-up. `applyPlacementToGroup` cm→m ve `yCm`→dünya Z, `zCm`→dünya Y çevirir. Item/DB bu takası yazmaz.

---

## Resolver (bu kısım kodda doğru)

`resolveSceneDimensions`: aynı alan adı için `sceneDimensions ?? dimensions ?? null`.

- `length` → `width` yok
- `thickness` → `depth` yok
- `type` / `itemKey` / `STAND_DIMENSIONS` remap yok

`profile_190` sahne genişliği 200 çünkü DB `scene_dimensions.width_cm = 200`, kod 190’ı ezmiyor.

---

## Kalacak

| Kaynak | Alan | İş |
|---|---|---|
| `fair_stand_item_dimensions` | `width/depth/height/length/thickness` | Üretim gövdesi, BOM |
| `fair_stand_item_scene_dimensions` | `width/depth/height` | Sahne kutusu (slot). Null ise dimensions aynı ad |
| `fair_stand_items` | `rotationStepDeg` / `defaultRotationDeg` / `sideInsertRotation` | Shift+R, ilk yaw, yana ek |
| runtime `placement` | `xCm yCm zCm rotationZDeg` | Instance. Drop’ta oluşur |
| `fair_stand_dimensions` | height/depth/strips/frame | **Yalnız stand zarfı**: tavan, duvar kalınlığı, panel şerit ızgarası |

Item duruş alanları (kodda):

| Alan | İş |
|---|---|
| `default_z_cm` (`defaultZCm`) | Katalog drop’ta `placement.zCm` (`resolveItemDefaultZCm`). Profil ray kotu. Tavan 500 olsa da 450 durur |
| `snap_requires_rule_id` / `snap_provides_rule_id` | Snap eşleşmesi (§ Snap). `snapPlacementToItemAnchor` (`src/itemSnap.js`) |
| `snap_target_item_type` / `snap_anchor` | Eski kolonlar; DB'de durur, seed `null` yazar (`item_snap_seed.py`), motor okumaz |

X/Y default şart değil; pointer + duvar snap. Z default şart.

---

## STAND_DIMENSIONS — yalnız zarf

Tut:

- Stand tavanı / derinliği / şerit sayısı (düz panel 7×50)
- Ghost/çarpışma **fallback’i** yalnız item’da height yoksa

Kesildi (item duruşunu ezmez; kod):

| Kod | Eski | Bugün |
|---|---|---|
| `createProfileModule` | Ray `STAND_DIMENSIONS.height` tavanında | Ray yüksekliği item sahne ölçüsü, kot `placement.zCm` |
| `createUprightModule` | Mesh stand 10×350; hep `upright_346_5` | Item `scene_dimensions` (`requireModuleSceneBoxCm`) |
| `snapTopFixturePlacement` | `zCm = 350` | `placement.zCm` → `clampMountBottomZCm` |
| `getTopFixtureDragPoint` | 350 yatay düzlem | Item `defaultZCm` kotunda düzlem |
| `led_floodlight.mountHeightCm = 350` | Sabit tavan | Snap sonucu; item default yalnızca ilk değer |
| `getModuleCollisionHeightRangeCm` | Stand tavan fallback | Item `heightCm` + `placement.zCm` / `defaultZCm`; stand tavanı yalnız `itemKey`'siz stub'da |
| `main.js` floodlight `zCm: 350` | Literal | Yok |

`strip_occupancy` (`short-up-1/2`, align top): bugün tavan kayınca short-up tavana yapışır. Hedef: şerit sayısı **görünen panel adedi**; kot item Z/height.

---

## Snap (item_type + kural tipi + kural — hardcode yok)

Kaynak yalnız DB; CRM’den düzenlenir.

| Tablo | Rol |
|---|---|
| `fair_stand_item_type` | Item tipi; unique `key`; item `item_type` FK |
| `fair_stand_rule_type` | Bugün yalnız `snap`; ileride başka tipler |
| `fair_stand_rule` | Kural: `key` + `face`/`edge` |
| `fair_stand_rule_item_type` | Kural ↔ tip(ler) M:N (`top-rail`→profile, `shelf-rail`→panel…) |

Item: `snap_requires_rule_id` **veya** `snap_provides_rule_id` (XOR).  
Motor: **aynı rule id** eşleşmesi. Tip bağı katalog/CRM için; eşleşme hâlâ rule id.

**Lamba / raf kuralları (seed):**  
| key | face | edge | Requires | Provides |
|---|---|---|---|---|
| `top-rail` | top | top | lamba | profile |
| `shelf-rail` | front | top | raf | panel / separator-panel |

**Sanal hat (recipe host, mesh yok):** `itemSnap.js`  
- `top-rail` + BOM’da profile child → Z = `defaultZCm(profile) + height(profile)` (host span içinde); değilse host tavanı. Free profile → `host.z + host.h`.  
- `shelf-rail` (`front`+`top`) → host `strips[]` / band pitch’ten seam listesi; AABB tavan değil.  
Eski `snap_target_item_type` / string capability kolonları kullanılmaz. Type→kural JS map yok.

---

## Uygulama sırası (unutma)

**1–6** uygulandı.

1. Item kolonları: `is_render`, `accepts_*`. Seed. **Done.**
2. Yüzey kapısı item `accepts*` (type map / `selectionMode==='panel'` kapısı). **Done (menü/uygula).** Ctrl çoklu seçim hâlâ şerit `selectionMode` (geometri).
3. `isRender`: false → sahne factory yok. **Done** (`createModuleStateFromDescriptor` / catalog key).
4. `defaultZCm` / `mount_height` → drop `placement.zCm`. **Done** (`resolveItemDefaultZCm`; floodlight 350 literal yok). Kettle sahne kotu da item `defaultZCm`; renderer buzdolabı yüksekliği eklemez.
5. `snap_target_item_type` + `snap_anchor` (`top`/`bottom`/`left`/`right`). **Done**, sonra kural id modeline geçti (P0, `0024`–`0029`): `snapPlacementToItemAnchor` rule id ile eşler; eski iki kolon okunmaz.
6. Duvar tavanı bırak; `wall_200_100`; şerit occupancy yok; panel boşluğu standart. **Done (mesh + kot).** Profil ray `height=8` + `defaultZCm=342`. Dikme item `scene_dimensions`. Düz panel `frameHeight` item `heightCm`. Short-up kot `defaultZCm` + gövde; collision occupancy×stand değil. Occupancy JSON hâlâ katalogda (strip adedi / test); renderer ve collision kotu okumaz. `wall_200_100` yeni SKU yok (adım 8). Panel boşluğu stand zarfında: `fair_stand_dimensions.panel_rail_height_cm` (migration `0034`, admin Temel Ayarlar).
7. Ortak kutu primitive (asılı lightbox). **Örnekti; sistemde böyle bir primitive yok. Atlandı.**
8. Admin item üretimi (Stand API; CRM form sonra). Mevcut `item_type` + ölçü/kot/snap/`accepts*` satırı. Yeni sahne factory doğmaz.

Connector’ı gerçek yapmak ve `panel_197` drop sonra. CRM sahne yok.

## Sıra (eski pose maddeleri, 4–6 ile birleşir)

1. Item default Z kolonu (veya `mount_height_cm`’i profile/floodlight için gerçekten oku).
2. Drop: `placement.zCm = defaultZCm`.
3. Profil/dikme mesh’i stand tavanından kopar. **Done.**
4. Floodlight snap: `top-rail` kuralı + reçetedeki profile çocukların rayı. `profile` / `350` literal yok. **Done (adım 5).**
5. Short-up yüksekliği occupancy×stand yerine item ölçü + Z. **Done (adım 6).**

Bittikten sonra tavan 350→500 item kotlarını oynatmaz.

---

## Profil = TV gibi Z (reçete değil)

`profile_190` sahneye birden fazla konur. Her kopya TV overlay gibi **Z− / Z+**: biri 450, biri 400. Reçete merdiven çizmez; merdiven bu kopyalardan çıkar.

- `wall_200_500` ayrı item olabilir; üstüne ayrıca profil koymak zorunlu değil.
- Floodlight o kopyanın **o anki** `zCm`’ine snap.

## Stand tavanı + item gövdesi (hedef)

- Stand tavanı **üst sınır** kalır (ör. 500). Kamera, overlay clamp, “sahne dışına çıkma”.
- Her item **kendi** `dimensions` / `scene_dimensions` (ve çocuk parçaları) ile çizilir. Mesh `STAND_DIMENSIONS.height` / `stripCount` okumaz.
- Duvar SKU yükseklik taşır: `wall_200_100` → sahne yüksekliği **100 cm**. Tavan 350→500 olsa da 100 kalır; tavana hizalanmaz, şişmez, “üstten N şerit” olmaz. `wall_200_350` / `wall_200_500` ayrı item’lar.
- `height = stripCount × stripHeight` **duvar şekli değildir.** O eşitlik (varsa) yalnız zarf satırının kendi aritmetiğidir; `wall_*` okumaz.
- **Şerit occupancy yok.** 7×50 ızgara, short-up “üstten N şerit”, `align: top` kalkar.

### İki panel arası (standart, tavan değil)

Panel boyu child item’dır (`panel_197` üretim **47 cm**). İki panel arasındaki boşluk/ray **tek standart** (zarf veya pose sabiti; item’a göre değişmez, tavanla çarpılmaz).

Duvar yüksekliği ≈ alt/üst profil + N×panel boyu + (N−1)×panel boşluğu. `wall_200_100` bu toplamı 100’e kilitleyen katalog kaydıdır; ızgara tavanı 100’e “kesmez”.

Kodda tek boşluk değeri stand zarfındaki `panel_rail_height_cm`'dir (0034); şerit pitch 50.

- Raf: şerit dikişi yok. Snap = hedef item’ın **kenarı** (aşağıda).


Profil kopyaları yine TV gibi kendi `zCm`. Tavan yalnız max.


## Notlar

- Placement Z-up (Max). Motor Y-up çevirisi DB’de yok.
- Katalog `category_id` snap grubu değil. Snap = sürülen item’ın requires kuralı ↔ host provides kuralı (rule id).
- `mount_height_cm` floodlight’ta 350; profil `default_z_cm` 342 (gövde 8).
- Arayüzden `wall_200_100` = 200×100 item; tavan onu hareket ettirmez.
- Item `isRender` (DB `is_render`): `true` = kendi sahne render’ı; `false` = sanal/BOM, sahneye çizilmez. Duvar tipi değil; `catalogVisible` ayrı. Ayrıntı `ITEMS.md`.
- Item yüzey yetenekleri (hepsi item kolonu, type map değil): `acceptsColor`, `acceptsImage`, `acceptsLightbox`, `acceptsGlass`, `acceptsMesh`. `isRender=false` → hepsi `false`.
