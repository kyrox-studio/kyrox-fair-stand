# Fair Stand — Item Migration Rules

Bu belge, mevcut çalışan sistemden yeni Item mimarisine geçiş sırasında uygulanacak zorunlu migration kurallarını tanımlar.

## 1. Migration Item bazında ve bottom-up yapılır

Geçiş bütün sistem için tek seferde yapılmaz.

Sistemde BOM, üretim veya maliyet hesabına giren her fiziksel öğe Item'dır. Bileşik Item'lar başka Item'lardan oluştuğu için migration mümkün olduğunda alt/production Item'lardan başlayıp parent/bileşik Item'lara doğru ilerler.

İlk doğrulanan pilot Item `connector_start`tır. Sonraki Item sırası mevcut kod zinciri ve birlikte alınan migration kararıyla belirlenir; doküman sırf sıra doldurmak için tahmin üretmez.

```text
connector_start   → ilk pilot / alt Item
...               → diğer doğrulanan alt Item'lar
wall_200_350          → alt Item'ları hazır olduğunda bileşik Item olarak ele alınır
```

Bir Item tamamlanmadan sıradaki Item'ın eski runtime yolu sökülmez. Bir parent/bileşik Item migrate edilirken henüz migrate edilmemiş alt Item'lar varsa mevcut compatibility yolu korunabilir.

---

## 2. Çalışan runtime kesintiye uğratılamaz

Bir Item yeni yapıya taşınırken mevcut çalışan Item önce sistemden çıkarılmaz.

Zorunlu sıra:

```text
mevcut çalışan Item
        ↓
yeni Item implementasyonu hazırlanır
        ↓
mevcut davranışlarla parity doğrulanır
        ↓
runtime routing yeni Item yapısına alınır
        ↓
yeni yolun çalıştığı doğrulanır
        ↓
yalnız o Item'a ait eski routing / resolution bağlantıları sökülür
```

Yeni implementasyon hazır ve doğrulanmış olmadan mevcut çalışan yol kesilemez.

---

## 3. Her Item kendi gerçek kapsamıyla tamamen bitirilir

Her Item için parity kapsamı o Item'ın mevcut runtime kodundan çıkarılır; başka Item'ların davranışları hedef Item'a zorla uygulanmaz.

Örneğin `connector_start` mevcut sistemde bağımsız scene/editor instance'ı değildir. Bu nedenle onun migration parity'si öncelikle şunları kapsar:

- canonical identity / production metadata,
- parent recipe kullanımları ve quantity parity,
- BOM/raw BOM consumer bağlantısı,
- Item-by-Item migration izolasyonu,
- ilgili regression testleri.

`wall_200_350` gibi scene/editor davranışı olan bileşik bir Item ele alındığında ise mevcut kodda gerçekten çalışan creation, state, placement, move/rotation, collision, reflow, renderer, selection, persistence, BOM ve diğer davranışların tamamı parity kapsamına girer.

Bu örnekler yeni davranış tanımlamaz. Her Item için gerçek kapsamın source of truth'u mevcut runtime kodudur.
---

## 4. Eski ve yeni yapı geçiş sırasında eş zamanlı bulunabilir

Migration süresince bazı Item'lar yeni Item mimarisinden, diğer Item'lar mevcut eski akıştan çalışabilir.

Örnek ara durum:

```text
connector_start  → yeni Item kimlik/yolu
connector_single → mevcut yapı
wall_200_350         → mevcut yapı
...              → mevcut yapı
```

Bu durum migration için geçerlidir ve sistemin çalışmasını kesmeden Item-by-Item ilerlemeyi sağlar.

---

## 5. İki ayrı source of truth oluşturulamaz

Eski ve yeni yapı aynı Item state'ini bağımsız biçimde yönetemez.

Yasak:

```text
eski state sistemi ayrı yazar
+
yeni Item state sistemi ayrı yazar
```

Bu nedenle dual-write veya aynı business rule'un iki ayrı canonical kopyası oluşturulmaz.

Geçişte yeni Item katmanı gerektiğinde mevcut canonical motorları kullanır; source of truth tek kalır.

---

## 6. Ortak motorlar Item sökülürken silinmez

Bir Item'ın eski bağlantılarını kaldırmak, diğer Item'ların kullandığı ortak runtime motorlarını kaldırmak anlamına gelmez.

Örneğin aşağıdaki tür ortak altyapılar ihtiyaç devam ettiği sürece korunur:

- behavior engine,
- placement engine,
- collision engine,
- magnetic snap,
- selection,
- reflow,
- persistence,
- shared renderer helpers,
- BOM / production-part ortak resolver altyapıları.

Örneğin `connector_start` migration'ında yalnız `connector_start`ın eski identity / routing / resolution bağımlılıkları, yeni Item yolunun tam karşılığı doğrulandıktan sonra kaldırılır. Ortak production-part, recipe veya BOM altyapısı diğer Item'lar kullandığı sürece korunur.

---

## 7. Cutover için parity zorunludur

Bir Item'ın runtime routing'i yeni sisteme alınmadan önce mevcut Item ile yeni implementasyon arasında davranış parity'si doğrulanmalıdır.

Bir özellik yeni yapıda eksikse Item migration tamamlanmış sayılmaz ve eski çalışan yol sökülmez.

Migration'ın başarı kriteri:

```text
aynı Item
+ aynı proje girdisi
+ aynı kullanıcı işlemi
→ mevcut sistemde çalışan davranışın yeni Item sisteminde de korunması
```

Bilinçli davranış değişiklikleri migration ile aynı işlem içinde gizlice yapılmaz; ayrı ürün/teknik karar olarak ele alınır.

---

## 8. Her Item için önce mevcut kod zinciri çıkarılır

Migration başlamadan önce ilgili Item'ın mevcut runtime zinciri koddan doğrulanır:

```text
dosya
→ fonksiyon
→ çağırdığı fonksiyon
→ okuduğu veri
→ yazdığı veri
→ sonraki dependency
```

Item MD dosyası tahmin, audit yorumu veya roadmap kararıyla değil mevcut runtime koduyla doldurulur.

---

## 9. Tamamlanma sırası

Her Item için zorunlu süreç:

```text
1. Current runtime code map
2. ITEM_CONTRACT ile mapping
3. Yeni Item implementasyonu
4. Parity doğrulaması
5. Runtime cutover
6. Eski Item-specific yolun sökülmesi
7. Regression doğrulaması
8. Sıradaki Item
```

Bu sıra atlanamaz.

---

## 10. Ana migration ilkesi

```text
Yeni Item tam çalışmadan eski Item yolu sökülmez.
```

Amaç refactor sırasında sistemi durdurmak değil, çalışan Item'ları tek tek yeni canonical Item mimarisine taşımaktır.
