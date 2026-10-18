import { getHelpStandardsTableHtml, getStandStandardsFacts } from './standStandardsCopy.js';
import { getFairStandHostDocument } from './hostDocument.js';
import { getMaxImageUploadMb } from './runtimeSettings.js';

function listGuideSections() {
  return [
  {
    title: 'Hızlı Başlangıç',
    open: true,
    html: `
      <p>Stand tipini seç, X ve Y ölçülerini gir; istersen <strong>Depo eklensin</strong> seçeneğini açıp 1×1, 1,5×1, 2×1 veya 2×2 m depo ölçüsünü belirle. <strong>Depo içeriği eklensin</strong> seçilirse Mini Buzdolabı, Kettle, Askılık ve Çöp Kutusu da otomatik yerleşir. Sonra <strong>Sahneyi Oluştur</strong> butonuna bas ve yalnızca proje/stand adını gir. Sistem stand tipi ve ölçülerini ada otomatik ekler, projeyi oluşturur ve ilk kaydı otomatik yapar.</p>
      <div class="help-guide-callout"><strong>Temel akış:</strong> Sahne oluştur + proje/stand adını gir → Otomatik proje adı oluşur → Proje otomatik kaydedilir → Modül ekle → Yerleştir → Panel seç → Renk / görsel / cam / Lightbox / Mesh uygula → Render Al.</div>
    `,
  },
  {
    title: 'Mouse Kontrolleri',
    html: `
      <table><tbody>
        <tr><th>Sol tık</th><td>Panel, modül veya zemini seçer.</td></tr>
        <tr><th>Modülü tut + sürükle</th><td>Modülü geçerli yerleşim kurallarına göre taşır.</td></tr>
        <tr><th>Ctrl/Cmd + tık</th><td>İlk panel ile tıklanan panel arasında çoklu panel seçimi yapar.</td></tr>
        <tr><th>Shift + tık (öğe üstünde)</th><td>Öğeyi toplu seçime ekler veya çıkarır. Sağ tıkla seçilenlerin hepsi birden kilitlenir veya kilidi açılır. Boş alanda Shift kamerayı etkilemeye devam eder.</td></tr>
        <tr><th>Boş alanda sol sürükle</th><td>Kamerayı stand etrafında döndürür.</td></tr>
        <tr><th>Orta tuş / tekerleğe basılı sürükle</th><td>Kamerayı yatay-dikey kaydırır (pan).</td></tr>
        <tr><th>Mouse tekerleği</th><td>Yakınlaştırır / uzaklaştırır.</td></tr>
        <tr><th>Sağ tık</th><td>Modül veya panel için bağlama göre işlem menüsünü açar.</td></tr>
      </tbody></table>
    `,
  },
  {
    title: 'Klavye Kısayolları',
    html: `
      <table><tbody>
        <tr><th>P</th><td>Perspektif kamera görünüşüne geçer.</td></tr>
        <tr><th>O</th><td>Ortografik kamera görünüşüne geçer.</td></tr>
        <tr><th>L</th><td>ViewCube Sol (Left) görünüşüne geçer.</td></tr>
        <tr><th>R</th><td>ViewCube Sağ (Right) görünüşüne geçer.</td></tr>
        <tr><th>T</th><td>ViewCube Üst (Top) görünüşüne geçer.</td></tr>
        <tr><th>F</th><td>ViewCube Ön (Front) görünüşüne geçer.</td></tr>
        <tr><th>H</th><td>Home görünüşüne döner. L Stand Sağ’da sol-ön köşeden bakar. Diğer stand tiplerinde sağ-ön köşeden bakar. ViewCube ⌂ aynı görünüşü açar.</td></tr>
        <tr><th>Shift + R</th><td>Seçili modülü saat yönünde döndürür. Sürükleme sırasında da kullanılabilir.</td></tr>
        <tr><th>↑ ↓ ← →</th><td>Seçili modülü kendi snap adımına göre ekranda görülen yöne taşır.</td></tr>
        <tr><th>Delete</th><td>Sahnede tek modül seçiliyse modülü siler (kilitli değilse). Görsel kütüphanesinde bir görsel seçili/odaktaysa görsel silme uyarısını açar.</td></tr>
        <tr><th>Ctrl/Cmd + Z</th><td>Tasarımdaki son değişikliği geri alır: taşıma, döndürme, ekleme, silme, çoğaltma, renk, görsel, cam, separatör, kumaş, kilit ve zemin. Üst banttaki <strong>Geri al</strong> düğmesi de aynı işi yapar.</td></tr>
        <tr><th>Ctrl/Cmd + Y veya Ctrl/Cmd + Shift + Z</th><td>Geri alınanı ileri alır. Üst banttaki <strong>İleri al</strong> düğmesi de aynı işi yapar.</td></tr>
        <tr><th>Esc</th><td>Açık sağ tık menüsü, katalog veya yardım penceresini kapatır.</td></tr>
        <tr><th>Enter</th><td>X/Y alanlarında uygunsa sahne oluşturmayı; proje adı popupında onaylamayı tetikler.</td></tr>
      </tbody></table>
      <p class="help-guide-note">Geri al: Her işlem tek adımdır. Sürükleme sırasındaki ara konumlar ve basılı tutulan ok tuşu tek adım sayılır. Son 50 adım tutulur. Geçmiş kaydedilmez; proje açılınca, yeni proje kurulunca veya sayfa yenilenince sıfırlanır. Görsel kütüphanesinden bir görsel silinince de sıfırlanır, çünkü silinen görsele geri dönülemez. Geçmiş revizyon görünümünde geri alma kapalıdır. Metin kutularında Ctrl+Z yalnız yazıyı geri alır.</p>
      <p class="help-guide-note">Not: Döndürme adımı modüle göre değişebilir. Standart modüllerde çoğunlukla 90°, bazı banko ve ürünlerde 45° kullanılabilir.</p>
      <p>ViewCube yüzüne tıklamak o görünüşe geçer; klavyede olmayan arka ve alt da buradadır. ⌂ ve H aynı home görünüşüdür: L Stand Sağ sol-ön, diğer tipler sağ-ön. Sahne ilk açıldığında kamera sağ-ön köşededir. Küpü sürüklemek kamerayı döndürür.</p>
    `,
  },
  {
    title: 'Sağ Tık Menüsü',
    html: `
      <p>Menü içeriği seçilen modül veya panelin desteklediği özelliklere göre değişir.</p>
      <ul>
        <li><strong>Kilitle / Kilidi aç:</strong> Öğeyi bulunduğu yere sabitler. Kilitli öğe sürüklenemez, ok tuşlarıyla taşınamaz, döndürülemez, boyutlandırılamaz ve silinemez. Yanına ekleme veya başka bir öğenin taşınması onu kaydıracaksa işlem yapılmaz. Renk, görsel, cam, separatör ve kumaş kilitliyken de değiştirilebilir. Kilit projeyle kaydedilir. Shift ile toplu seçimde menü <strong>Seçilenleri kilitle / Seçilenlerin kilidini aç</strong> olur.</li>
        <li><strong>Sil:</strong> Modülü sahneden kaldırır. Kilitli öğede pasiftir.</li>
        <li><strong>Çoğalt Sağ / Sol:</strong> Aynı modülün kopyasını belirtilen tarafa ekler. Kilitli öğenin kopyası kilitsiz gelir. Kopyadaki metal separatör kendi grubunu alır; kopyada kapatmak orijinali etkilemez.</li>
        <li><strong>Boyutlandır…:</strong> Işıklı Strafor seçiliyken mevcut X/Y ölçülerini açar; yeni ölçüler girildiğinde aynı modül konumu ve ışık rengi korunarak yeniden boyutlandırılır.</li>
        <li><strong>Ölçü / opacity…:</strong> Kutu blok seçiliyken genişlik, derinlik, yükseklik ve 0–1 opacity açılır. Yüzler, renk ve taşıma <strong>Kutu Blok</strong> bölümündedir.</li>
        <li><strong>Kutu yürütme:</strong> Ok tuşları kutuyu sağa, sola, ileri, geri ve yukarı, aşağı yürütür. Taban zeminin altına inmez. Kutunun tepesi stand tavanını geçmez.</li>
        <li><strong>Görseli ölçülendir…:</strong> Görsel, Lightbox veya Mesh görseli atanmış yüzeyde açılır. Başlangıç ölçüsü seçili alanın kendi ölçüsüdür. Küçültünce boşluklar tekrarlanır, büyütünce görsel alanın dışına taşar. Aynı ölçü penceresi panel, Lightbox ve Mesh için geçerlidir.</li>
        <li><strong>Cam Panele Çevir / Normal Panele Çevir:</strong> Uygun panelin cam durumunu değiştirir.</li>
        <li><strong>Metal Separatöre Çevir / Normal Panele Çevir:</strong> Uygun paneli tel ızgaraya çevirir. Deliklerden arkası görünür. Ctrl ile seçilen tam dikdörtgen tek ölçüdür.</li>
        <li><strong>Lightbox Kumaşa Çevir / Lightbox Kumaştan Çıkar:</strong> Uygun panel bloğunu tek parça opak Lightbox Kumaşa dönüştürür veya geri alır.</li>
        <li><strong>Mesh (Delikli) Brandaya Çevir / Mesh Brandadan Çıkar:</strong> Aynı panel bloğunu gerçek delik maskeli Mesh Branda olarak kullanır; deliklerden sahnenin arkası görünür.</li>
        <li><strong>Lightbox aydınlatmayı aç / kapat:</strong> Bez yüzeyinin aydınlatmasını kontrol eder.</li>
        <li><strong>Raf altı aydınlatmayı aç / kapat:</strong> Raf modülündeki LED görünümünü kontrol eder.</li>
        <li><strong>Ekle Sağ / Sol Tarafa…:</strong> Hedef modülün yanına katalogdan yeni modül ekler.</li>
      </ul>
    `,
  },
  {
    title: 'Gruplar',
    html: `
      <p>Grup, istediğin öğeleri tek bir isimli küme yapar: duvar paneli, profil, lamba, logo, TV, kutu blok, masa, sandalye; türü fark etmez. Grup BOM'a ve maliyete girmez; parçalar bugünkü gibi girer.</p>
      <ul>
        <li><strong>Grup oluştur:</strong> Shift+tık ile en az 2 öğe seç, birinin üstünde sağ tık → <strong>Grup oluştur…</strong> → isim ver. Stand kenarına bağlı duvar parçaları gruplanınca kenardan ayrılır; yerleri değişmez ve grup her yöne taşınabilir.</li>
        <li><strong>Gruba ekle:</strong> Bir grubun parçasıyla birlikte grupsuz öğeleri Shift+tık ile seç, sağ tık → <strong>Gruba ekle: &lt;grup&gt;</strong>.</li>
        <li><strong>Bir öğe tek grupta olur:</strong> Başka gruptaki bir öğeyi eklemek istersen önce sorulur: “Bu gruptan çıkarılıp … grubuna eklensin mi?” Hayır dersen hiçbir şey değişmez.</li>
        <li><strong>Taşıma:</strong> Gruptaki herhangi bir öğeyi sürükle ya da ok tuşuna bas: bütün grup aynı mesafe kayar. Tek kısıt: hiçbir parça stand alanının dışına çıkamaz; grup kenarda durur. Başka öğelerle üst üste gelme engellenmez.</li>
        <li><strong>Döndürme (Shift+R):</strong> Gruptaki bir öğe seçiliyken Shift+R bütün grubu grubun ortası etrafında 45° döndürür; parçalar birbirine göre yerini korur. Gruptaki duvar, kapı ve paneller de 45° açıya geçebilir. Döndürülmüş grup standa sığmazsa işlem yapılmaz. Kilitli grup döndürülmez. Gruptaki öğe tek başına döndürülemez; tek öğeyi döndürmek için önce gruptan çıkar.</li>
        <li><strong>Tık:</strong> Bugünkü gibi paneli seçer (renk ve görsel verilebilir); grubun diğer parçaları çerçeveyle gösterilir.</li>
        <li><strong>Sağ tık menüsü (gruptaki öğe):</strong> Grubu yeniden adlandır, Grubu kilitle / kilidini aç, Grubu çoğalt, Bu parçayı gruptan çıkar, Grubu çöz, Grubu sil.</li>
        <li><strong>Grubu kilitle:</strong> Bütün parçalar kilitli olur: taşınamaz, döndürülemez, boyutlandırılamaz ve silinemez. Kilitli gruptaki tek parçanın kilidi açılamaz; önce grubun kilidi açılır. Kilitliyken adlandırma ve çoğaltma yapılabilir.</li>
        <li><strong>Grubu çoğalt:</strong> Bütün parçalar renk ve görselleriyle kopyalanır; kopya “… (kopya)” adıyla yeni, kilitsiz bir grup olur ve grubun yanına (sağ, sol, ön veya arka) konur. Standda yer yoksa uyarı verilir ve hiçbir şey eklenmez.</li>
        <li><strong>Grubu sil:</strong> “Grubun tamamı silinecek (N parça)” onayı istenir. Delete tuşu yalnız seçili parçayı siler.</li>
        <li><strong>Grubu çöz / gruptan çıkar:</strong> Parçalar yerinde kalır. Kenardan ayrılmış duvar parçası hâlâ aynı kenar çizgisindeyse kenara geri bağlanır. Grupta tek parça kalırsa grup kendiliğinden çözülür.</li>
        <li><strong>Gruplar kartı:</strong> Kenar çubuğunda grupları, parça sayısını ve kilidi listeler. Seç, Kilitle, Adlandır, Çoğalt, Çöz, Sil düğmeleri ve parça listesi buradadır; parçaya tıklayınca sahnede seçilir.</li>
        <li><strong>Kayıt ve geri alma:</strong> Gruplar projeyle kaydedilir, içe/dışa aktarılır; Ctrl+Z grup işlemlerini de geri alır. Kenardan ayrılan duvar parçaları duvar kapasitesi hesabına ve otomatik duvar lambası dizisine girmez.</li>
      </ul>
    `,
  },
  {
    title: 'Panel Seçimi ve Çoklu Seçim',
    html: `
      <p>Tek panel için normal sol tık kullanılır. Çoklu seçimde önce başlangıç panelini seç, ardından <strong>Ctrl/Cmd + tık</strong> ile diğer sınır paneline tıkla.</p>
      <ul>
        <li>Panel seçimi fiziksel panel yüzeylerini esas alır.</li>
        <li>Bağlı duvar/köşe düzenlerinde seçim duvar zinciri boyunca devam edebilir.</li>
        <li>Lightbox Kumaş, Mesh Branda veya Metal Separatör için seçim daha katıdır: eksiksiz dikdörtgen ve aynı düzlem şarttır.</li>
      </ul>
    `,
  },
  {
    title: 'Modül Taşıma, Döndürme ve Yerleşim',
    html: `
      <p>Modüller serbestçe görünse de bırakıldıkları konum sistem kurallarıyla doğrulanır. Stand sınırı, çarpışma ve modülün kendi snap adımı kontrol edilir.</p>
      <ul>
        <li>Duvar modülleri çoğunlukla 50 cm adımla hareket eder.</li>
        <li>Mobilya ve bazı serbest objeler genellikle 10 cm adım kullanır.</li>
        <li>LED projektör gibi üst elemanlarda farklı snap adımı uygulanabilir.</li>
        <li>Geçersiz yerleşim kabul edilmez; modül eski/geçerli konumunda kalır.</li>
        <li>Birden fazla modülü kaplayan tek parça Lightbox/Mesh kaplamasına bağlı modül tek başına taşınamaz veya döndürülemez; önce kaplama kaldırılmalıdır.</li>
      </ul>
    `,
  },
  {
    title: 'Renk Uygulama',
    html: `
      <p>Uygun panel, modül yüzeyi veya boyanabilir zemin seçildikten sonra aktif renk uygulanabilir.</p>
      <ul>
        <li>HEX, RGB ve CMYK alanları birbirine senkron çalışır.</li>
        <li>RGB aralığı 0–255, CMYK aralığı %0–100'dür.</li>
        <li>Hazır parke kaplamalarında doğrudan renk boyama yerine hazır malzeme kullanılır.</li>
      </ul>
    `,
  },
  {
    title: 'Görsel Kütüphanesi ve Görsel Uygulama',
    html: `
      <ul>
        <li><strong>Dosya Seç:</strong> Görseli aktif projenin görsel arşivine ekler. En fazla ${getMaxImageUploadMb()} MB; aşıldığında popup uyarır. Büyük görseller sahne için küçültülür; şeffaf arka plan korunur. SVG olduğu gibi kalır.</li>
        <li><strong>Doldur:</strong> Alanı tamamen kaplar; gerekirse görüntüyü kırpar.</li>
        <li><strong>Sığdır:</strong> Görselin tamamını seçili alana sığdırır.</li>
        <li><strong>Ölçü:</strong> Sağ tık → Görseli ölçülendir. Panel, Lightbox ve Mesh görseli aynı pencereden ölçülür. Seçili alanın kendi ölçüsü başlangıçtır; 400×200 alandaki görsel önce 400×200 oturur. 300×150 yazınca daralır ve boşluk tekrarlanır, 500×300 yazınca alanın dışına taşar. Tek panelde de aynıdır.</li>
        <li><strong>Kaldır:</strong> Görseli panel/bez üzerinden kaldırır; kütüphaneden silmez.</li>
        <li>Dikdörtgen çoklu panel seçiminde tek büyük görsel panellere bölünerek uygulanabilir.</li>
        <li>Lightbox Kumaşa ve Mesh Brandaya görsel tek parça olarak uygulanır.</li>
      </ul>
      <h4>Görsel silme</h4>
      <p>İki yöntem vardır: görsel üzerinde <strong>sağ tık → Sil</strong> veya görsele normal tıklayıp <strong>Delete</strong> tuşuna basmak.</p>
      <p>Görsel sahnede kullanılıyorsa önce uyarı gösterilir. Onaylanırsa görsel hem kütüphaneden silinir hem de atandığı panel/bezlerden anında kaldırılır.</p>
    `,
  },
  {
    title: 'Işıklı Strafor',
    html: `
      <p>Işıklı Strafor, SVG logoyu 3B strafor gövde ve arka halo ışığıyla duvar üzerine yerleştirir. Özellik yalnızca SVG görsellerde kullanılabilir.</p>
      <h4>Oluşturma</h4>
      <ol>
        <li>SVG dosyasını Görsel Kütüphanesine yükle.</li>
        <li>Görsel üzerinde <strong>sağ tık → Işıklı Strafora Dönüştür</strong> seç.</li>
        <li>Açılan pencerede gerçek dış ölçüyü <strong>X · Genişlik (cm)</strong> ve <strong>Y · Yükseklik (cm)</strong> olarak gir.</li>
        <li>Mouse ile duvara götürüp uygun konuma bırak.</li>
      </ol>
      <ul>
        <li>Strafor gövde kalınlığı sabit <strong>3,5 cm</strong>'dir.</li>
        <li>Duvar ile strafor arasında sabit <strong>1,5 cm</strong> ışık boşluğu vardır.</li>
        <li>X ve Y ölçüleri birbirinden bağımsızdır; girilen değerler sahnedeki gerçek dış ölçüyü belirler.</li>
        <li>Ön yüzde SVG'nin kendi renkleri korunur.</li>
      </ul>
      <h4>Sonradan boyutlandırma</h4>
      <p>Sahnedeki strafora <strong>sağ tık → Boyutlandır…</strong> ile mevcut X/Y ölçülerini tekrar açabilirsin. Yeni ölçüler uygulandığında modülün mevcut konumu, SVG görseli ve ışık rengi korunur.</p>
      <h4>Işık rengini değiştirme</h4>
      <p>Işıklı Straforu seçtiğinde sol taraftaki <strong>Seçili yüzey</strong> bölümünde <strong>Işıklı Strafor · Işık rengi</strong> kontrolü görünür. Renk seçici yalnızca arkadaki halo ışığını değiştirir; SVG'nin ön yüz renklerini değiştirmez.</p>
      <p class="help-guide-note">Yerleştirme sırasında Esc tuşu ile işlem iptal edilebilir. Strafor, duvar üstü modül gibi taşınır ve kendi hareket snap adımını kullanır. Yerleştirilemezse uyarı modülün adıyla ve gerçek sebeple çıkar (ör. Başka modülle çakışıyor.).</p>
    `,
  },
  {
    title: 'Kutu Blok',
    html: `
      <p><strong>Kutu blok</strong> katalogdan sahneye bırakılan serbest bir küptür. Duvara yapışmaz. Zeminde durur; istenirse yukarı kaldırılır.</p>
      <h4>Yerleştirme</h4>
      <p>Katalog kartını bırakınca <strong>W · Genişlik</strong>, <strong>D · Derinlik</strong>, <strong>H · Yükseklik</strong> ve <strong>Opacity (0–1)</strong> sorulur. Aynı pencere sonradan sağ tık <strong>Ölçü / opacity…</strong> ile açılır. Saydamlık kutunun tamamına uygulanır.</p>
      <h4>Gövde ve dört yüz</h4>
      <p>Üst ve alt yüze görsel, Lightbox veya Mesh uygulanmaz. Ön, sağ, arka ve sol yüz ayrıdır; kutu dönünce bu yüzler de döner. Bir yüze tıklayınca o yüz panellerdeki gibi mavi çerçeve ile seçilir. Gövdeye ya da üst ve alt kapağa tıklamak kutunun kendisini seçer.</p>
      <ul>
        <li>Gövde seçiliyken renk gövdeye gider. Yüz seçiliyken renk o yüze gider.</li>
        <li>Seçilen yüze görsel sürüklenebilir. Aynı yüze Lightbox veya Mesh de uygulanır. Bu üçü item satırındaki bayraklardan açılır. Cam uygulanmaz.</li>
        <li>Lightbox aydınlatması yalnız o yüzde yanar; küpün gövdesi yanmaz.</li>
        <li>Mesh deliklerinden kutunun kendi gövdesi görünür.</li>
        <li>Yüzde görsel, Lightbox veya Mesh görseli varken sağ tık <strong>Görseli ölçülendir…</strong> panellerdeki ölçü penceresini açar. Başlangıç o yüzün kendi santimidir. Küçültünce boşluk tekrarlanır, büyütünce görsel taşar.</li>
      </ul>
      <h4>Kutu yürütme</h4>
      <ul>
        <li>Ok tuşları ekranda görünen yöne gider: sağa, sola, ileri, geri ve yukarı, aşağı. Adım 10 cm’dir.</li>
        <li>Taban zeminin altına inmez. Kutunun tepesi stand tavanını geçmez.</li>
        <li>Kutuyu zeminde sürüklemek yüksekliği bozmaz.</li>
        <li><strong>Shift+R</strong> kutuyu 45° döndürür.</li>
      </ul>
    `,
  },
  {
    title: 'Cam Panel',
    html: `
      <p>Cam özelliğini destekleyen paneli seçip sağ tık menüsünden <strong>Cam Panele Çevir</strong> seçeneğini kullanabilirsin. Aynı menüden tekrar normal panele döndürülebilir.</p>
      <p class="help-guide-note">Cam görsel/şeffaf baskı davranışları geliştikçe bu bölüm güncellenecektir.</p>
    `,
  },
  {
    title: 'Metal Separatör',
    html: `
      <p>Cam kabul eden paneli seçip sağ tık menüsünden <strong>Metal Separatöre Çevir</strong> seçeneğini kullanabilirsin. Aynı menüden normal panele döner.</p>
      <ul>
        <li>Tek panel kendi ölçüsüdür. <strong>Ctrl</strong> ile seçilen eksiksiz dikdörtgen tek ölçüdür: yan yana enler, üst üste boylar toplanır.</li>
        <li>Aynı grup her zaman tek levha değildir. Modül silinir ya da taşınırsa veya satırlar arasında boşluk kalırsa liste her bitişik bloğu ayrı levha yazar. Örnek: 197 + 98 cm arada boşlukla → <strong>1 x 197 × 47</strong> + <strong>1 x 98 × 47</strong>. Toplam m² değişmez.</li>
        <li>Izgara gerçek teldir. Karelerin içi boştur; açı değişince çizgi kaybolmaz.</li>
        <li>Paneller satırı parça adedini ve ölçüyü yazar: <strong>7 x Metal Separatör 100 × 49,5 cm - metre_kare</strong>.</li>
        <li>Üretim satırı o parçaların metrekare toplamını Tül satırı gibi yazar: <strong>3,47 × Metal Separatör · metre_kare · metal_separator</strong>.</li>
        <li>Kalem katalogda görünmez. Maliyet fiyatı bu gizli kaleme, metre kare üzerinden yazılır.</li>
      </ul>
    `,
  },
  {
    title: 'Lightbox Kumaş / Mesh Branda',
    html: `
      <p>Lightbox Kumaş veya Mesh Branda tek panelde de oluşturulabilir; birden fazla panelde seçim eksiksiz dikdörtgen ve aynı düzlemde olmalıdır.</p>
      <ul>
        <li>Her iki kaplamaya da renk ve görsel uygulanabilir.</li>
        <li>Doldur ve Sığdır seçenekleri kullanılabilir.</li>
        <li>Lightbox aydınlatması açılıp kapatılabilir ve ışık açıkken yüzey %100 opaktır.</li>
        <li>Mesh Branda aydınlatılmaz; delikli alpha maskesi sayesinde arka sahne görünür.</li>
        <li>Lightbox Kumaştan Çıkar ile normal panel sistemine dönülür.</li>
        <li>Tek parça Lightbox/Mesh kaplaması birden fazla modülü kapsıyorsa bu modüllerden biri tek başına taşınamaz/döndürülemez.</li>
      </ul>
    `,
  },
  {
    title: 'Raf Aydınlatması',
    html: `
      <p>Raf modülünde sağ tık menüsünde <strong>Raf altı aydınlatmayı aç / kapat</strong> seçeneği görünür. Bu seçenek sadece destekleyen raf modüllerinde gösterilir.</p>
    `,
  },
  {
    title: 'Modül Ekleme ve Katalog',
    html: `
      <ul>
        <li>Sahne oluşturulduktan sonra Modül Ekle aktif olur.</li>
        <li>Modül Ekle’nin üstündeki katalog kartı sahneye sürüklenebilir. Sürüklerken <strong>Shift+R</strong> saat yönünde döndürür ve açıyı kilitler.</li>
        <li><strong>Sahneyi Sıfırla:</strong> stand tipi, ölçü ve Zemin Kaplaması seçimi kalır; sahnedeki modüller ve zemin alanı silinir.</li>
        <li>Katalogdan bir veya birden fazla modül seçilebilir.</li>
        <li>Aynı modül birden fazla kez seçim sırasına eklenebilir.</li>
        <li>Seçim sırasındaki modüller sürüklenerek yeniden sıralanabilir.</li>
        <li>Modüller duvarın sonuna veya seçili modülün sağ/sol tarafına eklenebilir.</li>
        <li>Yerleşim bırakılmadan önce sistem tarafından doğrulanır.</li>
      </ul>
    `,
  },
  {
    title: 'Stand Oluşturma ve Sistem Standartları',
    html: getHelpStandardsTableHtml(),
  },
  {
    title: 'Zemin',
    html: `
      <p>Mevcut seçenekler: Karolaj ${getStandStandardsFacts().gridWidthCm} × ${getStandStandardsFacts().gridDepthCm} cm, Halı, Beyaz Meşe, Sarı Meşe ve Beton Parke.</p>
      <p><strong>Zemin Kaplaması</strong> standın tamamının baz kaplamasıdır. Sahne oluştuktan sonra içine tek bir dikdörtgen eklenebilir. Dikdörtgenin dışı baz kaplama kalır.</p>
      <ul>
        <li><strong>Zemin Alanı Ekle</strong> bir dikdörtgen açar. X, Y, genişlik ve derinlik 50 cm ve katlarıdır ve standın içinde kalır.</li>
        <li><strong>Alan kaplaması</strong> aynı zemin seçeneklerinden biridir.</li>
        <li><strong>Sahnede Çiz</strong> ile dikdörtgen zemin üzerinde yeniden çizilir.</li>
        <li><strong>Zemin Alanını Sil</strong> dikdörtgeni kaldırır. Stand yine tek baz kaplamadır.</li>
        <li>Aynı anda yalnız bir alan vardır.</li>
      </ul>
      <p>Baz zemine veya alana tıklayınca o yüzey seçilir. Boyanabilir kaplamada Aktif renk uygulanır. Hazır parke kendi malzemesini kullanır ve boyanmaz. Alanın rengi baz renkten ayrıdır.</p>
    `,
  },
  {
    title: 'Proje Kaydetme, Açma ve Yedekleme',
    html: `
      <ul>
        <li><strong>Yeni proje:</strong> Ayrı bir “Yeni” butonu yoktur. Stand Tipi bölümündeki <strong>Sahneyi Oluştur</strong> yeni proje başlatır ve yalnızca proje/stand adını sorar. Tam ad otomatik olarak <strong>Proje_adi-StandTipi_X_Y</strong> biçiminde oluşturulur; örneğin <strong>Ferromet-L_Sol_800_600</strong>.</li>
        <li><strong>Proje adını değiştir:</strong> <strong>Değiştir</strong> butonu yalnızca tireden önceki proje/stand adı bölümünü düzenler. Otomatik <strong>StandTipi_X_Y</strong> bölümü korunur; örneğin <strong>Ferromet-L_Sol_800_600</strong> adı <strong>Umaay-L_Sol_800_600</strong> olarak değiştirilebilir.</li>
        <li><strong>Farklı Kaydet:</strong> sahne varken aktiftir. Mevcut sahneyi yeni proje UUID’si ve yeni görsel klasörüyle kopyalar; müşteri aynı kalır. Ad diyaloğu <strong>Yeni Proje</strong> ile aynı kuralı kullanır: stand adı + otomatik <strong>StandTipi_X_Y</strong>. Önerilen ön ek <strong>(1)</strong> ile biter. Eski proje olduğu gibi kalır. Sahne yokken kapalıdır.</li>
        <li><strong>Kaydet:</strong> sahne varken stand, modüller, yerleşimler ve proje durumunu kaydeder. Sahne yokken kapalıdır.</li>
        <li><strong>Otomatik kayıt:</strong> Kayıtlı/açılmış projede değişiklik, Kaydet düğmelerinin altındaki <strong>Otomatik kayıt</strong> listesinde seçilen süre içinde kaydedilir: <strong>3, 5, 7 veya 10 dk</strong> (varsayılan 3 dk). Sürekli düzenlemede de en geç bu süre dolunca kaydedilir. <strong>Kapalı (Otomatik Kayıt Kapalı)</strong> seçilirse süreli kayıt yapılmaz; durum satırında “Kaydedilmemiş değişiklik var” yazar ve <strong>Kaydet</strong> ile elle kaydedilir. Seçim bu tarayıcıda hatırlanır, projeye yazılmaz.</li>
        <li><strong>Kaydedilmemiş değişiklik koruması:</strong> Kayıtlı projede kaydedilmemiş değişiklik varken sekme gizlenir veya editörden çıkılırsa değişiklik hemen kaydedilir; otomatik kayıt kapalı olsa da bu koruma çalışır. Sayfa kapatılmak veya yenilenmek istenirse tarayıcı uyarı gösterir.</li>
        <li><strong>Müşteri adı:</strong> Açık projenin bağlı olduğu müşterinin adı, proje adının üstünde görünür. Başka projeler bu ekranda listelenmez; yalnız açık proje üzerinde çalışılır.</li>
        <li><strong>Aç:</strong> Açık projeyi görselleriyle birlikte yeniden yükler. Bir görselin dosyası bulunamazsa proje yine açılır; o yüzey kendi rengiyle gösterilir ve durum satırında kaç görselin bulunamadığı yazar. Görsel bağlantısı projede kalır, dosya geri gelirse görsel yeniden görünür.</li>
        <li><strong>Dışarı Aktar:</strong> Proje ve görselleri ZIP dosyasına paketler.</li>
        <li><strong>İçe Aktar:</strong> Uyumlu proje ZIP paketini sisteme alır. Her proje bir müşteriye bağlıdır: paket müşteri bilgisi taşımıyorsa ve editör müşterisiz açıldıysa içe aktarma yapılmaz; Müşteriler → müşteri → Yeni Proje ile açılan editörde İçe Aktar kullanılır.</li>
        <li><strong>Sil:</strong> Projeyi ve projeye ait görselleri onay sonrası kaldırır. Silinen proje açıksa sayfa yenilenmez; sahne ilk açılıştaki boş duruma döner.</li>
      </ul>
    `,
  },
  {
    title: 'Render Al',
    html: `
      <p><strong>Render Al</strong>, mevcut kamera görünümünü yüksek çözünürlüklü PNG olarak indirir. Dosya adı proje adından üretilir.</p>
      <p>Seçim çerçeveleri ve yardımcı duvar çizgileri render çıktısına dahil edilmez.</p>
      <p><strong>Üretim Listesi</strong>, sahne kurulunca Render Al’ın yanında açılır. Panel sürüklenebilir, boyutu değişir ve <strong>Ayrı pencere</strong> ile dışarı alınır. <strong>Metin indir</strong> aynı listeyi metin dosyası olarak kaydeder.</p>
      <p>Baskı satırları Dijital Baskı, Lightbox Bezi, Mesh - Delikli Branda ve Işıklı Strafor / Logo başlıklarının altındadır. Satırda görselin dosya adı, cm ölçüsü ve m² yazar. Aynı görsel aynı ölçüdeyse adet birleşir. Aynı görsel farklı ölçülerdeyse satırlar ayrı kalır ve altında o görselin toplam m²’si yazar. Lightbox veya mesh görsel atanmadan çevrilirse satırda o panelin rengi hex olarak yazar. Ölçü, panelde scene dimensions varsa oradan, o alan boşsa item dimensions değerinden gelir.</p>
    `,
  },
  {
    title: 'Önemli Kurallar ve Uyarılar',
    html: `
      <ul>
        <li>Çoklu panel seçimi ile Lightbox/Mesh oluşturma aynı kural değildir; kaplama için aynı düzlem ve eksiksiz dikdörtgen zorunludur.</li>
        <li>Geçersiz modül yerleşimleri ve çarpışmalar sistem tarafından engellenir; uyarı modülün adını ve sebebini yazar.</li>
        <li>Kütüphaneden kullanılan bir görsel silinirse, onay sonrası atandığı yüzeylerden de kaldırılır.</li>
        <li>Birden fazla modülü kapsayan tek parça bez varken bağlı modüller ayrı ayrı taşınamaz/döndürülemez.</li>
        <li>Sağ tık menüsündeki seçenekler her modülde aynı değildir; yalnız desteklenen işlemler gösterilir.</li>
        <li><strong>Tüm Özellikleri Kaldır:</strong> görsel, cam, renk ve panel özelleştirmelerini varsayılana döndürür. Işıklı Strafor sahneden silinir. Modül türü, genişlik, sıra ve yerleşim kalır.</li>
      </ul>
    `,
  },
  ];
}

function createGuideSection(section) {
  const document = getFairStandHostDocument();
  const details = document.createElement('details');
  details.className = 'help-guide-section';
  details.open = Boolean(section.open);

  const summary = document.createElement('summary');
  summary.innerHTML = `<span>${section.title}</span><span class="help-guide-chevron" aria-hidden="true"></span>`;

  const body = document.createElement('div');
  body.className = 'help-guide-section-body';
  body.innerHTML = section.html;

  details.append(summary, body);
  return details;
}

export function initHelpGuide() {
  const document = getFairStandHostDocument();
  if (document.querySelector('#help-guide-button')) return;

  const button = document.createElement('button');
  button.id = 'help-guide-button';
  button.className = 'help-guide-button';
  button.type = 'button';
  button.textContent = '?';
  button.title = 'Kullanım kılavuzu';
  button.setAttribute('aria-label', 'Kullanım kılavuzunu aç');
  button.setAttribute('aria-expanded', 'false');

  const backdrop = document.createElement('div');
  backdrop.id = 'help-guide-backdrop';
  backdrop.className = 'help-guide-backdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="help-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="help-guide-title">
      <header class="help-guide-header">
        <div>
          <p class="help-guide-eyebrow">MAXIMA STAND KONFİGÜRATÖRÜ</p>
          <h2 id="help-guide-title">Kullanım Kılavuzu</h2>
          <p>Mouse, klavye, seçim, modül, görsel, lightbox, proje ve sistem kuralları.</p>
        </div>
        <button type="button" class="help-guide-close" aria-label="Kılavuzu kapat">×</button>
      </header>
      <div class="help-guide-content"></div>
    </section>
  `;

  const content = backdrop.querySelector('.help-guide-content');
  listGuideSections().forEach((section) => content.appendChild(createGuideSection(section)));

  document.body.append(button, backdrop);

  const closeButton = backdrop.querySelector('.help-guide-close');
  let previousFocus = null;

  function openGuide() {
    previousFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add('help-guide-open');
    button.setAttribute('aria-expanded', 'true');
    closeButton.focus({ preventScroll: true });
  }

  function closeGuide() {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    document.body.classList.remove('help-guide-open');
    button.setAttribute('aria-expanded', 'false');
    if (previousFocus?.focus) previousFocus.focus({ preventScroll: true });
    else button.focus({ preventScroll: true });
  }

  button.addEventListener('click', openGuide);
  closeButton.addEventListener('click', closeGuide);
  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) closeGuide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) {
      event.preventDefault();
      closeGuide();
    }
  });
}
