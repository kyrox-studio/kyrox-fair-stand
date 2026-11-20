import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { validatePlacementAgainstModules } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';

const stand = { standType: 'island', xCm: 600, yCm: 600, itemKey: 'karolaj' };

function upright(id, itemKey, xCm, yCm) {
  const module = createModuleStateFromCatalogKey(itemKey);
  module.id = id;
  module.placement = { xCm, yCm, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  return module;
}

// Kullanıcı kararı 2026-11-20: dikme dikmeyle birleşir, uzun olan kalır.
test('dikme başka bir dikmenin yerine bırakılabilir; kısmen çakışan dikme yine reddedilir', () => {
  const tall = upright('u1', 'upright_396', 200, 200);
  const base = {
    widthCm: 8, depthCm: 8, moduleId: 'u2', moduleType: 'upright', itemKey: 'upright_346_5', heightCm: 346.5,
    modules: [tall], standType: stand.standType, standXCm: stand.xCm, standYCm: stand.yCm,
  };
  assert.equal(validatePlacementAgainstModules({ ...base, placement: { ...tall.placement } }).ok, true);
  assert.equal(validatePlacementAgainstModules({ ...base, placement: { ...tall.placement, xCm: 204 } }).ok, false);
});

test('aynı yerdeki iki dikmeden listede yalnız uzun olan çıkar', () => {
  const bom = resolveProjectBom([upright('u1', 'upright_396', 200, 200), upright('u2', 'upright_346_5', 200, 200)], stand);
  const uprightLines = bom.lines.filter((line) => String(line.itemKey).startsWith('upright_'));
  assert.deepEqual(uprightLines.map((line) => `${line.itemKey}:${line.quantity}`), ['upright_396:1']);
});
