import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllowedWallIds,
  getModulePlacementSnapCm,
  isVerticalModuleRotation,
  normalizeModuleRotationZDeg,
  planFreeSideInsertion,
  rotateModuleRotationZDeg,
  snapCm,
  snapPlacementToStand,
  snapPlacementToModules,
  rotateModulePlacementAroundCenter,
  validatePlacementAgainstModules,
  MID_WALL_TEE_MESSAGE,
} from '../src/modulePlacement.js';

test('snaps module coordinates to 50 cm increments', () => {
  assert.equal(snapCm(24), 0);
  assert.equal(snapCm(26), 50);
  assert.equal(snapCm(174), 150);
  assert.equal(snapCm(176), 200);
});

test('L stand sides expose only the selected mirrored wall', () => {
  assert.deepEqual(getAllowedWallIds('l-left'), ['back', 'left', 'free']);
  assert.deepEqual(getAllowedWallIds('l-right'), ['back', 'right', 'free']);
  assert.deepEqual(getAllowedWallIds('u-stand'), ['back', 'left', 'right', 'free']);
  assert.deepEqual(getAllowedWallIds('island'), ['free']);
});

test('snaps an L-left module to the closest active edge', () => {
  const result = snapPlacementToStand({
    standType: 'l-left',
    widthCm: 200,
    pointerXCm: 40,
    pointerYCm: 260,
    standXCm: 1000,
    standYCm: 500,
  });

  assert.equal(result.ok, true);
  assert.equal(result.placement.wallId, 'left');
  assert.equal(result.placement.rotationZDeg, 90);
  assert.equal(result.placement.xCm, 0);
  assert.equal(result.placement.yCm, 150);
});

test('snaps a back wall module and keeps it inside X limit', () => {
  const result = snapPlacementToStand({
    standType: 'u-stand',
    widthCm: 200,
    pointerXCm: 920,
    pointerYCm: 20,
    standXCm: 1000,
    standYCm: 500,
  });

  assert.equal(result.ok, true);
  assert.equal(result.placement.wallId, 'back');
  assert.equal(result.placement.xCm, 800);
  assert.equal(result.placement.yCm, 0);
});

test('rejects overlapping modules on the same wall but allows a corner connection', () => {
  const modules = [
    {
      id: 'back-1',
      widthCm: 200,
      placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    },
    {
      id: 'left-1',
      widthCm: 200,
      placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 90, wallId: 'left' },
    },
  ];

  const overlap = validatePlacementAgainstModules({
    moduleId: 'moving',
    widthCm: 100,
    placement: { xCm: 100, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
    modules,
    standType: 'l-left',
    standXCm: 1000,
    standYCm: 500,
  });
  assert.equal(overlap.ok, false);

  const corner = validatePlacementAgainstModules({
    moduleId: 'moving',
    widthCm: 100,
    placement: { xCm: 0, yCm: 200, zCm: 0, rotationZDeg: 90, wallId: 'left' },
    modules,
    standType: 'l-left',
    standXCm: 1000,
    standYCm: 500,
  });
  assert.equal(corner.ok, true);
});

test('snaps a module inside every stand to the 10 cm free grid', () => {
  const result = snapPlacementToStand({
    standType: 'back-wall',
    widthCm: 100,
    pointerXCm: 375,
    pointerYCm: 275,
    standXCm: 800,
    standYCm: 600,
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'free');
  assert.deepEqual(result.placement, {
    xCm: 330,
    yCm: 280,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'free',
  });
});

test('rotation lock keeps a perpendicular return free instead of snapping it onto the back wall', () => {
  const result = snapPlacementToStand({
    standType: 'u-stand',
    widthCm: 100,
    pointerXCm: 300,
    pointerYCm: 20,
    standXCm: 800,
    standYCm: 600,
    preferredRotationZDeg: 90,
    rotationLocked: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.placement.wallId, 'free');
  assert.equal(result.placement.rotationZDeg, 90);
  assert.equal(result.placement.xCm, 300);
});

test('free parallel walls may overlap in axis range when they are on different grid lines', () => {
  const modules = [{
    id: 'a',
    widthCm: 200,
    placement: { xCm: 100, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];
  const result = validatePlacementAgainstModules({
    moduleId: 'b',
    widthCm: 200,
    placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' },
    modules,
    standType: 'back-wall',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(result.ok, true);
});

test('T joins only at a shared upright; a stem into the middle of one wall and a plus crossing are rejected', () => {
  const horizontal = {
    id: 'horizontal',
    widthCm: 300,
    placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };

  // Tek duvarın ortasında dikme yok: dik bağlantı reddedilir, ayrı mesajla.
  const midWall = validatePlacementAgainstModules({
    moduleId: 't',
    widthCm: 100,
    placement: { xCm: 250, yCm: 100, zCm: 0, rotationZDeg: 90, wallId: 'free' },
    modules: [horizontal],
    standType: 'u-stand',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(midWall.ok, false);
  assert.equal(midWall.message, MID_WALL_TEE_MESSAGE);

  // İki duvarın birleştiği noktada (ortak dikme) T kabul edilir.
  const left = { id: 'left', widthCm: 150, placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' } };
  const right = { id: 'right', widthCm: 150, placement: { xCm: 250, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' } };
  const tJoin = validatePlacementAgainstModules({
    moduleId: 't',
    widthCm: 100,
    placement: { xCm: 250, yCm: 100, zCm: 0, rotationZDeg: 90, wallId: 'free' },
    modules: [left, right],
    standType: 'u-stand',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(tJoin.ok, true);

  // Uçta L kabul edilir.
  const lJoin = validatePlacementAgainstModules({
    moduleId: 'l',
    widthCm: 100,
    placement: { xCm: 400, yCm: 100, zCm: 0, rotationZDeg: 90, wallId: 'free' },
    modules: [horizontal],
    standType: 'u-stand',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(lJoin.ok, true);

  const plusCross = validatePlacementAgainstModules({
    moduleId: 'plus',
    widthCm: 300,
    placement: { xCm: 250, yCm: 100, zCm: 0, rotationZDeg: 90, wallId: 'free' },
    modules: [horizontal],
    standType: 'u-stand',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(plusCross.ok, false);
});


test('module rotations use four 90 degree directions', () => {
  assert.equal(normalizeModuleRotationZDeg(0), 0);
  assert.equal(normalizeModuleRotationZDeg(90), 90);
  assert.equal(normalizeModuleRotationZDeg(180), 180);
  assert.equal(normalizeModuleRotationZDeg(270), 270);
  assert.equal(normalizeModuleRotationZDeg(360), 0);
  assert.equal(rotateModuleRotationZDeg(270, 90), 0);
  assert.equal(rotateModuleRotationZDeg(0, -90), 270);
  assert.equal(isVerticalModuleRotation(90), true);
  assert.equal(isVerticalModuleRotation(270), true);
  assert.equal(isVerticalModuleRotation(180), false);
});

test('right wall canonical snap faces inward at 270 degrees', () => {
  const result = snapPlacementToStand({
    standType: 'u-stand',
    widthCm: 100,
    pointerXCm: 795,
    pointerYCm: 300,
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(result.ok, true);
  assert.equal(result.placement.wallId, 'right');
  assert.equal(result.placement.rotationZDeg, 270);
});

test('rotation lock preserves 180 and 270 degree facing on matching axes', () => {
  const back = snapPlacementToStand({
    standType: 'u-stand',
    widthCm: 100,
    pointerXCm: 300,
    pointerYCm: 10,
    standXCm: 800,
    standYCm: 600,
    preferredRotationZDeg: 180,
    rotationLocked: true,
  });
  assert.equal(back.placement.wallId, 'back');
  assert.equal(back.placement.rotationZDeg, 180);

  const right = snapPlacementToStand({
    standType: 'u-stand',
    widthCm: 100,
    pointerXCm: 790,
    pointerYCm: 250,
    standXCm: 800,
    standYCm: 600,
    preferredRotationZDeg: 270,
    rotationLocked: true,
  });
  assert.equal(right.placement.wallId, 'right');
  assert.equal(right.placement.rotationZDeg, 270);
});


test('selected module quarter-turn keeps its center instead of rotating from the start corner', () => {
  const rotated = rotateModulePlacementAroundCenter({
    xCm: 200,
    yCm: 100,
    zCm: 0,
    rotationZDeg: 90,
    wallId: 'free',
  }, 100, 90);

  assert.deepEqual(rotated, {
    xCm: 150,
    yCm: 150,
    zCm: 0,
    rotationZDeg: 180,
    wallId: 'free',
  });
});

test('selected module rotation keeps its world center fixed without grid snapping', () => {
  const rotated = rotateModulePlacementAroundCenter({
    xCm: 100,
    yCm: 100,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'free',
  }, 50, 90);

  // Başlangıç merkezi (125, 100), dönüş sonrası da aynı kalmalı.
  assert.equal(rotated.xCm, 125);
  assert.equal(rotated.yCm, 75);
  assert.equal(rotated.rotationZDeg, 90);
});


test('magnetic snap joins parallel modules end to end without changing rotation', () => {
  const modules = [{
    id: 'target',
    widthCm: 100,
    placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];
  const result = snapPlacementToModules({
    moduleId: 'moving',
    widthCm: 100,
    pointerXCm: 247,
    pointerYCm: 202,
    rotationZDeg: 0,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });

  assert.equal(result?.snapKind, 'end-to-end');
  assert.deepEqual(result?.placement, {
    xCm: 200, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free',
  });
});

test('magnetic snap creates an L connection at a target endpoint', () => {
  const modules = [{
    id: 'target',
    widthCm: 200,
    placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];
  const result = snapPlacementToModules({
    moduleId: 'moving',
    widthCm: 100,
    pointerXCm: 302,
    pointerYCm: 248,
    rotationZDeg: 90,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });

  assert.equal(result?.snapKind, 'corner');
  assert.deepEqual(result?.placement, {
    xCm: 300, yCm: 200, zCm: 0, rotationZDeg: 90, wallId: 'free',
  });
});

test('magnetic snap offers no T connection in the middle of a wall (no upright there)', () => {
  const modules = [{
    id: 'target',
    widthCm: 300,
    placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];
  const result = snapPlacementToModules({
    moduleId: 'moving',
    widthCm: 100,
    pointerXCm: 252,
    pointerYCm: 251,
    rotationZDeg: 90,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });

  assert.notEqual(result?.snapKind, 'tee');
  assert.notEqual(result?.placement?.xCm, 250);
});

test('magnetic snap preserves 270 degree facing and ignores distant targets', () => {
  const modules = [{
    id: 'target',
    widthCm: 200,
    placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];
  const snapped = snapPlacementToModules({
    moduleId: 'moving',
    widthCm: 100,
    pointerXCm: 300,
    pointerYCm: 250,
    rotationZDeg: 270,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(snapped?.placement.rotationZDeg, 270);

  const distant = snapPlacementToModules({
    moduleId: 'moving',
    widthCm: 100,
    pointerXCm: 700,
    pointerYCm: 500,
    rotationZDeg: 270,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(distant, null);
});


test('counter snaps flush to a parallel module face without overlapping it', () => {
  const modules = [{
    id: 'wall',
    widthCm: 300,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  }];

  const snapped = snapPlacementToModules({
    moduleId: 'counter',
    moduleType: 'counter',
    widthCm: 100,
    depthCm: 50,
    pointerXCm: 150,
    pointerYCm: 25,
    rotationZDeg: 0,
    modules,
    standType: 'u-stand',
    standXCm: 800,
    standYCm: 600,
  });

  assert.equal(snapped?.snapKind, 'face');
  assert.equal(snapped?.placement.xCm, 100);
  assert.equal(snapped?.placement.yCm, 30);

  const validation = validatePlacementAgainstModules({
    moduleId: 'counter',
    moduleType: 'counter',
    widthCm: 100,
    depthCm: 50,
    placement: snapped.placement,
    modules,
    standType: 'u-stand',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(validation.ok, true);
});

test('counter face snap ignores longitudinal grid offset when measuring wall proximity', () => {
  const modules = [{
    id: 'wall',
    widthCm: 300,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  }];

  const snapped = snapPlacementToModules({
    moduleId: 'counter',
    moduleType: 'counter',
    widthCm: 100,
    depthCm: 50,
    pointerXCm: 125,
    pointerYCm: 0,
    rotationZDeg: 0,
    modules,
    standType: 'u-stand',
    standXCm: 800,
    standYCm: 600,
  });

  assert.equal(snapped?.snapKind, 'face');
  assert.equal(snapped?.placement.xCm, 80);
  assert.equal(snapped?.placement.yCm, 30);

  const validation = validatePlacementAgainstModules({
    moduleId: 'counter',
    moduleType: 'counter',
    widthCm: 100,
    depthCm: 50,
    placement: snapped.placement,
    modules,
    standType: 'u-stand',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(validation.ok, true);
});

test('a baza beside a wall-hosted baza keeps that center line', () => {
  const modules = [{
    id: 'hosted',
    type: 'base',
    itemKey: 'base_200',
    widthCm: 200,
    depthCm: 50,
    placement: { xCm: 0, yCm: 30, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];

  const snapped = snapPlacementToModules({
    moduleId: 'next',
    moduleType: 'base',
    itemKey: 'base_200',
    widthCm: 200,
    depthCm: 50,
    pointerXCm: 300,
    pointerYCm: 25,
    rotationZDeg: 0,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });

  assert.equal(snapped?.snapKind, 'end-to-end');
  assert.equal(snapped.placement.xCm, 200);
  assert.equal(snapped.placement.yCm, 30);
});

test('counter side faces snap flush to perpendicular walls', () => {
  const leftWall = [{
    id: 'left-wall', widthCm: 400,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 90, wallId: 'left' },
  }];
  const left = snapPlacementToModules({
    moduleId: 'counter', moduleType: 'counter', widthCm: 100, depthCm: 50,
    pointerXCm: 55, pointerYCm: 125, rotationZDeg: 0, modules: leftWall,
    standType: 'u-stand', standXCm: 800, standYCm: 600,
  });
  assert.equal(left?.snapKind, 'face');
  assert.equal(left?.placement.xCm, 0);
  assert.equal(validatePlacementAgainstModules({
    moduleId: 'counter', moduleType: 'counter', widthCm: 100, depthCm: 50, placement: left.placement, modules: leftWall,
    standType: 'u-stand', standXCm: 800, standYCm: 600,
  }).ok, true);

  const rightWall = [{
    id: 'right-wall', widthCm: 400,
    placement: { xCm: 800, yCm: 0, zCm: 0, rotationZDeg: 270, wallId: 'right' },
  }];
  const right = snapPlacementToModules({
    moduleId: 'counter', moduleType: 'counter', widthCm: 100, depthCm: 50,
    pointerXCm: 745, pointerYCm: 125, rotationZDeg: 0, modules: rightWall,
    standType: 'u-stand', standXCm: 800, standYCm: 600,
  });
  assert.equal(right?.snapKind, 'face');
  assert.equal(right?.placement.xCm, 700);
  assert.equal(validatePlacementAgainstModules({
    moduleId: 'counter', moduleType: 'counter', widthCm: 100, depthCm: 50, placement: right.placement, modules: rightWall,
    standType: 'u-stand', standXCm: 800, standYCm: 600,
  }).ok, true);
});

test('rotated counter side face snaps flush to a perpendicular back wall', () => {
  const backWall = [{
    id: 'back-wall', widthCm: 500,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' },
  }];
  const snapped = snapPlacementToModules({
    moduleId: 'counter', moduleType: 'counter', widthCm: 100, depthCm: 50,
    pointerXCm: 125, pointerYCm: 55, rotationZDeg: 90, modules: backWall,
    standType: 'u-stand', standXCm: 800, standYCm: 600,
  });
  assert.equal(snapped?.snapKind, 'face');
  assert.equal(snapped?.placement.yCm, 0);
  assert.equal(validatePlacementAgainstModules({
    moduleId: 'counter', moduleType: 'counter', widthCm: 100, depthCm: 50, placement: snapped.placement, modules: backWall,
    standType: 'u-stand', standXCm: 800, standYCm: 600,
  }).ok, true);
});

test('counter snaps into U and L inner corners against two walls', () => {
  const scenarios = [
    {
      name: 'u-left',
      standType: 'u-stand',
      modules: [
        { id: 'back', widthCm: 800, placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' } },
        { id: 'left', widthCm: 600, placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 90, wallId: 'left' } },
      ],
      pointerXCm: 50, pointerYCm: 30, rotationZDeg: 0, expectedX: 0, expectedY: 30,
    },
    {
      name: 'u-right',
      standType: 'u-stand',
      modules: [
        { id: 'back', widthCm: 800, placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' } },
        { id: 'right', widthCm: 600, placement: { xCm: 800, yCm: 0, zCm: 0, rotationZDeg: 270, wallId: 'right' } },
      ],
      pointerXCm: 750, pointerYCm: 30, rotationZDeg: 0, expectedX: 700, expectedY: 30,
    },
    {
      name: 'l-left-rotated',
      standType: 'l-left',
      modules: [
        { id: 'back', widthCm: 800, placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' } },
        { id: 'left', widthCm: 600, placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 90, wallId: 'left' } },
      ],
      pointerXCm: 30, pointerYCm: 50, rotationZDeg: 90, expectedX: 30, expectedY: 0,
    },
    {
      name: 'l-right-rotated',
      standType: 'l-right',
      modules: [
        { id: 'back', widthCm: 800, placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'back' } },
        { id: 'right', widthCm: 600, placement: { xCm: 800, yCm: 0, zCm: 0, rotationZDeg: 270, wallId: 'right' } },
      ],
      pointerXCm: 770, pointerYCm: 50, rotationZDeg: 90, expectedX: 770, expectedY: 0,
    },
  ];

  scenarios.forEach((scenario) => {
    const snapped = snapPlacementToModules({
      moduleId: 'counter',
      moduleType: 'counter',
      widthCm: 100,
      depthCm: 50,
      pointerXCm: scenario.pointerXCm,
      pointerYCm: scenario.pointerYCm,
      rotationZDeg: scenario.rotationZDeg,
      modules: scenario.modules,
      standType: scenario.standType,
      standXCm: 800,
      standYCm: 600,
    });

    assert.equal(snapped?.snapKind, 'corner-face', scenario.name);
    assert.equal(snapped?.placement.xCm, scenario.expectedX, scenario.name);
    assert.equal(snapped?.placement.yCm, scenario.expectedY, scenario.name);
    assert.equal(validatePlacementAgainstModules({
      moduleId: 'counter',
      moduleType: 'counter',
      widthCm: 100,
      depthCm: 50,
      placement: snapped.placement,
      modules: scenario.modules,
      standType: scenario.standType,
      standXCm: 800,
      standYCm: 600,
    }).ok, true, scenario.name);
  });
});

test('all banko widths fit exact logical grid gaps next to thin modules', () => {
  [100, 150, 200].forEach((widthCm) => {
    const modules = [{
      id: 'separator',
      type: 'separator',
      widthCm: 300,
      placement: { xCm: widthCm, yCm: 0, zCm: 0, rotationZDeg: 90, wallId: 'right' },
    }];

    const snapped = snapPlacementToModules({
      moduleId: 'counter',
      moduleType: 'counter',
      widthCm,
      depthCm: 50,
      pointerXCm: widthCm / 2,
      pointerYCm: 125,
      rotationZDeg: 0,
      modules,
      standType: 'u-stand',
      standXCm: widthCm,
      standYCm: 400,
    });

    assert.equal(snapped?.snapKind, 'face', String(widthCm));
    assert.equal(snapped?.placement.xCm, 0, String(widthCm));
    assert.equal(validatePlacementAgainstModules({
      moduleId: 'counter',
      moduleType: 'counter',
      widthCm,
      depthCm: 50,
      placement: snapped.placement,
      modules,
      standType: 'u-stand',
      standXCm: widthCm,
      standYCm: 400,
    }).ok, true, String(widthCm));
  });
});

test('thin modules may snap to a banko endpoint symmetrically', () => {
  const modules = [{
    id: 'counter-target',
    type: 'counter',
    widthCm: 100,
    depthCm: 50,
    placement: { xCm: 100, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];

  const snapped = snapPlacementToModules({
    moduleId: 'separator',
    moduleType: 'separator',
    widthCm: 50,
    pointerXCm: 200,
    pointerYCm: 125,
    rotationZDeg: 90,
    modules,
    standType: 'island',
    standXCm: 500,
    standYCm: 500,
  });

  assert.equal(snapped?.snapKind, 'corner');
  assert.equal(snapped?.placement.xCm, 200);
  assert.equal(snapped?.placement.yCm, 100);
});

test('physical module depth rejects parallel bodies that are too close', () => {
  const modules = [{
    id: 'a',
    widthCm: 200,
    placement: { xCm: 100, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];

  const tooClose = validatePlacementAgainstModules({
    moduleId: 'b',
    widthCm: 200,
    placement: { xCm: 100, yCm: 109, zCm: 0, rotationZDeg: 0, wallId: 'free' },
    modules,
    standType: 'back-wall',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(tooClose.ok, false);

  const justTouching = validatePlacementAgainstModules({
    moduleId: 'b',
    widthCm: 200,
    placement: { xCm: 100, yCm: 110, zCm: 0, rotationZDeg: 0, wallId: 'free' },
    modules,
    standType: 'back-wall',
    standXCm: 800,
    standYCm: 600,
  });
  assert.equal(justTouching.ok, true);
});


test('plans free context insertion without wall capacity', () => {
  const source = {
    id: 'source',
    widthCm: 100,
    placement: { xCm: 300, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };
  const inserted = [{ id: 'new-1', widthCm: 200 }];
  const result = planFreeSideInsertion({
    modules: [source],
    insertedModules: inserted,
    targetModuleId: source.id,
    side: 'right',
    standType: 'u-stand',
    standXCm: 1000,
    standYCm: 1000,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.placements.get('new-1'), {
    xCm: 400,
    yCm: 300,
    zCm: 0,
    rotationZDeg: 0,
    wallId: 'free',
  });
});

test('free context visual right follows all four module rotations', () => {
  const cases = [
    [0, 400, 300],
    [90, 200, 300],
    [180, 200, 300],
    [270, 400, 300],
  ];

  cases.forEach(([rotationZDeg, expectedAxisValue, expectedOtherValue]) => {
    const source = {
      id: 'source-' + rotationZDeg,
      widthCm: 100,
      placement: { xCm: 300, yCm: 300, zCm: 0, rotationZDeg, wallId: 'free' },
    };
    const inserted = [{ id: 'new-' + rotationZDeg, widthCm: 100 }];
    const result = planFreeSideInsertion({
      modules: [source],
      insertedModules: inserted,
      targetModuleId: source.id,
      side: 'right',
      standType: 'island',
      standXCm: 1000,
      standYCm: 1000,
    });
    assert.equal(result.ok, true);
    const next = result.placements.get(inserted[0].id);
    if (rotationZDeg === 0 || rotationZDeg === 180) {
      assert.equal(next.xCm, expectedAxisValue);
      assert.equal(next.yCm, expectedOtherValue);
    } else {
      assert.equal(next.yCm, expectedAxisValue);
      assert.equal(next.xCm, expectedOtherValue);
    }
  });
});

test('free left batch keeps visual order while placing nearest module last in the selection', () => {
  const source = {
    id: 'source',
    widthCm: 100,
    placement: { xCm: 500, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };
  const inserted = [
    { id: 'a', widthCm: 50 },
    { id: 'b', widthCm: 100 },
  ];
  const result = planFreeSideInsertion({
    modules: [source],
    insertedModules: inserted,
    targetModuleId: source.id,
    side: 'left',
    standType: 'island',
    standXCm: 1000,
    standYCm: 1000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.placements.get('a').xCm, 350);
  assert.equal(result.placements.get('b').xCm, 400);
});



test('free-side insertion supports strict-depth fixtures without throwing', () => {
  const source = {
    id: 'counter-source',
    itemKey: 'desk_banko_100',
    type: 'counter',
    widthCm: 100,
    depthCm: 50,
    placement: { xCm: 100, yCm: 100, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };
  const stool = {
    id: 'stool-new',
    itemKey: 'furniture_bar_stool_classic',
    type: 'bar-stool',
    widthCm: 60,
    depthCm: 55,
    placement: { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 270, wallId: 'free' },
  };

  const result = planFreeSideInsertion({
    modules: [source],
    insertedModules: [stool],
    targetModuleId: source.id,
    side: 'right',
    standType: 'island',
    standXCm: 500,
    standYCm: 500,
  });

  assert.equal(result.ok, true);
  assert.equal(result.placements.has(stool.id), true);
  assert.equal(result.placements.get(stool.id).rotationZDeg, 270);
});

test('free context insertion rejects stand overflow and real collision', () => {
  const edgeSource = {
    id: 'edge-source',
    widthCm: 100,
    placement: { xCm: 0, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };
  const overflow = planFreeSideInsertion({
    modules: [edgeSource],
    insertedModules: [{ id: 'outside', widthCm: 100 }],
    targetModuleId: edgeSource.id,
    side: 'left',
    standType: 'island',
    standXCm: 1000,
    standYCm: 1000,
  });
  assert.equal(overflow.ok, false);
  assert.match(overflow.message, /stand alanını aşıyor/i);

  const source = {
    id: 'source',
    widthCm: 100,
    placement: { xCm: 300, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };
  const blocker = {
    id: 'blocker',
    widthCm: 100,
    placement: { xCm: 400, yCm: 300, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  };
  const collision = planFreeSideInsertion({
    modules: [source, blocker],
    insertedModules: [{ id: 'blocked', widthCm: 100 }],
    targetModuleId: source.id,
    side: 'right',
    standType: 'island',
    standXCm: 1000,
    standYCm: 1000,
  });
  assert.equal(collision.ok, false);
  assert.match(collision.message, /çakışıyor/i);
});


test('Panel Bazalı with 50 cm physical base still uses flat-panel corner snap', () => {
  const modules = [{
    id: 'target',
    type: 'flat-panel',
    widthCm: 200,
    placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];
  const result = snapPlacementToModules({
    moduleId: 'base-wall-moving',
    moduleType: 'base-wall',
    widthCm: 100,
    depthCm: 50,
    pointerXCm: 302,
    pointerYCm: 248,
    rotationZDeg: 90,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });

  assert.equal(result?.snapKind, 'corner');
  assert.deepEqual(result?.placement, {
    xCm: 300, yCm: 200, zCm: 0, rotationZDeg: 90, wallId: 'free',
  });
});


test('50 cm panel snaps centered to the short side of Banko 150', () => {
  const modules = [{
    id: 'counter-150',
    type: 'counter',
    widthCm: 150,
    depthCm: 50,
    placement: { xCm: 100, yCm: 200, zCm: 0, rotationZDeg: 0, wallId: 'free' },
  }];

  const result = snapPlacementToModules({
    moduleId: 'panel-50',
    moduleType: 'flat-panel',
    widthCm: 50,
    pointerXCm: 250,
    pointerYCm: 200,
    rotationZDeg: 90,
    modules,
    standType: 'island',
    standXCm: 800,
    standYCm: 600,
  });

  assert.equal(result?.snapKind, 'fixture-side');
  assert.deepEqual(result?.placement, {
    xCm: 250, yCm: 175, zCm: 0, rotationZDeg: 90, wallId: 'free',
  });
});


test('every module type uses the 10 cm free-placement grid', () => {
  assert.equal(getModulePlacementSnapCm('sofa-set-classic'), 10);
  assert.equal(getModulePlacementSnapCm('table-chair-set-eames'), 10);
  assert.equal(getModulePlacementSnapCm('chair'), 10);
  assert.equal(getModulePlacementSnapCm('table-glass'), 10);
  assert.equal(getModulePlacementSnapCm('counter'), 10);

  for (const moduleType of ['sofa-set-classic', 'table-chair-set-eames']) {
    const result = snapPlacementToStand({
      standType: 'island',
      moduleType,
      widthCm: 150,
      depthCm: 150,
      forceFree: true,
      pointerXCm: 343,
      pointerYCm: 343,
      standXCm: 800,
      standYCm: 600,
    });
    assert.equal(result.ok, true);
    assert.equal(result.placement.wallId, 'free');
    assert.equal(result.placement.xCm, 270);
    assert.equal(result.placement.yCm, 345);
  }

  const regular = snapPlacementToStand({
    standType: 'island',
    moduleType: 'counter',
    widthCm: 150,
    depthCm: 150,
    forceFree: true,
    pointerXCm: 343,
    pointerYCm: 343,
    standXCm: 800,
    standYCm: 600,
  });
  // Banko da mobilyayla aynı 10 cm ızgaraya oturur.
  assert.equal(regular.ok, true);
  assert.equal(regular.placement.xCm, 270);
  assert.equal(regular.placement.yCm, 345);
});
