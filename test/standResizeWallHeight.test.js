import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { WALL_OVERLAY_DEFAULT_CENTER_CM, createModulePlacement, overlayZCmFromSeamHeight } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { describeWallHeightChangeReport, planStandWallHeightChange } from '../src/standResize.js';
import { getStandResizeRules } from '../src/standResizeRules.js';
import { buildWallHeightProjectModules } from './wallHeightProjects.mjs';

const HEIGHTS = [250, 300, 400, 450, 500];

function plan(modules, fromHeightCm, toHeightCm, boothType = 'maxima') {
  return planStandWallHeightChange({ modules, fromHeightCm, toHeightCm, boothType });
}

function bomQuantities(modules) {
  const bom = resolveProjectBom(modules);
  assert.equal(bom.unresolved.length, 0);
  return Object.fromEntries(bom.lines.map((line) => [line.itemKey, line.quantity]));
}

function moduleOf(itemKey, placement = { xCm: 0, yCm: 0, rotationZDeg: 0, wallId: 'free' }) {
  const state = createModuleStateFromCatalogKey(itemKey);
  assert.ok(state, itemKey);
  state.placement = createModulePlacement(placement);
  return state;
}

for (const toHeightCm of HEIGHTS) {
  test(`350 → ${toHeightCm}: planned stand has the same BOM as a stand built at ${toHeightCm}`, () => {
    const result = plan(buildWallHeightProjectModules(350), 350, toHeightCm);
    assert.equal(result.ok, true);
    assert.equal(result.changed, true);
    assert.deepEqual(bomQuantities(result.modules), bomQuantities(buildWallHeightProjectModules(toHeightCm)));
    assert.equal(result.report.convertedWalls, 9);
  });
}

test('planning does not mutate the input modules', () => {
  const modules = buildWallHeightProjectModules(350);
  const before = structuredClone(modules);
  plan(modules, 350, 250);
  assert.deepEqual(modules, before);
});

test('same height and unknown booth type', () => {
  const modules = buildWallHeightProjectModules(350);
  const same = plan(modules, 350, 350);
  assert.equal(same.ok, true);
  assert.equal(same.changed, false);
  assert.equal(same.modules, modules);

  const unsupported = plan(modules, 350, 250, 'package');
  assert.equal(unsupported.ok, false);
  assert.equal(getStandResizeRules('package'), null);

  assert.equal(plan(modules, 350, 275).ok, false);
});

test('bands are kept from the bottom: lower removes top bands, raise adds empty bands', () => {
  const wall = moduleOf('wall_100_350', { xCm: 0, yCm: 0, rotationZDeg: 0, wallId: 'back' });
  assert.equal(wall.strips.length, 7);
  wall.strips[0].color = '#ff0000';
  wall.strips[0].imageAssetId = 'asset-bottom';
  wall.strips[6].imageAssetId = 'asset-top';
  const bottomId = wall.strips[0].id;

  const lowered = plan([wall], 350, 250);
  const low = lowered.modules[0];
  assert.equal(low.itemKey, 'wall_100_250');
  assert.equal(low.strips.length, 5);
  assert.equal(low.strips[0].id, bottomId);
  assert.equal(low.strips[0].color, '#ff0000');
  assert.equal(low.strips[0].imageAssetId, 'asset-bottom');
  assert.ok(!low.strips.some((strip) => strip.imageAssetId === 'asset-top'));
  assert.equal(lowered.report.removedBands, 2);
  assert.equal(low.placement.wallId, 'back');
  assert.equal(low.id, wall.id);

  const raised = plan([low], 250, 450);
  const high = raised.modules[0];
  assert.equal(high.itemKey, 'wall_100_450');
  assert.equal(high.strips.length, 9);
  assert.equal(high.strips[0].id, bottomId);
  assert.equal(raised.report.addedBands, 4);
  assert.ok(high.strips.slice(5).every((strip) => !strip.imageAssetId));
});

test('back strips follow the front band count', () => {
  const wall = moduleOf('wall_100_350', { xCm: 0, yCm: 0, rotationZDeg: 0, wallId: 'free' });
  wall.backStrips = structuredClone(wall.strips).map((strip, index) => ({ ...strip, id: `back-${index}` }));
  wall.backStrips[0].color = '#00ff00';
  const lowered = plan([wall], 350, 300).modules[0];
  assert.equal(lowered.backStrips.length, 6);
  assert.equal(lowered.backStrips[0].color, '#00ff00');
});

test('lightbox reaching the wall top grows and shrinks with the wall; owners stay consistent', () => {
  const left = moduleOf('wall_100_350', { xCm: 0, yCm: 0, rotationZDeg: 0, wallId: 'back' });
  const right = moduleOf('wall_100_350', { xCm: 100, yCm: 0, rotationZDeg: 0, wallId: 'back' });
  const fabricStrips = [left, right].flatMap((module) => module.strips.slice(4));
  const owners = fabricStrips.map((strip) => strip.id);
  fabricStrips.forEach((strip) => Object.assign(strip, {
    fabricGroupId: 'fabric-a',
    fabricType: 'lightbox',
    fabricLightingOn: true,
    fabricImageAssetId: 'asset-fabric',
    fabricOwnerSurfaceIds: [...owners],
    fabricOwnerModuleIds: [left.id, right.id],
  }));

  const raised = plan([left, right], 350, 450);
  assert.equal(raised.report.extendedFabrics, 1);
  const grownStrips = raised.modules.flatMap((module) => module.strips.filter((strip) => strip.fabricGroupId === 'fabric-a'));
  assert.equal(grownStrips.length, 10);
  const grownOwners = new Set(grownStrips.map((strip) => strip.id));
  for (const strip of grownStrips) {
    assert.deepEqual(new Set(strip.fabricOwnerSurfaceIds), grownOwners);
    assert.equal(strip.fabricImageAssetId, 'asset-fabric');
    assert.equal(strip.fabricType, 'lightbox');
  }

  const lowered = plan([left, right], 350, 250);
  const keptStrips = lowered.modules.flatMap((module) => module.strips.filter((strip) => strip.fabricGroupId === 'fabric-a'));
  assert.equal(keptStrips.length, 2);
  const keptOwners = new Set(keptStrips.map((strip) => strip.id));
  for (const strip of keptStrips) assert.deepEqual(new Set(strip.fabricOwnerSurfaceIds), keptOwners);
});

test('lightbox below the wall top does not grow', () => {
  const wall = moduleOf('wall_100_350', { xCm: 0, yCm: 0, rotationZDeg: 0, wallId: 'back' });
  const owners = wall.strips.slice(1, 3).map((strip) => strip.id);
  wall.strips.slice(1, 3).forEach((strip) => Object.assign(strip, {
    fabricGroupId: 'fabric-low', fabricType: 'mesh', fabricOwnerSurfaceIds: [...owners],
  }));
  const raised = plan([wall], 350, 500);
  assert.equal(raised.report.extendedFabrics, 0);
  assert.equal(raised.modules[0].strips.filter((strip) => strip.fabricGroupId === 'fabric-low').length, 2);
});

test('uprights reaching the wall top follow it; shorter uprights stay', () => {
  const tall = moduleOf('upright_396');
  const exact = moduleOf('upright_346_5');
  const short = moduleOf('upright_99');
  const lowered = plan([tall, exact, short], 350, 250);
  assert.deepEqual(lowered.modules.map((module) => module.itemKey), ['upright_297', 'upright_247_5', 'upright_99']);
  assert.equal(lowered.report.resizedUprights, 2);

  const top = moduleOf('upright_495');
  assert.equal(plan([top], 450, 500).modules[0].itemKey, 'upright_495');
});

test('wall-top items, projectors and ceiling tulle move with the wall top', () => {
  const profile = moduleOf('profile_388');
  profile.placement.zCm = 340;
  const projector = moduleOf('led_floodlight');
  projector.placement.zCm = 350;
  const lowProjector = moduleOf('led_floodlight');
  lowProjector.placement.zCm = 200;
  const tulle = moduleOf('tulle_fabric');
  tulle.placement.zCm = 350 - Number(tulle.depthCm);

  const lowered = plan([profile, projector, lowProjector, tulle], 350, 250);
  const [p, pr, low, t] = lowered.modules;
  assert.equal(p.placement.zCm, 240);
  assert.equal(pr.placement.zCm, 250);
  assert.equal(low.placement.zCm, 200);
  assert.equal(t.placement.zCm + Number(t.depthCm), 250);

  const raised = plan([profile, projector], 350, 450);
  assert.equal(raised.modules[0].placement.zCm, 440);
  assert.equal(raised.modules[1].placement.zCm, 450);
});

test('items above the new wall top come down; others stay in place', () => {
  const box = moduleOf('box_block');
  box.placement.zCm = 280;
  const floorBox = moduleOf('box_block');
  floorBox.placement.zCm = 0;
  const raised = plan([box, floorBox], 350, 450);
  assert.equal(raised.modules[0].placement.zCm, 280);
  assert.equal(raised.modules[1].placement.zCm, 0);

  const lowered = plan([box, floorBox], 350, 250);
  assert.equal(lowered.modules[0].placement.zCm + Number(box.heightCm), 250);
  assert.equal(lowered.modules[1].placement.zCm, 0);
  assert.equal(lowered.report.loweredToWallTop, 1);
});

test('TV above the new wall top comes down to the top; shelf moves to the highest seam that fits', () => {
  const tv = moduleOf('tv_42', { xCm: 0, yCm: 0, rotationZDeg: 0, wallId: 'back' });
  tv.placement.zCm = 150;
  const lowTv = moduleOf('tv_42', { xCm: 100, yCm: 0, rotationZDeg: 0, wallId: 'back' });
  lowTv.placement.zCm = 0;
  const shelf = moduleOf('shelf_row_1', { xCm: 0, yCm: 0, rotationZDeg: 0, wallId: 'back' });
  shelf.placement.zCm = overlayZCmFromSeamHeight(300, Number(shelf.heightCm));
  const lowShelf = moduleOf('shelf_row_1', { xCm: 100, yCm: 0, rotationZDeg: 0, wallId: 'back' });
  lowShelf.placement.zCm = overlayZCmFromSeamHeight(100, Number(lowShelf.heightCm));

  const [t, lt, s, ls] = plan([tv, lowTv, shelf, lowShelf], 350, 250).modules;
  const tvTopCm = t.placement.zCm + WALL_OVERLAY_DEFAULT_CENTER_CM + Number(tv.heightCm) / 2;
  assert.ok(Math.abs(tvTopCm - 250) < 0.01, String(tvTopCm));
  assert.equal(lt.placement.zCm, 0);
  assert.equal(s.placement.zCm, overlayZCmFromSeamHeight(200, Number(shelf.heightCm)));
  assert.equal(ls.placement.zCm, lowShelf.placement.zCm);
});

test('report text lists the changes', () => {
  const lines = describeWallHeightChangeReport(plan(buildWallHeightProjectModules(350), 350, 250).report);
  assert.ok(lines.some((line) => line.includes('9 duvar parçası')));
  assert.ok(lines.some((line) => line.includes('üst bant')));
});
