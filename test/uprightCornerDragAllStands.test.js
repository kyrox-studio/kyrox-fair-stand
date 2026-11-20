import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromCatalogKey } from '../src/designState.js';
import {
  getModuleFootprintBoundsCm,
  seatStandaloneUprightsAtShortEnds,
  snapPlacementToModules,
  validatePlacementAgainstModules,
} from '../src/modulePlacement.js';

// Dikme duvar dikmesiyle aynı parça (2026-11-19/20): sürükleyip bırakılan dikme, açılış onarımının koyduğu yere
// (kısa panel uç dikmesi; köşede iki çizginin kesişim karesi) oturur. Stand kenarındaki köşe dahil, her stand tipi.
const X = 500;
const Y = 400;

function module(key, id, xCm, yCm, rotationZDeg, zCm = 0) {
  const state = createModuleStateFromCatalogKey(key);
  state.id = id;
  state.placement = { xCm, yCm, zCm, rotationZDeg, wallId: 'free' };
  return state;
}

// Dört stand köşesinde ve stand içinde birer L köşe (kısa panellerle).
function layout() {
  return [
    module('wall_100_short_1', 'a1', 0, 0, 0), module('wall_100_short_1', 'a2', 0, 0, 270),
    module('wall_100_short_1', 'b1', X - 100, 0, 0), module('wall_100_short_1', 'b2', X, 0, 270),
    module('wall_100_short_1', 'c1', 0, Y, 0), module('wall_100_short_1', 'c2', 0, Y - 100, 270),
    module('wall_100_short_1', 'd1', X - 100, Y, 0), module('wall_100_short_1', 'd2', X, Y - 100, 270),
    module('wall_100_short_1', 'e1', 200, 200, 0), module('wall_100_short_1', 'e2', 200, 200, 270),
    module('wall_100_short_1', 'f1', 300, 150, 0),
  ];
}

const center = (state) => {
  const bounds = getModuleFootprintBoundsCm(state);
  return { x: (bounds.minXCm + bounds.maxXCm) / 2, y: (bounds.minYCm + bounds.maxYCm) / 2 };
};

for (const standType of ['back-wall', 'l-left', 'l-right', 'u-stand', 'island']) {
  test(`${standType}: köşeye sürüklenen dikme açılıştaki yere oturur ve geçerlidir`, () => {
    const modules = layout();
    const points = [];
    for (const target of modules) {
      const bounds = getModuleFootprintBoundsCm(target);
      const vertical = bounds.maxYCm - bounds.minYCm > bounds.maxXCm - bounds.minXCm;
      const fixed = vertical ? (bounds.minXCm + bounds.maxXCm) / 2 : (bounds.minYCm + bounds.maxYCm) / 2;
      const ends = vertical ? [bounds.minYCm, bounds.maxYCm] : [bounds.minXCm, bounds.maxXCm];
      for (const end of ends) points.push(vertical ? { x: fixed, y: end } : { x: end, y: fixed });
    }
    let checked = 0;
    for (const rotation of [0, 90]) {
      for (const point of points) {
        const pointer = { x: point.x + 3, y: point.y - 2 };
        const upright = module('upright_396', 'u', pointer.x - 4, pointer.y, rotation);
        const repaired = [...structuredClone(modules), structuredClone(upright)];
        seatStandaloneUprightsAtShortEnds(repaired);
        const expected = center(repaired.at(-1));
        const snap = snapPlacementToModules({
          moduleId: 'u', moduleType: 'upright', itemKey: upright.itemKey, heightCm: upright.heightCm,
          widthCm: upright.widthCm, depthCm: upright.depthCm, pointerXCm: pointer.x, pointerYCm: pointer.y,
          rotationZDeg: rotation, zCm: 0, modules, standType, standXCm: X, standYCm: Y,
        });
        const label = `${standType} r${rotation} (${point.x}, ${point.y})`;
        assert.ok(snap?.placement, `${label}: snap yok`);
        const got = center({ ...upright, placement: snap.placement });
        assert.ok(Math.abs(got.x - expected.x) < 0.01 && Math.abs(got.y - expected.y) < 0.01,
          `${label}: sürükleme ${JSON.stringify(got)} ≠ açılış ${JSON.stringify(expected)}`);
        const valid = validatePlacementAgainstModules({
          placement: snap.placement, widthCm: upright.widthCm, depthCm: upright.depthCm, moduleId: 'u',
          moduleType: 'upright', itemKey: upright.itemKey, heightCm: upright.heightCm, modules,
          standType, standXCm: X, standYCm: Y,
        });
        assert.equal(valid.ok, true, `${label}: ${valid.message}`);
        checked += 1;
      }
    }
    assert.ok(checked >= 40);
  });
}

test('dikme merkezi stand dışındaysa reddedilir', () => {
  const upright = module('upright_396', 'u', -10, 100, 0);
  const result = validatePlacementAgainstModules({
    placement: upright.placement, widthCm: upright.widthCm, depthCm: upright.depthCm, moduleId: 'u',
    moduleType: 'upright', itemKey: upright.itemKey, heightCm: upright.heightCm, modules: [],
    standType: 'island', standXCm: X, standYCm: Y,
  });
  assert.equal(result.ok, false);
});
