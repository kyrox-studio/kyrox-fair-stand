import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { normalizeModuleItemState } from '../src/designState.js';
import {
  applyItemPlacementZCm,
  getItem,
  isWallShortFamilyDescriptor,
  itemMovesVertically,
  resolveItemDefaultZCm,
  resolveSceneDimensions,
} from '../src/items.js';
import { getModuleCollisionHeightRangeCm } from '../src/moduleBehavior.js';
import {
  getModulePlacementSnapCm,
  getWallOverlayZBoundsCm,
  getWallShortFloorZBoundsCm,
  stepWallShortFloorZCm,
  WALL_OVERLAY_DEFAULT_CENTER_CM,
} from '../src/modulePlacement.js';
import { getStandDimensions } from '../src/standDimensions.js';

const STAND_HEIGHT_CM = 500;

function climb(heightCm, startZCm = 0) {
  const stepCm = getModulePlacementSnapCm('flat-panel');
  const { maxZCm } = getWallShortFloorZBoundsCm(heightCm, STAND_HEIGHT_CM);
  const values = [startZCm];
  let zCm = startZCm;
  while (zCm < maxZCm) {
    const nextZCm = stepWallShortFloorZCm(zCm, stepCm, heightCm, STAND_HEIGHT_CM);
    if (nextZCm === zCm) break;
    zCm = nextZCm;
    values.push(zCm);
  }
  return values;
}

test('wall-short default Z stays on the catalog item', () => {
  assert.equal(resolveItemDefaultZCm('wall_50_short_1'), 300);
  assert.equal(resolveSceneDimensions(getItem('wall_50_short_1')).heightCm, 50);
  assert.equal(resolveItemDefaultZCm('wall_100_short_2'), 250);
  assert.equal(resolveSceneDimensions(getItem('wall_100_short_2')).heightCm, 100);
});

test('wall-short vertical step reuses the flat-panel 10 cm snap', () => {
  assert.equal(getModulePlacementSnapCm('flat-panel'), 10);
  assert.equal(getModulePlacementSnapCm('tv'), 10);
  assert.equal(stepWallShortFloorZCm(300, getModulePlacementSnapCm('flat-panel'), 50, STAND_HEIGHT_CM), 310);
  assert.equal(stepWallShortFloorZCm(300, -getModulePlacementSnapCm('flat-panel'), 50, STAND_HEIGHT_CM), 290);
  assert.equal(stepWallShortFloorZCm(20, 50, 50, STAND_HEIGHT_CM), 70);
});

test('wall-short floor clamp keeps the bottom at or above 0', () => {
  assert.equal(getWallShortFloorZBoundsCm(50, STAND_HEIGHT_CM).minZCm, 0);
  assert.equal(stepWallShortFloorZCm(0, -50, 50, STAND_HEIGHT_CM), 0);
  assert.equal(stepWallShortFloorZCm(-40, 0, 50, STAND_HEIGHT_CM), 0);
  assert.equal(stepWallShortFloorZCm(50, -50, 100, STAND_HEIGHT_CM), 0);
});

test('50 cm wall-short ceiling is stand height minus body height', () => {
  const bounds = getWallShortFloorZBoundsCm(50, STAND_HEIGHT_CM);
  assert.equal(bounds.maxZCm, 450);
  assert.deepEqual(climb(50), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 340, 350, 360, 370, 380, 390, 400, 410, 420, 430, 440, 450]);
  assert.equal(stepWallShortFloorZCm(450, 50, 50, STAND_HEIGHT_CM), 450);
  const liveCeilingCm = getStandDimensions().heightCm;
  assert.equal(
    stepWallShortFloorZCm(300, 50, 50, liveCeilingCm),
    Math.min(liveCeilingCm - 50, 350),
  );
});

test('100 cm wall-short ceiling is stand height minus body height', () => {
  const bounds = getWallShortFloorZBoundsCm(100, STAND_HEIGHT_CM);
  assert.equal(bounds.maxZCm, 400);
  assert.deepEqual(climb(100), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 340, 350, 360, 370, 380, 390, 400]);
  assert.equal(stepWallShortFloorZCm(400, 50, 100, STAND_HEIGHT_CM), 400);
  assert.equal(stepWallShortFloorZCm(250, 50, 100, STAND_HEIGHT_CM), 300);
});

test('runtime ceiling comes from stand dimensions, not a fixed number', () => {
  const ceilingCm = getStandDimensions().heightCm;
  assert.equal(getWallShortFloorZBoundsCm(50).maxZCm, ceilingCm - 50);
  assert.equal(getWallShortFloorZBoundsCm(100).maxZCm, ceilingCm - 100);
  assert.equal(getWallShortFloorZBoundsCm(50).minZCm, 0);
});

test('vertical step keeps XY, rotation, and wall id', () => {
  const placement = { xCm: 40, yCm: 80, zCm: 300, rotationZDeg: 90, wallId: 'left' };
  const next = {
    ...placement,
    zCm: stepWallShortFloorZCm(placement.zCm, -50, 50, STAND_HEIGHT_CM),
  };
  assert.equal(next.xCm, 40);
  assert.equal(next.yCm, 80);
  assert.equal(next.rotationZDeg, 90);
  assert.equal(next.wallId, 'left');
  assert.equal(next.zCm, 250);
});

test('snap placement keeps a user wall-short Z instead of resetting it', () => {
  const moduleState = {
    type: 'flat-panel',
    itemKey: 'wall_50_short_1',
    variant: 'wall-short-1',
    placement: { xCm: 0, yCm: 0, zCm: 150, rotationZDeg: 0, wallId: 'back' },
  };
  const snapped = applyItemPlacementZCm(moduleState, {
    xCm: 50,
    yCm: 0,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'back',
  });
  assert.equal(snapped.zCm, 150);
  assert.equal(snapped.xCm, 50);
});

test('save and load keep a moved wall-short Z', () => {
  const loaded = normalizeModuleItemState({
    type: 'flat-panel',
    itemKey: 'wall_50_short_1',
    variant: 'wall-short-1',
    placement: { xCm: 10, yCm: 20, zCm: 150, rotationZDeg: 90, wallId: 'back' },
  });
  const saved = JSON.parse(JSON.stringify(loaded));
  const reloaded = normalizeModuleItemState(JSON.parse(JSON.stringify(saved)));
  assert.equal(reloaded.placement.zCm, 150);
  assert.equal(reloaded.placement.xCm, 10);
  assert.equal(reloaded.placement.yCm, 20);
  assert.equal(reloaded.placement.rotationZDeg, 90);
  assert.equal(reloaded.itemKey, 'wall_50_short_1');
});

test('collision range follows the moved bottom without a new collision rule', () => {
  const zCm = stepWallShortFloorZCm(300, -100, 50, STAND_HEIGHT_CM);
  const range = getModuleCollisionHeightRangeCm({
    type: 'flat-panel',
    itemKey: 'wall_50_short_1',
    heightCm: 50,
    placement: { zCm },
  });
  assert.equal(zCm, 200);
  assert.equal(range.minCm, 200);
  assert.equal(range.maxCm, 250);
});

test('vertical Z on wall-placed items comes from DB vertical_move (short walls and profiles, not full walls)', () => {
  assert.equal(isWallShortFamilyDescriptor({ itemKey: 'wall_50_short_1' }), true);
  assert.equal(isWallShortFamilyDescriptor({ itemKey: 'wall_200_short_2' }), true);
  assert.equal(isWallShortFamilyDescriptor({ itemKey: 'wall_200_350', type: 'flat-panel' }), false);
  assert.equal(isWallShortFamilyDescriptor({ type: 'tv', itemKey: 'tv_42' }), false);
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.equal(itemMovesVertically('wall_50_short_1'), true);
  assert.equal(itemMovesVertically('wall_200_short_2'), true);
  assert.equal(itemMovesVertically('profile_190'), true);
  assert.equal(itemMovesVertically('wall_200_350'), false);
  assert.match(source, /const canMoveVertically = itemMovesVertically\(moduleState\);/);
  assert.match(source, /if \(canMoveVertically && getModuleBehavior\(moduleState\)\.placement === 'wall'\) \{/);
  assert.match(source, /stepWallShortFloorZCm\(currentZCm, bestArrowMove\.deltaCm, moduleState\.heightCm\)/);
  assert.match(source, /desiredPlacement\.zCm = Number\(moduleState\.placement\.zCm \|\| 0\);/);
});

test('TV wall-overlay Z bounds stay on the center offset', () => {
  const wallHeightCm = 350;
  const heightCm = 52.3;
  const { minZCm, maxZCm } = getWallOverlayZBoundsCm(heightCm, wallHeightCm);
  assert.equal(minZCm, heightCm / 2 - WALL_OVERLAY_DEFAULT_CENTER_CM);
  assert.equal(maxZCm, wallHeightCm - heightCm / 2 - WALL_OVERLAY_DEFAULT_CENTER_CM);
  assert.ok(minZCm < 0);
  assert.notEqual(getWallShortFloorZBoundsCm(50, wallHeightCm).maxZCm, maxZCm);
});
