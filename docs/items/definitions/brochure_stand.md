# brochure_stand — Kanonik Item

Sözleşme: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md), [ITEM_CONTRACT_CHECKLIST](../contract/ITEM_CONTRACT_CHECKLIST.md). Migration: `backend/alembic/versions/0074_showcase_brochure.py`.

## Kimlik, özellikler ve ölçüler
`itemKey = brochure_stand`, ad "Broşürlük", type `brochure-stand`, birim `adet`. Tekil ticari Item. Ürün kararı (2026-10-21): taban 30 × 30 cm, yükseklik 150 cm, 5 cep, beyaz delikli metal. Katalog: Extra, önizleme "Broşürlük".

## Oluşturma, state ve kalıcılık
`src/designState.js > createBrochureStandModuleState` → `createCommercialModuleState('brochure-stand')`. Proje kaydında yeni alan yok.

## Davranış
`brochure-stand` type davranışı DB'dedir: serbest yerleşim, `collision: footprint`, 10 cm adım, mıknatıslı yapışma yok, 90° dönüş. Renk/görsel kabul etmez.

## BOM
`TYPE_SELF_BOM`: tek satır `brochure_stand ×1 adet`. Alt parça yok.

## Renderer sınırı
`src/scene3d.js > createBrochureStandModule` prosedüreldir: taban plakası, iki dikme, öne eğik delikli arka levha + ön dudaklı 5 cep (`BROCHURE_STAND_POCKET_COUNT = 5`). Delik deseni tek paylaşılan canvas dokusudur (`createPerforatedTexture`). Çizim BOM'un kaynağı değildir.

## Regresyon
`test/floorShowcaseBrochureStand.test.js`; E2E `e2e/floor-showcase-brochure-copy-rotate.spec.mjs`; migration `backend/tests/modules/fair_stand/test_showcase_brochure_migration.py`.
