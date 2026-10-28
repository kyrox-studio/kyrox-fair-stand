# Fair Stand — Agent Instructions

Bu repository üzerinde çalışan insan veya AI agent için aşağıdaki kurallar zorunludur.

## Sert kapı (kullanıcı yakalamak zorunda değildir)

Agent kendi kendini durdurur. “Tamam” demek yeterli değildir.

1. **Hayal / tahmin / uydurma yasak.** Kaynak yalnız mevcut MD + runtime kod + açık ürün kararıdır. Kanıtsız miktar, unit, ölçü, behavior, BOM veya “muhtemelen” üretilemez.
2. **Trigger:** `hazırlan` / `envanter` / `emin ol` = yalnız okuma + özet (dosya yazma yok). `yapıştır` / `uygula` / `kodla` / `gönder` = implementasyon. Belirsizse kod yazılmaz.
3. **Kod öncesi checkpoint:** Dosya değiştirmeden önce kanıtlı envanter + dokunulmayacaklar + yapılacaklar kullanıcıya yazılır; açık onay yoksa kod yok.
4. **Dil:** MD/yorum/commit/PR metni Türkçe; `itemKey` ve method adları İngilizce kalır.

Detaylı Cursor kuralı: `.cursor/rules/no-fabrication-prepare-gate.mdc`.

## Zorunlu okuma sırası

Her değişiklikten önce işin kapsamına göre aşağıdaki canonical belgeler okunur:

1. `SYSTEM_CHANGE_GATE.md`
2. `SYSTEM_IMPACT_SWEEP.md`
3. `SYSTEM_DEVELOPMENT_CONTRACT.md`
4. `PROJECT_RULES.md`
5. `ARCHITECTURE_RULES.md`
6. **`ITEM_CONTRACT.md`** — fiziksel ürün, zemin, malzeme, BOM, üretim, maliyet, katalog, runtime item/module, context-menu behavior veya item state ile ilgili her işte zorunludur.
7. `MODULE_BEHAVIOR_STANDARD.md` — type bazlı editor/runtime davranışı etkileniyorsa zorunludur. Sahne Z dönüşü için ayrıca `docs/refactor/ROTATION.md`.

## Açık iş haritası (dağıntı yok)

“Ne açık / ne ertelendi?” sorusunda:

1. İş listesi (tek) → `kyrox-platform/projects/fair-stand/ROADMAP.md`
2. Audit F-* → `audit/FINDINGS.md`
3. Ertelenmiş kararın gerekçesi ve yasakları → `docs/refactor/PENDING_ITEM_DECISIONS.md`

`SYSTEM_AUDIT_CHECKLIST.md` ve `audit/FULL_SWEEP_STATE.md` tarihîdir; oturum oradan başlamaz, OPEN sayaçları backlog değildir.

## Item gate

Aksine açık bir ürün kararı yoksa BOM, üretim veya maliyet hesabına girebilen her fiziksel öğe `Item` kabul edilir.

Yeni bir ürün, zemin, malzeme, kombinasyon, runtime module veya üretilebilir öğe eklerken `ITEM_CONTRACT.md` okunmadan ve aşağıdaki alanlar karara bağlanmadan implementasyona başlanmaz:

- canonical `itemKey`,
- `type` / behavior family,
- canonical state/ölçü/parametreler,
- tekil/bileşik/parametrik yapı,
- BOM recipe/resolver,
- terminal BOM quantity + unit,
- project instance ayrımı,
- renderer/asset temsilinin business rule'dan ayrımı,
- persistence etkisi,
- regression/E2E kapsamı.

## Yasaklar

- Yeni fiziksel öğeyi yalnız catalog, renderer, GLB veya UI ekleyerek tamamlanmış saymak.
- BOM/maliyet kapsamındaki bir öğeyi Item contract dışında ayrı paralel model olarak eklemek.
- `itemKey` yerine label, model filename veya renderer node adını ürün kimliği yapmak.
- Item'a özel davranışı dağınık `if (itemKey === ...)` kontrolleriyle çoğaltmak.
- Aynı behavior ailesindeki varyantlar için gereksiz item-level override üretmek.
- BOM'u render/mesh/texture görünümünden türetmek.
- BOM miktarını unitsiz sayı olarak üretmek.
- BOM reçetesi ile fiyatlandırmayı aynı canonical kaynakta birleştirmek.

## Tamamlanma kuralı

`ITEM_CONTRACT.md` kapsamındaki bir değişiklik ancak Item identity/state/behavior/BOM/persistence/render/test etkileri birlikte değerlendirilip repository change gate ve CI zinciri başarılı olduğunda tamamlanmış sayılır.

Bu dosya repository-level giriş talimatıdır. Alt dizinde daha özel bir `AGENTS.md` yoksa bütün repository için geçerlidir.
