import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromCatalogKey } from '../src/designState.js';
import {
  MID_WALL_TEE_MESSAGE,
  PROFILE_WALL_RAIL_MESSAGE,
  createModulePlacement,
  validatePlacementAgainstModules,
} from '../src/modulePlacement.js';

// Ürün kararı (2026-11-11): T bağlantıyı yalnız profil yapar; profile, dikmeye ya da duvarın üst / alt
// rayına (o da profildir). Duvar ile duvar dik bağlantısı yalnız dikme olan noktada kalır.

function place(itemKey, xCm, yCm, zCm, rotationZDeg, id) {
  const module = createModuleStateFromCatalogKey(itemKey);
  module.id = id;
  module.placement = createModulePlacement({ xCm, yCm, zCm, rotationZDeg, wallId: 'free' });
  return module;
}

function validate(candidate, modules) {
  return validatePlacementAgainstModules({
    placement: candidate.placement,
    widthCm: candidate.widthCm,
    depthCm: candidate.depthCm,
    moduleType: candidate.type,
    itemKey: candidate.itemKey,
    heightCm: candidate.heightCm,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 800,
  });
}

const wall = place('wall_200_350', 0, 300, 0, 0, 'wall');
const profileWidth = createModuleStateFromCatalogKey('profile_289').widthCm;

test('profil tam boy duvarın üst rayının ortasına dik bağlanır', () => {
  const profile = place('profile_289', 100, 300 - profileWidth, 342, 90, 'p');
  assert.deepEqual(validate(profile, [wall]), { ok: true });
});

test('profil alt ray hizasında da (zeminde) duvarın ortasına dik bağlanır', () => {
  const profile = place('profile_289', 100, 300 - profileWidth, 0, 90, 'p');
  assert.deepEqual(validate(profile, [wall]), { ok: true });
});

test('ray hizasında olmayan profil duvarın ortasına bağlanmaz', () => {
  const profile = place('profile_289', 100, 300 - profileWidth, 150, 90, 'p');
  const result = validate(profile, [wall]);
  assert.equal(result.ok, false);
  assert.equal(result.message, PROFILE_WALL_RAIL_MESSAGE);
});

test('rayı kesen profil (X) çakışır', () => {
  const profile = place('profile_289', 100, 300 - 150, 342, 90, 'p');
  assert.equal(validate(profile, [wall]).ok, false);
});

test('duvar duvarın ortasına ve profilin ortasına dik bağlanmaz', () => {
  const tee = place('wall_100_350', 100, 300 - 100, 0, 90, 'w2');
  assert.equal(validate(tee, [wall]).message, MID_WALL_TEE_MESSAGE);
  const rail = place('profile_289', 0, 300, 342, 0, 'rail');
  const onRail = place('wall_100_350', 150, 300 - 100, 0, 90, 'w3');
  assert.equal(validate(onRail, [rail]).message, MID_WALL_TEE_MESSAGE);
});
