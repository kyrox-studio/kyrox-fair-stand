# upright_247_5 — Item Contract

## Kanonik kimlik
- `itemKey`: `upright_247_5`
- `name`: `Dikme 247,5`
- `type`: `upright`
- `unit`: `adet`
- structure: Tekil Item, katalogda gizli

## Kanonik ürüne özgü özellikler
- `dimensions.heightCm = 247.5` (gerçek boy, ürün tablosu)
- `sceneDimensions.heightCm = 250` (duvar yüksekliği)
- `dimensions.widthCm = 8`, `dimensions.depthCm = 8`
- `material` ve `defaultColor` `upright_346_5` ile aynı

## Bileşim / BOM
Leaf BOM Item. 250 cm düz duvarda (`wall_*_250`, `0068` kuralıyla türetilir) `upright_346_5` yerine 2 adet; yan yana / köşe / T ekleminde 1 adet düşer. Fiyat atanmadı.

## Regresyon sözleşmesi
`test/wallHeightRecipe.test.js`, `test/wallHeightRelationshipBom.test.js`, `e2e/wall-height.spec.mjs`.
