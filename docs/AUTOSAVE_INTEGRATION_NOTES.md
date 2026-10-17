# Autosave Integration Invariants

Bu dosya canlı autosave akışını controller'a bağlarken korunması gereken davranışları sabitler.

- Watch interval: 1000 ms.
- Değişiklik algılanınca save debounce: kullanıcının seçtiği süre (3 / 5 / 7 / 10 dk, varsayılan 3 dk = 180000 ms). Sürekli düzenlemede en uzun bekleme de aynı süredir.
- Süre `src/autosaveSettings.js` ile tarayıcı `localStorage` (`fairStand.autosaveMinutes`) içinde tutulur; geçersiz/okunamayan değer varsayılana düşer. Proje verisine yazılmaz.
- `0` = Kapalı: `setDelayMinutes(0)` zamanlayıcı kurmaz, izleme sürer ve durum `Kaydedilmemiş değişiklik var · otomatik kayıt kapalı` olur. Kapalı seçimi `disable()` çağırmaz; `isEnabled()` "proje en az bir kez kaydedildi" anlamını korur (işlem öncesi kayıt koruması buna bağlıdır).
- Aynı signature tekrar görülürse yeni save planlanmaz.
- Yeni değişiklik mevcut pending save'i iptal edip bekleme süresini yeniden başlatır.
- Autosave persist çağrısı `{ quiet: true }` ile yapılır (remote açıksa `projectRemote` → sunucu SoT + IndexedDB cache).
- Başarılı autosave sonrası güncel state signature baseline olur.
- Persist hatasında autosave enabled kalır ve kullanıcıya `Otomatik kayıt başarısız.` gösterilir.
- Yeni proje oluşturma / proje restore / pagehide sırasında autosave disable edilir.
- `beforeunload` yalnız `hasUnsavedChanges()` true ise tarayıcı uyarısı ister; disable etmez.
- Sekme gizlenince (`visibilitychange` → hidden) ve editör kapatılırken (`stopFairStandConfigurator`) `saveNowIfDirty()` çalışır: kayıtlı projede kaydedilmemiş değişiklik varsa otomatik kayıt kapalı olsa da kaydeder, denetleyiciyi yeniden açmaz.
- İlk başarılı proje kaydı ve proje restore sonrası autosave güncel state'ten enable edilir.
- Manuel save ve rename öncesi pending autosave iptal edilir; başarılı kayıt sonrası güncel state baseline yapılır.
- Asset silme sırasında referans temizliği kalıcılaştırılıyorsa pending autosave iptal edilir; persist sonrası güncel state baseline yapılır.

`src/autosaveController.js` ve `test/autosaveController.test.js` bu davranışın controller kontratını korur. `test/autosaveMainIntegration.test.js` ise `main.js` içinde ikinci bir legacy timer/state döngüsünün tekrar oluşmasını engeller.
