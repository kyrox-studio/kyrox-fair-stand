import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canModulesOverlapByBehavior,
  getModuleBehavior,
  getModuleGhostBehavior,
  getModuleMagneticSnapStrategy,
  getModuleMoveSnapCm,
  supportsWallOverlayMount,
  usesLogicalFixtureEndpoint,
  usesWallBackboneCollisionDepth,
  usesWallInnerFaceBoundary,
  allowsThinWallEndpointContact,
} from '../src/moduleBehavior.js';
import {
  initializeItemTypeRegistry,
  resetItemRegistry,
} from '../src/items.js';
import {
  ITEM_TYPE_BEHAVIOR_SLICE1,
  ITEM_TYPE_BEHAVIOR_SLICE2,
  ITEM_TYPE_BEHAVIOR_SLICE3,
  assertSlice3Equal,
  behaviorSlice1ForType,
  behaviorSlice2ForType,
  behaviorSlice3ForType,
  buildItemTypeBootstrapRows,
} from './itemTypeBehaviorSeed.mjs';
import { loadCanonicalItemCatalog } from './registerCanonicalItemCatalog.mjs';

test.afterEach(() => {
  loadCanonicalItemCatalog();
});

test('DB-only: tip kaydı kesit1+2+3 alanlarını yazar', () => {
  resetItemRegistry();
  initializeItemTypeRegistry([
    {
      id: 1,
      key: 'shelf',
      displayName: 'Raf',
      placement: 'free',
      collision: 'footprint',
      moveSnapCm: 99,
      magneticSnap: 'standard',
      allowSideInsert: true,
      supportsWallOverlayMount: true,
      wallCapacity: 'include',
      connectionEndpoint: 'segment',
      collisionDepth: 'physical',
      endpointContact: 'standard',
      boundarySnap: 'stand-edge',
      collisionHeight: 'full',
      overlapWithTypes: [],
      ghost: { kind: 'silhouette', renderer: 'module-silhouette', opacity: 0.38 },
      isActive: true,
    },
  ]);

  const behavior = getModuleBehavior('shelf');
  assert.equal(behavior.placement, 'free');
  assert.equal(behavior.collision, 'footprint');
  assert.equal(behavior.moveSnapCm, 99);
  assert.equal(behavior.magneticSnap, 'standard');
  assert.equal(behavior.allowSideInsert, true);
  assert.equal(behavior.supportsWallOverlayMount, true);
  assert.equal(behavior.wallCapacity, 'include');
  assert.equal(behavior.connectionEndpoint, 'segment');
  assert.equal(behavior.collisionDepth, 'physical');
  assert.equal(behavior.endpointContact, 'standard');
  assert.equal(behavior.boundarySnap, 'stand-edge');
  assert.equal(behavior.collisionHeight, 'full');
  assert.deepEqual(behavior.overlapWithTypes, []);
  assert.equal(behavior.ghost.kind, 'silhouette');
});

test('DB-only: bilinen tipte bootstrap eksikse fail-fast', () => {
  resetItemRegistry();
  assert.throws(
    () => getModuleBehavior('shelf'),
    /missing kesit1\/kesit2\/kesit3/,
  );
});

test('DB-only: bilinmeyen tip DEFAULT wall + standard policy + contact', () => {
  resetItemRegistry();
  const b = getModuleBehavior('__unknown-module-type__');
  assert.equal(b.placement, 'wall');
  assert.equal(getModuleMoveSnapCm('__unknown-module-type__'), 10);
  assert.equal(b.magneticSnap, 'standard');
  assert.equal(b.allowSideInsert, true);
  assert.equal(b.connectionEndpoint, 'segment');
  assert.equal(b.collisionDepth, 'physical');
  assert.equal(b.ghost.opacity, 0.38);
});

test('DB-only parity: seed slice1+2+3 ≡ eski TYPE_BEHAVIORS alanları', () => {
  resetItemRegistry();
  initializeItemTypeRegistry(buildItemTypeBootstrapRows([
    ...Object.keys(ITEM_TYPE_BEHAVIOR_SLICE1),
    ...Object.keys(ITEM_TYPE_BEHAVIOR_SLICE2),
    ...Object.keys(ITEM_TYPE_BEHAVIOR_SLICE3),
  ]));

  for (const key of Object.keys(ITEM_TYPE_BEHAVIOR_SLICE1)) {
    const s1 = behaviorSlice1ForType(key);
    const s2 = behaviorSlice2ForType(key);
    const s3 = behaviorSlice3ForType(key);
    const actual = getModuleBehavior(key);
    assert.equal(actual.placement, s1.placement, key);
    assert.equal(actual.collision, s1.collision, key);
    assert.equal(actual.moveSnapCm, s1.moveSnapCm, key);
    assert.equal(actual.magneticSnap, s2.magneticSnap, key);
    assert.equal(actual.allowSideInsert, s2.allowSideInsert, key);
    assert.equal(actual.supportsWallOverlayMount, s2.supportsWallOverlayMount, key);
    assert.equal(actual.wallCapacity, s2.wallCapacity, key);
    assertSlice3Equal(actual, s3, key);
  }

  assert.equal(getModuleMagneticSnapStrategy('upright'), 'short-up-joint');
  assert.equal(supportsWallOverlayMount('flat-panel'), true);
  assert.equal(supportsWallOverlayMount('shelf'), false);
  assert.equal(usesLogicalFixtureEndpoint('counter'), true);
  assert.equal(usesWallBackboneCollisionDepth('base-wall'), true);
  assert.equal(allowsThinWallEndpointContact('indoor-plant-1'), true);
  assert.equal(usesWallInnerFaceBoundary('sofa-set-classic'), true);
  assert.equal(canModulesOverlapByBehavior('mini-fridge', 'kettle'), true);
  assert.equal(getModuleGhostBehavior('shelf').renderer, 'module-silhouette');
});
