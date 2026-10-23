import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styleEntry = fs.readFileSync(new URL('../src/configuratorStyles.js', import.meta.url), 'utf8');
const guideSource = fs.readFileSync(new URL('../src/helpGuide.js', import.meta.url), 'utf8');
const guideCss = fs.readFileSync(new URL('../src/helpGuide.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('in-app help guide is wired into the application', () => {
  assert.match(styleEntry, /import '\.\/helpGuide\.css';/);
  assert.match(html, /src="\/src\/configuratorStyles\.js"/);
  assert.match(mainSource, /import \{ initHelpGuide \} from '\.\/helpGuide\.js';/);
  assert.match(mainSource, /initHelpGuide\(\);/);
});

test('help guide exposes a fixed question-mark launcher and collapsible sections', () => {
  assert.match(guideSource, /button\.textContent = '\?';/);
  assert.match(guideSource, /document\.createElement\('details'\)/);
  assert.match(guideSource, /Kullanım Kılavuzu/);
  assert.match(guideSource, /Mouse Kontrolleri/);
  assert.match(guideSource, /Klavye Kısayolları/);
  assert.match(guideSource, /Sağ Tık Menüsü/);
  assert.match(guideSource, /Stand Oluşturma ve Sistem Standartları/);
  assert.match(guideSource, /<strong>Kaydet:<\/strong> üst araç çubuğundadır; sahne varken/);
  assert.match(guideSource, /<strong>3, 5, 7 veya 10 dk<\/strong> \(varsayılan 3 dk\)/);
  assert.match(guideSource, /Kapalı \(Otomatik Kayıt Kapalı\)/);
  assert.match(guideSource, /Kaydedilmemiş değişiklik koruması/);
  assert.match(guideSource, /seçilirse proje yalnız <strong>Kaydet<\/strong> ile kaydedilir/);
  assert.match(guideSource, /editörden çıkarken “Kaydedilmemiş değişiklikler var” uyarısı çıkar/);
  assert.match(guideSource, /Dışarı Aktar projenin son kaydını aktarır/);
  assert.match(guideSource, /Bir görselin dosyası bulunamazsa proje yine açılır/);
  assert.match(guideSource, /Her proje bir müşteriye bağlıdır/);
  assert.match(guideSource, /title: 'Gruplar'/);
  assert.match(guideSource, /Tek kısıt: hiçbir parça stand alanının dışına çıkamaz/);
  assert.match(guideSource, /Grubun tamamı silinecek \(N parça\)/);
  assert.match(guideSource, /Shift\+R bütün grubu grubun ortası etrafında 45° döndürür/);
  assert.match(guideSource, /<strong>Görseller, Lightbox ve Mesh şablona girmez<\/strong>/);
  assert.match(guideSource, /<strong>Şablonlarım kartı:<\/strong>/);
  assert.match(guideSource, /<strong>Farklı Kaydet:<\/strong> sahne varken aktiftir/);
  assert.match(guideSource, /müşteri aynı kalır/);
  assert.match(guideSource, /Sahne yokken kapalıdır/);
  assert.match(guideSource, /Çöp Kutusu/);
  assert.match(guideSource, /katalog kartı sahneye sürüklenebilir/);
  assert.match(guideSource, /Sahneyi Sıfırla/);
  assert.match(guideSource, /Ölçü \/ opacity…/);
  assert.match(guideSource, /o yüz panellerdeki gibi mavi çerçeve ile seçilir/);
  assert.match(guideSource, /item satırındaki bayraklardan açılır/);
  assert.match(guideSource, /Lightbox aydınlatması yalnız o yüzde yanar/);
  assert.match(guideSource, /küpün gövdesi yanmaz/);
  assert.match(guideSource, /Kutu yürütme/);
  assert.match(guideSource, /Taban zeminin altına inmez/);
  assert.match(guideSource, /Kutunun tepesi stand tavanını geçmez/);
  assert.match(guideSource, /title: 'Kutu Blok'/);
  assert.match(guideSource, /bütün görselleri ve 3D modelleri gelene kadar kalır/);
  assert.match(guideSource, /Yarım sahne gösterilmez/);
  assert.match(guideSource, /Tablette parmakla basılı tutmak \(uzun basma\) aynı menüyü açar\./);
  assert.match(guideSource, /<th>Seçim çubuğu<\/th>/);
  assert.match(guideSource, /<strong>Çoklu modül<\/strong> açıkken modüle dokunmak aynı işi yapar/);
  assert.match(guideSource, /<strong>Çoklu panel<\/strong>’e basıp parmağı bir panelden diğerine kaydırmak aynı dikdörtgeni seçer/);
  assert.match(guideSource, /panel seçimi mavi, modül seçimi turuncudur/);
  assert.match(guideSource, /kaydırmadan başka bir panele dokunmak da ilk seçili panelden oraya kadar seçer/);
  assert.match(guideSource, /Tablette: panele dokun, seçim çubuğunda <strong>Çoklu panel<\/strong>’e bas/);
  assert.match(guideSource, /tablette seçim çubuğundaki <strong>Çoklu modül<\/strong> ile\) en az 2 öğe seç/);
  assert.match(guideSource, /menüde <strong>Gelişmiş ▸<\/strong> altındadır/);
  assert.match(guideSource, /Tablette karta dokunup sahnede yere dokunmak da modülü oraya ekler/);
  assert.match(guideSource, /<strong>Duvar yüksekliği<\/strong>ni seç \(2,5–5 m, varsayılan 3,5 m;/);
  assert.match(guideSource, /Editörde ışık gölgesi, LED projektör ve raf altı aydınlatmanın panele düşen ışığı kapalıdır/);
  assert.match(guideSource, /<strong>Render Al<\/strong> çizerken gölgeyi, projektör ve raf altı ışıklarını açar/);
  assert.match(guideSource, /standın tepesinde bir sahne spotu yanar ve ortam ışığı kısılır/);
  assert.match(guideSource, /<strong>Sahne Işığı<\/strong>, Render Al’ın yanındadır/);
  assert.match(guideSource, /Seçim oturumluktur, projeye kaydedilmez/);
  assert.match(guideSource, /sunucudaki görsel değişmediyse sonraki açılışta yeniden indirilmez/);
  assert.match(guideSource, /Duvara yapışmaz/);
  assert.match(guideSource, /Alt yüze görsel, Lightbox veya Mesh uygulanmaz/);
  assert.match(guideSource, /Üst yüzün ölçüsü genişlik × derinliktir/);
  assert.doesNotMatch(guideSource, /Üst ve alt yüze görsel/);
  assert.match(guideSource, /Adım 10 cm’dir/);
  assert.match(guideSource, /Kutuyu zeminde sürüklemek yüksekliği bozmaz/);
  assert.match(guideSource, /Shift\+R<\/strong> kutuyu 45° döndürür/);
  assert.match(guideSource, /Aynı ölçü penceresi panel, Lightbox ve Mesh için geçerlidir/);
  assert.match(guideSource, /Panel, Lightbox ve Mesh görseli aynı pencereden ölçülür/);
  assert.match(guideSource, /Küpü sürüklemek kamerayı döndürür/);
  assert.match(guideSource, /L Stand Sağ’da sol-ön köşeden bakar/);
  assert.match(guideSource, /ViewCube ⌂ aynı görünüşü açar/);
  assert.match(guideSource, /Sahne ilk açıldığında kamera sağ-ön köşededir/);
  assert.match(guideSource, /Üretim Listesi/);
  assert.match(guideSource, /title: 'Metal Separatör'/);
  assert.match(guideSource, /Metal Separatöre Çevir/);
  assert.match(guideSource, /7 x Metal Separatör 100 × 49,5 cm - metre_kare/);
  assert.match(guideSource, /3,47 × Metal Separatör · metre_kare · metal_separator/);
  assert.match(guideSource, /Aynı grup her zaman tek levha değildir/);
  assert.match(guideSource, /Kopyadaki metal separatör kendi grubunu alır/);
  assert.match(guideSource, /<strong>Kopyala:<\/strong> Modülü hafızaya alır; sahnede tıkladığın veya dokunduğun her yere/);
  assert.match(guideSource, /<th>Ctrl\/Cmd \+ C \/ V<\/th>/);
  assert.doesNotMatch(guideSource, /Çoğalt Sağ \/ Sol/);
  assert.match(guideSource, /Sağ tık menüsünde Kopyala yoktur\./);
  assert.match(guideSource, /<th>İki parmak \(tablet\)<\/th><td>Parmakları açıp kapatmak yakınlaştırır/);
  assert.match(guideSource, /<strong>Yeni proje sihirbazı:<\/strong> Yeni projede boş sahnenin ortasında 3 adım açılır/);
  assert.match(guideSource, /<strong>Depo<\/strong> listesinde <strong>Depo yok<\/strong> yerine 1×1, 1,5×1, 2×1 veya 2×2 m depo ölçüsünü seç\./);
  assert.doesNotMatch(guideSource, /Depo eklensin/);
  assert.match(guideSource, /Mevcut proje açılınca sihirbaz çıkmaz\./);
  assert.match(guideSource, /<strong>İlk ipuçları:<\/strong> İlk sahne kurulunca altta 3 kısa ipucu çıkar/);
  assert.match(guideSource, /İkinci parmak ekrana değince ilk parmağın başlattığı öğe sürüklemesi iptal olur ve öğe yerinde kalır/);
  assert.match(guideSource, /<th>Çift tık \(öğe üstünde\)<\/th><td>Modülün herhangi bir yerine \(panel dahil\) çift tıklamak modülün tamamını seçer/);
  assert.match(guideSource, /Modülün tamamı seçiliyken \(çift tık\) tıklanan modülü toplu seçime ekler veya çıkarır/);
  assert.match(guideSource, /Shift \+ tık ile seçim yoktur; boş alanda Shift kamerayı kaydırır\./);
  assert.doesNotMatch(guideSource, /Shift\+tık ile/);
  assert.doesNotMatch(guideSource, /<th>Shift \+ tık/);
  assert.match(guideSource, /uyarı modülün adını ve sebebini yazar/);
  assert.match(guideSource, /<strong>Metin indir<\/strong>/);
  assert.match(guideSource, /görselin dosya adı, cm ölçüsü ve m²/);
  assert.match(guideSource, /altında o görselin toplam m²/);
  assert.match(guideSource, /panelin rengi hex olarak yazar/);
  assert.match(guideSource, /scene dimensions varsa oradan, o alan boşsa item dimensions/);
  assert.match(guideSource, /Tüm Özellikleri Kaldır/);
});

test('help guide describes the single floor rectangle and reset clearing it', () => {
  assert.match(guideSource, /title: 'Zemin'/);
  assert.match(guideSource, /<strong>Zemin Kaplaması<\/strong> iki modda da standın tamamının baz kaplamasını seçer/);
  assert.match(guideSource, /Bölgesel zemin kontrolleri yalnız <strong>Gelişmiş<\/strong> modda görünür/);
  assert.match(guideSource, /Basit \/ Gelişmiş seçimi standı veya tasarım verisini değiştirmez/);
  assert.match(guideSource, /<strong>Zemin Alanı Ekle<\/strong>/);
  assert.match(guideSource, /50 cm ve katlarıdır ve standın içinde kalır/);
  assert.match(guideSource, /<strong>Sahnede Çiz<\/strong>/);
  assert.match(guideSource, /<strong>Zemin Alanını Sil<\/strong>/);
  assert.match(guideSource, /Aynı anda yalnız bir alan vardır/);
  assert.match(guideSource, /Hazır parke kendi malzemesini kullanır ve boyanmaz/);
  assert.match(guideSource, /Alanın rengi baz renkten ayrıdır/);
  assert.match(guideSource, /sahnedeki modüller ve zemin alanı silinir/);
});

test('help guide supports close button, backdrop click and Escape', () => {
  assert.match(guideSource, /help-guide-close/);
  assert.match(guideSource, /event\.target === backdrop/);
  assert.match(guideSource, /event\.key === 'Escape'/);
  assert.match(guideCss, /\.help-guide-button\s*\{/);
  assert.match(guideCss, /\.help-guide-backdrop\s*\{/);
});

test('help guide describes short panel profiles running support to support in the production list', () => {
  assert.match(guideSource, /kısa panellerin üst ve alt profili dikmeden dikmeye \(ya da duvar ucuna\) tek parça sayılır/);
  assert.match(guideSource, /en uzun uygun profil \+ kalan parça yazılır \(ör\. 450 cm → 388 \+ 41,5\)/);
  assert.match(guideSource, /o raydaki panel profilinin yerine geçer/);
});

test('rehber "5 Dakikada İlk Standın" adımlarıyla açılır; ayrıntılar ayrı bölümde kalır', () => {
  assert.match(guideSource, /title: '5 Dakikada İlk Standın',\s*open: true,/);
  assert.match(guideSource, /<ol class="help-guide-steps">/);
  for (const step of ['Standı kur.', 'Ürün ekle.', 'Yerleştir.', 'Giydir.', 'Kaydet ve göster.']) {
    assert.match(guideSource, new RegExp(`<li><strong>${step.replace('.', '\.')}</strong>`));
  }
  assert.match(guideSource, /nedeni sağ altta bildirim olarak yazar/);
  assert.match(guideSource, /title: 'Hızlı Başlangıç Ayrıntıları',/);
});

test('rehber profil profile her noktada dik bağlanır kuralını anlatır', () => {
  assert.match(guideSource, /<strong>Profil bağlantısı:<\/strong> Profil başka bir profilin her noktasına dik bağlanır/);
  assert.match(guideSource, /Duvar panelinde dik bağlantı yalnız dikme olan noktadadır\./);
});
