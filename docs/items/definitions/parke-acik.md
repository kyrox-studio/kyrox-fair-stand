# parke-acik — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/parke.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md).

## Kimlik
Fair Stand ilişkisel Item store'daki `parke-acik` kaydı. `itemKey = parke-acik`. Name `Beyaz Meşe` (mevcut select metni). Type `floor`. Lamel `140 × 16 cm` (1.40 m × 0.16 m). `defaultColor=#c9cac5` (Floorpan Classic Kristal Meşe FC086 görselinin ortalaması; `0089_parquet_reference`). `paintable=false`. Katalog/recipe/unit yok.

## Render
Ortak meşe dokusu (`public/textures/floor/oak-*`, CC0) `defaultColor` ile çarpılır; dokunun bir tekrarı 8 lamel sırasıdır ve lamel genişliği `depthCm`den gelir. Derzler dokudadır, çizgi çizilmez.

## Kalıcılık
Persist `stand.itemKey`. Eski `floorType` hydrate. Parke tek `parke` değeri değildir.
