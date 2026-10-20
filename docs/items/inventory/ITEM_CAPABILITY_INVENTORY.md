# Item yetenek envanteri (Create Item formu kaynağı)

## Amaç

Create Item formu bu listedeki satırlardır. Eksik satır = eksik form.

## Model (bu tur kurulum değil)

`item()` boş da olsa vardır. Sistemdeki her özellik o kutuya takılabilir. Item’lardan küme kurulur; kümeye aynı tür özellik inherit veya ezilir. Parent’a `bodySurface` / `faces` / `strips` gibi ikinci çanta uydurulmaz. Yetenek Item’dadır; proje yalnız ezer.

## Bu tur

2026-09-15 taraması Create Item formu kaynağıdır. 2026-09-16’da aşağıdaki tekrarlayan ölçü alanları silindi; satırlar güncel koda göre düzeltilir.

Kaldırılan Item alanları → yeni kaynak:

| Eski alan | Yeni kaynak |
|---|---|
| `dimensions.screenWidthCm` | `dimensions.widthCm` |
| `dimensions.screenHeightCm` | `dimensions.heightCm` |
| `dimensions.catalogHeightCm` | `resolveSceneDimensions(item).heightCm`; yeni field yok |
| `dimensions.tableDiameterCm` | `dimensions.widthCm` |
| `videoWall.panelScreenWidthCm` | `VIDEO_WALL_PANEL.dimensions.widthCm` |
| `videoWall.panelScreenHeightCm` | `VIDEO_WALL_PANEL.dimensions.heightCm` |
| `sizeInch` | kimlik `itemKey` (`TV_42` / `TV_55` / `TV_65`) |
| `composition.nominalWidthCm` | `item.dimensions.widthCm` (`itemBom.resolveRecipe`) |

Yeni Item: `VIDEO_WALL_PANEL` (`catalogVisible=false`). `listRegisteredItems()` = 96 (ölçü dedup sonrası 105; 6 wall_shelf + 3 wall_base silindi). `Recipe.nominalWidthCm` durur.

## Tarama

- Tarih: 2026-09-15; ölçü dedup 2026-09-16 (`cursor/canonical-dimension-dedup-f340`)
- Branch: `Version2` (`a391c10`) + RefactorItem ölçü kesimi
- Zorunlu tarama: 28 dosya. `src/stripOccupancy.js` yalnız `stripOccupancy.align` / `stripCount` kanıtı için eklendi (29).

| # | dosya | unique alan / aksiyon (bu tur satır kaynağı) |
|---|---|---|
| 1 | `src/items.js` | üst anahtarlar + `dimensions.*` + `composition.*` + `bodyItems.*` + `videoWall.rows/cols/panelItemKey` + `stripOccupancy.*`; 9 map; `listRegisteredItems()` = 96 |
| 2 | `src/moduleBehavior.js` | davranış kaydı alanları + `TYPE_BEHAVIORS` 27 type anahtarı + ghost |
| 3 | `MODULE_BEHAVIOR_STANDARD.md` | sözleşme alan adları (kodla aynı küme; `collisionHeight` belgede yok, kodda var) |
| 4 | `src/moduleContextMenu.js` | 10 `data-module-action` + görünme koşulları |
| 5 | `src/itemCapabilities.js` | type image/color haritası + `itemSurfaceAcceptsImage` |
| 6 | `src/surfaceStateBinding.js` | 8 `FABRIC_KEYS` + `isGlass` |
| 7 | `src/scene3d.js` | `selectionMode`, `surfaceRole`, kılıf / `acceptsColor` / `acceptsImage` |
| 8 | `src/designState.js` | `MODULE_STATE_FACTORIES` 25 anahtar + factory çıktı alanları |
| 9 | `index.html` | editor + sahne/depo/proje kontrolleri |
| 10 | `src/main.js` | `#apply-color`, `#reset-module-features`, `data-asset-action` |
| 11 | `src/colorEditorController.js` | hex/RGB/CMYK senkron |
| 12 | `src/colorEditorInputs.js` | `readNumberGroup`, `normalizeCmykValues` |
| 13 | `src/imageFit.js` | `cover` / `contain` |
| 14 | `src/horizontalImageLayout.js` | yatay birleşik layout |
| 15 | `src/rectImageLayout.js` | dikdörtgen birleşik layout |
| 16 | `src/catalog.js` | Catalog projection; `STAND_DIMENSIONS` yok |
| 17 | `src/moduleRecipes.js` | `composition.items` expansion |
| 18 | `src/itemBom.js` | `composition.mode === 'recipe'` vs leaf `unit` |
| 19 | `src/moduleContracts.js` | profil + `appearance` + BOM policy |
| 20 | `src/modulePlacement.js` | `rotationLocked` oturumu |
| 21 | `src/moduleDragSidebar.js` | Shift+R, `rotationLocked` |
| 22 | `src/viewKeyboardShortcuts.js` | Shift+R Item; P/O/L/R/T/F/H kamera |
| 23 | `src/selectionFeedback.js` | yüzey kabul metinleri |
| 24 | `src/featureContracts.js` | `automaticDepot`, `automaticWall` |
| 25 | `test/wallShowcaseItemContract.test.js` | `bodySurface`, `eyeCount`, `bodyItems` |
| 26 | `test/showcaseBodyColorRegression.test.js` | `bodySurface` / `bodySurfaces` yok |
| 27 | `docs/items/contract/ITEM_CONTRACT.md` | `itemKey` / `type` / `id` ayrımı |
| 28 | `docs/items/definitions/wall_showcase_100_2.md` | vitrin tanım + `bodySurface` ezme |
| 29 | `src/stripOccupancy.js` | `align` `top`/`bottom`; `stripCount` |

---

## 1. Item tanım alanları (`src/items.js`)

Map sayıları: `LEAF_ITEMS` 39, `COMMERCIAL_ITEMS` 4, `FURNITURE_ITEMS` 8, `TOP_LIGHT_ITEMS` 1, `NON_CATALOG_ITEMS` 2, `FLOOR_ITEMS` 5, `INDOOR_PLANT_ITEMS` 4, `WALL_MEDIA_ITEMS` 5, `COMPOSITE_ITEMS` 28. `listRegisteredItems()` = 96.

Üst unique key’ler (script): `bodyItems`, `composition`, `connectorType`, `defaultColor`, `dimensions`, `eyeCount`, `itemKey`, `material`, `modelFile`, `modelRotationYDeg`, `name`, `paintable`, `panelRole`, `preserveModelScale`, `shape`, `stripOccupancy`, `type`, `unit`, `variant`, `videoWall`, `visualRotationYDeg`.

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| ürün kimliği | `itemKey` | 96 kayıt (9 map) | `src/items.js` | `item-tanim` | asıl sahip |
| görünen ad | `name` | string | `src/items.js` | `item-tanim` | asıl sahip |
| type | `type` | `upright`, `profile`, `panel`, `separator-panel`, `connector`, `door-leaf`, `shelf`, `shelf-accessory`, `showcase-board`, `showcase-accessory`, `counter-top`, `base-top`, `coat-rack`, `kettle`, `mini-fridge`, `plastic-trash-bin`, `sofa-set-classic`, `sofa-single-classic`, `sofa-double-classic`, `coffee-table-classic`, `table-chair-set-eames`, `chair`, `table-glass`, `bar-stool`, `indoor-plant-1`, `tv`, `led-floodlight`, `illuminated-foam`, `video-wall-panel`, `floor`, `door`, `base`, `counter`, `flat-panel`, `separator`, `showcase-2`, `showcase-3` | `src/items.js` | `item-tanim` | asıl sahip; `video-wall-panel` factory/behavior yok; `base-wall` type Item kaydı yok, `TYPE_BEHAVIORS` anahtarı durur |
| ölçü çantası | `dimensions` | nesne | `src/items.js` | `item-tanim` | asıl sahip |
| genişlik cm | `dimensions.widthCm` | 24, 40, 42.5, 43, 46, 48.5, 50, 52, 60, 65, 75, 92, 93, 98, 100, 102, 107, 108.5, 110, 121.8, 142.5, 143.9, 147.5, 150, 157, 160, 192, 197, 200, 206, 210 | `src/items.js` | `item-tanim` | asıl sahip; TV ekran ve cam masa çapı bu alan |
| yükseklik cm | `dimensions.heightCm` | 25, 30, 35, 38, 47, 50, 52.3, 60, 61, 66, 68.5, 74, 78, 80.9, 82, 100, 120, 121, 180, 200, 350 | `src/items.js` | `item-tanim` | asıl sahip; TV/panel ekran yüksekliği bu alan |
| derinlik cm | `dimensions.depthCm` | 3.5, 5, 16, 19, 20, 28, 28.5, 30, 38, 40, 42, 43, 45, 50, 55, 58, 60, 75, 100, 150, 200 | `src/items.js` | `item-tanim` | asıl sahip |
| uzunluk cm | `dimensions.widthCm` | 41.5, 49.5, 87.3, 87.4, 91, 94.6, 99, 100, 112, 140, 140.5, 143.5, 150, 190, 200, 346.5 | `src/items.js` | `item-tanim` | asıl sahip |
| kalınlık cm | `dimensions.depthCm` | 0.6, 0.8, 1.8, 8 | `src/items.js` | `item-tanim` | asıl sahip |
| montaj yüksekliği cm | `dimensions.mountHeightCm` | 350 (`led_floodlight`) | `src/items.js` | `item-tanim` | asıl sahip |
| duvar boşluğu cm | `dimensions.wallGapCm` | 1.5 (`illuminated-foam`) | `src/items.js` | `item-tanim` | asıl sahip |
| varsayılan renk | `defaultColor` | int `0xd0d3d4`, `0xc79b63`, `0xffffff`, `0xf8fafc`; zemin hex `#e9edf1`, `#8b8f94`, `#e8dfd1`, `#c4a480`, `#625f58` | `src/items.js` | `item-tanim` | asıl sahip; vitrin gövde rengi leaf `showcase_side_*` `0xffffff`; parent `bodySurface` uydurma çanta |
| malzeme | `material` | `alüminyum`, `sunta`, `mdf`, `ahşap`, `cam` | `src/items.js` | `item-tanim` | asıl sahip |
| panel rolü | `panelRole` | `straight`, `inner-corner` | `src/items.js` | `item-tanim` | asıl sahip |
| konnektör tipi | `connectorType` | `start`, `single`, `double`, `corner` | `src/items.js` | `item-tanim` | asıl sahip |
| şekil (tanım) | `shape` | `L` (`desk_banko_*_L`) | `src/items.js` | `item-tanim` | asıl sahip |
| göz sayısı | `eyeCount` | `2` (`wall_showcase_100_2`), `3` (`wall_showcase_100_3`) | `src/items.js` | `item-tanim` | asıl sahip |
| varyant | `variant` | `short-up-1`, `short-up-2` | `src/items.js` | `item-tanim` | asıl sahip |
| şerit doluluk | `stripOccupancy` | `{ align, stripCount }` | `src/items.js` | `item-tanim` | asıl sahip |
| şerit hizası | `stripOccupancy.align` | Item kaydında `top`; `normalizeStripOccupancy` ayrıca `bottom` kabul eder | `src/items.js` | `item-tanim` | asıl sahip |
| şerit sayısı (occupancy) | `stripOccupancy.stripCount` | `1`, `2` (short-up) | `src/items.js` | `item-tanim` | asıl sahip |
| GLB dosyası | `modelFile` | `coat_rack.glb`, `kettle.glb`, `80s_avanti_mini_fridge.glb`, `plastic_trash_bin.glb`, `saksi_bitkili_100x30x30.glb`, `saksi_bitkili_150x30x30.glb`, `saksi_bitkili_200x30x30.glb`, `wall_separator_50_sarmasik.glb`, `wall_separator_100_sarmasik.glb` | `src/items.js` | `item-tanim` | asıl sahip; `EXTRA_INDOOR_PLANT_1` kayıtta `modelFile` yok |
| model Y dönüş | `modelRotationYDeg` | `0`, `90` | `src/items.js` | `item-tanim` | asıl sahip |
| ölçek koru | `preserveModelScale` | `true`, `false` | `src/items.js` | `item-tanim` | asıl sahip |
| görsel Y dönüş (tanım) | `visualRotationYDeg` | `-90`, `-135`, `-45` | `src/items.js` | `item-tanim` | asıl sahip |
| boyanabilir | `paintable` | `true`, `false` (`FLOOR_ITEMS`) | `src/items.js` | `item-tanim` | asıl sahip |
| birim | `unit` | yalnız `adet` (46 kayıtta var; 52 kayıtta alan yok) | `src/items.js` | `item-tanim` | asıl sahip |
| gövde child çantası | `bodyItems` | nesne | `src/items.js` | `item-tanim` | asıl sahip (küme child kimlikleri) |
| yan gövde item | `bodyItems.sideItemKey` | `showcase_side_94_6_30`, `showcase_side_143_5_30` | `src/items.js` | `item-tanim` | asıl sahip |
| yatay gövde item | `bodyItems.horizontalItemKey` | `showcase_horizontal_87_4_30` | `src/items.js` | `item-tanim` | asıl sahip |
| cam raf item | `bodyItems.glassShelfItemKey` | `glass_shelf` | `src/items.js` | `item-tanim` | asıl sahip |
| bileşim | `composition` | nesne | `src/items.js` | `item-tanim` | asıl sahip |
| bileşim kipi | `composition.mode` | `recipe` (COMPOSITE); mobilya kümesinde `mode` yok | `src/items.js` | `item-tanim` | asıl sahip |
| bileşim satırları | `composition.items` | `furniture_sofa_set_classic`, `furniture_table_chair_set_eames` | `src/items.js` | `item-tanim` | asıl sahip; `itemBom.js` yalnız `mode === 'recipe'` okur |
| bileşim child | `composition.items.itemKey` | `furniture_sofa_double_classic`, `furniture_sofa_single_classic`, `furniture_coffee_table_classic`, `glass_table`, `chair_eames` | `src/items.js` | `item-tanim` | asıl sahip |
| bileşim miktarı | `composition.items.quantity` | sayı (alan var; bu tur değer kopyalanmaz) | `src/items.js` | `item-tanim` | asıl sahip |
| bileşim modül tipi | `composition.moduleType` | `door`, `base`, `counter`, `wall`, `wall-short-up-2`, `wall-short-up-1`, `separator`, `showcase-2`, `showcase-3` | `src/items.js` | `item-tanim` | DEPRECATED SCHEMA_ONLY; production okumaz |
| bileşim seçenek | `composition.options` | nesne | `src/items.js` | `item-tanim` | DEPRECATED SCHEMA_ONLY |
| bileşim şekil | `composition.options.shape` | `L` | `src/items.js` | `item-tanim` | DEPRECATED SCHEMA_ONLY; canlı `item.shape` |
| video duvar | `videoWall` | nesne | `src/items.js` | `item-tanim` | asıl sahip |
| video sütun | `videoWall.cols` | `2` (`VIDEO_WALL_2X2`), `3` (`VIDEO_WALL_3X3`) | `src/items.js` | `item-tanim` | asıl sahip |
| video satır | `videoWall.rows` | `2`, `3` | `src/items.js` | `item-tanim` | asıl sahip |
| panel Item | `videoWall.panelItemKey` | `VIDEO_WALL_PANEL` | `src/items.js` | `item-tanim` | asıl sahip; ölçü panel Item `dimensions` |

`unit: 'adet'` olan 46 `itemKey`: 39 LEAF + `COAT_RACK`, `KETTLE`, `MINI_FRIDGE_AVANTI`, `PLASTIC_TRASH_BIN`, `door_100`, `wall_showcase_100_2`, `wall_showcase_100_3`.

---

## 2. Type davranış alanları + enum

Sözleşme: `MODULE_BEHAVIOR_STANDARD.md`. Kod: `src/moduleBehavior.js`.

`TYPE_BEHAVIORS` anahtarları: `flat-panel`, `showcase-3`, `showcase-2`, `shelf`, `door`, `base-wall`, `separator`, `counter`, `base`, `sofa-set-classic`, `sofa-single-classic`, `sofa-double-classic`, `coffee-table-classic`, `table-chair-set-eames`, `chair`, `table-glass`, `bar-stool`, `mini-fridge`, `kettle`, `coat-rack`, `plastic-trash-bin`, `upright`, `profile`, `indoor-plant-1`, `illuminated-foam`, `tv`, `led-floodlight`.

Görülen `placement`: `wall` (`WALL_BEHAVIOR`), `free` (`freeBehavior`), `wall-overlay` (`overlayBehavior`), `top` (`led-floodlight`).

Görülen `moveSnapCm`: `50` (`WALL_BEHAVIOR` ve `freeBehavior` taban), `10` (çoğu free override + `overlayBehavior` + `PLASTIC_TRASH_BIN_BEHAVIOR`), `20` (`led-floodlight`).

Sahne Z dönüşü Item: `docs/refactor/ROTATION.md`. `TYPE_BEHAVIORS` rotation taşımaz.
Görülen `collision`: `segment`, `footprint`, `none`.

Görülen `magneticSnap`: `standard`, `none`, `short-up-joint`.

Görülen `connectionEndpoint`: `segment`, `logical-fixture`.

Görülen `collisionDepth`: `physical`, `wall-backbone`.

Görülen `endpointContact`: `standard`, `thin-wall-endpoint`.

Görülen `boundarySnap`: `stand-edge`, `wall-inner-face`.

Görülen `sideInsertRotation`: `inherit`, `default`.

Görülen `wallCapacity`: `include`, `exclude`.

Görülen `collisionHeight`: yalnız `full`.

Görülen `overlapWithTypes`: `['kettle']`, `['mini-fridge']`, `['flat-panel','profile','counter']`, `['separator']`, `[]`.

`rotationLocked` `TYPE_BEHAVIORS` içinde yok; sürükleme oturumu alanı (bölüm 5).

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| yerleştirme ailesi | `placement` | `wall`, `free`, `wall-overlay`, `top` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| hareket ızgarası cm | `moveSnapCm` | `50`, `10`, `20` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| dönüş adımı derece | `rotationStepDeg` | Item | `docs/refactor/ROTATION.md` | `item-tanim` | asıl sahip |
| varsayılan dönüş derece | `defaultRotationDeg` | Item | `docs/refactor/ROTATION.md` | `item-tanim` | asıl sahip |
| yan ekleme | `allowSideInsert` | `true`, `false` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| çarpışma modeli | `collision` | `segment`, `footprint`, `none` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| manyetik çıtçıt | `magneticSnap` | `standard`, `none`, `short-up-joint` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| bağlantı ucu | `connectionEndpoint` | `segment`, `logical-fixture` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| çarpışma derinliği | `collisionDepth` | `physical`, `wall-backbone` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| uç teması | `endpointContact` | `standard`, `thin-wall-endpoint` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| sınır snap | `boundarySnap` | `stand-edge`, `wall-inner-face` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| yan ek dönüş kipi | `sideInsertRotation` | Item | `docs/refactor/ROTATION.md` | `item-tanim` | asıl sahip |
| overlay bindirme type | `overlapWithTypes` | yukarıdaki diziler | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| overlay montaj | `supportsWallOverlayMount` | `true` (`WALL_BEHAVIOR`), `false` (overlay/upright/top/free taban) | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| duvar kapasitesi | `wallCapacity` | `include`, `exclude` (`upright`, `led-floodlight`) | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| çarpışma yükseklik kipi | `collisionHeight` | `full` | `src/moduleBehavior.js` | `type-davranis` | kod alanı; `MODULE_BEHAVIOR_STANDARD.md` listesinde yok |
| ghost siluet kipi | `ghost.kind` | `silhouette` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| ghost renderer | `ghost.renderer` | `module-silhouette` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| ghost opaklık | `ghost.opacity` | `0.38` | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| type davranış tablosu | `TYPE_BEHAVIORS` | 27 anahtar | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |
| çarpışma yükseklik aralığı | `getModuleCollisionHeightRangeCm` | strip occupancy aralığı; yoksa `heightCm` / Item `dimensions.heightCm` / stand yüksekliği | `src/moduleBehavior.js` | `type-davranis` | `collisionHeight` dalı bu fonksiyonda yok |
| dönüş adımı okuma | `getModuleRotationStepDeg` | Item `rotationStepDeg`; yoksa fail-fast | `src/moduleBehavior.js` | `item-tanim` | `ROTATION.md` |
| dönüş kilit oturumu | `rotationLocked` | `true`/`false` (parametre varsayılan `false`) | `src/modulePlacement.js` | `type-davranis` | type kaydı değil; yerleştirme oturumu |
| dönüş kilit oturumu (sidebar) | `rotationLocked` | Shift+R sonrası `true` | `src/moduleDragSidebar.js` | `editor-arac` | çift satır; asıl UI |
| kısa dikme hedef | `isUprightJointSnapTarget` | type `profile` veya `counter` veya short-up variant | `src/moduleBehavior.js` | `type-davranis` | asıl sahip |

---

## 3. Context menü aksiyonları

`supportsGlass` / `supportsFabric` menüye `pickModuleContext` ile gelir: `surface.userData.selectionMode === 'panel'` (`src/scene3d.js`). Type kümesi `wall-panel` kodda yok.

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| sil | `data-module-action="delete"` | her açık menü | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| kopyala (hafıza + art arda yerleştir) | seçim çubuğu `data-selection-action="duplicate"`, Ctrl/Cmd+C / V | tek modül seçili (sağ tık menüsünde yok) | `src/selectionToolbar.js`, `src/main.js`, `src/moduleDragSidebar.js` | `editor-arac` | asıl sahip |
| strafor ölçü | `data-module-action="resize-foam"` | `moduleType === 'illuminated-foam'` | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| cam aç/kapa | `data-module-action="toggle-glass"` | `supportsGlass` | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| lightbox/kumaş | `data-module-action="toggle-fabric"` | `supportsFabric && fabricType !== 'mesh'` görünür | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| mesh | `data-module-action="toggle-mesh"` | `supportsFabric && fabricType !== 'lightbox'` görünür | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| lightbox ışık | `data-module-action="toggle-fabric-light"` | lightbox kumaş seçiliyken | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| raf ışığı | `data-module-action="toggle-shelf-light"` | `moduleType === 'shelf'` | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| sağa ekle | `data-module-action="add-right"` | `allowSideInsert !== false` | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| sola ekle | `data-module-action="add-left"` | `allowSideInsert !== false` | `src/moduleContextMenu.js` | `editor-arac` | asıl sahip |
| cam destek (seçim) | `supportsGlass` | `selectionMode === 'panel'` | `src/scene3d.js` | `type-davranis` | menü koşulu; `itemCapabilities.glass` değil |
| kumaş destek (seçim) | `supportsFabric` | `supportsGlass` ile aynı | `src/scene3d.js` | `type-davranis` | menü koşulu |
| yan ek izin | `allowsModuleSideInsert` | `getModuleBehavior(...).allowSideInsert !== false` | `src/moduleContextMenu.js` | `type-davranis` | davranış okur |

---

## 4. Yüzey kılıfı

`ITEM_SURFACE_CAPABILITIES_BY_TYPE` image/color: `door-leaf`, `flat-panel`, `base`, `counter`, `door`, `showcase-2`, `showcase-3`. Cam/lightbox/mesh bayrakları false kalır. `scene3d` mesh `acceptsImage` `itemSurfaceAcceptsImage` / `getItemSurfaceCapabilities` türevidir.

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| yüzey yetenek haritası | `ITEM_SURFACE_CAPABILITIES_BY_TYPE` | `door-leaf`, `flat-panel`, `base`, `counter`, `door`, `showcase-2`, `showcase-3` | `src/itemCapabilities.js` | `item-tanim` | type anahtarı; `scene3d.acceptsImage` türevi |
| kapı kanadı renk | `.color` | `true` | `src/itemCapabilities.js` | `item-tanim` | asıl sahip |
| kapı kanadı görsel | `.image` | `true` | `src/itemCapabilities.js` | `item-tanim` | asıl sahip |
| kapı kanadı cam | `.glass` | `false` | `src/itemCapabilities.js` | `item-tanim` | asıl sahip |
| kapı kanadı lightbox | `.lightbox` | `false` | `src/itemCapabilities.js` | `item-tanim` | asıl sahip |
| kapı kanadı mesh | `.mesh` | `false` | `src/itemCapabilities.js` | `item-tanim` | asıl sahip |
| kumaş grup id | `fabricGroupId` | string | `src/surfaceStateBinding.js` | `ornek-state` | uydurma çanta (yüzey state) |
| kumaş renk | `fabricColor` | hex | `src/surfaceStateBinding.js` | `ornek-state` | uydurma çanta |
| kumaş görsel id | `fabricImageAssetId` | asset id | `src/surfaceStateBinding.js` | `ornek-state` | uydurma çanta |
| kumaş fit | `fabricImageFit` | `cover`, `contain`, `size` (`scene3d.js`) | `src/surfaceStateBinding.js` | `ornek-state` | `size` iken `fabricImageWidthCm` / `fabricImageHeightCm` |
| lightbox ışık açık | `fabricLightingOn` | boolean | `src/surfaceStateBinding.js` | `ornek-state` | uydurma çanta |
| kumaş tipi | `fabricType` | `mesh`, `lightbox` | `src/scene3d.js` | `ornek-state` | uydurma çanta |
| kumaş sahip yüzeyler | `fabricOwnerSurfaceIds` | dizi | `src/surfaceStateBinding.js` | `ornek-state` | uydurma çanta |
| kumaş sahip modüller | `fabricOwnerModuleIds` | dizi | `src/surfaceStateBinding.js` | `ornek-state` | uydurma çanta |
| cam bayrağı | `isGlass` | boolean (`applyGlassOverride`) | `src/surfaceStateBinding.js` | `ornek-state` | uydurma çanta |
| seçim kipi | `selectionMode` | `panel`, `module` | `src/scene3d.js` | `ornek-state` | asıl sahip (seçim) |
| yüzey rolü | `surfaceRole` | `front`, `left`, `right`, `return`, `door`, `upper-panel`, `showcase-body`, `chair`, `table`, `furniture`, `light`, `plant`, `planter-body`, `trash-bin` | `src/scene3d.js` | `ornek-state` | asıl sahip (mesh) |
| panel seviyesi | `panelLevel` | `lower`, `upper` (banko) | `src/scene3d.js` | `ornek-state` | uydurma (yüz) |
| banko şekil mesh | `counterShape` | `L` | `src/scene3d.js` | `ornek-state` | tanım `shape` kopyası |
| renk kabul | `acceptsColor` | `true`/`false` (`door-leaf` yetenek; showcase-body `true`) | `src/scene3d.js` | `editor-arac` | |
| görsel kabul | `acceptsImage` | `true`/`false` | `src/scene3d.js` | `editor-arac` | |
| kılıf overlay rolü | `overlay.userData.role` | `mesh-branda`, `lightbox-fabric` | `src/scene3d.js` | `ornek-state` | renderer |

---

## 5. Editor renk / görsel / sıfırla / strafor

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| renk uygula | `#apply-color` | click | `index.html` | `editor-arac` | asıl sahip |
| yüzey renk input | `#surface-color` | `type=color` | `index.html` | `editor-arac` | asıl sahip |
| hex | `#color-hex` | `maxlength=7` | `index.html` | `editor-arac` | asıl sahip |
| R | `#color-r` | min 0 max 255 | `index.html` | `editor-arac` | asıl sahip |
| G | `#color-g` | min 0 max 255 | `index.html` | `editor-arac` | asıl sahip |
| B | `#color-b` | min 0 max 255 | `index.html` | `editor-arac` | asıl sahip |
| C | `#color-c` | min 0 max 100 | `index.html` | `editor-arac` | asıl sahip |
| M | `#color-m` | min 0 max 100 | `index.html` | `editor-arac` | asıl sahip |
| Y | `#color-y` | min 0 max 100 | `index.html` | `editor-arac` | asıl sahip |
| K | `#color-k` | min 0 max 100 | `index.html` | `editor-arac` | asıl sahip |
| kapak sığdır | `#fit-image-cover` | `cover` | `index.html` | `editor-arac` | asıl sahip |
| sığdır | `#fit-image-contain` | `contain` | `index.html` | `editor-arac` | asıl sahip |
| görsel sil | `#clear-texture` | | `index.html` | `editor-arac` | asıl sahip |
| özellik sıfırla | `#reset-module-features` | | `index.html` | `editor-arac` | asıl sahip |
| strafor ışık rengi | `#foam-light-color` | color input | `index.html` | `editor-arac` | asıl sahip |
| strafor ışık paneli | `#foam-light-controls` | `hidden` | `index.html` | `editor-arac` | asıl sahip |
| görsel dosya | `#surface-image` | `accept="image/*"` | `index.html` | `editor-arac` | asıl sahip |
| varlık kütüphanesi | `#asset-library` | | `index.html` | `editor-arac` | asıl sahip |
| strafor varlık aksiyon | `data-asset-action="illuminated-foam"` | sağ tık | `src/main.js` | `editor-arac` | asıl sahip |
| varlık sil | `data-asset-action="delete"` | sağ tık | `src/main.js` | `editor-arac` | asıl sahip |
| hex senkron | `syncFromHex` | | `src/colorEditorController.js` | `editor-arac` | asıl sahip |
| RGB senkron | `syncFromRgbInputs` | | `src/colorEditorController.js` | `editor-arac` | asıl sahip |
| CMYK senkron | `syncFromCmykInputs` | | `src/colorEditorController.js` | `editor-arac` | asıl sahip |
| sayı grubu oku | `readNumberGroup` | | `src/colorEditorInputs.js` | `editor-arac` | asıl sahip |
| CMYK sıkıştır | `normalizeCmykValues` | 0–100 yuvarla | `src/colorEditorInputs.js` | `editor-arac` | asıl sahip |
| görsel fit kipi | `fit` (`imageFit.js`) | `cover`, `contain` | `src/imageFit.js` | `editor-arac` | asıl sahip |
| tek görsel layout | `imageTransform.mode: 'single'` | `createDefaultImageTransform` | `src/designState.js` | `ornek-state` | asıl sahip (state) |
| yatay grup layout | `mode: 'horizontal-group'` | `createHorizontalImageLayout` | `src/horizontalImageLayout.js` | `ornek-state` | asıl sahip |
| dikdörtgen grup | `mode: 'rect-group'` | `createRectImageLayout` | `src/rectImageLayout.js` | `ornek-state` | asıl sahip; banko/çok panel |
| görsel offset X | `offsetX` | `0` default | `src/designState.js` | `ornek-state` | asıl sahip |
| görsel offset Y | `offsetY` | `0` default | `src/designState.js` | `ornek-state` | asıl sahip |
| görsel repeat X | `repeatX` | `1` default | `src/designState.js` | `ornek-state` | asıl sahip |
| görsel repeat Y | `repeatY` | `1` default | `src/designState.js` | `ornek-state` | asıl sahip |
| görsel dönüş | `rotation` | `0` default | `src/designState.js` | `ornek-state` | asıl sahip |
| renk uygula (state) | `applyColorOverride` | renk yazar; varsa `imageAssetId` null | `src/designState.js` | `ornek-state` | asıl sahip |
| geri bildirim | `describeSurfaceSelection` | type’a göre sabit metinler | `src/selectionFeedback.js` | `editor-arac` | asıl sahip |
| zemin geri bildirim | `describeFloorSelection` | `paintable` true/false | `src/selectionFeedback.js` | `editor-arac` | Item zemin yeteneği UI; stand seçimi |
| Shift+R dönüş | `type: 'rotate', direction: 'clockwise'` | `Shift+KeyR` | `src/viewKeyboardShortcuts.js` | `editor-arac` | Item yeteneği |
| dönüş ızgarası ipucu | Shift+R metni | `'Kartı sahneye sürükle · Shift+R: saat yönünde döndür · grid modüle göre'` | `src/moduleDragSidebar.js` | `editor-arac` | |

Sözleşme görünüm (`src/moduleContracts.js`):

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| profil wall-editable | `wall-editable` | `appearance.color` `editable`, `appearance.image` `editable` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| profil wall-color-only | `wall-color-only` | color `editable`, image `none` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| profil free-editable | `free-editable` | color `editable`, image `editable` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| profil free-model-color | `free-model-color` | color `editable`, image `none` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| profil free-model-fixed | `free-model-fixed` | color `fixed`, image `none` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| profil wall-media | `wall-media` | color `fixed`, image `renderer-managed` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| profil top-light | `top-light` | color `state-backed`, image `none` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| profil wall-overlay-image | `wall-overlay-image` | color `halo-only`, image `required` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| görünüm renk kipi | `appearance.color` | `editable`, `fixed`, `state-backed`, `halo-only` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| görünüm görsel kipi | `appearance.image` | `editable`, `none`, `renderer-managed`, `required` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| renderer kipi | `renderer.mode` | `procedural-or-specialized`, `procedural-or-model`, `procedural`, `model`, `specialized-media`, `specialized-overlay` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| runtime kipi | `runtime.mode` | `static` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |
| sözleşme composition | `composition.mode` | `standalone` | `src/moduleContracts.js` | `type-davranis` | Item `composition.mode` `recipe` ile karıştırma |
| strafor sözleşme | `NON_CATALOG_MODULE_CONTRACTS['illuminated-foam']` | profil `wall-overlay-image` | `src/moduleContracts.js` | `type-davranis` | asıl sahip |

---

## 6. Aile aile uydurma state

`DEFAULT_PANEL_COLOR = '#ffffff'`. Tam boy şerit sayısı stand zarfındandır (`docs/refactor/STAND_DIMENSIONS.md`). `createDefaultImageTransform()`: `mode` `single`, `offsetX`/`offsetY` `0`, `repeatX`/`repeatY` `1`, `rotation` `0`.

`createEditablePanelState`: `id`, `stripIndex`, `color`, `imageAssetId` `null`, `imageTransform`.

Showcase `bodySurface`: `{ id, color }` — `color` leaf `bodyItems.sideItemKey` `defaultColor` (`0xffffff` → `#ffffff`). **Uydurma çanta.** `imageAssetId` yazılmaz (`normalize` siler).

Door: 3 şerit, `createEditablePanelState(index + 4, …)` (stripIndex 4,5,6). `surface` = `createEditableItemSurfaceState(door_leaf_100)` (`itemKey` + renk + görsel). Child reçete: `door:100`.

Shelf `shelfLightingOn` renderer/context-menu (`createShelfModule`, `toggle-shelf-light`). Duvar rafı parent factory ve `shelf:{width}:{shelfCount}` child reçete kaldırıldı.

Counter `faces` anahtarları: `frontLower`, `frontUpper`, `leftLower`, `leftUpper`, `rightLower`, `rightUpper`; `shape === 'L'` iken `returnLower`, `returnUpper`. Runtime `shape`: `L` veya `straight`.

Base `faces`: `front`, `left`, `right`. `TYPE_BEHAVIORS['base-wall']` durur; Item factory/`strips` yazımı yoktur.

Furniture `surface` (renk) `table-glass` ve `coffee-table-classic` dışındaki type’larda. `chairCount` yalnız `composition.items` içinde `chair_eames` varsa.

Foam: `haloColor` default `'#ffffff'`; `widthCm` `Math.max(10, …)`; `heightCm` `Math.max(5, …)`.

LED floodlight `surface.color` `'#17191c'`.

`MODULE_STATE_FACTORIES` 25 anahtar: `flat-panel`, `base`, `counter`, `separator`, `sofa-set-classic`, `sofa-single-classic`, `sofa-double-classic`, `coffee-table-classic`, `table-chair-set-eames`, `chair`, `table-glass`, `bar-stool`, `mini-fridge`, `kettle`, `coat-rack`, `upright`, `profile`, `plastic-trash-bin`, `indoor-plant-1`, `tv`, `led-floodlight`, `door`, `showcase-2`, `showcase-3`, `illuminated-foam`.

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| şerit dizisi | `strips` | `flat-panel`, `showcase-2`/`showcase-3`, `door` (3 şerit) | `src/designState.js` | `ornek-state` | uydurma çanta |
| şerit id | `strips[].id` | `createId('surface')` | `src/designState.js` | `ornek-state` | uydurma çanta |
| şerit index | `strips[].stripIndex` | 0…; kapıda 4…6 | `src/designState.js` | `ornek-state` | uydurma çanta |
| şerit renk | `strips[].color` | `#ffffff` | `src/designState.js` | `ornek-state` | uydurma çanta |
| şerit görsel | `strips[].imageAssetId` | `null` | `src/designState.js` | `ornek-state` | uydurma çanta |
| gövde yüzey | `bodySurface` | `{id, color}` | `src/designState.js` | `ornek-state` | uydurma çanta; asıl renk leaf `defaultColor` |
| gövde yüzey renk | `bodySurface.color` | leaf hex | `src/designState.js` | `ornek-state` | uydurma çanta |
| yüz nesnesi | `faces` | counter / base | `src/designState.js` | `ornek-state` | uydurma çanta |
| yüz anahtarı (banko) | `faces.frontLower` vb. | `frontLower`, `frontUpper`, `leftLower`, `leftUpper`, `rightLower`, `rightUpper`, `returnLower`, `returnUpper` | `src/designState.js` | `ornek-state` | uydurma çanta |
| yüz anahtarı (baza) | `faces.front` | `front`, `left`, `right` | `src/designState.js` | `ornek-state` | uydurma çanta |
| tek yüzey | `surface` | separator, door, furniture (istisna iki masa), uzun saksı, led-floodlight | `src/designState.js` | `ornek-state` | uydurma çanta |
| yüzey itemKey | `surface.itemKey` | kapı kanadı `door_leaf_100` | `src/designState.js` | `ornek-state` | leaf kimlik kopyası |
| raf ışığı state | `shelfLightingOn` | `src/main.js` toggle | `src/main.js` | `ornek-state` | `createShelfModule` / context-menu okur; factory yok |
| hale rengi | `haloColor` | `'#ffffff'` default; 6 hex | `src/designState.js` | `ornek-state` | uydurma çanta (`illuminated-foam`) |
| strafor görsel | `imageAssetId` | foam factory arg | `src/designState.js` | `ornek-state` | |
| sandalye sayısı | `chairCount` | `getFurnitureClusterQuantity(..., 'chair_eames')` | `src/designState.js` | `ornek-state` | `furniture_table_chair_set_eames` |
| göz sayısı state | `eyeCount` | tanım kopyası | `src/designState.js` | `ornek-state` | asıl sahip `items.js` |
| görsel Y dönüş state | `visualRotationYDeg` | tanım kopyası | `src/designState.js` | `ornek-state` | tanım kopyası |
| model Y dönüş state | `modelRotationYDeg` | ticari `preserveModelScale` dalı; bitki | `src/designState.js` | `ornek-state` | tanım kopyası |
| ölçek state | `preserveModelScale` | boolean | `src/designState.js` | `ornek-state` | tanım kopyası |
| model dosya state | `modelFile` | separator / bitki / ticari dal | `src/designState.js` | `ornek-state` | tanım kopyası |
| şekil state | `shape` | `L`, `straight` | `src/designState.js` | `ornek-state` | tanım `L` / factory `straight` |
| şerit occupancy state | `stripOccupancy` | normalize edilmiş `{align, stripCount}` | `src/designState.js` | `ornek-state` | tanım kopyası |
| video rows state | `videoWallRows` | Item `videoWall.rows` (`1` sıradan TV; `2`/`3` wall) | `src/designState.js` | `ornek-state` | |
| video cols state | `videoWallCols` | Item `videoWall.cols` | `src/designState.js` | `ornek-state` | |
| factory kaydı | `MODULE_STATE_FACTORIES` | 25 type | `src/designState.js` | `ornek-state` | asıl sahip |
| ortak instance | `id`, `type`, `itemKey`, `widthCm` (+ aileye göre `depthCm`/`heightCm`) | factory | `src/designState.js` | `ornek-state` | proje örneği |
| yerleşim ezmesi | `placement` | `preservePlacement` ile kopyalanır | `src/designState.js` | `ornek-state` | sahne oturumu |
| yerleşim duvar | `placement.wallId` | `back`, `left`, `right`, `free` (`scene3d.js`) | `src/scene3d.js` | `ornek-state` | proje örneği |
| yerleşim dönüş | `placement.rotationZDeg` | sayı | `src/scene3d.js` | `ornek-state` | proje örneği |
| yerleşim x | `placement.xCm` | sayı | `src/scene3d.js` | `ornek-state` | proje örneği |
| yerleşim y | `placement.yCm` | sayı | `src/scene3d.js` | `ornek-state` | proje örneği |
| yerleşim z | `placement.zCm` | sayı | `src/scene3d.js` | `ornek-state` | proje örneği |

`bodySurfaces` (çoğul): runtime state’te yok. `test/showcaseBodyColorRegression.test.js` `undefined` bekler.

---

## 7. BOM / composition

`src/itemBom.js`: `composition.mode === 'recipe'` ise `expandRecipe(item)`; aksi halde leaf satır (`item.unit` zorunlu). `composition.moduleType` production BOM’da okunmaz (DEPRECATED SCHEMA_ONLY). `mode: 'self'` / `decision-required` bu dosyada string olarak yok; `src/moduleContracts.js` GOVERNANCE BOM policy.

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| reçete çözümü | `composition.mode === 'recipe'` | `true` → recipe; değilse leaf | `src/itemBom.js` | `bom-recipe` | asıl sahip (çözüm) |
| leaf BOM birim | `item.unit` | `adet` (yoksa TypeError) | `src/itemBom.js` | `bom-recipe` | |
| BOM policy recipe | `mode: 'recipe'` | `source: 'src/moduleRecipes.js'` | `src/moduleContracts.js` | `bom-recipe` | sözleşme; `itemBom` string’i değil |
| BOM policy self | `mode: 'self'` | `source: 'src/itemBom.js'` | `src/moduleContracts.js` | `bom-recipe` | self örnek atama: `upright_346_5`, `profile_*`, `MINI_FRIDGE_AVANTI`, `KETTLE`, `COAT_RACK`, `PLASTIC_TRASH_BIN` |
| BOM policy karar | `mode: 'decision-required'` | `source: null` | `src/moduleContracts.js` | `bom-recipe` | mobilya/bitki/TV/foam/led |
| reçete id | `recipeId` | örn. `wall-straight-100`, `showcase-2-100` | `src/moduleRecipes.js` | `bom-recipe` | asıl sahip |
| reçete modül tipi | `moduleType` | `wall`, `wall-short-up-2`, `wall-short-up-1`, `separator`, `door`, `showcase-2`, `showcase-3`, `counter`, `base` | `src/moduleRecipes.js` | `bom-recipe` | asıl sahip |
| reçete genişlik | `nominalWidthCm` | 50, 100, 150, 200 | `src/moduleRecipes.js` | `bom-recipe` | asıl sahip |
| bağlantı kipi | `connectionMode` | `straight` | `src/moduleRecipes.js` | `bom-recipe` | asıl sahip |
| reçete şekil | `shape` | `L` (`counter-l:*`) | `src/moduleRecipes.js` | `bom-recipe` | asıl sahip |
| reçete satır item | `items[].itemKey` | | `src/moduleRecipes.js` | `bom-recipe` | asıl sahip |
| reçete satır miktar | `items[].quantity` | sayı (alan var; değer bu tur kopyalanmaz) | `src/moduleRecipes.js` | `bom-recipe` | |
| küme BOM (mode yok) | `composition.items` | sofa/eames set | `src/items.js` | `bom-recipe` | `itemBom` recipe dalına girmez |

---

## 8. Katalog

`MODULE_CATALOG` 55 `itemKey`. Unique kart alanları: `depthCm`, `eyeCount`, `heightCm`, `itemKey`, `label`, `modelFile`, `modelRotationYDeg`, `preserveModelScale`, `shape`, `stripOccupancy`, `type`, `unit`, `variant`, `videoWallCols`, `videoWallRows`, `visualRotationYDeg`, `widthCm`.

Resolve alias: `moduleType`, `counterShape` (`normalizeCatalogDescriptor`).

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| katalog kimliği | `itemKey` | 55 kart | `src/catalog.js` | `katalog` | `items.js` ile çift satır |
| kart etiketi | `label` | Item `name` | `src/catalog.js` | `katalog` | asıl sahip (kart) |
| kart type | `type` | katalog type kümesi (script) | `src/catalog.js` | `katalog` | kopya |
| kart genişlik | `widthCm` | | `src/catalog.js` | `katalog` | kopya / düz |
| kart yükseklik | `heightCm` | | `src/catalog.js` | `katalog` | kopya / düz |
| kart derinlik | `depthCm` | | `src/catalog.js` | `katalog` | kopya / düz |
| kart şekil | `shape` | `L` | `src/catalog.js` | `katalog` | kopya; düz bankoda alan yok |
| banko şekil alias | `counterShape` | `normalizeCatalogDescriptor` | `src/catalog.js` | `katalog` | alias |
| modül tipi alias | `moduleType` | `normalizeCatalogDescriptor` | `src/catalog.js` | `katalog` | alias |
| kart şerit occupancy | `stripOccupancy` | `{align:'top', stripCount: 1 veya 2}` | `src/catalog.js` | `katalog` | kopya |
| kart göz | `eyeCount` | `2`, `3` | `src/catalog.js` | `katalog` | kopya |
| kart model | `modelFile` | | `src/catalog.js` | `katalog` | kopya |
| kart model rot | `modelRotationYDeg` | `0`, `90` | `src/catalog.js` | `katalog` | kopya |
| kart ölçek | `preserveModelScale` | `true`, `false` | `src/catalog.js` | `katalog` | kopya |
| kart görsel rot | `visualRotationYDeg` | `-90` (katalogda görülen) | `src/catalog.js` | `katalog` | kopya |
| kart varyant | `variant` | `short-up-1`, `short-up-2` | `src/catalog.js` | `katalog` | kopya |
| kart birim | `unit` | `adet` (bazı kartlar) | `src/catalog.js` | `katalog` | kopya |
| video cols kart | `videoWallCols` | `2`, `3` | `src/catalog.js` | `katalog` | düz alan (`items.js` `videoWall.cols`) |
| video rows kart | `videoWallRows` | `2`, `3` | `src/catalog.js` | `katalog` | düz alan |
| düz duvar compose genişlikleri | `MODULE_WIDTHS_CM` | 50, 100, 150, 200 | `src/standDimensions.js` | `stand-proje` | Catalog kart listesi değil; `composeStraightWall` + standart metin |
| stand ölçü zarfı | `STAND_DIMENSIONS` | (Item formu değil) | `docs/refactor/STAND_DIMENSIONS.md` | `stand-proje` | Item kutusu değil |

---

## 9. Stand / proje (Item formu değil)

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| stand tipi | `data-stand-type` | `back-wall`, `u-stand`, `l-left`, `l-right`, `island` | `index.html` | `stand-proje` | Item kutusu değil |
| stand X | `#stand-size-x` | min 50 max 5000 step 50 | `index.html` | `stand-proje` | |
| stand Y | `#stand-size-y` | min 50 max 5000 step 50 | `index.html` | `stand-proje` | |
| zemin tipi UI | `#floor-type` | `karolaj`, `hali`, `parke-acik`, `parke-sari`, `parke-beton` | `index.html` | `stand-proje` | zemin `itemKey` seçici; form Item kutusu değil |
| depo açılsın | `#auto-depot-enabled` | checkbox | `index.html` | `stand-proje` | |
| depo ölçüsü | `#auto-depot-size` | `100x100`, `150x100`, `200x100`, `200x200` | `index.html` | `stand-proje` | |
| depo içeriği | `#auto-depot-contents` | checkbox | `index.html` | `stand-proje` | |
| sahne oluştur | `#create-stage` | | `index.html` | `stand-proje` | |
| modül ekle (sahne) | `#open-module-catalog` | | `index.html` | `stand-proje` | |
| sahneyi sıfırla | `#clear-wall` | | `index.html` | `stand-proje` | |
| proje kaydet | `#save-project` | | `index.html` | `stand-proje` | |
| proje aç | `#open-project` | | `index.html` | `stand-proje` | `#load-project` yok |
| dışarı aktar | `#export-project` | | `index.html` | `stand-proje` | |
| içe aktar | `#import-project` | | `index.html` | `stand-proje` | |
| proje sil | `#delete-project` | | `index.html` | `stand-proje` | |
| proje adı değiştir | `#rename-project` | | `index.html` | `stand-proje` | |
| otomatik depo sözleşmesi | `FEATURE_CONTRACTS.automaticDepot` | `id` `automatic-depot` | `src/featureContracts.js` | `stand-proje` | |
| depo girdi | `inputs` | `standType`, `standXCm`, `standYCm`, `sizeKey`, `includeContents` | `src/featureContracts.js` | `stand-proje` | |
| depo içerik type | `creates.contentKinds` | `mini-fridge`, `kettle`, `coat-rack`, `plastic-trash-bin` | `src/featureContracts.js` | `stand-proje` | |
| depo içerik key | `creates.contentCatalogKeys` | `MINI_FRIDGE_AVANTI`, `KETTLE`, `COAT_RACK`, `PLASTIC_TRASH_BIN` | `src/featureContracts.js` | `stand-proje` | |
| otomatik duvar sözleşmesi | `FEATURE_CONTRACTS.automaticWall` | `id` `automatic-wall` | `src/featureContracts.js` | `stand-proje` | |
| otomatik duvar girdi | `inputs` | `wallWidthCm`, `standType`, `standXCm`, `standYCm` | `src/featureContracts.js` | `stand-proje` | |
| otomatik duvar yapı type | `creates.structuralKinds` | `flat-panel` | `src/featureContracts.js` | `stand-proje` | |
| otomatik duvar lamba type | `creates.lightingKinds` | `led-floodlight` | `src/featureContracts.js` | `stand-proje` | 150 cm koşu; depo arkası ve depo yanı hariç |
| kamera perspective | `type: 'projection', mode: 'perspective'` | `p` | `src/viewKeyboardShortcuts.js` | `stand-proje` | kamera; Item yeteneği değil |
| kamera ortho | `mode: 'orthographic'` | `o` | `src/viewKeyboardShortcuts.js` | `stand-proje` | |
| sol bakış | `type: 'view', direction: 'left'` | `l` | `src/viewKeyboardShortcuts.js` | `stand-proje` | |
| sağ bakış | `direction: 'right'` | `r` (Shift yok) | `src/viewKeyboardShortcuts.js` | `stand-proje` | |
| üst bakış | `direction: 'top'` | `t` | `src/viewKeyboardShortcuts.js` | `stand-proje` | |
| ön bakış | `direction: 'front'` | `f` | `src/viewKeyboardShortcuts.js` | `stand-proje` | |
| ev bakış | `direction: 'home'` | `h` | `src/viewKeyboardShortcuts.js` | `stand-proje` | |
| persist zemin alanı | `stand.itemKey`; isteğe bağlı `stand.floorArea` | eski kayıt `floorType`; `floorArea` yoksa tam baz | `src/floorArea.js`; `resolveStandFloorItemKey` | `stand-proje` | tek dikdörtgen, dizi değil |

---

## 10. Kilit test / MD (alan adı; yeni kural yok)

| alan / aksiyon | kod adı | kanıtlı değerler (yalnız kodda görülen) | sahip dosya | sınıf | not |
|---|---|---|---|---|---|
| vitrin gövde state adı | `bodySurface` | test bekler | `test/wallShowcaseItemContract.test.js` | `ornek-state` | uydurma çanta adı kilitli |
| vitrin göz | `eyeCount` | `2` / `3` | `test/wallShowcaseItemContract.test.js` | `item-tanim` | |
| vitrin bodyItems | `bodyItems` | `sideItemKey`, `horizontalItemKey`, `glassShelfItemKey` | `test/wallShowcaseItemContract.test.js` | `item-tanim` | |
| çoğul gövde yok | `bodySurfaces` | `undefined` | `test/showcaseBodyColorRegression.test.js` | `ornek-state` | anti-alan |
| gövde renk regress | `defaultColor` | `0xffffff` → `#ffffff` | `test/showcaseBodyColorRegression.test.js` | `item-tanim` | asıl sahip leaf |
| Item kimlik ayrımı | `itemKey` / `type` / `id` | belge | `docs/items/contract/ITEM_CONTRACT.md` | `item-tanim` | yeni kural yok |
| vitrin tanım MD | `wall_showcase_100_2` | `type` `showcase-2`, `unit` `adet`, `eyeCount` `2`, `bodySurface` ezme | `docs/items/definitions/wall_showcase_100_2.md` | `item-tanim` | |

---

## 11. Delik kontrolü

Aşağıdaki token’lar taranan dosyada geçiyor ve **ayrı yetenek satırı değil**; kanıt:

| token | nerede görüldü | neden satır değil |
|---|---|---|
| `kind: 'surface'` / `'decoration'` | `src/scene3d.js` `userData.kind` | renderer mesh sınıfları; Item kutusu alanı değil |
| `stripNumber` | `pickModuleContext`, menü başlığı, `describeSurfaceSelection` | `stripIndex` görünen 1-tabanlı etiket |
| `moduleIndex`, `moduleId`, `moduleType` | `src/scene3d.js` `userData` | proje örnek kimliği / type kopyası |
| `surfaceId` | `src/scene3d.js` | yüzey `id` kopyası |
| `backing`, `selectionFrame`, `colorTargets` | `src/scene3d.js` | renderer yardımcı mesh |
| `GLASS_APPEARANCE`, `MESH_FABRIC_OPACITY` | `src/scene3d.js` | malzeme sabiti; yetenek adı değil |
| `overlay.userData.fabricState` | `src/scene3d.js` | kılıf state kopyası (`FABRIC_KEYS` satırda) |
| `createId('module'/'surface')` | `src/designState.js` | uuid üretimi |
| `WALL_WIDTH_TO_ITEM_KEY` vb. resolver map | `src/designState.js` | `itemKey` çözüm tablosu; yeni alan değil |
| `module-picker-*` DOM | `src/moduleContextMenu.js` | `add-right`/`add-left` katalog seçici UI |
| reçete `items[].quantity` sayıları | `src/moduleRecipes.js` | alan satırda; sayı kopyası uydurma yasağı |
| `self` / `decision-required` string | `src/itemBom.js` içinde **yok** | yalnız `src/moduleContracts.js` policy |
| `floorType` / `depot` factory | `src/designState.js` içinde **yok** | stand `index.html` / `scene3d.setFloorType` |
| `#load-project` | `index.html` içinde **yok** | `#open-project` |
| `parseHexInput` | `src/colorEditorInputs.js` içinde **yok** | `syncFromHex` |
| `canApplyColorToSelection` | `src/selectionFeedback.js` içinde **yok** | `describeSurfaceSelection` |
| `collisionHeight` okuma dalı | `getModuleCollisionHeightRangeCm` içinde **yok** | alan yine `WALL_BEHAVIOR` kaydında `full` |
| `bodySurfaces` | runtime **yok** | test anti-alan |
| `ROG` | bu tur taranmadı | dokunulmadı |

Ek kanıt:

- `src/stripOccupancy.js`: `align` ∈ `{top, bottom}` — Item kaydında yalnız `top`.
- `ITEM_SURFACE_CAPABILITIES_BY_TYPE` image/color type’ları: `door-leaf`, `flat-panel`, `base`, `counter`, `door`, `showcase-2`, `showcase-3`. `acceptsImage` türetilir.
- Tahmin yazılmadı: snap 25, 210°, “5 yüz UI” kodda yok.

Satıra **bilinçli bağlanan ama Item formu olmayan**: bölüm 9 (`stand-proje`) + kamera kısayolları. Stand zarfı: `docs/refactor/STAND_DIMENSIONS.md`.

---

*Dosya sonu. Create Item formu bu tabloların birleşimidir (`stand-proje` satırları hariç).*
