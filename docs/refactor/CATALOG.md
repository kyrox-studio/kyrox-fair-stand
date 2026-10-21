# Catalog

Fair Stand katalog mekanizmasının canonical teknik sözleşmesi. Audit dökümü değildir.

Item tarafındaki Catalog config alanlarının kısa kaydı: `docs/refactor/ITEMS.md`. Stand zarfı: `docs/refactor/STAND_DIMENSIONS.md`. PostgreSQL: `docs/refactor/DATABASE.md`. Bu dosya Catalog’un nasıl çalıştığını anlatır; Item şemasını, stand zarfını ve tablo envanterini kopyalamaz.

---

## Amaç

Modül Kataloğu, sahneye sürüklenebilir / eklenebilir Item’ların kullanıcıya gösterilen listesidir.

Katalog yalnız UI organizasyonudur. Placement, collision, BOM, recipe, rotation, color, image veya renderer davranışı tanımlamaz.

**Catalog bir Item runtime repository değildir.**

`catalogVisible=false` yalnız Catalog UI görünürlüğünü etkiler; Item’ın başka mekanizmalardaki varlığını veya kullanılabilirliğini etkilemez.

---

## Domain sınırı

Catalog yalnız şunlardan sorumludur:

- Item katalogda görünsün mü?
- Hangi `categoryId` altında görünsün?
- Kategori kaçıncı sırada?
- Item kategori içinde kaçıncı sırada?
- Katalog kartı UI projection’ı nasıl üretilir?

Catalog şunların veri kaynağı değildir: AutoDepot, Item Contract, BOM, Recipe, Placement, runtime Item lookup.

```text
Item master
    ↓
Catalog projection
    ↓
Catalog UI

Item master → AutoDepot
Item master → Module Contract
Item master → Recipe / BOM
```

Yasak:

```text
AutoDepot → Catalog
ModuleContract → Catalog
BOM → Catalog
Recipe → Catalog
Catalog → Recipe
```

Canonical API (`getCatalogItem`, `listCatalogItems`, `listCatalogGroups`, `listCatalogCategories`, `getCatalogCategory`) Catalog/UI içindir.

---

## UI karşılığı

Sol paneldeki **Modül Ekle** düğmesi (`#open-module-catalog`, `index.html`) katalog girişidir. Düğmenin hemen üstüne `createModuleDragSidebar` kart ızgarasını basar.

Bu yüzey “Modül Kataloğu”dur. Sağ tık **Modül Ekle** picker’ı (`renderPickerCatalog`) aynı `listCatalogGroups()` sonucunu kullanır.

---

## Catalog modeli

Canonical kaynak: `src/catalog.js` — bootstrap `initializeCatalogCategories` / `listCatalogCategories` (eski sabit `CATALOG_CATEGORIES` yok).

```text
Catalog {
  id: integer
  catalogName: string
  catalogIndex: integer
}
```

### id

- Stabil kategori kimliği
- Veritabanı üretir (INTEGER)
- Kullanıcı üretmez / görmek zorunda değildir / değiştirmez
- UI label değildir
- Item.categoryId bu değere bağlanır
- String key / slug / UUID yoktur

### catalogName

- Modül Ekle panelinde görünen kategori adı
- Boş olamaz

### catalogIndex

- Kategorilerin yukarıdan aşağıya 1 tabanlı sırası
- 1 = en üst kategori
- Duplicate yok; `1..N` kesintisiz
- `catalogItemIndex` ile karıştırılmaz

`catalogItemIndex` = Item’ın **kendi kategorisi** içindeki sırası.

---

## Item bağlantısı

Catalog UI yalnız Item’ın Catalog config’ini okur.

```text
Item.catalogVisible          → kategoride gösterilsin mi
Item.categoryId              → Catalog.id
Item.catalogItemIndex        → kategori içi 1 tabanlı sıra
Item.previewId               → Catalog kart preview tanımı (integer id)
Item.name                    → kart label
```

`categoryId` görünen label saklamaz. Ad yalnız `catalogName` üzerinden gelir.

**Catalog görünümü Item.type üzerinden belirlenmez.**

**Catalog preview renderer seçimi yalnız Item.previewId üzerinden yapılır.**

`previewId` asset/icon dosya yolu değildir. Generic renderer bootstrap `previewKinds` kaydındaki markup/CSS ile DOM silüet çizer. Key-specific JS renderer map yoktur.

Görünür Item’da `previewId` yoksa veya bootstrap preview id listesinde değilse projection fail-fast atar. `type` fallback, registry grubu fallback, `itemKey` hardcode map yoktur.

---

## Item master vs Catalog projection

Item master ürünün gerçek özelliğidir (`src/items.js`). Catalog projection Item’dan UI için türetilen görünümdür; ikinci source-of-truth değildir.

**Catalog ölçülerin sahibi değildir.** Kart DTO `type`, footprint, `modelFile` veya factory alanları taşımaz. Sahne state `createModuleStateFromDescriptor` içinde `getItem` + `resolveSceneDimensions` ile dolar. `catalogWidthCm` kaldırıldı.

| Projection alanı | Kaynak |
|---|---|
| `itemKey` | `item.itemKey` |
| `label` | `item.name` |
| `previewId` | `item.previewId` |

Yeni görünen Item için Catalog içine kart satırı yazılmaz.

---

## Kategoriler

| id | catalogName | catalogIndex | Item sayısı |
|---|---|---|---|
| 1 | Panel & Duvar | 1 | 9 |
| 2 | Panel Ek Modül | 2 | 14 |
| 3 | Raf & Vitrin | 3 | 6 |
| 4 | Banko & Baza | 4 | 9 |
| 5 | Extra | 5 | 18 |
| 6 | Elektronik & Aydınlatma | 6 | 6 |

Toplam görünür Item: **62**. Kayıtlı Item: **126**.

---

## Sıralama

1. **Kategori sırası** = `Catalog.catalogIndex`
2. **Kategori içi Item sırası** = `Item.catalogItemIndex`

---

## Çalışma akışı

```text
ITEM
  ↓
catalogVisible
categoryId
catalogItemIndex
previewId
name
  ↓
Catalog projection  (getCatalogItem / listCatalogItems)
  ↓
Catalog UI  (getCatalogPreview(previewId) → generic renderer)
```

Kart descriptor’ı Item kaydından türetilir. Hardcoded Item key listesi yoktur. Snapshot alias `MODULE_CATALOG` / `MODULE_CATALOG_KEYS` / `MODULE_CATALOG_GROUPS` yoktur; okuyucu `getCatalogItem` / `listCatalogItems` / `listCatalogGroups`.

---

## Canonical API / Method

| Method | Durum |
|---|---|
| `listCatalogCategories()` | mevcut — kategoriler, `catalogIndex` sırası |
| `getCatalogCategory(categoryId)` | mevcut |
| `getCatalogItem(itemKey)` | mevcut — görünür Item’dan catalog descriptor |
| `listCatalogItems()` | mevcut — `catalogVisible=true` Item projection listesi |
| `listCatalogGroups()` | mevcut — kategori + Item key listesi (`catalogItemIndex` sırası) |

UI okur: `listCatalogGroups()` + `group.catalogName` + `getCatalogItem(itemKey)`.

`resolveItemKey` Item identity helper’dır (`src/items.js`); Catalog üyeliği kontrol etmez. `src/catalog.js` re-export etmez. `src/designState.js` ve `src/main.js` `items.js`’ten okur. Catalog `getModuleCatalogItem` aynı fonksiyonu `items.js` import’u ile kullanır.

Catalog UI yardımcıları: `getModuleCatalogItem`, `getModuleCatalogLabel` — görünür Catalog projection döner. Drag badge (`src/scene3d.js`) katalog kart önizlemesi için bunları okur.

---

## Kesin mimari kurallar

- Katalog üyeliği `type` üzerinden belirlenmez
- Catalog görünümü `Item.type` üzerinden belirlenmez
- Catalog preview renderer seçimi yalnız `Item.previewId` üzerinden yapılır
- `if (item.type === ...)`, `switch(type)`, `type` → CSS/icon/kart tipi Catalog UI’da yasaktır
- Registry grubundan belirlenmez
- Item Contract üzerinden belirlenmez
- `catalogVisible` üyelik, `categoryId` grup, `catalogItemIndex` sıra, `previewId` kart silüeti belirler
- `catalogVisible=false` Item’ı AutoDepot / ModuleContract / BOM / renderer / placement’tan silmez
- `categoryId` rotation / color / image / collision / renderer / placement belirlemez
- Kategori adı yalnız `catalogName`
- Kategori sırası yalnız `catalogIndex`
- Aynı kategori tanımı ikinci hardcoded listede tutulmaz
- UI kendi başına kategori listesi hardcode etmez

---

## Yeni Item ekleme örneği

Dokümantasyon örneği; bu `itemKey`’ler kayıtlı ürün değildir.

```json
{
  "itemKey": "example_item",
  "catalogVisible": true,
  "categoryId": 1,
  "catalogItemIndex": 3,
  "previewId": 9
}
```

```json
{
  "itemKey": "example_child",
  "catalogVisible": false,
  "categoryId": null,
  "catalogItemIndex": null
}
```

Yeni görünen Item yalnız Item kaydına yazılır (`catalogVisible=true` + `categoryId` + `catalogItemIndex` + `previewId`). Catalog’a ayrı kart satırı eklenmez. `previewId` bootstrap preview id listesinde olmalıdır (`listCatalogPreviewIds()`).

Yeni kategori gerekirse Admin Catalog CRUD ile `catalogName` / `catalogIndex` eklenir; `id` veritabanı üretir.

---

## Validation

- Catalog category sayısı: 6
- `id` benzersiz integer
- `catalogName` boş: 0
- `catalogIndex` null: 0
- duplicate `catalogIndex`: 0
- `catalogIndex` 1..N kesintisiz
- `catalogVisible=true` ve geçersiz `categoryId`: 0
- catalog projection Item: 59
- `catalogVisible=true` ve `previewId` yok/bilinmiyor: fail-fast
- hardcoded katalog Item key listesi: 0
- Catalog UI preview `type` branch: 0
- `catalogVisible=false` → category/index null
- `catalogVisible=false` → `getCatalogItem` null; `getItem` dolu
- Aynı kategoride duplicate `catalogItemIndex` yasak
- Catalog Recipe import etmez
- Catalog ölçülerin sahibi değildir; kart yalnız `itemKey` / `label` / `previewId` taşır
- Factory / preview silüet ölçüleri Item’dan `resolveSceneDimensions` okur; Catalog DTO’dan değil
- AutoDepot / moduleContracts Catalog import etmez

---

## Testler

| Test | Ne doğrular |
|---|---|
| `test/catalogItemProjection.test.js` | 60/60 Item-driven thin kart (`itemKey` / `label` / `previewId`) |
| `test/previewIdConfig.test.js` | 60/60 `previewId`; type branch yok; CSS kök sınıf regression |
| `test/catalogDomainBoundary.test.js` | Catalog/AutoDepot/ModuleContract katman sınırı; `catalogVisible=false` ≠ Item yok |
| `test/catalogCategories.test.js` | Catalog modeli, key eşleşmesi, sıra/label/adet regression |
| `test/itemCatalogFields.test.js` | 106/106 Item alanları, CATALOG.md tablosu, UI `listCatalogGroups` |
| `test/itemSceneDimensions.test.js` | dimensions / sceneDimensions same-field fallback; catalogWidthCm yok; Recipe/Catalog dimension fallback yok |
| `test/catalogSingleSource.test.js` | Her katalog Item tam bir grupta |
| `test/systemModuleCatalogDoc.test.js` | `SYSTEM_MODULE_CATALOG.md` key snapshot |
| `e2e/smoke.spec.mjs` | `#open-module-catalog` |

---

## Kaynak dosyalar

- `src/catalog.js` — kategori/preview bootstrap + `getCatalogItem`, `listCatalogItems`, `listCatalogGroups`, `getCatalogPreview`, `getModuleCatalogItem`, `getModuleCatalogLabel`. İnce kart; `resolveSceneDimensions` yok.
- `src/catalogPreviewRenderer.js` — `createModuleCatalogPreview` (CSS silüet; eski `CATALOG_PREVIEW_RENDERERS` map yok)
- `src/items.js` — Item master; `previewId`; `dimensions` / `sceneDimensions`; `resolveSceneDimensions`; `resolveItemKey`
- `src/designState.js` — `createModuleStateFromDescriptor` Item’dan factory descriptor üretir
- `src/moduleDragSidebar.js` — sol katalog UI; `createModuleCatalogPreview` + `getCatalogPreview`
- `src/moduleContextMenu.js` — picker katalog UI
- `src/scene3d.js` — drag badge katalog önizlemesi (`getModuleCatalogItem` / `getModuleCatalogLabel`)
- `src/main.js` — `#open-module-catalog` bağlama
- `docs/refactor/CATALOG.md` — bu sözleşme
- `docs/refactor/ITEMS.md` — Item şeması
- `docs/refactor/REFACTOR.md` — günlük

---

## `src/catalog.js` dosya sınırı (2026-09-17)

Catalog işi: kategori tablosu + görünür Item projection + UI helper.

**Kalan Catalog yüzeyi:** `initializeCatalogCategories` / `listCatalogCategories` / `getCatalogCategory`, `initializeCatalogPreviews` / `listCatalogPreviews` / `getCatalogPreview`, `getCatalogItem`, `listCatalogItems`, `listCatalogGroups`, `getModuleCatalogItem`, `getModuleCatalogLabel`.

**Stand zarfı / düz duvar genişlikleri:** Catalog’un işi değildir. `docs/refactor/STAND_DIMENSIONS.md`.

**Silinen ölü export (runtime çağıran yoktu):** `COUNTER_DIMENSIONS`, furniture/TV/mini-fridge/coat-rack/trash `*_DIMENSIONS`, `flatPanelKey`, `getFurnitureClusterQuantity` catalog import.

**Silinen test alias:** `BASE_DIMENSIONS`, `LED_FLOODLIGHT_DIMENSIONS`, `SHELF_DIMENSIONS`. Ölçü `getItem(itemKey).dimensions`. `createShelfModule` `SHELF_DIMENSIONS` okumaz.

---

## Gelecek DB/API geçişi

Katalog UI ve canonical method’lar değişmemelidir. Item / Category / Preview kaynağı Fair Stand API bootstrap’tır; Catalog yine yalnız projeksiyondur.
