# profile_487 — Item Contract Definition

## 1. Kanonik kimlik
- `itemKey`: `profile_487`
- `name`: `Profil 487`
- `type`: `profile`
- `unit`: `adet`
- structure: Tekil Item
- parametric: hayır

## 2. Kanonik ürüne özgü özellikler
```js
{
  itemKey: 'profile_487',
  type: 'profile',
  unit: 'adet',
  dimensions: { widthCm: 487, depthCm: 8, heightCm: 8 },
  sceneDimensions: { widthCm: 500 },
  material: 'alüminyum',
}
```
Gerçek boy (BOM) 487 cm, sahnede 500 cm çizilir (`fair_stand_item_scene_dimensions`, kesit 10 × 10). Ölçüler migration `0078_profile_lengths` ile yazılır; diğer alanlar `profile_190` satırından kopyalanır.

## 3. Oluşturma / state / kalıcılık
Katalogda kartı yoktur; profil kartı (`profile_289`) bırakılırken boy penceresinden seçilir. Sahaya bırakılan her örnek ayrı instance'dır (`createProfileModuleState`); persist `itemKey` taşır.

## 4. Davranış / etkileşim
Katalog grubu `Panel Ek Modül`; saha davranışı diğer profillerle aynıdır (`profile_190.md` §4). Bırakırken boy penceresi açılır (`src/profileLength.js`: "Bir daha sorma, aynı ölçüde getir", localStorage `fairStand.profileLengthItemKey`); sağ tık **Profil boyu…** boyu değiştirir.

## 5. BOM / composition
Tekil production Item. Saha örneği `resolveItemBom` ile `profile_487 × 1 adet` üretir. Parent reçetelerde kullanılmaz.

## 6. Renderer sınırı
`is_render = true`; katalogda gizli, sahnede çizilir.

## 7. Regresyon sözleşmesi
`test/profileLength.test.js`, `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`.

## Parça bölünüşü (2026-10-22, migration `0080_item_length_parts`)
Üretim listesinde satır tek kalır, adın yanına bölünüş yazılır: 346,5 + 140,5 (`upright_346_5` + `profile_140_5`). Kaynak `fair_stand_item_length_parts` (sıralı); BOM miktarı, reçete ve maliyet değişmez (`src/items.js > formatItemLengthParts`).
