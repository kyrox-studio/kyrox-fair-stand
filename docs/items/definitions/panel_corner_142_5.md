# panel_corner_142_5 — Item Contract Definition

## Kanonik Item

- `itemKey`: `panel_corner_142_5`
- `type`: `panel`
- `unit`: `adet`
- dimensions: `142.5 × 47 × 0.8 cm`
- `material`: `sunta`
- `panelRole`: `inner-corner`

## Sahiplik / davranış

Intrinsic ürün gerçeğinin tek kaynağı Item kaydıdır. Leaf ayrı scene/proje örneği değildir; yerleşim/move/rotation/snap/collision/context-menu/kalıcılık parent module/relationship zincirindedir. Renderer ezebilir fakat product `material` değişmez.

## İlişki / BOM

`innerCornerPanelItemKey` üzerinden matching `panel_147_5 × N` satırını `panel_corner_142_5 × N` olarak 1:1 değiştirir. Quantity parent recipe'den korunur.

> **Bayat (2026-10-27 denetimi):** `innerCornerPanelItemKey` (2026-09-20 `86bffc35`: legacy inner-corner recipe yolu kaldırıldı; iç köşe Item composition'da (`0db4af90`)). Bu satır güncel kodla yeniden doğrulanmalı.

## Regresyon

Corner panel contract testleri + `test/boardMaterialItemContract.test.js`.
