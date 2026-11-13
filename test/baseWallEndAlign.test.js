import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { getModuleFootprintBoundsCm, snapPlacementToModules } from '../src/modulePlacement.js';

// Kullanıcı kararı 2026-11-12: duvarın yüzüne yaslanan baza duvar boyunca 10 cm ızgarada kalmaz;
// ucu duvarın ucuna yapışma mesafesinden (30 cm) yakınsa duvarla birebir hizalanır. Eskiden baza
// duvardan 5 cm kayık kalıyor, duvar sırtındaki bazanın profil düşümü de bu yüzden çalışmıyordu.

const STAND = { standType: 'back-wall', standXCm: 500, standYCm: 400 };

function wall() {
  const moduleState = createModuleStateFromCatalogKey('wall_200_350');
  moduleState.id = 'w';
  moduleState.placement = { xCm: 105, yCm: 220, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  return moduleState;
}

function snapBase(pointerXCm, pointerYCm, rotationZDeg = 0) {
  const base = createModuleStateFromCatalogKey('base_200');
  const result = snapPlacementToModules({
    moduleId: 'b',
    moduleType: base.type,
    itemKey: base.itemKey,
    heightCm: base.heightCm,
    widthCm: base.widthCm,
    depthCm: base.depthCm,
    pointerXCm,
    pointerYCm,
    rotationZDeg,
    modules: [wall()],
    ...STAND,
  });
  assert.ok(result, `imleç (${pointerXCm}, ${pointerYCm})`);
  const bounds = getModuleFootprintBoundsCm({ ...base, placement: result.placement });
  return [bounds.minXCm, bounds.maxXCm, bounds.minYCm, bounds.maxYCm].map((value) => Math.round(value * 10) / 10);
}

test('duvar yüzüne yaslanan baza duvarın ucuna hizalanır (önde ve arkada)', () => {
  // Duvar x 105–305, y 215–225.
  for (const pointerXCm of [200, 210, 230]) {
    assert.deepEqual(snapBase(pointerXCm, 245), [105, 305, 215, 265], `imleç x ${pointerXCm}`);
  }
  assert.deepEqual(snapBase(205, 195, 180), [105, 305, 175, 225]);
});

test('ucu duvar ucuna uzak bazada ızgara yerleşimi kalır', () => {
  assert.deepEqual(snapBase(150, 245), [50, 250, 215, 265]);
});

test('stand kenarındaki duvarda baza duvarın arka yüzüyle hizalanır; sınır dikmeler içindir, ahşap taşabilir', () => {
  const base = createModuleStateFromCatalogKey('base_200');
  const snapAt = (wallState, pointerXCm, pointerYCm, rotationZDeg) => {
    const result = snapPlacementToModules({
      moduleId: 'b',
      moduleType: base.type,
      itemKey: base.itemKey,
      heightCm: base.heightCm,
      widthCm: base.widthCm,
      depthCm: base.depthCm,
      pointerXCm,
      pointerYCm,
      rotationZDeg,
      modules: [wallState],
      ...STAND,
    });
    assert.ok(result, `imleç (${pointerXCm}, ${pointerYCm})`);
    const bounds = getModuleFootprintBoundsCm({ ...base, placement: result.placement });
    return [bounds.minXCm, bounds.maxXCm, bounds.minYCm, bounds.maxYCm].map((value) => Math.round(value * 10) / 10);
  };
  const back = createModuleStateFromCatalogKey('wall_200_350');
  back.id = 'back';
  back.placement = { xCm: 100, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' };
  assert.deepEqual(snapAt(back, 210, 25, 0), [100, 300, -5, 45]);
  const right = createModuleStateFromCatalogKey('wall_200_350');
  right.id = 'right';
  right.placement = { xCm: 500, yCm: 100, zCm: 0, rotationZDeg: 90, wallId: 'right' };
  assert.deepEqual(snapAt(right, 470, 210, 270), [455, 505, 100, 300]);
});

test('düz banko bazayla aynı kural: duvara oturur, uca hizalanır, kenar duvarında taşar', () => {
  const counter = createModuleStateFromCatalogKey('desk_banko_200');
  const snapCounter = (wallState, pointerXCm, pointerYCm, rotationZDeg) => {
    const result = snapPlacementToModules({
      moduleId: 'c',
      moduleType: counter.type,
      itemKey: counter.itemKey,
      heightCm: counter.heightCm,
      shape: counter.shape,
      widthCm: counter.widthCm,
      depthCm: counter.depthCm,
      pointerXCm,
      pointerYCm,
      rotationZDeg,
      modules: [wallState],
      ...STAND,
    });
    assert.ok(result, `imleç (${pointerXCm}, ${pointerYCm})`);
    const bounds = getModuleFootprintBoundsCm({ ...counter, placement: result.placement });
    return [bounds.minXCm, bounds.maxXCm, bounds.minYCm, bounds.maxYCm].map((value) => Math.round(value * 10) / 10);
  };
  assert.deepEqual(snapCounter(wall(), 210, 245, 0), [105, 305, 215, 265]);
  const back = createModuleStateFromCatalogKey('wall_200_350');
  back.id = 'back';
  back.placement = { xCm: 100, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' };
  assert.deepEqual(snapCounter(back, 210, 25, 0), [100, 300, -5, 45]);
});
