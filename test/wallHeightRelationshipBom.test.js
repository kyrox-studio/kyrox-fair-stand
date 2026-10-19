import test from 'node:test';
import assert from 'node:assert/strict';

import './registerCanonicalItemCatalog.mjs';
import { createModulePlacement } from '../src/modulePlacement.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { detectRelationshipJoints } from '../src/relationshipBom.js';

// 250 cm duvar = 5 bant. Kurallar 350 (7 bant) ile aynı: uç yüzey B, standart tekli 2B − 1,
// köşe aparatı B − 1; eklemde kalkan dikme o yüksekliğin dikmesidir.

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
  return { id, itemKey, widthCm, placement: createModulePlacement({ xCm, yCm, rotationZDeg }) };
}

test('250 cm wall_200 end-to-end → 3 upright_247_5, 8 single, 5 double', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_200_250', { xCm: 0, widthCm: 200 }),
    placed('b', 'wall_200_250', { xCm: 200, widthCm: 200 }),
  ]);
  assert.equal(bom.appliedJointCount, 1);
  assert.equal(qty(bom, 'upright_247_5'), 3);
  assert.equal(qty(bom, 'upright_346_5'), 0);
  assert.equal(qty(bom, 'panel_197'), 10);
  assert.equal(qty(bom, 'profile_190'), 4);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'connector_single'), 8);
  assert.equal(qty(bom, 'connector_double'), 5);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 4);
  assert.equal(moduleQty(bom, 'a', 'connector_double'), 5);
});

test('250 cm corner: front-facing wall takes 4 corner connectors and 5 corner panels', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_100_250', { xCm: 0, widthCm: 100 }),
    placed('b', 'wall_100_250', { xCm: 100, yCm: 0, rotationZDeg: 90, widthCm: 100 }),
  ]);
  assert.equal(bom.appliedCornerCount, 1);
  assert.equal(qty(bom, 'upright_247_5'), 3);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'connector_single'), 14);
  assert.equal(qty(bom, 'connector_corner'), 4);
  assert.equal(qty(bom, 'panel_corner_92'), 5);
  assert.equal(qty(bom, 'panel_98'), 5);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 5);
  assert.equal(moduleQty(bom, 'b', 'connector_single'), 9);
});

test('250 cm tee into the middle of a wall shares one upright_247_5, no doubles', () => {
  const modules = [
    placed('a', 'wall_200_250', { xCm: 0, widthCm: 200 }),
    placed('b', 'wall_100_250', { xCm: 100, yCm: 0, rotationZDeg: 270, widthCm: 100 }),
  ];
  assert.equal(detectRelationshipJoints(modules)[0].kind, 'tee');
  const bom = resolveProjectBom(modules);
  assert.equal(bom.appliedTeeCount, 1);
  assert.equal(qty(bom, 'upright_247_5'), 3);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_corner'), 4);
  assert.equal(qty(bom, 'panel_197'), 5);
  assert.equal(qty(bom, 'panel_corner_92'), 5);
});

test('500 cm end-to-end scales the same rule: 10 doubles, upright_495', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_100_500', { xCm: 0, widthCm: 100 }),
    placed('b', 'wall_100_500', { xCm: 100, widthCm: 100 }),
  ]);
  assert.equal(qty(bom, 'upright_495'), 3);
  assert.equal(qty(bom, 'connector_double'), 10);
  assert.equal(qty(bom, 'connector_single'), 18);
});

// Kapı ve vitrin (0069): B = panel sayısı (250'de kapı 1, 2 gözlü 3, 3 gözlü 2).
test('250 cm wall + door end-to-end: wall keeps 4 singles, door 0, 1 double', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_100_250', { xCm: 0, widthCm: 100 }),
    placed('d', 'wall_door_100_250', { xCm: 100, widthCm: 100 }),
  ]);
  assert.equal(bom.appliedJointCount, 1);
  assert.equal(qty(bom, 'upright_247_5'), 3);
  assert.equal(qty(bom, 'connector_double'), 1);
  assert.equal(qty(bom, 'connector_single'), 4);
  assert.equal(qty(bom, 'door_leaf_100'), 1);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 4);
  assert.equal(moduleQty(bom, 'd', 'connector_single'), 0);
});

test('250 cm wall + door inner corner: 4 corner connectors from the wall, door panel becomes a corner panel', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_100_250', { xCm: 0, widthCm: 100 }),
    placed('d', 'wall_door_100_250', { xCm: 100, yCm: 0, rotationZDeg: 270, widthCm: 100 }),
  ]);
  assert.equal(bom.appliedCornerCount, 1);
  assert.equal(qty(bom, 'upright_247_5'), 3);
  assert.equal(qty(bom, 'connector_corner'), 4);
  assert.equal(qty(bom, 'panel_corner_92'), 6);
  assert.equal(qty(bom, 'panel_98'), 0);
});

test('250 cm showcase-2 tee into a wall: 2 corner connectors, 3 corner panels, showcase parts stay', () => {
  const modules = [
    placed('a', 'wall_200_250', { xCm: 0, widthCm: 200 }),
    placed('s', 'wall_showcase_100_2_250', { xCm: 100, yCm: 0, rotationZDeg: 270, widthCm: 100 }),
  ];
  assert.equal(detectRelationshipJoints(modules)[0].kind, 'tee');
  const bom = resolveProjectBom(modules);
  assert.equal(bom.appliedTeeCount, 1);
  assert.equal(qty(bom, 'upright_247_5'), 3);
  assert.equal(qty(bom, 'connector_corner'), 2);
  assert.equal(qty(bom, 'connector_single'), 9 + 3);
  assert.equal(qty(bom, 'panel_corner_92'), 3);
  assert.equal(qty(bom, 'glass_shelf'), 1);
  assert.equal(qty(bom, 'showcase_side_94_6_30'), 2);
});

test('350 cm door and showcase joints keep the locked counts', () => {
  const bom = resolveProjectBom([
    placed('a', 'wall_100_350', { xCm: 0, widthCm: 100 }),
    placed('d', 'wall_door_100_350', { xCm: 100, widthCm: 100 }),
  ]);
  assert.equal(qty(bom, 'connector_single'), 8);
  assert.equal(qty(bom, 'connector_double'), 3);
  assert.equal(qty(bom, 'upright_346_5'), 3);
});
