# wall_door_100_350 — Item Contract Definition

## Kanonik kimlik

- `itemKey`: `wall_door_100_350`
- `name`: `Depo Kapısı 100`
- `type`: `door`
- `unit`: `adet`
- yapı: **Bileşik Item**
- parametrik: relationship/recipe variant açısından evet; nominal ürün genişliği sabit 100 cm

Eski uppercase katalog kimliği kaldırılmıştır. Yeni runtime/catalog/state kimliği `wall_door_100_350`dur.

## Kanonik ürüne özgü / varsayılan özellikler

Bugün parent Item için doğrulanmış ürün ölçüsü:

```text
widthCm = 100
```

Parent kapı kümesine material veya `defaultColor` eklenmez; küme farklı malzemeli child Item'lardan oluşur. Paylaşılan stand yüksekliği/render derinliği de doğrulanmış parent ürün property’si olarak yeniden tanımlanmaz.

## Kanonik bileşim — baza

Miktarların kaynağı Item kaydının `components` listesidir (`composition.items`, `composition.mode=recipe`); `src/itemBom.js` `resolveItemBom` açar:

```text
profile_91            ×1
upright_346_5         ×2
panel_98              ×3
connector_start       ×2
connector_single      ×5
door_leaf_100         ×1
```

Alt miktarları `wall_door_100_350` Item kartında ikinci kez kopyalanmaz.

## Kanonik bileşim — iç köşe

Doğrulanmış relationship-derived ürün kuralı şöyledir:

```text
profile_91            ×1
upright_346_5         ×2
panel_corner_92       ×3
connector_start       ×2
connector_single      ×3
connector_corner      ×2
door_leaf_100         ×1
```

Base → inner-corner dönüşümü:

```text
panel_98 ×3          → panel_corner_92 ×3
connector_single ×5  → connector_single ×3 + connector_corner ×2
connector_start ×2   → değişmez
```

Bu dönüşüm `src/relationshipBom.js` içinde iç köşe ilişkisinden hesaplanır (`cornerSide`: panel bandı ek yeri kadar tekli aparat köşe aparatına döner; `applyCornerPanelSwap`: panel değişimi). Item kaydında ikinci bir köşe reçetesi tutulmaz.

## Recipe varyant API

Kanonik expanded recipe:

```js
getExpandedModuleRecipe('door', 100, { panelVariant: 'inner-corner' })
```

Kanonik recursive Item BOM:

```js
resolveItemBom('wall_door_100_350', 1, { panelVariant: 'inner-corner' })
```

Bu çağrı inner-corner recipe'yi terminal Item'lara kadar recursive açar. Base çağrı `resolveItemBom('wall_door_100_350')` mevcut düz recipe'yi aynen korur.

`panelVariant` relationship sonucunun recipe/BOM katmanına taşınan context'idir. Runtime yerleşim/relationship motorunun gerçek bir inner-corner ilişkisini bu context'e otomatik dönüştürmesi ayrı relationship integration sorumluluğudur; renderer veya UI tahmini BOM tek kaynağı olamaz.

## Özyinelemeli BOM

`src/itemBom.js` kanonik Item'ı expanded recipe üzerinden child Item'lara açar ve bileşik child Item varsa aynı işlemi recursive sürdürür. Nihai her satır kanonik `itemKey`, `quantity` ve child Item'ın `unit` değerini taşır.

Caller recipe options yalnız ilgili root composite Item'ın recipe çözümüne uygulanır; child Item'lara körlemesine sızdırılmaz. Alt composite varsa kendi kanonik composition options'ı ile çözülür.

## Oluşturma / state / kalıcılık

`createDoorModuleState()` parent Item'ı `getItem('wall_door_100_350')` üzerinden çözer ve proje örneğina şu kanonik identity'yi bağlar:

```text
id         = module-<instance>
itemKey    = wall_door_100_350
type       = door
widthCm    = 100
```

Kapı kanadı child state'i ayrı kanonik Item kimliğini korur:

```text
surface.itemKey = door_leaf_100
```

Renk/görsel ezme'ları `door_leaf_100` surface state'inde kalır. Parent yerleşim ve nested state proje snapshot'ı içinde saklanır.

## Davranış / bağlam menüsü / etkileşim

Parent `wall_door_100_350`, `type=door` olduğu için `door` tip davranışı `fair_stand_item_type` kaydından gelir (`src/moduleBehavior.js` `getModuleBehavior`, DB bootstrap `itemTypes`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`):

- duvar yerleşimi,
- 10 cm move snap (`0073_move_snap_10cm`),
- sahne Z Item kolonları (`docs/refactor/ROTATION.md`),
- segment collision,
- standard magnetic snap,
- side insert,
- wall-capacity participation,
- module silhouette ghost.

Bu davranışlar Item migration sırasında yeniden yazılmaz. Context menu parent module davranışını sürdürür. Kapı kanadı `selectionMode=module` olduğu için panel-only glass/Lightbox/Mesh komutlarını açmaz; üst `panel_98`/`panel_corner_92` üretim kimlikleri renderer state'inin ikinci BOM kaynağı yapılmaz.

## Renderer sınırı

Renderer `type=door` üzerinden mevcut prosedürel door renderer'ını kullanır. `door_leaf_100` renk/görsel yetenek’sini kendi Item contract'ından tüketmeye devam eder. Parent Item'ın composition/BOM gerçeği renderer mesh'inden türetilmez.

## Eski alan kaldırma

Eski uppercase katalog kimliği için alias veya compatibility table tutulmaz. Catalog, contract, state, E2E ve aktif Item dokümanları yalnız `wall_door_100_350` kullanır. Tarihsel audit evidence dosyaları migration runtime kaynağı değildir ve bu Item turunda audit remediation yapılmaz.
