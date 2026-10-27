# glass_shelf — Item Contract Definition

## Kanonik Item

- `itemKey`: `glass_shelf`
- `type`: `showcase-accessory`
- `unit`: `adet`
- dimensions: `87.3 × 28.5 × 0.6 cm` (`widthCm × depthCm × heightCm`)
- `material`: `cam`

## Sahiplik

Intrinsic ürün gerçeğinin tek kaynağı Fair Stand ilişkisel Item store'daki `glass_shelf` kaydı kaydıdır. Cam raf ayrı project entity değildir; yerleşim, move, rotation, snap/collision/connection, selection/drag, context menu, delete/duplicate/keyboard, kalıcılık ve reflow parent `showcase-2` / `showcase-3` module/type tarafından uygulanır.

`createShowcaseModule()` kanonik Item'dan `widthCm`, `depthCm`, `heightCm` ve `material` tüketir. `material=cam` ortak `GLASS_APPEARANCE` standardına çözülür. Normal cam görünümü product ölçüsü değildir; `theme.js` renderer appearance kaynağıdır. Masa camı `TABLE_GLASS_APPEARANCE` ile explicit specialized render ezme kullanır; panel camı ortak normal cam yüzeyine ek olarak panel-only `PANEL_GLASS_BACKING_APPEARANCE` backing efekti kullanır. Projektör lensi özel optik/emissive renderer olarak bu standardın dışındadır.

## BOM / bileşim

Tekil production Item'dır. Parent recipe quantity sahibidir:

- `showcase-2:100` → `glass_shelf × 2`
- `showcase-3:100` → `glass_shelf × 3`

Migration mevcut recipe miktarlarını değiştirmez. Renderer yalnız iç yatay divider cam mesh'lerini prosedürel üretir (`eyeCount - 1`); BOM miktarı renderer mesh adedinden türetilmez.

## Kalıcılık

Leaf `glass_shelf` ayrı persisted entity değildir. Parent showcase module yerleşim ve editable strip state'ini persist eder; kanonik product üstveri project snapshot'a ikinci tek kaynak olarak kopyalanmaz.

## Regresyon

`test/glassShelfItemContract.test.js` kanonik identity/property/recipe/renderer-tüketici contract'ını kilitler. `test/showcaseRecipes.test.js`, `test/showcaseDepthDirection.test.js`, `test/materialAppearance.test.js` ve full suite/E2E mevcut showcase ve cam görünüm davranışını korur.
