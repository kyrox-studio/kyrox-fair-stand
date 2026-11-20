import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getItem,
  resolveFlatPanelStripCount,
  resolveItemDefaultZCm,
  resolveSceneDimensions,
} from '../src/items.js';
import { createFlatPanelModuleState, createProfileModuleState, createUprightModuleState } from '../src/designState.js';
import { getModuleCollisionHeightRangeCm } from '../src/moduleBehavior.js';

test('profile rail scene height is thickness; drop Z puts top at catalog ceiling', () => {
  const item = getItem('profile_190');
  // DB sahne kesiti 10 (2026-11-20): tepe yine katalog tavanında (350).
  assert.equal(resolveSceneDimensions(item).heightCm, 10);
  assert.equal(item.defaultZCm, 340);
  const state = createProfileModuleState({ itemKey: 'profile_190' });
  assert.equal(state.heightCm, 10);
  assert.equal(resolveItemDefaultZCm('profile_190') + state.heightCm, 350);
});

test('upright mesh factory uses item scene height, not stand 350', () => {
  const tall = createUprightModuleState({ itemKey: 'upright_346_5' });
  assert.equal(tall.itemKey, 'upright_346_5');
  // Dikme sahne ölçüsü DB'den (10 × 10; 346,5 → 350, 99 → 100).
  assert.equal(tall.heightCm, getItem('upright_346_5').sceneDimensions.heightCm);
  assert.equal(tall.widthCm, 10);
  const shortPost = createUprightModuleState({ itemKey: 'upright_99' });
  assert.equal(shortPost.itemKey, 'upright_99');
  assert.equal(shortPost.heightCm, getItem('upright_99').sceneDimensions.heightCm);
  assert.equal(shortPost.widthCm, 10);
});

test('short-up collision band is item height + placement Z, not occupancy × stand', () => {
  const hanging = createFlatPanelModuleState({ itemKey: 'wall_200_short_2' });
  assert.equal(hanging.heightCm, 100);
  assert.equal(hanging.strips.length, 2);
  hanging.placement = {
    xCm: 0,
    yCm: 0,
    zCm: resolveItemDefaultZCm('wall_200_short_2'),
    rotationZDeg: 0,
    wallId: 'back',
  };
  assert.deepEqual(getModuleCollisionHeightRangeCm(hanging), { minCm: 250, maxCm: 350 });
  const wall = createFlatPanelModuleState({ itemKey: 'wall_200_350' });
  const pitchCm = 50;
  assert.equal(wall.strips.length, resolveFlatPanelStripCount(getItem('wall_200_350')));
  assert.equal(wall.heightCm, Math.min(wall.strips.length * pitchCm, resolveSceneDimensions(getItem('wall_200_350')).heightCm));
});
