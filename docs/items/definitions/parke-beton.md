# parke-beton — Kanonik Item

Migration öncesi tam envanter (arşiv, normatif değil): `kyrox-platform/archive/fair-stand/docs-items/current-system/parke.md`.
Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md).

## Kimlik
Fair Stand ilişkisel Item store'daki `parke-beton` kaydı. `itemKey = parke-beton`. Name `Beton Parke`. Type `floor`. Plaka `120,6 × 40,2 cm` (Floorpan Stonex Gri Beton FT007). `defaultColor=#6b6762` (FT007 ürün görseline göre koyulaştırıldı). İkisi `0089_parquet_reference` ile yazıldı. `paintable=false`. Katalog/recipe/unit yok. Persist `stand.itemKey`; eski `floorType` hydrate. Render: kendi beton dokusu (`public/textures/floor/concrete-parquet-color.jpg`) 2,4 m tekrarla `defaultColor` ile çarpılır; her plaka dokunun farklı yerinden desen ve ±%6 ton alır. Plaka derzleri çizgiyle, sıralar yarım boy kaydırmalı çizilir. Roughness/emissive renderer temsilidir.
