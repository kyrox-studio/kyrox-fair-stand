# upright_396 — Item Contract

## Kanonik kimlik
- `itemKey`: `upright_396`
- `name`: `Dikme 396 cm`
- `type`: `upright`
- `unit`: `adet`
- structure: Tekil Item, katalogda gizli

## Kanonik ürüne özgü özellikler
- `dimensions.heightCm = 396` (gerçek boy, ürün tablosu)
- `sceneDimensions.heightCm = 400` (yeni eklenen veritabanında; bu Item migration öncesi varsa mevcut değer korunur)
- Duvar yüksekliği eşlemesi gerçek boydan: gerçek boy = duvar yüksekliği × 0,99
- `dimensions.widthCm = 8`, `dimensions.depthCm = 8`
- `material` ve `defaultColor` `upright_346_5` ile aynı

## Bileşim / BOM
Leaf BOM Item. 400 cm düz duvarda (`wall_*_400`, `0068` kuralıyla türetilir) `upright_346_5` yerine 2 adet; yan yana / köşe / T ekleminde 1 adet düşer. Fiyat atanmadı.

## Regresyon sözleşmesi
`test/wallHeightRecipe.test.js`, `test/wallHeightRelationshipBom.test.js`, `e2e/wall-height.spec.mjs`.

## Parça bölünüşü (2026-10-22, migration `0079_item_length_parts`)
Üretim listesinde satır tek kalır, adın yanına bölünüş yazılır: 346,5 + 49,5 (`upright_346_5` + `upright_49_5`). Kaynak `fair_stand_item_length_parts` (sıralı); BOM miktarı, reçete ve maliyet değişmez (`src/items.js > formatItemLengthParts`).
