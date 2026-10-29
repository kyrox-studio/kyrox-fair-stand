import test from 'node:test';
import assert from 'node:assert/strict';

import { createModulePlacement } from '../src/modulePlacement.js';
import { resolveItemBom } from '../src/itemBom.js';
import { resolveProjectBom } from '../src/projectBom.js';
import {
  END_TO_END_JOINT_DELTAS,
} from '../src/relationshipBom.js';

function qty(bom, itemKey) {
  const line = bom.lines.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

function moduleQty(bom, moduleId, itemKey) {
  const module = bom.modules.find((entry) => entry.moduleId === moduleId);
  const line = module?.lines?.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

function wallModule(id, itemKey, { xCm = 0, yCm = 0, rotationZDeg = 0, wallId = 'back' } = {}) {
  const widthCm = Number(itemKey.match(/^wall_(\d+)_/)?.[1]);
  return {
    id,
    itemKey,
    type: 'flat-panel',
    widthCm,
    placement: createModulePlacement({ xCm, yCm, rotationZDeg, wallId }),
  };
}


test('three wall_200 chain → 2 joints', () => {
  const modules = [
    wallModule('a', 'wall_200_350', { xCm: 0, yCm: 0 }),
    wallModule('b', 'wall_200_350', { xCm: 200, yCm: 0 }),
    wallModule('c', 'wall_200_350', { xCm: 400, yCm: 0 }),
  ];
  const bom = resolveProjectBom(modules);
  assert.equal(bom.joints.length, 2);
  assert.equal(bom.appliedJointCount, 2);
  assert.equal(qty(bom, 'upright_346_5'), 4);
  assert.equal(qty(bom, 'connector_start'), 6);
  assert.equal(qty(bom, 'connector_single'), 11);
  assert.equal(qty(bom, 'connector_double'), 14);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 6);
  assert.equal(moduleQty(bom, 'a', 'connector_double'), 7);
  assert.equal(moduleQty(bom, 'b', 'connector_single'), 0);
  assert.equal(moduleQty(bom, 'b', 'connector_double'), 14);
  assert.equal(moduleQty(bom, 'c', 'connector_single'), 6);
  assert.equal(moduleQty(bom, 'c', 'connector_double'), 7);
});

test('separated walls keep naive totals (no joint)', () => {
  const itemKey = 'wall_200_350';
  const single = resolveItemBom(itemKey);
  const modules = [
    wallModule('a', itemKey, { xCm: 0, yCm: 0 }),
    wallModule('b', itemKey, { xCm: 250, yCm: 0 }),
  ];
  const bom = resolveProjectBom(modules);
  assert.equal(bom.joints.length, 0);
  assert.equal(bom.appliedJointCount, 0);
  for (const line of single) {
    assert.equal(qty(bom, line.itemKey), line.quantity * 2, line.itemKey);
  }
});

test('module order does not change joint BOM', () => {
  const forward = resolveProjectBom([
    wallModule('a', 'wall_200_350', { xCm: 0, yCm: 0 }),
    wallModule('b', 'wall_200_350', { xCm: 200, yCm: 0 }),
  ]);
  const reverse = resolveProjectBom([
    wallModule('b', 'wall_200_350', { xCm: 200, yCm: 0 }),
    wallModule('a', 'wall_200_350', { xCm: 0, yCm: 0 }),
  ]);
  assert.equal(forward.appliedJointCount, 1);
  assert.equal(reverse.appliedJointCount, 1);
  for (const itemKey of [
    'upright_346_5',
    'profile_190',
    'panel_197',
    'connector_start',
    'connector_single',
    'connector_double',
  ]) {
    assert.equal(qty(forward, itemKey), qty(reverse, itemKey), itemKey);
  }
});

test('wall_100 + wall_200 end-to-end uses same connector/upright deltas', () => {
  const modules = [
    wallModule('a', 'wall_100_350', { xCm: 0, yCm: 0 }),
    wallModule('b', 'wall_200_350', { xCm: 100, yCm: 0 }),
  ];
  const bom = resolveProjectBom(modules);
  assert.equal(bom.appliedJointCount, 1);
  assert.equal(qty(bom, 'upright_346_5'), 3);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'connector_single'), 12);
  assert.equal(qty(bom, 'connector_double'), 7);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 6);
  assert.equal(moduleQty(bom, 'a', 'connector_double'), 7);
  assert.equal(moduleQty(bom, 'b', 'connector_single'), 6);
  assert.equal(moduleQty(bom, 'b', 'connector_double'), 7);
  assert.equal(qty(bom, 'profile_91'), 2);
  assert.equal(qty(bom, 'profile_190'), 2);
  assert.equal(qty(bom, 'panel_98'), 7);
  assert.equal(qty(bom, 'panel_197'), 7);
});

test('modules without placement stay naive ×N', () => {
  const bom = resolveProjectBom([
    { id: 'a', itemKey: 'wall_200_350' },
    { id: 'b', itemKey: 'wall_200_350' },
  ]);
  assert.equal(bom.joints.length, 0);
  assert.equal(qty(bom, 'upright_346_5'), 4);
  assert.equal(qty(bom, 'connector_single'), 26);
  assert.equal(qty(bom, 'connector_double'), 0);
});

test('END_TO_END_JOINT_DELTAS match locked product example', () => {
  assert.equal(END_TO_END_JOINT_DELTAS.upright_346_5, -1);
  assert.equal(END_TO_END_JOINT_DELTAS.connector_single, -14);
  assert.equal(END_TO_END_JOINT_DELTAS.connector_double, 7);
});
