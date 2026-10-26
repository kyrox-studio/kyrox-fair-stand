import { getHelpStandardsTableHtml, getStandStandardsFacts } from './standStandardsCopy.js';
import { getFairStandHostDocument } from './hostDocument.js';
import { getMaxImageUploadMb } from './runtimeSettings.js';

function listGuideSections() {
  return [
  {
    title: 'Gizlilik ve Veri Kullanımı',
    html: `
      <p>Oturum, yerel proje kayıtları ve dış bağlantılar hakkında bilgi alın. Bağlantılar yeni sekmede açılır; tasarımınız açık kalır.</p>
      <ul>
        <li><a href="https://kyrox.studio/gizlilik/#crm-stand" target="_blank" rel="noopener noreferrer">Gizlilik ve veri kullanımı</a></li>
        <li><a href="https://kyrox.studio/kullanim-kosullari/" target="_blank" rel="noopener noreferrer">Kullanım koşulları</a></li>
        <li><a href="https://kyrox.studio/cerezler/#crm-stand" target="_blank" rel="noopener noreferrer">Çerezler ve depolama</a></li>
      </ul>
    `,
  },
  {
    title: '5 Dakikada İlk Standın',
    open: true,
    html: `
      <ol class="help-guide-steps">
        <li><strong>Standı kur.</strong> Yeni projede açılan sihirbazda stand tipini (Sırt Duvar, U, L, Ada) ve ölçüleri seç, <strong>Oluştur</strong>'a bas, projeye ad ver. Duvarlar kendiliğinden gelir.</li>
        <li><strong>Ürün ekle.</strong> Sol menüde <strong>Modül ekle</strong>'yi aç, kartı sahneye sürükle (tablette karta dokun, sonra sahnede yerine dokun). Profil, dikme ve kısa panel bırakılınca ölçü sorar.</li>
        <li><strong>Yerleştir.</strong> Modülü tutup sürükle; seçili modülde <strong>Döndür</strong>, <strong>Kopyala</strong>, <strong>Sil</strong> üstteki seçim çubuğundadır, diğer işlemler öğeye tıklayınca açılan <strong>Özellikler</strong> panelinde. Kırmızı gölge oraya konamayacağını gösterir; nedeni sağ altta bildirim olarak yazar.</li>
        <li><strong>Giydir.</strong> Panele tıkla; açılan bölümden renk, görsel, cam, Lightbox veya Mesh uygula.</li>
        <li><strong>Kaydet ve göster.</strong> Proje kendiliğinden kaydedilir (<strong>Kaydet</strong> ile hemen). Üstteki <strong>Ekranı paylaş</strong> canlı ekran paylaşımını açar. <strong>Render Al</strong> görsel verir, üstteki <strong>Üretim Listesi</strong> parça listesini gösterir. Yanlışlıkta <strong>Ctrl+Z</strong> geri alır.</li>
      </ol>
      <p>Hata ve uyarılar sağ altta kısa bildirim olarak çıkar; kapatmak için × düğmesine bas.</p>
    `,
  },
  {
    title: 'Gelişmiş > Ayarlar',
    html: `
      <p>Sol menünün tepesinden <strong>Gelişmiş</strong> moduna geç ve <strong>Ayarlar</strong> başlığını aç. Bu bölüm yalnız Gelişmiş modda görünür; başlığa tekrar basarak kapatabilirsin.</p>
      <h3>Herşeyi Kilitle</h3>
      <ul>
        <li><strong>İşaretli:</strong> Sahnedeki bütün mevcut öğeler kilitlidir. Ctrl+A ile hepsini seçip Kilitle demekle aynı işi yapar. Kilitli öğe taşınamaz, döndürülemez, boyutlandırılamaz veya silinemez; renk ve görsel düzenlemeleri yapılabilir.</li>
        <li><strong>İşaretsiz:</strong> Kutunun işaretini kaldırmak bütün öğelerin ve grupların kilidini açar; grupları çözmez.</li>
        <li><strong>Ara durum (çizgi):</strong> Öğelerin yalnızca bir kısmı kilitlidir. Kutuyu işaretlemek hepsini kilitler. Sahnede öğe yoksa kutu kullanılamaz.</li>
      </ul>
      <p>Bu kutu mevcut kilit durumunu gösterir. Sonradan eklenen öğeleri kendiliğinden kilitleyen kalıcı bir mod değildir. Tek öğenin veya grubun kilidini başka yerden değiştirdiğinde kutu da güncellenir.</p>
      <p><strong>Kaydetme ve geri alma:</strong> Kilitler projeyle kaydedilir; Kaydet veya otomatik kayıt ile korunur. Toplu kilitleme ve kilit açma Ctrl+Z ile geri alınabilir, Ctrl+Y ile yeniden uygulanabilir.</p>
      <h3>Ölçüleri göster</h3>
      <p>Parça ölçülerini ve kenarlara uzaklıkları görmek için kutuyu işaretle; gizlemek için işaretini kaldır.</p>
      <ul>
        <li><strong>Açık:</strong> Tek öğe seçildiğinde parça ölçüleri santimetre cinsinden görünür. Taşıma sırasında stand kenarlarına uzaklıklar metre cinsinden gösterilir; dikey taşınabilen öğelerde zemin ve tavan uzaklıkları da görünür.</li>
        <li><strong>Kapalı:</strong> Bu ölçü çizgileri ve yazıları gizlenir. Öğelerin gerçek ölçüleri, yerleşim kuralları ve üretim listesi değişmez.</li>
      </ul>
      <p><strong>Mod varsayılanları:</strong> Basit modda ölçüler kapalı, Gelişmiş modda açıktır. Gelişmiş modda kapatırsan modlar arasında geçiş yaptığında bu tercihin sayfa açıkken hatırlanır.</p>
      <p><strong>Kaydetme:</strong> Ölçü gösterimi projeye kaydedilmez; sayfa yenilenince modun varsayılanı kullanılır. Yardımcı ölçü çizgileri Render Al görseline eklenmez.</p>
      <h3>Otomatik kayıt</h3>
      <p>Kayıtlı veya açılmış projedeki değişikliklerin ne sıklıkla kaydedileceğini seç: <strong>3, 5, 7 veya 10 dakika</strong> (varsayılan 3 dakika). Sürekli düzenleme yaparken de seçilen süre dolunca kayıt yapılır.</p>
      <p><strong>Kapalı</strong> seçersen değişiklikleri <strong>Kaydet</strong> düğmesiyle kaydetmen gerekir. Süre seçimi bu tarayıcıda hatırlanır; projeye yazılmaz. Kaydedilmemiş değişikliklerden çıkış ve proje işlemlerinin ayrıntıları kılavuzun kayıt bölümündedir.</p>
    `,
  },
  {
    title: 'Hızlı Başlangıç Ayrıntıları',
    html: `
      <p>Stand tipini seç, sol menüde veya sihirbazda genişlik ve derinliği metre cinsinden gir (0,5 m adımlarla; ör. 4,5 m), <strong>Duvar yüksekliği</strong>ni seç (2,5–5 m, varsayılan 3,5 m; duvar, kapı, vitrin, ayırıcı ve kısa duvar bu yüksekliğe göre kurulur, üretim listesi panel ve aparat sayısını buna göre verir); istersen <strong>Depo</strong> listesinde <strong>Depo yok</strong> yerine 1×1, 1,5×1, 2×1 veya 2×2 m depo ölçüsünü seç. Depo seçiliyken yanındaki <strong>Depo ekipmanlarını ekle</strong> açılır; seçilirse Mini Buzdolabı, Kettle, Askılık ve Çöp Kutusu da otomatik yerleşir. Sonra <strong>Sahneyi Oluştur</strong> butonuna bas ve yalnızca proje/stand adını gir. Sistem stand tipi ve ölçülerini ada otomatik ekler, projeyi oluşturur ve ilk kaydı otomatik yapar.</p>
      <p><strong>Yeni proje sihirbazı:</strong> Yeni projede boş sahnenin ortasında 3 adım açılır: stand tipi, ölçü (genişlik, derinlik, duvar yüksekliği; depo listesinde Depo yok veya ölçü, depo varsa içerik; Alınlık olsun işaretlenirse Tek / Çift sıra) ve özet. Alınlık duvarı olmayan açık kenarların tepesine kısa panel dizer, iki yanı açık köşelere dikme koyar; 5 m'yi aşan kenara eşit aralıklı ara dikme gelir (6–10 m bir, 10,5–15 m iki…); sol menüde Alınlık listesinden de seçilir. <strong>Oluştur</strong> proje adını sorar ve sahneyi kurar. Sihirbaz sol menüdeki aynı alanları doldurur; ✕ ile kapatıp sol menüden de devam edebilirsin. Mevcut proje açılınca sihirbaz çıkmaz.</p>
      <p><strong>İlk ipuçları:</strong> İlk sahne kurulunca altta 3 kısa ipucu çıkar (katalogdan ekleme, çift tıkla seçim, Kaydet). <strong>Tamam</strong> ile ilerler, <strong>Atla</strong> ile kapanır; bir kez görülünce bu tarayıcıda bir daha çıkmaz.</p>
      <div class="help-guide-callout"><strong>Temel akış:</strong> Sahne oluştur + proje/stand adını gir → Otomatik proje adı oluşur → Proje otomatik kaydedilir → Modül ekle → Yerleştir → Panel seç → Renk / görsel / cam / Lightbox / Mesh uygula → Render Al.</div>
    `,
  },
  {
    title: 'Mouse Kontrolleri',
    html: `
      <table><tbody>
        <tr><th>Sol tık</th><td>Panel, modül veya zemini seçer.</td></tr>
        <tr><th>Modülü tut + sürükle</th><td>Modülü geçerli yerleşim kurallarına göre taşır.</td></tr>
        <tr><th>Ctrl/Cmd + tık</th><td>Seçilenin çoğulunu yapar. Panel (veya banko yüzü) seçiliyken ilk panel ile tıklanan panel arasında çoklu panel seçimi yapar; banko yüzlerini tek tek ekler. Modülün tamamı seçiliyken (çift tık) tıklanan modülü toplu seçime ekler veya çıkarır; Özellikler panelinden seçilenlerin hepsi birden gruplanır, kilitlenir veya kilidi açılır. Tablette panel seçiliyken seçim çubuğunda <strong>Çoklu panel</strong>’e basıp parmağı bir panelden diğerine kaydırmak aynı dikdörtgeni seçer (komşu modüller ve köşe dahil); kaydırmadan başka bir panele dokunmak da ilk seçili panelden oraya kadar seçer. Parmak kalkınca mod kapanır.</td></tr>
        <tr><th>Çift tık (öğe üstünde)</th><td>Modülün herhangi bir yerine (panel dahil) çift tıklamak modülün tamamını seçer (mavi kesik çizgili kutu); tek tık paneli seçer (mavi). Tablette çift dokunuş aynı işi yapar. Sonra <strong>Ctrl/Cmd + tık</strong> ile başka modüller eklenir; tablette seçim çubuğunda <strong>Çoklu modül</strong> açıkken modüle dokunmak aynı işi yapar, boş alana dokununca kapanır. Shift + tık ile seçim yoktur; boş alanda Shift kamerayı kaydırır.</td></tr>
        <tr><th>Boş alanda sol sürükle</th><td>Kamerayı stand etrafında döndürür.</td></tr>
        <tr><th>Orta tuş / tekerleğe basılı sürükle</th><td>Kamerayı yatay-dikey kaydırır (pan).</td></tr>
        <tr><th>Mouse tekerleği</th><td>Yakınlaştırır / uzaklaştırır.</td></tr>
        <tr><th>Tık</th><td>Öğeye veya yüzeye tek tık (tablette tek dokunuş) onu seçer ve sahnenin sağında <strong>Özellikler</strong> panelini açar. Sürükleme ve kamera hareketi paneli açmaz; boş alana tık paneli kapatır.</td></tr>

        <tr><th>İki parmak (tablet)</th><td>Parmakları açıp kapatmak yakınlaştırır, birlikte kaydırmak sahneyi kaydırır. İkinci parmak ekrana değince ilk parmağın başlattığı öğe sürüklemesi iptal olur ve öğe yerinde kalır; ikinci parmak bir öğeyi yakalamaz. Görünüm küpü sahnenin sağ üst köşesindedir.</td></tr>
        <tr><th>Seçim çubuğu</th><td>Seçili öğenin üstünde <strong>Çoklu panel</strong> veya <strong>Çoklu modül</strong> çıkar. <strong>Döndür</strong>, <strong>Kopyala</strong> ve <strong>Sil</strong> sağdaki Özellikler kartındadır; Kopyala açıkken yalnız <strong>Kopyalamayı bitir</strong> görünür; tek öğenin kapladığı alan mavi kesik çizgili kutu, grup ve çoklu öğe seçimi tamamını saran tek turuncu kesik çizgili kutuyla gösterilir; fare ve tablette aynı çalışır. <strong>Kopyala:</strong> Modülü hafızaya alır; sahnede tıkladığın veya dokunduğun her yere, katalogdan bırakmayla aynı kuralla bir kopya bırakır (görsel, renk, cam, Lightbox ve metal dahil); Esc veya <strong>Kopyalamayı bitir</strong> ile çıkılır. Kilitli öğenin kopyası kilitsiz gelir. Kopyadaki metal separatör kendi grubunu alır; kopyada kapatmak orijinali etkilemez. Kopyayı bırakmadan önce <strong>Shift+R</strong> yalnız kopyayı döndürür; seçili kalan asıl öğe dönmez. Özellikler kartında mevcut açı gösterilir; −45°, −15°, +15°, +45° mevcut açıya eklenir. Kartın üstündeki Seçimi kaldır düğmesi seçimi ve etkin yerleştirmeyi bitirir.</td></tr>
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
        <tr><th>Ctrl/Cmd + A</th><td>Sahne aktifken sahnedeki bütün öğeleri seçer; stand zemini ve sınırları seçime girmez. Metin alanında normal metin seçimi çalışır. Toplu işlemler Özellikler panelindedir.</td></tr>
        <tr><th>Delete</th><td>Seçili öğeyi veya öğeleri onay sormadan siler; yanlışlıkla silineni Ctrl+Z geri getirir. Seçimde kilitli öğe varsa hiçbirini silmez; önce kilitleri aç. Görsel kütüphanesinde bir görsel seçili/odaktaysa görsel silme uyarısını açar.</td></tr>
        <tr><th>Ctrl/Cmd + C / V</th><td>Ctrl/Cmd + C seçili modülü kopyalar ve yerleştirmeye başlar; Ctrl/Cmd + V son kopyayla yeniden başlar. Her tıklama bir kopya bırakır, Esc bitirir.</td></tr>
        <tr><th>Ctrl/Cmd + Z</th><td>Tasarımdaki son değişikliği geri alır: taşıma, döndürme, ekleme, silme, çoğaltma, renk, görsel, cam, separatör, kumaş, kilit ve zemin. Üst banttaki <strong>Geri al</strong> düğmesi de aynı işi yapar.</td></tr>
        <tr><th>Ctrl/Cmd + Y veya Ctrl/Cmd + Shift + Z</th><td>Geri alınanı ileri alır. Üst banttaki <strong>İleri al</strong> düğmesi de aynı işi yapar.</td></tr>
        <tr><th>Esc</th><td>Açık Özellikler paneli, katalog veya yardım penceresini kapatır.</td></tr>
        <tr><th>Enter</th><td>X/Y alanlarında uygunsa sahne oluşturmayı; proje adı popupında onaylamayı tetikler.</td></tr>
      </tbody></table>
      <p class="help-guide-note">Geri al: Her işlem tek adımdır. Sürükleme sırasındaki ara konumlar ve basılı tutulan ok tuşu tek adım sayılır. Son 50 adım tutulur. Geçmiş kaydedilmez; proje açılınca, yeni proje kurulunca veya sayfa yenilenince sıfırlanır. Görsel kütüphanesinden bir görsel silinince de sıfırlanır, çünkü silinen görsele geri dönülemez. Geçmiş revizyon görünümünde de geri alma çalışır. Metin kutularında Ctrl+Z yalnız yazıyı geri alır.</p>
      <p class="help-guide-note">Not: Tek öğede Shift+R katalogdaki dönüş adımını kullanır; varsayılan adım 15°’dir. Karttaki açı düğmeleri seçilen dereceyi uygular.</p>
      <p>ViewCube yüzüne tıklamak o görünüşe geçer; klavyede olmayan arka ve alt da buradadır. ⌂ ve H aynı home görünüşüdür: L Stand Sağ sol-ön, diğer tipler sağ-ön. Sahne ilk açıldığında kamera sağ-ön köşededir. Küpü sürüklemek kamerayı döndürür.</p>
    `,
  },
  {
    title: 'Özellikler Paneli',
    html: `
      <p>Öğeye veya yüzeye tek tık (tablette tek dokunuş) sahnenin sağında <strong>Özellikler</strong> panelini açar; panel × veya Esc ile kapanır. İçerik seçilen modül veya panelin desteklediği özelliklere göre değişir. Yüzey seçiliyken soldaki renk ve görsel ayarları da bu panelde görünür; yüzey renk veya görsel almıyorsa o bölüm gösterilmez. Birden çok panel seçiliyse başlıkta panel sayısı yazar, farklı değerler <strong>Karışık</strong> görünür ve panellerin hepsinin desteklemediği toplu işlem gerekçesiyle pasif kalır. Panelin açılıp kapanması tasarımı veya geri alma geçmişini değiştirmez.</p>
      <ul>
        <li><strong>Vitrin gövde rengi:</strong> 2 veya 3 gözlü vitrinin gövdesine tıkla; <strong>Aktif renk</strong> bölümünden rengi seçip uygula. İki yan ve iki yatay sunta birlikte boyanır; cam raflar değişmez. Renk projeyle kaydedilir. Üstteki duvar panelleri kendi seçimiyle ayrı düzenlenir.</li>
        <li><strong>Kilitle / Kilidi aç:</strong> Öğeyi bulunduğu yere sabitler. Kilitli öğe sürüklenemez, ok tuşlarıyla taşınamaz, döndürülemez, boyutlandırılamaz ve silinemez. Yanına ekleme veya başka bir öğenin taşınması onu kaydıracaksa işlem yapılmaz. Renk, görsel, cam, separatör ve kumaş kilitliyken de değiştirilebilir. Kilit projeyle kaydedilir. Çift tık + Ctrl/Cmd + tık ile toplu seçimde menü <strong>Seçilenleri kilitle / Seçilenlerin kilidini aç</strong> olur.</li>
        <li><strong>Herşeyi Kilitle:</strong> Gelişmiş → Ayarlar bölümündeki kutu, Ctrl+A ile bütün öğeleri seçip kilitlemekle aynı şekilde çalışır. İşareti kaldırmak bütün öğelerin ve grupların kilidini açar; grupları çözmez. Kutu kısmi kilitte ara durumda görünür. İşlem geri alınabilir ve kilitler projeyle kaydedilir.</li>
        <li><strong>Yeni stand duvarları:</strong> Stand oluşturulurken otomatik kurulan duvarlar kilitli gelir. Taşımak veya silmek için duvara tıkla, panelde <strong>Kilidi aç</strong>. Kilitliyken renk ve görsel düzenlenebilir.</li>
        <li><strong>Toplu işlemler:</strong> Ctrl/Cmd + A ile tüm öğeleri seç veya çift tık + Ctrl/Cmd + tık ile seçim yap. Menüden <strong>Seçilenleri kilitle</strong>, <strong>Seçilenlerin kilidini aç</strong>, <strong>Grup oluştur</strong>, <strong>Seçilen grupları çöz</strong> ve <strong>Seçilenleri sil</strong> uygulanır. Kilitli grubun tamamı seçiliyse toplu kilit açma grubun kilidini de açar. Yalnız tamamı seçili gruplar çözülebilir; kilitli gruplar önce açılmalıdır. Silme onay sormaz; Geri al (Ctrl+Z) silinen öğelerin hepsini geri getirir.</li>
        <li><strong>Sil:</strong> Modülü onay sormadan sahneden kaldırır; Geri al ile döner. Kilitli öğede pasiftir.</li>
        <li><strong>Boyutlandır…:</strong> Işıklı Strafor seçiliyken mevcut X/Y ölçülerini açar; yeni ölçüler girildiğinde aynı modül konumu ve ışık rengi korunarak yeniden boyutlandırılır.</li>
        <li><strong>Ölçü / opacity…:</strong> Kutu blok seçiliyken genişlik, derinlik, yükseklik ve 0–1 opacity açılır. Yüzler, renk ve taşıma <strong>Kutu Blok</strong> bölümündedir.</li>
        <li><strong>Kutu yürütme:</strong> Ok tuşları kutuyu sağa, sola, ileri, geri ve yukarı, aşağı yürütür. Taban zeminin altına inmez. Kutunun tepesi stand tavanını geçmez.</li>
        <li><strong>Tül Z:</strong> Ok yukarı/aşağı tülü yükseltir veya alçaltır. Taban zeminin altına inmez; levhanın tepesi stand tavanını geçmez.</li>
        <li><strong>Görseli ölçülendir…:</strong> Görsel, Lightbox veya Mesh görseli atanmış yüzeyde açılır. Başlangıç ölçüsü seçili alanın kendi ölçüsüdür. Ölçüleri değiştirirken sahnede canlı önizleme görünür; Uygula onaylar, İptal veya Esc eski görünümü geri getirir. Küçültünce boşluklar tekrarlanır, büyütünce görsel alanın dışına taşar. Aynı ölçü penceresi panel, Lightbox ve Mesh için geçerlidir. Birleşik panel görseli yüzün gerçek soldan sağa yönüne göre bölünür; kamera yönü ve modüllerin eklenme sırası sonucu değiştirmez.</li>
        <li><strong>Panel dönüşümleri:</strong> Cam, Metal Separatör, Lightbox ve Mesh dönüşümleri panelde doğrudan listelenir; yalnız destekleyen yüzeyde görünür.</li>
        <li><strong>Cam Panele Çevir / Normal Panele Çevir:</strong> Uygun panelin cam durumunu değiştirir.</li>
        <li><strong>Metal Separatöre Çevir / Normal Panele Çevir:</strong> Uygun paneli tel ızgaraya çevirir. Deliklerden arkası görünür. Ctrl ile seçilen tam dikdörtgen tek ölçüdür.</li>
        <li><strong>Lightbox Kumaşa Çevir / Lightbox Kumaştan Çıkar:</strong> Uygun panel bloğunu tek parça opak Lightbox Kumaşa dönüştürür veya geri alır.</li>
        <li><strong>Mesh (Delikli) Brandaya Çevir / Mesh Brandadan Çıkar:</strong> Aynı panel bloğunu gerçek delik maskeli Mesh Branda olarak kullanır; deliklerden sahnenin arkası görünür.</li>
        <li><strong>Lightbox aydınlatmayı aç / kapat:</strong> Bez yüzeyinin aydınlatmasını kontrol eder.</li>
        <li><strong>Raf altı aydınlatmayı aç / kapat:</strong> Raf modülündeki LED görünümünü kontrol eder.</li>
        <li><strong>Arka yüze panel ekle / Arka yüz panellerini kaldır:</strong> Düz duvarın (50, 100, 150, 200 cm ve kısa duvarlar) arka yüzüne de panel takar; arka paneller ön yüz gibi seçilir, görsel, cam, Lightbox ve metal alır. Üretim listesinde tek çerçeve, iki yüz panel sayılır; köşede içe bakan yüz köşe paneline döner.</li>
        <li><strong>Ekle…:</strong> Katalogdan tek modül ekler: sağına, sığmazsa soluna, sonra önüne, olmazsa sahnede müsait yere. Duvara takılan öğeler (TV, raf, ışıklı strafor, projektör) tıklanan modülün üstüne konur.</li>
      </ul>
    `,
  },
  {
    title: 'Gruplar',
    html: `
      <p>Grup, istediğin öğeleri tek bir isimli küme yapar: duvar paneli, profil, lamba, logo, TV, kutu blok, masa, sandalye; türü fark etmez. Grup BOM'a ve maliyete girmez; parçalar bugünkü gibi girer.</p>
      <ul>
        <li><strong>Grup oluştur:</strong> Bir öğeye çift tıkla, sonra Ctrl/Cmd + tık ile (tablette seçim çubuğundaki <strong>Çoklu modül</strong> ile) en az 2 öğe seç, Özellikler panelinde <strong>Grup oluştur…</strong> → isim ver. Stand kenarına bağlı duvar parçaları gruplanınca kenardan ayrılır; yerleri değişmez ve grup her yöne taşınabilir.</li>
        <li><strong>Gruba ekle:</strong> Bir grubun parçasıyla birlikte grupsuz öğeleri çift tık + Ctrl/Cmd + tık ile seç, panelde <strong>Gruba ekle: &lt;grup&gt;</strong>.</li>
        <li><strong>Bir öğe tek grupta olur:</strong> Başka gruptaki bir öğeyi eklemek istersen önce sorulur: “Bu gruptan çıkarılıp … grubuna eklensin mi?” Hayır dersen hiçbir şey değişmez.</li>
        <li><strong>Taşıma:</strong> Gruptaki herhangi bir öğeyi sürükle ya da ok tuşuna bas: bütün grup aynı mesafe kayar. Tek kısıt: hiçbir parça stand alanının dışına çıkamaz; grup kenarda durur. Başka öğelerle üst üste gelme engellenmez.</li>
        <li><strong>Döndürme (Shift+R):</strong> Gruptaki bir öğe seçiliyken Shift+R bütün grubu grubun ortası etrafında 45° döndürür; parçalar birbirine göre yerini korur. Gruptaki duvar, kapı ve paneller de 45° açıya geçebilir. Döndürülmüş grup standa sığmazsa işlem yapılmaz. Kilitli grup döndürülmez. Gruptaki öğe tek başına döndürülemez; tek öğeyi döndürmek için önce gruptan çıkar.</li>
        <li><strong>Tık:</strong> Bugünkü gibi paneli seçer (renk ve görsel verilebilir); grubun tamamı tek turuncu kesik çizgili sınırla gösterilir.</li>
        <li><strong>Özellikler paneli (gruptaki öğe):</strong> Grubu yeniden adlandır, Grubu kilitle / kilidini aç, Grubu çoğalt, Bu parçayı gruptan çıkar, Grubu çöz, Grubu sil.</li>
        <li><strong>Grubu kilitle:</strong> Bütün parçalar kilitli olur: taşınamaz, döndürülemez, boyutlandırılamaz ve silinemez. Kilitli gruptaki tek parçanın kilidi açılamaz; önce grubun kilidi açılır. Kilitliyken adlandırma ve çoğaltma yapılabilir.</li>
        <li><strong>Grubu çoğalt:</strong> Bütün parçalar renk ve görselleriyle kopyalanır; kopya “… (kopya)” adıyla yeni, kilitsiz bir grup olur ve grubun yanına (sağ, sol, ön veya arka) konur. Standda yer yoksa uyarı verilir ve hiçbir şey eklenmez.</li>
        <li><strong>Grubu sil:</strong> Grubun bütün parçalarını onay sormadan siler; Geri al ile döner. Delete tek seçimde seçili parçayı, çoklu seçimde seçilen öğeleri siler; kilitli öğe varsa silmez.</li>
        <li><strong>Grubu çöz / gruptan çıkar:</strong> Parçalar yerinde kalır. Kenardan ayrılmış duvar parçası hâlâ aynı kenar çizgisindeyse kenara geri bağlanır. Grupta tek parça kalırsa grup kendiliğinden çözülür.</li>
        <li><strong>Şablon olarak kaydet:</strong> Gruplar kartında grubun <strong>Şablon olarak kaydet</strong> düğmesi grubu organizasyonun şablon kataloğuna kaydeder. Şablona parçalar (Item), ölçüleri, birbirine göre yerleri, açıları, renkleri, cam panel ve metal separatör ataması girer. <strong>Görseller, Lightbox ve Mesh şablona girmez</strong>; logo ve TV ekranı boş gelir. Şablon bir Item değildir; maliyet ve üretim listesi parçalardan çıkar.</li>
        <li><strong>Şablonlarım kartı:</strong> Organizasyonun şablonlarını listeler. <strong>Yerleştir</strong> şablonu standın ortasına (yer yoksa ilk boş yere) yeni ve kilitsiz bir grup olarak koyar; sonra grubu sürükleyerek yerine taşırsın. Katalogda artık olmayan parça atlanır ve yazılır. <strong>Adlandır</strong> ve <strong>Sil</strong> şablonu değiştirir; sahnedeki gruplar etkilenmez. Şablonu güncellemek yoktur: silip yeniden kaydedilir. Şablonlar CRM içinden (oturumla) kullanılır; yetkiler proje yetkileridir.</li>
        <li><strong>Gruplar kartı:</strong> Kenar çubuğunda grupları, parça sayısını ve kilidi listeler. Seç, Kilitle, Adlandır, Çoğalt, Çöz, Sil düğmeleri ve parça listesi buradadır; parçaya tıklayınca sahnede seçilir.</li>
        <li><strong>Kayıt ve geri alma:</strong> Gruplar projeyle kaydedilir, içe/dışa aktarılır; Ctrl+Z grup işlemlerini de geri alır. Kenardan ayrılan duvar parçaları duvar kapasitesi hesabına ve otomatik duvar lambası dizisine girmez.</li>
      </ul>
    `,
  },
  {
    title: 'Panel Seçimi ve Çoklu Seçim',
    html: `
      <p>Tek panel için normal sol tık kullanılır. Çoklu seçimde önce başlangıç panelini seç, ardından <strong>Ctrl/Cmd + tık</strong> ile diğer sınır paneline tıkla. Tablette: panele dokun, seçim çubuğunda <strong>Çoklu panel</strong>’e bas, sonra diğer sınır paneline dokun ya da parmağı oraya kaydır.</p>
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
        <li>Bütün modüller 10 cm adımla hareket eder (duvar, banko, mobilya, projektör dahil).</li>
        <li><strong>Kopyala:</strong> Kopyalayınca sağ altta “… hafızaya alındı” bildirimi çıkar; Ctrl+V son kopyayla yeniden bırakmaya başlar.</li>
        <li><strong>Kopya bağımsızlığı:</strong> Kopyalanan öğe veya grup o anki panel, renk, görsel ölçüsü ve kaplamasını alır. Sonraki görsel, ölçü, renk veya kaplama değişiklikleri kaynağı değiştirmez. Aynı görsel dosyası başka grupta kullanılsa da ölçülendirme yalnız seçilen görsel bloğuna uygulanır.</li>
        <li><strong>Profil bağlantısı:</strong> Profil başka bir profilin her noktasına dik bağlanır (iki profilin arasına, ortasına); yaklaşınca 10 cm adımla yapışır. Profiller uç uca da eklenir. Duvar panelinde dik bağlantı yalnız dikme olan noktadadır.</li>
        <li><strong>Dikey taşıma:</strong> TV, strafor, tül, raf, küp blok, LED projektör, kısa duvar ve profil seçiliyken <strong>↑ / ↓</strong> ile 10 cm iner/çıkar; zemini ve duvar tepesini geçmez. Bu öğelerde ölçülerin yanında zemine ve tavana (duvar tepesine) uzaklık da yazar. Hangi öğenin dikey taşındığı öğe kaydındaki ayardır.</li>
        <li><strong>Profil</strong> seçili duvar yüksekliğinin tepesinde gelir (250 cm duvarda 240 cm'de).</li>
        <li><strong>Profil:</strong> Katalogda tek kart vardır; bırakılınca boy sorulur (gerçek boy ve sahnedeki boy yazar: 41,5 → 50 … 487 → 500 cm). <strong>Bir daha sorma, aynı ölçüde getir</strong> işaretlenirse sonraki profiller sormadan o boyda gelir (bu tarayıcıda). Panelde <strong>Profil boyu…</strong> boyu değiştirir; çentik oradan kaldırılınca yeniden sorulur.</li>
        <li><strong>Kısa panel:</strong> Katalogda Tek Sıra ve Çift Sıra için birer kart vardır; 100 cm bırakılır, genişlik (50 / 100 / 150 / 200 cm) Özellikler panelinden seçilir. Panel seçilen genişlikle profile ve yan panele bağlanır. Üretim listesinde yan yana dizilen kısa panellerin üst ve alt profili dikmeden dikmeye (ya da duvar ucuna) tek parça sayılır; o boyda profil yoksa en uzun uygun profil + kalan parça yazılır (ör. 450 cm → 388 + 41,5). Kısa panelin üst/alt çizgisine koyduğun profil de o raydaki panel profilinin yerine geçer.</li>
        <li><strong>Dikme:</strong> Katalogdan bırakılınca boy sorulur; seçili duvar yüksekliğinin dikmesi seçili gelir. <strong>Bir daha sorma, aynı ölçüde getir</strong> işaretlenirse sonraki dikmeler sormadan o boyda gelir (bu tarayıcıda). Panelde <strong>Dikme yüksekliği…</strong> boyu değiştirir; çentik oradan kaldırılınca yeniden sorulur.</li>
        <li>Serbest öğe stand kenarına 10 cm'den yakın bırakılırsa kenara yaslanır; daha uzaktaysa bıraktığın yerde kalır, köşeye çekilmez.</li>
        <li><strong>Izgara:</strong> Taşırken, kopyalarken veya katalogdan yerleştirirken stand zemininde 1 m kalın, 50 cm ince çizgiler çıkar; bırakınca kaybolur. Izgara yalnız göz içindir, öğe 10 cm adımla oturur.</li>
        <li><strong>Ölçüler:</strong> Basit modda gizlidir; sol menünün üstündeki <strong>Basit / Gelişmiş</strong> seçicisiyle gelişmiş moda geçince görünür. <strong>Ayarlar → Ölçüleri göster</strong> ayarı Gelişmiş moddaki Ayarlar bölümünden değiştirilebilir; seçim sayfa açıkken hatırlanır. Tek öğe seçiliyken zeminde kapladığı alan kesikli çizilir; genişlik, derinlik ve yükseklik cm olarak yazar. Taşırken öğeden standın dört kenarına uzaklık metre olarak gösterilir; kenara yaslı taraf çizilmez. Ölçüler Render Al görseline girmez.</li>
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
        <li><strong>Dosya Seç:</strong> Görseli aktif projenin görsel arşivine ekler. En fazla ${getMaxImageUploadMb()} MB; aşıldığında sağ altta bildirim gösterilir. Büyük görseller sahne için küçültülür; şeffaf arka plan korunur. SVG olduğu gibi kalır.</li>
        <li><strong>Doldur:</strong> Görselin en-boy oranını koruyarak alanı tamamen kaplar; taşan kısmı ortadan kırpar.</li>
        <li><strong>Sığdır:</strong> Görselin tamamını en-boy oranını koruyarak seçili alana sığdırır; gerekirse boşluk bırakır.</li>
        <li><strong>Ölçü:</strong> Panelde Görseli ölçülendir. Panel, Lightbox ve Mesh görseli aynı pencereden ölçülür. Önizleme otomatik kayda veya geri alma geçmişine girmez; Uygula tek geri alma adımıdır. Küçük ölçü kartı sahneyi karartmaz; başlığından sürüklenebilir veya başlıkta ok tuşlarıyla taşınabilir. Kart açıkken kamera döndürme ve yakınlaştırma çalışır. İptal, Esc veya × değişikliği iptal eder. Ölçü vermek görseli bu genişlik ve yüksekliğe oturtur; Doldur ve Sığdır ise en-boy oranını korur. Seçili alanın kendi ölçüsü başlangıçtır; 400×200 alandaki görsel önce 400×200 oturur. 300×150 yazınca daralır ve boşluk tekrarlanır, 500×300 yazınca alanın dışına taşar. Tek panelde de aynıdır.</li>
        <li><strong>Kaldır:</strong> Görseli panel/bez üzerinden kaldırır; kütüphaneden silmez.</li>
        <li>Dikdörtgen çoklu panel seçiminde tek büyük görsel panellere bölünerek uygulanabilir.</li>
        <li>Lightbox Kumaşa ve Mesh Brandaya görsel tek parça olarak uygulanır.</li>
      </ul>
      <h4>Görsel silme</h4>
      <p>Arşivdeki görsele tıklayıp <strong>Delete</strong> tuşuna bas.</p>
      <p>Görsel sahnede kullanılıyorsa önce uyarı gösterilir. Onaylanırsa görsel hem kütüphaneden silinir hem de atandığı panel/bezlerden anında kaldırılır.</p>
    `,
  },
  {
    title: 'Işıklı Strafor',
    html: `
      <p>Işıklı Strafor, SVG logoyu 3B strafor gövde ve arka halo ışığıyla duvar üzerine yerleştirir. Logo yalnızca SVG görsellerden seçilir.</p>
      <h4>Oluşturma</h4>
      <ol>
        <li>Sol menüde <strong>Modül ekle</strong> → <strong>Elektronik &amp; Aydınlatma</strong> → <strong>Işıklı Strafor / Logo</strong> kartını duvara sürükle.</li>
        <li>Bırakınca strafor seçilir ve sağda <strong>Özellikler</strong> paneli açılır.</li>
        <li>Paneldeki görsel bölümünde SVG'yi <strong>Görsel arşivine ekle</strong> ile yükle veya arşivden seç; <strong>Doldur</strong> / <strong>Sığdır</strong> logoyu uygular, <strong>Kaldır</strong> kaldırır.</li>
        <li>Ölçüyü paneldeki <strong>X · Genişlik</strong> ve <strong>Y · Yükseklik</strong> alanlarından gir; sahnede hemen değişir.</li>
      </ol>
      <ul>
        <li>Strafor gövde kalınlığı sabit <strong>3,5 cm</strong>'dir.</li>
        <li>Duvar ile strafor arasında sabit <strong>1,5 cm</strong> ışık boşluğu vardır.</li>
        <li>X ve Y ölçüleri birbirinden bağımsızdır; girilen değerler sahnedeki gerçek dış ölçüyü belirler.</li>
        <li>Ön yüzde SVG'nin kendi renkleri korunur.</li>
      </ul>
      <h4>Sonradan boyutlandırma</h4>
      <p>Sahnedeki straforu seçince paneldeki X/Y ölçü alanlarından değiştirebilirsin. Yeni ölçüler uygulandığında modülün mevcut konumu, SVG görseli ve ışık rengi korunur.</p>
      <h4>Işık rengini değiştirme</h4>
      <p>Işıklı Straforu seçtiğinde Özellikler panelinde <strong>Işıklı Strafor · Işık rengi</strong> kontrolü görünür. Renk seçici yalnızca arkadaki halo ışığını değiştirir; SVG'nin ön yüz renklerini değiştirmez.</p>
      <p class="help-guide-note">Yerleştirme sırasında Esc tuşu ile işlem iptal edilebilir. Strafor, duvar üstü modül gibi taşınır ve kendi hareket snap adımını kullanır. Yerleştirilemezse uyarı modülün adıyla ve gerçek sebeple çıkar (ör. Başka modülle çakışıyor.).</p>
    `,
  },
  {
    title: 'Kutu Blok',
    html: `
      <p><strong>Kutu blok</strong> katalogdan sahneye bırakılan serbest bir küptür. Duvara yapışmaz. Zeminde durur; istenirse yukarı kaldırılır.</p>
      <h4>Yerleştirme</h4>
      <p>Katalog kartını bırakınca <strong>W · Genişlik</strong>, <strong>D · Derinlik</strong>, <strong>H · Yükseklik</strong> ve <strong>Opacity (0–1)</strong> sorulur. Aynı pencere sonradan panelde <strong>Ölçü / opacity…</strong> ile açılır. Saydamlık kutunun tamamına uygulanır.</p>
      <h4>Gövde ve beş yüz</h4>
      <p>Ön, sağ, arka, sol ve <strong>üst yüz</strong> ayrıdır; kutu dönünce bu yüzler de döner. Üst yüzün ölçüsü genişlik × derinliktir; üstten görünümde (T) kolay seçilir. Alt yüze görsel, Lightbox veya Mesh uygulanmaz. Bir yüze tıklayınca o yüz panellerdeki gibi mavi çerçeve ile seçilir. Gövdeye ya da alt kapağa tıklamak kutunun kendisini seçer.</p>
      <ul>
        <li>Gövde seçiliyken renk gövdeye gider. Yüz seçiliyken renk o yüze gider.</li>
        <li>Seçilen yüze görsel sürüklenebilir. Aynı yüze Lightbox veya Mesh de uygulanır. Bu üçü item satırındaki bayraklardan açılır. Cam uygulanmaz.</li>
        <li>Lightbox aydınlatması yalnız o yüzde yanar; küpün gövdesi yanmaz.</li>
        <li>Mesh deliklerinden kutunun kendi gövdesi görünür.</li>
        <li>Yüzde görsel, Lightbox veya Mesh görseli varken panelde <strong>Görseli ölçülendir…</strong> panellerdeki ölçü penceresini açar. Başlangıç o yüzün kendi santimidir. Küçültünce boşluk tekrarlanır, büyütünce görsel taşar.</li>
      </ul>
      <h4>Kutu yürütme</h4>
      <ul>
        <li>Ok tuşları ekranda görünen yöne gider: sağa, sola, ileri, geri ve yukarı, aşağı. Adım 10 cm’dir.</li>
        <li>Taban zeminin altına inmez. Kutunun tepesi stand tavanını geçmez.</li>
        <li>Kutuyu zeminde sürüklemek yüksekliği bozmaz.</li>
        <li><strong>Shift+R</strong> kutuyu katalogdaki adımla (varsayılan 15°) döndürür.</li>
      </ul>
    `,
  },
  {
    title: 'Cam Panel',
    html: `
      <p>Cam özelliğini destekleyen paneli seçince açılan <strong>Özellikler</strong> panelinde <strong>Cam Panele Çevir</strong> seçeneğini kullanabilirsin. Aynı yerden tekrar normal panele döndürülebilir.</p>
      <p class="help-guide-note">Cam görsel/şeffaf baskı davranışları geliştikçe bu bölüm güncellenecektir.</p>
    `,
  },
  {
    title: 'Metal Separatör',
    html: `
      <p>Cam kabul eden paneli seçince açılan <strong>Özellikler</strong> panelinde <strong>Metal Separatöre Çevir</strong> seçeneğini kullanabilirsin. Aynı yerden normal panele döner.</p>
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
      <p><strong>Raf &amp; Vitrin</strong> kataloğunda <strong>Tekli raf</strong>, <strong>2 sıralı raf</strong> veya <strong>3 sıralı raf</strong> seç. Kartı duvar veya panel üzerindeki iki panelin birleşimine bırak. Raf genişliği takıldığı duvardan seçilir; uygun genişlik yoksa yerleştirme reddedilir. Başka duvara taşıdığında genişlik yeniden seçilir.</p>
      <p>2 ve 3 sıralı raflar ayrı tahtalar halinde görünür. Paneldeki aydınlatma seçimi bütün raf sıralarına uygulanır. Editörde LED şeritler parlar; yüzeye düşen ışık Render Al sırasında görünür.</p>
      <p>Raf modülünde Özellikler panelinde <strong>Raf altı aydınlatmayı aç / kapat</strong> seçeneği görünür. Bu seçenek sadece destekleyen raf modüllerinde gösterilir.</p>
    `,
  },
  {
    title: 'Modül Ekleme ve Katalog',
    html: `
      <ul>
        <li>Sahne oluşturulduktan sonra <strong>Modül ekle</strong> kartındaki katalog etkin olur.</li>
        <li>Her katalog kartı sahneye sürüklenebilir. Sürüklerken <strong>Shift+R</strong> saat yönünde döndürür ve açıyı kilitler. Tablette karta dokunup sahnede yere dokunmak da modülü oraya ekler; aynı karta tekrar dokunmak veya Esc iptal eder.</li>
        <li><strong>Sahneyi Sıfırla</strong> sol menünün en altında, Tüm Özellikleri Kaldır’ın üstündedir: stand tipi, ölçü ve Zemin Kaplaması seçimi kalır; sahnedeki modüller ve zemin alanı silinir.</li>
        <li>Panelden <strong>Ekle…</strong> ile açılan katalog penceresinde kategoriler solda sekme olarak durur; bir başlığa tıklayınca o kategorinin modülleri sağda görünür.</li>
        <li>Her seferinde tek modül eklenir: karta tıklayıp <strong>Ekle</strong>’ye bas (ya da karta çift tıkla).</li>
        <li><strong>Varyantlar:</strong> Panel, Separatör, Kısa panel, Banko, Köşe Banko, Baza, Vitrin, Raf, TV, Video Wall ve Uzun Saksı katalogda tek karttır; kart bırakılınca varsayılanı konur (Panel 100, Vitrin 3 Gözlü, Tekli Raf, TV 42", Video Wall 2×2 …). Varyantı olan her öğe seçilince Özellikler panelinde varyant düğmeleri görünür, seçili olan işaretlidir; başka varyanta basınca sahnede hemen değişir ve seçim aynı öğede kalır. Öğe yerinden oynamaz: duvar zincirinde yer açmak için yalnız sonraki (gerekirse önceki) paneller kayar, üstlerindeki TV, logo ve raflar da onlarla birlikte gider; zincir dışındaki öğe yerinde sığmıyorsa değişiklik yapılmaz ve nedeni yazılır. Separatörde <strong>Sarmaşıklı</strong> çentiği aynı genişliğin sarmaşıklısını seçer. Ayaklı Vitrin Banko &amp; Baza, Vitrin Panel &amp; Duvar altındadır.</li>
        <li>Panelde <strong>Ekle…</strong>: modül tıklanan modülün sağına, sığmazsa soluna, o da olmazsa hemen önüne, yine olmazsa sahnede müsait bir yere konur. TV, raf, ışıklı strafor, projektör gibi duvara takılan öğeler doğrudan tıklanan modülün üstüne yerleşir.</li>
        <li>Yerleşim bırakılmadan önce sistem tarafından doğrulanır.</li>
      </ul>
    `,
  },
  {
    title: 'Stand Oluşturma ve Sistem Standartları',
    html: getHelpStandardsTableHtml(),
  },
  {
    title: 'Geçmiş',
    html: `
      <p>Kaydedilmiş revizyonları görmek için sol menüde <strong>Proje → Geçmiş</strong> başlığını aç. Bölüm başlangıçta kapalıdır; yeniden başlığa basarak kapatabilirsin. Revizyon kaydı yoksa bölüm görünmez. Basit ve Gelişmiş modda erişilebilir.</p>
      <p>Listeden bir revizyon seçerek o kaydı açabilirsin; seçili revizyon vurgulanır. Son revizyonu seçerek güncel çalışmaya dönersin. Bölümü açıp kapatmak kayıt oluşturmaz ve standı değiştirmez. Bu liste, Ctrl+Z ile kullanılan oturumluk geri alma geçmişinden ayrıdır.</p>
    `,
  },
  {
    title: 'Zemin',
    html: `
      <p>Mevcut seçenekler: Karolaj ${getStandStandardsFacts().gridWidthCm} × ${getStandStandardsFacts().gridDepthCm} cm, Halı, Beyaz Meşe, Sarı Meşe ve Beton Parke.</p>
      <p><strong>Zemin Kaplaması</strong> iki modda da standın tamamının baz kaplamasını seçer. Bölgesel zemin kontrolleri yalnız <strong>Gelişmiş</strong> modda görünür: sahne oluştuktan sonra içine tek bir dikdörtgen eklenebilir. Dikdörtgenin dışı baz kaplama kalır.</p>
      <p><strong>Mod geçişi:</strong> Basit / Gelişmiş seçimi standı veya tasarım verisini değiştirmez. Bölgesel zemin Basit modda da sahnede ve proje kaydında korunur; Gelişmişe dönünce aynı alan düzenlenebilir. Yalnız henüz uygulanmamış çizim önizlemesi kapanır.</p>
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
        <li><strong>Kaydet:</strong> üst araç çubuğundadır; sahne varken stand, modüller, yerleşimler ve proje durumunu kaydeder. Sahne yokken kapalıdır.</li>
        <li><strong>Otomatik kayıt:</strong> Kayıtlı/açılmış projede değişiklik, <strong>Ayarlar → Otomatik kayıt</strong> listesinde seçilen süre içinde kaydedilir: <strong>3, 5, 7 veya 10 dk</strong> (varsayılan 3 dk). Sürekli düzenlemede de en geç bu süre dolunca kaydedilir. <strong>Kapalı (Otomatik Kayıt Kapalı)</strong> seçilirse proje yalnız <strong>Kaydet</strong> ile kaydedilir: görsel ekleme, kaldırma veya silme, sekmeyi değiştirme ve proje işlemleri kayıt yapmaz, revizyon da ilerlemez; durum satırında “Kaydedilmemiş değişiklik var” yazar. Seçim bu tarayıcıda hatırlanır, projeye yazılmaz.</li>
        <li><strong>Kaydedilmemiş değişiklik koruması:</strong> Otomatik kayıt açıkken kaydedilmemiş değişiklik varsa sekme gizlenince veya editörden çıkılınca değişiklik hemen kaydedilir. Otomatik kayıt kapalıyken kaydedilmez: editörden çıkarken “Kaydedilmemiş değişiklikler var” uyarısı çıkar; Aç, Sahneyi Oluştur, İçe Aktar veya başka proje seçmek kaydedilmemiş değişikliğin kaybolacağını sorar; Dışarı Aktar projenin son kaydını aktarır. Sayfa kapatılmak veya yenilenmek istenirse tarayıcı uyarı gösterir.</li>
        <li><strong>Müşteri adı:</strong> Açık projenin bağlı olduğu müşterinin adı, proje adının üstünde görünür. Başka projeler bu ekranda listelenmez; yalnız açık proje üzerinde çalışılır.</li>
        <li><strong>Aç:</strong> Açık projeyi görselleriyle birlikte yeniden yükler. Bir görselin dosyası bulunamazsa proje yine açılır; o yüzey kendi rengiyle gösterilir ve durum satırında kaç görselin bulunamadığı yazar. Görsel bağlantısı projede kalır, dosya geri gelirse görsel yeniden görünür.</li>
        <li><strong>Yükleme ekranı:</strong> Proje, revizyon veya içe aktarılan dosya açılırken yükleme ekranı sahnenin bütün görselleri ve 3D modelleri gelene kadar kalır; alt satırda kaçının geldiği yazar (ör. 45 / 73). Yarım sahne gösterilmez. Yüklenemeyen parça yerine kendi rengiyle çizilir; 30 saniyede bitmeyen yükleme olursa ekran yine kapanır ve durum satırında yazar.</li>
        <li><strong>Hızlı açılış:</strong> Proje görselleri tarayıcıda saklanır; sunucudaki görsel değişmediyse sonraki açılışta yeniden indirilmez. 3D modeller proje verisi gelir gelmez yüklenmeye başlar; yükleme ekranı aşamayı yazar (proje verisi, görseller, sahne).</li>
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
      <p>Editörde ışık gölgesi, LED projektör ve raf altı aydınlatmanın panele düşen ışığı kapalıdır; sahne hızlı açılır, döner ve köşeler karanlıkta kalmaz. Projektör lensi ve raf altı LED şeridi editörde de parlar. <strong>Render Al</strong> çizerken gölgeyi, projektör ve raf altı ışıklarını açar. Fuar holündeki gibi standın tepesinde bir sahne spotu yanar ve ortam ışığı kısılır; stand ışık havuzunda kalır, çevre yumuşakça kararır. İndirilen görsel ışıklı, gölgeli ve derinliklidir.</p>
      <p><strong>Sahne Işığı</strong>, Render Al’ın yanındadır. Açınca editörde de tepe spotu yanar ve ortam ışığı kısılır; render’daki ışık havuzu sahnede görünür. Alınlık gibi dışa bakan yüzler de aydınlık kalır. Projektör ve raf altı ışıkları editörde yine kapalıdır, gölge yalnız Render Al’da çizilir. Sayfa açılışında açıktır; kapatınca sahne düz aydınlık editör ışığına döner. Seçim oturumluktur, projeye kaydedilmez.</p>
      <p>Seçim çerçeveleri ve yardımcı duvar çizgileri render çıktısına dahil edilmez.</p>
      <p><strong>Üretim Listesi</strong>, sahne kurulunca üst banttaki <strong>Üretim Listesi</strong> düğmesiyle açılır; iki modda da erişilebilir. Panel sürüklenebilir, boyutu değişir ve <strong>Ayrı pencere</strong> ile dışarı alınır. <strong>Metin indir</strong> aynı listeyi metin dosyası olarak kaydeder; hesaplama değişmez.</p>
      <p>Baskı satırları Dijital Baskı, Lightbox Bezi, Mesh - Delikli Branda ve Işıklı Strafor / Logo başlıklarının altındadır. Satırda görselin dosya adı, cm ölçüsü ve m² yazar. Aynı görsel aynı ölçüdeyse adet birleşir. Aynı görsel farklı ölçülerdeyse satırlar ayrı kalır ve altında o görselin toplam m²’si yazar. Lightbox veya mesh görsel atanmadan çevrilirse satırda o panelin rengi hex olarak yazar. Ölçü, panelde scene dimensions varsa oradan, o alan boşsa item dimensions değerinden gelir.</p>
    `,
  },
  {
    title: 'Önemli Kurallar ve Uyarılar',
    html: `
      <ul>
        <li>Çoklu panel seçimi ile Lightbox/Mesh oluşturma aynı kural değildir; kaplama için aynı düzlem ve eksiksiz dikdörtgen zorunludur.</li>
        <li>Geçersiz modül yerleşimleri ve çarpışmalar sistem tarafından engellenir; uyarı modülün adını ve sebebini yazar.</li>
        <li>Hiçbir şey stand tavanını aşamaz: yerden yükselen parçaların tepesi tavan kotunun üstüne çıkamaz.</li>
        <li>Kütüphaneden kullanılan bir görsel silinirse, onay sonrası atandığı yüzeylerden de kaldırılır.</li>
        <li>Birden fazla modülü kapsayan tek parça bez varken bağlı modüller ayrı ayrı taşınamaz/döndürülemez.</li>
        <li>Özellikler panelindeki seçenekler her modülde aynı değildir; yalnız desteklenen işlemler gösterilir.</li>
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

  // Kılavuz düğmesi üst bant görünürken bantta ("Ekranı paylaş"ın yanında) durur. Bant gizliyken
  // (sahne kurulmadan) sağ altta yüzer; kılavuz her zaman açılabilir.
  document.body.append(backdrop);
  const toolbar = document.querySelector('#viewport-toolbar');
  const placeButton = () => {
    const inToolbar = Boolean(toolbar) && !toolbar.hidden;
    button.classList.toggle('viewport-render-button', inToolbar);
    button.classList.toggle('help-guide-button--toolbar', inToolbar);
    const parent = inToolbar ? toolbar : document.body;
    if (button.parentElement !== parent) parent.appendChild(button);
  };
  placeButton();
  if (toolbar && typeof MutationObserver === 'function') {
    new MutationObserver(placeButton).observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });
  }

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
