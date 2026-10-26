import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCatalogItem,
} from '../src/catalog.js';
import { createKettleModuleState } from '../src/designState.js';
import { getItem } from '../src/items.js';
import { canModulesOverlapByBehavior, getModuleBehavior, getModuleRotationStepDeg } from '../src/moduleBehavior.js';
import { placementsOverlap } from '../src/modulePlacement.js';

test('kettle catalog and state stay aligned', () => {
  const catalog = getCatalogItem('kettle');
  const item = getItem('kettle');
  const state = createKettleModuleState();
  assert.equal(catalog.itemKey, 'kettle');
  assert.deepEqual([item.dimensions.widthCm, item.dimensions.depthCm, item.dimensions.heightCm], [24, 19, 25]);
  assert.equal(item.defaultZCm, 66);
  assert.deepEqual([state.widthCm, state.depthCm, state.heightCm], [24, 19, 25]);
});

test('kettle keeps its declared free-positioned collision contract', () => {
  const behavior = getModuleBehavior({ type: 'kettle' });
  assert.equal(behavior.placement, 'free');
  assert.equal(behavior.collision, 'none');
  assert.equal(behavior.magneticSnap, 'none');
  assert.equal(getModuleRotationStepDeg({ itemKey: 'kettle' }), 15);
  assert.deepEqual(behavior.overlapWithTypes, ['mini-fridge']);
});


test('kettle may share the mini-fridge footprint at its raised placement', () => {
  const fridge = {
    id: 'fridge',
    type: 'mini-fridge',
    widthCm: 45,
    depthCm: 43,
    heightCm: 66,
    placement: { xCm: 100, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };
  const kettle = {
    id: 'kettle',
    type: 'kettle',
    widthCm: 24,
    depthCm: 19,
    heightCm: 25,
    placement: { xCm: 110, yCm: 110, zCm: 66, rotationZDeg: 0, wallId: 'free' },
  };

  assert.equal(canModulesOverlapByBehavior(kettle, fridge), true);
  assert.equal(placementsOverlap(kettle, fridge), false);
  assert.equal(placementsOverlap(fridge, kettle), false);
});

test('kettle does not collide with unrelated fixtures', () => {
  const kettle = {
    id: 'kettle',
    type: 'kettle',
    widthCm: 24,
    depthCm: 19,
    placement: { xCm: 100, yCm: 100, zCm: 66, rotationZDeg: 0, wallId: 'free' },
  };
  const counter = {
    id: 'counter',
    type: 'counter',
    widthCm: 100,
    depthCm: 50,
    placement: { xCm: 80, yCm: 90, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };

  assert.equal(canModulesOverlapByBehavior(kettle, counter), false);
  assert.equal(placementsOverlap(kettle, counter), false);
});
