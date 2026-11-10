import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composeAutomaticBackWallWithDepot,
  composeAutomaticSideWallWithDepot,
  composeAutomaticStandWall,
  getAutomaticWallCapacityCm,
  planAutomaticDepotLampPlacements,
  automaticWallLampCount,
  planAutomaticWallLampPlacements,
} from '../src/automaticWall.js';
import { planAutomaticDepot } from '../src/autoDepot.js';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { getItem, resolveItemDefaultZCm } from '../src/items.js';
import { resolveVirtualTopRailZCm, snapPlacementToItemAnchor } from '../src/itemSnap.js';

test('L stand 500 x 400 accepts 900 cm and fills left before back', () => {
  assert.equal(getAutomaticWallCapacityCm({
    standType: 'l-left',
    standXCm: 500,
    standYCm: 400,
  }), 900);

  const result = composeAutomaticStandWall({
    wallWidthCm: 900,
    standType: 'l-left',
    standXCm: 500,
    standYCm: 400,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.widths, [200, 200, 200, 200, 100]);
  assert.equal(result.placements[0].wallId, 'left');
  assert.equal(result.placements[1].wallId, 'left');
  assert.equal(result.placements[2].wallId, 'back');
  assert.equal(result.placements.at(-1).wallId, 'back');
});

test('U stand 400 x 400 accepts the full 1200 cm chain', () => {
  const result = composeAutomaticStandWall({
    wallWidthCm: 1200,
    standType: 'u-stand',
    standXCm: 400,
    standYCm: 400,
  });

  assert.equal(result.ok, true);
  assert.equal(result.capacityCm, 1200);
  assert.deepEqual(result.widths, [200, 200, 200, 200, 200, 200]);
  assert.deepEqual(result.placements.map((placement) => placement.wallId), [
    'left', 'left', 'back', 'back', 'right', 'right',
  ]);
});

test('450 cm side is completed with a 50 cm module before turning the corner', () => {
  const result = composeAutomaticStandWall({
    wallWidthCm: 950,
    standType: 'l-left',
    standXCm: 500,
    standYCm: 450,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.widths, [200, 200, 50, 200, 200, 100]);
  assert.deepEqual(result.placements.slice(0, 3).map((placement) => placement.wallId), [
    'left', 'left', 'left',
  ]);
  assert.equal(result.placements[3].wallId, 'back');
});

test('rejects lengths above the total active wall chain', () => {
  const result = composeAutomaticStandWall({
    wallWidthCm: 1250,
    standType: 'u-stand',
    standXCm: 400,
    standYCm: 400,
  });

  assert.equal(result.ok, false);
  assert.equal(result.capacityCm, 1200);
  assert.match(result.message, /1200 cm/i);
});

function wallModulesFrom(result) {
  return result.widths.map((widthCm, index) => ({
    type: 'flat-panel',
    widthCm,
    placement: result.placements[index],
  }));
}

test('automatic lamps: one per 150 cm rounded up, spread evenly, face the scene, keep wall widths', () => {
  const result = composeAutomaticStandWall({
    wallWidthCm: 900,
    standType: 'l-left',
    standXCm: 500,
    standYCm: 400,
  });
  assert.deepEqual(result.widths, [200, 200, 200, 200, 100]);

  const lamps = planAutomaticWallLampPlacements({
    modules: wallModulesFrom(result),
    standXCm: 500,
    standYCm: 400,
    lampWidthCm: 50,
  });

  // Sol 400 cm → 3 lamba (133 cm dilim), sırt 500 cm → 4 lamba (125 cm dilim); uçta boş kısım kalmaz.
  assert.deepEqual(lamps, [
    { xCm: 0, yCm: 308, zCm: 0, rotationZDeg: 90, wallId: 'left' },
    { xCm: 0, yCm: 175, zCm: 0, rotationZDeg: 90, wallId: 'left' },
    { xCm: 0, yCm: 42, zCm: 0, rotationZDeg: 90, wallId: 'left' },
    { xCm: 38, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    { xCm: 163, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    { xCm: 288, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    { xCm: 413, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  ]);
});

test('right wall lamps face into the stand', () => {
  const result = composeAutomaticStandWall({
    wallWidthCm: 600,
    standType: 'l-right',
    standXCm: 200,
    standYCm: 400,
  });
  assert.equal(result.ok, true);
  const lamps = planAutomaticWallLampPlacements({
    modules: wallModulesFrom(result),
    standXCm: 200,
    standYCm: 400,
    lampWidthCm: 50,
  });
  assert.deepEqual(lamps, [
    { xCm: 25, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    { xCm: 125, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    { xCm: 200, yCm: 42, zCm: 0, rotationZDeg: 270, wallId: 'right' },
    { xCm: 200, yCm: 175, zCm: 0, rotationZDeg: 270, wallId: 'right' },
    { xCm: 200, yCm: 308, zCm: 0, rotationZDeg: 270, wallId: 'right' },
  ]);
});

test('a wall shorter than 150 cm still gets one centred lamp', () => {
  const result = composeAutomaticStandWall({
    wallWidthCm: 100,
    standType: 'back-wall',
    standXCm: 100,
    standYCm: 300,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(planAutomaticWallLampPlacements({
    modules: wallModulesFrom(result),
    standXCm: 100,
    standYCm: 300,
    lampWidthCm: 50,
  }), [{ xCm: 25, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' }]);
  assert.deepEqual([0, 100, 150, 151, 300, 350, 400].map((lengthCm) => automaticWallLampCount(lengthCm)), [0, 1, 1, 2, 2, 3, 3]);
});

test('automatic lamp snaps onto the wall top profile and keeps its scene-facing yaw', () => {
  const result = composeAutomaticStandWall({
    wallWidthCm: 200,
    standType: 'back-wall',
    standXCm: 200,
    standYCm: 300,
  });
  const hosts = result.widths.map((widthCm, index) => {
    const state = createModuleStateFromCatalogKey(widthCm === 100 ? 'wall_100_350' : 'wall_200_350');
    state.placement = { ...result.placements[index] };
    return state;
  });
  const [planned] = planAutomaticWallLampPlacements({
    modules: wallModulesFrom(result),
    standXCm: 200,
    standYCm: 300,
    lampWidthCm: 50,
  });
  const light = createModuleStateFromCatalogKey('led_floodlight');
  const snapped = snapPlacementToItemAnchor(light, planned, hosts);
  const profile = getItem('profile_190');
  assert.deepEqual(planned, { xCm: 25, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' });
  assert.equal(snapped.xCm, 25);
  assert.equal(snapped.yCm, 0);
  assert.equal(snapped.rotationZDeg, 0);
  assert.equal(snapped.zCm, resolveVirtualTopRailZCm(hosts[0], profile));
  assert.equal(
    snapped.zCm,
    resolveItemDefaultZCm(profile) + Number(profile.sceneDimensions?.heightCm ?? profile.dimensions.heightCm),
  );
});

test('depot rear wall gets no lamp and each wall run beside it gets its own lamps', () => {
  const plan = planAutomaticDepot({
    standType: 'back-wall',
    standXCm: 600,
    standYCm: 400,
    sizeKey: '200x100',
  });
  const back = composeAutomaticBackWallWithDepot({
    standXCm: 600,
    depotOriginXCm: plan.originXCm,
    depotWidthCm: plan.widthCm,
    sizeKey: plan.sizeKey,
  });
  assert.equal(plan.originXCm, 200);
  const lamps = planAutomaticWallLampPlacements({
    modules: back.modules.map((entry) => ({
      type: 'flat-panel',
      widthCm: entry.widthCm,
      placement: entry.placement,
      depotBack: entry.depotBack,
    })),
    standXCm: 600,
    standYCm: 400,
    lampWidthCm: 50,
  });
  assert.deepEqual(lamps, [
    { xCm: 25, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    { xCm: 125, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    { xCm: 425, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    { xCm: 525, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  ]);
  assert.equal(lamps.some((lamp) => lamp.xCm >= 200 && lamp.xCm < 400), false);
});

test('each depot wall gets one lamp and the wall behind the depot gets none', () => {
  const plan = planAutomaticDepot({
    standType: 'back-wall',
    standXCm: 600,
    standYCm: 400,
    sizeKey: '200x100',
  });
  const lamps = planAutomaticDepotLampPlacements({
    modules: plan.specs,
    lampWidthCm: 50,
  });
  assert.deepEqual(lamps, [
    { xCm: 275, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' },
    { xCm: 400, yCm: 25, zCm: 0, rotationZDeg: 90, wallId: 'free' },
    { xCm: 200, yCm: 25, zCm: 0, rotationZDeg: 270, wallId: 'free' },
  ]);
});

test('island depot keeps the lamp off its back wall', () => {
  const plan = planAutomaticDepot({
    standType: 'island',
    standXCm: 600,
    standYCm: 500,
    sizeKey: '200x100',
  });
  const lamps = planAutomaticDepotLampPlacements({
    modules: plan.specs,
    lampWidthCm: 50,
  });
  assert.equal(lamps.some((lamp) => lamp.yCm === plan.originYCm), false);
  assert.deepEqual(lamps, [
    { xCm: 275, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' },
    { xCm: 400, yCm: 225, zCm: 0, rotationZDeg: 90, wallId: 'free' },
    { xCm: 200, yCm: 225, zCm: 0, rotationZDeg: 270, wallId: 'free' },
  ]);
});

test('shared depot side gets one lamp and the rest of that wall keeps the 150 cm cadence', () => {
  const plan = planAutomaticDepot({
    standType: 'l-left',
    standXCm: 500,
    standYCm: 400,
    sizeKey: '100x100',
  });
  const side = composeAutomaticSideWallWithDepot({
    standType: 'l-left',
    standXCm: 500,
    standYCm: 400,
    depotDepthCm: plan.depthCm,
  });
  const intervalLamps = planAutomaticWallLampPlacements({
    modules: side.modules.map((entry) => ({
      type: 'flat-panel',
      widthCm: entry.widthCm,
      placement: entry.placement,
      depotSide: entry.depotSide,
    })),
    standXCm: 500,
    standYCm: 400,
    lampWidthCm: 50,
  });
  assert.deepEqual(intervalLamps, [
    { xCm: 0, yCm: 300, zCm: 0, rotationZDeg: 90, wallId: 'left' },
    { xCm: 0, yCm: 150, zCm: 0, rotationZDeg: 90, wallId: 'left' },
  ]);

  const depotLamps = planAutomaticDepotLampPlacements({
    modules: [
      ...side.modules.filter((entry) => entry.depotSide),
      ...plan.specs,
    ],
    lampWidthCm: 50,
  });
  assert.deepEqual(depotLamps, [
    { xCm: 25, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' },
    { xCm: 0, yCm: 25, zCm: 0, rotationZDeg: 90, wallId: 'left' },
    { xCm: 100, yCm: 25, zCm: 0, rotationZDeg: 90, wallId: 'free' },
  ]);
});
