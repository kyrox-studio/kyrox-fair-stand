# profile_karolaj_50

> Bu belge koddan üretilir (`scripts/gen-item-definitions.py`). Ortak Item kuralları: [ITEM_CONTRACT](../contract/ITEM_CONTRACT.md). Kaynak: Fair Stand Item store (`test/fixtures/itemCatalogSeed.json`).

## Kimlik

Çalışma zamanında katalog bootstrap kaydı `src/items.js` `getItem()` ile okunur (`getItem('profile_karolaj_50')`).

| Alan | Değer |
|---|---|
| itemKey | `profile_karolaj_50` |
| Ad | Profil 0.5 m |
| Tip | `floor-piece` |
| Birim | `adet` |
| Malzeme | — |
| Katalog | görünmez |
| Varyant ailesi | — |
| Ölçü | `width_cm=50` |
| Sahne ölçüsü | — |
| Varsayılan renk | — |
| Yüzey | — |

## Bileşim / BOM

Tekil Item: alt kalemi yoktur; BOM satırı kendisidir.

## Tip davranışı

`floor-piece` tipi için ayrı sahne davranışı tanımlı değildir.

## Kaynak kodda geçtiği yerler

- `backend/app/modules/fair_stand/infrastructure/catalog_seed_data.py`
- `src/items.js`

## Testler

- `backend/tests/modules/fair_stand/test_karolaj_parts_migration.py`
- `test/floorArea.test.js`
- `test/projectBom.test.js`
