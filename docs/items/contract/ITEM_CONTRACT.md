# Fair Stand — Item Contract

Bu belge, Fair Stand içinde **BOM, üretim veya maliyet hesabına girebilen her fiziksel öğenin kanonik kök sözleşmesidir**.

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

## 2. Item kendi kanonik ürün/default özelliklerinin sahibidir

Bir Item'ı ürün olarak tanımlayan ve mevcut sistemde gerçek bir değeri bulunan ürüne özgü/default özellikler kanonik Item tanımında tutulur.

Bunlar Item'a göre değişebilir. Örnekler:

- `name`, `type`, `unit`,
- `dimensions.widthCm`, `heightCm`, `depthCm` (+ isteğe bağlı `mountHeightCm`, `wallGapCm`),
- `defaultColor`,
- `material`,
- ağırlık, yüzey, ürün ailesine özel sınıflandırma ve diğer ürüne özgü üstveri,
- kanonik default state/parametreler,
- Item/type behavior ve yetenek bağlantıları,
- `rotationStepDeg`, `defaultRotationDeg`, `sideInsertRotation` (yerleşen Item; leaf’te yok; `docs/refactor/ROTATION.md`),
- gerekiyorsa asset/model/reference üstverisi.

Bu alanların tamamı bütün Item'lar için zorunlu değildir. Örneğin `defaultColor` bir Item'da olabilir, başka bir Item'da olmayabilir. Ancak mevcut sistemde Item'ın ürün/default özelliği olarak doğrulanmış bir değer varsa migration sırasında sessizce dışarıda bırakılamaz.

### Kanonik tek kaynak ve tüketim

Item'a ait kanonik ürüne özgü/default bir özellik başka bir runtime dosyasında bağımsız ikinci business/product tek kaynak olarak tutulmaz. Bu özelliğe ihtiyaç duyan BOM, state oluşturucu, UI, behavior, resolver veya başka business/runtime tüketicisi kanonik Item kaynağından tüketmelidir.

Renderer veya özel render kodu görsel/teknik nedenle farklı bir değer kullanabilir. Proje örneği de kullanıcı/konfigürasyon/karar mekanizması nedeniyle kanonik varsayılanı ezebilir. Ezme geçerlidir; fakat kanonik varsayılan değerin Item'daki sahipliğini kaldırmaz.

Kanonik Item ürün/default veri otoritesi, Fair Stand ilişkisel Item store’udur; bu store kanonik catalog API / bootstrap üzerinden açılır. Static JS Item master kanonik otorite değildir. `items.js` repository / facade / yardımcı olabilir; 96 Item’lık static master olamaz. Catalog yalnız projeksiyondur. Item’ın kanonik asset referansı Item verisine aittir; GLB/JPG gibi fiziksel binary static storage’da kalabilir. Proje örneği state’i (yerleşim, yüzey ezmesi, `imageAssetId`) kanonik Item master değildir; otoritesi `fair_stand_projects` / `fair_stand_project_assets` (+ disk) olup tarayıcı IndexedDB yalnız önbellektir — bkz. `docs/refactor/DATABASE.md`.

Fiziksel tablo/API as-built anlatımı `kyrox-platform/projects/fair-stand/ITEM_CATALOG_ARCHITECTURE.md` dosyasındadır.

Kanonik çözüm sırası gerektiğinde şöyledir:

```text
kanonik Item varsayılanı
→ varsa proje/runtime ezme
→ geçerli iş değeri
```

Özel renderer ayrıca kendi görsel ezmesini uygulayabilir; bu render değeri kanonik ürün/iş tek kaynağı değildir.

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

Tek kanonik ürün kimliği `itemKey`dır. Category integer `id` ürün kimliği değildir; runtime onu Item kimliği olarak okumaz ve yazmaz.

---

## 6. Kanonik Item tanımı ile proje Item örneği ayrıdır

Kanonik tanım varsayılan ürünü/reçeteyi tanımlar. Projedeki örnek kendi `id`, ölçü, adet ve konfigürasyonunu taşıyabilir.

Örneğin standart masa-sandalye seti `1 masa + 4 sandalye` olabilir; belirli projede `1 masa + 2 sandalye` olarak kullanılabilir. Bu proje konfigürasyonu kanonik ürün tanımını değiştirmez.

Ezilebilir alanlar açıkça tanımlanır. Ezme kanonik Item property'sini silmez veya ikinci tek kaynak yaratmaz.

### Zemin kaplaması proje örneği

Zemin yeni bir Item ailesi değildir. Kaplama `type = floor` olan mevcut Item’dır. Baz kimlik `stand.itemKey` alanındadır. Eski kayıttaki `floorType` bu alana çözülür. `stand.floorColor` yalnız baz renktir.

İsteğe bağlı tek dikdörtgen `stand.floorArea` nesnesidir: `xCm`, `yCm`, `widthCm`, `depthCm`, `itemKey`, `color`. Dizi, çokgen veya delik değildir. Alan yoksa standın tamamı baz Item ile kaplıdır. Ölçüler 50 cm ve katlarıdır ve standın içinde kalır. `itemKey` mevcut bir floor Item olmalıdır. Boyanabilir override rengi `floorArea.color` alanındadır; parke rengi saklanmaz.

BOM, alan yokken veya override Item baz ile aynıyken tam stand formülünü kullanır. Override farklı bir floor Item ise baz kalan alan ve override ayrı satırdır. m² kaplanan alandır. Karolaj adedi 50 × 50 hücrelerin 100 × 100 karo havuzundan gelir. Aynı `itemKey` tek satırda toplanır. Render görüntüsü BOM kaynağı değildir.

Sahip: `src/floorArea.js`. Proje sürümü bu alan için artmaz.

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

BOM resolver gerektiğinde başka Item bileşimi olmayan Item'lara kadar recursive çözüm yapabilmelidir; bu Item'lar nihai BOM kalemlerini oluşturur.

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
5. Item için geçerli bütün gerçek ölçüler (`width/height/depth/length/thickness` ve aileye özgü diğerleri) eksiksiz mi?
6. Mevcutsa `defaultColor`, `material` ve diğer ürün/varsayılan üstveri Item'a taşındı mı?
7. Her kanonik özelliğin gerçek iş/runtime tüketicisi Item'dan mı okuyor?
8. Hangi property/state alanları ezilebilir; kanonik varsayılan ile ezme nasıl ayrılır?
9. Hangi davranış/yetenek sözleşmesini kullanır?
10. BOM reçetesi/resolver'ı nedir?
11. Nihai BOM kalemlerinin birimleri nelerdir?
12. Render/asset temsili nedir; renderer ezmesi kanonik Item özellik sahipliğinden nasıl ayrılır?
13. BOM, özellik tüketimi, davranış, state, kalıcılık ve tarayıcı akışı için hangi regresyon testleri gerekir?
14. Item'ın kanonik oluşturma mekanizması nedir ve hangi girişleri çözer?
15. Hangi state/ezme alanları kalıcı, hangileri geçicidir; kaydet/yükle ve migration nasıl çalışır?
16. Item'ın parent/child, komşu, bağlantı, host, köşe veya başka uzamsal ilişki kuralı var mı; kanonik çözümleyicisi nedir?
17. İlişki değişince reflow veya ilişkiden türeyen başka davranış oluşuyor mu; tetiklenme ve etki kuralları nelerdir?
18. Çift ürün/varsayılan tek kaynak kalmış mı?

Bu sorular cevaplanmadan yeni Item işi tamamlanmış sayılamaz.

# Tamamlanma sert kapısı

Bir Item aşağıdaki durumlardan biri varsa tamamlanmış sayılamaz:

- doğrulanmış ürüne özgü/varsayılan özellik kanonik Item'da yoksa,
- geçerli gerçek bir ölçü (`thickness` dahil) Item üstverisinde eksikse,
- doğrulanmış `defaultColor`, `material` veya aileye özgü özellik Item'a taşınmamışsa,
- Item'da özellik bulunmasına rağmen gerçek iş/runtime tüketici bağımsız ikinci ürün/varsayılan tek kaynak kullanıyorsa,
- davranış/bağlam menüsü/yetenek mevcut olduğu halde analizde sessizce atlanmışsa,
- çift tek kaynak gerçek ezme mekanizması olmadan `override` diye kabul edilmişse.

Özel renderer'ın yalnız görsel/teknik ezmesi tek başına sert başarısızlık değildir.

# Mimari ilişki

```text
Proje
  -> Item'lar
      -> kanonik itemKey
      -> kanonik ürün/varsayılan özellikler
      -> oluşturma (kanonik varsayılan + proje ezmesi)
      -> type / davranış ailesi / yetenekler
      -> proje örneği state + ezmeler
      -> kalıcılık
      -> ilişkiler
          -> ilişkiden türeyen davranış / reflow
      -> BOM çözümleyici
          -> alt Item'lar / bileşim
              -> nihai BOM kalemleri (itemKey + quantity + unit)
              -> fiyatlandırma / maliyet
```

Bu belge Item semantiğinin, kanonik property sahipliğinin ve BOM sahipliğinin kanonik sözleşmesidir. Sayısal runtime davranışlarının ikinci kopyası değildir; ayrıntılı runtime değerleri ilgili kanonik kod kaynaklarından okunur.
