import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import {
  getModuleFootprintBoundsCm,
  snapPlacementToModules,
  validatePlacementAgainstModules,
} from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';

// Kullanıcı kararı 2026-11-11: baza duvara (wall ailesi) dikme gibi oturur; duvar bazanın arka
// kenarının içinde, arka yüzler hizalı. Eskiden baza duvarın önüne yaslanıyor, iki iskelet yan
// yana duruyordu.

function placed(itemKey, xCm, yCm, rotationZDeg, id = itemKey) {
  const moduleState = createModuleStateFromCatalogKey(itemKey);
  moduleState.id = id;
  moduleState.placement = { xCm, yCm, zCm: 0, rotationZDeg, wallId: 'free' };
  return moduleState;
}

// Dikey duvar: x 205–215, y 100–300.
const wall = () => placed('wall_200_350', 210, 100, 270, 'wall');

function snapBase(pointerXCm, pointerYCm, rotationZDeg) {
  const base = createModuleStateFromCatalogKey('base_200');
  const result = snapPlacementToModules({
    moduleType: base.type,
    itemKey: base.itemKey,
    heightCm: base.heightCm,
    widthCm: base.widthCm,
    depthCm: base.depthCm,
    pointerXCm,
    pointerYCm,
    rotationZDeg,
    modules: [wall()],
    standType: 'back-wall',
    standXCm: 500,
    standYCm: 400,
  });
  return result ? getModuleFootprintBoundsCm({ ...base, placement: result.placement }) : null;
}

const round = (bounds) => bounds && Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Math.round(value)]));

test('baza duvara sürüklenince duvar bazanın arka kenarının içine girer, arka yüzler hizalı', () => {
  // 270°: ön yüz -x; duvar bazanın arka (+x) şeridinde.
  assert.deepEqual(round(snapBase(180, 200, 270)), { minXCm: 165, maxXCm: 215, minYCm: 100, maxYCm: 300 });
  // 90°: ön yüz +x; baza duvarın öbür tarafında, duvar yine arka şeritte.
  assert.deepEqual(round(snapBase(240, 200, 90)), { minXCm: 205, maxXCm: 255, minYCm: 100, maxYCm: 300 });
  // Önünü duvara veren baza yaslanmaz.
  assert.equal(snapBase(240, 200, 270), null);
});

test('arka şeritteki duvar çakışma sayılmaz; ön taraftaki ya da ortadaki duvar çakışmadır', () => {
  const validate = (base) => validatePlacementAgainstModules({
    placement: base.placement,
    widthCm: 200,
    depthCm: 50,
    moduleId: base.id,
    moduleType: 'base',
    itemKey: 'base_200',
    heightCm: 50,
    modules: [wall()],
    standType: 'back-wall',
    standXCm: 500,
    standYCm: 400,
  });
  assert.equal(validate(placed('base_200', 190, 100, 270, 'b')).ok, true);
  assert.equal(validate(placed('base_200', 190, 100, 90, 'b')).ok, false, 'duvar bazanın önünde');
  assert.equal(validate(placed('base_200', 210, 100, 270, 'b')).ok, false, 'duvar bazanın ortasında');
});

test('üretim listesi içerideki duvarı da duvar sırtı sayar (eski dış düzenle aynı)', () => {
  const lines = (modules) => Object.fromEntries(resolveProjectBom(modules).lines.map((line) => [line.itemKey, Number(line.quantity)]));
  const inside = lines([wall(), placed('base_200', 190, 100, 270, 'b')]);
  const outside = lines([wall(), placed('base_200', 180, 100, 270, 'b')]);
  assert.deepEqual(inside, outside);
});
