import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogItem,
} from '../src/catalog.js';
import {
  createLedFloodlightModuleState,
  normalizeModuleItemState,
  totalWallWidthCm,
} from '../src/designState.js';
import { getItem } from '../src/items.js';
import { getStandDimensions } from '../src/standDimensions.js';
import {
  clampMountBottomZCm,
  getMountBottomZBoundsCm,
  getWallUsedCm,
  placementsOverlap,
  stepMountBottomZCm,
} from '../src/modulePlacement.js';

test('LED projektor katalogda 50 cm ust aksesuar olarak tanimlidir', () => {
  assert.equal(getCatalogItem('led_floodlight').itemKey, 'led_floodlight');
  assert.equal(getItem('led_floodlight').type, 'led-floodlight');
  const light = getItem('led_floodlight');
  assert.equal(light.dimensions.widthCm, 50);
  assert.equal(light.dimensions.depthCm, 20);
  assert.equal(light.dimensions.mountHeightCm, 350);
  assert.equal(light.defaultZCm, 350);
});

test('LED projektor state sabit siyah govde ve ust aksesuar olculerini tasir', () => {
  const light = createLedFloodlightModuleState();
  assert.equal(light.itemKey, 'led_floodlight');
  assert.equal(Object.hasOwn(light, 'catalogKey'), false);
  assert.equal(light.type, 'led-floodlight');
  assert.equal(light.widthCm, 50);
  assert.equal(light.depthCm, 20);
  assert.equal(light.heightCm, 35);
  assert.equal(light.surface.color, '#17191c');
});

test('LED projektor duvar kapasitesini ve fiziksel collision hesabini etkilemez', () => {
  const wall = { id: 'wall', type: 'flat-panel', widthCm: 100, placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' } };
  const light = createLedFloodlightModuleState();
  light.placement = { xCm: 0, yCm: 0, zCm: 350, rotationZDeg: 0, wallId: 'back' };
  assert.equal(getWallUsedCm([wall, light], 'back'), 100);
  assert.equal(totalWallWidthCm([wall, light]), 100);
  assert.equal(placementsOverlap(wall, light), false);
});

test('LED projektor mount-bottom Z: taban 0…tavan; gövde max’ı düşürmez', () => {
  const ceilingCm = getStandDimensions().heightCm;
  const { minZCm, maxZCm } = getMountBottomZBoundsCm(ceilingCm);
  assert.equal(minZCm, 0);
  assert.equal(maxZCm, ceilingCm);
  // Default 350 + tavan 350 geçerli (kutu/tül formülü değil).
  assert.equal(clampMountBottomZCm(350, ceilingCm), 350);
  assert.equal(clampMountBottomZCm(ceilingCm + 80, ceilingCm), ceilingCm);
  assert.equal(clampMountBottomZCm(-10, ceilingCm), 0);
  assert.equal(stepMountBottomZCm(ceilingCm, 20, ceilingCm), ceilingCm);
  assert.equal(stepMountBottomZCm(0, -20, ceilingCm), 0);
  assert.equal(stepMountBottomZCm(200, 20, ceilingCm), 220);
});

test('normalize clamps floodlight Z with mount-bottom rule', () => {
  const ceilingCm = getStandDimensions().heightCm;
  const light = createLedFloodlightModuleState();
  light.placement = {
    xCm: 100,
    yCm: 0,
    zCm: ceilingCm + 120,
    rotationZDeg: 0,
    wallId: 'free',
  };
  normalizeModuleItemState(light);
  assert.equal(light.placement.zCm, ceilingCm);
});
