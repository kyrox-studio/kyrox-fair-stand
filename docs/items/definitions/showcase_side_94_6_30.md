# showcase_side_94_6_30 — Item Contract Definition

## Kanonik Item

- `itemKey`: `showcase_side_94_6_30`
- `type`: `showcase-board`
- `unit`: `adet`
- dimensions: `94.6 × 30 × 1.8 cm` (`widthCm × depthCm × heightCm`)
- `material`: `sunta`
- `defaultColor`: `0xffffff` — beyaz

## Sahiplik

Intrinsic ürün gerçeğinin tek kaynağı Fair Stand ilişkisel Item store'daki `showcase_side_94_6_30` kaydı kaydıdır. Bu Item 2 gözlü showcase gövdesinin iki yan suntasından biridir; orientation/yerleşim parent showcase composition/renderer sorumluluğudur.

Leaf board ayrı project entity değildir. Yerleşim, move, rotation, snap/collision/connection, selection/drag, context menu, delete/duplicate/keyboard, kalıcılık ve reflow parent showcase module/type tarafından uygulanır.

## Renk / ezme sınırı

Kanonik ürün rengi beyazdır (`0xffffff`). DB Item kaydında `accepts_color=true` (migration `0085_showcase_body_color`), görsel/kaplama yetenekleri kapalıdır. Bu yetenek parent vitrinin tek gövde seçicisi tarafından tüketilir; leaf Item ayrı düzenlenebilir proje öğesi veya bireysel renk ezmesi taşımaz.

Showcase gövdesi renklendirildiğinde renk seçimi parent `wall_showcase_100_2_350` proje örneği'ına ait tek bir gövde renk ezme'ı olarak çözülecek ve iki yan + iki yatay olmak üzere dört sunta parçaya birlikte uygulanacaktır. Bu project ezme kanonik `defaultColor` değerini değiştirmez. `glass_shelf` bu gövde rengi kapsamına girmez.

## BOM / bileşim

Tekil Item'dır; kendi doğrudan BOM çıktısı `showcase_side_94_6_30 × quantity`, birim `adet`tir. `wall_showcase_100_2_350` içindeki kanonik quantity ve parent recipe geçiş'u parent showcase migrationında tanımlanacaktır; mevcut eski parent recipe bu batch'te değiştirilmez.

## Renderer / kalıcılık

Ayrı leaf renderer veya persisted entity yoktur. Mevcut showcase prosedürel renderer gövdeyi parent seviyesinde üretmektedir. Kanonik board ölçü/defaultColor tüketiminin parent renderer'a bağlanması `wall_showcase_100_2_350` composite migrationının parçasıdır; leaf Item'ın ürün gerçeği renderer geometrisinden türetilmez.

## Regresyon

`test/showcaseBodyBoardsItemContract.test.js` kanonik identity, dimensions, material, defaultColor, direct BOM ve yalnız ortak gövde rengine izin veren yetenek sözleşmesini kilitler. `test/boardMaterialItemContract.test.js` sunta material sınıflandırmasını kapsar.