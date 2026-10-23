# profile_346_5 — Item Contract Definition

## 1. Kanonik kimlik
- `itemKey`: `profile_346_5`
- `name`: `Profil 346,5`
- `type`: `profile`
- `unit`: `adet`
- structure: Tekil Item
- parametric: hayır

## 2. Kanonik ürüne özgü özellikler
```js
{
  itemKey: 'profile_346_5',
  type: 'profile',
  unit: 'adet',
  dimensions: { widthCm: 346.5, depthCm: 8, heightCm: 8 },
  sceneDimensions: { widthCm: 350 },
  material: 'alüminyum',
}
```
Gerçek boy (BOM) 346,5 cm, sahnede 350 cm çizilir (`fair_stand_item_scene_dimensions`, kesit 10 × 10). Migration `0081_profile_346_5` ile eklenir: admin kaynaklı `profile_346_5_scene` varsa yeniden adlandırılır, yoksa `profile_388` satırından kopyalanır. Aynı migration `profile_X_scene` kartlarını (41,5 … 346,5) normal profillere çevirir; proje, revizyon ve şablon kayıtlarındaki anahtar da çevrilir.

## 3. Oluşturma / state / kalıcılık
Katalogda kartı yoktur; profil kartı (`profile_289`) bırakılırken boy penceresinden seçilir. Sahaya bırakılan her örnek ayrı instance'dır (`createProfileModuleState`); persist `itemKey` taşır.

## 4. Davranış / etkileşim
Katalog grubu `Panel Ek Modül`; saha davranışı diğer profillerle aynıdır (`profile_190.md` §4). Bırakırken boy penceresi açılır (`src/profileLength.js`: "Bir daha sorma, aynı ölçüde getir", localStorage `fairStand.profileLengthItemKey`); sağ tık **Profil boyu…** boyu değiştirir.

## 5. BOM / composition
Tekil production Item. Saha örneği `resolveItemBom` ile `profile_346_5 × 1 adet` üretir. Parent reçetelerde kullanılmaz.

## 6. Renderer sınırı
`is_render = true`; katalogda gizli, sahnede çizilir.

## 7. Regresyon sözleşmesi
`test/profileLength.test.js`, `backend/tests/modules/fair_stand/test_profile_346_5_migration.py`.
