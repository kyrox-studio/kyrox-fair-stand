import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GROUP_LOCKED_MESSAGE,
  GROUP_OUTSIDE_STAND_MESSAGE,
  addToGroup,
  createGroup,
  dissolveGroup,
  findGroupConflicts,
  getGroupBounds,
  getGroupMembers,
  listGroups,
  nextGroupName,
  planGroupDuplicate,
  planGroupTranslate,
  pruneGroups,
  removeFromGroup,
  renameGroup,
  setGroupLocked,
  validateModuleGroups,
} from '../src/moduleGroups.js';
import { isModuleLocked } from '../src/moduleLock.js';

const STAND = Object.freeze({ standType: 'l-left', standXCm: 600, standYCm: 400 });

function box(id, xCm, yCm, { widthCm = 100, depthCm = 50, rotationZDeg = 0, wallId = 'free' } = {}) {
  return {
    id,
    type: 'box-block',
    widthCm,
    depthCm,
    heightCm: 100,
    placement: { xCm, yCm, zCm: 0, rotationZDeg, wallId },
  };
}

function backPanel(id, xCm) {
  return {
    id,
    type: 'flat-panel',
    widthCm: 100,
    heightCm: 350,
    placement: { xCm, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  };
}

function leftPanel(id, yCm) {
  return {
    id,
    type: 'flat-panel',
    widthCm: 100,
    heightCm: 350,
    placement: { xCm: 0, yCm, zCm: 0, rotationZDeg: 90, wallId: 'left' },
  };
}

let counter = 0;
function duplicateModule(moduleState) {
  const copy = JSON.parse(JSON.stringify(moduleState));
  copy.id = `copy-${counter += 1}`;
  delete copy.locked;
  delete copy.group;
  return copy;
}

test('createGroup needs at least two modules and names groups Grup 1, Grup 2', () => {
  const modules = [box('a', 100, 100), box('b', 300, 100), box('c', 100, 250), box('d', 300, 250)];
  assert.equal(createGroup(modules, ['a']).ok, false);

  const first = createGroup(modules, ['a', 'b']);
  assert.equal(first.ok, true);
  assert.equal(first.group.name, 'Grup 1');
  assert.deepEqual(first.group.moduleIds, ['a', 'b']);
  assert.equal(nextGroupName(modules), 'Grup 2');

  const second = createGroup(modules, ['c', 'd'], { name: '  Masa   takımı ' });
  assert.equal(second.group.name, 'Masa takımı');
  assert.deepEqual(listGroups(modules).map((group) => group.moduleIds.length), [2, 2]);
});

test('grouping detaches edge-bound modules to free without moving them', () => {
  const modules = [backPanel('wall', 200), box('logo', 220, 20)];
  const before = { ...modules[0].placement };
  createGroup(modules, ['wall', 'logo']);
  assert.equal(modules[0].placement.wallId, 'free');
  assert.equal(modules[0].group.fromWallId, 'back');
  assert.deepEqual({ ...modules[0].placement, wallId: 'back' }, before);
  assert.equal(Object.hasOwn(modules[1].group, 'fromWallId'), false);
});

test('a module is in at most one group: conflicts are reported, then moved on request', () => {
  const modules = [box('a', 100, 100), box('b', 300, 100), box('c', 100, 250), box('d', 300, 250)];
  const first = createGroup(modules, ['a', 'b']).group;
  createGroup(modules, ['c', 'd']);

  const conflict = createGroup(modules, ['b', 'c']);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'conflict');
  assert.equal(conflict.conflicts.length, 2);
  assert.equal(listGroups(modules).length, 2);

  const moved = addToGroup(modules, first.id, ['c'], { moveFromOtherGroups: true });
  assert.equal(moved.ok, true);
  // The old group kept only "d" and was dissolved.
  assert.equal(listGroups(modules).length, 1);
  assert.deepEqual(getGroupMembers(modules, first.id).map((m) => m.id), ['a', 'b', 'c']);
  assert.equal(modules[3].group, undefined);
  assert.deepEqual(findGroupConflicts(modules, ['c'], first.id), []);
});

test('removing a member reattaches it to its edge and dissolves a one-member group', () => {
  const modules = [backPanel('wall', 200), box('logo', 220, 20)];
  createGroup(modules, ['wall', 'logo']);
  const result = removeFromGroup(modules, ['logo'], { stand: STAND });
  assert.equal(result.ok, true);
  assert.equal(result.dissolved.length, 1);
  assert.equal(modules[0].group, undefined);
  assert.equal(modules[0].placement.wallId, 'back');
});

test('a moved edge module stays free after the group dissolves', () => {
  const modules = [backPanel('wall', 200), box('logo', 220, 20)];
  const { group } = createGroup(modules, ['wall', 'logo']);
  const plan = planGroupTranslate(modules, group.id, 0, 100, STAND);
  plan.placements.forEach((placement, id) => { modules.find((m) => m.id === id).placement = placement; });
  dissolveGroup(modules, group.id, { stand: STAND });
  assert.equal(modules[0].placement.wallId, 'free');
  assert.equal(modules[0].placement.yCm, 100);
});

test('left edge modules reattach on the left edge', () => {
  const modules = [leftPanel('left-wall', 100), box('tv', 20, 120, { rotationZDeg: 90 })];
  const { group } = createGroup(modules, ['left-wall', 'tv']);
  dissolveGroup(modules, group.id, { stand: STAND });
  assert.equal(modules[0].placement.wallId, 'left');
});

test('group translation moves every member by the same offset regardless of type', () => {
  const modules = [backPanel('wall', 200), box('lamp', 220, 10), box('table', 250, 200)];
  const { group } = createGroup(modules, ['wall', 'lamp', 'table']);
  const plan = planGroupTranslate(modules, group.id, 50, 30, STAND);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.placements.get('wall'), { xCm: 250, yCm: 30, zCm: 0, rotationZDeg: 0, wallId: 'free' });
  assert.equal(plan.placements.get('lamp').xCm, 270);
  assert.equal(plan.placements.get('table').yCm, 230);
});

test('only constraint: no member may leave the stand; collisions are not checked', () => {
  const modules = [box('a', 100, 100), box('b', 300, 100), box('other', 410, 100)];
  const { group } = createGroup(modules, ['a', 'b']);
  // Overlapping "other" is allowed.
  assert.equal(planGroupTranslate(modules, group.id, 100, 0, STAND).ok, true);
  const outside = planGroupTranslate(modules, group.id, 250, 0, STAND);
  assert.equal(outside.ok, false);
  assert.equal(outside.message, GROUP_OUTSIDE_STAND_MESSAGE);
  assert.equal(outside.placements.size, 0);
  assert.equal(planGroupTranslate(modules, group.id, -150, 0, STAND).ok, false);
});

test('group lock locks every member and blocks edits', () => {
  const modules = [box('a', 100, 100), box('b', 300, 100), box('c', 100, 250)];
  const { group } = createGroup(modules, ['a', 'b']);
  setGroupLocked(modules, group.id, true);
  assert.equal(isModuleLocked(modules[0]), true);
  assert.equal(isModuleLocked(modules[1]), true);
  assert.equal(isModuleLocked(modules[2]), false);
  assert.equal(planGroupTranslate(modules, group.id, 10, 0, STAND).message, GROUP_LOCKED_MESSAGE);
  assert.equal(removeFromGroup(modules, ['a']).ok, false);
  assert.equal(dissolveGroup(modules, group.id).ok, false);
  assert.equal(addToGroup(modules, group.id, ['c']).ok, false);
  // Rename is still allowed on a locked group.
  assert.equal(renameGroup(modules, group.id, 'Sağ duvar').ok, true);
  assert.deepEqual(new Set(modules.slice(0, 2).map((m) => m.group.name)), new Set(['Sağ duvar']));
  setGroupLocked(modules, group.id, false);
  assert.equal(isModuleLocked(modules[0]), false);
});

test('duplicate copies every member into a new unlocked group beside the original', () => {
  const modules = [box('a', 100, 100), box('b', 210, 100, { widthCm: 50 })];
  const { group } = createGroup(modules, ['a', 'b'], { name: 'Sağ duvar' });
  setGroupLocked(modules, group.id, true);
  const result = planGroupDuplicate(modules, group.id, STAND, { duplicateModule });
  assert.equal(result.ok, true);
  assert.equal(result.group.name, 'Sağ duvar (kopya)');
  assert.notEqual(result.group.id, group.id);
  assert.equal(result.clones.length, 2);
  assert.ok(result.clones.every((clone) => clone.group.id === result.group.id && clone.group.locked === false));
  const bounds = getGroupBounds(modules);
  assert.equal(result.offset.dxCm, Math.ceil(bounds.widthCm / 10) * 10);
  assert.equal(result.clones[0].placement.xCm, 100 + result.offset.dxCm);
});

test('duplicate tries the other sides and refuses when nothing fits', () => {
  const nearRight = [box('a', 400, 100), box('b', 500, 100)];
  const { group } = createGroup(nearRight, ['a', 'b']);
  const left = planGroupDuplicate(nearRight, group.id, STAND, { duplicateModule });
  assert.equal(left.ok, true);
  assert.ok(left.offset.dxCm < 0);

  const full = [box('a', 0, 0, { widthCm: 600, depthCm: 400 }), box('b', 0, 0, { widthCm: 600, depthCm: 400 })];
  const fullGroup = createGroup(full, ['a', 'b']).group;
  const refused = planGroupDuplicate(full, fullGroup.id, STAND, { duplicateModule });
  assert.equal(refused.ok, false);
});

test('pruneGroups dissolves groups left with one member after a delete', () => {
  const modules = [box('a', 100, 100), box('b', 300, 100)];
  createGroup(modules, ['a', 'b']);
  modules.splice(1, 1);
  assert.equal(pruneGroups(modules, STAND).length, 1);
  assert.equal(modules[0].group, undefined);
});

test('validateModuleGroups accepts valid groups and rejects malformed or inconsistent ones', () => {
  const modules = [box('a', 100, 100), backPanel('b', 300)];
  createGroup(modules, ['a', 'b']);
  assert.equal(validateModuleGroups(modules).ok, true);
  assert.equal(validateModuleGroups([{ id: 'x', group: 'bad' }]).ok, false);
  assert.equal(validateModuleGroups([{ id: 'x', group: { id: 'g', name: 'G', locked: 'yes' } }]).ok, false);
  assert.equal(validateModuleGroups([{ id: 'x', group: { id: 'g', name: ' ', locked: false } }]).ok, false);
  assert.equal(validateModuleGroups([{ id: 'x', group: { id: 'g', name: 'G', locked: false, fromWallId: 'top' } }]).ok, false);
  assert.equal(validateModuleGroups([
    { id: 'x', group: { id: 'g', name: 'G', locked: false } },
    { id: 'y', group: { id: 'g', name: 'Başka', locked: false } },
  ]).ok, false);
});
