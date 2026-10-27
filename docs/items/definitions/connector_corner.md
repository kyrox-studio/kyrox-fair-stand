# connector_corner — Item Contract Migration

Bu belge `kyrox-platform/archive/fair-stand/docs-items/current-system/connector_corner.md` (arşiv) içindeki migration öncesi kod haritasını Item Contract'a map eder ve uygulanmış kanonik geçiş durumunu kaydeder.

## 1. Kanonik kimlik

| Alan | Değer |
|---|---|
| `itemKey` | `connector_corner` |
| Ad | `Köşe Aparatı` |
| `type` | `connector` |
| Item yapısı | Tekil Item |
| Parametrik | Hayır |
| `unit` | `adet` |
| Metadata | `connectorType = corner`  ⚠️ bayat: `connectorType` (2026-09-22 `2929fbf8`: `connector_type` kolonu kaldırıldı) |
| Proje örneği | Uygulanmıyor |
| Renderer identity | Uygulanmıyor |

Migration öncesi stabil kimlik `partId = connector_corner` idi. Cutover ile aynı ürün kimliği kanonik `itemKey = connector_corner` alanına taşındı.

## 2. Fixed parent recipe kullanımı

Mevcut çalışan sistemde `connector_corner` hiçbir sabit `moduleRecipes` parent reçetesinde yer almıyor. Bu durum migration eksiği değildir; bu Item için fixed parent recipe kullanımı bugün **uygulanmıyor**.

> **Bayat (2026-10-27 denetimi):** `moduleRecipes` (2026-09-17 `0db4af90`: ürün reçete tabloları silindi; `src/moduleRecipes.js` yalnız `expandRecipe` (composition.items)). Bu satır güncel kodla yeniden doğrulanmalı.

Migration mevcut reçetelere tahmini corner quantity eklemez.

## 3. Kanonik BOM çözümü

`connector_corner` kanonik Tekil production Item'dır. `src/items.js` içindeki mevcut `resolveConnectorBom()` resolver'ı açıkça verilen `corner + quantity` girdisini kanonik Item satırına çözer:

> **Bayat (2026-10-27 denetimi):** `resolveConnectorBom` (kodda yok (2026-09-22 `2929fbf8` sonrası); BOM `src/itemBom.js` `resolveItemBom`). Bu satır güncel kodla yeniden doğrulanmalı.

```text
connectorType = corner + quantity
→ itemKey = connector_corner
→ quantity
→ unit = adet
```

Resolver quantity veya yerleşim mapping'i tahmin etmez; quantity çağıran tarafından açıkça verilmek zorundadır.

Mevcut yerleşim motorundaki transient `snapKind = corner` geometrik kavramı ayrı bir şeydir. Çalışan kodda bu değer otomatik olarak `connector_corner` quantity'sine çevrilmediği için migration böyle bir kural icat etmez.

Bu Item'ın migration completion'ı sahnede ayrı mesh olarak görünmesine veya mevcut bir parent reçetede zorunlu olarak kullanılmasına bağlı değildir.

## 4. State / kalıcılık / davranış / renderer

Mevcut sistemde bağımsız `connector_corner` proje örneği/state/kalıcılık/behavior/mesh identity bulunmadığı için bu alanlar **uygulanmıyor**. Migration bunları icat etmez.

## 5. Uygulanan geçiş

- `src/items.js`: kanonik `itemKey = connector_corner`.
- `connectorType = corner` kanonik Item kimliğine çözülür.

> **Bayat (2026-10-27 denetimi):** `connectorType` (2026-09-22 `2929fbf8`: `connector_type` kolonu kaldırıldı). Bu satır güncel kodla yeniden doğrulanmalı.
- `resolveConnectorBom()` explicit quantity ile `itemKey + quantity + unit` BOM satırı üretir.

> **Bayat (2026-10-27 denetimi):** `resolveConnectorBom` (kodda yok (2026-09-22 `2929fbf8` sonrası); BOM `src/itemBom.js` `resolveItemBom`). Bu satır güncel kodla yeniden doğrulanmalı.
- Fixed parent recipe kullanımı yoktur; bu alan mevcut sistem için uygulanmıyor.
- Mevcut reçetelere tahmini corner quantity eklenmez.

## 6. Regresyon sözleşmesi

Testler şunları doğrular:

- kanonik kimlik `itemKey`dir; `partId` yoktur.
- `connectorType = corner` doğru Item'a çözülür.

> **Bayat (2026-10-27 denetimi):** `connectorType` (2026-09-22 `2929fbf8`: `connector_type` kolonu kaldırıldı). Bu satır güncel kodla yeniden doğrulanmalı.
- resolver explicit quantity ile gerçek `connector_corner` BOM satırı üretir.
- quantity eksik/0 ise fail eder.
- mevcut fixed module recipes içine yanlışlıkla `connector_corner` eklenmez.

## Sonuç

```text
structure = Tekil Item
parametric = hayır
itemKey = connector_corner
unit = adet
canonical BOM resolver = VAR
fixed parent recipe kullanımı = UYGULANMIYOR
state/persistence/behavior/renderer = UYGULANMIYOR
migration status = TAMAM
```
