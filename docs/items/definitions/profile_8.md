# profile_8 — Item Contract Definition

## 1. Kanonik kimlik
- `itemKey`: `profile_8`
- `name`: `Profil 8`
- `type`: `profile`
- `unit`: `adet`
- structure: Tekil Item
- parametric: hayır

## 2. Kanonik ürüne özgü özellikler
```js
{
  itemKey: 'profile_8',
  type: 'profile',
  unit: 'adet',
  dimensions: { widthCm: 8, depthCm: 8, heightCm: 8 },
  material: 'alüminyum',
}
```
Migration `0080_item_length_parts` ile `profile_190` satırından kopyalanır; boy 8 cm.

## 3. Kullanım
Yalnız uzun parça bölünüşünün parçasıdır: `upright_495` = 346,5 + 8 + 140,5. Katalogda kartı yoktur, sahnede çizilmez (`is_render = false`), profil boy penceresinde listelenmez.

## 4. BOM / composition
Kendi başına BOM satırı üretmez; bölünüş yalnız etikettir (`fair_stand_item_length_parts`). Uzun parçanın BOM satırı tek kalır.

## 5. Regresyon sözleşmesi
`test/itemLengthParts.test.js`, `backend/tests/modules/fair_stand/test_item_length_parts_migration.py`.
