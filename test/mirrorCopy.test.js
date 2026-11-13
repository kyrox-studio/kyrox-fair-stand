import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey, duplicateModuleState } from '../src/designState.js';
import { getModuleFootprintBoundsCm } from '../src/modulePlacement.js';
import { MIRROR_OUTSIDE_STAND_MESSAGE, mirrorPlacement, planMirrorCopy } from '../src/moduleGroups.js';
import { resolveProjectBom } from '../src/projectBom.js';

// Aynalı kopya (kullanıcı kararı 2026-11-12, 3ds Max "Mirror" + "Copy"; Gelişmiş mod): seçim o
// yöndeki kenarından (sağa, sola, öne, arkaya) aynalanıp hemen bitişiğine kopyalanır; orijinal
// yerinde kalır. Çakışma aranmaz (grup çoğaltma gibi); yalnız stand dışına taşan kopya eklenmez.

const STAND = { standType: 'back-wall', standXCm: 700, standYCm: 800 };
const UPRIGHT_SCENE = { widthCm: 10, depthCm: 10 };
const cm = (value) => Math.round(value * 100) / 100 + 0;
const mirror = (modules, ids, direction) => planMirrorCopy(modules, ids, direction, STAND, { duplicateModule: duplicateModuleState });

function placed(id, itemKey, placement, overrides = {}) {
  const moduleState = createModuleStateFromCatalogKey(itemKey);
  Object.assign(moduleState, overrides);
  moduleState.id = id;
  moduleState.placement = { zCm: 0, wallId: 'free', ...placement };
  return moduleState;
}

function bounds(moduleState, placement = moduleState.placement) {
  const value = getModuleFootprintBoundsCm({ ...moduleState, placement });
  return [value.minXCm, value.maxXCm, value.minYCm, value.maxYCm].map(cm);
}

// Kullanıcının "sol" grubu: sol kenarda baza (x 0–50), arka köşelerinde dikmeler.
function leftFrame() {
  const group = { id: 'group-sol', name: 'sol', locked: false };
  const modules = [
    placed('base', 'base_200', { xCm: 25, yCm: 400, rotationZDeg: 270 }),
    placed('u1', 'upright_346_5', { xCm: 40, yCm: 595, rotationZDeg: 0 }, UPRIGHT_SCENE),
    placed('u2', 'upright_346_5', { xCm: 40, yCm: 405, rotationZDeg: 0 }, UPRIGHT_SCENE),
  ];
  modules.forEach((moduleState) => { moduleState.group = { ...group }; });
  return modules;
}

test('sağa aynala: grup sağ kenarından aynalanıp hemen sağına kopyalanır, orijinal yerinde', () => {
  const modules = leftFrame();
  const before = modules.map((moduleState) => bounds(moduleState));
  const result = mirror(modules, modules.map((m) => m.id), 'right');
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(modules.map((moduleState) => bounds(moduleState)), before, 'orijinaller değişmez');
  // Ayna çizgisi seçimin sağ kenarı (x 50): x' = 100 − x.
  result.clones.forEach((clone, index) => {
    const [minX, maxX, minY, maxY] = before[index];
    assert.deepEqual(bounds(clone), [cm(100 - maxX), cm(100 - minX), minY, maxY], clone.itemKey);
  });
  assert.equal(result.clones[0].placement.rotationZDeg, 90);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].name, 'sol (ayna)');
  assert.ok(result.clones.every((clone) => clone.group?.id === result.groups[0].id && clone.group.locked === false));
});

test('sola / öne / arkaya aynala: kopya o kenarın hemen bitişiğine düşer', () => {
  const base = placed('base', 'base_200', { xCm: 300, yCm: 300, rotationZDeg: 0 });
  const [minX, maxX, minY, maxY] = bounds(base);
  const left = mirror([base], ['base'], 'left');
  assert.deepEqual(bounds(left.clones[0]), [cm(2 * minX - maxX), minX, minY, maxY]);
  assert.equal(left.clones[0].placement.rotationZDeg, 0);
  const front = mirror([base], ['base'], 'front');
  assert.deepEqual(bounds(front.clones[0]), [minX, maxX, maxY, cm(2 * maxY - minY)]);
  assert.equal(front.clones[0].placement.rotationZDeg, 180);
  const back = mirror([base], ['base'], 'back');
  assert.deepEqual(bounds(back.clones[0]), [minX, maxX, cm(2 * minY - maxY), minY]);
  assert.equal(back.groups.length, 0, 'grupsuz öğenin kopyası grupsuz');
});

test('ayna açısı ara açıda da yansır; sol / sağ duvar kenarı yer değiştirir', () => {
  const wall = placed('w', 'wall_200_350', { xCm: 0, yCm: 100, rotationZDeg: 270, wallId: 'left' });
  assert.equal(mirrorPlacement(wall, 'x', 350).rotationZDeg, 90);
  assert.equal(mirrorPlacement(wall, 'x', 350).wallId, 'right');
  const angled = placed('a', 'base_200', { xCm: 200, yCm: 300, rotationZDeg: 45 });
  assert.equal(mirrorPlacement(angled, 'x', 350).rotationZDeg, 315);
  assert.equal(mirrorPlacement(angled, 'y', 400).rotationZDeg, 135);
});

test('yanı dolu olsa da kopya eklenir; yalnız stand dışına düşerse eklenmez', () => {
  const modules = leftFrame();
  const neighbor = placed('neighbor', 'base_200', { xCm: 75, yCm: 400, rotationZDeg: 270 });
  const overlapping = mirror([...modules, neighbor], modules.map((m) => m.id), 'right');
  assert.equal(overlapping.ok, true, overlapping.message);
  const outside = mirror(modules, modules.map((m) => m.id), 'left');
  assert.equal(outside.ok, false);
  assert.equal(outside.message, MIRROR_OUTSIDE_STAND_MESSAGE);
});

test('aynalı kopya üretim listesine kendi parçalarıyla girer', () => {
  const base = placed('base', 'base_200', { xCm: 300, yCm: 300, rotationZDeg: 0 });
  const one = resolveProjectBom([base]);
  const result = mirror([base], ['base'], 'front');
  assert.equal(result.ok, true, result.message);
  const two = resolveProjectBom([base, ...result.clones]);
  const qty = (bom, key) => bom.lines.find((line) => line.itemKey === key)?.quantity ?? 0;
  for (const line of one.lines) assert.equal(qty(two, line.itemKey), line.quantity * 2, line.itemKey);
});
