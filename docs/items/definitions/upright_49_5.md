# upright_49_5 — Item Contract

## Kanonik kimlik
- `itemKey`: `upright_49_5`
- `name`: `Dikme 49,5`
- `type`: `upright`
- `unit`: `adet`
- yapı: Tekil Item

## Kanonik ürüne özgü özellikler
- `dimensions.widthCm = 49.5`
- `dimensions.depthCm = 8`
- `material = 'alüminyum'`
- `defaultColor = 0xd0d3d4`

Bu değerler Item'ın sahip olduğu ürün varsayılanlarıdır. Açık proje/runtime/render ezmeleri, kanonik varsayılanı değiştirmeden görünümü değiştirebilir.

## Bileşim / BOM
Yaprak BOM Item. `base:100/150/200` miktar `4` tüketir. Miktar üst recipe'nindir; ürün üstverisi Item'ındır.

## Davranış / state / kalıcılık
Bağımsız yerleşim, move, rotation, snap/collision, selection, context-menu, delete/duplicate, oluşturucu, kalıcılık ve reflow `UYGULANMIYOR`. Bu yetenekler üst baza / baza-duvar runtime'ındadır.

## Renderer ezme sınırı
Renderer prosedürel baza / baza-duvar dikmeleri üretir; mesh kimliği olarak `upright_49_5` kullanmaz. Üretim ölçü/malzeme/defaultColor Item gerçeğidir; özel renderer geometri/malzeme/renk görünümü açıkça ezebilir.

## Regresyon sözleşmesi
`test/upright99And495ItemContract.test.js` kanonik kimlik/ölçü ve üç base recipe miktarını korur. `test/uprightIntrinsicProperties.test.js` `material='alüminyum'` ve `defaultColor=0xd0d3d4` değerlerini korur.

## Tamamlanma
Kanonik ürün sözleşmesi, şu an doğrulanmış sistem için tamamdır. Bu özellik kararı renderer/state/kalıcılık migration'ı eklemez.
