# Fair Stand — Architecture Contracts

Bu doküman sistemin **mimari sınırlarını ve source-of-truth dağılımını** açıklar. Module type'a göre değişen sayısal runtime davranışlarını kopyalamaz; bunlar ilgili kod ve testlerden okunur.

## 1. Canonical kaynaklar

- `docs/items/contract/ITEM_CONTRACT.md` — BOM, üretim veya maliyet hesabına giren fiziksel öğelerin kök `Item` semantiği; `itemKey` / `type` / instance ayrımı; BOM sahipliği; quantity+unit; bileşik/parametrik/recursive Item kuralları.
- `src/moduleBehavior.js` — module-type editor davranışlarının runtime erişimi: placement mode, move snap, side insert, collision strategy ve ghost behavior (veri DB `fair_stand_item_type_scene_behavior`), rotation step ve default rotation (veri Item kolonları, `docs/refactor/ROTATION.md`).
- Placement/core dosyaları — koordinat doğrulaması, duvar snap'i, komşu snap'i, collision, connection ve reflow algoritmaları.
- Katalog — DB kategorileri, önizleme türleri ve Item `catalog*` alanları; runtime `src/catalog.js` (`docs/refactor/CATALOG.md`). Item kimliği ve ölçüleri DB Item kaydıdır (`src/items.js` / `getItem()`).
- State factory dosyaları — runtime module/item state yapıları ve editable surface state'leri.
- Recipe / production-parts katmanı — BOM, üretim adetleri ve gerçek kesim/parça ölçüleri.
- Regresyon testleri — bu contract'ların uygulanmaya devam ettiğini doğrular.

Bir davranış için canonical kaynak mevcutsa aynı sabit değeri birden fazla Markdown dokümanında tekrar etmekten kaçınılır.

### 1.1 Item kök contract'ı

Aksine açık ürün kararı yoksa BOM, üretim veya maliyet hesabına girebilen her fiziksel öğe `Item`dır. `module`, `floor`, `furniture`, `print`, `material` gibi kavramlar `Item`ın type/ailesi/rolü olabilir; paralel kök ürün sistemleri oluşturulmaz.

Yeni bir fiziksel ürün, zemin, malzeme, kombinasyon veya runtime öğesi eklenirken önce `ITEM_CONTRACT.md` uygulanır. Catalog/renderer/GLB/UI eklemek tek başına Item implementasyonu sayılmaz.

---

## 2. Koordinat modeli

- X/Y zemin düzlemidir.
- Z yüksekliktir.
- Modül plan dönüşü Z ekseni etrafında yapılır.
- Stand sınırları ve placement doğrulaması aynı koordinat modelini kullanır.

Dönüş adımı ve hareket grid'i global sabit değildir; module behavior contract'ından gelir.

---

## 3. Placement katmanı

Placement sistemi tek bir ortak core üzerine kuruludur. Stand tipi yalnız izin verilen başlangıç duvarlarını ve sınırları belirler; module type farkları behavior contract'ı üzerinden ifade edilir.

Desteklenen placement kavramları arasında duvar, serbest zemin, duvar üstü overlay ve üst aksesuar davranışları bulunabilir. Hangi module type'ın hangisini kullandığı `src/moduleBehavior.js` tarafından belirlenir.

`wallId` bir placement metadata'sıdır; ayrı ürün sınıfı değildir.

---

## 4. Behavior registry contract'ı

Item/module-specific editor davranışları dağınık `if (module.type === ...)` veya `if (itemKey === ...)` kontrolleri halinde çoğaltılmamalıdır.

Aşağıdaki kararlar mümkün olduğunca behavior registry üzerinden verilmelidir:

- placement mode,
- movement snap,
- side insertion capability,
- collision strategy,
- ghost strategy,
- context-menu action capability.

Sahne Z dönüşü Item kolonlarıdır (`docs/refactor/ROTATION.md`); type tablosunda rotation alanı yoktur.

Davranış gerçekten farklıysa ayrı bir behavior family / `type` tanımlanır; item-level override normal genişleme yolu değildir. Rotation değerleri Item satırındadır, type `if` ezmesi değildir.

Detaylı sözleşme `MODULE_BEHAVIOR_STANDARD.md` dosyasındadır. Item seviyesindeki ownership ilkeleri `ITEM_CONTRACT.md` tarafından belirlenir.

---

## 5. Placement ölçüsü, fiziksel geometri ve BOM ayrımı

Aynı Item/modül için üç farklı ölçü katmanı bulunabilir:

1. **Nominal catalog/placement ölçüsü** — kullanıcıya sunulan ürün ölçüsü ve placement kimliği.
2. **Fiziksel geometri / footprint** — collision ve 3D gövde için gereken gerçek fiziksel alan.
3. **Production/BOM ölçüsü** — üretilecek panel, profil, tabla ve diğer parçaların gerçek ölçüleri.

Bu üç kavram bilinçli olarak farklı olabilir. Birinin değiştirilmesi diğerlerini otomatik olarak değiştirmemelidir.

BOM hesabı render/mesh/GLB/texture görünümünden değil Item'ın gerçek state/ölçü/parametrelerinden türetilir.

Panel Bazalı gibi modüllerde fiziksel çıkıntı ile connect/snap omurgasının farklı olması bu ayrımın geçerli bir örneğidir.

---

## 6. Connection ve collision katmanı

Connection ve collision algoritmaları placement core'un sorumluluğundadır.

Sistem gerektiğinde:

- end-to-end,
- corner/L,
- tee/T,
- footprint collision,
- segment collision,
- collision bypass

gibi farklı stratejiler kullanabilir.

Hangi modülün hangi collision stratejisini kullandığı behavior contract'ından gelir; geometrik doğrulama ise placement core tarafından yapılır.

---

## 7. State ve renderer sınırı

State, Item'ın kalıcı/editable durumunu taşır. Renderer state'i görselleştirir; kalıcı ürün kuralının tek sahibi olmamalıdır.

Yeni bir Item/module type eklenirken mümkün olduğunca şu sorumluluklar ayrık tutulur:

- canonical item identity (`itemKey`),
- catalog descriptor,
- state factory,
- item/module behavior,
- renderer,
- recipe/BOM,
- pricing/costing,
- regression tests.

Canonical Item tanımı ile proje instance state'i ayrıdır. Project-specific ölçü/adet/konfigürasyon canonical ürün tanımını değiştirmez.

Renderer içinde yalnız görselleştirme için gerekli item/module-specific routing bulunmalıdır; placement veya BOM kuralı renderer'a taşınmamalıdır.

---

## 8. BOM ve maliyet sınırı

Her Item BOM'a nasıl dönüştüğünü canonical recipe/resolver üzerinden tanımlar. Item tekil, bileşik veya parametrik olabilir; bileşik Item'lar recursive olarak terminal BOM kalemlerine çözülebilir ve döngüsel dependency yasaktır.

Terminal BOM kalemi canonical kimlik + quantity + unit taşır. Unit (`adet`, `m2`, `mt`, `paket` vb.) tahmin edilmez.

BOM sistemi fiziksel ihtiyacı üretir; fiyatlandırma/maliyet sistemi bu çıktıya fiyat uygular. Birim fiyat değişikliği BOM recipe'sini değiştirmez.

---

## 9. Test contract'ı

Core davranış değişiklikleri regresyon testi olmadan tamamlanmış sayılmaz.

Özellikle şu sınıflar testlerle korunmalıdır:

- Item identity / type / instance ayrımı,
- placement sınırları,
- rotation behavior,
- movement snap,
- connection davranışı,
- collision stratejileri,
- catalog/state uyumu,
- recipe/BOM sözleşmeleri,
- quantity + unit contract'ı,
- recursive BOM çözümü ve cycle rejection,
- module/item-specific behavior family kuralları.

Yeni Item/module type eklenirken Item contract ve behavior contract aynı değişiklik içinde doğrulanmalıdır.

---

## 10. Değişiklik politikası

Core davranış veya yeni fiziksel Item değiştirileceğinde sıra:

1. `ITEM_CONTRACT.md` kapsamı değerlendirilir; Item ise identity/type/state/BOM/unit/instance/behavior kararları verilir.
2. İlgili canonical kod kaynağı değiştirilir.
3. Regresyon testi eklenir veya güncellenir.
4. Bu değişiklik mimari sınırı etkiliyorsa ilgili canonical doküman güncellenir.
5. Repository universal change gate ve impact sweep uygulanır.
6. `npm test`, `npm run build` ve gerekli E2E başarılı olmalıdır.

Dokümanlar runtime davranışının bağımsız ikinci implementasyonu haline gelmemelidir.
