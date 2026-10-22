import test from 'node:test';
import assert from 'node:assert/strict';

import { getCatalogItem } from '../src/catalog.js';
import { createModuleStateFromDescriptor } from '../src/designState.js';
import { resolveItemBom } from '../src/itemBom.js';
import { applyItemPlacementZCm, resolveItemDefaultZCm } from '../src/items.js';
import { getModuleCollisionHeightRangeCm, requiresShortUpJointSnap } from '../src/moduleBehavior.js';
import {
  getWallOverlayZBoundsCm,
  getWallShortFloorZBoundsCm,
  placementsOverlap,
  snapPlacementToModules,
  stepWallShortFloorZCm,
  validatePlacementAgainstModules,
  WALL_OVERLAY_DEFAULT_CENTER_CM,
} from '../src/modulePlacement.js';

const STAND = Object.freeze({
  standType: 'island',
  standXCm: 800,
  standYCm: 600,
});

function moduleFrom(itemKey, id, placement) {
  // Profil kartı tek (profile_289); diğer boylar Item'dan kurulur (boy penceresinin yolu).
  const descriptor = itemKey.startsWith('profile_') ? { itemKey, type: 'profile' } : getCatalogItem(itemKey);
  const module = createModuleStateFromDescriptor(descriptor);
  module.id = id;
  module.placement = placement;
  return module;
}

function profileModule() {
  return moduleFrom('profile_190', 'profile-1', {
    xCm: 100,
    yCm: 200,
    zCm: resolveItemDefaultZCm('profile_190'),
    rotationZDeg: 0,
    wallId: 'free',
  });
}

function wallShortModule() {
  return moduleFrom('wall_100_short_1', 'wall-short-1', {
    xCm: 0,
    yCm: 0,
    zCm: resolveItemDefaultZCm('wall_100_short_1'),
    rotationZDeg: 0,
    wallId: 'free',
  });
}

function snapWallShort(profile, wall, pointerXCm, pointerYCm, rotationZDeg) {
  return snapPlacementToModules({
    moduleId: wall.id,
    moduleType: wall.type,
    itemKey: wall.itemKey,
    heightCm: wall.heightCm,
    widthCm: wall.widthCm,
    depthCm: wall.depthCm,
    pointerXCm,
    pointerYCm,
    rotationZDeg,
    modules: [profile],
    ...STAND,
  });
}

function validateMoved(wall, placement, modules, snap = null) {
  return validatePlacementAgainstModules({
    placement,
    widthCm: wall.widthCm,
    depthCm: wall.depthCm,
    moduleId: wall.id,
    moduleType: wall.type,
    itemKey: wall.itemKey,
    heightCm: wall.heightCm,
    modules,
    ...STAND,
    snapTargetModuleId: snap?.targetModuleId ?? null,
    snapKind: snap?.snapKind ?? null,
  });
}

test('wall short end-to-end snap onto a profile is not rejected as a collision', () => {
  const profile = profileModule();
  const wall = wallShortModule();
  const snap = snapWallShort(profile, wall, 100 + profile.widthCm + wall.widthCm / 2, 202, 0);
  assert.equal(snap?.snapKind, 'end-to-end');
  assert.equal(snap.targetModuleId, profile.id);
  const placement = applyItemPlacementZCm(wall, snap.placement);
  assert.equal(placement.zCm, 300);
  const validation = validateMoved(wall, placement, [profile], snap);
  assert.equal(validation.ok, true);
  assert.equal(validation.collisionModuleId, undefined);
});

test('wall short corner snap onto a profile is not rejected as a collision', () => {
  const profile = profileModule();
  const wall = wallShortModule();
  const snap = snapWallShort(profile, wall, 100 + profile.widthCm, 248, 90);
  assert.equal(snap?.snapKind, 'corner');
  assert.equal(snap.targetModuleId, profile.id);
  const placement = applyItemPlacementZCm(wall, snap.placement);
  const validation = validateMoved(wall, placement, [profile], snap);
  assert.equal(validation.ok, true);
});

test('a profile through the wall short body still collides without a snap', () => {
  const profile = profileModule();
  profile.placement = { ...profile.placement, zCm: 310 };
  const wall = wallShortModule();
  const piled = {
    xCm: profile.placement.xCm,
    yCm: profile.placement.yCm,
    zCm: 300,
    rotationZDeg: 0,
    wallId: 'free',
  };
  assert.equal(placementsOverlap({ ...wall, placement: piled }, profile), true);
  const rejected = validateMoved(wall, piled, [profile]);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.collisionModuleId, profile.id);
  const missingKind = validateMoved(wall, piled, [profile], {
    targetModuleId: profile.id,
    snapKind: null,
  });
  assert.equal(missingKind.ok, false);
});

test('snap metadata exempts only the named wall-short profile target', () => {
  const profile = profileModule();
  const wall = wallShortModule();
  const panel = moduleFrom('wall_200_350', 'panel-1', {
    xCm: profile.placement.xCm,
    yCm: profile.placement.yCm,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'free',
  });
  const piled = {
    xCm: profile.placement.xCm,
    yCm: profile.placement.yCm,
    zCm: 300,
    rotationZDeg: 0,
    wallId: 'free',
  };
  const exempt = validateMoved(wall, piled, [profile], {
    targetModuleId: profile.id,
    snapKind: 'end-to-end',
  });
  assert.equal(exempt.ok, true);
  const throughBody = { ...profile, placement: { ...profile.placement, zCm: 310 } };
  const uprightKind = validateMoved(wall, piled, [throughBody], {
    targetModuleId: profile.id,
    snapKind: 'short-up-joint',
  });
  assert.equal(uprightKind.ok, false);
  const stillHitsPanel = validateMoved(wall, piled, [profile, panel], {
    targetModuleId: profile.id,
    snapKind: 'corner',
  });
  assert.equal(stillHitsPanel.ok, false);
  assert.equal(stillHitsPanel.collisionModuleId, panel.id);
});

test('wall short still collides with another flat panel', () => {
  const wall = wallShortModule();
  const panel = moduleFrom('wall_200_350', 'panel-1', {
    xCm: 0,
    yCm: 0,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'free',
  });
  const placement = { xCm: 0, yCm: 0, zCm: 300, rotationZDeg: 0, wallId: 'free' };
  assert.equal(placementsOverlap({ ...wall, placement }, panel), true);
  const validation = validateMoved(wall, placement, [panel], {
    targetModuleId: panel.id,
    snapKind: 'end-to-end',
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.collisionModuleId, panel.id);
});

test('a profile still collides with a non-wall-short item', () => {
  const profile = profileModule();
  const panel = moduleFrom('wall_200_350', 'panel-1', {
    xCm: profile.placement.xCm,
    yCm: profile.placement.yCm,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'free',
  });
  assert.equal(placementsOverlap(profile, panel), true);
  const validation = validatePlacementAgainstModules({
    placement: profile.placement,
    widthCm: profile.widthCm,
    depthCm: profile.depthCm,
    moduleId: profile.id,
    moduleType: profile.type,
    itemKey: profile.itemKey,
    heightCm: profile.heightCm,
    modules: [panel],
    ...STAND,
    snapTargetModuleId: panel.id,
    snapKind: 'corner',
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.collisionModuleId, panel.id);
});

test('upright short-up-joint onto a wall short still snaps', () => {
  const wall = wallShortModule();
  wall.placement = { xCm: 100, yCm: 200, zCm: 300, rotationZDeg: 0, wallId: 'free' };
  const upright = createModuleStateFromDescriptor(getCatalogItem('upright_346_5'));
  upright.id = 'upright-1';
  assert.equal(requiresShortUpJointSnap(upright), true);
  const snap = snapPlacementToModules({
    moduleId: upright.id,
    moduleType: upright.type,
    itemKey: upright.itemKey,
    heightCm: upright.heightCm,
    widthCm: upright.widthCm,
    depthCm: upright.depthCm,
    pointerXCm: 100,
    pointerYCm: 200,
    rotationZDeg: 0,
    modules: [wall],
    ...STAND,
  });
  assert.equal(snap?.ok, true);
  assert.equal(snap.snapKind, 'short-up-joint');
  assert.equal(snap.targetModuleId, wall.id);
});

test('wall short vertical Z and TV overlay bounds stay unchanged', () => {
  assert.equal(stepWallShortFloorZCm(300, -50, 50, 500), 250);
  assert.equal(getWallShortFloorZBoundsCm(50, 500).minZCm, 0);
  assert.equal(getWallShortFloorZBoundsCm(50, 500).maxZCm, 450);
  assert.equal(getWallShortFloorZBoundsCm(100, 500).maxZCm, 400);
  const tv = getWallOverlayZBoundsCm(52.3, 350);
  assert.equal(tv.minZCm, 52.3 / 2 - WALL_OVERLAY_DEFAULT_CENTER_CM);
  assert.equal(tv.maxZCm, 350 - 52.3 / 2 - WALL_OVERLAY_DEFAULT_CENTER_CM);
});

function wallShortRailModule(itemKey = 'wall_200_short_2') {
  return moduleFrom(itemKey, 'wall-short-rail', {
    xCm: 100,
    yCm: 200,
    zCm: resolveItemDefaultZCm(itemKey),
    rotationZDeg: 0,
    wallId: 'free',
  });
}

function profileRail(id, zCm) {
  return moduleFrom('profile_190', id, {
    xCm: 100,
    yCm: 200,
    zCm,
    rotationZDeg: 0,
    wallId: 'free',
  });
}

function railHeights(wall) {
  const probe = profileRail('probe', 0);
  const wallRange = getModuleCollisionHeightRangeCm(wall);
  const profileHeightCm = getModuleCollisionHeightRangeCm(probe).maxCm
    - getModuleCollisionHeightRangeCm(probe).minCm;
  return {
    bottomZCm: wallRange.minCm,
    topZCm: wallRange.maxCm - profileHeightCm,
    middleZCm: wallRange.minCm + (wallRange.maxCm - wallRange.minCm - profileHeightCm) / 2,
  };
}

test('wall short accepts a profile on its lower connection line', () => {
  const wall = wallShortRailModule();
  const { bottomZCm } = railHeights(wall);
  const lower = profileRail('profile-lower', bottomZCm);
  const placement = wall.placement;
  assert.equal(getModuleCollisionHeightRangeCm(wall).maxCm - getModuleCollisionHeightRangeCm(wall).minCm, 100);
  assert.equal(placementsOverlap({ ...wall, placement }, lower), true);
  const validation = validateMoved(wall, placement, [lower], {
    targetModuleId: lower.id,
    snapKind: 'end-to-end',
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.collisionModuleId, undefined);
});

test('wall short accepts a profile on its upper connection line', () => {
  const wall = wallShortRailModule();
  const { topZCm } = railHeights(wall);
  const upper = profileRail('profile-upper', topZCm);
  const placement = wall.placement;
  assert.equal(placementsOverlap({ ...wall, placement }, upper), true);
  const validation = validateMoved(wall, placement, [upper], {
    targetModuleId: upper.id,
    snapKind: 'end-to-end',
  });
  assert.equal(validation.ok, true);
});

test('wall short exempts both lower and upper profile rails from one snap target', () => {
  const wall = wallShortRailModule();
  const { bottomZCm, topZCm } = railHeights(wall);
  const lower = profileRail('profile-lower', bottomZCm);
  const upper = profileRail('profile-upper', topZCm);
  const placement = wall.placement;
  assert.equal(placementsOverlap({ ...wall, placement }, lower), true);
  assert.equal(placementsOverlap({ ...wall, placement }, upper), true);
  const validation = validateMoved(wall, placement, [lower, upper], {
    targetModuleId: lower.id,
    snapKind: 'corner',
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.collisionModuleId, undefined);
});

test('a third profile through the wall short body still collides', () => {
  const wall = wallShortRailModule();
  const { bottomZCm, topZCm, middleZCm } = railHeights(wall);
  const lower = profileRail('profile-lower', bottomZCm);
  const upper = profileRail('profile-upper', topZCm);
  const middle = profileRail('profile-middle', middleZCm);
  const placement = wall.placement;
  assert.equal(placementsOverlap({ ...wall, placement }, middle), true);
  const validation = validateMoved(wall, placement, [lower, upper, middle], {
    targetModuleId: lower.id,
    snapKind: 'end-to-end',
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.message, 'Başka bir modülle çakışıyor.');
  assert.equal(validation.collisionModuleId, middle.id);
});

test('drag onto profile rails does not collide', () => {
  const wall = wallShortRailModule('wall_200_short_2');
  const { bottomZCm, topZCm } = railHeights(wall);
  const lower = profileRail('profile-lower', bottomZCm);
  const upper = profileFamilyModule('profile-346-5-scene', {
    widthCm: 350,
    xCm: wall.placement.xCm,
    yCm: wall.placement.yCm,
    zCm: topZCm,
  });
  const placement = wall.placement;
  assert.equal(placementsOverlap({ ...wall, placement }, lower), true);
  assert.equal(placementsOverlap({ ...wall, placement }, upper), true);
  const validation = validateMoved(wall, placement, [lower, upper]);
  assert.equal(validation.ok, true);
  assert.equal(validation.collisionModuleId, undefined);
});

function profileFamilyModule(id, { widthCm, xCm, yCm, zCm }) {
  return {
    id,
    type: 'profile',
    itemKey: null,
    widthCm,
    depthCm: 10,
    heightCm: 8,
    placement: {
      xCm,
      yCm,
      zCm,
      rotationZDeg: 0,
      wallId: 'free',
    },
  };
}

function snapWallShortTo(wall, modules, pointerXCm, pointerYCm) {
  return snapPlacementToModules({
    moduleId: wall.id,
    moduleType: wall.type,
    itemKey: wall.itemKey,
    heightCm: wall.heightCm,
    widthCm: wall.widthCm,
    depthCm: wall.depthCm,
    pointerXCm,
    pointerYCm,
    rotationZDeg: 0,
    modules,
    ...STAND,
  });
}

test('wall short snaps onto the body of any profile-type rail', () => {
  const wall = wallShortRailModule('wall_200_short_2');
  const rails = [
    profileFamilyModule('profile-346-5-scene', { widthCm: 350, xCm: 100, yCm: 200, zCm: 342 }),
    profileFamilyModule('profile-other', { widthCm: 100, xCm: 80, yCm: 400, zCm: 342 }),
  ];
  for (const profile of rails) {
    const snap = snapWallShortTo(
      wall,
      [profile],
      profile.placement.xCm + profile.widthCm / 2,
      profile.placement.yCm,
    );
    assert.equal(snap?.ok, true);
    assert.equal(snap.snapKind, 'face');
    assert.equal(snap.targetModuleId, profile.id);
    assert.equal(snap.placement.yCm, profile.placement.yCm);
    const placement = applyItemPlacementZCm(wall, snap.placement);
    assert.equal(placement.zCm, 250);
    const validation = validateMoved(wall, placement, [profile], snap);
    assert.equal(validation.ok, true);
  }
});

test('wall short profile-family snap still rejects a profile through the body', () => {
  const wall = wallShortRailModule('wall_200_short_2');
  const rail = profileFamilyModule('profile-rail', { widthCm: 350, xCm: 100, yCm: 200, zCm: 342 });
  const middle = profileFamilyModule('profile-middle', { widthCm: 350, xCm: 100, yCm: 200, zCm: 296 });
  const snap = snapWallShortTo(wall, [rail, middle], 275, 200);
  assert.equal(snap, null);
  const piled = {
    xCm: rail.placement.xCm,
    yCm: rail.placement.yCm,
    zCm: wall.placement.zCm,
    rotationZDeg: 0,
    wallId: 'free',
  };
  const validation = validateMoved(wall, piled, [middle, rail]);
  assert.equal(validation.ok, false);
  assert.equal(validation.collisionModuleId, middle.id);
});

test('wall short body snap does not treat an upright as a profile', () => {
  const wall = wallShortRailModule('wall_200_short_2');
  const upright = createModuleStateFromDescriptor(getCatalogItem('upright_346_5'));
  upright.id = 'upright-body';
  upright.placement = { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  const snap = snapWallShortTo(wall, [upright], 104, 200);
  assert.notEqual(snap?.snapKind, 'face');
});

test('wall short profile snap does not change the wall short BOM', () => {
  const before = resolveItemBom('wall_100_short_1').map((line) => [line.itemKey, line.quantity]);
  const profile = profileModule();
  const wall = wallShortModule();
  const snap = snapWallShort(profile, wall, 100 + profile.widthCm + wall.widthCm / 2, 202, 0);
  assert.equal(snap?.snapKind, 'end-to-end');
  const after = resolveItemBom('wall_100_short_1').map((line) => [line.itemKey, line.quantity]);
  assert.deepEqual(after, before);
  assert.deepEqual(before, [
    ['profile_91', 2],
    ['upright_49_5', 2],
    ['panel_98', 1],
    ['connector_start', 2],
    ['connector_single', 3],
  ]);
});
