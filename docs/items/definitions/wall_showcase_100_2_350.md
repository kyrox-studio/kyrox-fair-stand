# wall_showcase_100_2_350

## Kanonik Item

- `itemKey`: `wall_showcase_100_2_350`
- `type`: `showcase-2`
- `unit`: `adet`
- `dimensions.widthCm`: `100`
- `eyeCount`: `2`
- Bileşik Item / Item kümesi; `showcase_2_100` diye arada aggregate Item yoktur.

## BASE composition

- `profile_91 ×4`
- `upright_346_5 ×2`
- `panel_98 ×5`
- `connector_start ×4`
- `connector_single ×9`
- `showcase_side_94_6_30 ×2`
- `showcase_horizontal_87_4_30 ×2`
- `glass_shelf ×1`

## Inner-corner composition

`panelVariant: 'inner-corner'` recipe context'i verildiğinde doğrulanmış köşe BOM'u kanonik recipe üzerinden çözülür:

- `panel_98 ×5 → panel_corner_92 ×5`
- `connector_start ×4` değişmez
- `connector_single ×9 → connector_single ×5 + connector_corner ×4`
- Diğer BASE child Item miktarları değişmez.

Bu varyant `wall_showcase_100_2_350` kanonik parent Item'ının aynı recipe zinciridir; ayrı `showcase_2_100` aggregate Item oluşturulmaz. Relationship bilgisinden `panelVariant` context'inin otomatik üretilmesi bu Item'a özel olarak eklenmemiştir.

## Runtime sahipliği

- Catalog key ve kanonik Item identity aynıdır: `wall_showcase_100_2_350`.
- `showcase-2` tip davranışı `fair_stand_item_type` kaydından gelir (`src/moduleBehavior.js` `getModuleBehavior`, DB bootstrap `itemTypes`; seed `backend/app/modules/fair_stand/infrastructure/item_type_behavior_seed.py`): `placement=wall`, `collision=segment`, 10 cm snap; yerleşim/move/snap/collision/reflow motoru ortaktır. Sahne Z Item kolonlarıdır (`docs/refactor/ROTATION.md`).
- State kanonik `itemKey` + `eyeCount` taşır.
- `bodySurface` tek project-örnek color ezme'dır; iki yan + iki yatay sunta birlikte renklenir. Alt showcase-board Items ayrı ayrı editable değildir.
- Default body color child Items'dan `0xffffff` gelir.
- `glass_shelf` bu renk ezmesinden etkilenmez.
- Renderer board ölçülerini kanonik child Items'dan okur ve yalnız kanonik gövde board'ları ile `glass_shelf` geometrisini gösterir; BOM'da olmayan sahte beyaz ön kenar/çerçeve mesh'i eklemez.
- Eski persisted showcase state load sırasında kanonik `wall_showcase_100_2_350` identity/bodySurface'a normalize edilir.
