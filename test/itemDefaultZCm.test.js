import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyItemPlacementZCm,
  getItem,
  listRegisteredItems,
  resolveItemDefaultZCm,
} from '../src/items.js';
import { createModulePlacement } from '../src/modulePlacement.js';

const SCENE_SOURCE = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
const MAIN_SOURCE = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('drop Z comes from item.defaultZCm for every Item, not stand ceiling or type lists', () => {
  assert.equal(resolveItemDefaultZCm('led_floodlight'), 350);
  assert.equal(getItem('led_floodlight').defaultZCm, 350);
  assert.equal(getItem('led_floodlight').dimensions.mountHeightCm, 350);
  assert.equal(resolveItemDefaultZCm('wall_200_350'), 0);
  assert.equal(getItem('wall_200_350').defaultZCm, 0);
  assert.equal(getItem('kettle').defaultZCm, 66);
  assert.equal(resolveItemDefaultZCm('kettle'), 66);
  assert.equal(createModulePlacement({ xCm: 10, itemKey: 'kettle' }).zCm, 66);
  assert.equal(resolveItemDefaultZCm('profile_190'), 340); // DB: tavan 350 − sahne kesiti 10
  assert.equal(resolveItemDefaultZCm('wall_200_short_2'), 250);
  assert.equal(resolveItemDefaultZCm('wall_200_short_1'), 300);
  assert.equal(resolveItemDefaultZCm({ defaultZCm: 30 }), 30);

  for (const item of listRegisteredItems()) {
    assert.equal(Object.hasOwn(item, 'defaultZCm'), true, item.itemKey);
    assert.equal(Number.isFinite(item.defaultZCm), true, item.itemKey);
    assert.equal(item.defaultZCm, resolveItemDefaultZCm(item), item.itemKey);
  }

  assert.equal(createModulePlacement({ xCm: 10, itemKey: 'led_floodlight' }).zCm, 350);
  assert.equal(createModulePlacement({ xCm: 10, itemKey: 'desk_banko_100' }).zCm, 0);
  assert.equal(applyItemPlacementZCm({ defaultZCm: 30 }, { xCm: 0, yCm: 0 }).zCm, 30);
  assert.equal(applyItemPlacementZCm(
    { itemKey: 'desk_banko_100', placement: { zCm: 45 } },
    { xCm: 20, yCm: 0, zCm: 0 },
  ).zCm, 45);
  assert.equal(applyItemPlacementZCm(
    { itemKey: 'tv_42', placement: { zCm: 10 } },
    { xCm: 0, yCm: 0, zCm: 0 },
    { overlayZCm: 120 },
  ).zCm, 120);

  assert.match(SCENE_SOURCE, /applyItemPlacementZCm/);
  assert.match(SCENE_SOURCE, /function withItemZ\(/);
  assert.doesNotMatch(SCENE_SOURCE, /zCm: Math\.round\(STAND_DIMENSIONS\.height \* 100\)/);
  assert.doesNotMatch(SCENE_SOURCE, /fixedElevationM/);
  assert.doesNotMatch(SCENE_SOURCE, /Kettle asla zemine oturmaz/);
  assert.doesNotMatch(MAIN_SOURCE, /zCm: 350/);
  assert.match(MAIN_SOURCE, /itemKey: moduleState\.itemKey/);
});
