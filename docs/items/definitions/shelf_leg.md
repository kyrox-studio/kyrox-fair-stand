# shelf_leg — Item Contract Definition

## Kanonik Item

- `itemKey`: `shelf_leg`
- `name`: `Raf Ayağı`
- `type`: `shelf-accessory`
- `unit`: `adet`

Şu anda doğrulanmış `dimensions`, ağırlık, `material`, `defaultColor` veya başka fiziksel product üstveri yoktur. Bu alanlar tahmin edilmez; ürün gerçeği doğrulandığında kanonik Item'a eklenecektir.

## Sahiplik

Kanonik kimlik ve mevcut üstveri tek kaynağı Fair Stand ilişkisel Item store'daki `shelf_leg` kaydı kaydıdır. `shelf_leg` ayrı project entity değildir; yerleşim, move, rotation, snap/collision/connection, selection/drag, context menu, delete/duplicate/keyboard, kalıcılık ve reflow parent `shelf` module/type tarafından uygulanır.

## BOM / bileşim

- `shelf:100:2` → `shelf_leg ×4`
- `shelf:150:2` → `shelf_leg ×4`
- `shelf:200:2` → `shelf_leg ×6`
- `shelf:100:3` → `shelf_leg ×6`
- `shelf:150:3` → `shelf_leg ×6`
- `shelf:200:3` → `shelf_leg ×9`

Bu migration yalnız eski `partId` kimliğini kanonik `itemKey` kimliğine taşır; adet kuralları değişmez.

## Renderer / kalıcılık

Ayrı `shelf_leg` render mesh'i veya persisted örneği yoktur. Renderer BOM tek kaynak değildir; parent shelf runtime davranışı değişmez.
