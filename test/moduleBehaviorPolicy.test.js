import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  allowsThinWallEndpointContact,
  canModulesOverlapByBehavior,
  countsTowardWallCapacity,
  getModuleBehavior,
  getModuleCollisionStrategy,
  getModuleMagneticSnapStrategy,
  isUprightJointSnapTarget,
  isTopPlacementModule,
  resolveSideInsertRotationDeg,
  supportsWallOverlayMount,
  usesLogicalFixtureEndpoint,
  usesWallBackboneCollisionDepth,
  usesWallInnerFaceBoundary,
  usesPanelSeamOverlaySnap,
} from '../src/moduleBehavior.js';

test('F-011 special placement policies are declared by the canonical behavior contract', () => {
  for (const type of ['mini-fridge', 'kettle', 'coat-rack']) {
    assert.equal(getModuleMagneticSnapStrategy(type), 'none', type);
  }

  assert.equal(getModuleMagneticSnapStrategy('upright'), 'short-up-joint');
  assert.equal(getModuleMagneticSnapStrategy('profile'), 'standard');
  assert.equal(isUprightJointSnapTarget({ type: 'profile', itemKey: 'profile_190' }), true);
  assert.equal(isUprightJointSnapTarget({ type: 'counter', itemKey: 'desk_banko_200' }), true);
  assert.equal(isUprightJointSnapTarget({ type: 'flat-panel', itemKey: 'wall_200_350' }), false);
  assert.equal(canModulesOverlapByBehavior({ type: 'upright' }, { type: 'profile' }), true);
  assert.equal(canModulesOverlapByBehavior({ type: 'upright' }, { type: 'counter' }), true);
  assert.equal(canModulesOverlapByBehavior({ type: 'profile' }, { type: 'separator' }), true);
  assert.equal(canModulesOverlapByBehavior({ type: 'profile' }, { type: 'flat-panel' }), false);

  assert.equal(usesLogicalFixtureEndpoint('counter'), true);
  assert.equal(usesLogicalFixtureEndpoint('base'), true);
  assert.equal(usesLogicalFixtureEndpoint('flat-panel'), false);

  assert.equal(usesWallBackboneCollisionDepth('base-wall'), true);
  assert.equal(usesWallBackboneCollisionDepth('base'), false);

  assert.equal(allowsThinWallEndpointContact('indoor-plant-1'), true);
  assert.equal(allowsThinWallEndpointContact('mini-fridge'), false);

  assert.equal(usesWallInnerFaceBoundary('sofa-set-classic'), true);
  assert.equal(usesWallInnerFaceBoundary('table-chair-set-eames'), false);
  assert.equal(usesWallInnerFaceBoundary('chair'), false);
  assert.equal(usesWallInnerFaceBoundary('table-glass'), false);
  assert.equal(usesWallInnerFaceBoundary('counter'), false);

  assert.equal(supportsWallOverlayMount('flat-panel'), true);
  assert.equal(supportsWallOverlayMount('base-wall'), true);
  assert.equal(supportsWallOverlayMount('shelf'), false);
  assert.equal(supportsWallOverlayMount('door'), true);
  assert.equal(supportsWallOverlayMount('showcase-2'), true);
  assert.equal(supportsWallOverlayMount('showcase-3'), true);
  assert.equal(supportsWallOverlayMount('separator'), true);
  assert.equal(supportsWallOverlayMount('counter'), false);

  assert.equal(countsTowardWallCapacity('led-floodlight'), false);
  assert.equal(countsTowardWallCapacity('shelf'), false);
  assert.equal(countsTowardWallCapacity('flat-panel'), true);
  assert.equal(isTopPlacementModule('led-floodlight'), true);
  assert.equal(isTopPlacementModule('flat-panel'), false);
  assert.equal(usesPanelSeamOverlaySnap('shelf'), true);
  assert.equal(usesPanelSeamOverlaySnap('tv'), false);
  assert.equal(getModuleBehavior('shelf').placement, 'wall-overlay');
  assert.equal(getModuleBehavior('shelf').overlaySnap, undefined);

  assert.equal(resolveSideInsertRotationDeg('furniture_bar_stool_classic', 90), 270);
  assert.equal(resolveSideInsertRotationDeg({ itemKey: 'desk_banko_150' }, 90), 90);
});

test('kettle declared contract and runtime collision strategy stay collision-none', () => {
  assert.equal(canModulesOverlapByBehavior({ type: 'kettle' }, { type: 'mini-fridge' }), true);
  assert.equal(canModulesOverlapByBehavior({ type: 'mini-fridge' }, { type: 'kettle' }), true);
  assert.equal(canModulesOverlapByBehavior({ type: 'kettle' }, { type: 'counter' }), false);
  assert.equal(getModuleBehavior('kettle').collision, 'none');
  assert.equal(getModuleCollisionStrategy('kettle'), 'none');
});

test('placement core selects F-011 policies through moduleBehavior instead of private type registries', () => {
  const source = readFileSync(new URL('../src/modulePlacement.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /DEPOT_FREE_NO_MAGNETIC_SNAP_TYPES/);
  assert.doesNotMatch(source, /moduleType === 'base-wall'/);
  assert.doesNotMatch(source, /module\?\.type === 'base-wall'/);
  assert.doesNotMatch(source, /moduleType === 'sofa-set-classic'/);
  assert.doesNotMatch(source, /moduleType === 'table-chair-set-eames'/);
  assert.doesNotMatch(source, /insertedModule\.type === 'bar-stool'/);
  assert.doesNotMatch(source, /isKettleMiniFridgeStackPair/);

  for (const helper of [
    'getModuleMagneticSnapStrategy',
    'isUprightJointSnapTarget',
    'usesLogicalFixtureEndpoint',
    'usesWallBackboneCollisionDepth',
    'allowsThinWallEndpointContact',
    'usesWallInnerFaceBoundary',
    'canModulesOverlapByBehavior',
    'getModuleCollisionHeightRangeCm',
    'resolveSideInsertRotationDeg',
  ]) {
    assert.match(source, new RegExp(helper), helper);
  }
});

// Kopyala (Çoğalt Sağ/Sol yerine): kopya katalogdan bırakmayla aynı, davranışa dayalı yerleşim
// yolundan geçer; tavan armatürü için türe özel kontrol yoktur.
test('controller places copies through the shared behavior-driven drop path instead of a LED type check', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /sourceModule\.type === 'led-floodlight'/);
  assert.doesNotMatch(source, /type === 'led-floodlight'/);
  assert.match(source, /const result = scene3d\.dropCatalogModuleDrag\(state, clientX, clientY, rotationZDeg, rotationLocked\);/);
  assert.match(source, /createState: \(\) => duplicateModuleState\(copiedModule\),/);
});
