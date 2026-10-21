> **TARİHÎ ENVANTER.** Güncel sistem değildir. Aktif kanonik tanım `docs/items/definitions/` (veya `src/items.js`). Gövdedeki `catalogKey` / `DEPOT_*` / `floorType` tarihî örnektir; runtime kimliği `itemKey`.

# wall_showcase_100_3

## Kanonik Item

- `itemKey`: `wall_showcase_100_3`
- `type`: `showcase-3`
- `unit`: `adet`
- `dimensions.widthCm`: `100`
- `eyeCount`: `3`
- Bileşik Item / Item kümesi; `showcase_3_100` diye arada aggregate Item yoktur.

## BASE composition

- `profile_91 ×4`
- `upright_346_5 ×2`
- `panel_98 ×4`
- `connector_start ×4`
- `connector_single ×7`
- `showcase_side_143_5_30 ×2`
- `showcase_horizontal_87_4_30 ×2`
- `glass_shelf ×2`

## Inner-corner composition

`panelVariant: 'inner-corner'` recipe context'i verildiğinde doğrulanmış köşe BOM'u kanonik recipe üzerinden çözülür:

- `panel_98 ×4 → panel_corner_92 ×4`
- `connector_start ×4` değişmez
- `connector_single ×7 → connector_single ×5 + connector_corner ×4`
- Diğer BASE child Item miktarları değişmez.

Bu varyant `wall_showcase_100_3` kanonik parent Item'ının aynı recipe zinciridir; ayrı `showcase_3_100` aggregate Item oluşturulmaz. Relationship bilgisinden `panelVariant` context'inin otomatik üretilmesi bu Item'a özel olarak eklenmemiştir.

## Runtime ownership

- Catalog key ve kanonik Item identity aynıdır: `wall_showcase_100_3`.
- Shared `WALL_BEHAVIOR` placement/move/rotation/snap/collision/reflow motoru korunur.
- State kanonik `itemKey` + `eyeCount` taşır.
- `bodySurface` tek project-instance color override'dır; iki yan + iki yatay sunta birlikte renklenir. Child showcase-board Items ayrı ayrı editable değildir.
- Default body color child Items'dan `0xffffff` gelir.
- `glass_shelf` bu renk override'ından etkilenmez.
- Renderer board ölçülerini kanonik child Items'dan okur ve yalnız kanonik gövde board'ları ile `glass_shelf` geometrisini gösterir; BOM'da olmayan sahte beyaz ön kenar/çerçeve mesh'i eklemez.
- Legacy persisted showcase state load sırasında kanonik `wall_showcase_100_3` identity/bodySurface'a normalize edilir.

## Renderer görünümü (2026-10-21)

`createShowcaseModule()` çerçevesi duvar paneliyle aynıdır (`addPanelModuleFrame`, kanallı profil, reçetedeki `profile_*` sahne kesiti). Paneller profil yüzünün 15 mm önünde ve dört yanda 4 cm içeride. Vitrin gövdesinin yüksekliğinde dikme çizilmez (`uprightGap`); orada gövdenin yan tahtaları kenar olur. Yalnız görünüm; state ve BOM değişmez.
