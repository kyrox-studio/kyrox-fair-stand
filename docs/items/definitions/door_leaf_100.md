# door_leaf_100 — Item Contract Definition

## Kanonik kimlik

- `itemKey`: `door_leaf_100`
- `name`: `Ahşap Kapı Kanadı 100 × 200 cm`
- `type`: `door-leaf`
- `unit`: `adet`
- yapı: tekil physical child Item
- parametrik: hayır

## Kanonik ürüne özgü / varsayılan özellikler

```text
widthCm = 100
heightCm = 200
depthCm = 8
material = ahşap
defaultColor = 0xffffff
```

Bu değerlerin product/default tek kaynağı Fair Stand ilişkisel Item store'daki `door_leaf_100` kaydı kaydıdır.

## Yüzey yetenek sözleşmesi

`door-leaf` type yetenek kaynağı `src/itemCapabilities.js`dir:

```text
color    = true
image    = true
glass    = false
lightbox = false
mesh     = false
```

Kapı kanadı `panel` Item değildir. Panel-range selection veya panel-only glass/Lightbox/Mesh davranışına sokulmaz.

## State / ezme / kalıcılık

Leaf bağımsız top-level proje örneği değildir; parent door module içinde child `surface` state'i taşır. Yeni state kanonik Item kimliğiyle oluşturulur:

```text
surface.itemKey = door_leaf_100
surface.color = #ffffff
surface.imageAssetId = null
surface.imageTransform = canonical image transform default
```

`color`, `imageAssetId` ve `imageTransform` project/runtime ezme alanlarıdır ve save/load ile korunur. Eski persisted door surface state'leri restore sırasında `normalizeModuleItemState()` ile `door_leaf_100` child identity'sine bağlanır; mevcut kullanıcı renk/görsel ezme'ı korunur.

## Davranış / etkileşim sahipliği

Yerleşim, move, rotation, snap, collision, ghost, side insert, delete ve duplicate top-level leaf davranışı değildir; parent `door` tipinin davranışı (`fair_stand_item_type`) sahibidir. Leaf surface tekil olarak renk/görsel düzenlemesi için seçilebilir. Sağ click parent module context menüsünü açar; special panel modes bu leaf için kapalıdır.

## BOM / ilişki

`door_leaf_100` nihai fiziksel BOM Item'ıdır ve başka Item'lardan oluşmaz. Parent `door:100` recipe quantity sahibidir:

```text
door:100 → door_leaf_100 × 1 adet
```

Eski `wall_door_100_350` production `partId` kimliği kaldırılmıştır; paralel ikinci leaf kimliği tutulmaz.

## Renderer sınırı

Door renderer child `surface.itemKey` üzerinden kanonik Item'ı ve `door-leaf` yetenek contract'ını çözer. Effective renk/görsel state'ten gelir. Prosedürel mesh'in stand frame içine fit edilen teknik ölçüsü kanonik product dimensions'ın ikinci business tek kaynağı değildir; specialized renderer temsilidir.

## Regresyon

`test/doorLeafItemContract.test.js`, `test/designState.test.js` ve `test/moduleRecipes.test.js` kanonik özellikler, yetenek, default tüketici, ezme/kalıcılık migration, BOM identity/quantity ve renderer tüketici bağlantısını korur.
