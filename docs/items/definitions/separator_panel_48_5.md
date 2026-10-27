# separator_panel_48_5 — Item Contract Definition

## Kanonik kimlik
| Alan | Değer |
|---|---|
| `itemKey` | `separator_panel_48_5` |
| `name` | `Separatör Paneli 48,5 × 47 cm` |
| `type` | `separator-panel` |
| `unit` | `adet` |
| Yapı | Tekil Item |
| Parametrik | Hayır |

## Kanonik ürüne özgü özellikler
```text
widthCm = 48.5
heightCm = 47
depthCm = 0.8
material = mdf
defaultColor = 0xc79b63
```

`material = mdf` ürün kararı kullanıcı tarafından doğrulanmıştır. `defaultColor = 0xc79b63`, mevcut separator-specific runtime default renginin kanonik Item karşılığıdır.

## Varsayılan state tüketicisi
Leaf Item bağımsız proje örneği değildir. Parent `separator` state'i oluşturulurken `src/designState.js#createSeparatorModuleState(50)` kanonik Item `defaultColor` değerini okur ve UI/render state formatı olan `#c79b63` değerine dönüştürür.

Ayrı renk sabiti yoktur; renk Item `default_color` alanındadır (`#c79b63`, DB).

## Bileşim / BOM
`separator_panel_48_5` nihai fiziksel BOM Item'ıdır ve başka Item'lardan oluşmaz.

```text
separator:50 → separator_panel_48_5 × 7
```

Quantity owner parent Item kaydının `components` listesidir (`composition.items`); BOM `src/itemBom.js` `resolveItemBom(itemKey)`. Recipe identity kanonik `itemKey` üzerinden çözülür.

## Davranış / state / kalıcılık sahipliği
Yerleşim, move, rotation, snap, collision, connection, selection, context-menu, delete/duplicate ve kalıcılık leaf Item davranışı değildir. Bunlar parent `separator` module/state katmanında yürür. `separator` tipinin davranışı `fair_stand_item_type` kaydındadır: `wall` yerleşim, `segment` çarpışma, 10 cm snap.

## Renderer / ezme sınırı
`src/scene3d.js#createSeparatorModule()` prosedürel separator geometrisini üretir ve `surfaceState.color` tüketir. Renderer production ölçülerini geometry tek kaynak olarak okumak zorunda değildir; specialized render geometry ayrı ezme sınırıdır.

Kullanıcı/runtime renk değişikliği açık state ezme'ıdır ve kanonik `defaultColor` değerini değiştirmez.

## Regresyon sözleşmesi
`test/separatorPanelsItemContract.test.js` şunları kilitler:
- kanonik `itemKey`, type/unit ve `partId` yokluğu,
- `48.5 × 47 × 0.8 cm`,
- `material = mdf`,
- `defaultColor = 0xc79b63`,
- parent separator state'in kanonik Item default rengini tüketmesi,
- `separator:50` quantity `×1`,
- expanded recipe üstveri eşyapı.

## Tamamlanma
Bu Item için doğrulanmış ürüne özgü/default property'ler kanonik Item içindedir ve mevcut default-state tüketici kanonik kaynağı kullanır. Renderer/state ezme sınırı korunur.
