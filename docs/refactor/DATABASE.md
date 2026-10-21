# Fair Stand veritabanı

Lokal / sunucu PostgreSQL `fair_stand` şemasının yaşayan envanteri. “Üç ay sonra bunu niye koyduk?” cevabı buradadır.

**CRM / ürün tarafı — alan seçimi ve kuralların etkisi:** [`FAIR_STAND_DB_KULLANIM_KILAVUZU.md`](FAIR_STAND_DB_KULLANIM_KILAVUZU.md) (kullanım kılavuzu). Bu dosya teknik envanter + mapper + “nerede okunur” kaydıdır.

**Doğrulama (2026-09-24, `models.py` + Alembic head + `item_mapper.py` + `src/`):**

1. Şema — aşağıdaki envanter; kolon adları `models.py` ile aynı. Alembic head: **`0077_upright_render`**. `0077_upright_render` bütün dikmeleri `is_render = true` yapar (0068'in uzun dikmeleri false kalmıştı). `0076_vertical_move` öğeye `vertical_move` (↑/↓ dikey taşıma + zemin/tavan ölçüsü) ve `z_reference` (`floor` / `wall-top`) kolonlarını ekler; profil ve kısa duvarlar `wall-top`, dikey taşınan öğeler (TV, strafor, tül, raf, küp blok, LED, kısa duvar, profil) `vertical_move = true`. `0075_glass_bar_table` `glass_bar_table` (Bar Masası, 108 cm) satırını `glass_table`'dan kopyalar. `0073_move_snap_10cm` bütün türlerin `move_snap_cm` değerini 10 yapar. `0074_showcase_brochure` `floor_showcase_100` ve `brochure_stand` tekil sahne satırlarını, türlerini ve iki katalog önizlemesini ekler. `0067_group_templates` organizasyon grup şablonu tablosunu (`fair_stand_group_templates`) ekler; şablon Item değildir. `0053_item_type_scene_behavior` sahne davranışını `fair_stand_item_type` satırından ayırır. `0043_panel_glass_family` ve `0044_panel_corner_glass_family` yeni kolon değildir; `panel_cam_*` / `panel_corner_cam_*` SKU satırıdır. `0057_foam_logo_item` gizli `foam_logo` production satırını ekler. `0061_drop_foam_logo_item` bu satırı siler. Strafor metrekare üretimi `illuminated-foam` kaydındadır. `0059_elektrik_panosu_item` gizli `elektrik_panosu` satırını yoksa ekler; proje listesi bunu modül reçetesinden ayrı, miktar 1 olarak yazar. `0064_tulle_fabric` görünen `tulle_fabric` sahne satırını ekler. Kalınlık item master `depth_cm` 0.4 değeridir. BOM miktarı en × boy / 10000 m² olarak aynı `itemKey` ile yazılır. `0065_metal_separator` gizli `metal_separator` satırını ekler. `0066_metal_separator_area` birimini `metre_kare` yapar ve `is_cost_enabled` açar. Katalogda görünmez. Ctrl ile seçilen tam dikdörtgen tek ölçü olur; Paneller satırı adet ve ölçüyü, Üretim satırı toplam m²’yi yazar.
2. `item_mapper.py` — her ürün kolonu JSON anahtarına (veya “bootstrap’a girmez”) bağlandı.
3. Production `src/` grep — “Nerede” hücresi gerçek okuyucu dosyadır; okunmayan kolon **DATA / TEST_ONLY / SCHEMA_ONLY** yazılır.
4. `ITEMS.md` (alan kuyruğu + onaylı şema), `CATALOG.md`, `ROTATION.md`, `SCENE_POSE.md`, `STAND_DIMENSIONS.md` — değer kopyalanmaz; işaret edilir.
5. Proje SoT — `fair_stand_projects` / `fair_stand_project_assets` + disk asset kökü; tarayıcı IndexedDB yalnız önbellek (`src/projectRemote.js`).

Satır sayıları bu makinedeki canlı PostgreSQL `fair_stand` envanterinden (2026-10-04, Alembic `0057_foam_logo_item`). Başka dump’ta adet değişebilir; kolon yok olamaz. Değer SoT bu dosya değildir.

- Model: `backend/app/modules/fair_stand/infrastructure/models.py`
- Mapper (DB → bootstrap JSON): `backend/app/modules/fair_stand/application/item_mapper.py`
- Proje servisi: `backend/app/modules/fair_stand/application/projects.py`
- Asset disk I/O: `backend/app/modules/fair_stand/infrastructure/asset_storage.py`
- Migrasyon: `backend/alembic/versions/`
- Okuma (catalog): bootstrap → `initializeItemRegistry` / `initializeStandDimensions` / `initializeRuntimeSettings`
- Okuma/yazma (proje): `/api/v1/fair-stand/projects` → `projectRemote.js` → IndexedDB cache

Yeni kolon aynı PR’da bu dosyaya yazılır. Kolon yoksa “var” yazılmaz.

---

## Tablo envanteri

Tek `items` JSON blob’u yok. Amaç: Item kimliği sabit, isteğe bağlı 1:1 / 1:N parçalar ayrı, tip/snap katalogları ayrı, stand zarfı Item değil, **müşteri proje örneği** catalog’dan ayrı. Kullanım rehberi: [`FAIR_STAND_DB_KULLANIM_KILAVUZU.md`](FAIR_STAND_DB_KULLANIM_KILAVUZU.md).

| Tablo | Canlı satır (örnek) | Neden ayrı |
|---|---|---|
| `alembic_version` | 1 | Alembic head. Ürün değil. |
| `fair_stand_categories` | 6, hepsi `is_active=true` | Katalog grupları. Item’dan bağımsız id. Bootstrap yalnız aktif. |
| `fair_stand_catalog_preview_kinds` | 29, hepsi `is_active=true` | Kart silüeti HTML/CSS. Item davranışını tanımlamaz. Bootstrap: `active_only=false` (pasif önizlemeler de JSON’a girer). |
| `fair_stand_units` | 5, hepsi `is_active=true` | Global ölçü birimi kataloğu. Organizasyon satırı yok. `fair_stand_items.unit` → `unit_key` FK, ON UPDATE CASCADE, ON DELETE RESTRICT. Bootstrap’a girmez. |
| `fair_stand_item_type` | 44 (43 sahne tipi + `production`) | Item type sınıflandırması: `key`, `display_name`, `is_active`. Sahne davranışı burada durmaz. |
| `fair_stand_item_type_scene_behavior` | 43 | İsteğe bağlı 1:1 sahne davranışı. Satır yoksa tip non-scene’dir. `production` satırı yoktur. PK/FK `item_type_id` → `fair_stand_item_type_scene_behavior.id` ON UPDATE CASCADE ON DELETE CASCADE. |
| `fair_stand_item_type_overlap` | 6 | Tip ↔ tip çakışma izni. Bootstrap `overlapWithTypes[]`. |
| `fair_stand_rule_type` | 1× `snap` | Kural ailesi. Bootstrap `ruleTypes[]` (stand JS ayrı registry açmaz). |
| `fair_stand_rule` | 3: `profile-top-rail`, `shelf-rail`, `top-rail` | Snap key + face/edge. Bootstrap `rules[]`. |
| `fair_stand_rule_item_type` | 4 | Kuralı **sunan** item tipleri. Bootstrap `rules[].itemTypeKeys`. |
| `fair_stand_items` | 121 (63 `catalog_visible=true`; 121 `is_active=true`) | Ürün kimliği + Catalog üyeliği + snap FK. Bootstrap: `is_active=true` (gizli SKU dahil). `digital_print`, `mesh_fabric`, `lightbox_fabric`, `elektrik_panosu` gizli production kalemleridir. Strafor logosu `illuminated-foam` sahne kaydıdır; üretim metrekare de bu kayda yazılır. `elektrik_panosu` her proje listesine miktar 1 yazılır. |
| `fair_stand_item_dimensions` | 109 | Fiziksel / BOM ölçü. 11 Item’da satır yok: `connector_corner`, `connector_double`, `connector_single`, `connector_start`, `digital_print`, `hali`, `lightbox_fabric`, `mesh_fabric`, `sarmasik`, `shelf_leg`, `showcase_2_body`. |
| `fair_stand_item_scene_dimensions` | 50 | Sahne kutusu override. Yoksa aynı adlı `dimensions` alanı. |
| `fair_stand_item_strip_occupancy` | 8, hepsi `align=top` (4× strip 1, 4× strip 2) | Short-up şerit bandı. |
| `fair_stand_item_assets` | 19 (14 `model` + 5 `default_screen`) | GLB / TV ekran yolu. CHECK beş rol izin verir; canlı satırlar yalnız bu iki rol. |
| `fair_stand_item_components` | 197 | Recipe BOM child (`composition.items`). |
| `fair_stand_item_assembly_parts` | 0 | Parent lokal child pose + optional `lock_group_id` (`assembly.parts`). BOM değil. |
| `fair_stand_item_video_walls` | 2: `video_wall_2x2` (2×2), `video_wall_3x3` (3×3) | Video wall ızgarası. |
| `fair_stand_item_body_parts` | 6 (2 parent × 3 rol) | Vitrin gövde child `itemKey`. |
| `fair_stand_dimensions` | 1 (`id=1`) | Stand zarfı. Item kutusu değil. Admin UI: CRM `/admin/fair-stand/settings`. |
| `fair_stand_settings` | 1 (`id=1`) | Runtime tavanlar. Item kutusu değil. Aynı Temel Ayarlar ekranı. |
| `fair_stand_projects` | 10 | Müşteri stand projesi SoT (tek JSONB payload). Catalog Item tablolarından ayrı. |
| `fair_stand_cost_items` | 0 (yeni tablo) | Organization Item fiyatı ve manuel maliyet kalemi aynı tabloda. `fair_stand_items` fiyat kolonu taşımaz. Para birimi bu sürümde sabit TL; currency kolonu yok. |
| `fair_stand_project_revisions` | 18 | Proje oturum anlık görüntüsü. `organization_id` kolonu yok. |
| `fair_stand_project_assets` | 46 | Proje yüzey görsellerinin meta kaydı; binary diskte. |

Akış (catalog): PostgreSQL → Fair Stand API bootstrap → CRM proxy → tarayıcı registry.  
Akış (proje): PostgreSQL + disk assets → Fair Stand projects API → CRM proxy → `projectRemote` → IndexedDB cache.  
CRM/Core kendi DB’lerinde bu tablolar yok; `organization_id` Core org UUID’sidir (FK yok). Yetki Core permission kodları: `fair_crm.fair_stand.projects.{read,create,update,delete,execute}`.

---

## `alembic_version`

Migrasyon kilidi. Ürün kodu okumaz. `alembic upgrade head` yazar.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `version_num` | yok | Uygulanan Alembic revision | Şema sürümü | yalnız Alembic; head `0067_group_templates` |

---

## `fair_stand_categories`

Katalog sol menü grupları. `docs/refactor/CATALOG.md`. Canlı: 6 satır, hepsi `is_active=true`. Pasif satır yok.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | `categoryId` | Tam sayı grup kimliği | İsim değişse Item satırı kopmasın | `fair_stand_items.category_id` FK; `listCatalogGroups` |
| `catalog_name` | `catalogName` | UI başlık | Kullanıcı dili | Katalog UI |
| `catalog_index` | `catalogIndex` | Grup sırası (`> 0`, unique) | Sürükle sırası | `listCatalogGroups` sort |
| `is_active` | bootstrap’a girmez (repo `is_active=true` filtreler) | Soft delete | Grubu silmeden gizle | `catalog_repository.list_active_categories`; admin |
| `created_at` / `updated_at` | yok | Audit | Kim ne zaman | DB only |

---

## `fair_stand_catalog_preview_kinds`

Katalog kartı çizimi. Placement/BOM değildir.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | `previewId` | Kart tipi id | Item `preview_id` FK | Görünür Item zorunlu |
| `display_name` | preview `displayName` | Admin adı | İnsan | Catalog admin |
| `markup` | `markup` | Kart HTML | Silüet | Catalog kart renderer |
| `css_code` | `cssCode` | Kart CSS | Silüet stil | Catalog kart renderer |
| `sort_index` | `sortIndex` | Admin sıra | Liste | Catalog admin |
| `is_active` | `isActive` | Soft delete | Kullanımdan kaldır | Bootstrap preview listesi |
| `created_at` / `updated_at` | yok | Audit | — | DB only |

---

## `fair_stand_units`

Global ölçü birimi kataloğu. Migration `0052_unit_key` (`0051_unit_catalog` tablosunu açar). `0055_item_unit_fk` `fair_stand_items.unit` kolonunu `unit_key` hedefine bağlar. `organization_id` yok. Satır silinmez; `is_active=false` ile kapanır. `0055`, item verisinin ihtiyaç duyduğu `adet` ve `metre_kare` satırları katalogda yoksa onları ekler. Başka bir unit değerinde durur. Var olan pasif `metre_kare` satırını yeniden açmaz. Bootstrap `units` dizisinde `unitKey` ve `name` döner. Item gövdesindeki `unit` alanı `unit_key` olarak kalır. Mapper birim adını Item payload'ına yazmaz. Item formundaki birim listesi aktif `unit_key` değerlerini bu tablodan okur; pasif satır listeye girmez. Kayıt yine `fair_stand_items.unit` FK’sidir. Yönetim: Fair Stand `/api/v1/fair-stand/admin/units` ve CRM Super Admin `Ölçü Birimleri` (`/admin/fair-stand/units`). `unit_key` addan Item key kuralıyla üretilir (`Metrekare` → `metrekare`). Ad değişince unit key değişir; bağlı Item unit değerlerini PostgreSQL `ON UPDATE CASCADE` yazar. Uygulama item satırlarını ayrıca güncellemez.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | `id` | INTEGER PK | Katalog satır kimliği | Admin API |
| `unit_key` | `unitKey` | `VARCHAR(64)`, unique, zorunlu | Teknik kimlik | Admin API |
| `name` | `name` | `VARCHAR(128)`, zorunlu | İnsan okunur ad | Admin API |
| `symbol` | `symbol` | `VARCHAR(32)`, zorunlu | Kısa gösterim | Admin API |
| `is_active` | `isActive` | Boolean, default `true`, zorunlu | Silmeden kapat | Admin API |
| `created_at` / `updated_at` | yok | `timestamptz`, zorunlu, server default yok | Katalog zaman damgası | DB only |

---

## `fair_stand_items`

Kök Item. PK `item_key`. Gizli Item (`catalog_visible=false`) yine `getItem` ile durur.

Aşağıdaki `###` başlıkları (Kimlik, Catalog, Rotation, Duruş/snap…) **ayrı veritabanı tablosu değildir.** Hepsi bu tablonun kolon gruplarıdır. DBeaver’da `fair_stand_items` kolon listesinde görünürler. 1:1 / 1:N uydular sonraki `## fair_stand_item_*` bölümleridir.

### Kimlik (`fair_stand_items`)

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `item_key` | `itemKey` | Canonical ürün id | Tek kimlik | Tüm FK, factory, BOM, persist |
| `name` | `name` | İnsan adı | Catalog `label`, UI | Katalog, seçim metni |
| `item_type` | `type` | Davranış ailesi adı | Placement/collision/… tüm paket → `fair_stand_item_type` (kesit 1–3); JS `TYPE_BEHAVIORS` yok | `moduleBehavior.js`, recipe lookup adayı |
| `unit` | `unit` | BOM birimi, nullable `VARCHAR(64)`. FK `fk_fair_stand_items_unit_key` → `fair_stand_units.unit_key`. ON UPDATE CASCADE, ON DELETE RESTRICT | Canlı: 87 `adet`, 9 `metre_kare`, 25 null. Eski `m2` yok | `itemBom` |
| `is_active` | item listesine girmez (`is_active=true` filtre) | Soft delete | Satırı yok etmeden kapat | `catalog_repository` item query; lokal seed hepsi true |
| `created_at` / `updated_at` | yok | Audit | — | DB only |

### Catalog üyeliği (`fair_stand_items`)

Sözleşme: `CATALOG.md`. `catalog_visible=true` ⇒ `category_id` + `catalog_item_index` + `preview_id` dolu (CHECK).

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `catalog_visible` | `catalogVisible` | Katalogda görünsün mü | Leaf/BOM parçayı listeden sakla | yalnız `catalog.js` |
| `category_id` | `categoryId` | Grup FK / null | Hangi menü | Catalog UI |
| `catalog_item_index` | `catalogItemIndex` | Grup içi sıra | Kart sırası; görünürlerde unique | Catalog UI |
| `preview_id` | `previewId` | Kart silüet FK / gizlide yok | Kart çizimi | Catalog kart |

### Üretim / görünüm üstveri (`fair_stand_items`)

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `material` | `material` | Üretim malzemesi metni | Vitrin yan/yatay `sunta` zorunlu | `getShowcaseBodyDefinition`; cam raf `getMaterialAppearance` |
| `default_color` | `defaultColor` | Integer hex (örn. `16777215` = beyaz). String değil. | İlk yüzey rengi; zemin de aynı kolon + `paintable` | `designState.js` hex; `scene3d.js` floor `item.defaultColor`; vitrin yan=yatay kilit |
| `default_opacity` | `defaultOpacity` | 0–1 Numeric; server default `1` | Instance opacity yoksa master | `createBoxBlockModuleState`; CRM Item formu |
| `preserve_model_scale` | `preserveModelScale` | GLB ölçeğini ezme | Fit istemeyen saksı/çöp | `scene3d.js` model load; `designState.js` |
| `model_rotation_y_deg` | `modelRotationYDeg` | Mesh Y ofset | GLB eksen | `scene3d.js`; `designState.js` |
| `visual_rotation_y_deg` | `visualRotationYDeg` | Görsel Y ofset | Koltuk sırt / çöp | `scene3d.js` (sahne Z değil) |
| `paintable` | `paintable` | Zemin boyanır mı | Zemin select | `scene3d.js`, `main.js`, `items.js` floor |
| `shape` | `shape` | `L` | L-banko kimliği | `designState.js`, `scene3d.js` `createLCounterModule` |
| `variant` | `variant` | Short-up / sarmasık etiketi | Aile içi ayrım (behavior type değil) | `designState.js` descriptor; `items.js` / `moduleContracts.js` |
| `eye_count` | `eyeCount` | Vitrin 2 / 3 | Açıklık şerit + raf sayısı | `scene3d.js` showcase; `designState.js` |

### Sahne Z dönüşü (`fair_stand_items`)

Üçlü birlikte dolu veya birlikte NULL (CHECK). Canlı: 72 satırda `rotation_step_deg` dolu, 45 satırda null. `ROTATION.md`. Ayrı rotation tablosu yok.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `rotation_step_deg` | `rotationStepDeg` | Shift+R adımı | Type tablosu ezmesin | `src/moduleBehavior.js` `getModuleRotationStepDeg` |
| `default_rotation_deg` | `defaultRotationDeg` | İlk `placement.rotationZDeg` | İlk bakış | `getModuleDefaultRotationDeg` |
| `side_insert_rotation` | `sideInsertRotation` | `inherit` / `default` | Yana ek açı kipi | `resolveSideInsertRotationDeg` |

### Duruş / snap / yüzey (`fair_stand_items` + tip/kural tabloları)

Ayrı katalog: `fair_stand_item_type` (unique `key`), `fair_stand_rule_type`, `fair_stand_rule`. Item `item_type` → `fair_stand_item_type.key` FK; kural ↔ tip M:N (`fair_stand_rule_item_type`). Sözleşme: `SCENE_POSE.md`. Okuma: `src/itemSnap.js` + `src/items.js`.

Katalog tablolarında kalıcı kimlik **`key`**. CRM’de label Key; create’te display_name’den slug. `mount_mode` yok; yalnız face/edge. Aile (`fair_stand_family`) kaldırıldı (`0029_item_type_catalog`).

| Kolon / tablo | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `default_z_cm` | `defaultZCm` | Yerden kot (cm) | Tavan ezmesin | `resolveItemDefaultZCm` |
| `z_reference` | `zReference` | `default_z_cm` neye göre: `floor` ya da `wall-top` (350 cm duvar tepesi; seçili duvar yüksekliği farkı kadar kayar) | Profil ve kısa duvar duvar boyu değişince tepeye oturur | `resolveItemDefaultZCm` |
| `vertical_move` | `verticalMove` | Sahnede ↑/↓ ile dikey taşınır; seçiliyken/taşırken zemin ve tavan uzaklığı gösterilir | Dikey hareket öğe ayarıdır, koda gömülü tür listesi yok | `itemMovesVertically`, `scene3d.js` ok tuşu + ölçü katmanı |
| `item_type` → `fair_stand_item_type.key` | `type` | Item tipi (sınıflandırma key’i). Sahne yeteneği behavior satırının varlığıdır. | Tip seçimi | CRM + bootstrap `itemTypes` |
| `fair_stand_item_type_scene_behavior.placement` | `itemTypes[].placement` | **Yerleşim modu (tip özelliği; snap kuralı değil).** `wall` = duvar hattına yapışır; `free` = serbest zemin; `wall-overlay` = duvar üstüne biner (raf/TV); `top` = üst yüzey (projektör). Instance `modules[].placement {x,y,z}` ile karıştırma. | Tip ailesinin sahneye nasıl oturduğu; tüm SKU miras alır | `getModuleBehavior` → planner |
| `fair_stand_item_type_scene_behavior.collision` | `itemTypes[].collision` | **Çarpışma hacmi.** `segment` = ince şerit (duvar); `footprint` = taban kutusu; `none` = çarpışma yok. Snap requires/provides değil. | Modüller üst üste binebilir mi | `getModuleCollisionStrategy` |
| `fair_stand_item_type_scene_behavior.move_snap_cm` | `itemTypes[].moveSnapCm` | **Sürükleme XY ızgara adımı (cm).** Bütün türlerde 10 (0073_move_snap_10cm, 2026-10-21). Manyetik snap / top-rail kuralı değil. | Taşıma hassasiyeti | `getModuleMoveSnapCm` |
| `fair_stand_item_type_scene_behavior.magnetic_snap` | `itemTypes[].magneticSnap` | **Manyetik hizalama stratejisi.** `standard` / `none` / `short-up-joint`. Move snap ızgarası ve `fair_stand_rule` değil. | Tip manyetik davranışı | `getModuleMagneticSnapStrategy` |
| `fair_stand_item_type_scene_behavior.allow_side_insert` | `itemTypes[].allowSideInsert` | Yanına modül sokulabilir mi | Yan ekleme politikası | `getModuleBehavior` |
| `fair_stand_item_type_scene_behavior.supports_wall_overlay_mount` | `itemTypes[].supportsWallOverlayMount` | Üzerine raf/TV overlay konabilir mi | Overlay host | `supportsWallOverlayMount` |
| `fair_stand_item_type_scene_behavior.wall_capacity` | `itemTypes[].wallCapacity` | Duvar kapasitesine dahil mi (`include`/`exclude`) | Kapasite hesabı | `countsTowardWallCapacity` |
| `snap_requires_rule_id` → `fair_stand_rule` | `snapRequiresRuleId` (+ denorm `snapRequires`) | Aranan kural | Eşleşme | `getItemSnapSpec` → face/edge **kural kaydından** |
| `snap_provides_rule_id` → `fair_stand_rule` | `snapProvidesRuleId` (+ denorm `snapProvides`) | Sunulan kural | Host | `listSnapHosts` / `resolveItemSnapGeometry` |
| `fair_stand_rule.key` / `face` / `edge` | bootstrap `rules[]` | Snap kimlik + geometri | UI’dan kural | CRM Kurallar; motor rule registry |
| `fair_stand_rule_item_type` | `itemTypeIds` / `itemTypeKeys` | Kural ↔ tip(ler) | **Provides:** o tipteki tüm item’lar host | Motor `itemProvidesSnapRule` |
| `snap_target_item_type` / `snap_anchor` | — | Legacy | Okunmaz | null |
| `is_render` / `accepts_*` | aynı | yüzey | aynı | aynı |
| `is_cost_enabled` | `isCostEnabled` | Maliyet hesabına dahil mi. NOT NULL, default false. | İlerideki maliyet hesabı bu bayrağı okur. Fiyat, birim ve reçete değildir. | `admin_items.py`, `item_mapper.py`; CRM Item formu |

CHECK: requires XOR provides rule id; `is_render=false` → accepts_* false.

### Bileşim başlığı (`fair_stand_items`; child satırlar `fair_stand_item_components`)

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `composition_mode` | `composition.mode` | Yalnız `recipe` (CHECK) | BOM expand kapısı | `itemBom.js` `resolveRecipe` |

---

## `fair_stand_item_dimensions`

Fiziksel gövde. En az bir ölçü NOT NULL (CHECK). JSON `dimensions.*`.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `item_key` | — | FK/PK | 1:1 | cascade delete |
| `width_cm` | `widthCm` | Kutu W | Placement / kart / BOM | `resolveSceneDimensions`; factory; AutoDepot |
| `depth_cm` | `depthCm` | Kutu D | Footprint | aynı |
| `height_cm` | `heightCm` | Kutu H | Mesh / şerit aralığı | aynı; collision type tablosu hâlâ ayrı |
| `mount_height_cm` | `mountHeightCm` | Legacy montaj (floodlight 350) | Seed tarihi; drop asıl `default_z_cm`. Fallback: `resolveItemDefaultZCm` hâlâ okur | `led_floodlight`; `selectionFeedback.js` metin |
| `wall_gap_cm` | `wallGapCm` | Strafor–duvar boşluğu | Overlay öne | `designState.js` → `scene3d.js` foam |

**Kaldırıldı:** `length_cm`, `thickness_cm` — migration `0021_drop_item_length_thickness`; önce `0020_item_dims_wh_d_fill` ile W/H/D dolduruldu.

`resolveSceneDimensions`: aynı field `sceneDimensions ?? dimensions ?? MISSING`. Cross-remap yok.

---

## `fair_stand_item_scene_dimensions`

Sahne kutusu. Örn. `profile_190` üretim 190, sahne width 200. Width/depth/height’ten en az biri dolu.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `item_key` | — | FK/PK | 1:1 | — |
| `width_cm` / `depth_cm` / `height_cm` | `sceneDimensions.*` | Slot | Üretim ≠ sahne | `resolveSceneDimensions` |

---

## `fair_stand_item_strip_occupancy`

Short-up duvarın kaç üst şeridi kestiği. `align` bugün yalnız `top`.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `item_key` | — | FK/PK | — | — |
| `align` | `stripOccupancy.align` | Bant hizası (CHECK yalnız `top`) | Katalog/preview oranı; layout helper’ları kalktı (PENDING § A.1) | `normalizeStripOccupancy` / `resolveModuleStripOccupancy`; `catalogPreviewRenderer.js` |
| `strip_count` | `stripOccupancy.stripCount` | Şerit adedi (`> 0`) | 1 veya 2 short-up | aynı + `designState.js` (persist). Tablo kaldırma: PENDING § A.5 |

Stand zarfında **`strip_count` yok** (migration `0019_drop_stand_strip_grid`). Tam panel band pitch: kod `WALL_PANEL_BAND_PITCH_CM` (`wallPanelBand.js`).

---

## `fair_stand_item_type`

Item type sınıflandırması. Item `item_type` → `key` FK (`ON UPDATE CASCADE`, `ON DELETE RESTRICT`). Sahne kolonları bu tabloda yoktur. `production` / Üretim sınıflandırması aktiftir ve behavior satırı yoktur. Seçim rehberi: kılavuz § 5.3.

| Kolon | JSON (`itemTypes[]`) | Nedir | Nerede |
|---|---|---|---|
| `key` / `display_name` | `key`, `displayName` | Tip kimliği | CRM, `getItemType` |
| `is_active` | `isActive` | Pasif tip bootstrap’a girmez | `catalog_repository.list_item_types(active_only=True)` |

## `fair_stand_item_type_scene_behavior`

İsteğe bağlı 1:1 sahne davranışı. PK `item_type_id` → `fair_stand_item_type.id`, ON UPDATE CASCADE, ON DELETE CASCADE. Kayıt varsa tip scene-capable’dır ve bootstrap düz `placement` / `collision` / `ghost` alanlarını vermeye devam eder. Kayıt yoksa bu alanlar payload’da yoktur; `moduleBehavior.js` duvar fallback’i uygulamaz ve hata verir. Registry’de hiç olmayan eski string için duvar fallback’i durur.

| Kolon | JSON (`itemTypes[]`) | Nedir | Nerede |
|---|---|---|---|
| `placement` | `placement` | wall / free / wall-overlay / top | `moduleBehavior.js` |
| `collision` | `collision` | segment / footprint / none | `getModuleCollisionStrategy` |
| `move_snap_cm` | `moveSnapCm` | Sürükleme ızgarası (cm) | `getModuleMoveSnapCm` |
| `magnetic_snap` | `magneticSnap` | standard / none / short-up-joint | `getModuleMagneticSnapStrategy` |
| `allow_side_insert` | `allowSideInsert` | Yan ekleme | `getModuleBehavior` |
| `supports_wall_overlay_mount` | `supportsWallOverlayMount` | Overlay host | `supportsWallOverlayMount` |
| `wall_capacity` | `wallCapacity` | include / exclude | `countsTowardWallCapacity` |
| `connection_endpoint` | `connectionEndpoint` | segment / logical-fixture | `usesLogicalFixtureEndpoint` |
| `collision_depth` | `collisionDepth` | physical / wall-backbone | `usesWallBackboneCollisionDepth` |
| `endpoint_contact` | `endpointContact` | standard / thin-wall-endpoint | `allowsThinWallEndpointContact` |
| `boundary_snap` | `boundarySnap` | stand-edge / wall-inner-face | `usesWallInnerFaceBoundary` |
| `collision_height` | `collisionHeight` | v1: `full` | collision yüksekliği |
| `ghost_kind` / `ghost_renderer` / `ghost_opacity` | `ghost.{kind,renderer,opacity}` | Sürükleme hayaleti | `getModuleGhostBehavior` |
| overlap junction (`fair_stand_item_type_overlap`) | `overlapWithTypes`, `overlapItemTypeIds` | Çakışma istisnası. Behavior satırı yoksa yayınlanmaz. | `canModulesOverlapByBehavior` |

---

## `fair_stand_rule_type` / `fair_stand_rule` / `fair_stand_rule_item_type`

Snap kural kataloğu. Item requires/provides FK → `fair_stand_rule.id`. Seçim rehberi: kılavuz § 5.4.

| Kaynak | JSON | Nedir | Nerede |
|---|---|---|---|
| `fair_stand_rule_type.key` | `ruleTypes[].key` | Bugün `snap` | CRM |
| `fair_stand_rule.key`, `face`, `edge` | `rules[]` | Mount geometrisi | `getSnapRule`, `getItemSnapSpec` |
| `fair_stand_rule_item_type` | `rules[].itemTypeKeys` | Provides tip listesi | `itemProvidesSnapRule` |
| `snap_requires_rule_id` / `snap_provides_rule_id` | item `snapRequires*` / `snapProvides*` | XOR; item başına tek requires | `items.js`, `itemSnap.js` |

---

## `fair_stand_item_assets`

Dosya yolları. `(item_key, asset_role)` unique.

| Kolon | JSON (role’e göre) | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | yok | UUID PK | Çok asset | DB |
| `item_key` | — | FK | — | — |
| `asset_role` | — | CHECK: `model` / `default_screen` / `catalog_image` / `thumbnail` / `texture`. Canlı seed: yalnız `model` ve `default_screen`. | Rol ayrımı | mapper yalnız `model`→`modelFile`, `default_screen`→`defaultScreenFile`. Diğer üç rol şemada durur, JSON’a yazılmaz. |
| `relative_path` | `modelFile` (`model`) veya `defaultScreenFile` (`default_screen`) | Repo-relative path | GLB / TV ekran | `scene3d.js` `loadItemModel` / TV texture |
| `is_active` | mapper yalnız aktif | Soft delete | Eski dosyayı tut | mapper |

---

## `fair_stand_item_components`

Recipe child listesi → JSON `composition.items[]`. Parent ≠ child. `quantity > 0`.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | yok | UUID | Aynı child iki kez (farklı sıra) | DB |
| `parent_item_key` | — | Parent Item | Bileşik | `resolveItemBom` |
| `child_item_key` | `items[].itemKey` | Child Item | Gerçek parça | BOM recursive |
| `quantity` | `items[].quantity` | Adet | Üretim | BOM |
| `per_band` | `items[].perBand` (0 ise yok) | 50 cm bant başına adet farkı | Duvar yüksekliği kuralı (`0068` düz duvar, `0069` kapı ve vitrin, `0070` 100’lük ayırıcı, `0071` 50’lik ayırıcı + 350 reçete düzeltmesi): quantity üstün kendi yüksekliğindeki adettir | `items.js` türetilmiş yükseklikler |
| `height_matched` | `items[].heightMatched` (false ise yok) | Parça (dikme) seçilen yükseklikteki dikmeyle değişir | Aynı | aynı |
| — | sıra | **`sort_order` kolonu yok** (`0013`); mapper `child_item_key` ile sıralar | Deterministik bootstrap | `item_mapper.map_item` |

---

## `fair_stand_item_assembly_parts`

Recipe parent **admin montaj pose** — BOM değildir. Bootstrap `assembly.parts[]`. Admin 3D → Montajı kaydet. Clone shallow kopyalar (aynı `lock_group_id`). Ayrıntı: `ITEM_3D_PREVIEW.md`. Migrasyon: `0038` tablo, `0039` XYZ açı, `0040` `lock_group_id`.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `parent_item_key` | — | Recipe parent | Pose sahibi; **ON DELETE CASCADE** | `PUT .../assembly`; mapper |
| `child_item_key` | `parts[].childItemKey` | BOM child SKU | Hangi leaf; **ON DELETE RESTRICT** (leaf pose’dayken silinemez); ON UPDATE CASCADE | admin preview / prod mesh |
| `instance_index` | `parts[].instanceIndex` | 0-based kopya | quantity > 1 ayırımı | aynı |
| `x_cm` / `y_cm` / `z_cm` | `xCm` / `yCm` / `zCm` | Parent lokal cm | SCENE_POSE | `itemAssembly.js`, `scene3d` |
| `rotation_x_deg` / `y` / `z` | `rotationXDeg` … | W/D/H Euler (°) | Serbest döndürme | aynı |
| `lock_group_id` | `lockGroupId` | Aynı id = kilitli N grup; null = serbest | Admin köşe snap sonrası Kalıcı kilitle | `itemAdminAssemblyLock.js`; CHECK ≥ 1 veya null |

---

## `fair_stand_item_video_walls`

`VIDEO_WALL_2X2` / `3X3`. PK parent.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `parent_item_key` | — | Parent | — | — |
| `rows` / `cols` | `videoWall.rows` / `cols` | Panel ızgara | Seam mesh | `scene3d.js` TV wall; `designState.js` |
| `panel_item_key` | `videoWall.panelItemKey` | `video_wall_panel` | Gizli panel SKU | `items.js` video-wall ölçü |

---

## `fair_stand_item_body_parts`

Vitrin gövde. PK `id` (UUID). Unique `(parent_item_key, body_role)`. Role: `side` / `horizontal` / `glass_shelf`. Canlı parent’lar: `wall_showcase_100_2_350`, `wall_showcase_100_3_350`.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `parent_item_key` | — | Showcase parent | — | — |
| `body_role` | `bodyItems.sideItemKey` / `horizontalItemKey` / `glassShelfItemKey` | Hangi parça | Tek child Key | mapper üçlüyü zorunlu okur |
| `child_item_key` | karşılık | Leaf board/cam | BOM + renk | `getShowcaseBodyDefinition`; `scene3d.js` boards |

---

## `fair_stand_dimensions`

Tek satır `id = 1`. Item değildir. `STAND_DIMENSIONS.md`.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | — | Singleton; CHECK `id = 1`. (Postgres sequence default var, ikinci satır CHECK’ten geçmez.) | İkinci zarf yok | CHECK `ck_fair_stand_dimensions_singleton` |
| `height_cm` | `heightCm` | Tavan (cm) | Max zarf | `src/standDimensions.js` |
| `depth_cm` | `depthCm` | Duvar kalınlığı (cm) | Omurga / overlay | aynı |
| `frame_width_cm` | `frameWidthCm` | Dikey profil kesit (cm) | Sahne kesiti değil (2026-10-21'den beri okunmuyor); kesit modül reçetesindeki profil Item'ının sahne ölçüsüdür | yalnız CRM ayar formu / bootstrap |
| `frame_depth_cm` | `frameDepthCm` | Profil derinlik (cm) | Reçetesinde profil olmayan modülde kare kesit (genişlik = derinlik) | `resolveProceduralFrameCrossSectionCm` |
| `panel_rail_height_cm` | `panelRailHeightCm` | İki panel arası ray boşluğu (cm) | Mesh ray yüksekliği | `scene3d` ← `STAND_DIMENSIONS.panelRailHeight` |
| `created_at` / `updated_at` | yok | Audit | — | DB |

`MODULE_WIDTHS_CM` (50/100/150/200) hâlâ JS; bu tabloda yok.

Canlı satır: `id=1`, `height_cm=500`, `depth_cm=10`, `frame_width_cm=3.5`, `frame_depth_cm=8`, `panel_rail_height_cm=0.2`.

---

## `fair_stand_settings`

Tek satır `id = 1`. Item değildir. Stand zarfı değildir.

Kaynak: PostgreSQL `fair_stand_settings` → catalog bootstrap `settings` → `initializeRuntimeSettings` → `getMaxImageUploadMb()` / `applyArchiveButtonVisibility`.

| Kolon | JSON | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | — | Singleton; CHECK `id = 1` | İkinci ayar satırı yok | CHECK `ck_fair_stand_settings_singleton` |
| `max_image_upload_mb` | `maxImageUploadMb` | Görsel arşiv yükleme tavanı (MB) | JS sabiti yok; aşım popup | `src/runtimeSettings.js` → `imageOptimize.js` / `main.js` |
| `export_button_visible` | `exportButtonVisible` | Dışarı Aktar butonu | Zip günlük vitrin değil; DB kapatır | `applyArchiveButtonVisibility` → `#export-project` |
| `import_button_visible` | `importButtonVisible` | İçe Aktar butonu | Ayrı kapı | `applyArchiveButtonVisibility` → `#import-project` |
| `save_as_button_visible` | `saveAsButtonVisible` | Farklı Kaydet butonu | Yeni UUID + görsel klasör kopyası | `applyArchiveButtonVisibility` → `#save-as-project`; `projectSaveAs.js` |
| `created_at` / `updated_at` | yok | Audit | — | DB |

Canlı satır: `max_image_upload_mb=5`, `export_button_visible=false`, `import_button_visible=true`, `save_as_button_visible=true`. Markup’ta butonlar `hidden` başlar; bootstrap sonrası ayar `true` ise açılır (flash yok). UI kilidi; zip endpoint güvenlik değildir.

---

## `fair_stand_cost_items`

Organization’a özel alış ve satış tutarı. Catalog kimliği değildir. `cost_item_type` `ITEM` veya `MANUAL` olur. ITEM satırında `item_key` dolu, `name` ve `unit` boştur. MANUAL satırında `item_key` boş, `name` ve `unit` doludur. Bir organization aynı `item_key` için tek satır yazar. Manuel ad ve birim için ayrı unique yoktur. `organization_id` Core org UUID’sidir; FK yoktur ve istek gövdesinden yazılmaz. `item_key` → `fair_stand_items.item_key`, ON UPDATE CASCADE, ON DELETE CASCADE. `unit` → `fair_stand_units.unit_key`, ON UPDATE CASCADE, ON DELETE CASCADE. Servis ITEM için yalnız aktif ve `is_cost_enabled=true` Item kabul eder. API: `backend/app/modules/fair_stand/api/cost_item_routes.py`. Yetki: `fair_crm.fair_stand.cost_items.{read,create,update,delete}`. `0063_cost_item_manual` mevcut satırları ITEM yapar.

| Kolon | JSON / API | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | `id` | UUID PK | Fiyat satırı kimliği | CRM `/stand-cost-items` |
| `organization_id` | `organizationId` | Core org UUID (FK yok) | Kiracı izolasyonu | auth context; index `ix_fair_stand_cost_items_organization_id` |
| `cost_item_type` | `costItemType` | `VARCHAR(16)`, `ITEM` veya `MANUAL` | Kayıt türü | CHECK `ck_fair_stand_cost_items_cost_item_type` ve `ck_fair_stand_cost_items_entry_shape` |
| `item_key` | `itemKey` | `VARCHAR(128)`, nullable FK | ITEM kimliği. Ad kopyalanmaz. MANUAL satırda boş | unique `(organization_id, item_key)` |
| `name` | `name` | `VARCHAR(256)`, nullable | MANUAL kalem adı. ITEM satırda boş | form Kalem Adı |
| `unit` | `unit` | `VARCHAR(64)`, nullable FK `fair_stand_units.unit_key` | MANUAL birim anahtarı. Etiket kopyalanmaz. ITEM satırda boş | form Birim; ON UPDATE CASCADE, ON DELETE CASCADE |
| `purchase_price` | `purchasePrice` | `NUMERIC(14,2)`, NOT NULL, `>= 0` | Zorunlu alış fiyatı. `0` geçerlidir | API / CRM form |
| `sale_price` | `salePrice` | `NUMERIC(14,2)`, NOT NULL, default `0`, `>= 0` | Satış verilmezse `0` | API / CRM form |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | `timestamptz`, zorunlu | Audit | API |

Bootstrap bu tabloyu okumaz. `fair_stand_items` fiyat kolonu almaz.

---

## `fair_stand_projects`

Müşteri stand **proje örneği** SoT. Catalog Item satırı değildir. Eski tarayıcı-only IndexedDB artık otorite değil; lokal store önbellek + dirty sync içindir (`src/projectRemote.js`, `src/projectStore.js`).

Auth: org-scoped Core verify; `X-Organization-Id` + Bearer. API: `backend/app/modules/fair_stand/api/project_routes.py`.

| Kolon | JSON / API | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | `id` | Proje UUID PK | İstemci ve asset path aynı id | `projectRemote`, asset `storage_key` |
| `organization_id` | `organizationId` | Core org UUID (FK yok) | Çok kiracılı izolasyon | list/get filtre; disk `{org}/…` |
| `customer_id` | `customerId` | Zorunlu UUID. `crm_customers` FK’si yok. Boş eski satırlar `00000000-0000-4000-8000-000000000001` | Proje bir müşteriye bağlıdır | kolon + index `ix_fair_stand_projects_organization_id_customer_id`. Çizim kaydı (PUT payload) bu değeri değiştirmez. Başka müşteri `PATCH /{id}/customer` |
| `name` | `name` | Görünen ad (trim, boş değil) | Liste / başlık | UI proje listesi |
| `version` | `version` | Optimistic / sıra (`> 0`) | İstemci sürüm bilinci | API response |
| `payload` | `payload` (+ düz `stand` / `modules`) | JSONB proje gövdesi | Tek blob; kolon patlatma yok | `ProjectService`; `buildProjectSnapshot` şekli |
| `created_by` | — | Oluşturan kullanıcı UUID / null | Audit | DB / create |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | Zaman damgası | Liste sırası (`updated_at` desc) | API |

`payload` zorunlu şekil (servis normalize): `{ stand, modules }`. Ek anahtarlar atılır. Catalog bootstrap JSON’u değildir.

---

## `fair_stand_project_revisions`

Proje düzenleme oturumu anlık görüntüsü. Canlı 18 satır. `organization_id` kolonu yok; kiracı sınırı parent `fair_stand_projects` satırıdır.

| Kolon | JSON / API | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | — | UUID PK | Anlık görüntü kimliği | DB |
| `project_id` | — | FK → `fair_stand_projects.id`, ON DELETE/UPDATE CASCADE | Hangi proje | `projects.py` |
| `revision_number` | `revisionNumber` | Integer, CHECK `> 0`. Unique `(project_id, revision_number)` | Oturum sırası | proje API |
| `payload` | — | JSONB, zorunlu | O anki `{stand, modules}` | DB |
| `created_at` / `updated_at` | — | `timestamptz`, zorunlu, server default yok | Audit | DB |

Index: `ix_fair_stand_project_revisions_project_id`.

---

## `fair_stand_group_templates`

Organizasyonun **grup şablonu** (sahne editörü Faz 5). Bir grubun parçalarını ve göreli dizilişini tutar. **Item değildir**; BOM, birim ve fiyat taşımaz. Sahneye yerleştirilince normal modüllere ve yeni bir gruba açılır; BOM parçalardan bugünkü gibi çıkar. API `/api/v1/fair-stand/group-templates`; yetkiler proje yetkileridir (okuma: liste ve yerleştirme, oluşturma/güncelleme: kaydet ve adlandır, silme: sil).

| Kolon | JSON / API | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | `id` | Şablon UUID PK | Kimlik | API |
| `organization_id` | `organizationId` | Core org UUID; yalnız oturumdan yazılır | Organizasyon izolasyonu; başka org 404 alır | index (`organization_id`, `updated_at`) |
| `name` | `name` | En fazla 80 karakter, boş olamaz | Kullanıcı adı | Şablonlarım kartı |
| `member_count` | `memberCount` | Parça sayısı (> 0) | Liste özeti | API |
| `payload` | `payload` | `{ version: 1, members: […] }`; her üye `itemKey`, tip, ölçü, göreli `placement` (`xCm`/`yCm`/`zCm`/`rotationZDeg`, `wallId` yok), **renk**, **cam panel** (`isGlass`) ve **metal separatör** (`isMetalSeparator` / `metalSeparatorGroupId`) taşır. `id`, `group`, `locked`, görsel (`imageAssetId`) ve Lightbox/Mesh kumaş alanları taşınmaz. 2–200 parça; en fazla 512 KB; her `itemKey` katalogda olmalı | Yapı + yüzey ataması (görselsiz) | `group_templates.py`, `src/groupTemplates.js` |
| `created_by` | — | Oluşturan kullanıcı UUID | İz | — |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | Zaman | Sıralama | — |

## `fair_stand_project_assets`

Proje yüzey görseli **meta** satırı. Binary PostgreSQL’de değil; disk kökünde `storage_key` yolu.

Yüklemede sunucu optimize eder (tercihen WebP). Path: `{organization_id}/{project_id}/{asset_id}.webp` (`build_storage_key` / `asset_storage.py`). Proje silinince satırlar CASCADE + klasör silinir.

| Kolon | JSON / API | Nedir | Neden | Nerede |
|---|---|---|---|---|
| `id` | `id` | Asset UUID PK | Payload `imageAssetId` ile aynı | upload/get/delete |
| `organization_id` | — | Org UUID (denormalize) | Org filtre / güvenlik | index; path |
| `project_id` | — | FK → `fair_stand_projects` CASCADE | Proje ağacı | relationship |
| `name` | `name` | Orijinal / gösterim adı | UI | asset list |
| `mime_type` | `mimeType` | Örn. `image/webp` | Content-Type | download |
| `byte_size` | `byteSize` | Byte (`>= 0`) | Kota / debug | API |
| `storage_key` | `storageKey` | Kök-relative path; unique | Disk adresi | `asset_storage` |
| `created_at` | — | Zaman | Audit | DB |

Catalog `fair_stand_item_assets` (GLB/TV seed) ile karışmaz.

---

## Production `src/` bu kolonları okumaz

Kayıt durur; mapper bootstrap’a yazar (asset unused rolleri hariç).

| Kolon | Durum |
|---|---|
| asset `catalog_image` / `thumbnail` / `texture` | CHECK izin; seed/mapper yok |

---

## Bilerek burada olmayanlar

Ertelenmiş kararlar, tavan/şerit kaldırma sırası, Item property backlog: `PENDING_ITEM_DECISIONS.md`.

Tip sınıflandırması `fair_stand_item_type` satırıdır. Sahne davranışı isteğe bağlı `fair_stand_item_type_scene_behavior` satırıdır (2026-10-04). Behavior satırı yoksa tip non-scene’dir; sahte wall paketi yazılmaz. `catalog_visible` drag/drop görünürlüğüdür. `is_render` çizim bayrağıdır. İkisi de scene capability değildir. Snap kuralı behavior’sız tipe bağlanamaz. JS `TYPE_BEHAVIORS` kaldırıldı. Ayrıntı: CRM Item Type formu.

Runtime instance alanları (`placement.xCm/yCm/zCm/rotationZDeg`, `rotationLocked`, yüzey ezmeleri): catalog Item kolonu değil; **`fair_stand_projects.payload` JSONB** içinde yaşar (SoT sunucu). IndexedDB aynı blob’un önbelleğidir.

Catalog projection alias (`label`, kök `widthCm`): Item/DB alanı değil.

Core `role_permissions` / permission lifecycle: Fair Stand DB’sinde yok; yetki Core’da. Stand yalnız permission kodunu verify eder.

---

## Yeni kolon checklist

1. Model + Alembic + mapper (null omit kuralı).
2. Bu dosyada tablo/kolon satırı (nedir / neden / nerede).
3. Konu dosyası varsa oraya pointer (`ROTATION.md` gibi); değer kopyalama.
4. Test: seed + getter fail-fast.
5. `ITEMS.md` şemaya alındıysa oraya da.

## 0073–0074 — Taşıma adımı 10 cm; ayaklı vitrin ve broşürlük (2026-10-21)

Yerel veritabanında Alembic current ve heads: `0074_showcase_brochure`.

- `0073_move_snap_10cm`: `fair_stand_item_type_scene_behavior.move_snap_cm` bütün satırlarda 10. Önceden 50 olan türler (banko, tül, video wall paneli, alt parça türleri) ve LED projektör (20) downgrade'de eski değere döner. Zemin ızgarası (1 m kalın / 50 cm ince) yalnız görüntüdür; adım bu kolondur.
- `0074_showcase_brochure`: iki tekil Item, birimi `adet`, BOM 1 adet (reçete yok). `floor_showcase_100` 100 × 40 × 100 cm (Raf & Vitrin), `brochure_stand` 30 × 30 × 150 cm (Extra). Türler `floor-showcase` ve `brochure-stand`: serbest yerleşim, taban alanı çakışması, 10 cm adım, mıknatıslı yapışma yok. Her biri kendi katalog önizleme satırını alır; aynı markup varsa yeniden eklenmez. Downgrade yalnız bu satırları siler.

## 0072 — Raf genişlik aileleri (2026-10-21)

Yerel veritabanında Alembic current ve heads: `0072_shelf_rows`. Migration mevcut tekli rafları gizler; üç aile kartı ve altı sıralı üretim ürünü ekler. Var olan raf reçetelerini ve kullanıcı ölçü ezmelerini güncellemez; yalnız eksik satırları ekler.

| Tablo / alan | Bootstrap | Tüketim |
|---|---|---|
| `fair_stand_item_width_variants.family_item_key`, `item_key` | aile Item `widthVariants[]` | `items.js` genişlik aile çözümlemesi; `modulePlacement.js` hedef duvar; `main.js` çözülen kimliği kaydeder |
| Tekli/sıralı `fair_stand_item_components` | `composition.items` | BOM ve `resolveShelfRows` gerçek tahta/sıra çözümlemesi |
| Tahta `fair_stand_item_scene_dimensions` | `sceneDimensions` | `scene3d.js` kalınlık/derinlik: alan bazında sahne ölçüsü, yoksa fiziksel ölçü |

Aile-varyant eşlemeleri iki Item FK, bileşik PK ve kendi kendine eşlemeyi engelleyen CHECK taşır. Admin klonlama ve seed de bu ilişkileri korur. Yukarıdaki eski envanter sayıları tarihli snapshot'tır; 0072 sonrasının güncel adetleri değildir. Yeni test fixture sayıları test seed'ine aittir; kullanıcı veritabanıyla aynı olmak zorunda değildir.