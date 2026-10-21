> **TARİHÎ ENVANTER.** Güncel sistem değildir. Aktif kanonik tanım `docs/items/definitions/` (veya `src/items.js`). Gövdedeki `catalogKey` / `DEPOT_*` / `floorType` tarihî örnektir; runtime kimliği `itemKey`.

# door_100 — Tarihî envanter

`ITEM_CONTRACT.md` ve `ITEM_CONTRACT_CHECKLIST.md` fresh okunarak `Version2` runtime zincirinden çıkarılan Bileşik Item envanteri.

## 18-point checklist

| # | Alan | Durum | Kanonik gerçek / owner |
|---:|---|---|---|
| 1 | Identity / type | VAR | `itemKey=door_100`, `type=door`, `unit=adet`; eski uppercase katalog kimliği kaldırılmıştır. |
| 2 | Intrinsic properties | VAR | Parent için doğrulanmış `widthCm=100`; unverified material/defaultColor/özel height-depth uydurulmaz. |
| 3 | Default state | VAR | Parent state kanonik `itemKey/type/width` ile oluşur; child leaf kendi beyaz default'unu taşır. |
| 4 | Oluşturma | VAR | `createDoorModuleState` → `getItem('door_100')`; catalog girişi aynı kanonik Item'dan türetilir. |
| 5 | Placement | VAR | `type=door` → `WALL_BEHAVIOR.placement=wall`. |
| 6 | Move | VAR | Ortak module move motoru; `moveSnapCm=10` (0073). |
| 7 | Rotation | VAR | Ortak behavior; `rotationStepDeg=90`, default 0°. |
| 8 | Snap | VAR | Standard magnetic snap + stand-edge boundary. |
| 9 | Collision / connection | VAR | Segment collision, physical depth, segment endpoint; mevcut parity korunur. |
| 10 | Selection / drag | VAR | Parent module drag/selection mevcut ortak motoru kullanır; leaf surface module selection modundadır. |
| 11 | Context menu | VAR | Parent module delete/duplicate/side-add devam eder; leaf panel-only glass/Lightbox/Mesh açmaz. |
| 12 | Delete / duplicate / keyboard | VAR | Ortak parent module zinciri; duplicate nested child override'larını clone eder ve yeni instance/surface id üretir. |
| 13 | Kalıcılık | VAR | Parent `itemKey=door_100`, type/width/placement/nested surfaces proje state'inde saklanır; leaf `itemKey=door_leaf_100` korunur. |
| 14 | Relationships / reflow | VAR / AÇIK ENTEGRASYON | Parent continuous wall relationship/reflow motoruna katılır. Recipe artık doğrulanmış inner-corner BOM varyantını taşır; runtime relationship bilgisinin otomatik olarak `panelVariant=inner-corner` context'ine çevrilmesi ayrıca kanonik relationship entegrasyonu gerektirir. |
| 15 | BOM / composition | VAR | `door_100` recipe-backed Bileşik Item; base ve inner-corner recipe tek kanonik recipe kaynağından gelir; `resolveItemBom` recipe options ile recursive leaf BOM üretir. |
| 16 | Renderer / asset boundary | VAR | Parent procedural door renderer `type=door` üzerinden çalışır; leaf color/image capability Item'dan; renderer BOM kaynağı değildir. |
| 17 | Runtime owners | VAR | `items.js`, `catalog.js`, `designState.js`, `moduleBehavior.js`, `moduleContracts.js`, `moduleRecipes.js`, `itemBom.js`, `scene3d.js`, persistence/main. |
| 18 | Regression / completion | KISMİ | Composite identity, base recipe, inner-corner recipe, recursive base/corner BOM, factory/persistence identity, behavior/contract ve browser catalog construction testleri vardır; door-specific tam lifecycle E2E halen ayrı regression gap'idir. |

## Kanonik chain

```text
door_100 Item
→ type=door / WALL_BEHAVIOR
→ createDoorModuleState()
→ project instance id + itemKey=door_100
→ existing placement / move / rotation / context / renderer / persistence
→ composition: door:100 recipe
→ base veya relationship-derived recipe option
→ recursive Item BOM
→ canonical leaf Items
```

## Base BOM

```text
profile_91            ×1
upright_346_5         ×2
panel_98              ×3
connector_start       ×2
connector_single      ×5
door_leaf_100         ×1
```

## Inner-corner BOM

Doğrulanmış ürün kuralı: `door_100` inner-corner recipe context'i aldığında yalnız panel değil connector kompozisyonu da değişir.

```text
profile_91            ×1
upright_346_5         ×2
panel_corner_92       ×3
connector_start       ×2
connector_single      ×3
connector_corner      ×2
door_leaf_100         ×1
```

Kanonik delta:

```text
panel_98 ×3          → panel_corner_92 ×3
connector_single ×5  → connector_single ×3 + connector_corner ×2
connector_start ×2   → değişmez
```

Bu ürün/BOM kuralının source-of-truth'u `src/moduleRecipes.js` içindeki `door:100` recipe variant metadata'sıdır. `src/itemBom.js` miktar uydurmaz; yalnız supplied recipe context ile kanonik expanded recipe'yi recursive çözer.

Eski uppercase katalog kimliği için runtime compatibility bağı tutulmaz.

## Renderer görünümü (2026-10-21)

`createDoorModule()` çerçevesi duvar paneliyle aynıdır (`addPanelModuleFrame`): iki dikme ile alt/üst profil reçetedeki `profile_*` sahne kesitinde, kanallı (`src/profileGeometry.js`). Kapı kanadı ve üst paneller profil yüzünün 15 mm önünde, çerçevenin dış kenarından dört yanda 4 cm içeride. Yalnız görünüm; state ve BOM değişmez.
