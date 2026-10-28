# Fair Stand — Full System Audit Checklist

> **İKİNCİ KOPYA — OTURUM BURADAN BAŞLAMAZ. AÇIK İŞ TAKİPÇİSİ DEĞİL.**
>
> - Açık bulgu: yalnız `audit/FINDINGS.md`
> - Ertelenmiş karar: yalnız `docs/refactor/PENDING_ITEM_DECISIONS.md`
> - İş listesi: `kyrox-platform/projects/fair-stand/ROADMAP.md`
> - Mutabakat: `audit/SISTEM_MUTABAKAT_RAPORU.md`
>
> A00–A24 maddeleri tarihî denetim şablonudur. Resume bloğundaki A03.01 / F-001…009 OPEN / IN_PROGRESS **bayat**; A00–A24 incelendi (`audit/evidence/A24_FINAL_CLOSURE.md`). Bu dosyadaki OPEN/IN_PROGRESS satırlarını güncel backlog sanma.

---

# 0. Audit çalışma protokolü

## 0.1 Amaç

Bu audit yalnız bug aramaz. Aşağıdaki soruların tamamını sistematik olarak cevaplar:

- İş kuralı canonical yerde mi?
- Aynı kural birden fazla yerde tekrar edilmiş mi?
- Modül / feature / UI / state / renderer / BOM / persistence ilişkileri açık mı?
- Bir alan başka bir sistemi gizlice bypass ediyor mu?
- Save/load sonrası davranış korunuyor mu?
- Yeni değişiklikler `SYSTEM_CHANGE_GATE.md` tarafından gerçekten yakalanıyor mu?
- Testler yalnız mevcut implementasyonu mu tekrar ediyor, yoksa iş sözleşmesini mi koruyor?
- Kullanıcıya açık kritik akış gerçek browser seviyesinde çalışıyor mu?
- Production'a giden kod, debug/legacy/stale davranış taşıyor mu?

## 0.2 Canonical referanslar

Audit başlamadan önce mutlaka okunacak kaynaklar:

1. `PROJECT_RULES.md`
2. `ARCHITECTURE_RULES.md`
3. `SYSTEM_DEVELOPMENT_CONTRACT.md`
4. `SYSTEM_CHANGE_GATE.md`
5. `src/systemChangeContract.js`
6. `src/moduleContracts.js`
7. `src/featureContracts.js`
8. Bu `SYSTEM_AUDIT_CHECKLIST.md`

## 0.3 Audit statüleri

Her madde şu statülerden **yalnız birini** taşır:

- `NOT_AUDITED` — henüz kontrol edilmedi.
- `IN_PROGRESS` — kontrol başladı, tamamlanmadı.
- `AUDITED_OK` — kod + contract + test + kanıt uyumlu.
- `GAP` — eksik, drift, bug veya contract ihlali bulundu.
- `DECISION_REQUIRED` — teknik olarak doğrulanabilir değil; ürün/iş/üretim kararı gerekiyor.
- `NOT_APPLICABLE` — gerçekten bu sistem için uygulanmıyor; gerekçesi yazılmalı.

**Checkbox anlamı:** `[x]` = madde incelendi. Sonucun iyi olup olmadığını `status:` belirler. Bu nedenle `GAP` bulunan bir madde de `[x]` olabilir.

## 0.4 Kanıt kuralı

Bir madde `AUDITED_OK` yapılırken en az bir kanıt yazılır:

- canonical source dosyası / fonksiyon,
- ilgili test,
- CI run,
- browser smoke sonucu,
- gerekiyorsa PR / issue / finding ID.

`"baktım, sorun yok"` kanıt değildir.

## 0.5 Fix ile audit ayrımı

Audit sırasında bulunan sorun **sessizce düzeltilmez**.

Önce finding kaydı açılır:

```text
Finding: F-XXX
Severity: P0 | P1 | P2 | P3
Domain: ...
Evidence: ...
Impact: ...
Decision: fix-now | backlog | decision-required
Fix PR: #...
Retest: pending | passed
```

Kullanıcı düzeltme isterse ayrı, küçük PR ile uygulanır. Fix sonrası ilgili audit maddesi tekrar doğrulanır.

---

# 1. RESUME BLOCK — HER OTURUMDA GÜNCELLENECEK

> Yeni başlayan insan/AI **önce bu bloğu okur**. Audit'e başka yerden başlanmaz.

- **Audit status:** `HISTORICAL — A00–A24 tamam; canlı tracker değil`
- **Audit baseline branch:** `ROG` (tarihî)
- **Audit baseline SHA:** `6a702b000ffb3f9977f6e0853e23e840285eb60e` (tarihî; A24 tabanı `e764732`)
- **Current section:** `— kullanma; bak FINDINGS`
- **Current item:** `—`
- **Last completed item:** `A24 (tarihî kapanış kanıtı)`
- **Next item:** `SISTEM_MUTABAKAT_RAPORU.md B veya E; F-000 FIRST değil`
- **Last audited SHA:** `dda455183e5c713cb55a24232436cfd39c68ce7b` (tarihî A02 notu)
- **Last audit PR:** `#33` (tarihî)
- **Last audit CI:** `ROG CI #80 / run 33790676809 / success` (tarihî)
- **Open P0 findings:** `0` (güncel sayaç FINDINGS)
- **Open P1 findings:** `güncel: FINDINGS`
- **Open P2 findings:** `güncel: FINDINGS`
- **Open P3 findings:** `0`
- **Decision required count:** `güncel: FINDINGS (F-014/F-034/F-043)`
- **Last update note:** `2026-09-12 A belgesi: bu checklist ikinci kopya. A03.01’e gidilmez.`

### Resume kuralı

Her audit oturumu bitmeden veya başka konuya geçmeden:

1. `Current section`
2. `Current item`
3. `Last completed item`
4. `Next item`
5. finding sayaçları
6. son PR / CI / audited SHA
7. `Last update note`

güncellenir ve commit edilir.

---

# 2. FINDINGS INDEX

| ID | Severity | Domain | Summary | Status | Evidence | Fix PR |
|---|---|---|---|---|---|---|
| F-001 | P1 | docs/catalog/BOM | `SYSTEM_MODULE_CATALOG.md` is materially stale: 28 documented vs 45 runtime catalog entries; old identities/BOM counts | OPEN | `audit/evidence/A01_DOCS_SOURCE_OF_TRUTH.md` | — |
| F-002 | P2 | docs/history | Fresh review / cleanup progress docs are not clearly historical and contain superseded current-state statements | OPEN | `audit/evidence/A01_DOCS_SOURCE_OF_TRUTH.md` | — |
| F-003 | P2 | docs/production | Roadmap docs duplicate canonical production dimensions and recipe facts from runtime code | OPEN | `audit/evidence/A01_DOCS_SOURCE_OF_TRUTH.md` | — |
| F-004 | P2 | docs/process | README / development entrypoint predates universal change gate and documents an incomplete workflow | OPEN | `audit/evidence/A01_DOCS_SOURCE_OF_TRUTH.md` | — |
| F-005 | P1 | architecture/change-gate | 20/51 current `src/` files are guarded but have zero path-required impact domains; other mappings are partial | OPEN | `audit/evidence/A02_CHANGE_GATE.md` | — |
| F-006 | P1 | architecture/governance | Canonical rule/gate Markdown, including `SYSTEM_CHANGE_GATE.md`, is not guarded by the change gate | OPEN | `audit/evidence/A02_CHANGE_GATE.md` | — |
| F-007 | P2 | tests/governance | `test/` and `tests/` are unguarded; gate regression tests can change without declaration | OPEN | `audit/evidence/A02_CHANGE_GATE.md` | — |
| F-008 | P2 | tests/change-contract | Targeted regression tests can be empty and `impact.tests` is not machine-required | OPEN | `audit/evidence/A02_CHANGE_GATE.md` | — |
| F-009 | P2 | tooling/workflow | Local `contract:verify` skips diff enforcement outside CI unless explicit environment input is supplied | OPEN | `audit/evidence/A02_CHANGE_GATE.md` | — |

---

# 3. STRICT AUDIT ORDER

Audit aşağıdaki sırada ilerler. Bir bölüm bitmeden sonraki bölüm `IN_PROGRESS` yapılmaz; yalnız blocker varsa açık not bırakılıp geçilebilir.

1. `A00` Audit bootstrap / baseline
2. `A01` Canonical docs + source-of-truth
3. `A02` Universal change gate
4. `A03` Repository architecture / ownership
5. `A04` Catalog + module contracts
6. `A05` Module behavior
7. `A06` Placement / move / rotation / collision / reflow
8. `A07` State model + factories
9. `A08` Persistence / autosave / project isolation
10. `A09` Renderer / scene / runtime-derived behavior
11. `A10` UI controls / inputs / menus / shortcuts / feedback
12. `A11` Feature + scene composition / automation
13. `A12` BOM / recipes / production parts
14. `A13` Storage / assets / references
15. `A14` Import / export / archive / project schema
16. `A15` Security / validation / trust boundaries
17. `A16` Accessibility / keyboard / focus
18. `A17` Performance / bundle / render lifecycle
19. `A18` Tests / regression architecture
20. `A19` Browser E2E critical flows
21. `A20` Build / CI / deploy / release path
22. `A21` Repo hygiene / legacy / docs / licensing
23. `A22` File-by-file orphan / bypass sweep
24. `A23` Cross-domain invariant sweep
25. `A24` Final audit closure

---

# A00 — Audit bootstrap / baseline

- [x] **A00.01** Freeze current ROG SHA and confirm audit baseline. | status: `AUDITED_OK` | evidence: `audit/evidence/A00_BASELINE.md` → ROG `6a702b000ffb3f9977f6e0853e23e840285eb60e`
- [x] **A00.02** Confirm working tree audit starts from current ROG, not stale branch. | status: `AUDITED_OK` | evidence: `audit/full-system-a00` created from current ROG; `audit/evidence/A00_BASELINE.md`
- [x] **A00.03** Record current CI state for baseline SHA. | status: `AUDITED_OK` | evidence: CI run #74 / id `33786201978` / head `6a702b0` / success
- [x] **A00.04** Snapshot repo root, `src/`, `test/`, `tests/`, `scripts/`, `.github/`, `public/`. | status: `AUDITED_OK` | evidence: recursive tree `678de4daa0250dfc9c8f7fc0a80252e0c02fe4a7`; `audit/evidence/A00_BASELINE.md`
- [x] **A00.05** Snapshot package scripts/dependencies and build tool versions. | status: `AUDITED_OK` | evidence: `package.json` blob `e01cb63831103e59bc0dd868a7c4d485a3ed59c2`; lock blob `f151efd6222152f326718e9fd23bec2b2b2ef768`; Node 22 CI
- [x] **A00.06** Confirm no audit conclusion is inherited from stale historical docs. | status: `AUDITED_OK` | evidence: A00 evidence explicitly isolates historical conclusions; all later conclusions require fresh SHA verification
- [x] **A00.07** Create/update findings index structure before first finding. | status: `AUDITED_OK` | evidence: canonical Findings Index + finding protocol present; A00 created no finding

**Section status:** `AUDITED_OK`

---

# A01 — Canonical docs + source-of-truth

- [x] **A01.01** `PROJECT_RULES.md` rules match current architecture and contain no stale global invariant. | status: `AUDITED_OK` | evidence: `PROJECT_RULES.md` + `moduleBehavior.js` + `modulePlacement.js`; see A01 evidence
- [x] **A01.02** `ARCHITECTURE_RULES.md` ownership boundaries match runtime code. | status: `AUDITED_OK` | evidence: `ARCHITECTURE_RULES.md` + catalog/behavior/placement/state/recipe owners; see A01 evidence
- [x] **A01.03** `SYSTEM_DEVELOPMENT_CONTRACT.md` references real canonical owners. | status: `GAP` | evidence: owners exist, but mandatory workflow omits newer universal change-gate handoff; `F-004`
- [x] **A01.04** `SYSTEM_CHANGE_GATE.md` domain list matches `src/systemChangeContract.js`. | status: `AUDITED_OK` | evidence: exact 17-domain match; see A01 evidence
- [x] **A01.05** `MODULE_BEHAVIOR_STANDARD.md` matches `moduleBehavior.js` contract. | status: `AUDITED_OK` | evidence: behavior fields/modes/fallback/ghost match runtime; see A01 evidence
- [x] **A01.06** `SYSTEM_MODULE_CATALOG.md` is compared against runtime catalog/recipes and classified current or stale. | status: `GAP` | evidence: `F-001`; doc says 28, runtime catalog has 45; old identities/BOM counts present
- [x] **A01.07** `ROADMAP.md` contains only active product phase truth. | status: `GAP` | evidence: phase structure is coherent, but fixed production dimensions/full recipe facts are duplicated there; `F-003`
- [x] **A01.08** `PRODUCT_FUTURE.md` is future/backlog only; no current rule leaks into runtime assumptions. | status: `AUDITED_OK` | evidence: document explicitly future-only and defers unverified field rules
- [x] **A01.09** `RENDER_FUTURE_BACKLOG.md` remains future-only. | status: `AUDITED_OK` | evidence: explicitly disclaims old FAZ 4 label and requires reactivation via roadmap
- [x] **A01.10** Historical docs are visibly historical and cannot be mistaken for current source-of-truth. | status: `GAP` | evidence: `F-002`; fresh review and cleanup progress contain superseded state without historical/archive marker
- [x] **A01.11** `LEGACY_TRASH.md` contains no rule currently consumed by runtime code without validation. | status: `AUDITED_OK` | evidence: legacy file explicitly non-canonical; no runtime import/reference; current capacity logic uses actual stand bounds
- [x] **A01.12** No duplicated numeric/business rule exists in Markdown and code as competing canonical sources. | status: `GAP` | evidence: `F-001`, `F-003`; roadmap/catalog docs manually duplicate production values/recipes
- [x] **A01.13** README / developer entrypoint reflects current canonical change-gate workflow. | status: `GAP` | evidence: audit-discovered item; `F-004`; README omits `contract:verify` and new canonical gate/audit docs

**Section status:** `GAP` — audit complete; findings F-001..F-004 remain open

---

# A02 — Universal change gate

- [x] **A02.01** All 17 impact domains are defined once and validator requires all decisions. | status: `AUDITED_OK` | evidence: `systemChangeContract.js`; explicit missing-domain regression in `test/systemChangeGate.test.js`; see A02 evidence
- [x] **A02.02** All supported change kinds have correct mandatory domains. | status: `AUDITED_OK` | evidence: kind constraints validated; targeted-test policy gap tracked separately as F-008
- [x] **A02.03** Guarded-file detection covers all product/runtime entry points. | status: `AUDITED_OK` | evidence: index/package/lock/all src/public/scripts/workflows/vite config guarded; governance/test exclusions are F-006/F-007
- [x] **A02.04** Path-aware rules cover catalog files. | status: `AUDITED_OK` | evidence: `src/catalog.js` mapped; `src/tvConfig.js` this tree'de yok; TV SoT `src/items.js` WALL_MEDIA. F-005 kapanışındaki tvConfig path STALE.
- [x] **A02.05** Path-aware rules cover behavior/placement files. | status: `GAP` | evidence: core files mapped, but `groundLayout`, `standCapacity`, `standSetup`, `wall` and related sources are unmapped; `F-005`
- [x] **A02.06** Path-aware rules cover state/persistence/storage files. | status: `GAP` | evidence: canonical stores mapped, but autosave/project-switch/orchestration coverage is incomplete; `F-005`
- [x] **A02.07** Path-aware rules cover renderer files. | status: `GAP` | evidence: scene3d/viewCube mapped; image layout/fit and TV config helpers unmapped; `F-005`
- [x] **A02.08** Path-aware rules cover UI/static + dynamic controller files. | status: `GAP` | evidence: several controllers mapped but CSS/color inputs/keyboard shortcuts/main are not UI-forced; `F-005`
- [x] **A02.09** Path-aware rules cover BOM/production files. | status: `AUDITED_OK` | evidence: current canonical `moduleRecipes`, `productionParts`, `rawBomDebug` paths require BOM
- [x] **A02.10** Path-aware rules cover composition/automation files. | status: `AUDITED_OK` | evidence: `autoDepot`, `automaticWall`, `featureContracts` require composition
- [x] **A02.11** Path-aware rules cover public assets. | status: `AUDITED_OK` | evidence: every `public/**` path requires assets
- [x] **A02.12** Path-aware rules cover scripts/dependencies/workflows/build config. | status: `AUDITED_OK` | evidence: package/lock/scripts/workflows/vite configuration require architecture
- [x] **A02.13** Gate detects change-contract omission in PR diffs. | status: `AUDITED_OK` | evidence: verifier diffs PR base→HEAD / push before→after and exits non-zero when guarded files changed without contract update
- [x] **A02.14** Gate rejects false `not-applicable` when path requires a domain. | status: `AUDITED_OK` | evidence: verifier requires every collected path-domain to equal `affected`; limitation for unmapped paths is F-005
- [x] **A02.15** Risk/migration/rollback/test declarations are validated. | status: `GAP` | evidence: risk/migration/rollback/fullSuite/build enforced, but targeted array may be empty and tests impact need not be affected; `F-008`
- [x] **A02.16** Gate itself cannot be modified without architecture impact declaration. | status: `GAP` | evidence: machine code/scripts/workflow guarded, but `SYSTEM_CHANGE_GATE.md` and gate tests are not; `F-006`, `F-007`
- [x] **A02.17** Identify guarded source files currently missing any path-domain mapping and record gaps. | status: `GAP` | evidence: exactly 20/51 current `src/` files have zero required domains; full list in A02 evidence; `F-005`
- [x] **A02.18** Local verifier enforces guarded-file diff, not only schema. | status: `GAP` | evidence: audit-discovered item; verifier explicitly skips diff enforcement outside CI without env input; `F-009`
- [x] **A02.19** Test-only changes participate in change-contract governance and targeted regression policy. | status: `GAP` | evidence: audit-discovered item; test directories unguarded and targeted tests may be empty; `F-007`, `F-008`

**Section status:** `GAP` — audit complete; findings F-005..F-009 added

---

# A03 — Repository architecture / ownership

- [ ] **A03.01** Map every `src/*.js` file to one primary responsibility/domain. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.02** Identify files with multiple unrelated responsibilities. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.03** Verify `main.js` is orchestration, not hidden source-of-truth for module rules. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.04** Verify `scene3d.js` is renderer/interaction infrastructure, not hidden business-rule registry. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.05** Verify placement rules do not have alternate engines for specific modules/features. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.06** Verify state rules are not duplicated in renderer/UI. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.07** Verify BOM rules are not inferred from UI text or renderer state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.08** Search for type-specific `if/switch` branches and classify each as legitimate owner or architecture leak. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.09** Search for duplicate constants/labels/configuration across files. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.10** Verify dependency direction does not create circular/hidden ownership. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.11** Verify dynamic/runtime-derived data is separated from persisted project data. | status: `NOT_AUDITED` | evidence: —
- [ ] **A03.12** Verify all core architectural exceptions are documented and tested. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A04 — Catalog + module contracts

## A04.0 Global catalog contract

- [ ] **A04.01** `MODULE_CATALOG_KEYS` and `MODULE_CATALOG` have exact bidirectional coverage. | status: `NOT_AUDITED` | evidence: —
- [ ] **A04.02** Catalog groups contain only valid keys and every intended visible key belongs to correct group. | status: `NOT_AUDITED` | evidence: —
- [ ] **A04.03** Every catalog key has explicit module contract assignment. | status: `NOT_AUDITED` | evidence: —
- [ ] **A04.04** No stale module contract references removed catalog entries. | status: `NOT_AUDITED` | evidence: —
- [ ] **A04.05** Every contract resolves identity/profile/state/appearance/renderer/runtime/composition/BOM/tests/behavior. | status: `NOT_AUDITED` | evidence: —
- [ ] **A04.06** Inheritance/profile use is explicit; no accidental fallback behavior. | status: `NOT_AUDITED` | evidence: —
- [ ] **A04.07** Non-catalog runtime module registry is complete. | status: `NOT_AUDITED` | evidence: —
- [ ] **A04.08** Catalog key resolution survives save/load descriptors and ambiguous types. | status: `NOT_AUDITED` | evidence: —

## A04.1 Per-module ledger

Her satır ancak şu alt kontroller tamamlandıktan sonra `AUDITED_OK` olabilir:

`identity → contract/profile → behavior → placement → state → appearance → renderer → persistence → BOM → asset → dependencies/composition → tests`

| ID | Catalog key | Label | Status | Finding/Evidence |
|---|---|---|---|---|
| M001 | `wall_200` | Panel 200 | `NOT_AUDITED` | — |
| M002 | `wall_150` | Panel 150 | `NOT_AUDITED` | — |
| M003 | `wall_100` | Panel 100 | `NOT_AUDITED` | — |
| M004 | `wall_50` | Panel 50 | `NOT_AUDITED` | — |
| M005 | `wall_separator_100` | Separatör 100 | `NOT_AUDITED` | — |
| M006 | `wall_separator_50` | Separatör 50 | `NOT_AUDITED` | — |
| M007 | `wall_separator_100_sarmasik` | Separatör 100 Sarmaşık | `NOT_AUDITED` | — |
| M008 | `wall_separator_50_sarmasik` | Separatör 50 Sarmaşık | `NOT_AUDITED` | — |
| M009 | `wall_showcase_100_3` | 3 Gözlü Vitrin 100 | `NOT_AUDITED` | — |
| M010 | `wall_showcase_100_2` | 2 Gözlü Vitrin 100 | `NOT_AUDITED` | — |
| M011 | `wall_shelf_3_200` | Raf 200 · 3 Raf | `NOT_AUDITED` | — |
| M012 | `wall_shelf_3_150` | Raf 150 · 3 Raf | `NOT_AUDITED` | — |
| M013 | `wall_shelf_3_100` | Raf 100 · 3 Raf | `NOT_AUDITED` | — |
| M014 | `wall_shelf_2_200` | Raf 200 · 2 Raf | `NOT_AUDITED` | — |
| M015 | `wall_shelf_2_150` | Raf 150 · 2 Raf | `NOT_AUDITED` | — |
| M016 | `wall_shelf_2_100` | Raf 100 · 2 Raf | `NOT_AUDITED` | — |
| M017 | `wall_base_200` | Panel Bazalı 200 | `NOT_AUDITED` | — |
| M018 | `wall_base_150` | Panel Bazalı 150 | `NOT_AUDITED` | — |
| M019 | `wall_base_100` | Panel Bazalı 100 | `NOT_AUDITED` | — |
| M020 | `DOOR_100` | Depo Kapısı 100 | `NOT_AUDITED` | — |
| M021 | `desk_banko_200` | Banko 200 | `NOT_AUDITED` | — |
| M022 | `desk_banko_150` | Banko 150 | `NOT_AUDITED` | — |
| M023 | `desk_banko_100` | Banko 100 | `NOT_AUDITED` | — |
| M024 | `desk_banko_200_L` | Köşe Banko 200×200 | `NOT_AUDITED` | — |
| M025 | `desk_banko_150_L` | Köşe Banko 150×150 | `NOT_AUDITED` | — |
| M026 | `desk_banko_100_L` | Köşe Banko 100×100 | `NOT_AUDITED` | — |
| M027 | `BASE_200` | Baza 200 | `NOT_AUDITED` | — |
| M028 | `BASE_150` | Baza 150 | `NOT_AUDITED` | — |
| M029 | `BASE_100` | Baza 100 | `NOT_AUDITED` | — |
| M030 | `furniture_sofa_set_classic` | Koltuk Takımı | `NOT_AUDITED` | — |
| M031 | `furniture_table_chair_set_eames` | Eames Masa Sandalye Takımı | `NOT_AUDITED` | — |
| M032 | `furniture_bar_stool_classic` | Bar Taburesi | `NOT_AUDITED` | — |
| M033 | `DEPOT_MINI_FRIDGE_AVANTI` | Mini Buzdolabı | `NOT_AUDITED` | — |
| M034 | `DEPOT_KETTLE` | Kettle | `NOT_AUDITED` | — |
| M035 | `DEPOT_COAT_RACK` | Askılık | `NOT_AUDITED` | — |
| M036 | `EXTRA_INDOOR_PLANT_1` | Yapay Çiçek 1 | `NOT_AUDITED` | — |
| M037 | `EXTRA_LONG_PLANTER_100` | Uzun Saksı 100 | `NOT_AUDITED` | — |
| M038 | `EXTRA_LONG_PLANTER_150` | Uzun Saksı 150 | `NOT_AUDITED` | — |
| M039 | `EXTRA_LONG_PLANTER_200` | Uzun Saksı 200 | `NOT_AUDITED` | — |
| M040 | `TV_42` | TV 42" | `NOT_AUDITED` | — |
| M041 | `TV_55` | TV 55" | `NOT_AUDITED` | — |
| M042 | `VIDEO_WALL_2X2` | Video Wall 2×2 | `NOT_AUDITED` | — |
| M043 | `VIDEO_WALL_3X3` | Video Wall 3×3 | `NOT_AUDITED` | — |
| M044 | `TV_65` | TV 65" | `NOT_AUDITED` | — |
| M045 | `LED_FLOODLIGHT` | LED Projektör | `NOT_AUDITED` | — |
| M046 | `illuminated-foam` | Katalog dışı runtime modülü | `NOT_AUDITED` | — |

**Section status:** `NOT_AUDITED`

---

# A05 — Module behavior

- [ ] **A05.01** Enumerate every behavior profile/type. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.02** Every catalog runtime type has explicit behavior coverage. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.03** Unknown non-catalog fallback cannot silently hide missing catalog behavior. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.04** Move snap values have one canonical owner. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.05** Rotation step/default/limits have one canonical owner. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.06** Collision mode has one canonical owner. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.07** Ghost/preview behavior has one canonical owner. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.08** Side insert / wall attachment rules are explicit. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.09** Interaction/selectability/deleteability rules are explicit or intentionally global. | status: `NOT_AUDITED` | evidence: —
- [ ] **A05.10** Behavior overrides are documented by contract, not hidden in event handlers. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A06 — Placement / move / rotation / collision / reflow

- [ ] **A06.01** Coordinate convention X/Y ground, Z height is respected everywhere. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.02** New module placement always goes through canonical placement infrastructure. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.03** Drag placement and programmatic placement obey same constraints. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.04** Move operations preserve placement invariants. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.05** Rotation operations preserve bounds/collision/attachment invariants. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.06** Collision strategy is consistent between preview and final placement. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.07** Wall capacity/automatic wall calculations have one canonical source. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.08** Deletion gaps are preserved; no accidental auto-compaction. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.09** Wall reflow does not move unrelated modules unexpectedly. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.10** Corner placement follows canonical geometry rules. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.11** Floor/free objects remain inside valid stage bounds where required. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.12** Wall-overlay objects retain wall relation after save/load and stand changes. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.13** Parametric dimensions cannot create impossible/negative/NaN transforms. | status: `NOT_AUDITED` | evidence: —
- [ ] **A06.14** Placement failures return deterministic reason/feedback. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A07 — State model + factories

- [ ] **A07.01** Inventory every project-level state field. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.02** Inventory every module-level state field by module family/type. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.03** Every state field has one owner and documented meaning/default. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.04** State factories produce complete valid defaults. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.05** Runtime-derived values are not unnecessarily persisted. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.06** Renderer-only objects/references never leak into serializable state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.07** State normalization handles legacy/missing optional fields safely. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.08** Module IDs are unique/stable across clone/save/import/load flows. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.09** No UI label/text is used as primary state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A07.10** State mutations have predictable ownership and do not mutate unrelated project state. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A08 — Persistence / autosave / project isolation

- [ ] **A08.01** Project save serializes complete intended state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.02** Load reconstructs equivalent runtime behavior, not just equivalent JSON. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.03** Autosave trigger/debounce/flush semantics are deterministic. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.04** Autosave cannot overwrite wrong project after project switch. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.05** New project starts from clean state with no prior-project leakage. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.06** Project switching cleans renderer selections/transient editors/runtime refs. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.07** Deleted project data/assets are handled intentionally. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.08** Save/load round-trip tested for every special module state family. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.09** Persistence failure paths do not leave partially updated UI/state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A08.10** Schema/version upgrade path is explicit where needed. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A09 — Renderer / scene / runtime-derived behavior

- [ ] **A09.01** Scene creation lifecycle has clear owner and cleanup path. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.02** Every module type resolves intended renderer path. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.03** No catalog module silently falls to visually plausible but incorrect default rendering. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.04** GLB asset transforms/scale/rotation have explicit source-of-truth. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.05** Procedural geometry reads state; it does not own business state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.06** Selection/highlight meshes do not mutate production state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.07** Color/image updates and selection feedback stay synchronized. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.08** Dynamic runtime features use derived values rather than persisted transient values. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.09** Renderer cleanup disposes listeners/resources/objects appropriately. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.10** Resize/view controls/camera/view cube remain coherent. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.11** Renderer errors/fallbacks are visible and do not silently corrupt state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A09.12** Special render modes (TV/video wall/lightbox/mesh/foam/etc.) retain distinct contracts. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A10 — UI controls / inputs / menus / shortcuts / feedback

## A10.0 UI inventory gate

- [ ] **A10.01** Inventory every static `button/input/select/textarea/file` control in `index.html`. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.02** Inventory every dynamically created button/menu/action in JS. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.03** Inventory every keyboard shortcut. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.04** Inventory every context-menu action. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.05** Inventory every modal/popup/editor control surface. | status: `NOT_AUDITED` | evidence: —

## A10.1 Per-control contract

Her UI kontrolü için şu alanlar doğrulanır:

`control id → label → owner → event → called feature/state mutation → enabled/disabled rule → persistence impact → project isolation → keyboard/focus → feedback/error → regression test`

- [ ] **A10.06** No control exists without a clear event owner. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.07** No control directly reconstructs canonical business text/state owned elsewhere. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.08** Disabled/hidden state follows actual capability/selection state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.09** Inputs validate/normalize values before state mutation. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.10** Destructive actions have intentional confirmation/undo semantics where needed. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.11** Selection feedback has single canonical formatter/source. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.12** Startup UI cannot show false selected/error/success state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.13** Dynamic menus dispose/rebind safely without duplicate handlers. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.14** UI actions that change project state trigger correct persistence/autosave behavior. | status: `NOT_AUDITED` | evidence: —
- [ ] **A10.15** Production UI contains no accidental debug/prototype-only controls. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A11 — Feature + scene composition / automation

- [ ] **A11.01** Inventory every feature that coordinates more than one module/domain. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.02** Every such feature has explicit feature/composition contract or documented reason not to. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.03** `automatic-depot` contract matches planner output and trigger semantics. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.04** Automatic wall composition has explicit contract/ownership. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.05** Composition-generated modules use normal module contracts/placement/state rather than bypasses. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.06** Generated child/dependency relationships are deterministic. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.07** Re-running automation does not duplicate unintended content. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.08** Feature rollback/delete behavior is defined. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.09** Feature output survives save/load correctly. | status: `NOT_AUDITED` | evidence: —
- [ ] **A11.10** Feature changes cannot silently change BOM without BOM impact declaration. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A12 — BOM / recipes / production parts

- [ ] **A12.01** Inventory all production parts and IDs. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.02** Inventory all module recipes and covered module descriptors. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.03** Every `bom.mode=recipe` contract resolves a real recipe. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.04** Every non-recipe module has explicit `commercial-item`, `excluded`, or `decision-required` rationale. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.05** New production-ready module cannot remain `decision-required`. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.06** Recipe quantities/dimensions derive from canonical module state/descriptor, not UI strings. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.07** Nominal catalog dimensions and production dimensions are not conflated. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.08** Connector/relationship parts are generated by correct relationship logic, not arbitrary single-module recipe if inappropriate. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.09** BOM generation is deterministic for same saved project. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.10** Raw/debug BOM tooling is isolated from production UX. | status: `NOT_AUDITED` | evidence: —
- [ ] **A12.11** BOM tests cover recipe drift, unknown parts and missing part references. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A13 — Storage / assets / references

- [ ] **A13.01** IndexedDB stores/indexes/versioning mapped and documented. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.02** Project records and image asset records maintain correct project ownership. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.03** Asset IDs/references cannot collide across projects/imports. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.04** Missing asset behavior is deterministic and user-visible where needed. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.05** Orphan asset cleanup policy is intentional. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.06** Inventory every `public/` model/image/font/static asset. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.07** Classify every public asset: `USED / PARKED_INTENTIONAL / UNUSED_REMOVE / DECISION_REQUIRED`. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.08** Model/image asset file paths match runtime references case-sensitively. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.09** Large assets have intentional deployment/bundle policy. | status: `NOT_AUDITED` | evidence: —
- [ ] **A13.10** Asset attribution/license metadata exists where required. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A14 — Import / export / archive / project schema

- [ ] **A14.01** Export archive schema/version has one canonical owner. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.02** Export includes exactly intended project state/assets. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.03** Import validates archive version and required files before mutation. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.04** Import validates project schema/IDs/duplicate paths/assets. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.05** Failed import cannot leave half-written project/storage state. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.06** Import handles duplicate project IDs/names intentionally. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.07** Import/export round-trip preserves module behavior and assets. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.08** Limits for archive size/asset count/per-asset size are classified and decided. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.09** Malformed ZIP/path traversal/weird filename handling is checked. | status: `NOT_AUDITED` | evidence: —
- [ ] **A14.10** Backward compatibility/migration policy is explicit. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A15 — Security / validation / trust boundaries

- [ ] **A15.01** Inventory all user-controlled text/number/file inputs. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.02** Numeric input ranges reject NaN/Infinity/negative/impossible values where relevant. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.03** File uploads validate accepted type/content/size policy. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.04** Imported archive paths cannot escape expected namespace. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.05** User-provided strings are not inserted through unsafe HTML sinks. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.06** External URLs/assets have explicit trust policy. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.07** Storage/project boundaries prevent cross-project accidental data exposure. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.08** Production debug surfaces do not expose unnecessary internals. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.09** Dependency audit / known critical vulnerabilities checked against current lockfile. | status: `NOT_AUDITED` | evidence: —
- [ ] **A15.10** No secrets/credentials/private endpoints are embedded in source/public assets. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A16 — Accessibility / keyboard / focus

- [ ] **A16.01** All primary controls have accessible names/labels. | status: `NOT_AUDITED` | evidence: —
- [ ] **A16.02** Buttons use appropriate button semantics rather than clickable generic elements where possible. | status: `NOT_AUDITED` | evidence: —
- [ ] **A16.03** Keyboard shortcuts do not fire while typing in inputs/editors unless intended. | status: `NOT_AUDITED` | evidence: —
- [ ] **A16.04** Modal/context menu focus enters/exits predictably. | status: `NOT_AUDITED` | evidence: —
- [ ] **A16.05** Escape/close behavior is consistent. | status: `NOT_AUDITED` | evidence: —
- [ ] **A16.06** Hidden/disabled controls are not keyboard-focusable unintentionally. | status: `NOT_AUDITED` | evidence: —
- [ ] **A16.07** Selection/status/error feedback is perceivable without relying only on color. | status: `NOT_AUDITED` | evidence: —
- [ ] **A16.08** Critical workflows are keyboard-operable to the intended product standard. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A17 — Performance / bundle / render lifecycle

- [ ] **A17.01** Record production build size and public asset footprint baseline. | status: `NOT_AUDITED` | evidence: —
- [ ] **A17.02** Identify largest JS modules and whether growth is controlled. | status: `NOT_AUDITED` | evidence: —
- [ ] **A17.03** Identify largest public assets and whether they are loaded eagerly/lazily/never. | status: `NOT_AUDITED` | evidence: —
- [ ] **A17.04** Repeated module add/delete does not leak Three.js resources/listeners. | status: `NOT_AUDITED` | evidence: —
- [ ] **A17.05** Project switching does not accumulate scene objects/event handlers. | status: `NOT_AUDITED` | evidence: —
- [ ] **A17.06** Autosave/storage operations do not perform excessive writes. | status: `NOT_AUDITED` | evidence: —
- [ ] **A17.07** Large images/models have intentional memory handling. | status: `NOT_AUDITED` | evidence: —
- [ ] **A17.08** Expensive render/update loops are bounded and tied to actual need. | status: `NOT_AUDITED` | evidence: —
- [ ] **A17.09** Performance-sensitive changes have measurable regression guard where practical. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A18 — Tests / regression architecture

- [ ] **A18.01** Inventory all `test/` and `tests/` suites by domain. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.02** Every current canonical contract has a test enforcing it. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.03** Tests assert behavior/contracts rather than copying implementation logic. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.04** Negative tests exist for major invalid states/inputs. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.05** Catalog/module contract coverage catches new unregistered items. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.06** Change gate tests catch missing/false declarations. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.07** Placement/rotation/collision edge cases have coverage. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.08** Save/load/project-switch/import-export round-trip paths have coverage. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.09** BOM recipes/parts have integrity tests. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.10** UI wiring has regression coverage for critical controls. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.11** Removed features/assets have intentional regression guard only when still useful. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.12** `test/` vs `tests/` organization is classified without losing coverage. | status: `NOT_AUDITED` | evidence: —
- [ ] **A18.13** Full suite is deterministic/repeatable and has no flaky known tests. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A19 — Browser E2E critical flows

Her akış gerçek browser seviyesinde çalıştırılmalı. Sadece unit test yeterli değildir.

- [ ] **A19.01** App boots with no uncaught console error. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.02** Create stage / stand setup. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.03** Add wall module. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.04** Add free-floor model module. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.05** Add wall-overlay/special module. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.06** Select / multi-select / deselect. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.07** Move module. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.08** Rotate module. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.09** Delete module and verify gap behavior. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.10** Color edit. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.11** Image upload/apply/remove. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.12** TV/video-wall/special media workflow. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.13** Automatic depot + contents workflow. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.14** Project save. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.15** Project reopen/load. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.16** Project switch isolation. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.17** ZIP export. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.18** ZIP import into clean/new project context. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.19** Imported project visually/state-wise matches source. | status: `NOT_AUDITED` | evidence: —
- [ ] **A19.20** Reload page and verify persisted project. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A20 — Build / CI / deploy / release path

- [ ] **A20.01** `npm ci` succeeds from clean checkout. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.02** `npm test` succeeds from clean checkout. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.03** `npm run build` succeeds from clean checkout. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.04** CI runs change gate before tests/build and uses sufficient git history. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.05** ROG required-check/branch-protection policy is checked. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.06** Deployment source is explicit branch/tag/SHA and reproducible. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.07** Deploy path uses known-green revision and does not accidentally deploy arbitrary current branch. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.08** Deploy path has test/build failure stop semantics. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.09** Environment/domain/HTTPS assumptions are explicit. | status: `NOT_AUDITED` | evidence: —
- [ ] **A20.10** Release-facing UI has no stale prototype/debug labels unless intentional. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A21 — Repo hygiene / legacy / docs / licensing

- [ ] **A21.01** Open issues/PRs reviewed and classified. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.02** Merged/stale branches classified; delete policy decided. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.03** Legacy patch/build-trigger scripts classified individually. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.04** Real operational scripts are separated from historical patch scripts. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.05** Dead code/functions/imports/files identified with evidence. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.06** Stale docs retired or clearly marked historical. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.07** Changelog/current history policy classified. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.08** Public/private repository intent checked. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.09** Project code license decision checked. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.10** Third-party model/image attribution/licenses checked. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.11** Repo/public asset size policy checked. | status: `NOT_AUDITED` | evidence: —
- [ ] **A21.12** Formatting/static quality gate status classified. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A22 — File-by-file orphan / bypass sweep

Bu bölüm domain auditlerinden sonra yapılır. Amaç hiçbir dosyanın önceki domain kontrollerinden kaçmadığını doğrulamaktır.

- [ ] **A22.01** Every `src/*.js` file appears in at least one audited domain evidence set. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.02** Every `src/*.css` file classified as active/unused and related UI surface audited. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.03** Every root runtime/config file classified. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.04** Every script classified. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.05** Every workflow classified. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.06** Every test file mapped to production behavior/contract it protects. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.07** Every public asset classified. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.08** Search for TODO/FIXME/HACK/DEBUG/temporary/trigger markers and classify all hits. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.09** Search for commented-out production code and classify. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.10** Search for hard-coded module labels/types/IDs outside canonical registries and classify. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.11** Search for duplicated UI/business strings used as data contracts. | status: `NOT_AUDITED` | evidence: —
- [ ] **A22.12** Search for runtime files not covered by change-gate path rules and record all. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A23 — Cross-domain invariant sweep

Bu bölümde tek tek alanlar değil, **alanlar arası bağlar** kontrol edilir.

- [ ] **A23.01** Catalog ↔ module contract exact coverage. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.02** Module contract ↔ behavior exact compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.03** Module contract ↔ state factory compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.04** Module contract ↔ renderer capability compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.05** Module contract ↔ persistence round-trip compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.06** Module contract ↔ BOM policy compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.07** Feature contract ↔ generated modules ↔ placement compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.08** Feature contract ↔ persistence compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.09** Feature contract ↔ BOM consequences compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.10** UI capability ↔ selected module contract compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.11** UI mutation ↔ autosave/project isolation compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.12** Import/export ↔ current state/schema/assets compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.13** Runtime renderer ↔ saved state ↔ reopened visual result compatibility. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.14** Change-gate path/domain rules cover every canonical owner discovered during audit. | status: `NOT_AUDITED` | evidence: —
- [ ] **A23.15** No finding marked fixed without targeted regression + full suite + build evidence. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# A24 — Final audit closure

Audit ancak aşağıdaki koşullar sağlandığında kapatılır:

- [ ] **A24.01** `A00–A23` bölümlerinin hiçbiri `NOT_AUDITED` veya `IN_PROGRESS` değil. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.02** Tüm 46 module/runtime ledger satırı incelendi. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.03** Tüm UI kontrolleri envantere alındı ve incelendi. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.04** Tüm feature/composition akışları incelendi. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.05** Tüm `src/`, tests, scripts, workflows ve public assets file-by-file coverage aldı. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.06** Açık P0 finding yok. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.07** Açık P1 finding yok veya kullanıcı tarafından açıkça kabul edilmiş exception var. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.08** `DECISION_REQUIRED` maddelerin tamamı kayıtlı ve kullanıcı kararına sunulmuş. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.09** Critical browser E2E flow tamamen yeşil. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.10** Clean checkout `change gate + npm test + npm run build` yeşil. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.11** Final audited ROG SHA kaydedildi. | status: `NOT_AUDITED` | evidence: —
- [ ] **A24.12** Final audit summary oluşturuldu: OK / fixed / accepted-gap / decision-required ayrımı. | status: `NOT_AUDITED` | evidence: —

**Section status:** `NOT_AUDITED`

---

# 4. Audit oturumu kapanış şablonu

Her çalışma oturumu sonunda bu dosyada RESUME BLOCK güncellendikten sonra kısa kayıt bırakılır:

```text
AUDIT SESSION YYYY-MM-DD
Baseline/checked SHA: ...
Completed: Axx.xx – Axx.xx
Findings created: F-...
PRs merged: #...
CI: ...
Next: Axx.xx
Notes: ...
```

## Session log

```text
AUDIT SESSION 2026-09-03
Baseline/checked SHA: 6a702b000ffb3f9977f6e0853e23e840285eb60e
Completed: A00.01 – A00.07
Findings created: none
Audit PR: #31
CI evidence: baseline ROG CI #74 / run 33786201978 / success
Next: A01.01
Notes: Bootstrap only. No runtime/domain conclusion inherited from historical docs.
```

```text
AUDIT SESSION 2026-09-03
Baseline/checked SHA: 6b9a4400f10d8a1957ffd52dbc6a8da3f0141af5
Completed: A01.01 – A01.13
Findings created: F-001, F-002, F-003, F-004
Audit PR: #32
CI evidence before section: ROG CI #77 / run 33789639960 / success
Next: A02.01
Notes: Documentation/source-of-truth audit completed. No findings fixed during audit.
```

```text
AUDIT SESSION 2026-09-03
Baseline/checked SHA: dda455183e5c713cb55a24232436cfd39c68ce7b
Completed: A02.01 – A02.19
Findings created: F-005, F-006, F-007, F-008, F-009
Audit PR: #33
CI evidence before section: ROG CI #80 / run 33790676809 / success
Next: A03.01
Notes: Universal change-gate audit completed. Gate is active but not yet a closed all-surfaces wall; no findings fixed during audit.
```

---

# 5. Değişmez audit kuralı

**Bir şeyi gördüğümüz için doğru kabul etmiyoruz.**

Her alan için sıralama:

```text
RULE / CONTRACT
      ↓
CANONICAL OWNER
      ↓
IMPLEMENTATION
      ↓
CROSS-DOMAIN EFFECT
      ↓
TARGETED TEST
      ↓
REAL USER FLOW (gerekiyorsa browser)
      ↓
FULL TEST + BUILD
      ↓
AUDITED_OK / GAP / DECISION_REQUIRED
```

Bu sıra tamamlanmadan checkbox kapatılmaz.