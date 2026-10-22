# upright_99 — Item Contract

## Kanonik kimlik
- `itemKey`: `upright_99`
- `name`: `Dikme 99`
- `type`: `upright`
- `unit`: `adet`
- structure: Tekil Item

## Kanonik ürüne özgü özellikler
- `dimensions.widthCm = 99`
- `dimensions.depthCm = 8`
- `material = 'alüminyum'`
- `defaultColor = 0xd0d3d4`

These values are product defaults owned by the Item. Explicit project/runtime/render ezmes may replace presentation where applicable without changing the kanonik default.

## Bileşim / BOM
Leaf BOM Item. Straight counter recipes `100/150/200` consume quantity `4`; L-counter recipes `100/150/200` consume quantity `5`. Parent recipes own quantity; Item owns product üstveri.

## Davranış / state / kalıcılık
Standalone yerleşim, move, rotation, snap/collision, selection, context-menu, delete/duplicate, oluşturucu, kalıcılık and reflow are `UYGULANMIYOR`. Parent counter runtime owns those yetenekler.

## Renderer ezme sınırı
Renderer creates prosedürel counter posts and does not use `upright_99` as mesh identity. Production dimensions/material/defaultColor remain Item truth; specialized renderer geometry/material/color may explicitly ezme presentation.

## Regresyon sözleşmesi
`test/upright99And495ItemContract.test.js` protects kanonik identity/dimensions and six recipe quantities. `test/uprightIntrinsicProperties.test.js` protects `material='alüminyum'` and `defaultColor=0xd0d3d4`.

## Tamamlanma
Kanonik product contract is complete for the currently doğrulanmış system. No renderer/state/kalıcılık migration is introduced by this property decision.
