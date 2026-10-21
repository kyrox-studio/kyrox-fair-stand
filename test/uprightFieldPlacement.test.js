import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCatalogItem,
  listCatalogItems,
  listCatalogGroups,
} from '../src/catalog.js';
import { createModuleStateFromDescriptor } from '../src/designState.js';
import { resolveItemBom } from '../src/itemBom.js';
import { isWallShortFamilyDescriptor, getItem, resolveSceneDimensions } from '../src/items.js';
import { getModuleMagneticSnapStrategy, requiresShortUpJointSnap } from '../src/moduleBehavior.js';
import { resolveModuleContract } from '../src/moduleContracts.js';
import { snapPlacementToModules } from '../src/modulePlacement.js';
import {
  getExpandedStraightWallRecipe,
} from './recipeParentItemKey.js';

const WALL_SHORT_KEYS = [
  'wall_200_short_2',
  'wall_150_short_2',
  'wall_100_short_2',
  'wall_50_short_2',
  'wall_200_short_1',
  'wall_150_short_1',
  'wall_100_short_1',
  'wall_50_short_1',
];

test('Panel Ek Modül holds wall-short family and field upright_346_5', () => {
  const panelWall = listCatalogGroups().find((group) => group.label === 'Panel & Duvar');
  const extraPanel = listCatalogGroups().find((group) => group.label === 'Panel Ek Modül');
  assert.ok(panelWall);
  assert.ok(extraPanel);
  assert.deepEqual(extraPanel.keys, [...WALL_SHORT_KEYS, 'upright_346_5', 'profile_190', 'profile_140_5', 'profile_91', 'profile_41_5', 'box_block']);
  for (const key of WALL_SHORT_KEYS) {
    assert.equal(panelWall.keys.includes(key), false);
    assert.equal(getCatalogItem(key) != null, true);
  }
  assert.equal(panelWall.keys.includes('wall_200_350'), true);
  assert.equal(panelWall.keys.includes('upright_346_5'), false);
});

test('field upright_346_5 is self BOM ×1 and does not change parent wall recipe ×2', () => {
  assert.equal(getCatalogItem('upright_346_5').itemKey, 'upright_346_5');
  assert.equal(getItem('upright_346_5').type, 'upright');
  const uprightScene = resolveSceneDimensions(getItem('upright_346_5'));
  assert.equal(uprightScene.widthCm, 8);
  assert.equal(uprightScene.depthCm, 8);
  assert.equal(uprightScene.heightCm, 346.5);
  assert.equal(resolveModuleContract('upright_346_5').bom.mode, 'self');
  const bom = resolveItemBom('upright_346_5');
  assert.equal(bom.length, 1);
  assert.equal(bom[0].itemKey, 'upright_346_5');
  assert.equal(bom[0].quantity, 1);
  assert.equal(bom[0].unit, 'adet');
  const parent = getExpandedStraightWallRecipe(200).items.find((item) => item.itemKey === 'upright_346_5');
  assert.equal(parent.quantity, 2);
});

test('upright snaps to short-up, profile and banko joints, not to düz wall_200', () => {
  const upright = createModuleStateFromDescriptor(getCatalogItem('upright_346_5'));
  assert.equal(upright.type, 'upright');
  assert.equal(requiresShortUpJointSnap(upright), true);
  assert.equal(getModuleMagneticSnapStrategy(upright), 'short-up-joint');

  const shortUp = {
    id: 'short-1',
    itemKey: 'wall_200_short_2',
    type: 'flat-panel',
    variant: 'wall-short-2',
    widthCm: 200,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  };
  const düzWall = {
    id: 'wall-1',
    itemKey: 'wall_200_350',
    type: 'flat-panel',
    widthCm: 200,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  };
  assert.equal(isWallShortFamilyDescriptor(shortUp), true);
  assert.equal(isWallShortFamilyDescriptor(düzWall), false);

  const hit = snapPlacementToModules({
    moduleId: upright.id,
    moduleType: upright.type,
    itemKey: upright.itemKey,
    heightCm: upright.heightCm,
    widthCm: upright.widthCm,
    depthCm: upright.depthCm,
    pointerXCm: 0,
    pointerYCm: 0,
    rotationZDeg: 0,
    modules: [shortUp],
    standType: 'island',
    standXCm: 500,
    standYCm: 500,
  });
  assert.equal(hit?.ok, true);
  assert.equal(hit.snapKind, 'short-up-joint');
  assert.equal(hit.placement.wallId, 'free');

  const missDüz = snapPlacementToModules({
    moduleId: upright.id,
    moduleType: upright.type,
    itemKey: upright.itemKey,
    heightCm: upright.heightCm,
    widthCm: upright.widthCm,
    depthCm: upright.depthCm,
    pointerXCm: 0,
    pointerYCm: 0,
    rotationZDeg: 0,
    modules: [düzWall],
    standType: 'island',
    standXCm: 500,
    standYCm: 500,
  });
  assert.equal(missDüz, null);

  const missEmpty = snapPlacementToModules({
    moduleId: upright.id,
    moduleType: upright.type,
    itemKey: upright.itemKey,
    heightCm: upright.heightCm,
    widthCm: upright.widthCm,
    depthCm: upright.depthCm,
    pointerXCm: 250,
    pointerYCm: 250,
    rotationZDeg: 0,
    modules: [shortUp],
    standType: 'island',
    standXCm: 500,
    standYCm: 500,
  });
  assert.equal(missEmpty, null);

  const fieldProfile = {
    id: 'profile-1',
    itemKey: 'profile_190',
    type: 'profile',
    widthCm: 200,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  };
  const hitProfile = snapPlacementToModules({
    moduleId: upright.id,
    moduleType: upright.type,
    itemKey: upright.itemKey,
    heightCm: upright.heightCm,
    widthCm: upright.widthCm,
    depthCm: upright.depthCm,
    pointerXCm: 0,
    pointerYCm: 0,
    rotationZDeg: 0,
    modules: [fieldProfile],
    standType: 'island',
    standXCm: 500,
    standYCm: 500,
  });
  assert.equal(hitProfile?.ok, true);
  assert.equal(hitProfile.snapKind, 'short-up-joint');
  assert.equal(hitProfile.placement.wallId, 'free');

  const banko = createModuleStateFromDescriptor(getCatalogItem('desk_banko_200'));
  banko.id = 'banko-1';
  banko.placement = { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  const hitBanko = snapPlacementToModules({
    moduleId: upright.id,
    moduleType: upright.type,
    itemKey: upright.itemKey,
    heightCm: upright.heightCm,
    widthCm: upright.widthCm,
    depthCm: upright.depthCm,
    pointerXCm: 0,
    pointerYCm: 0,
    rotationZDeg: 0,
    modules: [banko],
    standType: 'island',
    standXCm: 500,
    standYCm: 500,
  });
  assert.equal(hitBanko?.ok, true);
  assert.equal(hitBanko.snapKind, 'short-up-joint');

  const underProfile = {
    ...fieldProfile,
    id: 'profile-over-banko',
  };
  const hitThroughBanko = snapPlacementToModules({
    moduleId: upright.id,
    moduleType: upright.type,
    itemKey: upright.itemKey,
    heightCm: upright.heightCm,
    widthCm: upright.widthCm,
    depthCm: upright.depthCm,
    pointerXCm: 0,
    pointerYCm: 0,
    rotationZDeg: 0,
    modules: [underProfile, banko],
    standType: 'island',
    standXCm: 500,
    standYCm: 500,
  });
  assert.equal(hitThroughBanko?.ok, true);
  assert.equal(hitThroughBanko.snapKind, 'short-up-joint');
});

test('field upright renderer uses a square wall-depth column, not an L', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('function createUprightModule'), source.indexOf('function createProfileModule'));
  assert.match(fn, /createSlottedProfileGeometry\(thicknessM, heightM, depthM\)/);
  assert.doesNotMatch(fn, /STAND_DIMENSIONS/);
  assert.match(fn, /frameColorForModule\(moduleState\)/);
  assert.match(fn, /metalness: 0\.68/);
  assert.match(fn, /roughness: 0\.28/);
  assert.doesNotMatch(fn, /rotation\.y = Math\.PI \/ 2/);
  assert.doesNotMatch(fn, /postAlongWall/);
  assert.doesNotMatch(fn, /getItem\('upright_346_5'\)/);
  assert.doesNotMatch(fn, /item\.defaultColor/);
});

test('catalog preview for upright is a solid post, not a 7-strip panel', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = await readFile(new URL('./fixtures/catalogPreviewKinds.mjs', import.meta.url), 'utf8');
  assert.match(fixture, /id: 27/);
  assert.match(fixture, /module-drag-upright/);
  assert.match(fixture, /markup: '<div class="module-drag-upright"><\/div>'/);
});
