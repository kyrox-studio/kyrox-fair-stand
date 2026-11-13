import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { getModuleFootprintBoundsCm, snapPlacementToModules } from '../src/modulePlacement.js';

// Kullanıcı kuralı (2026-11-13, tekrar tekrar bozulduğu için kilit): "upright nerede olursa olsun
// upright, profile nerede olursa olsun profile". Dikmeye profil dört yönden ortalanır, ucu dikmenin
// yüzünde durur. Profilin ucu dikme sayılmaz; iki profilin L köşesi bırakma sırasından bağımsız
// olarak dış yüzden hizalanır (profile-flush-corner). Hata: duvar ailesi yardımcısı profili de duvar
// saydığı için profil ucu dikme oluyor, çerçeve sıraya göre 8 cm taşıyor ve köşeler çaprazlanıyordu.

const Z = 340;

function placed(itemKey, placement, overrides = {}) {
  const moduleState = createModuleStateFromCatalogKey(itemKey);
  Object.assign(moduleState, overrides);
  moduleState.id = overrides.id ?? `${itemKey}-${placement.xCm}-${placement.yCm}`;
  moduleState.placement = { zCm: 0, wallId: 'free', ...placement };
  return moduleState;
}

function drop(modules, key, pointerXCm, pointerYCm, rotationZDeg) {
  const moduleState = createModuleStateFromCatalogKey(key);
  const result = snapPlacementToModules({
    moduleType: moduleState.type,
    itemKey: moduleState.itemKey,
    heightCm: moduleState.heightCm,
    widthCm: moduleState.widthCm,
    depthCm: moduleState.depthCm,
    pointerXCm,
    pointerYCm,
    rotationZDeg,
    zCm: Z,
    modules,
    standType: 'back-wall',
    standXCm: 800,
    standYCm: 800,
  });
  assert.ok(result, `${key} imleç ${pointerXCm},${pointerYCm}: yaslanma yok`);
  const state = { ...moduleState, id: `${key}-${modules.length}`, placement: { ...result.placement, zCm: Z } };
  return { state, snapKind: result.snapKind, bounds: getModuleFootprintBoundsCm(state) };
}

const center = (bounds) => ({ x: (bounds.minXCm + bounds.maxXCm) / 2, y: (bounds.minYCm + bounds.maxYCm) / 2 });

test('upright is an upright everywhere: profile centres on it from all four sides, end on its face', () => {
  const upright = placed('upright_346_5', { xCm: 295, yCm: 250 }, { id: 'up', widthCm: 10, depthCm: 10 });
  const cases = [
    ['right', 400, 252, 0, (b) => b.minXCm === 305],
    ['left', 200, 248, 0, (b) => b.maxXCm === 295],
    ['down', 302, 350, 90, (b) => b.minYCm === 255],
    ['up', 298, 150, 90, (b) => b.maxYCm === 245],
  ];
  for (const [side, x, y, rotation, endsOnFace] of cases) {
    const { bounds, snapKind } = drop([upright], 'profile_190', x, y, rotation);
    assert.equal(snapKind, 'upright-face', side);
    const c = center(bounds);
    if (rotation === 0) assert.equal(c.y, 250, `${side}: ortalı`);
    else assert.equal(c.x, 300, `${side}: ortalı`);
    assert.ok(endsOnFace(bounds), `${side}: uç dikmenin yüzünde`);
  }
});

test('profile is a profile everywhere: a profile end is not an upright, L corners are flush in any order', () => {
  const first = placed('profile_190', { xCm: 200, yCm: 300, zCm: Z }, { id: 'p0' });
  const firstBounds = getModuleFootprintBoundsCm(first);
  const modules = [first];
  const right = drop(modules, 'profile_190', 402, 400, 90);
  modules.push(right.state);
  const bottom = drop(modules, 'profile_190', 300, 498, 0);
  modules.push(bottom.state);
  const left = drop(modules, 'profile_190', 198, 400, 90);
  for (const step of [right, bottom, left]) {
    assert.equal(step.snapKind, 'profile-flush-corner');
    assert.notEqual(step.snapKind, 'upright-face');
  }
  // Çerçeve kapanır, hiçbir profil dış hattan taşmaz.
  assert.equal(right.bounds.maxXCm, firstBounds.maxXCm);
  assert.equal(right.bounds.minYCm, firstBounds.minYCm);
  assert.equal(bottom.bounds.minXCm, firstBounds.minXCm);
  assert.equal(bottom.bounds.maxXCm, firstBounds.maxXCm);
  assert.equal(bottom.bounds.maxYCm, right.bounds.maxYCm);
  assert.equal(left.bounds.minXCm, firstBounds.minXCm);
  assert.equal(left.bounds.minYCm, firstBounds.minYCm);
  assert.equal(left.bounds.maxYCm, bottom.bounds.maxYCm);
});

test('wall end posts stay uprights: profile centres on the end post from both ends', () => {
  const wall = placed('wall_200_350', { xCm: 200, yCm: 100 }, { id: 'w' });
  const leftEnd = drop([wall], 'profile_190', 207, 210, 90);
  const rightEnd = drop([wall], 'profile_190', 393, 210, 90);
  assert.equal(leftEnd.snapKind, 'upright-face');
  assert.equal(rightEnd.snapKind, 'upright-face');
  assert.equal(center(leftEnd.bounds).x, 205);
  assert.equal(center(rightEnd.bounds).x, 395);
  assert.equal(leftEnd.bounds.minYCm, 105);
});
