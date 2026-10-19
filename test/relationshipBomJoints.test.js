import test from 'node:test';
import assert from 'node:assert/strict';

import { createFlatPanelModuleState } from '../src/designState.js';
import { createModulePlacement } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { detectRelationshipJoints } from '../src/relationshipBom.js';

function qty(bom, itemKey) {
  const line = bom.lines.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

function moduleQty(bom, moduleId, itemKey) {
  const module = bom.modules.find((entry) => entry.moduleId === moduleId);
  const line = module?.lines?.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

function placed(id, itemKey, { xCm = 0, yCm = 0, rotationZDeg = 0, widthCm }) {
  return {
    id,
    itemKey,
    widthCm,
    placement: createModulePlacement({ xCm, yCm, rotationZDeg }),
  };
}

function cornerPair(id, itemKey, widthCm, { xCm, yCm }) {
  // 270 keeps the front face toward the other wall. 90 puts this module on the back.
  return placed(id, itemKey, { xCm, yCm, rotationZDeg: 270, widthCm });
}

test('wall + door end-to-end → 3 upright, 4 start, 8 single, 3 double', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    placed('b', 'wall_door_100_350', { xCm: 200, widthCm: 100 }),
  ]);
  assert.equal(bom.appliedEndToEndCount, 1);
  assert.equal(bom.appliedCornerCount, 0);
  assert.equal(qty(bom, 'upright_346_5'), 3);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'connector_single'), 8);
  assert.equal(qty(bom, 'connector_double'), 3);
  assert.equal(qty(bom, 'connector_corner'), 0);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 6);
  assert.equal(moduleQty(bom, 'a', 'connector_double'), 3);
  assert.equal(moduleQty(bom, 'b', 'connector_single'), 2);
  assert.equal(moduleQty(bom, 'b', 'connector_double'), 3);
  assert.equal(qty(bom, 'panel_197'), 7);
  assert.equal(qty(bom, 'panel_98'), 3);
  assert.equal(qty(bom, 'door_leaf_100'), 1);
});

test('wall + separator 50 and 100 end-to-end keep 6+6 singles and 7 doubles', () => {
  const sep50 = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    placed('b', 'wall_separator_50_350', { xCm: 200, widthCm: 50 }),
  ]);
  assert.equal(qty(sep50, 'upright_346_5'), 3);
  assert.equal(qty(sep50, 'connector_start'), 4);
  assert.equal(qty(sep50, 'connector_single'), 12);
  assert.equal(qty(sep50, 'connector_double'), 7);
  assert.equal(qty(sep50, 'panel_197'), 7);
  assert.equal(qty(sep50, 'separator_panel_48_5'), 7);
  assert.equal(qty(sep50, 'separator_panel_98'), 0);

  const sep100 = resolveProjectBom([
    placed('a', 'wall_100_350', { xCm: 0, widthCm: 100 }),
    placed('b', 'wall_separator_100_350', { xCm: 100, widthCm: 100 }),
  ]);
  assert.equal(qty(sep100, 'connector_single'), 12);
  assert.equal(qty(sep100, 'connector_double'), 7);
  assert.equal(qty(sep100, 'upright_346_5'), 3);
  assert.equal(qty(sep100, 'separator_panel_98'), 7);
  assert.equal(qty(sep100, 'panel_98'), 7);
});

test('sarmasik separator end-to-end matches the plain separator of the same width', () => {
  const plain = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    placed('b', 'wall_separator_50_350', { xCm: 200, widthCm: 50 }),
  ]);
  const ivy = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    placed('b', 'wall_separator_50_350_sarmasik', { xCm: 200, widthCm: 50 }),
  ]);
  for (const itemKey of ['upright_346_5', 'connector_start', 'connector_single', 'connector_double', 'connector_corner', 'separator_panel_48_5', 'separator_panel_98']) {
    assert.equal(qty(ivy, itemKey), qty(plain, itemKey), itemKey);
  }
  assert.equal(qty(ivy, 'separator_panel_48_5'), 7);
  assert.equal(qty(ivy, 'separator_panel_98'), 0);
});

test('wall + showcase end-to-end uses the locked single and double counts', () => {
  const showcase3 = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    placed('b', 'wall_showcase_100_3_350', { xCm: 200, widthCm: 100 }),
  ]);
  assert.equal(qty(showcase3, 'upright_346_5'), 3);
  assert.equal(qty(showcase3, 'connector_start'), 6);
  assert.equal(qty(showcase3, 'connector_single'), 12);
  assert.equal(qty(showcase3, 'connector_double'), 4);
  assert.equal(qty(showcase3, 'panel_197'), 7);
  assert.equal(qty(showcase3, 'panel_98'), 4);
  assert.equal(qty(showcase3, 'glass_shelf'), 2);

  const showcase2 = resolveProjectBom([
    placed('a', 'wall_50_350', { xCm: 0, widthCm: 50 }),
    placed('b', 'wall_showcase_100_2_350', { xCm: 50, widthCm: 100 }),
  ]);
  assert.equal(qty(showcase2, 'upright_346_5'), 3);
  assert.equal(qty(showcase2, 'connector_start'), 6);
  assert.equal(qty(showcase2, 'connector_single'), 12);
  assert.equal(qty(showcase2, 'connector_double'), 5);
  assert.equal(qty(showcase2, 'panel_48_5'), 7);
  assert.equal(qty(showcase2, 'panel_98'), 5);
  assert.equal(qty(showcase2, 'glass_shelf'), 1);
});

test('a module on the back face takes no corner connectors: 20 single, 6 corner', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_100_350', { xCm: 0, widthCm: 100 }),
    placed('b', 'wall_100_350', { xCm: 100, yCm: 0, rotationZDeg: 90, widthCm: 100 }),
  ]);
  assert.equal(bom.appliedCornerCount, 1);
  assert.equal(qty(bom, 'upright_346_5'), 3);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'connector_single'), 20);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_corner'), 6);
  assert.equal(qty(bom, 'panel_corner_92'), 7);
  assert.equal(qty(bom, 'panel_98'), 7);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 7);
  assert.equal(moduleQty(bom, 'a', 'connector_corner'), 6);
  assert.equal(moduleQty(bom, 'a', 'panel_corner_92'), 7);
  assert.equal(moduleQty(bom, 'b', 'connector_single'), 13);
  assert.equal(moduleQty(bom, 'b', 'connector_corner'), 0);
  assert.equal(moduleQty(bom, 'b', 'panel_98'), 7);
});

test('two walls inner corner → 3 upright, 14 single, 12 corner, corner panels', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    cornerPair('b', 'wall_150_350', 150, { xCm: 200, yCm: 0 }),
  ]);
  assert.equal(bom.joints.length, 1);
  assert.equal(bom.joints[0].kind, 'corner');
  assert.equal(bom.appliedCornerCount, 1);
  assert.equal(qty(bom, 'upright_346_5'), 3);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'connector_single'), 14);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_corner'), 12);
  assert.equal(qty(bom, 'panel_corner_192'), 7);
  assert.equal(qty(bom, 'panel_corner_142_5'), 7);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 7);
  assert.equal(moduleQty(bom, 'a', 'connector_corner'), 6);
  assert.equal(moduleQty(bom, 'b', 'connector_single'), 7);
  assert.equal(moduleQty(bom, 'b', 'connector_corner'), 6);
  assert.equal(qty(bom, 'panel_197'), 0);
  assert.equal(qty(bom, 'panel_147_5'), 0);
  assert.equal(qty(bom, 'profile_190'), 2);
  assert.equal(qty(bom, 'profile_140_5'), 2);
});

test('wall + door inner corner converts both panel families and adds 8 corner connectors', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    cornerPair('b', 'wall_door_100_350', 100, { xCm: 200, yCm: 0 }),
  ]);
  assert.equal(qty(bom, 'upright_346_5'), 3);
  assert.equal(qty(bom, 'profile_190'), 2);
  assert.equal(qty(bom, 'profile_91'), 1);
  assert.equal(qty(bom, 'panel_corner_192'), 7);
  assert.equal(qty(bom, 'panel_corner_92'), 3);
  assert.equal(qty(bom, 'panel_98'), 0);
  assert.equal(qty(bom, 'door_leaf_100'), 1);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'connector_single'), 10);
  assert.equal(qty(bom, 'connector_corner'), 8);
  assert.equal(qty(bom, 'connector_double'), 0);
});

test('separator inner corner matches wall hardware and keeps separator panels', () => {
  const sep50 = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    cornerPair('b', 'wall_separator_50_350', 50, { xCm: 200, yCm: 0 }),
  ]);
  assert.equal(qty(sep50, 'upright_346_5'), 3);
  assert.equal(qty(sep50, 'connector_start'), 4);
  assert.equal(qty(sep50, 'connector_single'), 14);
  assert.equal(qty(sep50, 'connector_corner'), 12);
  assert.equal(qty(sep50, 'connector_double'), 0);
  assert.equal(qty(sep50, 'profile_190'), 2);
  assert.equal(qty(sep50, 'profile_41_5'), 2);
  assert.equal(qty(sep50, 'panel_corner_192'), 7);
  assert.equal(qty(sep50, 'separator_panel_48_5'), 7);
  assert.equal(qty(sep50, 'separator_panel_98'), 0);
  assert.equal(qty(sep50, 'panel_corner_42_5'), 0);

  const sep100 = resolveProjectBom([
    placed('a', 'wall_50_350', { xCm: 0, widthCm: 50 }),
    cornerPair('b', 'wall_separator_100_350', 100, { xCm: 50, yCm: 0 }),
  ]);
  assert.equal(qty(sep100, 'connector_single'), 14);
  assert.equal(qty(sep100, 'connector_corner'), 12);
  assert.equal(qty(sep100, 'panel_corner_42_5'), 7);
  assert.equal(qty(sep100, 'separator_panel_98'), 7);
  assert.equal(qty(sep100, 'profile_41_5'), 2);
  assert.equal(qty(sep100, 'profile_91'), 2);

  const ivy = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    cornerPair('b', 'wall_separator_100_350_sarmasik', 100, { xCm: 200, yCm: 0 }),
  ]);
  assert.equal(qty(ivy, 'connector_single'), 14);
  assert.equal(qty(ivy, 'connector_corner'), 12);
  assert.equal(qty(ivy, 'separator_panel_98'), 7);
  assert.equal(qty(ivy, 'panel_corner_92'), 0);

  const ivy50 = resolveProjectBom([
    placed('a', 'wall_50_350', { xCm: 0, widthCm: 50 }),
    cornerPair('b', 'wall_separator_50_350_sarmasik', 50, { xCm: 50, yCm: 0 }),
  ]);
  assert.equal(qty(ivy50, 'separator_panel_48_5'), 7);
  assert.equal(qty(ivy50, 'separator_panel_98'), 0);
  assert.equal(qty(ivy50, 'panel_corner_42_5'), 7);
  assert.equal(qty(ivy50, 'connector_corner'), 12);
  assert.equal(qty(ivy50, 'connector_single'), 14);
});

test('showcase inner corner keeps wall width on profiles and showcase panels become corner panels', () => {
  const showcase3 = resolveProjectBom([
    placed('a', 'wall_100_350', { xCm: 0, widthCm: 100 }),
    cornerPair('b', 'wall_showcase_100_3_350', 100, { xCm: 100, yCm: 0 }),
  ]);
  assert.equal(qty(showcase3, 'upright_346_5'), 3);
  assert.equal(qty(showcase3, 'profile_91'), 6);
  assert.equal(qty(showcase3, 'panel_corner_92'), 11);
  assert.equal(qty(showcase3, 'panel_98'), 0);
  assert.equal(qty(showcase3, 'showcase_side_143_5_30'), 2);
  assert.equal(qty(showcase3, 'glass_shelf'), 2);
  assert.equal(qty(showcase3, 'connector_start'), 6);
  assert.equal(qty(showcase3, 'connector_single'), 11);
  assert.equal(qty(showcase3, 'connector_corner'), 9);
  assert.equal(qty(showcase3, 'connector_double'), 0);

  const showcase2 = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    cornerPair('b', 'wall_showcase_100_2_350', 100, { xCm: 200, yCm: 0 }),
  ]);
  assert.equal(qty(showcase2, 'profile_190'), 2);
  assert.equal(qty(showcase2, 'profile_91'), 4);
  assert.equal(qty(showcase2, 'panel_corner_192'), 7);
  assert.equal(qty(showcase2, 'panel_corner_92'), 5);
  assert.equal(qty(showcase2, 'glass_shelf'), 1);
  assert.equal(qty(showcase2, 'connector_single'), 12);
  assert.equal(qty(showcase2, 'connector_corner'), 10);
  assert.equal(qty(showcase2, 'connector_start'), 6);
});

test('glass strips on an inner-corner wall become panel_corner_cam', () => {
  const wall = createFlatPanelModuleState({ itemKey: 'wall_200_350' });
  wall.id = 'a';
  wall.widthCm = 200;
  wall.placement = createModulePlacement({ xCm: 0, yCm: 0, rotationZDeg: 0 });
  for (let index = 0; index < 4; index += 1) wall.strips[index].isGlass = true;

  const bom = resolveProjectBom([
    wall,
    cornerPair('b', 'wall_200_350', 200, { xCm: 200, yCm: 0 }),
  ]);
  assert.equal(qty(bom, 'panel_corner_192'), 10);
  assert.equal(qty(bom, 'panel_corner_cam_192'), 4);
  assert.equal(qty(bom, 'panel_197'), 0);
  assert.equal(qty(bom, 'panel_cam_197'), 0);
  assert.ok(bom.relationshipNotes.some((note) => note.includes('panel_corner_192 × 4 → panel_corner_cam_192')));
});

test('a tee into the middle of a wall shares one upright and does not add doubles', () => {
  const modules = [
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    cornerPair('b', 'wall_100_350', 100, { xCm: 100, yCm: 0 }),
  ];
  const joints = detectRelationshipJoints(modules);
  assert.equal(joints.length, 1);
  assert.equal(joints[0].kind, 'tee');
  const bom = resolveProjectBom(modules);
  assert.equal(bom.appliedTeeCount, 1);
  assert.equal(qty(bom, 'upright_346_5'), 3);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_corner'), 6);
  assert.equal(qty(bom, 'panel_197'), 7);
  assert.equal(qty(bom, 'panel_corner_92'), 7);
});

test('two collinear walls with a branch at the joint are one tee: 4 uprights, no doubles', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_200_350', { xCm: 0, widthCm: 200 }),
    placed('b', 'wall_200_350', { xCm: 200, widthCm: 200 }),
    cornerPair('c', 'wall_showcase_100_2_350', 100, { xCm: 200, yCm: 0 }),
  ]);
  assert.equal(bom.joints.length, 1);
  assert.equal(bom.joints[0].kind, 'tee');
  assert.equal(qty(bom, 'upright_346_5'), 4);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_corner'), 16);
  assert.equal(qty(bom, 'connector_start'), 8);
});

test('separator, door, and showcase pairs share one upright on end, corner, and tee', () => {
  const end = (left, leftWidth, right, rightWidth) => resolveProjectBom([
    placed('a', left, { xCm: 0, widthCm: leftWidth }),
    placed('b', right, { xCm: leftWidth, widthCm: rightWidth }),
  ]);
  const corner = (left, leftWidth, right, rightWidth) => resolveProjectBom([
    placed('a', left, { xCm: 0, widthCm: leftWidth }),
    cornerPair('b', right, rightWidth, { xCm: leftWidth, yCm: 0 }),
  ]);

  const sep50 = end('wall_separator_50_350', 50, 'wall_separator_50_350', 50);
  assert.equal(sep50.appliedEndToEndCount, 1);
  assert.equal(qty(sep50, 'upright_346_5'), 3);
  assert.equal(qty(sep50, 'connector_single'), 12);
  assert.equal(qty(sep50, 'connector_double'), 7);
  assert.equal(qty(sep50, 'connector_corner'), 0);
  assert.equal(qty(sep50, 'separator_panel_48_5'), 14);

  const sepMix = end('wall_separator_50_350', 50, 'wall_separator_100_350_sarmasik', 100);
  assert.equal(qty(sepMix, 'upright_346_5'), 3);
  assert.equal(qty(sepMix, 'connector_single'), 12);
  assert.equal(qty(sepMix, 'connector_double'), 7);
  assert.equal(qty(sepMix, 'separator_panel_48_5'), 7);
  assert.equal(qty(sepMix, 'separator_panel_98'), 7);

  const sepDoor = end('wall_separator_100_350', 100, 'wall_door_100_350', 100);
  assert.equal(qty(sepDoor, 'upright_346_5'), 3);
  assert.equal(qty(sepDoor, 'connector_single'), 8);
  assert.equal(qty(sepDoor, 'connector_double'), 3);
  assert.equal(qty(sepDoor, 'panel_98'), 3);
  assert.equal(qty(sepDoor, 'separator_panel_98'), 7);

  const sepShow2 = end('wall_separator_50_350', 50, 'wall_showcase_100_2_350', 100);
  assert.equal(qty(sepShow2, 'upright_346_5'), 3);
  // 0071: 50’lik ayırıcı 13 tekli; 100’lük ayırıcı + 2 gözlü vitrin ile aynı (8 + 4).
  assert.equal(qty(sepShow2, 'connector_single'), 12);
  assert.equal(qty(sepShow2, 'connector_double'), 5);

  const sepShow3 = end('wall_separator_100_350', 100, 'wall_showcase_100_3_350', 100);
  assert.equal(qty(sepShow3, 'upright_346_5'), 3);
  assert.equal(qty(sepShow3, 'connector_single'), 12);
  assert.equal(qty(sepShow3, 'connector_double'), 4);

  const doors = end('wall_door_100_350', 100, 'wall_door_100_350', 100);
  assert.equal(doors.appliedEndToEndCount, 1);
  assert.equal(qty(doors, 'upright_346_5'), 3);
  assert.equal(qty(doors, 'connector_single'), 4);
  assert.equal(qty(doors, 'connector_double'), 3);
  assert.equal(qty(doors, 'panel_98'), 6);
  assert.equal(qty(doors, 'door_leaf_100'), 2);

  const doorShow2 = end('wall_door_100_350', 100, 'wall_showcase_100_2_350', 100);
  assert.equal(qty(doorShow2, 'upright_346_5'), 3);
  assert.equal(qty(doorShow2, 'connector_single'), 6);
  assert.equal(qty(doorShow2, 'connector_double'), 3);

  const doorShow3 = end('wall_door_100_350', 100, 'wall_showcase_100_3_350', 100);
  assert.equal(qty(doorShow3, 'upright_346_5'), 3);
  assert.equal(qty(doorShow3, 'connector_single'), 5);
  assert.equal(qty(doorShow3, 'connector_double'), 3);

  const show22 = end('wall_showcase_100_2_350', 100, 'wall_showcase_100_2_350', 100);
  assert.equal(qty(show22, 'upright_346_5'), 3);
  assert.equal(qty(show22, 'connector_single'), 8);
  assert.equal(qty(show22, 'connector_double'), 5);

  const show23 = end('wall_showcase_100_2_350', 100, 'wall_showcase_100_3_350', 100);
  assert.equal(qty(show23, 'upright_346_5'), 3);
  assert.equal(qty(show23, 'connector_single'), 8);
  assert.equal(qty(show23, 'connector_double'), 4);

  const show33 = end('wall_showcase_100_3_350', 100, 'wall_showcase_100_3_350', 100);
  assert.equal(qty(show33, 'upright_346_5'), 3);
  assert.equal(qty(show33, 'connector_single'), 6);
  assert.equal(qty(show33, 'connector_double'), 4);

  const sepCorner = corner('wall_separator_50_350', 50, 'wall_separator_100_350', 100);
  assert.equal(sepCorner.appliedCornerCount, 1);
  assert.equal(qty(sepCorner, 'upright_346_5'), 3);
  assert.equal(qty(sepCorner, 'connector_single'), 14);
  assert.equal(qty(sepCorner, 'connector_double'), 0);
  assert.equal(qty(sepCorner, 'connector_corner'), 12);
  assert.equal(qty(sepCorner, 'separator_panel_48_5'), 7);
  assert.equal(qty(sepCorner, 'separator_panel_98'), 7);
  assert.equal(qty(sepCorner, 'panel_corner_42_5'), 0);
  assert.equal(qty(sepCorner, 'panel_corner_92'), 0);

  const doorCorner = corner('wall_door_100_350', 100, 'wall_door_100_350', 100);
  assert.equal(qty(doorCorner, 'upright_346_5'), 3);
  assert.equal(qty(doorCorner, 'connector_single'), 6);
  assert.equal(qty(doorCorner, 'connector_corner'), 4);
  assert.equal(qty(doorCorner, 'panel_98'), 0);
  assert.equal(qty(doorCorner, 'panel_corner_92'), 6);

  const showCorner = corner('wall_showcase_100_2_350', 100, 'wall_showcase_100_3_350', 100);
  assert.equal(qty(showCorner, 'upright_346_5'), 3);
  assert.equal(qty(showCorner, 'connector_single'), 9);
  assert.equal(qty(showCorner, 'connector_corner'), 7);
  assert.equal(qty(showCorner, 'panel_98'), 0);
  assert.equal(qty(showCorner, 'panel_corner_92'), 9);

  const doorShowCorner = corner('wall_separator_100_350', 100, 'wall_door_100_350', 100);
  assert.equal(qty(doorShowCorner, 'upright_346_5'), 3);
  assert.equal(qty(doorShowCorner, 'connector_single'), 10);
  assert.equal(qty(doorShowCorner, 'connector_corner'), 8);
  assert.equal(qty(doorShowCorner, 'separator_panel_98'), 7);
  assert.equal(qty(doorShowCorner, 'panel_corner_92'), 3);
  assert.equal(qty(doorShowCorner, 'panel_98'), 0);

  const tee = resolveProjectBom([
    placed('a', 'wall_separator_100_350', { xCm: 0, widthCm: 100 }),
    placed('b', 'wall_separator_100_350', { xCm: 100, widthCm: 100 }),
    cornerPair('c', 'wall_door_100_350', 100, { xCm: 100, yCm: 0 }),
  ]);
  assert.equal(tee.joints.length, 1);
  assert.equal(tee.joints[0].kind, 'tee');
  assert.equal(qty(tee, 'upright_346_5'), 4);
  assert.equal(qty(tee, 'connector_double'), 0);
  assert.equal(qty(tee, 'connector_corner'), 14);
  assert.equal(qty(tee, 'connector_single'), 17);
  assert.equal(qty(tee, 'separator_panel_98'), 14);
  assert.equal(qty(tee, 'panel_corner_92'), 3);

  const branch = resolveProjectBom([
    placed('host', 'wall_showcase_100_2_350', { xCm: 0, widthCm: 100 }),
    cornerPair('branch', 'wall_separator_50_350', 50, { xCm: 50, yCm: 0 }),
  ]);
  assert.equal(branch.joints[0].kind, 'tee');
  assert.equal(qty(branch, 'upright_346_5'), 3);
  assert.equal(qty(branch, 'connector_double'), 0);
  assert.equal(qty(branch, 'connector_corner'), 6);
  assert.equal(qty(branch, 'connector_single'), 16);
  assert.equal(qty(branch, 'panel_98'), 5);
  assert.equal(qty(branch, 'separator_panel_48_5'), 7);
});
