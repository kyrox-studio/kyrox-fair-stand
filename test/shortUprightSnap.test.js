import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { getModuleFootprintBoundsCm, snapPlacementToModules } from '../src/modulePlacement.js';

// Kullanıcı kararı 2026-11-11: short dikme ailesine kendiliğinden yaslanır; short'un ucu dikmenin dış
// yüzüyle hizalanır, dikme short'un içinde kalır. Baza köşesine yaslanan dikmeler bazanın içindedir,
// bu yüzden short bazayla birebir hizalanır. Eskiden short dikmeden 10 cm taşıyordu (165–365 / 180–380).

function placed(itemKey, placement, overrides = {}) {
  const moduleState = createModuleStateFromCatalogKey(itemKey);
  Object.assign(moduleState, overrides);
  moduleState.placement = { zCm: 0, wallId: 'free', ...placement };
  return moduleState;
}

// Sahnedeki dikme 10 cm'dir (DB sahne ölçüsü); test kataloğu dikmeyi 8 cm tutar.
const UPRIGHT_SCENE = { widthCm: 10, depthCm: 10 };

function snapShort(modules, pointerYCm, itemKey = 'wall_200_short_2') {
  const short = createModuleStateFromCatalogKey(itemKey);
  const result = snapPlacementToModules({
    moduleType: short.type,
    itemKey: short.itemKey,
    heightCm: short.heightCm,
    widthCm: short.widthCm,
    depthCm: short.depthCm,
    pointerXCm: 200,
    pointerYCm,
    rotationZDeg: 90,
    modules,
    standType: 'back-wall',
    standXCm: 500,
    standYCm: 400,
  });
  assert.ok(result, `imleç y=${pointerYCm}: yaslanma yok`);
  return { result, bounds: getModuleFootprintBoundsCm({ ...short, placement: result.placement }) };
}

test('short spans the outer faces of two uprights and lines up with the base', () => {
  const base = placed('base_200', { xCm: 230, yCm: 175, rotationZDeg: 90 });
  // Kullanıcının projesindeki dikmeler: bazanın iki ucunda, bazanın içinde (175–185 ve 365–375).
  const first = placed('upright_346_5', { xCm: 195, yCm: 180, rotationZDeg: 0 }, UPRIGHT_SCENE);
  const second = placed('upright_346_5', { xCm: 200, yCm: 365, rotationZDeg: 90 }, UPRIGHT_SCENE);
  const baseBounds = getModuleFootprintBoundsCm(base);

  for (const pointerYCm of [255, 272, 290]) {
    const { result, bounds } = snapShort([base, first, second], pointerYCm);
    assert.equal(result.snapKind, 'short-up-joint');
    assert.equal(bounds.minYCm, baseBounds.minYCm, `imleç y=${pointerYCm}`);
    assert.equal(bounds.maxYCm, baseBounds.maxYCm, `imleç y=${pointerYCm}`);
    assert.equal(bounds.maxXCm, baseBounds.minXCm, 'short bazanın yüzüne değer');
  }
});

test('a single upright: the short end sits on its outer face and covers it', () => {
  const upright = placed('upright_346_5', { xCm: 195, yCm: 180, rotationZDeg: 0 }, UPRIGHT_SCENE);
  const { result, bounds } = snapShort([upright], 260);
  assert.equal(result.snapKind, 'short-up-joint');
  assert.equal(bounds.minYCm, 175);
  assert.equal(bounds.maxYCm, 375);
});
