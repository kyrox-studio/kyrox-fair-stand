> **TARİHÎ ENVANTER.** Güncel sistem değildir. Aktif kanonik tanım `docs/items/definitions/` (veya `src/items.js`). Gövdedeki `catalogKey` / `DEPOT_*` / `floorType` tarihî örnektir; runtime kimliği `itemKey`.

`connector_corner` mevcut kod zincirini çıkardım. **Lokal runtime kodunda hiçbir dosyada değişiklik yapmadım.**

Kaynak çalışma ağacı: `/mnt/data/Version2_local`

# 1. Mevcut gerçek kimlik ve tanım

Kaynak: `src/items.js:27`

```js
connector_corner: Object.freeze({
  itemKey: 'connector_corner',
  name: 'Köşe Aparatı',
  type: 'connector',
  unit: 'adet',
  connectorType: 'corner'
}),
```

Lookup: `src/items.js` içindeki `getItem()`.

```js
getItem('connector_corner')
```

Bugünkü gerçek kimlik `itemKey = connector_corner`'dır.

# 2. Doğrudan runtime referansları

`src/` altında `connector_corner` **yalnızca `src/items.js` tanımında** geçer.

`moduleRecipes.js`, `rawBomDebug.js`, `designState.js`, `scene3d.js`, `modulePlacement.js`, `main.js` ve `projectStore.js` bu `partId`yi doğrudan kullanmaz.

# 3. Resolver durumu

Genel production lookup çalışır:

```text
getItem('connector_corner')
→ LEAF_ITEMS.connector_corner
→ {
    name: 'Köşe Aparatı',
    type: 'connector',
    unit: 'adet',
    connectorType: 'corner'
  }
```

Ancak mevcut `src/` runtime kodunda `connector_corner` için bu lookup'ı çağıran aktif tüketici bulunmadı.

# 4. BOM / recipe durumu

`connector_corner` hiçbir `src/moduleRecipes.js` `recipe.items` listesinde bulunmaz.

Dolayısıyla mevcut sistemde:

```text
recipe quantity yok
expanded module BOM satırı yok
Raw BOM UI satırı yok
module placement'tan connector_corner üretimi yok
```

Production metadata sahibi `src/items.js` olsa da aktif miktar/source-of-truth tanımı yoktur; çünkü parça hiçbir recipe'ye dahil edilmemiştir.

# 5. Köşe placement kavramıyla kritik ayrım

Mevcut kodda ayrıca geometrik bir **corner snap** kavramı vardır, fakat bu `connector_corner` değildir.

`src/modulePlacement.js:790-815` ve `:964-987`:

```js
const snapKind = targetEndpoint ? 'corner' : 'tee';
```

En iyi snap sonucu `src/modulePlacement.js:1057-1064` içinde:

```text
mode = module-snap
targetModuleId
snapKind
distanceCm
```

olarak döner. `scene3d.js:2582-2586,2923-2927` bunu preview bilgisinde taşır; kalıcı module state'e ise yalnız `placement` yazılır (`scene3d.js:2951-2961`).

Bu nedenle iki ayrı kavram vardır:

```text
production metadata:
  itemKey = connector_corner
  connectorType = corner

placement runtime:
  snapKind = corner
```

**Mevcut kodda bunları birbirine bağlayan mapping, resolver veya quantity hesabı yoktur.** `snapKind = 'corner'` oluşması `connector_corner` BOM satırı üretmez.

# 6. State / persistence / renderer

Mevcut runtime kodunda bağımsız `connector_corner` state instance'ı yoktur. Proje snapshot'ı `src/main.js:1257-1265` ile module state'lerini saklar; connector part state'e girmediği için `src/projectStore.js` persistence'ına ayrı entity olarak yazılmaz.

`src/scene3d.js` `connector_corner` anahtarını kullanmaz ve ayrı bir Köşe Aparatı mesh identity'si oluşturmaz.

# 7. UI/runtime tüketimi

`src/rawBomDebug.js` yalnız `recipe.items` elemanlarını listeler. `connector_corner` recipe item'ı olmadığı için mevcut Raw BOM Debug ekranında otomatik görünmez.

# 8. Test zinciri

Doğrudan test:

`test/moduleRecipes.test.js:13-18`

```js
assert.equal(getItem('connector_corner').name, 'Köşe Aparatı');
```

Bu test yalnız production registry/lookup adını doğrular. `connector_corner` recipe miktarı, corner placement mapping'i, state, persistence veya renderer bağlantısı için mevcut test bulunmadı.

İlgili hedefli test seti çalıştırıldı: **49 pass / 0 fail**.

# Mevcut zincirin özeti

```text
PRODUCTION
src/items.js
→ connector_corner
→ connectorType = corner

PLACEMENT
src/modulePlacement.js
→ snapKind = corner

Bu iki kol arasında mevcut kod bağı yok.
```

En kritik mevcut durum: **`connector_corner` production registry'de tanımlı bir `partId`dir; fakat aktif recipe/BOM, state, renderer veya persistence zincirine bağlı değildir. Kodda bulunan `snapKind = 'corner'` ayrı bir placement kavramıdır ve `connector_corner` üretmez.**