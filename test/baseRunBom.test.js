import test from 'node:test';
import assert from 'node:assert/strict';

import { createModulePlacement } from '../src/modulePlacement.js';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { STAND_DIMENSIONS } from '../src/standDimensions.js';

function qty(bom, itemKey) {
  const line = bom.lines.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

function flushYCm(hostYCm = 0, depthCm = 50) {
  return hostYCm + (depthCm + STAND_DIMENSIONS.depthCm) / 2;
}

function baza(id, itemKey, widthCm, { xCm, yCm = flushYCm(), rotationZDeg = 0 } = {}) {
  return {
    id,
    itemKey,
    type: 'base',
    widthCm,
    depthCm: 50,
    placement: createModulePlacement({ xCm, yCm, rotationZDeg, wallId: 'free' }),
  };
}

function host(id, itemKey, widthCm, { xCm = 0, yCm = 0, rotationZDeg = 0 } = {}) {
  return {
    id,
    itemKey,
    widthCm,
    placement: createModulePlacement({ xCm, yCm, rotationZDeg }),
  };
}

test('one baza keeps its solo recipe', () => {
  const bom = resolveProjectBom([baza('a', 'base_200', 200, { xCm: 0 })]);
  assert.equal(qty(bom, 'profile_190'), 4);
  assert.equal(qty(bom, 'panel_197'), 2);
  assert.equal(qty(bom, 'upright_49_5'), 4);
  assert.equal(qty(bom, 'profile_41_5'), 4);
  assert.equal(qty(bom, 'panel_48_5'), 2);
  assert.equal(qty(bom, 'connector_start'), 8);
  assert.equal(qty(bom, 'connector_single'), 8);
  assert.equal(qty(bom, 'base_top_206_50'), 1);
});

test('two, three and four free baza 200 rows follow the run formula', () => {
  const two = resolveProjectBom([
    baza('a', 'base_200', 200, { xCm: 0 }),
    baza('b', 'base_200', 200, { xCm: 200 }),
  ]);
  assert.equal(qty(two, 'profile_190'), 8);
  assert.equal(qty(two, 'profile_41_5'), 6);
  assert.equal(qty(two, 'upright_49_5'), 6);
  assert.equal(qty(two, 'panel_197'), 4);
  assert.equal(qty(two, 'panel_48_5'), 2);
  assert.equal(qty(two, 'connector_start'), 12);
  assert.equal(qty(two, 'connector_single'), 10);
  assert.equal(qty(two, 'base_top_206_50'), 2);

  const three = resolveProjectBom([
    baza('a', 'base_200', 200, { xCm: 0 }),
    baza('b', 'base_200', 200, { xCm: 200 }),
    baza('c', 'base_200', 200, { xCm: 400 }),
  ]);
  assert.equal(qty(three, 'profile_190'), 12);
  assert.equal(qty(three, 'upright_49_5'), 8);
  assert.equal(qty(three, 'panel_197'), 6);
  assert.equal(qty(three, 'panel_48_5'), 2);
  assert.equal(qty(three, 'connector_start'), 16);
  assert.equal(qty(three, 'connector_single'), 12);

  const four = resolveProjectBom([
    baza('a', 'base_200', 200, { xCm: 0 }),
    baza('b', 'base_200', 200, { xCm: 200 }),
    baza('c', 'base_200', 200, { xCm: 400 }),
    baza('d', 'base_200', 200, { xCm: 600 }),
  ]);
  assert.equal(qty(four, 'profile_190'), 16);
  assert.equal(qty(four, 'profile_41_5'), 10);
  assert.equal(qty(four, 'upright_49_5'), 10);
  assert.equal(qty(four, 'panel_197'), 8);
  assert.equal(qty(four, 'connector_start'), 20);
  assert.equal(qty(four, 'connector_single'), 14);
  assert.equal(qty(four, 'base_top_206_50'), 4);
});

test('mixed widths share the short end and keep their own long parts', () => {
  const bom = resolveProjectBom([
    baza('a', 'base_200', 200, { xCm: 0 }),
    baza('b', 'base_150', 150, { xCm: 200 }),
  ]);
  assert.equal(qty(bom, 'profile_190'), 4);
  assert.equal(qty(bom, 'profile_140_5'), 4);
  assert.equal(qty(bom, 'panel_197'), 2);
  assert.equal(qty(bom, 'panel_147_5'), 2);
  assert.equal(qty(bom, 'upright_49_5'), 6);
  assert.equal(qty(bom, 'connector_start'), 12);
  assert.equal(qty(bom, 'connector_single'), 10);
  assert.equal(qty(bom, 'base_top_206_50'), 1);
  assert.equal(qty(bom, 'base_top_157_50'), 1);
});

test('a same-width wall on the back reduces only that baza', () => {
  const bom = resolveProjectBom([
    host('wall', 'wall_200_350', 200),
    baza('base', 'base_200', 200, { xCm: 0 }),
  ]);
  assert.equal(qty(bom, 'profile_190'), 4);
  assert.equal(qty(bom, 'panel_197'), 8);
  assert.equal(qty(bom, 'upright_49_5'), 2);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'profile_41_5'), 4);
  assert.equal(qty(bom, 'panel_48_5'), 2);
  assert.equal(qty(bom, 'connector_start'), 8);
  assert.equal(qty(bom, 'connector_single'), 21);
  assert.equal(qty(bom, 'base_top_206_50'), 1);
});

test('a narrower wall does not host a wider baza', () => {
  const bom = resolveProjectBom([
    host('wall', 'wall_100_350', 100),
    baza('base', 'base_200', 200, { xCm: 0 }),
  ]);
  assert.equal(qty(bom, 'profile_190'), 4);
  assert.equal(qty(bom, 'upright_49_5'), 4);
  assert.equal(qty(bom, 'panel_197'), 2);
});

test('showcase hosts only the matching baza in a row', () => {
  const bom = resolveProjectBom([
    host('case', 'wall_showcase_100_2_350', 100),
    baza('left', 'base_100', 100, { xCm: 0 }),
    baza('right', 'base_100', 100, { xCm: 100 }),
  ]);
  assert.equal(qty(bom, 'profile_91'), 10);
  assert.equal(qty(bom, 'panel_98'), 8);
  assert.equal(qty(bom, 'upright_49_5'), 4);
  assert.equal(qty(bom, 'profile_41_5'), 6);
  assert.equal(qty(bom, 'panel_48_5'), 2);
  assert.equal(qty(bom, 'connector_start'), 14);
  assert.equal(qty(bom, 'connector_single'), 19);
  assert.equal(qty(bom, 'base_top_107_50'), 2);
});

test('two hosted baza 200 keep one shared back upright', () => {
  const bom = resolveProjectBom([
    host('w1', 'wall_200_350', 200, { xCm: 0 }),
    host('w2', 'wall_200_350', 200, { xCm: 200 }),
    baza('a', 'base_200', 200, { xCm: 0 }),
    baza('b', 'base_200', 200, { xCm: 200 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 3);
  assert.equal(qty(bom, 'profile_190'), 8);
  assert.equal(qty(bom, 'panel_197'), 16);
  assert.equal(qty(bom, 'connector_start'), 12);
  assert.equal(qty(bom, 'connector_single'), 22);
  assert.equal(qty(bom, 'profile_41_5'), 6);
  assert.equal(qty(bom, 'panel_48_5'), 2);
  assert.equal(qty(bom, 'upright_346_5'), 3);
});

test('the far long face of a flush baza is also hosted', () => {
  const bom = resolveProjectBom([
    host('wall', 'wall_200_350', 200),
    baza('base', 'base_200', 200, { xCm: 0, yCm: -flushYCm() }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 2);
  assert.equal(qty(bom, 'profile_190'), 4);
  assert.equal(qty(bom, 'panel_197'), 8);
});

test('a baza whose back sits on the wall centerline is not flush', () => {
  const bom = resolveProjectBom([
    host('wall', 'wall_200_350', 200),
    baza('base', 'base_200', 200, { xCm: 0, yCm: 25 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 4);
  assert.equal(qty(bom, 'profile_190'), 6);
  assert.equal(qty(bom, 'panel_197'), 9);
});

test('a door on the same line does not reduce the baza', () => {
  const bom = resolveProjectBom([
    host('door', 'wall_door_100_350', 100),
    baza('base', 'base_100', 100, { xCm: 0 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 4);
  assert.equal(qty(bom, 'profile_91'), 5);
  assert.equal(qty(bom, 'panel_98'), 5);
  assert.equal(qty(bom, 'connector_start'), 10);
});

function upright(id, { xCm, yCm, rotationZDeg = 90 }) {
  return {
    id,
    itemKey: 'upright_346_5',
    type: 'upright',
    widthCm: 10,
    depthCm: 10,
    heightCm: 350,
    placement: createModulePlacement({ xCm, yCm, rotationZDeg, wallId: 'free' }),
  };
}

test('baza köşesinde duran 346,5 dikme o köşenin 49,5 dikmesinin yerini alır', () => {
  // Kullanıcı sahnesi (2026-11-11): dikey baza x 230..280, y 105..305; arka yüz x 230.
  // İki 346,5 dikme arka köşelerde (merkez 230/105 ve 230/305).
  const base = baza('b', 'base_200', 200, { xCm: 255, yCm: 105, rotationZDeg: 90 });
  const bothBack = resolveProjectBom([base, upright('u1', { xCm: 230, yCm: 100 }), upright('u2', { xCm: 230, yCm: 300 })]);
  assert.equal(qty(bothBack, 'upright_49_5'), 2);
  assert.equal(qty(bothBack, 'upright_346_5'), 2);
  // Bazanın kendi parçaları değişmez.
  assert.equal(qty(bothBack, 'profile_190'), 4);
  assert.equal(qty(bothBack, 'profile_41_5'), 4);

  const oneBack = resolveProjectBom([base, upright('u1', { xCm: 230, yCm: 100 })]);
  assert.equal(qty(oneBack, 'upright_49_5'), 3);

  // Ön köşede (x 280) duran dikme de sayılır.
  const front = resolveProjectBom([base, upright('u3', { xCm: 280, yCm: 300 })]);
  assert.equal(qty(front, 'upright_49_5'), 3);
});

test('bazanın yanına sıfır yaslanmış ya da uzaktaki dikme 49,5 düşürmez', () => {
  const base = baza('b', 'base_200', 200, { xCm: 255, yCm: 105, rotationZDeg: 90 });
  // Yan yüze yaslı (merkez 225: gövde 220..230), köşeyle hizalı.
  const beside = resolveProjectBom([base, upright('u1', { xCm: 225, yCm: 105 })]);
  assert.equal(qty(beside, 'upright_49_5'), 4);
  const far = resolveProjectBom([base, upright('u2', { xCm: 100, yCm: 100 })]);
  assert.equal(qty(far, 'upright_49_5'), 4);
});

test('köşenin içinde, iki dış yüzle hizalı dikme 49,5 köşe dikmesinin yerini alır; dışarıdan yaslı dikme almaz', () => {
  // Kullanıcı kararı 2026-11-11: dikme baza köşesinin üstüne (iç köşeye) oturur.
  const placed = (itemKey, xCm, yCm, rotationZDeg, extra = {}) => {
    const moduleState = createModuleStateFromCatalogKey(itemKey);
    Object.assign(moduleState, extra);
    moduleState.placement = { xCm, yCm, zCm: 0, rotationZDeg, wallId: 'free' };
    return moduleState;
  };
  const upright = { widthCm: 10, depthCm: 10 };
  const base = placed('base_200', 230, 175, 90); // iz x 205–255, y 175–375
  const count = (modules, itemKey) => resolveProjectBom(modules).lines
    .filter((line) => line.itemKey === itemKey)
    .reduce((sum, line) => sum + Number(line.quantity), 0);

  assert.equal(count([base], 'upright_49_5'), 4);
  // İç köşe (merkez köşeden 5, 5 içeride).
  const inside = [placed('upright_346_5', 205, 180, 0, upright), placed('upright_346_5', 205, 370, 0, upright)];
  assert.equal(count([base, ...inside], 'upright_49_5'), 2);
  // Bazanın arka yüzüne dışarıdan sıfır yaslı (merkez x 200): köşe dikmesi kalır.
  const beside = [placed('upright_346_5', 195, 180, 0, upright), placed('upright_346_5', 195, 370, 0, upright)];
  assert.equal(count([base, ...beside], 'upright_49_5'), 4);
});
