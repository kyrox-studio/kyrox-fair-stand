# Fair Stand

Fair Stand, gerçek Maxima fuar standı modüllerini temel alan **kural tabanlı 3D stand konfigüratörüdür**.

Amaç serbest çizim yapmak değil; katalogda tanımlı gerçek modülleri, placement/collision kurallarını ve üretim reçetelerini kullanarak geçerli stand tasarımları oluşturmaktır.

## Güncel durum

Revizyonlara **Proje → Geçmiş**, üretim listesine üst banttaki **Üretim Listesi** düğmesiyle erişilir. Geçmiş başlangıçta kapalıdır; ikisi de Basit/Gelişmiş modda kullanılabilir; açıp kapatmak stand verisini değiştirmez.

Repository ilk MVP taslağının ötesindedir. Mevcut uygulama aşağıdaki ana yetenekleri içerir:

- Gerçek zamanlı Three.js 3D stand sahnesi.
- Tek öğenin sınırı mavi kesik çizgili kutudur; grup ve çoklu öğe seçimi tamamını saran tek turuncu kesik çizgili kutuyla gösterilir. Bu yardımcılar render çıktısına ve proje verisine eklenmez.
- Ortak placement, snap, connection ve collision altyapısı. Duvarda dik bağlantı yalnız dikme olan noktadadır; profil ise profilin her noktasına dik bağlanır (iki profilin arasına, ortasına; yapışma 10 cm adım), uç uca eklenir, birbirinin ortasından geçen profiller çakışır. Profil her dikmeye (bağımsız, kısa panel ucundaki, duvar ucundaki) dört yönden ortalanır ve dikmenin yüzünde durur (`upright-face`); dik profil L köşesi dış yüzden hizalıdır (`profile-flush-corner`). Profil gerçek boyundaki aralığa oturur: iki ucun (dikme, duvar uç dikmesi, dik profil) eksenden eksene uzaklığı profilin gerçek boyu kadarsa araya yapışır (`post-gap`), uymuyorsa girmez; aynı hattaki iki profil düğüm karesini paylaşabilir. İki ucu da köşe olan profil (H / U) iki çıkıntının arasında kısa çizilir (`wallCornerJoints.js`). Baza ve düz banko duvar yüzünde duvarın ucuna hizalanır; stand kenarındaki duvarın arkasına taşabilir (`baseOverhangsEdgeWall`).
- Hata ve uyarılar sağ altta üst üste dizilen kısa bildirimlerdir (`src/toastNotifications.js`); hata için `window.alert` kullanılmaz, ayrıntı konsola da yazılır.
- Sahnenin sol altında stand özeti görünür ("L Stand Sol · 4 × 3 m · duvar 3,5 m"). Üretim listesinde parça kodu ekranda yazmaz (ipucu ve `data-item-key`); kopyalanan üretim metni kodu taşır.
- Yardım rehberi "5 Dakikada İlk Standın" adımlarıyla açılır. Tek açılır/kapanır "Gelişmiş > Ayarlar" bölümü Herşeyi Kilitle, Ölçüleri göster ve Otomatik kayıt kontrollerini anlatır.
- Proje yalnız yeni proje sihirbazından kurulur (`src/newProjectWizard.js`, Oluştur → `createStageFromSetup`): boş sahnede kendiliğinden (✕ ile kapatılırsa boş sahne kartındaki **Yeni proje** ile), açık projedeyken üst banttaki **Yeni** ile açılır (Yeni `projectActionSaveGuard` ile önce açık projeyi kaydeder; Oluştur açık stand varken uygulamanın kendi penceresiyle "Yeni proje oluşturulacak" diye sorar). Sihirbaz sol menüdeki kurulum alanlarına yazar; açıkken bu alanların anında değişim dinleyicileri çalışmaz (`isEditingOpenStand`), ✕ ile kapanınca alanlar açık standa döner. Sol menüde Sahneyi Oluştur düğmesi yoktur. Genişlik ve derinlik en az 2 m (`MIN_STAND_DIMENSION_CM`).
- Sol menüdeki bütün kartlar (Proje, Yerleşim, Modül ekle …) varsayılan kapalı gelir. Sol menüde tek Basit / Gelişmiş seçici bulunur. Ayarlar, Gruplar, Şablonlarım ve Standartlar yalnız Gelişmiş modda görünür. Ölçülerin görünürlüğü moddan bağımsızdır (aşağıda). Herşeyi Kilitle mevcut öğeleri topluca kilitler veya öğe/grup kilitlerini açar; grupları çözmez.
- Kurulumda genişlik, derinlik ve duvar yüksekliği metre gösterir; 4,5 / 6,5 gibi girişler desteklenir, proje ve hesap birimi cm kalır. Tek öğe/grup taşınırken veya yerleştirme önizlemesinde zemin ızgarası görünür.
- Module type'a göre merkezi behavior registry.
- Özellikler paneli (`src/moduleContextMenu.js`, `src/selectionSurfaceSummary.js`): öğeye/yüzeye tek tık sahnenin sağında seçimin desteklediği işlemleri açar; boş alana tık kapatır. Kopyala, Sil, Kilitle ve Ekle üstte sabittir; hemen altında döndürme (Item destekliyorsa), onun altında sekmeler vardır. Sekmeler seçilen Item'a göre değişir: ölçü bölümü Genişlik, Boyut, Yükseklik, Boy, Düzen veya Ölçü adını alır; görsel ve renk bölümü Görsel, Renk veya Logo olur (görsel ölçüsü ve zemin kaplaması burada); Tür veya Aydınlatma ile Grup yalnız o komutlar varsa çıkar. Panel her ekranda sağda, üst çubuğun altında yüzen yarı saydam (buzlu) karttır; üst kenarı üst çubuğun ve sağ üstteki küpün altına kendiliğinden oturur (`src/propertyPanelPlacement.js`); görünüm küpü masaüstünde sol alttadır, panel açılınca üst çubuk yerinden oynamaz; yalnız işlem sonucu ve uyarı mesajı panelde görünür. İçeriği olmayan sekme görünmez, tek sekme kalınca çubuk gizlenir, son seçilen tür hatırlanır. Arşivdeki görsele çift tık Doldur ile aynıdır. Arşivde SVG dosyaları üstte, her grup ada göre sıralıdır; üstteki arama kutusu ada göre süzer (`src/assetLibraryOrder.js`). Renk ve görsel (arşiv, Doldur / Sığdır / Kaldır) yalnız bu paneldedir; kutu blok, ışıklı strafor, tül, görsel ölçüsü, dikme ve profil boyu pencere açmadan panelde canlı değişir. Zemine tıklayınca zemin rengi ve kaplaması panelde seçilir. Çoklu panelde sayı, Karışık değer ve kısmi destekte gerekçeli pasif işlem gösterilir; seçim çubuğu (Döndür / Kopyala / Sil / Çoklu) korunur.
- Işıklı Strafor katalog kartıdır (Elektronik & Aydınlatma, migration `0084_illuminated_foam_card`; kendi önizlemesi `0092_foam_card_preview`); bırakınca seçilir, logo SVG'si paneldeki görsel bölümünden yüklenir ya da arşivde tıklanır, ikisi de hemen uygulanır.
- İki/üç gözlü vitrinin gövdesine tıklandığında renk paleti açılır; iki yan ve iki yatay sunta ortak renklendirilir, cam raflar değişmez. Yetenek DB Item kayıtlarından gelir (`0085_showcase_body_color`); renk kayıt/açmada korunur. Özellikler panelindeki açıklama metni korunur, uzun içerik sıkışmadan kayar.
- Dikme ve profil katalogda tek kartla gelir; bırakırken boy sorulur (ortak pencere `src/itemSizeDialog.js`; `src/uprightHeight.js`, `src/profileLength.js`). Boy listesi `upright` / `profile` varyant ailesinin sahnede çizilebilen üyeleridir; pencere başlığı ailenin başlığıdır (0095). Profil gerçek boy → sahne boyu: 41,5 → 50 … 289 → 300, 388 → 400, 487 → 500 (migration `0078_profile_lengths`). 346,5 cm'yi aşan profil/dikme Üretim Listesi'nde tek satır kalır, adın yanında parça bölünüşü yazar (`Dikme 495 cm (346,5 + 8 + 140,5)`; `fair_stand_item_length_parts`, migration `0080_item_length_parts`).
- **İki Nokta Profil** (üst bant, 2026-11-12): araç açıkken iki uç tıklanır, araya iki nokta arasına en yakın sahne boyunda tek profil konur (tam denk gelmezse de tek parça; eşitlikte kısa boy). Uçlar: tek başına dikme, profil ucu, uçlarında dikme olan duvar ailesinin (duvar / kısa duvar, separatör, kapı, vitrin) uçları ve 2026-11-13'ten beri profilin gövdesi ile duvar ailesinin üst rayı (her noktaya T; gövde ucu öbür ucun dik izdüşümüne oturur, öbür uç yoksa 10 cm adım; uç noktası yakınsa önce o seçilir) (`src/twoPointProfile.js` `findProfileAnchorAt`). Noktalar aynı hatta (yatay / dikey) olmalı; profilin üstü ilk seçilen ucun tepesiyle aynı hizadadır. **Bir ucu boşta** (2026-11-13): ilk uçtan sonra boşluğa tıklanırsa profil o uçtan imlece doğru, imlecin çok kaydığı eksende en yakın boyda konur; dikme / gövde ucunda yüzden, profil / duvar ucundan aynı hatta uzatmada uçtan başlar (`resolveFreeEndProfile`). **Önizleme:** seçilebilir uçlar mavi nokta, seçilen ilk uç turuncu, imleçteki uç büyük nokta (boş uç gri); ilk uçtan imlece kesik turuncu çizgi ve aralık / boy etiketi (`scene3d.setPointPickPreview`). Yerleşim katalog bırakma kuralından geçer (`scene3d.planCatalogModuleAtPoint`, `setPointPickHandler`). Araç açık kalır; düğme ya da Esc kapatır.
- Varyant aileleri katalogda tek kartla gelir: Panel (50 / 100 / 150 / 200), Separatör (50 / 100 + Sarmaşıklı), Kısa panel, Banko, Köşe Banko, Baza (`0079` / `0082` / `0083`), Vitrin (2 / 3 göz), Raf (tekli / 2 / 3 sıralı), TV (42 / 55 / 65), Video Wall (2×2 / 3×3) ve Uzun Saksı (100 / 150 / 200) (`0086_variant_family_cards`). Kart bırakılınca kartın kendisi (varsayılan varyant) konur; pencere açılmaz. Varyantı olan her öğe seçilince Özellikler panelinde varyant düğmeleri görünür ve seçilen varyant sahnede canlı uygulanır (`src/catalogWidthFamily.js` `describeModuleVariants`; `main.js` `changeModuleVariant`). Aile tanımı (başlık, sekme, kart adı, etiket kuralı, eş aile) DB'dedir: `fair_stand_variant_families` (migration `0095_variant_families`), bootstrap `variantFamilies` → `src/variantFamilies.js`; CRM `Varyant Aileleri` ekranından eklenir / düzenlenir / arşivlenir, Item formunda Varyant alanı aile listesinden seçilir. Yeni üye eklemek için Item'ın Varyant alanına aileyi seçmek yeter; kod değişmez. Öğe yerinden oynamaz ve seçili kalır; duvar zincirinde yer gerekirse sonraki (gerekirse önceki) paneller itilir ve üstlerindeki duvar üstü öğeler onlarla kayar (`wallReflow.js` `planContinuousWallReplacement`); zincir dışında yerinde sığmayan varyant reddedilir. Renk / görsel ayarları yapısı aynı kalan parçalarda taşınır. Vitrin Panel & Duvar, Ayaklı Vitrin Banko & Baza altındadır. Sahnedeki öğe silme onay sormaz (Geri al ile döner); geçmiş revizyon görünümünde de Geri al çalışır. Katalog penceresi solda kategori sekmeleri, sağda kartlarla açılır; her seferinde tek öğe eklenir. Özellikler panelinde "Ekle…" öğeyi tıklanan modülün sağına, sonra soluna, önüne ya da sahnede müsait yere koyar; duvar üstü / tepe davranışlı öğeler (TV, raf, ışıklı strafor, projektör) tıklanan modülün üstüne yerleşir. Kopyalamada sağ altta "… hafızaya alındı" bildirimi çıkar; bildirimler alt alta en fazla 2 tanedir. Banko, Köşe Banko ve Baza da tek kartla gelir (100 / 150 / 200, kart ve varsayılan 100; migration `0083_banko_base_cards`). CRM'de yeni proje kaydedilince adres `/stand-projects/{id}` olur. Otomatik alınlık dikmesi panel birleşimine ortalanır.
- Kısa panel katalogda Tek Sıra / Çift Sıra için birer kartla gelir; ölçü soran kartların (kısa panel, profil, dikme) başlığı ölçüsüzdür ("Panel Tek Sıra", "Profil", "Dikme"), sahnedeki parça, Özellikler paneli ve BOM Item adını yazar; ad sahnedeki öğenin ölçüsünü yazar: "Panel Tek Sıra 200", "Profil 388", "Dikme 346,5"; kart 100 cm bırakılır, genişlik (50 / 100 / 150 / 200) Özellikler panelinden seçilir (`src/wallShortWidth.js`, migration `0079_wall_short_cards`, `0086_variant_family_cards`).
- Stand tipi (`src/boothTypes.js`, `stand.boothType`): Maksima Stand, Özel Tasarım, Paket Stand. Sihirbazın ilk adımıdır, Özel Tasarım ve Paket şimdilik pasiftir. Başlık `<tip adı> Yapılandırması` olur, katalog açık tipe göre süzülür: Item'ın `boothTypeKeys` değeri null ise bütün tiplerde görünür (`0091_booth_types`). Tipi olmayan eski projeler Maksima açılır. Yerleşim (Sırt Duvar / L / U / Ada) ayrı alandır: `standType`. Sihirbaz açıkken sol menü kapanır, sihirbaz kapanınca açılır.
- Kurulu standda duvar yüksekliği (`src/standResize.js`, kurallar `src/standResizeRules.js`): sahne kurulduktan sonra sol menüdeki **Duvar yüksekliği** değişince yeniden boyutlandırma motoru yeni modül listesini ve özeti üretir; onay penceresi ne değişeceğini sayar, onaylanınca tek adımda uygulanır (Geri al döndürür, sahne baştan kurulur). Duvar ailesi (düz duvar, kapı, vitrin, separatör, depo duvarı) yeni yükseklikteki karşılığına döner; bantlar alttan korunur (eklenen bant boş, kalkan üst bant renk ve görseliyle gider); duvar tepesine kadar uzanan Lightbox / Mesh yeni boya uzar ve kaplama sahipliği güncellenir; `z_reference = wall-top` öğeler (profil, kısa duvar / alınlık), duvar tepesindeki projektör ve tavana değen tül fark kadar iner/çıkar; tepeye ulaşan dikme fark kadar kısalır/uzar (kısa dikme ve karşılığı olmayan boy değişmez); tepeyi aşan TV / strafor / kutu tepeye, raf sığan en üst birleşime iner. Kurallar yalnız Maksima için tanımlıdır; diğer stand tiplerinde değişim reddedilir.
- Kurulu standda genişlik / derinlik (aynı motor, `planStandSizeChange`): sol menüdeki **Genişlik** / **Derinlik** alanının ▲▼ okları 1 m değiştirir, elle 0,5 m adımlı değer yazılır (9,5'te ▲ 10,5 olur; en az 2 m, en çok 50 m; `MIN_STAND_DIMENSION_CM`); yazılan değer Enter'da (veya alan bırakılınca) uygulanır. Bir şey kalkacaksa (panel, görsel, duvar üstü öğe, sığmayan öğe, bölgesel zemin; `standSizeChangeRemovesContent`) önce önizleme + onay sorar; büyütmede ve hiçbir şey kalkmayan küçültmede doğrudan uygulanır, kısa bildirim çıkar; ikisi de tek adımdır; sahne (zemin, ızgara, salon) yeni ölçüyle kurulur, Geri al döndürür. Genişlikte Sırt Duvar ve U'da sırt duvarı iki uçtan eşit uzar / kısalır (50 cm adım), içerik ortada kalır; L'de köşe tarafı sabittir, açık uç uzar / kısalır (L Sağ'da sırt duvarı ΔX kayar); Ada'da bütün içerik farkın yarısı kadar kayar, ortada kalır. Derinlikte sırt duvarı yerinde kalır, açık ön kenar uzar / kısalır. Her duvar uçtan uca dolar: uzayan kenara ve elle silinmiş panellerin boşluğuna yeni boş düz panel girer, kalan paneller yerinde kalır; kısalan kenarda dışarıda kalan panel görselleriyle kalkar, yarısı kalan düz panel daraltılır, kapı / vitrin kalkar. Duvar üstü öğeler duvarıyla kayar, dışarıda kalan kalkar; depo bağlı olduğu duvarla (Ada'da merkezle) hareket eder. Serbest öğelerde aynı gruptakiler ve zemindeki izi birbirine değenler tek küme sayılır: kenar kararı kümenin ortasından verilir, küme bölünmez; taşan küme bütün hâlinde en kısa kaydırmayla, mümkünse başka öğeye çarpmayan yere içeri alınır, hiç sığmıyorsa yerinde kalır ve önizlemede yazılır. Standı uçtan uca kaplayan tül stand kısalınca o eksende kısalır (taşma payı korunur), uzayınca uzamaz. Alınlık yeni kenara göre yeniden kurulur, bantları kenarda en çok örtüşen yeni panele aktarılır; bölgesel zemin yeni alana kırpılır veya kalkar. Boyu değişen duvarın projektörleri kurulum kuralıyla yeniden dizilir (`relayAutomaticWallLamps`; depo yan panelindeki kalır). Değişimin yeni ürettiği parçalar kilit tercihini izler (`inheritLockForNewModules`): önceden hiçbir öğe kilitli değilse kilitsiz, hepsi kilitliyse kilitli gelir, karışıksa varsayılan kalır; **Herşeyi Kilitle** kendi kendine değişmez (yerleşim / depo / alınlık değişiminde de). Kurulu standda ölçü alanında Enter sahneyi baştan kurmaz, ölçü değişimini uygular. Önizleme uygulamanın kendi penceresidir (`src/standChangeDialog.js`; Uygula / İptal / Esc): tarayıcının `confirm` penceresi bazı gömülü tarayıcılarda açılmadan İptal döndüğü için kullanılmaz.
- Kurulu standda yapı değişimi (aynı motor, `planStandStructureChange`; yerleşim için `planStandLayoutChange`): sol menüde Sırt Duvar / U / L Sol / L Sağ / Ada'ya tıklayınca veya **Depo**, **Depo ekipmanlarını ekle**, **Üst tabela (alınlık)**, **Stand mobilyalarını ekle** değişince tek adımda uygulanır, Geri al döndürür; bir şey kalkacaksa (duvar, panel, görsel, depo, ekipman, alınlık, mobilya; `standStructureChangeRemovesContent`) önce önizleme + onay sorar, kalkmıyorsa doğrudan uygulanır ve kısa bildirim çıkar. Depo eklenince / kaldırılınca / yeri değişince depo ve depoya göre dizilen sırt / yan duvar yeniden kurulur (görseller aynı konumdaki panele aktarılır); yalnız ekipman değişince depo yerinde kalır, ekipman eklenir / kalkar. Alınlık yeni sıra sayısına ve açık kenarlara göre kurulur veya kalkar. Stand mobilyaları işaretlenince set (1 m banko, bar taburesi, masa sandalye takımı, broşürlük, yapay çiçek) sahnede benzeri olsa da eklenir; işaret kaldırılınca setteki her üründen sahnede varsa birer tane, setin yerine en yakın olanı kalkar. Depoyla çakışan serbest küme bütün hâlinde en yakın boş yere itilir. Yerleşim değişiminde sahne yeni yerleşimle kurulur; yeni yerleşimde de olan duvar görseli ve üstündeki öğelerle yerinde kalır; olmayan kenarın duvarı görselleri ve üstündeki öğelerle kalkar (Ada'da bütün kenar duvarları; kalkan görsel hatırlanmaz); yeni kenara boş, kilitli düz duvar gelir; kalan duvardaki elle silinmiş panellerin boşluğu da dolar. Yeni, yeniden dizilen ya da boşluğu dolan duvarın projektörleri kurulum kuralıyla dizilir. Depo yeni yerleşimdeki yerine kurulur (yeri ve dizimi değişmiyorsa dokunulmaz), alınlık yeni açık kenarlara göre yeniden kurulur. Serbest öğeler yerinde kalır; yeni depoyla çakışan küme bütün hâlinde içeri alınır. Otomatik duvar paneli, depolu sırt / yan duvar, depo gövdesi, depo projektörleri, alınlık ve stand mobilyaları motorun `composeStandWallStates` / `createDepotStates` / `createDepotLampStates` / `createAutomaticFasciaStates` / `createFurnitureStates` fonksiyonlarından üretilir; sihirbazın **Oluştur** adımı ve **Sahneyi Sıfırla** da bunları kullanır.
- Otomatik stand mobilyaları (`src/autoFurniture.js`): sahne kurulurken **Stand mobilyalarını ekle** kutusu (sol menü + sihirbaz, varsayılan seçili) 1 m banko (`desk_banko_100`) + hemen arkasında bar taburesi (`furniture_bar_stool_classic`), Eames masa sandalye takımı (`furniture_table_chair_set_eames`), broşürlük (`brochure_stand`) ve yapay çiçek (`extra_indoor_plant_1`) koyar. Banko ön cephede solda, çiçek sağ önde, broşürlük ön ortada, masa takımı arkada; açı Item `defaultRotationDeg` (ön yüz koridora). Stand kenarından 30 cm, birbirinden ve depodan 20 cm pay; sığmayan öğe atlanır. Öğeler kilitsiz katalog Item'ıdır; seçim `stand.furniture { enabled }` olarak kaydedilir (alanı olmayan eski projede kutu boş gelir).
- Yeni sahne kaydedilince kilitli öğe varsa sahnenin sol üstünde, sahneyi kilitlemeyen **Duvar zinciri hareket korumalı** kartı çıkar (`src/wallLockNotice.js`): korumanın yalnız taşıma/döndürme/silmeyi engellediğini, renk ve görsele engel olmadığını söyler. **Korumayı kaldır** tüm öğelerin kilidini açar (Ayarlar → Herşeyi Kilitle boşalır, Geri al ile döner); **Koruma kalsın** ya da Escape hiçbir şeyi değiştirmez. Açık projeyi yeniden açarken sorulmaz.
- Sahne ölçüleri moddan bağımsızdır: yalnız Ayarlar → **Ölçüleri göster** kutusu belirler (varsayılan işaretli; oturumluk, projeye yazılmaz). Kutu kaldırılırsa Basit ve Gelişmiş modda ölçü çizilmez (`src/editorViewSettings.js`).
- Otomatik duvar, depo ve alınlık yerleşim yardımcıları (alınlık: açık kenarlara tek/çift sıra wall-short + açık köşelere dikme; destekler arası en çok 500 cm, ara dikmeler eşit aralıklı, dolgu parçaları ortaya doğru — `src/autoFascia.js`). Uç uca kısa panellerin (Tek ve Çift Sıra) üst/alt profili BOM'da taşıyıcıdan taşıyıcıya (dikme ya da tam boy duvar ucu) tek profil olur; tam boy yoksa en uzun uygun profil + kalan parça (400 → `profile_388`, 450 → `profile_388` + `profile_41_5`); kısa panelin bağlantı çizgisine konan, paneli kapsayan profil o raydaki panel profilini düşürür — `src/relationshipBom.js`.
- Panel, separatör, vitrin, raf, depo kapısı, panel bazalı duvar, banko ve baza modülleri.
- Mobilya, depo ekipmanı, bitki/saksı, TV/video-wall ve LED projektör katalog öğeleri.
- Renk, görsel ve editable surface state altyapısı. Birden çok panele tek görsel (`rect-group`) aynı hattaki panellerde yayılır; köşeden dönen yüzler kenarları uç uca değiyorsa tek şerit sayılır, görsel katlanmış afiş gibi döner (`src/rectImageLayout.js`); Üretim Listesi bloğu tek baskı sayar (`src/printAreaBom.js`).
- Öğe kilidi: kilitli öğe taşınmaz, döndürülmez, silinmez ve zincir kaydırmasıyla oynamaz. Çift tıkla modülü seçip Ctrl/Cmd+tık ile toplu seçerek toplu kilitleme yapılır (`src/moduleLock.js`).
- Geri al / İleri al (Ctrl+Z / Ctrl+Y, üst bant düğmeleri): tasarımın son 50 adımı; kaydedilmez (`src/designHistory.js`).
- Gruplar: çift tık + Ctrl/Cmd+tık seçimi → Özellikler paneli → Grup oluştur. Gruplar ve Şablonlarım kartları yalnız Gelişmiş modda görünür; Şablon olarak kaydet Gruplar kartındadır. Öğeden bağımsız; her üyede `group: { id, name, locked, fromWallId? }`. Grup her yöne taşınır ve çoğaltılır, tek kısıt stand alanı; kenara bağlı duvar parçaları gruplanınca serbest öğeye çevrilir. Grup kilidi bütün üyeleri kilitler. Gruptaki öğede Shift+R bütün grubu üye merkezlerinin ortası etrafında 45° döndürür (tek kısıt stand alanı); dik açıya gelince grup en küçük ortak kaydırmayla 5 cm ızgaraya oturur. Grup / şablon adı ve onayları uygulamanın kendi penceresinden sorulur (`src/inAppDialogs.js`), tarayıcı prompt / confirm değil.
- Aynala (Gelişmiş mod): Sağ / Sol / Ön / Arka; seçimin (tek öğe ya da toplu seçim; gruptaki öğede grupla birlikte) aynalı kopyası o kenarından hemen bitişiğine eklenir, orijinal kalır; çakışma aranmaz, yalnız stand dışına taşarsa eklenmez (`planMirrorCopy`, `src/moduleGroups.js`).
- Köşe birleşimi: dik köşede (iç / dış; duvar, kapı, separatör, vitrin, kısa duvar) iki modül tek ortak dikmeyle çizilir, paneller uzamaz; kısa panel ucundaki bağımsız dikme kısa panelin uç dikmesinin yerine çizilir, dikmeye ya da profile L köşede binen profil komşunun iç yüzünde biter; yalnız görünüm, üretim listesi değişmez (`src/wallCornerJoints.js`).
- Panel kaldırma: düz duvarın ön / arka bant paneli sağ tık → Paneli kaldır; duvara sağ tık → Kaldırılan panelleri geri ekle. Üretim listesinde panel ve iki yan aparatı düşer (`src/panelRemovalBom.js`, kararlar `docs/refactor/PENDING_ITEM_DECISIONS.md` B.17).
- Profil rengi: Gelişmiş modda Yerleşim kartında, proje geneli (Varsayılan / Siyah); standda `profileFinish` olarak kaydedilir, yalnız görünümü değiştirir (`src/profileFinish.js`).
- Kurumsal grup şablonu: Gruplar kartı → Şablon olarak kaydet; Şablonlarım kartı → Yerleştir / Adlandır / Sil. Şablon Item değildir; parçaların itemKey, ölçü, göreli konum, açı, renk, cam panel ve metal separatör atamasını tutar; lightbox/mesh kumaş ve görselleri tutmaz (`src/groupTemplates.js`, `src/groupTemplateRemote.js`, `src/groupTemplatePanel.js`). Sunucu: `fair_stand_group_templates` (migration `0067`), API `/api/v1/fair-stand/group-templates`, organizasyon kapsamlı, proje yetkileriyle. Kenar çubuğunda Gruplar kartı (`src/moduleGroups.js`, `src/moduleGroupPanel.js`).
- Otomatik kayıt süresi (Gelişmiş → Ayarlar → Otomatik kayıt): Kapalı / 3 / 5 / 7 / 10 dk, varsayılan 3 dk; seçim tarayıcıda (`localStorage` `fairStand.autosaveMinutes`) tutulur (`src/autosaveSettings.js`). Kaydedilmemiş değişiklik sekme gizlenince veya editörden çıkılınca kaydedilir; sayfa kapatılırken tarayıcı uyarır.
- Eksik görsel: proje açılırken indirilemeyen görsel (sunucuda dosya yok) açılışı engellemez. Yüzey kendi rengiyle çizilir, durum satırı eksik sayıyı yazar; `imageAssetId` bağlantısı projede korunur (`src/projectRemote.js` `cacheProjectAndAssets`, `src/scene3d.js` `applyStoredImage`).
- İçe aktarma müşteri ister: paket ve açık editör müşterisizse sunucu hatası yerine yol gösteren mesaj çıkar.
- Oturumsuz demo (ADR-0012; CRM `/stand-demo`, `mountFairStand(el, { demo: true })`): Farklı Kaydet, Dışarı Aktar, İçe Aktar, Aç, Sil, Kaydet, Render Al, Ekranı paylaş, Şablon olarak kaydet ve proje adı Değiştir basınca "Demo sayfasında bu işlem için oturum açmanız gerekiyor." der (`src/demoMode.js`). Sahne kurulur ama ad sorulmaz, proje hiçbir yere kaydedilmez; otomatik kayıt kapalı, Geçmiş gizli. Gelişmiş mod, görsel yükleme, ışık ve geri/ileri al açıktır. Üretim Listesi gerçek listeyi hesaplamaz, sabit örnek satırlar ve "Demo görüntülemede gerçek Üretim Listesi görülemez." notunu gösterir (`src/demoProductionBom.js`). Süre sunucuda sayılır: tarayıcı başına 24 saatte 25 dk aktif kullanım, IP başına 3 katı; 30 sn'de bir sinyal, gizli sekme saymaz, bitince kilit ekranı (`src/demoSession.js`; API `/api/v1/fair-stand/demo/session`, `/heartbeat`, `/catalog/bootstrap`; `backend/app/modules/fair_stand/application/demo_access.py`; tablo `fair_stand_demo_usage`, migration `0094_demo_usage`). Demo kataloğu bootstrap'tan `lengthParts` ve `isCostEnabled` çıkarılmış hâlidir. Açmak için `FAIR_STAND_DEMO_ENABLED=true` ve `FAIR_STAND_DEMO_SECRET` gerekir; biri yoksa uçlar 404 döner. Ayarlar: `FAIR_STAND_DEMO_MINUTES` (25), `FAIR_STAND_DEMO_IP_MULTIPLIER` (3), `FAIR_STAND_DEMO_HEARTBEAT_SECONDS` (30), `FAIR_STAND_DEMO_TRUSTED_PROXIES` (`127.0.0.1,::1`).
- Recipe / production-parts tabanlı BOM ve üretim verisi altyapısı.
- Proje ve asset yönetimi için ayrı state/storage katmanları.
- Module/feature contract altyapısı, universal system change gate ve full-system impact sweep.
- Node regression test paketi ve Playwright tabanlı gerçek-browser E2E katmanı.
- Canonical GitHub Actions CI.

> Modül bazlı kesin placement, snap, rotation, collision, production ölçüsü veya recipe adetleri README içinde tekrar tutulmaz. Bunların canonical kaynakları ilgili runtime/contract dosyalarıdır.

## Teknoloji

- JavaScript ES Modules
- Three.js
- Vite
- FastAPI catalog API (`:8002`) + PostgreSQL `fair_stand`
- Node.js built-in test runner (`node --test`)
- pytest (backend catalog API)
- Playwright + Chromium E2E
- JSZip
- GitHub Actions

## Kurulum

CI Node 22 kullanır.

```bash
npm ci
npm run dev
```

Vite geliştirme sunucusunun verdiği local adresi tarayıcıda açın.

## Komutlar

```bash
npm run dev              # local development server
npm run contract:verify  # schema + diff + full-system impact verification
npm test                 # unit/integration regression suite
cd backend && pytest     # catalog API tests (Fair Stand FastAPI)
npm run build            # production build
npm run e2e:deps         # pinned Playwright test runner'ı local node_modules'a kur
npm run e2e:install      # Chromium browser binary'sini kur
npm run e2e              # real-browser Playwright E2E suite
                         # her koşu 4173'te kendi Vite sunucusunu açar; port doluysa önce eski sunucuyu kapat
npm run preview          # built application preview
```

## Zorunlu değişiklik akışı

İnsan veya AI bir guarded değişiklikte şu katmanları izler:

1. `SYSTEM_CHANGE_GATE.md` — universal değişiklik kabul kapısı.
2. `SYSTEM_IMPACT_SWEEP.md` — değişen dosya/symbol/UI/asset yüzeyinden callers, transitive dependents, mevcut testler, docs/contracts ve audit finding adaylarının tam taraması.
3. `.github/change-contract.json` — impact ve review kararlarının machine-readable deklarasyonu.
4. `SYSTEM_DEVELOPMENT_CONTRACT.md` — module / feature / core değişikliğinin domain contract'ları.
5. İlgili canonical owner dosyaları güncellenir.
6. Değişen davranış için targeted regression eklenir/güncellenir.
7. `SYSTEM_BROWSER_E2E_DOMAINS` registry'sindeki bir browser-impact domain etkileniyorsa değişikliğe özel targeted E2E yazılır.
8. Full test + build + Playwright E2E çalıştırılır.
9. PR canonical CI'dan tamamen yeşil geçmeden merge edilmez.

Impact domain sayısı sabit değildir. `.github/change-contract.json`, `src/systemChangeContract.js` içindeki `SYSTEM_IMPACT_DOMAINS` registry'sinde o anda tanımlı **bütün domainler** için karar taşır. Browser E2E zorunluluğu da `SYSTEM_BROWSER_E2E_DOMAINS` registry'sinden hesaplanır.

Canonical CI şu sırayı çalıştırır:

```text
checkout (full git history)
→ npm run contract:verify
→ npm ci
→ npm run audit:deps (npm audit --audit-level=high)
→ npm run syntax:check
→ npm test
→ python -m pytest (backend/)
→ pip-audit (backend/requirements.txt; yalnız uyarı)
→ npm run build
→ Playwright runner kurulumu
→ Chromium kurulumu
→ npm run e2e
```

E2E failure olduğunda Playwright trace/screenshot/video kanıtları GitHub Actions artifact olarak saklanır. Böylece browser akışındaki gerçek hata CI logu ve görsel kanıt üzerinden incelenebilir.

`npm run contract:verify` local ortamda da committed/staged/unstaged/untracked farkları fail-closed biçimde denetler. Gerekirse base açıkça `CHANGE_GATE_BASE=<git-ref>` ile verilebilir.

## Temel mimari

Sistem, tek bir dosyanın bütün ürün kurallarını taşıması yerine sorumlulukları ayırır.

### Catalog

`src/catalog.js`

Katalog DB'den gelir (kategoriler, önizleme türleri, Item `catalog*` alanları); `src/catalog.js` bootstrap edilen Item registry'den katalog listesini kurar (`docs/refactor/CATALOG.md`). Nominal katalog/placement ölçüsü ile gerçek üretim kesim ölçüsü aynı kavram değildir.

### Module contract

`src/moduleContracts.js`

Modül sözleşmesini (profile, state/appearance/renderer/runtime/composition ve BOM policy) Item'dan türetir: profil Item tipinden, BOM policy Item `composition`'dan (`resolveModuleContract`). Item'a özel atama yoktur (`MODULE_CONTRACT_ASSIGNMENTS` boş). Katalog dışı runtime modülleri `NON_CATALOG_MODULE_CONTRACTS` registry'sindedir.

### Feature contract

`src/featureContracts.js`

Birden fazla modülü/domaini koordine eden scene-composition özelliklerinin contract sahibidir.

### Module behavior

`src/moduleBehavior.js`

Module type'a göre değişen editor davranışlarının canonical kaynağıdır:

- placement mode,
- move snap,
- side insertion,
- collision strategy,
- ghost strategy.

Sahne Z dönüş adımı / varsayılan / yan ek Item kolonlarıdır: `docs/refactor/ROTATION.md`. Tip davranışı (`fair_stand_item_type_scene_behavior`) rotation taşımaz. Getter'lar `src/moduleBehavior.js` içindedir.

Katalogdaki her mevcut runtime type explicit behavior coverage taşımak zorundadır.

### Placement / connection

Placement core stand sınırı, snap, bağlantı geometrisi, collision ve reflow gibi geometrik kuralları doğrular. Behavior registry hangi stratejinin kullanılacağını seçebilir; gerçek geometrik hesap placement katmanında kalır.

### State

State construction'ın canonical sahibi `src/designState.js` ve ilgili state factory/registry yapısıdır. Runtime-derived veya renderer-only değerler gereksiz yere persisted state'e dönüştürülmemelidir.

### Renderer

`src/scene3d.js` Three.js sahnesini ve module rendering akışını yönetir. Placement veya üretim kuralı renderer'ın tek sorumluluğu haline getirilmemelidir.

Işık: editörde ortam (hemisphere) ve tepeden ana ışık (directional) yanar, gölge kapalıdır. Projektör ve raf altı spotları `RENDER_ONLY_LIGHT_LAYER` katmanındadır; yalnız **Render Al** (`captureCurrentViewPng`) çizerken açılır. Stand tepe spotu (`STAND_TOP_SPOT`, gölge atmaz) kendi `STAGE_LIGHT_LAYER` katmanındadır ve stand ölçüsüne göre zemine ışık havuzu düşürür. `applyStageLighting` bu katmanı açar ve ortam ışığını ters çevirir (`STAGE_HEMISPHERE`: gök rengi koyu, yer rengi açık; zemin ve hol karanlık, alınlık gibi dikey yüzler aydınlık). Editörde sahne ışığı açıkken ana ışık kapalıdır, ışık sayısı kapalı editörle aynı kalır (yavaş cihazda dokunma gecikmesin); Render Al'da ana ışık gölge için `RENDER_KEY_LIGHT_DIM` oranında yanar. Render Al çizerken her zaman, editörde varsayılan açıktır ve üst banttaki **Sahne Işığı** düğmesiyle (`setStageLightPreview`) kapatılabilir. Önizleme oturumluktur, projeye kaydedilmez; Render Al bitince önizlemenin son durumuna dönülür.

Alınlık gövdesi: otomatik alınlık panellerinin (`autoFascia`) arka yüz paneli yoktur; içeriden görünen gövde `FASCIA_BACK_COLOR` açık renkle çizilir (diğer panellerde `PANEL_BACK_COLOR`). Yalnız görünümdür; BOM ve arka yüz paneli değişmez.

Kamera derinliği: perspektif kameranın `near` değeri bakılan noktaya uzaklığın %1'idir (`PERSPECTIVE_NEAR`, 0.05–1 m; `syncPerspectiveNear`). Sabit 0.05 m'de büyük standlarda uzak panellerin yüzü ile gövdesi arasındaki 3 mm boşluk titriyordu (z-fighting); yakın çekimde near 0.05 m kalır.

### Production / BOM

- PostgreSQL `fair_stand` — Item master ve Item `composition` (reçete/part miktarı) verisi; Fair Stand API (`:8002`) üzerinden bootstrap edilir.
- `src/items.js` — bootstrap edilen runtime Item registry'si: leaf/production metadata, commercial, wall-media ve composite parents. Statik master değildir.
- `src/moduleRecipes.js` — `composition` satırlarını `itemKey` üzerinden açan resolver.
- `src/moduleContracts.js` — modülün BOM policy sözleşmesi (governance; runtime BOM `src/itemBom.js` / `src/projectBom.js`, onu import etmez).

Roadmap veya README bu verilerin ikinci sabit kopyası değildir.

### Persistence / storage

Project state ve asset blob storage ayrı katmanlarda tutulur. Project switch/save/load/import-export gibi cross-domain akışlar ilgili persistence/storage contract ve regression testleriyle korunur.

## Koordinat standardı

- X/Y: zemin düzlemi
- Z: yükseklik
- Plan dönüşü: Z ekseni etrafında

Dönüş adımı ve movement snap global sabit değildir. Modül davranışı `src/moduleBehavior.js` üzerinden okunmalıdır.

Seçili öğe ok tuşlarıyla tip `moveSnapCm` adımında taşınır; tuşun yönü kameraya göre en yakın eksene gider. Dikey (Z) adım yalnız DB `fair_stand_items.vertical_move` açık öğede vardır (TV, strafor, tül, raf, küp blok, LED projektör, profil, kısa duvar, dikme): ↑/↓ ekranda dikeye denk gelince öğe Z'de taşınır. Yerden tabanlı öğede taban 0'ın altına inmez, tepesi stand tavanını geçmez (`getWallShortFloorZBoundsCm`).

## Yeni modül / feature eklerken

Yeni iş yalnız katalog satırı veya UI butonu eklemek değildir.

Önce universal change declaration hazırlanır:

1. `SYSTEM_CHANGE_GATE.md` ve `SYSTEM_IMPACT_SWEEP.md` okunur.
2. `SYSTEM_IMPACT_DOMAINS` registry'sindeki bütün domainler için `affected` / `not-applicable` kararı verilir.
3. Reverse dependency/test/doc/finding discovery çalıştırılır ve `.github/change-contract.json` içinde acknowledgement yapılır.
4. Browser-impact domain varsa `tests.e2e.required=true` ve değişikliğe özel targeted `e2e/**` spec beyan edilir.
5. Sonra `SYSTEM_DEVELOPMENT_CONTRACT.md` içindeki module/feature/core contract akışı uygulanır.

Bir katalog modülü için en az şu alanlar kontrol edilir:

- catalog identity / descriptor,
- module contract/profile,
- state construction,
- explicit behavior,
- placement/collision etkisi,
- renderer/routing,
- persistence,
- BOM policy / recipe,
- composition/dependency,
- affected existing tests,
- targeted regression,
- targeted E2E browser akışı.

Bir feature birden fazla modülü/domaini koordine ediyorsa `src/featureContracts.js` contract'ı ayrıca kontrol edilir.

## Repository belgeleri

### Açık iş — tek kaynak (oturum buradan başlar)

Dağınık not / bayat sayaç karışıklığını önlemek için:

1. **İş listesi (tek)** — `kyrox-platform/projects/fair-stand/ROADMAP.md`
2. **Açık audit bulguları** — `audit/FINDINGS.md` (F-* aç/kapa yalnız burada)
3. **Ertelenmiş kararlar** — `docs/refactor/PENDING_ITEM_DECISIONS.md`

**Bakma (tarihî / ikinci kopya):** `SYSTEM_AUDIT_CHECKLIST.md`, `audit/FULL_SWEEP_STATE.md`, eski `audit/evidence/*` OPEN satırları. Bunlardaki OPEN/IN_PROGRESS sayaçları güncel backlog değildir.

### Canonical bugün

- `PROJECT_RULES.md` — global product invariant'ları.
- `ARCHITECTURE_RULES.md` — sistem katmanları ve source-of-truth sınırları.
- `SYSTEM_CHANGE_GATE.md` — universal system-change kabul sözleşmesi.
- `SYSTEM_IMPACT_SWEEP.md` — reverse dependency/test/doc/finding + browser-impact tarama sözleşmesi.
- `SYSTEM_DEVELOPMENT_CONTRACT.md` — module/feature/core geliştirme sözleşmesi.
- `MODULE_BEHAVIOR_STANDARD.md` — module behavior registry sözleşmesi.
- `SYSTEM_MODULE_CATALOG.md` — runtime catalog/contracts ile test edilen okunabilir katalog indeksi; runtime source-of-truth değildir.
- `audit/FINDINGS.md` — açık/kapalı audit bulgu defteri (kanonik).
- `docs/refactor/PENDING_ITEM_DECISIONS.md` — ertelenmiş Item/zarf kararları (kanonik).
- `SYSTEM_AUDIT_CHECKLIST.md` — A00–A24 tarihî metodoloji şablonu; açık iş takipçisi değil.
- `audit/FULL_SWEEP_STATE.md` — A00–A24 tarihî mühür; açık iş takipçisi değil.

### Plan / gelecek

- `ROADMAP.md` — aktif üst seviye ürün/teknik plan.
- `ROADMAP_PHASE_4.md` — FAZ 4 ayrıntılı planı.
- FAZ 5–6 ayrıntılı planı, gelecek ürün gereksinimleri ve render backlog'u `kyrox-platform` deposundadır: `projects/fair-stand/ROADMAP_PHASE_5_6.md`, `PRODUCT_FUTURE.md`, `RENDER_FUTURE_BACKLOG.md`.
- Sahne editörü planı (kilit, geri al, grup, çok duvarlı grup, kurumsal şablon) de `kyrox-platform` deposundadır: `projects/fair-stand/GROUP_LOCK_ROADMAP.md`. Faz 1–5 (kilit, geri al, grup, grup döndürme, kurumsal şablon) uygulandı.

### Historical / legacy

- Tarihsel kayıtlar (`MILESTONES.md`, Ağustos 2026 changelog'u, `LEGACY_TRASH.md`, BASE migration handoff) `kyrox-platform` deposunda `archive/fair-stand/` altındadır.
- `FRESH_REPOSITORY_REVIEW.md` ve `REPOSITORY_CLEANUP_PROGRESS.md` (tarihî inceleme ve temizlik kayıtları) `kyrox-platform` deposunda `archive/fair-stand/` altındadır.

Tarihsel dosyalardaki “mevcut / sıradaki iş” ifadeleri bugünkü durum olarak kullanılmaz.

## Geliştirme politikası

Standart akış:

```text
fresh main
→ branch
→ SYSTEM_CHANGE_GATE domain declaration
→ SYSTEM_IMPACT_SWEEP dependency/test/finding discovery
→ module/feature/core contract kararı
→ implementation
→ impact sweep tekrar
→ targeted regression
→ browser-impact ise targeted E2E
→ npm test
→ npm run build
→ npm run e2e
→ PR
→ canonical CI
→ merge (yalnız PR CI yeşilken; main'de tekrar koşu yok)
```

Core placement, behavior, catalog, persistence, renderer, BOM veya başka bir domain değişiyorsa ilgili regression aynı PR içinde eklenmeli/güncellenmelidir. Browser-visible etkisi olan değişiklik kendi Playwright E2E akışını da aynı PR içinde taşır.

## Product invariant'ları

Kısa özet:

- Kullanıcı açıkça istemedikçe silinen modülün oluşturduğu boşluk otomatik kapatılmaz.
- Auto-compaction varsayılan davranış değildir.
- `wallId` placement metadata'sıdır; ayrı ürün sınıfı değildir.
- Nominal placement ölçüsü, fiziksel footprint ve production/BOM ölçüsü birbirinden farklı olabilir.
- Module-specific davranışlar global varsayımlara göre değil behavior registry üzerinden belirlenir.

Ayrıntılı canonical kurallar için `PROJECT_RULES.md`, `ARCHITECTURE_RULES.md`, `SYSTEM_CHANGE_GATE.md`, `SYSTEM_IMPACT_SWEEP.md`, `SYSTEM_DEVELOPMENT_CONTRACT.md` ve `MODULE_BEHAVIOR_STANDARD.md` dosyalarına bakın.
