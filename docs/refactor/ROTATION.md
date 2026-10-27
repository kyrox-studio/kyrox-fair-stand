# Rotation

Fair Stand sahne Z dönüşünün Item parametreleri. Catalog kartı ve stand zarfı değildir.

- Item: `docs/refactor/ITEMS.md`
- Catalog: `docs/refactor/CATALOG.md`
- Stand zarfı: `docs/refactor/STAND_DIMENSIONS.md`
- PostgreSQL envanter: `docs/refactor/DATABASE.md`
- Kod: `src/moduleBehavior.js` `getModuleRotationStepDeg` / `getModuleDefaultRotationDeg` / `resolveSideInsertRotationDeg`
- Tablo: `fair_stand_items` (`rotation_step_deg`, `default_rotation_deg`, `side_insert_rotation`)

---

## Ne

Yerleşen Item’ın Shift+R adımı, sahneye ilk açı, yana ek açı kipi. Üç alan birlikte dolu veya birlikte `null`.

Kaynak: PostgreSQL → catalog bootstrap → `getItem(itemKey)`. Tip davranışı (`fair_stand_item_type` / eski `TYPE_BEHAVIORS`) rotation taşımaz.

---

## Alanlar

| Alan | DB | Anlam |
|---|---|---|
| `rotationStepDeg` | `rotation_step_deg` | Klavyede/katalogda her basışın derecesi. Sayı kısıtı yok. |
| `defaultRotationDeg` | `default_rotation_deg` | İlk `placement.rotationZDeg`. |
| `sideInsertRotation` | `side_insert_rotation` | `inherit` = komşu açısı; `default` = bu Item’ın `defaultRotationDeg`. |

Leaf (panel, connector, zemin, kapak, `VIDEO_WALL_PANEL`…) üçü `null`. Sahne modülünde `itemKey` yok veya alan `null` → fail-fast.

Sistemde kalan: `placement.rotationZDeg`, merkez dönüş, normalize, `rotationLocked`, 90/270 dikey duvar, kardinal manyetik snap.

`kyrox-platform/archive/fair-stand/docs-items/current-system/` (2026-10-27'de Stand'den platform arşivine taşındı) ve `audit/evidence/` tarihsel envanterdir; rotation sahibi değildir. Yaşayan sözleşme bu dosya.

---

## Seed (bugünkü sahne)

Çoğu yerleşen: `90` / `0` / `inherit`.

| itemKey | step | default | yan ek |
|---|---|---|---|
| `desk_banko_100` `150` `200` | 45 | 0 | inherit |
| `desk_banko_*_l` | 90 | 270 | inherit |
| `furniture_sofa_single_classic` | 45 | 0 | inherit |
| `furniture_bar_stool_classic` | 45 | 270 | default |
