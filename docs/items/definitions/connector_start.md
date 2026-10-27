# connector_start — Item Contract Migration

Bu belge `kyrox-platform/archive/fair-stand/docs-items/current-system/connector_start.md` (arşiv) içindeki migration öncesi kod haritasını `docs/items/contract/ITEM_CONTRACT.md` ve `ITEM_CONTRACT_CHECKLIST.md` ile eşler ve uygulanmış kanonik geçiş durumunu kaydeder.

Bu belge yeni behavior, relationship, quantity veya renderer kuralı icat etmez. Yalnız doğrulanmış mevcut runtime ile uygulanmış Item Contract migrationını kayıt altına alır.

## 1. Kimlik ve sınıflandırma

| Alan | Durum / değer |
|---|---|
| `itemKey` | `connector_start` |
| Ad | `Başlangıç Aparatı` |
| `type` | `connector` |
| Item yapısı | Tekil Item |
| Parametrik | Hayır |
| `unit` | `adet` |
| Item üstveri | `connectorType = start`  ⚠️ bayat: `connectorType` (2026-09-22 `2929fbf8`: `connector_type` kolonu kaldırıldı) |
| Proje örneği `id` | Uygulanmıyor |
| Oluşturucu / oluşturulma noktası | Uygulanmıyor; bağımsız proje örneği oluşturulmuyor |
| Catalog bağlantısı | Doğrudan catalog Item değildir; parent module recipe içinde production Item olarak kullanılır |

Migration öncesi gerçek production kimliği `partId = connector_start` idi. Migration ile aynı ürün kanonik `itemKey = connector_start` kimliğine taşındı; paralel ikinci ürün kimliği oluşturulmadı.

Kanonik runtime tanımı `src/items.js` içindedir:

```js
connector_start: Object.freeze({
  itemKey: 'connector_start',
  name: 'Başlangıç Aparatı',
  type: 'connector',
  unit: 'adet',
  connectorType: 'start'
})
```

## 2. State ve veri modeli

`connector_start` bağımsız proje Item örneği değildir.

Bu nedenle checklist karşılıkları:

- Örnek state: **uygulanmıyor**.
- Default project state: **uygulanmıyor**.
- Configurable project alanları: **uygulanmıyor**.
- Proje örneği `id`: **uygulanmıyor**.
- Child/alt state: **uygulanmıyor**.
- Persistent state: **uygulanmıyor**.
- Save/load migration: **uygulanmıyor**; connector ayrı state olarak kaydedilmez.

Production üstveri `src/items.js`; miktar parent Item kaydının `components` listesinde tutulur (`composition.items`).

## 3. Behavior

`connector_start` için bağımsız editor behavior örneği bulunmaz.

Aşağıdaki behavior alanları mevcut sistemde connector production Item seviyesinde **uygulanmıyor**:

- yerleşim,
- move/drag,
- rotation / rotation step / default rotation,
- collision,
- magnetic veya boundary snap,
- side insert,
- overlap,
- host capacity,
- ghost / preview.

`type = connector` production sınıflandırmasıdır; mevcut runtime'da bu Item için bağımsız scene behavior contract'ı oluşturmaz. Migration bu davranışları icat etmez.

## 4. Interaction

`connector_start` sahnede seçilebilir/taşınabilir bağımsız bir proje örneği değildir.

Bu nedenle aşağıdakiler **uygulanmıyor**:

- sol click selection,
- drag,
- sağ click/context menu,
- keyboard interaction,
- duplicate,
- delete.

Raw BOM debug UI bu Item'ı recipe çıktısında metin olarak gösterebilir; bu durum Item interaction kimliği anlamına gelmez.

## 5. Renderer

Mevcut sistemde `connector_start` için bağımsız renderer/mesh/asset identity yoktur.

Checklist karşılıkları:

- Renderer tipi: **uygulanmıyor**.
- Asset bağlantısı: **uygulanmıyor**.
- Renk/image/özel görsel modu: **uygulanmıyor**.
- Ghost renderer: **uygulanmıyor**.

Renderer production BOM tek kaynak değildir. Migration connector miktarını renderer geometrisinden türetmez.

## 6. Item ilişkileri

`connector_start` başka Item'lardan oluşmaz; kendisi Tekil Item'dır.

Mevcut doğrulanmış sistemde:

- child Item listesi: **yok**,
- parent-child project relationship: **yok**,
- persistent neighbor/connection relationship: **yok**,
- host/overlay relationship: **yok**,
- continuous chain/reflow: **yok**,
- relationship resolver: **yok / uygulanmıyor**,
- relationship-derived behavior: **yok**,
- relationship-derived BOM: **yok**.

`src/modulePlacement.js` içindeki geometrik `snapKind` değerleri ile `connector_start` production quantity arasında kanonik mapping yoktur. Migration böyle bir mapping uydurmaz.

## 7. BOM / production

`connector_start` aktif production/BOM Item'ıdır.

Kanonik üstveri sahibi:

```text
src/items.js
```

Kanonik parent quantity sahibi:

```text
src/moduleRecipes.js
```

Aktif recipe yolu:

```text
parent module recipe
→ { itemKey: 'connector_start', quantity: N }
→ expandRecipe()
→ getItem('connector_start')
→ quantity + unit=adet + production metadata
```

Migration sonrası `connector_start` **27/27 doğrulanmış recipe** içinde kanonik `itemKey` ile kullanılır; `partId` recipe occurrence kalmamıştır.

Doğrulanmış miktar dağılımı:

| Recipe ailesi | Recipe sayısı | Quantity |
|---|---:|---:|
| straight wall 50/100/150/200 | 4 | 2 |
| door 100 | 1 | 2 |
| shelf 100/150/200 × 2/3 raf | 6 | 2 |
| showcase 2/3 göz | 2 | 4 |
| separator 50/100 | 2 | 2 |
| L counter 100/150/200 | 3 | 8 |
| straight counter 100/150/200 | 3 | 6 |
| base-wall 100/150/200 | 3 | 6 |
| base 100/150/200 | 3 | 8 |

Toplam: **27 recipe**.

BOM checklist karşılıkları:

- BOM var mı?: **Evet**.
- BOM policy: parent module tarafında `mode = recipe`.
- Recipe kaynağı: parent Item `components` (`composition.items`); `src/moduleRecipes.js` yalnız `expandRecipe` genişletmesidir.

> **Bayat (2026-10-27 denetimi):** `moduleRecipes` (2026-09-17 `0db4af90`: ürün reçete tabloları silindi; `src/moduleRecipes.js` yalnız `expandRecipe` (composition.items)). Bu satır güncel kodla yeniden doğrulanmalı.
- Production lookup: `getItem()` / `src/items.js`.
- Alt Item listesi: **yok**; Tekil Item.
- Quantity: parent recipe tarafından açıkça verilir.
- Unit: `adet`.
- Recursive BOM: connector'ın kendisi için **uygulanmıyor**; nihai BOM kalemidir.
- Circular dependency: **uygulanmıyor**.
- Variant BOM: **yok**.
- State/ölçü/parametre kaynaklı BOM: **yok**.
- Relationship-derived BOM: **yok**.
- Final project BOM bağlantısı: project-level kanonik Final BOM resolver ayrı sistem işi olarak değerlendirilir; bu Item migrationı onu icat etmez.

## 8. Maliyet / fiyatlandırma ayrımı

`connector_start` tanımı ihtiyaç/miktar/birim bilgisini üretim tarafında taşır; birim fiyat veya satış fiyatı Item recipe içine gömülmez.

- BOM yalnız Item + quantity + unit üretir: **Evet**.
- Pricing kanonik production recipe'nin parçası mı?: **Hayır**.
- Birim fiyat değişikliği recipe quantity'yi değiştirmeli mi?: **Hayır**.

Bu migration pricing sistemi eklemez.

## 9. Uygulanan geçiş

- `src/items.js`: `partId` kaldırıldı; kanonik `itemKey = connector_start` oldu.
- `src/moduleRecipes.js`: 27/27 recipe kullanımı `{ itemKey: 'connector_start', quantity: N }` oldu.

> **Bayat (2026-10-27 denetimi):** `moduleRecipes` (2026-09-17 `0db4af90`: ürün reçete tabloları silindi; `src/moduleRecipes.js` yalnız `expandRecipe` (composition.items)). Bu satır güncel kodla yeniden doğrulanmalı.
- `getItem()` kanonik lookup olarak kullanılır.
- Tek kayıt lookup `getItem()`dır; `getProductionPart` / `getProductionItem` yoktur.
- Existing recipe quantity'leri değiştirilmedi.
- State, kalıcılık, behavior, interaction ve renderer'a yeni connector örnek mantığı eklenmedi.
- Yerleşim geometry'den connector quantity tahmin edilmedi.

## 10. Test ve kalite

Mevcut regression sözleşmesi şunları doğrular:

- `connector_start.itemKey === 'connector_start'`.
- `partId` kanonik production tanımında yoktur.
- `type === 'connector'`.
- `connectorType === 'start'`.

> **Bayat (2026-10-27 denetimi):** `connectorType` (2026-09-22 `2929fbf8`: `connector_type` kolonu kaldırıldı). Bu satır güncel kodla yeniden doğrulanmalı.
- `unit === 'adet'`.
- 27 recipe'nin tamamında identity `itemKey`dir.
- Migration sonrası recipe quantity aynı yapı korunur.
- Expanded recipe üstveriyi kanonik `itemKey` üzerinden çözer.
- Connector family mapping `start → connector_start` olarak çözülür.

State/behavior/interaction/kalıcılık testleri connector proje örneği'ı olmadığı için **uygulanmıyor**.

Browser tarafında Raw BOM mevcut expanded recipe yolunu tüketmeye devam eder; migration renderer veya UI quantity kuralı oluşturmaz.

## 11. Açık problemler / sınırlar

- `connector_start` miktarı mevcut sistemde parent recipe içinde sabittir; gerçek scene adjacency'den türetilmez.
- Yerleşim snap ilişkisi ile production connector quantity arasında kanonik relationship mapping yoktur.
- Project-level kanonik Final BOM sistemi bu Item definition'ın kapsamı değildir.
- Eski `getProductionPart()` / `getProductionItem()` yolu kaldırıldı; çözüm `getItem()`dır.

Bunlar migration sırasında tahminle kapatılmaz.

## Sonuç

```text
structure = Tekil Item
parametric = hayır
itemKey = connector_start
type = connector
connectorType = start
unit = adet
recipe identity cutover = 27/27
legacy recipe partId occurrence = 0
quantity ownership = parent Item components (composition.items)
production metadata ownership = src/items.js
project instance/state/persistence = uygulanmıyor
behavior/interaction/renderer identity = uygulanmıyor
relationship-derived quantity = yok; tahmin edilmez
```
