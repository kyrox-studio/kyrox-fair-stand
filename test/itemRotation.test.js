import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MODULE_STATE_TYPES } from '../src/designState.js';
import { listRegisteredItems } from '../src/items.js';
import {
  getModuleDefaultRotationDeg,
  getModuleRotationStepDeg,
  resolveSideInsertRotationDeg,
} from '../src/moduleBehavior.js';
import { rotationFieldsForItem } from './itemRotationSeed.mjs';

test('placeable Items expose rotation from Item; leaf rows omit the trio', () => {
  let filled = 0;
  let empty = 0;
  for (const item of listRegisteredItems()) {
    const expected = rotationFieldsForItem(item.itemKey, item.type);
    if (expected) {
      filled += 1;
      assert.equal(item.rotationStepDeg, expected.rotationStepDeg, item.itemKey);
      assert.equal(item.defaultRotationDeg, expected.defaultRotationDeg, item.itemKey);
      assert.equal(item.sideInsertRotation, expected.sideInsertRotation, item.itemKey);
      assert.equal(getModuleRotationStepDeg(item), expected.rotationStepDeg, item.itemKey);
      assert.equal(getModuleDefaultRotationDeg(item), expected.defaultRotationDeg, item.itemKey);
    } else {
      empty += 1;
      assert.equal(Object.hasOwn(item, 'rotationStepDeg'), false, item.itemKey);
      assert.equal(Object.hasOwn(item, 'defaultRotationDeg'), false, item.itemKey);
      assert.equal(Object.hasOwn(item, 'sideInsertRotation'), false, item.itemKey);
      assert.throws(() => getModuleRotationStepDeg(item), TypeError);
    }
  }
  assert.equal(filled, 80);
  assert.equal(empty, 44);
});

test('rotation getters require itemKey and do not fall back to type tables', () => {
  assert.throws(() => getModuleRotationStepDeg({ type: 'counter', widthCm: 150 }), TypeError);
  assert.throws(() => getModuleDefaultRotationDeg('bar-stool'), TypeError);
  assert.equal(resolveSideInsertRotationDeg({ itemKey: 'furniture_bar_stool_classic' }, 90), 270);
  assert.equal(resolveSideInsertRotationDeg({ itemKey: 'wall_200_350' }, 45), 45);
});

test('TYPE_BEHAVIORS no longer owns rotation fields', () => {
  const source = readFileSync(new URL('../src/moduleBehavior.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /rotationStepDeg: 45/);
  assert.doesNotMatch(source, /STRAIGHT_COUNTER_WIDTHS_CM/);
  assert.match(source, /Module rotation requires itemKey/);
  assert.ok(MODULE_STATE_TYPES.includes('counter'));
});
