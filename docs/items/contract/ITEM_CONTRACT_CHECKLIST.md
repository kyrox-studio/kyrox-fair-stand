# Fair Stand — Item Contract & Validation Checklist

Bu belge Fair Stand içindeki **kanonik Item sözleşmesini** ve her Item için uygulanacak **zorunlu doğrulama checklist'ini** tek dosyada toplar.

Amaç:

1. `ITEM_CONTRACT.md` içindeki Item kurallarını eksiksiz korumak.
2. `ITEM_ANALYSIS_CHECKLIST.md` içindeki kontrol alanlarını aynı sözleşmenin altında açıklamalı hale getirmek.
3. Her Item incelenirken cevabı tahmin etmek yerine mevcut kanonik kod, state, contract, recipe, production-part ve test kaynaklarından çıkarmak.
4. Item'ı ilgilendiren mevcut ürün/default özelliklerinin kanonik Item tanımına taşındığını ve gerçek tüketicilerin bu kanonik kaynağı kullandığını zorunlu olarak doğrulamak.

Bu belge özel bir Item'a ait sayısal runtime değerlerinin ikinci kopyası değildir. Örneğin dönüş açısı, snap değeri, collision tipi, context-menu komutları veya BOM miktarları ilgili mevcut sistem kaynağından okunur.

---

# BÖLÜM I — KANONİK ITEM SÖZLEŞMESİ

## Zorunlu kapsam

Aksine açık bir ürün kararı yoksa aşağıdakilerin tamamı `Item` kabul edilir:

- panel, banko, raf, kapı, baza ve diğer stand yapısal ürünleri,
- TV, mobilya, çiçek, buzdolabı, çöp kutusu ve diğer ticari ürünler,
- ışıklı strafor, baskı ve benzeri üretilebilir yüzey/ürünler,
- halı, parke, karolaj ve gelecekte eklenecek diğer zemin çözümleri,
- profil, dikme, sunta, bant, LED, bağlantı elemanı ve diğer BOM/üretim kalemleri,
- tekil, bileşik, parametrik ve projeye özel kombinasyonlar.

Varsayılan olarak `Item` olmayanlar yalnızca sahnenin görsel/yardımcı sunumu ile stand alanını gösteren dış sınır/çizgilerdir. Ürün kararıyla BOM veya maliyete dahil edilen yeni bir fiziksel unsur bu sözleşmeye girmeden sisteme eklenemez.

---

## 1. Kök sistem `Item`dır

Stand projesinde BOM, üretim veya maliyet hesabına girebilen her fiziksel öğe bir `Item`dır.

`module`, `floor`, `furniture`, `print`, `material` gibi kavramlar kök kavram değildir; `Item`ın türü/ailesi veya kullanım rolüdür.

---

## 2. Item kendisini ilgilendiren kanonik ürün/default özelliklerinin sahibidir

Bir Item'ı ürün olarak tanımlayan ve mevcut sistemde gerçek bir değeri bulunan ürüne özgü/default özellikler kanonik Item tanımında tutulur.

Bu kapsam yalnızca zorunlu bir sabit alan listesi değildir. Item için gerçekten mevcut olan özellikler sistemden çıkarılır ve ilgili Item'a taşınır. Örnekler:

- `name`, `type`, `unit`,
- `dimensions.widthCm`, `heightCm`, `depthCm` (+ isteğe bağlı `mountHeightCm`, `wallGapCm`),
- `defaultColor`,
- `material`,
- ağırlık, yüzey, ürün ailesine özgü sınıflandırma veya başka ürüne özgü üstveri,
- Item'ın kanonik default state/parametreleri,
- Item/type behavior ve yetenek bağlantıları,
- gerekiyorsa asset/model/reference üstverisi.

Bir özellik bütün Item'lar için zorunlu olmak zorunda değildir. Örneğin `defaultColor` bir Item'da olabilir, başka bir Item'da olmayabilir. Ancak mevcut sistemde Item'ın ürün/default özelliği olarak bir değer varsa migration sırasında sessizce dışarıda bırakılamaz.

### Kanonik tek kaynak ve tüketim kuralı

Item'a ait kanonik ürüne özgü/default bir özellik başka bir runtime dosyasında bağımsız ikinci business/product tek kaynak olarak tutulmaz. Bu özelliğe ihtiyaç duyan BOM, state oluşturucu, UI, behavior, resolver veya başka business tüketicisi kanonik Item kaynağından tüketmelidir.

Renderer veya specialized render kodu görsel/teknik nedenle farklı bir değer kullanabilir. Proje örneği de kullanıcı/konfigürasyon nedeniyle kanonik default'u ezebilir. Ezme geçerlidir; fakat kanonik default değerin Item'daki sahipliğini kaldırmaz ve Item tanımını değiştirmez.

Örnek:

```text
canonical Item:
  heightCm = 1.8      // örn. tabla kalınlığı
  defaultColor = 0xf8fafc

project/runtime override:
  heightCm = 3        // belirli instance/karar mekanizması izin veriyorsa
  color = başka renk  // kullanıcı veya runtime override

specialized renderer:
  renderThickness = 4 // yalnız görsel/teknik temsil olabilir
```

Bu durumda kanonik ürün gerçeği Item'da kalır. Override'ın kaynağı, kapsamı ve kalıcılık davranışı ayrıca tanımlanır.

---

## 3. Her Item kendi BOM çıktısının kanonik sahibidir

Her `Item`, BOM'a nasıl dönüştüğünü tek bir kanonik reçete/resolver üzerinden tanımlar.

Bir Item:

- doğrudan tek BOM kalemi üretebilir,
- birden fazla BOM kalemine ayrılabilir,
- başka Item'lardan oluşabilir,
- ölçü veya konfigürasyona göre parametrik BOM üretebilir.

Aynı BOM kuralı controller, renderer, UI veya başka yardımcı dosyalarda ikinci kez tanımlanmaz.

---

## 4. Item tekil veya bileşiktir; ayrıca parametrik olabilir

- **Tekil Item:** sistem açısından başka Item'lardan oluşmayan Item'dır. Örn. kettle, `connector_start`, panel, TV. Başka bir Item'ın reçetesinde kullanılması onu farklı bir sınıfa dönüştürmez; o bağlamda yalnızca parent Item'ın alt Item'ıdır.
- **Bileşik Item:** başka Item'lardan oluşan Item'dır. Kanonik composition/reçetesi hangi alt Item'lardan ve hangi miktarlardan oluştuğunu tanımlar. Örn. `wall_200_350`; vitrinli bir sistem aynı temel Item'lara ek olarak cam, raf ve vitrine özel başka Item'lar içerebilir.
- **Parametrik:** ayrı bir üçüncü Item sınıfı değildir. Tekil veya bileşik bir Item'ın ölçü, state veya konfigürasyona göre miktarının/bileşiminin değişebildiğini belirtir.

Bir Item yapısal olarak ya tekil ya bileşiktir; her iki yapı da parametrik olabilir.

---

## 5. Her Item'ın stabil kanonik kimliği vardır

Her Item tanımı tek ve stabil bir kanonik `itemKey` taşır.

`itemKey` ürünün tam kimliğidir; `type` davranış ailesidir; proje içindeki `id` ise örnek kimliğidir.

Örnek:

```text
itemKey = tv_42
type    = tv
id      = item-<project-instance>
```

Mevcut `catalogKey` alanı ürün kimliği değildir; runtime onu okumaz ve yazmaz.

---

## 6. Kanonik Item tanımı ile proje Item örneği ayrıdır

Kanonik tanım varsayılan ürünü/reçeteyi tanımlar. Projedeki örnek kendi `id`, ölçü, adet ve konfigürasyonunu taşıyabilir.

Örneğin standart masa-sandalye seti `1 masa + 4 sandalye` olabilir; belirli projede `1 masa + 2 sandalye` olarak kullanılabilir. Bu proje konfigürasyonu kanonik ürün tanımını değiştirmez.

Ezilebilir alanlar açıkça tanımlanır. Ezme uygulanması kanonik Item property'sini silmez, kopya tek kaynak yaratmaz; effective value resolver/default→ezme mantığıyla çözülür.

---

## 6A. Her Item'ın kanonik oluşturulma mekanizması tanımlıdır

Bir Item'ın proje örneğina nasıl dönüştürüldüğü tek ve izlenebilir bir oluşturulma yolu üzerinden tanımlanmalıdır.

Bu oluşturulma mekanizması oluşturucu, resolver, builder veya eşdeğer bir kanonik üretim noktası olabilir; isimden bağımsız olarak aynı Item için paralel ve çelişen örnek oluşturma kuralları bulunmaz.

Oluşturulma mekanizması en az şu sorumlulukları açıkça çözmelidir:

- kanonik `itemKey` ve `type` bilgisinden doğru Item örneğinı üretmek,
- gerekli default state/ölçü/parametreleri kanonik Item'dan uygulamak,
- izin verilen project/runtime ezme'larını default değerlerden ayrı çözmek,
- yeni proje örnek `id` değerini üretmek veya bağlamak,
- Item'a özgü alt state/child state gerekiyorsa bunları kanonik kurala göre oluşturmak,
- catalog veya başka giriş noktalarından gelen tanımı tek kanonik Item kimliğine çözmek.

Oluşturucu/oluşturma mantığı UI, renderer veya farklı controller akışlarında ikinci kez kopyalanmaz.

---

## 6B. Her Item'ın kalıcılık sözleşmesi tanımlıdır

Bir Item'ın hangi proje verilerinin kalıcı olduğu ve save/load sonrasında nasıl geri kurulduğu açıkça tanımlanmalıdır.

Persistence sözleşmesi en az şunları belirtmelidir:

- hangi Item state/ezme alanlarının proje state'ine kaydedildiği,
- kanonik default ile project ezmenin nasıl ayrıldığı,
- hangi alanların runtime/geçici olduğu ve kaydedilmediği,
- proje yeniden açıldığında kanonik Item kimliği ile örnek state'in nasıl tekrar eşleştirildiği,
- alt Item/alt state/relationship referanslarının nasıl korunduğu,
- eski veya geçersiz state için validation/migration kuralının nerede olduğu.

Renderer, mesh veya geçici UI state'i persistent business state'in yerine geçmez.

---

## 7. Item davranışı `type` seviyesinde tanımlanır

Yerleşim, move, side insert, collision, ghost, context-menu yetenek ve benzeri Item'a özgü editor/runtime davranışları kanonik olarak davranış ailesi (`type`) seviyesinde tanımlanır.

Sahne Z dönüşü (`rotationStepDeg`, `defaultRotationDeg`, `sideInsertRotation`) Item kolonlarıdır; sözleşme `docs/refactor/ROTATION.md`. `TYPE_BEHAVIORS` rotation taşımaz.

Aynı davranış ailesindeki Item'lar aynı contract'ı kullanır.

Davranış gerçekten farklıysa yeni bir davranış ailesi/type tanımlanır. Item bazlı dağınık `if (itemKey === ...)` veya sürekli ezme normal mimari yöntem değildir.

Item tanımı hangi `type` / behavior family / yetenek contract'ını kullandığını açıkça taşır veya tek kanonik resolver üzerinden çözer. UI, context menu ve runtime aynı kanonik behavior/yetenek kaynağını tüketir.

Mevcut module behavior altyapısında bu sorumluluğun kanonik runtime sahibi `src/moduleBehavior.js`, sözleşme belgesi `MODULE_BEHAVIOR_STANDARD.md` dosyasıdır; Item mimarisine geçiş bu tek-kaynak ilkesini bozmaz.

---

## 7A. Item-to-Item spatial relationship kanonik olarak tanımlanır

Bir Item'ın başka Item'larla sahnedeki fiziksel/uzamsal ilişkisi business rule veya BOM sonucunu etkiliyorsa bu ilişki açık bir kanonik relationship modeliyle temsil edilmelidir.

Bu ilişki modeli ihtiyaç oldukça şu tür ilişkileri taşıyabilir:

- parent / child,
- komşuluk / neighbor,
- bağlı / connected,
- üzerinde / bağlı olduğu host,
- köşe / corner,
- aynı continuous chain içinde olma,
- başka bir Item'a göre yön veya konum bağımlılığı.

Relationship bilgisi yalnızca renderer mesh'inden, ekrandaki yakınlıktan veya UI tahmininden türetilen geçici bir bilgi olarak bırakılmaz. Proje state'i ve business kuralları için gerekli olan ilişki kanonik veri/resolver üzerinden çözülebilmelidir.

Bir relationship Item'ın davranışını, konfigürasyonunu veya BOM'unu değiştiriyorsa bu dönüşüm relationship resolver tarafından belirlenir; aynı kural farklı controller veya UI katmanlarında yeniden tanımlanmaz.

### Relationship-derived reflow / davranış

Bir Item'ın eklenmesi, taşınması, döndürülmesi, silinmesi veya başka Item'la ilişki kurması komşu Item'ların konumunu veya durumunu etkiliyorsa bu etki kanonik relationship/behavior kuralları üzerinden çözülmelidir.

Reflow veya benzeri zincir etkileri:

- hangi ilişkide tetiklendiğini,
- hangi Item'ların etkilenebileceğini,
- hangi yerleşim/collision/boundary kurallarına uyacağını,
- ilişki kalktığında veya Item silindiğinde ne olacağını

açıkça tanımlamalıdır.

Relationship-derived davranış ile relationship-derived BOM aynı ilişki bilgisini tüketebilir; ancak behavior sonucu ile BOM sonucu ayrı sorumluluklar olarak kalır.

---

## 8. BOM gerçek Item state/ölçü/parametrelerinden hesaplanır

BOM ve üretim hesabının tek kaynağı Item'ın kanonik özellikleri ile gerçek örnek state/ezme/parametreleri ve konfigürasyonudur.

Render, mesh, GLB, texture, piksel çözünürlüğü veya ekrandaki görünüm BOM'un kanonik kaynağı değildir.

Örneğin altı panelde baskı varsa baskı m²'si panelin gerçek baskı alanından hesaplanır; texture çözünürlüğünden hesaplanmaz.

---

## 9. Her BOM kalemi açık miktar ve birim taşır

Her nihai BOM kalemi en az şunları taşır:

- kanonik BOM item kimliği,
- `quantity`,
- kanonik `unit`.

Örnek birimler: `adet`, `m2`, `mt`, `paket`.

Miktar çıplak sayı olarak yorumlanmaz; birim tahmin edilmez.

Örnekler:

- TV: `2 adet`
- Baskı: `12.4 m2`
- Profil: `37.5 mt`
- Halı: alan + rulo enine göre gereken lineer metre
- Parke: alan + ürün geometrisine göre adet/paket
- Karolaj: köşe + kenar + orta eleman + sunta adetleri

---

## 10. Bileşik Item'lar recursive BOM çözümünü destekler

Bir Item başka Item'lardan oluşabilir; alt Item'lar da kendi BOM reçetelerine sahip olabilir.

BOM resolver gerektiğinde başka Item bileşimi olmayan Item'lara kadar recursive çözüm yapabilmelidir; bunlar nihai BOM kalemlerini oluşturur.

Döngüsel bağımlılık yasaktır:

```text
A -> B -> A   // geçersiz
```

---

## 11. BOM ile maliyet/fiyatlandırma ayrıdır

Item/BOM sistemi **ne gerektiğini, ne kadar gerektiğini ve birimini** üretir.

Maliyet/fiyatlandırma sistemi bu kanonik BOM çıktısına fiyat uygular.

Birim fiyat değiştiğinde Item'ın BOM reçetesi değişmez.

---

# Yeni Item ekleme zorunlu kontrolü

Yeni bir fiziksel ürün, zemin, malzeme, kombinasyon veya üretilebilir öğe eklenmeden önce şu sorular cevaplanmalıdır:

1. `itemKey` nedir?
2. `type` / davranış ailesi nedir?
3. Yapısal olarak tekil mi bileşik mi; ayrıca parametrik mi?
4. Mevcut sistemde Item'ı tanımlayan bütün ürüne özgü/default özellikler nelerdir ve kanonik Item içinde nerede tutulur?
5. Ölçülerin bütün gerçek eksenleri ve ürün boyutları (`width/height/depth/length/thickness` ve Item'a özgü diğerleri) eksiksiz mi?
6. Mevcutsa `defaultColor`, `material` ve diğer ürün/default üstverisi Item'a taşındı mı?
7. Her kanonik property'nin gerçek business/runtime tüketicisi Item'dan mı okuyor?
8. Hangi property/state alanları ezilebilir; kanonik default ile ezme nasıl ayrılır?
9. Hangi behavior/yetenek contract'ını kullanır?
10. BOM reçetesi/resolver'ı nedir?
11. Nihai BOM kalemlerinin birimleri nelerdir?
12. Render/asset temsili nedir; specialized renderer ezme'ı kanonik Item property sahiplik'ından nasıl ayrılır?
13. BOM, behavior, state, kalıcılık ve browser akışı için hangi regression testleri gerekir?
14. Item'ın kanonik oluşturucu/oluşturulma mekanizması nedir ve hangi girişleri çözer?
15. Hangi state/ezme alanları persistent, hangileri runtime/geçicidir; save/load ve migration nasıl çalışır?
16. Item'ın parent/child, neighbor, connection, host, corner veya diğer spatial relationship kuralları var mı ve kanonik resolver'ı nedir?
17. Relationship değiştiğinde reflow veya başka relationship-derived davranış oluşuyor mu; tetiklenme ve etki kuralları nelerdir?
18. Kanonik property veya davranış başka bir yerde bağımsız ikinci tek kaynak olarak kopyalanmış mı?

Bu sorular cevaplanmadan yeni Item işi tamamlanmış sayılamaz.

# Mimari ilişki

```text
Project
  -> Items
      -> canonical itemKey
      -> canonical product/default properties
          -> dimensions / defaultColor / material / family-specific metadata
          -> default state / params
      -> creation / factory
          -> canonical defaults
          -> project/runtime overrides
      -> type / behavior family / capabilities
      -> project instance state + params
      -> persistence
      -> relationships
          -> relationship-derived behavior / reflow
      -> BOM resolver
          -> child Items / composition
              -> nihai BOM kalemleri (itemKey + quantity + unit)
              -> pricing / costing
```

Kanonik property tüketimi kuralı:

```text
Item canonical property
    -> business/runtime consumer
    -> optional project/runtime override

specialized renderer override
    -> yalnız görünüm/teknik temsil olabilir
    -> canonical Item default'unu sahiplenmez
```

Bu belge Item semantiğinin, kanonik property sahipliğinin ve BOM sahipliğinin kanonik sözleşmesidir. Sayısal runtime davranışlarının ikinci kopyası değildir; ayrıntılı runtime değerleri ilgili kanonik kod kaynaklarından okunur.

---

# BÖLÜM II — ITEM ANALYSIS / VALIDATION CHECKLIST

Bu checklist her Item incelenirken kullanılacaktır.

Amaç: Mevcut sistemde Item'ın ne olduğunu, hangi özelliklere sahip olduğunu, nasıl davrandığını, nasıl üretildiğini ve yeni Item mimarisine nasıl taşınacağını sistemden çıkararak kayıt altına almak.

Her kontrol için cevap mevcut sistemden çıkarılır. Bir alan Item için geçerli değilse bu da açıkça belirtilir; alan sessizce atlanmaz.

**Hard gate:** Item'ı ilgilendiren mevcut ürüne özgü/default bir property bulunmuş fakat kanonik Item tanımında yoksa veya gerçek business tüketicisi halen bağımsız bir ikinci product/default değerini tek kaynak olarak kullanıyorsa Item migration'ı **TAMAM değildir**. Renderer/specialized görünüm ezme'ı bu kurala istisna olabilir; istisna açıkça renderer ezme olarak kaydedilir.

---

# 1. Kimlik ve sınıflandırma

Bu bölüm Item'ın kanonik olarak **hangi ürün olduğunu** ve hangi davranış ailesine bağlandığını doğrular.

### ☐ `itemKey`
Kanonik ürün kimliği nedir?

### ☐ `type`
Davranış ailesi nedir?

### ☐ Item yapısı
- ☐ Tekil Item
- ☐ Bileşik Item

Tekil Item sistem açısından başka Item bileşimi içermez. Bileşik Item kanonik alt Item listesi/reçetesi taşır. Bir Item'ın başka bir Item içinde kullanılması onu ayrı bir sınıfa dönüştürmez; o kullanımda parent'ın alt Item'ıdır.

### ☐ Parametrik mi?
- ☐ Evet
- ☐ Hayır

Parametrik olmak ayrı bir Item sınıfı değildir; tekil veya bileşik Item'ın ölçü/state/konfigürasyona göre değişebilmesini belirtir.

### ☐ Oluşturucu / oluşturulma noktası
Item örneğinı hangi mevcut oluşturucu/resolver/builder oluşturuyor? Default state ve örnek kimliği hangi kaynaktan geliyor?

### ☐ Catalog bağlantısı
Mevcut catalog tanımı varsa kanonik ürün kimliğiyle nasıl eşleşiyor?

---

# 2. Kanonik Item özellikler / ürün-default üstveri

Bu bölüm **Item'ın kendisini ürün olarak tanımlayan bütün mevcut ürüne özgü/default özellikleri** zorunlu olarak çıkarır. Sabit bir global şema varsayılmaz; ilgili Item için sistemde bulunan bütün gerçek property'ler taranır.

### ☐ Kanonik property envanteri
Mevcut sistemde bu Item'ı tanımlayan bütün ürüne özgü/default property'ler nelerdir? Her biri isim + değer + mevcut kaynak dosya ile listelenir.

### ☐ Dimensions eksiksizliği
Item için geçerli olan gerçek fiziksel boyutların her biri tek tek kontrol edilir:

- ☐ `widthCm`
- ☐ `heightCm`
- ☐ `depthCm`
- ☐ `mountHeightCm` / `wallGapCm` (varsa)
- ☐ Item ailesine özgü başka ölçü

Geçerli olmayan eksen **UYGULANMIYOR** olarak yazılır; mevcut bir ölçü toplu `dimensions var` denilerek geçilemez.

### ☐ `defaultColor`
Mevcut sistemde ürünün/default görünümün tanımlı bir rengi var mı? Varsa kanonik Item üstverisinde mı? Yoksa `YOK/UYGULANMIYOR` açıkça yazılır. Bu alan bütün Item'lar için zorunlu değildir.

### ☐ `material`
Mevcut sistemde ürün malzemesi tanımlı mı? Varsa kanonik Item üstverisinde mı? Yoksa tahmin edilmez.

### ☐ Diğer ürüne özgü üstveri
Ağırlık, yüzey, panel rolü, connector türü, nominal ürün ölçüsü, göz sayısı veya Item ailesine özgü başka ürün özelliği var mı? Varsa kanonik Item içinde veya kanonik Item'a bağlı tek tek kaynak'ta temsil ediliyor mu?

### ☐ Kanonik owner
Her ürüne özgü/default property'nin kanonik sahibi gerçekten Item tanımı mı? Item'a ait product/default değeri renderer, UI, controller veya başka yardımcı dosyada bağımsız ikinci kanonik değer olarak mı tutuluyor?

### ☐ Gerçek tüketici geçiş
Bu property'ye business/runtime olarak ihtiyaç duyan gerçek tüketiciler kanonik Item property/resolver yolunu kullanıyor mu? `Item'da da var ama gerçek consumer başka sabiti kullanıyor` durumu varsa migration tamam değildir.

Renderer/specialized rendering yalnız görsel/teknik ezme yapıyorsa bu **renderer ezme** olarak kaydedilir ve tüketici-geçiş gap'i sayılmaz; renderer business/product tek kaynak haline gelmemelidir.

### ☐ Ezme yetenek
Hangi property'ler proje örneği, kullanıcı tercihi, decision mechanism veya runtime tarafından ezilebilir?

### ☐ Effective value çözümü
Ezme varsa effective değer nasıl çözülüyor? En azından mantık açık olmalıdır:

```text
canonical Item default
→ varsa project/runtime override
→ effective business value
```

Specialized renderer ayrıca kendi render ezmesini uygulayabilir; bu business effective value ile aynı kavram olmak zorunda değildir.

### ☐ Ezme kalıcılık
Ezme edilen değer kalıcı mı? Save/load sonrasında korunuyor mu, yoksa runtime/geçici mi?

### ☐ Property regression
Kanonik ürüne özgü/default property'lerin Item içinde bulunduğunu, doğru değerleri taşıdığını ve gerekli gerçek tüketicilerin kanonik yolu kullandığını koruyan regression var mı?

---

# 3. State ve veri modeli

Bu bölüm Item'ın proje içinde **gerçekte hangi verileri taşıdığını** doğrular.

### ☐ Örnek state yapısı
Örnek üzerinde hangi alanlar var?

### ☐ Default değerler
Yeni örnek oluşturulduğunda sistem hangi varsayılanları veriyor? Bu default'ların Item'a ait olanları kanonik Item property/default kaynağından mı geliyor?

### ☐ Ölçüler / geometry bilgileri
Instance'ta effective olarak kullanılan gerçek genişlik, yükseklik, derinlik veya Item'a özgü diğer ölçüler nelerdir? Kanonik Item default ile ezme ayrımı nedir?

### ☐ Configurable / ezme alanlar
Hangi state/parametreler proje içinde değiştirilebiliyor? Bunlardan hangileri kanonik Item default'unu eziyor?

### ☐ Persistence
Hangi alanlar proje state'ine kaydediliyor? Hangi alanlar runtime/geçici?

### ☐ Save / load ve migration
Project yeniden açıldığında Item nasıl geri kuruluyor; kanonik defaults + persisted ezmes nasıl birleştiriliyor; eski/geçersiz state için validation veya migration nerede?

### ☐ ID üretimi ve örnek mantığı
Proje örneği `id` nasıl üretiliyor ve kanonik `itemKey`'den nasıl ayrılıyor?

### ☐ Alt state / child state
Item'ın kendi içinde ayrıca state taşıyan alt yüzeyleri, alt parçaları veya child Item'ları var mı?

---

# 4. Davranış (Behavior)

Bu bölüm Item'ın mevcut runtime/editor davranışını doğrular. Mevcut sistemde behavior ailesinin kanonik kaynağı `src/moduleBehavior.js`'dir; Item mimarisine geçişte aynı tek-kaynak ilkesi korunur.

### ☐ Behavior kaynağı
Hangi `type` / behavior family kullanılıyor? Item tanımı bu behavior/yetenek kaynağına kanonik olarak nasıl bağlanıyor? Item'a özel mevcut ezme varsa ayrıca kaydedilir.

### ☐ Yerleşim tipi
Mevcut sistemde gerçek yerleşim değeri nedir? Örneğin mevcut runtime'da `wall`, `free`, `wall-overlay`, `top` gibi değerler kullanılır; ilgili Item için gerçek değer kaynaktan okunur.

### ☐ Hareket davranışı
Item taşınabiliyor mu; hareket serbest mi yoksa wall/host/başka constraint'e bağlı mı?

### ☐ Snap değeri
Mevcut move snap değeri/kuralı nedir?

### ☐ Rotation desteği
Item dönebiliyor mu?

### ☐ Rotation step
Dönüş adımı nedir?

### ☐ Default rotation
Başlangıç yönü nedir?

### ☐ Sağ / sol dönüş mantığı
Saat yönü ve ters yön dönüşü mevcut resolver/interaction içinde nasıl çözülüyor?

### ☐ Collision
Collision stratejisi nedir?

### ☐ Collision depth / endpoint contact
Mevcut behavior contract'ında bu alanlar kullanılıyorsa Item için değerleri nedir?

### ☐ Magnetic snap
Var mı; değeri nedir?

### ☐ Boundary snap
Var mı; değeri nedir?

### ☐ Connection endpoint
Bağlantı endpoint modeli nedir?

### ☐ Side insert
Yanına Item ekleme yetenek'si var mı?

### ☐ Side insert rotation
Yan eklemede orientation kuralı nedir?

### ☐ Overlap kuralları
Hangi type'larla overlap izinli/yasak?

### ☐ Wall capacity / host yetenek
Mevcut behavior'da uygulanıyorsa wall capacity ve wall-overlay host yetenek değerleri nedir?

### ☐ Ghost / preview
Preview davranışı, renderer'ı ve mevcut değerleri nedir?

### ☐ Behavior tüketici geçiş
UI, context menu, move/yerleşim ve ilgili runtime tüketicileri aynı kanonik behavior/yetenek kaynağını mı kullanıyor? Paralel ikinci behavior rule varsa açık gap olarak işaretlenir.

---

# 5. Kullanıcı etkileşimleri (Interaction)

Bu bölüm Item üzerinde **kullanıcının gerçekten hangi işlemleri yapabildiğini** mevcut UI/scene/controller akışından doğrular.

### ☐ Sol click davranışı
Sol click Item veya alt yüzey üzerinde ne yapıyor?

### ☐ Seçim tipi
- ☐ Tek seçim
- ☐ Multi seçim
- ☐ Panel / alt parça seçimi

Geçerli olmayan seçim tipleri açıkça belirtilir.

### ☐ Drag davranışı
Drag akışında Item'a ait hangi işlem gerçekleşiyor?

### ☐ Sağ click davranışı
Sağ click hangi interaction/context akışını açıyor?

### ☐ Context menu içeriği
Item/type/yetenek için mevcut sistemde görünen gerçek komutlar nelerdir? Bu yetenek'ler kanonik Item/type davranış kaynağından mı çözülüyor?

### ☐ Yapılabilir işlemler
Aşağıdaki işlemler tek tek kontrol edilir; mevcut olmayanlar da açıkça kaydedilir:

- ☐ Sil
- ☐ Çoğalt
- ☐ Taşı
- ☐ Döndür
- ☐ Renk değiştir
- ☐ Görsel değiştir
- ☐ Alt Item ekle

### ☐ Keyboard interaction
Item'ı etkileyen mevcut keyboard shortcut veya interaction var mı?

### ☐ Duplicate davranışı
Varsa hangi state/ezme korunuyor, hangi örnek/alt-state ID'leri yeniden üretiliyor?

### ☐ Delete davranışı
Silme yalnız hedef Item'ı mı etkiliyor; relationship/reflow/child-state sonucu var mı?

---

# 6. Görsel / Renderer

Bu bölüm Item'ın görünümünün hangi mevcut state, kanonik Item default ve renderer kaynağından geldiğini doğrular.

### ☐ Renderer tipi
- ☐ Prosedürel
- ☐ Model
- ☐ Specialized

Mevcut contract başka bir mode kullanıyorsa gerçek değer aynen kaydedilir.

### ☐ Asset bağlantısı
Model/GLB/image/texture veya başka asset varsa hangi kaynaktan geliyor? Item'a ait kanonik asset/reference üstverisi varsa Item tanımında mı?

### ☐ Renk davranışı
Kanonik `defaultColor` varsa Item'dan mı geliyor? Instance/user color ezme varsa nerede tutuluyor? Renderer-specific color ezme varsa ayrıca ve açıkça belirtilir.

### ☐ Görsel/image davranışı
Image yetenek var mı; state ve renderer bağlantısı nedir?

### ☐ Özel görsel modları
Item için mevcut sistemden tek tek kontrol edilir:

- ☐ Cam
- ☐ Lightbox
- ☐ Mesh
- ☐ LED

### ☐ Özel modların birlikte kullanım kuralı
Birbirini dışlayan veya birlikte çalışan mode'lar varsa gerçek kural nedir?

### ☐ Ghost / preview davranışı
Behavior bölümündeki preview görsel olarak nasıl uygulanıyor?

### ☐ Renderer ezme sınırı
Renderer kanonik Item property'den farklı bir render değeri kullanıyor mu? Kullanıyorsa bu değer yalnız görsel/teknik ezme mı, yoksa yanlışlıkla product/business tek kaynak haline mi gelmiş?

### ☐ Renderer / business-state ayrımı
Renderer veya mesh business state/BOM kaynağı haline gelmiş mi? Contract gereği kanonik business/default property Item'da; effective project state/ezme ise kanonik state katmanında tutulmalıdır.

---

# 7. Item ilişkileri

Bu bölüm Item'ın başka Item'larla kurduğu mevcut kanonik veya fiili ilişkiyi doğrular.

### ☐ İçindeki Item'lar
Bileşik Item ise hangi kanonik alt Item'lardan oluşuyor?

### ☐ Bağlandığı Item'lar
Connection/mount/host ilişkileri var mı?

### ☐ Parent-child ilişkisi
Parent ve child rolleri mevcut mu?

### ☐ Komşuluk ilişkileri
Neighbor ilişkisi yerleşim, davranış veya BOM'u etkiliyor mu?

### ☐ Köşe / bağlantı kuralları
Corner veya başka connection durumu var mı?

### ☐ Host / overlay ilişkisi
Başka Item'a mount olma veya başka Item'a host olma durumu var mı?

### ☐ Continuous chain / reflow
Item mevcut sistemde bir zincir/reflow davranışına katılıyor mu?

### ☐ Relationship resolver ihtiyacı / kaynağı
İlişki bugün hangi kaynakta çözülüyor? Kanonik resolver eksikse bu açık problem olarak işaretlenir.

### ☐ Relationship değişim sonuçları
Ekleme, taşıma, döndürme veya silme komşu Item'ların konumunu/state'ini etkiliyor mu?

### ☐ Relationship-derived BOM
İlişki BOM'u değiştiriyor mu? Değiştiriyorsa mevcut resolver var mı, yoksa açık mı?

---

# 8. BOM / Üretim

Bu bölüm Item'ın kanonik üretim çıktısını doğrular.

### ☐ BOM var mı?
Mevcut Item/module contract'ında BOM policy tanımlı mı?

### ☐ BOM policy
Mevcut sistemde kullanılan gerçek policy kaydedilir. Mevcut module contract altyapısında örneğin `recipe` ve `decision-required` durumları vardır; Item için gerçek durum kaynaktan okunur.

### ☐ Recipe kaynağı
Recipe kullanılıyorsa kanonik sahibi nerede?

### ☐ BOM resolver kaynağı
BOM hangi resolver üzerinden çözülüyor?

### ☐ Alt Item listesi
Bileşik ise hangi kanonik Item'ları içeriyor?

### ☐ Quantity
Her nihai BOM kaleminin miktarı nedir?

### ☐ Unit
Her nihai BOM kaleminin kanonik birimi nedir?

### ☐ Recursive BOM
Alt Item'ların kendi bileşimi/BOM'u varsa başka Item bileşimi olmayan Item'lara kadar recursive çözüm kuralı var mı?

### ☐ Circular dependency
Recursive Item zincirinde döngü engelleniyor mu?

### ☐ Varyant BOM'ları
- ☐ Normal
- ☐ Köşe
- ☐ Bağlantı
- ☐ Özel durum

Mevcut sistemde başka gerçek varyant varsa ayrıca kaydedilir.

### ☐ State/ölçü/parametre kaynaklı BOM
BOM kanonik Item property/default + gerçek Item örnek state/ezme/konfigürasyonundan mı hesaplanıyor?

### ☐ Relationship-derived BOM
Komşuluk, corner, connection veya başka relationship BOM sonucunu değiştiriyorsa mevcut kanonik çözüm durumu nedir?

### ☐ Final BOM bağlantısı
Item'ın raw/recipe çıktısı ile project-level Final BOM arasındaki mevcut durum nedir? Eksikse açık problem olarak kaydedilir.

### ☐ Gerçek BOM tüketici geçiş'ı
Yeni Item/recipe/resolver yolu yalnız tanımlanmış olmakla tamamlanmış sayılmaz. Raw BOM, Final BOM, debug veya ilgili gerçek tüketici hangi kaynağı kullanıyorsa yeni kanonik kimlik/bileşim/property yolunu gerçekten tükettiği doğrulanır. Kullanılmayan resolver veya paralel ikinci BOM yolu tamamlanmış migration sayılmaz.

---

# 9. Maliyet / fiyatlandırma ayrımı

Bu bölüm Item/BOM ile pricing sorumluluğunun contract'a uygun biçimde ayrıldığını doğrular.

### ☐ BOM yalnız ihtiyaç, miktar ve birim üretiyor mu?

### ☐ Fiyatlandırma ayrı bir katmanda mı?

### ☐ Birim fiyat değişikliği BOM reçetesini değiştirmeden yapılabiliyor mu?

---

# 10. Test ve kalite

Bu bölüm mevcut davranışın hangi testlerle korunduğunu doğrular.

### ☐ Mevcut testler
Item veya behavior family için hangi testler var?

### ☐ Kanonik property testleri
Intrinsic/default Item property'leri (`dimensions`, `thickness`, varsa `defaultColor`, `material` ve aileye özgü üstveri) doğru Item üzerinde ve doğru değerlerle kilitli mi?

### ☐ Property tüketici testleri
Business/runtime tüketicisinin kanonik Item property yolunu kullandığını, eski duplicate/default sabite geri dönemeyeceğini koruyan regression var mı?

### ☐ Ezme testleri
Ezme desteklenen property/state için kanonik default'un değişmeden kaldığı ve effective ezme davranışının doğru çalıştığı test ediliyor mu?

### ☐ State testleri
Oluşturucu/default/state mutation/kalıcılık davranışı test ediliyor mu?

### ☐ Behavior testleri
Yerleşim, move, snap, rotation, collision, connection vb. testleri var mı?

### ☐ Interaction testleri
Selection, drag, context menu, keyboard veya ilgili browser etkileşimleri test ediliyor mu?

### ☐ Relationship / reflow testleri
Relationship-derived davranış varsa test ediliyor mu?

### ☐ BOM testleri
Recipe/resolver/varyant/recursive BOM testleri var mı?

### ☐ Regression testleri
Mevcut davranış değişikliğini yakalayacak regression koruması var mı?

### ☐ Item-by-Item migration izolasyonu
Yalnız hedef Item'ın yeni kanonik kimlik/yola geçtiği; henüz migrate edilmeyen Item'ların mevcut kimlik/yolunda kaldığı test ile doğrulanıyor mu? Bir Item migration'ı komşu Item'ları sessizce toplu migrate etmemelidir.

### ☐ Persistence / migration testleri
Save/load ve migration davranışı test ediliyor mu?

### ☐ Browser akışı
Item'ın kritik kullanıcı akışı browser seviyesinde test ediliyor mu?

### ☐ Build durumu
İlgili branch/commit için build/test sonucu nedir?

---

# 11. Açık problemler

Bu bölüm mevcut sistemde Item contract'a göre eksik veya kararsız noktaları kaydeder.

### ☐ Audit finding bağlantıları
Item'ı etkileyen açık finding'ler hangileri?

### ☐ Eksik kanonik özellikler
Mevcut sistemde Item'a ait olduğu doğrulanan fakat kanonik Item tanımına taşınmamış property var mı?

### ☐ Eksik tüketici geçiş
Item property kanonik tanımda bulunmasına rağmen gerçek business/runtime tüketici hâlâ başka bir product/default sabitinden mi besleniyor?

### ☐ Eksik davranışlar
Mevcut sistemde tamamlanmamış veya contract'a göre eksik behavior var mı?

### ☐ Karar bekleyen noktalar
Ürün/mimari kararı gereken alan var mı? Doğrulanmamış `material`, renk veya ölçü tahmin edilmez; karar bekleyen alan olarak yazılır.

### ☐ Yeni Item sistemine taşınacak işler
Eski module/floor/başka yapıdan kanonik Item modeline taşınması gereken noktalar nelerdir?

### ☐ Duplicate tek kaynak
Kimlik, ürüne özgü/default property, ölçü, state, behavior, relationship veya BOM kuralı birden fazla yerde canonical/business tek kaynak olarak kopyalanmış mı?

### ☐ Ezme mı duplicate mı?
Başka yerde farklı bir değer bulunuyorsa gerçekten izin verilmiş project/runtime/renderer ezme mı, yoksa yanlışlıkla ikinci kanonik product/default değeri mi? Açıkça sınıflandırılır.

---

# BÖLÜM III — ITEM TAMAMLANMA KRİTERİ

Bir Item ancak aşağıdaki konular sistemden doğrulanıp kayıt altına alındığında tamamlanmış kabul edilir:

1. Kanonik `itemKey`, `type`, Item yapısı (tekil/bileşik) ve parametrik durumu.
2. Mevcut sistemde Item'ı tanımlayan bütün ürüne özgü/default property'lerin eksiksiz envanteri.
3. Item için geçerli bütün fiziksel ölçülerin (`width/height/depth/length/thickness` ve aileye özgü diğerleri) kanonik Item içinde bulunması.
4. Mevcutsa `defaultColor`, `material` ve diğer ürün/default üstverisinin kanonik Item içinde bulunması; mevcut değilse tahmin edilmeden açıkça `YOK/UYGULANMIYOR` denmesi.
5. Kanonik property'lerin gerçek business/runtime tüketicilerinin Item/resolver kaynağından beslenmesi; bağımsız ikinci product/default tek kaynak kalmaması.
6. Ezilebilir property/state alanlarının açık olması; kanonik default → ezme → effective value ayrımının tanımlanması.
7. Ezme kalıcılık/runtime sınırının doğrulanması.
8. Oluşturucu/oluşturulma noktası ve catalog bağlantısı.
9. Örnek state, default değerler, effective ölçüler ve configurable/ezme alanlar.
10. Persistence, save/load, migration ve örnek-ID mantığı.
11. Behavior kaynağı ve Item/type yetenek bağlantısı.
12. Yerleşim ve hareket davranışı.
13. Rotation desteği, rotation step, default rotation ve gerçek dönüş interaction'ları.
14. Collision, snap, boundary, connection, overlap ve ilgili behavior yetenek'leri.
15. Sol click, selection, drag, sağ click, context menu, keyboard ve diğer gerçek kullanıcı interaction'ları.
16. Renderer, asset, renk, image ve varsa özel görsel modlar; renderer ezme ile kanonik Item property ayrımı.
17. Parent/child, neighbor, connection, host, corner veya continuous-chain ilişkileri.
18. Relationship-derived behavior/reflow sonucu.
19. BOM policy, recipe/resolver, alt Item'lar, quantity ve unit.
20. Bileşik Item ise recursive BOM çözümü.
21. Varyant veya relationship-derived BOM durumu.
22. BOM ile pricing ayrımı.
23. Kanonik property, tüketici geçiş, ezme, state, behavior, interaction, BOM ve kalıcılık için gerekli regression koruması.
24. Build/browser kritik akış sonucu.
25. Açık audit/migration problemleri.

## Tamamlanmayı engelleyen hard-fail durumları

Aşağıdakilerden biri varsa Item **Tamam** olarak işaretlenemez:

- mevcut sistemde doğrulanmış ürüne özgü/default bir property kanonik Item tanımında yoksa,
- Item için geçerli gerçek bir ölçü (`thickness` dahil) bilindiği halde kanonik Item üstverisinde eksikse,
- mevcut ürün/default renk veya material bilgisi doğrulanmış olduğu halde Item'a taşınmamışsa,
- kanonik Item'da property var fakat gerçek business/runtime tüketici halen bağımsız ikinci product/default değerini tek kaynak olarak kullanıyorsa,
- duplicate tek kaynak ezme diye etiketlenmiş fakat gerçek bir ezme mekanizması/resolver sınırı yoksa,
- behavior/context-menu/yetenek mevcut olduğu halde `UYGULANMIYOR` denilerek atlanmışsa,
- gerekli BOM/tüketici/state/kalıcılık/relationship veya regression kontrolü sessizce atlanmışsa.

Specialized renderer'ın görsel/teknik ezme'ı tek başına hard-fail değildir; ancak renderer değeri business/product tek kaynak olarak kullanılıyorsa hard-fail'dir.

Bir alan bu Item için geçerli değilse sonuç **UYGULANMIYOR** olarak açıkça kaydedilir ve neden uygulanmadığı yazılır; kontrol sessizce atlanmaz.

Bir bilgi mevcut sistemde yoksa **YOK** olarak yazılır. Ürün kararı gereken `material`, renk, ölçü veya başka property tahmin edilmez.

Tahmin edilen davranış veya BOM değeri kabul edilmez. Item'a özgü değerler ilgili kanonik kod/state/recipe/test kaynağından doğrulanır.

---

# current-system/<ITEM>.md minimum kapsamı

> **Bayat (2026-10-27 denetimi):** `current-system` (2026-10-27: current-system belgeleri `kyrox-platform/archive/fair-stand/docs-items/current-system/` altına taşındı). Bu satır güncel kodla yeniden doğrulanmalı.

Her `docs/items/current-system/<ITEM>.md` dosyası en az aşağıdaki başlıkların tamamını sistemden çıkararak kayıt altına almalıdır. Başlık geçerli değilse yine açık sonuç yazılır:

> **Bayat (2026-10-27 denetimi):** `current-system` (2026-10-27: current-system belgeleri `kyrox-platform/archive/fair-stand/docs-items/current-system/` altına taşındı). Bu satır güncel kodla yeniden doğrulanmalı.

1. identity / type / unit / classification
2. ürüne özgü/default property envanteri
3. dimensions: width / height / depth / length / thickness / aileye özgü ölçüler
4. defaultColor / material / diğer product üstveri
5. oluşturucu / creation / catalog bağlantısı
6. örnek state / defaults / configurable-ezmes
7. yerleşim / move / snap
8. rotation / collision / connection / overlap / ghost
9. selection / drag / sağ click / context menu / keyboard
10. delete / duplicate / diğer yetenekler
11. kalıcılık / save-load / migration / örnek ID
12. relationships / parent-child / host / neighbor / reflow
13. BOM / recipe / quantity / unit / tüketici
14. renderer / asset / image / specialized ezme sınırı
15. kanonik property ve behavior tüketicileri / runtime owners
16. duplicate tek kaynak ve ezme ayrımı
17. mevcut regression/test kapsamı
18. açık gap / karar bekleyen alanlar

`current-system/<ITEM>.md` yalnız “kod zinciri özeti” değildir; migration öncesi Item'ın mevcut sistemdeki **tam envanteridir**.

> **Bayat (2026-10-27 denetimi):** `current-system` (2026-10-27: current-system belgeleri `kyrox-platform/archive/fair-stand/docs-items/current-system/` altına taşındı). Bu satır güncel kodla yeniden doğrulanmalı.

# definitions/<ITEM>.md minimum kapsamı

Her migrated Item'ın `docs/items/definitions/<ITEM>.md` dosyası current-system envanterini kanonik modele map etmeli ve en az şunları açıkça kaydetmelidir:

1. kanonik identity/type/unit,
2. kanonik ürüne özgü/default özellikler,
3. kanonik dimensions ve varsa defaultColor/material,
4. hangi property'lerin ezilebilir olduğu,
5. behavior/yetenek contract bağlantısı,
6. state/oluşturucu/kalıcılık sınırı,
7. relationships/composition/BOM sahipliği,
8. renderer/asset ezme sınırı,
9. gerçek tüketici geçiş durumu,
10. regression ve açık gap'ler.

`definitions/<ITEM>.md` içinde `UYGULANMIYOR` yalnız current-system analiziyle gerçekten geçerli olmadığı doğrulanmış alanlar için kullanılabilir.

---

# Mevcut sistemde doğrulama için ana kaynaklar

Bugünkü module tabanlı sistem incelenirken başlıca canonical/aktif kaynaklar şunlardır:

- Kimlik, label, type ve nominal catalog verileri: `src/catalog.js`
- Contract profile, state owner/kalıcılık, appearance/renderer ve BOM policy: `src/moduleContracts.js`
- State oluşturucu/default/örnek verileri: `src/designState.js`
- Yerleşim/move/collision/snap/ghost: `src/moduleBehavior.js` ve ilgili yerleşim akışı
- Sahne Z rotation: Item kolonları, `docs/refactor/ROTATION.md`
- Recipe BOM: Item `components` (`composition.items`) + `src/itemBom.js` `resolveItemBom`
- Tekil üretim kalemleri/production Item metadata'sı, dimensions ve intrinsic/default properties: `src/items.js`
- Context menu: `src/moduleContextMenu.js`
- Scene/selection/render interaction'ları: `src/scene3d.js` ve ilgili interaction dosyaları
- Theme/default appearance gibi Item'a ait olabilecek mevcut property adayları: `src/theme.js`, state/default kaynakları ve ilgili renderer girişleri
- Regression doğrulaması: `test/` altındaki ilgili testler

Bu kaynak listesi yeni Item mimarisinin nihai dosya yerleşimini zorunlu kılmaz; mevcut sistemi tahmin etmeden analiz etmek için kullanılan bugünkü kaynak haritasıdır.
