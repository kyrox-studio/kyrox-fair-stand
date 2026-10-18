# Fair Stand — refactor belgeleri (dizin)

Kod doğrulanmış canlı sözleşmeler. Audit dökümü / item tanımları (`docs/items/**`, ~500 md) buraya karışmaz; tarihsel snapshot — **silinmez / regenerate edilmeden güncellenmez** (kod doğrulaması gerekir). Canlı kaynak: bu dizin + CRM kılavuzu.

**Açık iş okuma sırası:** özet harita `kyrox-platform/projects/fair-stand/OPEN_WORK_INVENTORY.md` → audit `../../audit/FINDINGS.md` → bu dizinde [`PENDING_ITEM_DECISIONS.md`](PENDING_ITEM_DECISIONS.md). Checklist / FULL_SWEEP bayat sayaçtır.

| Belge | Rol |
|---|---|
| [`FAIR_STAND_DB_KULLANIM_KILAVUZU.md`](FAIR_STAND_DB_KULLANIM_KILAVUZU.md) | **CRM / operatör** — hangi alan ne demek, tip vs snap |
| [`DATABASE.md`](DATABASE.md) | **Teknik şema** — tablolar, kolon → JSON, nerede okunur |
| [`PENDING_ITEM_DECISIONS.md`](PENDING_ITEM_DECISIONS.md) | Ertelenmiş kararlar (kanonik; silme yasak listesi) |
| [`ITEMS.md`](ITEMS.md) | Item alan sözleşmesi + runtime kuyruk |
| [`ITEM_3D_PREVIEW.md`](ITEM_3D_PREVIEW.md) | Admin 3D önizleme + montaj pose + kalıcı kilit grubu |
| [`CATALOG.md`](CATALOG.md) | Katalog UI sınırı |
| [`SCENE_POSE.md`](SCENE_POSE.md) | Pose / snap hedef sözleşmesi |
| [`ROTATION.md`](ROTATION.md) | Item rotation SoT |
| [`STAND_DIMENSIONS.md`](STAND_DIMENSIONS.md) | Stand zarfı |
| [`ITEM_DIMENSIONS.md`](ITEM_DIMENSIONS.md) | W/H/D mapping |
| [`ITEM_FIRST_ROADMAP.md`](ITEM_FIRST_ROADMAP.md) | Item-first checklist |
| [`TYPE_BEHAVIORS_DB_ROADMAP.md`](TYPE_BEHAVIORS_DB_ROADMAP.md) | Tip davranışı → DB **migration arşivi** (uygulandı 0030–0033) |
| [`PERFORMANCE_ROADMAP.md`](PERFORMANCE_ROADMAP.md) | **Performans backlog** — proje açma, orbit, 100 eşzamanlı tasarım |
| [`STAND_FRAME_REMOVAL.md`](STAND_FRAME_REMOVAL.md) | Frame kolon tarihçesi |
| [`REFACTOR.md`](REFACTOR.md) | Uygulanan adımlar günlüğü |

**Motor:** `src/moduleBehavior.js` tip davranışını bootstrap `itemTypes` / `getItemType` ile okur (JS `TYPE_BEHAVIORS` map yok).
