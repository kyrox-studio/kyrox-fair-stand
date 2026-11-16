import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromDescriptor } from '../src/designState.js';
import { getItem } from '../src/items.js';
import { createModulePlacement } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';

// Kullanıcı kararı (2026-11-16): tam boy duvarın ucunda bağımsız dikme duruyorsa o uçta tek dikme
// sayılır, uzun olan kalır. Aparat değişmez.
function module(id, itemKey, xCm, yCm = 0) {
  const state = createModuleStateFromDescriptor({ itemKey, type: getItem(itemKey).type });
  state.id = id;
  state.placement = createModulePlacement({ xCm, yCm, rotationZDeg: 0, wallId: 'free' });
  return state;
}

function uprights(bom) {
  return Object.fromEntries(bom.lines
    .filter((line) => line.itemKey.startsWith('upright_'))
    .map((line) => [line.itemKey, line.quantity]));
}

function connectors(bom) {
  return bom.lines
    .filter((line) => line.itemKey.startsWith('connector_'))
    .map((line) => `${line.itemKey}=${line.quantity}`)
    .sort();
}

test('duvar ucundaki uzun bağımsız dikme duvarın dikmesinin yerine geçer', () => {
  const alone = resolveProjectBom([module('w', 'wall_100_350', 0)]);
  const joined = resolveProjectBom([module('w', 'wall_100_350', 0), module('u', 'upright_445_5', 100)]);
  assert.deepEqual(uprights(joined), { upright_346_5: 1, upright_445_5: 1 });
  assert.deepEqual(connectors(joined), connectors(alone));
});

test('eşit boyda tek dikme sayılır; kısa bağımsız dikme düşer', () => {
  assert.deepEqual(
    uprights(resolveProjectBom([module('w', 'wall_100_350', 0), module('u', 'upright_346_5', 100)])),
    { upright_346_5: 2 },
  );
  assert.deepEqual(
    uprights(resolveProjectBom([module('w', 'wall_100_350', 0), module('u', 'upright_297', 100)])),
    { upright_346_5: 2 },
  );
});

test('iki duvarın ortak ucundaki bağımsız dikme ortak dikmenin yerine geçer (bir kez)', () => {
  const walls = [module('a', 'wall_100_350', 0), module('b', 'wall_100_350', 100)];
  const plain = resolveProjectBom(walls);
  assert.deepEqual(uprights(plain), { upright_346_5: 3 });
  const joined = resolveProjectBom([...walls, module('u', 'upright_445_5', 100)]);
  assert.deepEqual(uprights(joined), { upright_346_5: 2, upright_445_5: 1 });
  assert.deepEqual(connectors(joined), connectors(plain));
});

test('duvar ucuna değmeyen dikme ayrı sayılır', () => {
  assert.deepEqual(
    uprights(resolveProjectBom([module('w', 'wall_100_350', 0), module('u', 'upright_445_5', 150)])),
    { upright_346_5: 2, upright_445_5: 1 },
  );
});

function moduleAt(id, itemKey, xCm, zCm) {
  const state = module(id, itemKey, xCm);
  state.placement = createModulePlacement({ xCm, yCm: 0, zCm, rotationZDeg: 0, wallId: 'free' });
  return state;
}

test('kısa panel ucunda da uzun olan dikme kalır', () => {
  // Uzun bağımsız dikme: kısa panelin dikmesi düşer.
  assert.deepEqual(
    uprights(resolveProjectBom([moduleAt('s', 'wall_100_short_2', 0, 0), moduleAt('u', 'upright_297', 100, 0)])),
    { upright_99: 1, upright_297: 1 },
  );
  // Kısa bağımsız dikme (aynı tabandan): kendisi düşer.
  assert.deepEqual(
    uprights(resolveProjectBom([moduleAt('s', 'wall_100_short_2', 0, 0), moduleAt('u', 'upright_49_5', 100, 0)])),
    { upright_99: 2 },
  );
  // Tepedeki Tek Sıra'ya değen tam boy dikme: kısa dikme düşer.
  assert.deepEqual(
    uprights(resolveProjectBom([moduleAt('s', 'wall_100_short_1', 0, 300), moduleAt('u', 'upright_346_5', 100, 0)])),
    { upright_49_5: 1, upright_346_5: 1 },
  );
  // Değmeyen dikme ayrı kalır.
  assert.deepEqual(
    uprights(resolveProjectBom([moduleAt('s', 'wall_100_short_1', 0, 300), moduleAt('u', 'upright_297', 100, 0)])),
    { upright_49_5: 2, upright_297: 1 },
  );
});

test('sahne: tam boy duvar ucundaki uzun bağımsız dikmede duvar kendi dikmesini çizmez', async () => {
  const { resolveWallCornerEnds } = await import('../src/wallCornerJoints.js');
  const wall = module('w', 'wall_100_350', 0);
  const postEnd = (uprightKey, xCm) => (resolveWallCornerEnds([wall, module('u', uprightKey, xCm)]).get('w') ?? [])
    .find((end) => end.postWidthCm != null) ?? null;
  // Dikmenin izi duvarın ucunu içine alır (x 95–105): duvar o uçta kendi dikmesini bırakır.
  const long = postEnd('upright_445_5', 95);
  assert.ok(long, 'uzun dikmede uç kaydı yok');
  assert.equal(long.localXSign, 1);
  assert.ok(long.postWidthCm > 0);
  // Eşit boyda da tek dikme çizilir.
  assert.ok(postEnd('upright_346_5', 95));
  // Kısa dikmede duvarın dikmesi kalır (listede kısa olan düşer).
  assert.equal(postEnd('upright_297', 95), null);
  // Uca değmeyen dikme kuralı tetiklemez.
  assert.equal(postEnd('upright_445_5', 150), null);
});

test('sahne: köşe noktasındaki uzun bağımsız dikmede ortak köşe dikmesi çizilmez', async () => {
  const { resolveWallCornerEnds } = await import('../src/wallCornerJoints.js');
  const back = module('a', 'wall_100_350', 0);
  const side = module('b', 'wall_100_350', 100);
  side.placement = createModulePlacement({ xCm: 100, yCm: 0, rotationZDeg: 270, wallId: 'free' });
  const before = resolveWallCornerEnds([back, side]);
  const owners = [...before.values()].flat().filter((end) => end.ownsPost === true);
  assert.equal(owners.length, 1);
  const post = module('u', 'upright_445_5', 95);
  post.placement = createModulePlacement({ xCm: 95, yCm: 0, rotationZDeg: 0, wallId: 'free' });
  const after = resolveWallCornerEnds([back, side, post]);
  assert.equal([...after.values()].flat().filter((end) => end.ownsPost === true).length, 0);
});
