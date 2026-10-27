# Fair Stand — Item Contract & Validation Checklist

Bu belge her Item için uygulanacak **zorunlu doğrulama checklist'idir**. Kanonik kurallar [ITEM_CONTRACT](ITEM_CONTRACT.md) dosyasındadır.

Amaç:

1. `ITEM_CONTRACT.md` kurallarının her Item'da karşılandığını adım adım doğrulamak.
2. Her Item incelenirken cevabı tahmin etmek yerine mevcut kanonik kod, state, contract, recipe, production-part ve test kaynaklarından çıkarmak.
3. Item'ı ilgilendiren mevcut ürün/default özelliklerinin kanonik Item tanımına taşındığını ve gerçek tüketicilerin bu kanonik kaynağı kullandığını zorunlu olarak doğrulamak.

Bu belge özel bir Item'a ait sayısal runtime değerlerinin ikinci kopyası değildir. Örneğin dönüş açısı, snap değeri, collision tipi, context-menu komutları veya BOM miktarları ilgili mevcut sistem kaynağından okunur.

---

# BÖLÜM I — KANONİK ITEM SÖZLEŞMESİ

Kurallar tek yerde, [ITEM_CONTRACT](ITEM_CONTRACT.md) dosyasındadır. Bu belge kuralları tekrar yazmaz; aşağıdaki doğrulama listesi o kurallara göre doldurulur.

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

# definitions/<ITEM>.md minimum kapsamı

Her migrated Item'ın `docs/items/definitions/<ITEM>.md` dosyası kanonik modeli koddan doğrulayarak en az şunları açıkça kaydetmelidir:

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

`definitions/<ITEM>.md` içinde `UYGULANMIYOR` yalnız kodda gerçekten karşılığı olmadığı doğrulanmış alanlar için kullanılabilir.

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
