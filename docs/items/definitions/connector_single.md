# connector_single — Item Contract Migration

Bu belge `kyrox-platform/archive/fair-stand/docs-items/current-system/connector_single.md` (arşiv) içindeki migration öncesi kod haritasını Item Contract'a map eder ve uygulanan geçiş durumunu kaydeder.

## 1. Kanonik kimlik

| Alan | Değer |
|---|---|
| `itemKey` | `connector_single` |
| Ad | `Tekli Aparat` |
| `type` | `connector` |
| Item yapısı | Tekil Item |
| Parametrik | Hayır |
| `unit` | `adet` |
| Metadata | `connectorType = single`  ⚠️ bayat: `connectorType` (2026-09-22 `2929fbf8`: `connector_type` kolonu kaldırıldı) |
| Proje örneği | Uygulanmıyor |
| Renderer / yerleşim identity | Uygulanmıyor |

Migration öncesi stabil kimlik `partId = connector_single` idi. Cutover ile aynı ürün kimliği `itemKey` alanına taşındı; paralel ikinci ürün kimliği üretilmedi.

## 2. Mevcut recipe sahipliği

`connector_single` mevcut çalışan sistemde 27 recipe'nin tamamında sabit miktarlı production kalemidir. Miktarların kanonik sahibi parent Item kayıtlarının `components` listesidir (`composition.items`); BOM `src/itemBom.js` `resolveItemBom(itemKey)`.

Migration miktarları değiştirmez; yalnız recipe kimlik alanını `partId` → `itemKey` olarak taşır.

## 3. BOM

Aktif recipe yolu:

```text
module recipe
→ { itemKey: 'connector_single', quantity: N }
→ expandRecipe()
→ getItem('connector_single')
→ quantity + unit=adet + production metadata
```

`connector_single` için yeni ilişki veya renderer kaynaklı miktar hesabı eklenmez. Mevcut recipe miktarları tek kaynak olarak korunur.

## 4. State / kalıcılık / renderer

Mevcut sistemde bağımsız `connector_single` proje örneği/state/kalıcılık/mesh identity bulunmadığı için migration bunları icat etmez.

## 5. Uygulanan geçiş

- `src/items.js`: kanonik `itemKey = connector_single`.
- `src/moduleRecipes.js`: 27/27 recipe kullanımı `itemKey` oldu.

> **Bayat (2026-10-27 denetimi):** `moduleRecipes` (2026-09-17 `0db4af90`: ürün reçete tabloları silindi; `src/moduleRecipes.js` yalnız `expandRecipe` (composition.items)). Bu satır güncel kodla yeniden doğrulanmalı.
- Tek kayıt lookup `getItem()`dır; eski `getProductionPart` / `getProductionItem` yoktur.
- Diğer production Item'lar bu migration nedeniyle topluca `itemKey`e geçirilmez.
- Recipe quantity aynı yapı korunur.

## 6. Regresyon sözleşmesi

Testler şunları doğrular:

- 27 recipe'nin tamamında `connector_single` yalnız `itemKey` ile bulunur.
- `partId` taşımaz.
- Miktarlar migration öncesi değerlerle aynıdır.
- Expanded recipe production üstveriyi çözmeye devam eder.
- Komşu, henüz migrate edilmemiş recipe Item'ları yanlışlıkla `itemKey`e geçmez.

## Sonuç

```text
structure = Tekil Item
parametric = hayır
itemKey = connector_single
unit = adet
recipe identity cutover = 27/27
quantity ownership = parent Item components (composition.items)
state/persistence/renderer identity = yok
```
