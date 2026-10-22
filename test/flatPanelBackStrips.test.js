import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addFlatPanelBackStrips,
  createFlatPanelModuleState,
  createModuleStateFromCatalogKey,
  duplicateModuleState,
  normalizeModuleItemState,
  removeFlatPanelBackStrips,
  supportsFlatPanelBackStrips,
} from '../src/designState.js';
import { createModulePlacement } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { resolveItemDefaultZCm } from '../src/items.js';

function qty(bom, itemKey) {
  return bom.lines.find((entry) => entry.itemKey === itemKey)?.quantity ?? 0;
}

function moduleQty(bom, moduleId, itemKey) {
  const module = bom.modules.find((entry) => entry.moduleId === moduleId);
  return module?.lines?.find((entry) => entry.itemKey === itemKey)?.quantity ?? 0;
}

// Gerçek duvar state'i (bantlar dahil) + yerleşim; `back` true ise arka yüze panel takılır.
function wall(id, itemKey, { xCm = 0, yCm = 0, rotationZDeg = 0, back = false } = {}) {
  const state = createModuleStateFromCatalogKey(itemKey);
  state.id = id;
  state.placement = createModulePlacement({ xCm, yCm, rotationZDeg, zCm: resolveItemDefaultZCm(itemKey) });
  if (back) assert.equal(addFlatPanelBackStrips(state), true);
  return state;
}

test('arka yüz paneli yalnız düz duvar ailesinde; ön yüzle aynı bant ve reçete paneli', () => {
  const state = createFlatPanelModuleState({ itemKey: 'wall_100_350' });
  assert.equal(supportsFlatPanelBackStrips(state), true);
  assert.equal(addFlatPanelBackStrips(state), true);
  assert.equal(addFlatPanelBackStrips(state), false, 'ikinci ekleme yok');
  assert.equal(state.backStrips.length, state.strips.length);
  assert.deepEqual(state.backStrips.map((strip) => strip.itemKey), state.strips.map((strip) => strip.itemKey));
  assert.deepEqual(state.backStrips.map((strip) => strip.stripIndex), state.strips.map((strip) => strip.stripIndex));
  const frontIds = new Set(state.strips.map((strip) => strip.id));
  assert.ok(state.backStrips.every((strip) => !frontIds.has(strip.id)), 'arka bant kimlikleri ayrı');

  const short = createModuleStateFromCatalogKey('wall_100_short_2');
  assert.equal(supportsFlatPanelBackStrips(short), true);
  for (const itemKey of ['wall_door_100_350', 'wall_showcase_100_2_350']) {
    assert.equal(supportsFlatPanelBackStrips(createModuleStateFromCatalogKey(itemKey)), false, itemKey);
  }

  assert.equal(removeFlatPanelBackStrips(state), true);
  assert.equal('backStrips' in state, false);
  assert.equal(removeFlatPanelBackStrips(state), false);
});

test('kopya yeni arka bant kimliği alır; açılışta arka bant sayısı ön yüzü izler', () => {
  const state = createFlatPanelModuleState({ itemKey: 'wall_100_350' });
  addFlatPanelBackStrips(state);
  state.backStrips[0].imageAssetId = 'asset-1';
  const copy = duplicateModuleState(state);
  assert.equal(copy.backStrips[0].imageAssetId, 'asset-1');
  assert.notEqual(copy.backStrips[0].id, state.backStrips[0].id);

  const saved = JSON.parse(JSON.stringify(state));
  saved.backStrips = saved.backStrips.slice(0, 3);
  const opened = normalizeModuleItemState(saved);
  assert.equal(opened.backStrips.length, opened.strips.length);
  assert.equal(opened.backStrips[0].imageAssetId, 'asset-1', 'kayıtlı arka bant korunur');
  assert.equal(opened.backStrips[0].id, state.backStrips[0].id);
});

test('tek duvar arka yüz paneliyle: 2 profil, 2 dikme, 14 panel', () => {
  const bom = resolveProjectBom([wall('a', 'wall_100_350', { back: true })]);
  assert.equal(qty(bom, 'profile_91'), 2);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'panel_98'), 14);
  const plain = resolveProjectBom([wall('a', 'wall_100_350')]);
  assert.equal(qty(plain, 'panel_98'), 7, 'arka paneli olmayan duvar değişmez');
});

test('L köşe: içe bakan yüzler köşe paneli, dışa bakan arka yüzler düz panel', () => {
  const bom = resolveProjectBom([
    wall('a', 'wall_200_350', { back: true }),
    wall('b', 'wall_150_350', { xCm: 200, rotationZDeg: 270, back: true }),
  ]);
  assert.equal(bom.appliedCornerCount, 1);
  assert.equal(moduleQty(bom, 'a', 'panel_corner_192'), 7);
  assert.equal(moduleQty(bom, 'a', 'panel_197'), 7);
  assert.equal(moduleQty(bom, 'b', 'panel_corner_142_5'), 7);
  assert.equal(moduleQty(bom, 'b', 'panel_147_5'), 7);
  // Bağlantı aparatı arka panelden etkilenmez.
  assert.equal(qty(bom, 'connector_corner'), 12);
});

test('duvarın arka yüzüne dayanan modül: arka yüz köşe paneli olur, ön yüz düz kalır', () => {
  const bom = resolveProjectBom([
    wall('a', 'wall_100_350', { back: true }),
    wall('b', 'wall_100_350', { xCm: 100, rotationZDeg: 90, back: true }),
  ]);
  assert.equal(bom.appliedCornerCount, 1);
  // a'nın önüne b dayanır: ön yüz köşe, arka yüz dışarıda düz.
  assert.equal(moduleQty(bom, 'a', 'panel_corner_92'), 7);
  assert.equal(moduleQty(bom, 'a', 'panel_98'), 7);
  // b'nin önü a'dan uzağa bakar: ön yüz düz, a'ya dayanan arka yüz köşe.
  assert.equal(moduleQty(bom, 'b', 'panel_98'), 7);
  assert.equal(moduleQty(bom, 'b', 'panel_corner_92'), 7);
  assert.equal(qty(bom, 'connector_corner'), 6, 'aparat kuralı aynı');
});

test('T: gövdeye dikilen kolun iki yüzü de köşe; gövde mevcut T kuralıyla düz kalır', () => {
  const bom = resolveProjectBom([
    wall('a', 'wall_200_350', { back: true }),
    wall('b', 'wall_100_350', { xCm: 100, rotationZDeg: 270, back: true }),
  ]);
  assert.equal(bom.appliedTeeCount, 1);
  assert.equal(moduleQty(bom, 'b', 'panel_corner_92'), 14);
  assert.equal(moduleQty(bom, 'b', 'panel_98'), 0);
  // Mevcut T kuralı: gövde (payCorner false) köşe paneli almaz; iki yüzü de düz.
  assert.equal(moduleQty(bom, 'a', 'panel_197'), 14);
  assert.equal(moduleQty(bom, 'a', 'panel_corner_192'), 0);
});

test('arka yüzdeki cam bant cam panele, köşedeyse köşe cam panele ayrılır', () => {
  const a = wall('a', 'wall_100_350', { back: true });
  a.backStrips[2].isGlass = true;
  const single = resolveProjectBom([a]);
  assert.equal(qty(single, 'panel_cam_98'), 1);
  assert.equal(qty(single, 'panel_98'), 13);

  const b = wall('b', 'wall_100_350', { xCm: 100, rotationZDeg: 90, back: true });
  b.backStrips[0].isGlass = true;
  const corner = resolveProjectBom([wall('a', 'wall_100_350'), b]);
  assert.equal(moduleQty(corner, 'b', 'panel_corner_cam_92'), 1);
  assert.equal(moduleQty(corner, 'b', 'panel_corner_92'), 6);
});

// Short (wall-short-1/2): arka yüz köşe paneli tam boy duvarla aynı kural; aparat yalnız ön yüz kuralıyla.
for (const [rows, bands] of [['1', 1], ['2', 2]]) {
  test(`short_${rows} L köşe: içe bakan ön yüz köşe, dışa bakan arka yüz düz`, () => {
    const bom = resolveProjectBom([
      wall('a', `wall_200_short_${rows}`, { back: true }),
      wall('b', `wall_150_short_${rows}`, { xCm: 200, rotationZDeg: 270, back: true }),
    ]);
    assert.equal(moduleQty(bom, 'a', 'panel_corner_192'), bands);
    assert.equal(moduleQty(bom, 'a', 'panel_197'), bands);
    assert.equal(moduleQty(bom, 'b', 'panel_corner_142_5'), bands);
    assert.equal(moduleQty(bom, 'b', 'panel_147_5'), bands);
    const plain = resolveProjectBom([
      wall('a', `wall_200_short_${rows}`),
      wall('b', `wall_150_short_${rows}`, { xCm: 200, rotationZDeg: 270 }),
    ]);
    assert.equal(qty(bom, 'connector_corner'), qty(plain, 'connector_corner'), 'aparat arka panelden etkilenmez');
  });

  test(`short_${rows} dışa bakan L (alınlık köşesi): arka yüzler köşe paneli, ön yüzler düz`, () => {
    const modules = (back) => [
      wall('a', `wall_200_short_${rows}`, { xCm: 0, yCm: 200, rotationZDeg: 0, back }),
      wall('b', `wall_200_short_${rows}`, { xCm: 200, yCm: 0, rotationZDeg: 90, back }),
    ];
    const bom = resolveProjectBom(modules(true));
    for (const id of ['a', 'b']) {
      assert.equal(moduleQty(bom, id, 'panel_197'), bands, `${id} ön yüz düz`);
      assert.equal(moduleQty(bom, id, 'panel_corner_192'), bands, `${id} arka yüz köşe`);
    }
    assert.equal(qty(bom, 'connector_corner'), qty(resolveProjectBom(modules(false)), 'connector_corner'));
  });

  test(`short_${rows} dayanan modül: dayanan arka yüz köşe paneli`, () => {
    const bom = resolveProjectBom([
      wall('a', `wall_100_short_${rows}`, { back: true }),
      wall('b', `wall_100_short_${rows}`, { xCm: 100, rotationZDeg: 90, back: true }),
    ]);
    assert.equal(moduleQty(bom, 'a', 'panel_corner_92'), bands);
    assert.equal(moduleQty(bom, 'a', 'panel_98'), bands);
    assert.equal(moduleQty(bom, 'b', 'panel_98'), bands);
    assert.equal(moduleQty(bom, 'b', 'panel_corner_92'), bands);
  });

  test(`short_${rows} T: gövdeye dikilen kolun iki yüzü de köşe, gövde düz`, () => {
    const bom = resolveProjectBom([
      wall('a', `wall_200_short_${rows}`, { back: true }),
      wall('b', `wall_100_short_${rows}`, { xCm: 100, rotationZDeg: 270, back: true }),
    ]);
    assert.equal(moduleQty(bom, 'b', 'panel_corner_92'), bands * 2);
    assert.equal(moduleQty(bom, 'b', 'panel_98'), 0);
    assert.equal(moduleQty(bom, 'a', 'panel_197'), bands * 2);
    assert.equal(moduleQty(bom, 'a', 'panel_corner_192'), 0);
  });

  test(`short_${rows} yan yana: köşe paneli yok, iki yüz düz`, () => {
    const bom = resolveProjectBom([
      wall('a', `wall_200_short_${rows}`, { back: true }),
      wall('b', `wall_200_short_${rows}`, { xCm: 200, back: true }),
    ]);
    for (const id of ['a', 'b']) {
      assert.equal(moduleQty(bom, id, 'panel_197'), bands * 2);
      assert.equal(moduleQty(bom, id, 'panel_corner_192'), 0);
    }
  });
}

test('alınlık short tam boy duvarın ucuna değer: duvar ön bandı köşe, short arka yüzü köşe paneli', () => {
  const bom = resolveProjectBom([
    wall('w', 'wall_200_350', { xCm: 0, yCm: 0, rotationZDeg: 90, back: true }),
    wall('s', 'wall_200_short_1', { xCm: 0, yCm: 200, rotationZDeg: 0, back: true }),
  ]);
  assert.equal(moduleQty(bom, 'w', 'panel_corner_192'), 1, 'duvarın yalnız örtüşen bandı');
  assert.equal(moduleQty(bom, 'w', 'panel_197'), 13);
  assert.equal(moduleQty(bom, 's', 'panel_197'), 1, 'short ön yüz dışa bakar, düz');
  assert.equal(moduleQty(bom, 's', 'panel_corner_192'), 1, 'short arka yüzü duvara bakar, köşe');
});

test('short_2 tam boy duvara değer: duvarın yalnız örtüşen iki bandı köşe, short arka yüzü köşe', () => {
  const bom = resolveProjectBom([
    wall('w', 'wall_200_350', { xCm: 0, yCm: 0, rotationZDeg: 90, back: true }),
    wall('s', 'wall_200_short_2', { xCm: 0, yCm: 200, rotationZDeg: 0, back: true }),
  ]);
  assert.equal(moduleQty(bom, 'w', 'panel_corner_192'), 2);
  assert.equal(moduleQty(bom, 's', 'panel_corner_192'), 2);
  assert.equal(moduleQty(bom, 's', 'panel_197'), 2);
});

