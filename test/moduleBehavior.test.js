import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getModuleBehavior,
  getModuleDefaultRotationDeg,
  getModuleGhostBehavior,
  getModuleMoveSnapCm,
  getModuleRotationStepDeg,
} from '../src/moduleBehavior.js';
import {
  createModulePlacement,
  normalizeModuleRotationZDeg,
  rotateModulePlacementAroundCenter,
  snapPlacementToStand,
  validateModulePlacement,
} from '../src/modulePlacement.js';

test('straight 100/150/200 counters use 15 degree rotation steps', () => {
  for (const widthCm of [100, 150, 200]) {
    assert.equal(getModuleRotationStepDeg({ itemKey: `desk_banko_${widthCm}` }), 15);
  }
  assert.equal(getModuleRotationStepDeg({ itemKey: 'desk_banko_150_l' }), 15);
});

test('Bar Taburesi standard keeps 10 cm snap, 15 degree turns and 270 default', () => {
  const stool = { itemKey: 'furniture_bar_stool_classic', type: 'bar-stool', widthCm: 60 };
  assert.equal(getModuleMoveSnapCm(stool), 10);
  assert.equal(getModuleRotationStepDeg(stool), 15);
  assert.equal(getModuleDefaultRotationDeg(stool), 270);
  assert.equal(getModuleBehavior(stool).placement, 'free');
});

test('45 degree rotation preserves module center', () => {
  const start = createModulePlacement({ xCm: 100, yCm: 100, rotationZDeg: 0, wallId: 'free' });
  const next = rotateModulePlacementAroundCenter(start, 100, 45, 50);
  assert.equal(next.rotationZDeg, 45);
  assert.equal(next.xCm, 100);
  assert.equal(next.yCm, 100);
});

test('rotation normalization supports eighth turns', () => {
  assert.equal(normalizeModuleRotationZDeg(44), 45);
  assert.equal(normalizeModuleRotationZDeg(136), 135);
  assert.equal(normalizeModuleRotationZDeg(315), 315);
});

test('rotated footprint participates in stand boundary validation', () => {
  const placement = createModulePlacement({ xCm: 0, yCm: 25, rotationZDeg: 45, wallId: 'free' });
  const result = validateModulePlacement({
    placement,
    widthCm: 100,
    depthCm: 50,
    standType: 'island',
    standXCm: 300,
    standYCm: 300,
  });
  assert.equal(result.ok, false);
});


test('Bar Taburesi 45 degree catalog preview placement stays valid', () => {
  const result = snapPlacementToStand({
    standType: 'island',
    moduleType: 'bar-stool',
    widthCm: 60,
    depthCm: 55,
    forceFree: true,
    pointerXCm: 150,
    pointerYCm: 150,
    standXCm: 400,
    standYCm: 400,
    preferredRotationZDeg: 315,
    rotationLocked: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.placement.rotationZDeg, 315);
  assert.equal(result.placement.wallId, 'free');
});

test('straight Banko 45 degree catalog preview placement stays valid', () => {
  const result = snapPlacementToStand({
    standType: 'island',
    moduleType: 'counter',
    widthCm: 150,
    depthCm: 50,
    forceFree: true,
    pointerXCm: 200,
    pointerYCm: 200,
    standXCm: 500,
    standYCm: 500,
    preferredRotationZDeg: 45,
    rotationLocked: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.placement.rotationZDeg, 45);
  assert.equal(result.placement.wallId, 'free');
});


test('ghost behavior is one central silhouette contract for every module', () => {
  const expected = {
    kind: 'silhouette', renderer: 'module-silhouette', opacity: 0.38,
  };
  for (const type of ['bar-stool', 'table-chair-set-eames', 'sofa-set-classic', 'tv', 'future-module']) {
    assert.deepEqual(getModuleGhostBehavior({ type }), expected);
  }
});
