# panel_147_5 — Item Contract Definition

## Kanonik Item

- `itemKey`: `panel_147_5`
- `type`: `panel`
- `unit`: `adet`
- dimensions: `147.5 × 47 × 0.8 cm`
- `material`: `sunta`
- `panelRole`: `straight`
- `defaultColor`: ürün default'u doğrulanmadığı için tanımlı değil; editor `#ffffff` değeri ezme/default-surface katmanıdır.

## Sahiplik

Intrinsic ürün gerçeğinin tek kaynağı Fair Stand ilişkisel Item store'daki `panel_147_5` kaydı kaydıdır. State, yerleşim, move, rotation, snap, collision, selection, context-menu, delete/duplicate ve kalıcılık parent module/type tarafından uygulanır. Renderer specialized ezme yapabilir ancak `material` dahil product tek kaynağı değiştirmez.

## BOM / ilişki

Tekil Item'dır; quantity parent recipe sahibidir. Inner-corner konfigürasyonunda matching straight panel quantity'si 1:1 kanonik corner Item'a aktarılabilir.

## Regresyon

Mevcut panel contract testleri + `test/boardMaterialItemContract.test.js`.
