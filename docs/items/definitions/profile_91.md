# profile_91 — Item Contract Definition

## 1. Kanonik kimlik
- `itemKey`: `profile_91`
- `name`: `Profil 91`
- `type`: `profile`
- `unit`: `adet`
- structure: Tekil Item
- parametric: hayır

## 2. Kanonik ürüne özgü özellikler
```js
{
  itemKey: 'profile_91',
  type: 'profile',
  unit: 'adet',
  dimensions: { widthCm: 91, depthCm: 8, heightCm: 8 },
  material: 'alüminyum',
  defaultColor: 0xd0d3d4
}
```
`widthCm`, `depthCm`, `heightCm`, `material` ve `defaultColor` kanonik product/default property'leridir; owner `src/items.js`dir. Project/runtime ezme açık bir karar mekanizmasıyla uygulanabilir ve kanonik değeri değiştirmez. `src/theme.js`/`scene3d.js` specialized renderer ezme kullanabilir.

## 3. Oluşturma / state / kalıcılık
Katalogda kartı yoktur (2026-10-22, migration `0078_profile_lengths`): profil kartı (`profile_289`) bırakılırken boy penceresinden seçilir. Sahaya konan her örnek ayrı instance'dır (`createProfileModuleState`). Parent reçete satırları ayrı kalır; persist parent module ile birlikte `itemKey` taşır.

## 4. Davranış / etkileşim
Katalog grubu `Panel Ek Modül`. Saha davranışı `wall_200_350` ile aynıdır (`profile` tip davranışı `fair_stand_item_type`: `placement=wall`, `collision=segment`, 10 cm snap; taşıma, döndürme, uç uca/köşe snap). Duvar gövdesinin içine girmez. Aynı duvar yuvasındaki `separator` (ahşap slat) üst rayı engellemez (`overlapWithTypes: separator`). Saha dikmesi (`upright`) profil uçlarına `short-up-joint` ile snap olur.

## 5. BOM / composition
Tekil production Item; 12 doğrulanmış parent recipe (wall/door/shelf/showcase/separator/counter/L-counter/base/base-wall). Recipe identity kanonik `itemKey` kullanır, quantity parent recipe sahibidir, expansion üstveriyi `getItem()` üzerinden çözer. Saha örneği `resolveItemBom` ile `profile_91 × 1 adet` üretir; parent reçetelere otomatik eklenmez.

## 6. Renderer sınırı
Production ölçü ve üstveri business tek kaynak'tur; prosedürel renderer production profile mesh identity'sine zorla bağlanmaz. `defaultColor=0xd0d3d4` kanonik default; renk Item `default_color` alanındadır (DB); ayrı render renk sabiti `ALUMINUM_PROFILE_COLOR` 2026-09-25 `6bf223b9` ile kalktı.

## 7. Regresyon sözleşmesi
Regression `itemKey`, `type`, `unit`, `91 × 8 cm`, `material='alüminyum'`, `defaultColor=0xd0d3d4`, 12 parent recipe eşyapı ve kanonik expansion'ı korur.

## Sonuç
```text
canonical Item             TAMAM
intrinsic properties       TAMAM
material                   alüminyum
defaultColor               0xd0d3d4
recipe/BOM                 TAMAM
leaf state/persistence     UYGULANMIYOR
leaf behavior/interactions UYGULANMIYOR
renderer override boundary TAMAM
regression                 TAMAM
```
