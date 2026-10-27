# video_wall_panel — Kanonik Item

Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md).

## Kimlik, özellikler ve ölçüler
Kanonik kayıt Fair Stand ilişkisel Item store'undadır (catalog bootstrap; [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md) §2). `itemKey = video_wall_panel`. `catalogVisible=false`. `name = Video Wall Panel`. `type = video-wall-panel` (ayrı factory/behavior yok; yerleştirilmez). Fiziksel panel: `dimensions.widthCm=108.5`, `dimensions.heightCm=61`. `depthCm` mevcut sistemde panel kaynağı olarak yok; yazılmadı. Unit/BOM tahmini yok.

## Parent ilişki
`video_wall_2x2` ve `video_wall_3x3` `videoWall.panelItemKey = 'video_wall_panel'` taşır. `rows` / `cols` parent’ta kalır. Panel genişlik/yükseklik parent `videoWall` içinde kopyalanmaz.

## Tüketiciler
`resolveWallMediaMetrics` ve `src/scene3d.js` `createTvModule` panel ölçüsünü `getItem(panelItemKey).dimensions` üzerinden okur. Catalog kartı yoktur.
