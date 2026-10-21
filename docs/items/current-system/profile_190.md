> **TARİHÎ ENVANTER.** Güncel sistem değildir. Aktif kanonik tanım `docs/items/definitions/` (veya `src/items.js`). Gövdedeki `catalogKey` / `DEPOT_*` / `floorType` tarihî örnektir; runtime kimliği `itemKey`.

# profile_190 — Tarihî envanter

Baseline: `Version2`. Bu envanter `ITEM_CONTRACT_CHECKLIST.md` zorunlu kapsamına göre fresh runtime doğrulamasıdır.

## 1. Identity / type — VAR
`itemKey=profile_190`, `name=Profil 190 cm`, `type=profile`, `unit=adet`; owner `src/items.js`. Legacy `partId`: YOK.

## 2. Intrinsic properties — VAR
`widthCm=190`, `depthCm=8`, `heightCm=8`, `material='alüminyum'`, `defaultColor=0xd0d3d4`. Material kullanıcı ürün kararıdır. Mevcut render default'u `src/theme.js` içindeki `ALUMINUM_PROFILE_COLOR='#D0D3D4'` ile eşdeğerdir.

## 3. Default state — UYGULANMIYOR
Ayrı mutable leaf project state yoktur.

## 4. Factory / creation — UYGULANMIYOR
Bağımsız project-instance factory yoktur; parent recipe içinde production Item olarak çözülür.

## 5. Placement — UYGULANMIYOR
Parent module placement sahibidir.

## 6. Move — UYGULANMIYOR
Parent module/type behavior sahibidir.

## 7. Rotation — UYGULANMIYOR
Bağımsız leaf rotation contract'ı yoktur.

## 8. Snap — UYGULANMIYOR
Bağımsız leaf snap contract'ı yoktur.

## 9. Collision — UYGULANMIYOR
Bağımsız leaf collision contract'ı yoktur.

## 10. Selection — UYGULANMIYOR
Kullanıcı production profile değil parent module'ü seçer.

## 11. Context menu — UYGULANMIYOR
Context-menu parent module seviyesindedir.

## 12. Delete / duplicate / capabilities — UYGULANMIYOR
Leaf production Item bağımsız editor instance değildir.

## 13. Persistence — UYGULANMIYOR
Project snapshot parent module state'ini persist eder; ayrı `profile_190` instance'ı yoktur.

## 14. Relationships / reflow — UYGULANMIYOR
Leaf profile için ayrı spatial relationship/reflow state'i yoktur; kullanım ve quantity parent recipe sahibidir.

## 15. BOM / composition — VAR
Tekil Item. 7 doğrulanmış parent recipe (wall/shelf/counter/L-counter/base/base-wall); recipe satırları kanonik `itemKey` kullanır, quantity parent recipe'den gelir ve expansion `getItem()` ile metadata çözer.

## 16. Renderer / asset boundary — VAR
`src/scene3d.js` production profile identity'sini mesh identity olarak tüketmez; module ölçülerinden 200 cm sınıfı procedural rail geometry üretir. Production length renderer'a zorla bağlanmaz. `ALUMINUM_PROFILE_COLOR` specialized renderer/theme override olarak kalabilir; kanonik product default `Item.defaultColor=0xd0d3d4` Item'dadır.

Görünüm (2026-10-21): parent modül çerçevesinde kesit bu profilin sahne ölçüsüdür (depth × height, `resolveProceduralFrameCrossSectionCm`); dikmeler de aynı kesitle çizilir. Sahneye tek başına bırakılan `profile` modülü ve bütün profiller kanallı geometridir (`src/profileGeometry.js`: dört yüzde 2 cm ağız, 1,5 cm derinlik; dış ölçü sahne ölçüsüyle aynı) ve kenar çizgilidir.

## 17. Runtime owners — VAR
Product metadata `src/items.js`; recipe `src/moduleRecipes.js`; BOM policy `src/moduleContracts.js`; state `src/designState.js`; renderer `src/scene3d.js`; render theme `src/theme.js`; persistence `src/main.js` + `src/projectStore.js`; Raw BOM `src/rawBomDebug.js`.

## 18. Regression — VAR
Profile Item Contract ve recipe testleri identity/dimensions/quantity/expansion parity'yi korur. `test/profileIntrinsicProperties.test.js` dört profile için `material='alüminyum'` ve `defaultColor=0xd0d3d4` değerlerini kilitler.

## Checklist sonucu
```text
identity/type/unit                 VAR
length/thickness                   VAR
material                           VAR (alüminyum)
defaultColor                       VAR (0xd0d3d4)
state/factory                      UYGULANMIYOR
placement/move/rotation/snap       UYGULANMIYOR
collision/selection/context-menu   UYGULANMIYOR
delete/duplicate                   UYGULANMIYOR
persistence                        UYGULANMIYOR
relationships/reflow               UYGULANMIYOR
BOM / parent recipe                VAR (7)
renderer boundary                  VAR
regression                         VAR
```
