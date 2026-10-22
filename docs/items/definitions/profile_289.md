# profile_289 — Item Contract Definition

## 1. Kanonik kimlik
- `itemKey`: `profile_289`
- `name`: `Profil 289`
- `type`: `profile`
- `unit`: `adet`
- structure: Tekil Item
- parametric: hayır

## 2. Kanonik ürüne özgü özellikler
```js
{
  itemKey: 'profile_289',
  type: 'profile',
  unit: 'adet',
  dimensions: { widthCm: 289, depthCm: 8, heightCm: 8 },
  sceneDimensions: { widthCm: 300 },
  material: 'alüminyum',
}
```
Gerçek boy (BOM) 289 cm, sahnede 300 cm çizilir (`fair_stand_item_scene_dimensions`, kesit 10 × 10). Ölçüler migration `0078_profile_lengths` ile yazılır; diğer alanlar `profile_190` satırından kopyalanır.

## 3. Oluşturma / state / kalıcılık
Katalogdaki tek profil kartıdır (dikmedeki `upright_346_5` gibi); bırakılırken boy sorulur ve seçilen boyun `itemKey`'iyle kaydedilir. Sahaya bırakılan her örnek ayrı instance'dır (`createProfileModuleState`); persist `itemKey` taşır. Admin ekranında açılmış `profile_289_scene` kartı migration `0078` ile bu anahtara çevrildi; tarayıcıda kayıtlı eski projeler açılırken `designState.js > LEGACY_PROFILE_ITEM_KEYS` ile çevrilir.

## 4. Davranış / etkileşim
Katalog grubu `Panel Ek Modül`; saha davranışı diğer profillerle aynıdır (`profile_190.md` §4). Bırakırken boy penceresi açılır (`src/profileLength.js`: "Bir daha sorma, aynı ölçüde getir", localStorage `fairStand.profileLengthItemKey`); sağ tık **Profil boyu…** boyu değiştirir.

## 5. BOM / composition
Tekil production Item. Saha örneği `resolveItemBom` ile `profile_289 × 1 adet` üretir. Parent reçetelerde kullanılmaz.

## 6. Renderer sınırı
`is_render = true`; katalogda görünür (tek kart), sahnede çizilir.

## 7. Regresyon sözleşmesi
`test/profileLength.test.js`, `backend/tests/modules/fair_stand/test_profile_lengths_migration.py`.
