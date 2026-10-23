import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeModuleItemState } from '../src/designState.js';
import { resolveItemBom } from '../src/itemBom.js';
import {
  getItem,
  initializeItemRegistry,
  isWallShortFamilyDescriptor,
  listRegisteredItems,
} from '../src/items.js';
import { getModuleMagneticSnapStrategy } from '../src/moduleBehavior.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { relationshipBomRole } from '../src/relationshipBom.js';
import { initializeStandDimensions } from '../src/standDimensions.js';
import { CANONICAL_STAND_DIMENSIONS } from './mapCatalogSeed.mjs';

function qty(bom, itemKey) {
  const line = bom.lines.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

function moduleQty(bom, moduleId, itemKey) {
  const module = bom.modules.find((entry) => entry.moduleId === moduleId);
  const line = module?.lines?.find((entry) => entry.itemKey === itemKey);
  return line ? line.quantity : 0;
}

function frame(id, itemKey, {
  xCm = 0,
  yCm = 0,
  zCm = 0,
  rotationZDeg = 0,
  widthCm,
  heightCm,
} = {}) {
  const item = getItem(itemKey);
  return {
    id,
    itemKey,
    type: item?.type ?? null,
    variant: item?.variant,
    widthCm,
    heightCm,
    placement: { xCm, yCm, zCm, rotationZDeg, wallId: 'free' },
  };
}

function short1(id, itemKey, fields) {
  return frame(id, itemKey, { zCm: 300, heightCm: 50, ...fields });
}

function short2(id, itemKey, fields) {
  return frame(id, itemKey, { zCm: 250, heightCm: 100, ...fields });
}

function cornerPartner(id, itemKey, widthCm, { xCm, yCm = 0, zCm = 0, heightCm }) {
  return frame(id, itemKey, { xCm, yCm, zCm, rotationZDeg: 270, widthCm, heightCm });
}

const SPAN_ALPHA = 'profile_span_fixture_alpha';
const SPAN_BETA = 'profile_span_fixture_beta';

function withSpanFixtures(run) {
  const current = listRegisteredItems().map((item) => structuredClone(item));
  const fixture = (itemKey, widthCm) => ({
    itemKey,
    name: itemKey,
    type: 'profile',
    unit: 'adet',
    dimensions: { widthCm, depthCm: 8, heightCm: 8 },
    sceneDimensions: { widthCm, depthCm: 8, heightCm: 8 },
  });
  initializeItemRegistry([
    ...current,
    fixture(SPAN_ALPHA, 480),
    fixture(SPAN_BETA, 480),
  ]);
  try {
    return run();
  } finally {
    initializeItemRegistry(current);
  }
}

test('wall short standard snap structural partners are framed roles with uprights', () => {
  assert.equal(
    getModuleMagneticSnapStrategy({ itemKey: 'wall_200_short_1', type: 'flat-panel' }),
    'standard',
  );
  assert.equal(isWallShortFamilyDescriptor({ itemKey: 'wall_200_short_1' }), true);
  assert.equal(relationshipBomRole({ itemKey: 'wall_200_short_1', type: 'flat-panel' }), null);

  const roles = new Set();
  for (const item of listRegisteredItems()) {
    const role = relationshipBomRole({ itemKey: item.itemKey, type: item.type });
    if (!role) continue;
    roles.add(role);
    const upright = (item.composition?.items ?? []).some((row) => getItem(row.itemKey)?.type === 'upright');
    const single = (item.composition?.items ?? []).some((row) => row.itemKey === 'connector_single');
    assert.equal(upright, true, item.itemKey);
    assert.equal(single, true, item.itemKey);
  }
  assert.deepEqual(
    [...roles].sort(),
    ['door', 'separator', 'showcase-2', 'showcase-3', 'wall'],
  );
  for (const itemKey of ['profile_190', 'base_200', 'desk_banko_200', 'shelf_200']) {
    assert.equal(relationshipBomRole({ itemKey, type: getItem(itemKey)?.type }), null, itemKey);
  }
});

test('standalone wall_200_short_1 keeps its recipe', () => {
  const bom = resolveProjectBom([
    short1('a', 'wall_200_short_1', { widthCm: 200 }),
  ]);
  for (const line of resolveItemBom('wall_200_short_1')) {
    assert.equal(qty(bom, line.itemKey), line.quantity, line.itemKey);
  }
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'upright_346_5'), 0);
});

test('WS1 + full wall end-to-end drops one short upright and one double, not the full-height post', () => {
  const bom = resolveProjectBom([
    short1('a', 'wall_200_short_1', { widthCm: 200 }),
    frame('b', 'wall_200_350', { xCm: 200, widthCm: 200, heightCm: 350 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 1);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'connector_single'), 14);
  assert.equal(qty(bom, 'connector_double'), 1);
  assert.equal(moduleQty(bom, 'a', 'connector_single'), 2);
  assert.equal(moduleQty(bom, 'a', 'connector_double'), 1);
  assert.equal(moduleQty(bom, 'b', 'connector_single'), 12);
  assert.equal(moduleQty(bom, 'b', 'connector_double'), 1);
  assert.equal(qty(bom, 'connector_corner'), 0);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'profile_190'), 4);
  assert.equal(qty(bom, 'panel_197'), 8);
});

test('WS2 + full wall end-to-end drops upright_99 and still adds one double', () => {
  const bom = resolveProjectBom([
    short2('a', 'wall_200_short_2', { widthCm: 200 }),
    frame('b', 'wall_200_350', { xCm: 200, widthCm: 200, heightCm: 350 }),
  ]);
  assert.equal(qty(bom, 'upright_99'), 1);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'connector_single'), 14);
  assert.equal(qty(bom, 'connector_double'), 1);
  assert.equal(moduleQty(bom, 'a', 'connector_double'), 1);
  assert.equal(moduleQty(bom, 'b', 'connector_double'), 1);
  assert.equal(qty(bom, 'panel_197'), 9);
});

test('short 2 corner converts only the two wall bands it covers', () => {
  const bom = resolveProjectBom([
    frame('wall', 'wall_100_350', { widthCm: 100, heightCm: 350 }),
    short2('short', 'wall_200_short_2', { widthCm: 200, rotationZDeg: 270 }),
  ]);
  assert.equal(qty(bom, 'connector_corner'), 1);
  assert.equal(qty(bom, 'panel_corner_92'), 2);
  assert.equal(qty(bom, 'panel_98'), 5);
  assert.equal(qty(bom, 'panel_197'), 2);
  assert.equal(qty(bom, 'panel_corner_192'), 0);
  assert.equal(moduleQty(bom, 'wall', 'connector_corner'), 1);
  assert.equal(moduleQty(bom, 'wall', 'connector_single'), 12);
  assert.equal(moduleQty(bom, 'short', 'connector_corner'), 0);
  assert.equal(moduleQty(bom, 'short', 'panel_197'), 2);
});

test('WS + full wall corner swaps the short and the overlapped wall band', () => {
  const bom = resolveProjectBom([
    short1('a', 'wall_200_short_1', { widthCm: 200 }),
    cornerPartner('b', 'wall_150_350', 150, { xCm: 200, heightCm: 350 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 1);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'connector_single'), 14);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_corner'), 2);
  assert.equal(qty(bom, 'panel_corner_192'), 1);
  assert.equal(qty(bom, 'panel_corner_142_5'), 1);
  assert.equal(qty(bom, 'panel_197'), 0);
  assert.equal(qty(bom, 'panel_147_5'), 6);
});

test('WS branch into a full wall tee drops only the branch upright', () => {
  const bom = resolveProjectBom([
    frame('host', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    cornerPartner('branch', 'wall_100_short_1', 100, { xCm: 100, zCm: 300, heightCm: 50 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 1);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'connector_single'), 15);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_corner'), 1);
  assert.equal(qty(bom, 'panel_197'), 7);
  assert.equal(qty(bom, 'panel_corner_92'), 1);
  assert.equal(qty(bom, 'panel_98'), 0);
});

test('WS face contact with a full wall does not change BOM', () => {
  const alone = [
    short1('a', 'wall_200_short_1', { widthCm: 200 }),
    frame('b', 'wall_200_350', { yCm: 10, widthCm: 200, heightCm: 350 }),
  ];
  const bom = resolveProjectBom(alone);
  assert.equal(qty(bom, 'upright_49_5'), 2);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'connector_single'), 16);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_corner'), 0);
});

test('WS outside the full-height Z band does not join', () => {
  const bom = resolveProjectBom([
    short1('a', 'wall_100_short_1', { widthCm: 100, zCm: 400 }),
    frame('b', 'wall_door_100_350', { xCm: 100, widthCm: 100, heightCm: 350 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 2);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'connector_single'), 8);
  assert.equal(qty(bom, 'connector_double'), 0);
});

function assertStructuralEnd(partnerKey, partnerWidth, shortKey, uprightKey, expected) {
  const bom = resolveProjectBom([
    shortKey.endsWith('_2')
      ? short2('a', shortKey, { widthCm: partnerWidth })
      : short1('a', shortKey, { widthCm: partnerWidth }),
    frame('b', partnerKey, { xCm: partnerWidth, widthCm: partnerWidth, heightCm: 350 }),
  ]);
  assert.equal(qty(bom, uprightKey), 1, `${partnerKey} ${uprightKey}`);
  assert.equal(qty(bom, 'upright_346_5'), 2, partnerKey);
  assert.equal(qty(bom, 'connector_single'), expected.single, partnerKey);
  assert.equal(qty(bom, 'connector_double'), 1, partnerKey);
  assert.notEqual(qty(bom, 'connector_double'), expected.forbiddenDouble, partnerKey);
  assert.equal(qty(bom, 'connector_corner'), 0, partnerKey);
}

test('WS1 and WS2 end-to-end with door use one double, not the full-height 3', () => {
  assertStructuralEnd('wall_door_100_350', 100, 'wall_100_short_1', 'upright_49_5', { single: 6, forbiddenDouble: 3 });
  assertStructuralEnd('wall_door_100_350', 100, 'wall_100_short_2', 'upright_99', { single: 6, forbiddenDouble: 3 });
  const corner = resolveProjectBom([
    short1('a', 'wall_100_short_1', { widthCm: 100 }),
    cornerPartner('b', 'wall_door_100_350', 100, { xCm: 100, heightCm: 350 }),
  ]);
  assert.equal(qty(corner, 'upright_49_5'), 1);
  assert.equal(qty(corner, 'upright_346_5'), 2);
  assert.equal(qty(corner, 'connector_single'), 6);
  assert.equal(qty(corner, 'connector_corner'), 2);
  assert.equal(qty(corner, 'connector_double'), 0);
  assert.equal(qty(corner, 'panel_corner_92'), 2);
  assert.equal(qty(corner, 'panel_98'), 2);
  assert.equal(qty(corner, 'door_leaf_100'), 1);
  const tee = resolveProjectBom([
    frame('host', 'wall_door_100_350', { widthCm: 100, heightCm: 350 }),
    cornerPartner('branch', 'wall_100_short_2', 100, { xCm: 50, zCm: 250, heightCm: 100 }),
  ]);
  assert.equal(qty(tee, 'upright_99'), 1);
  assert.equal(qty(tee, 'upright_346_5'), 2);
  assert.equal(qty(tee, 'connector_single'), 7);
  assert.equal(qty(tee, 'connector_corner'), 1);
  assert.equal(qty(tee, 'connector_double'), 0);
  assert.equal(qty(tee, 'panel_98'), 3);
  assert.equal(qty(tee, 'panel_corner_92'), 2);
});

test('WS separator joints stay on the short band and keep separator panels', () => {
  assertStructuralEnd('wall_separator_100_350', 100, 'wall_100_short_1', 'upright_49_5', { single: 14, forbiddenDouble: 7 });
  assertStructuralEnd('wall_separator_100_350', 100, 'wall_100_short_2', 'upright_99', { single: 14, forbiddenDouble: 7 });
  // 0071: 50’lik sarmaşık 13 tekli; 100’lük ayırıcı ile aynı sonuç.
  assertStructuralEnd('wall_separator_50_350_sarmasik', 50, 'wall_50_short_1', 'upright_49_5', { single: 14, forbiddenDouble: 7 });
  const corner = resolveProjectBom([
    short1('a', 'wall_100_short_1', { widthCm: 100 }),
    cornerPartner('b', 'wall_separator_100_350', 100, { xCm: 100, heightCm: 350 }),
  ]);
  assert.equal(qty(corner, 'connector_corner'), 2);
  assert.equal(qty(corner, 'connector_double'), 0);
  assert.equal(qty(corner, 'separator_panel_98'), 7);
  assert.equal(qty(corner, 'panel_corner_92'), 1);
  assert.equal(qty(corner, 'panel_corner_92'), 1);
  assert.equal(qty(corner, 'upright_346_5'), 2);
  const tee = resolveProjectBom([
    frame('host', 'wall_separator_100_350', { widthCm: 100, heightCm: 350 }),
    cornerPartner('branch', 'wall_100_short_1', 100, { xCm: 50, zCm: 300, heightCm: 50 }),
  ]);
  assert.equal(qty(tee, 'separator_panel_98'), 7);
  assert.equal(qty(tee, 'panel_corner_92'), 1);
  assert.equal(qty(tee, 'connector_corner'), 1);
  assert.equal(qty(tee, 'connector_double'), 0);
  assert.equal(qty(tee, 'upright_49_5'), 1);
});

test('WS showcase joints do not copy the full-height showcase doubles', () => {
  assertStructuralEnd('wall_showcase_100_2_350', 100, 'wall_100_short_1', 'upright_49_5', { single: 10, forbiddenDouble: 5 });
  assertStructuralEnd('wall_showcase_100_2_350', 100, 'wall_100_short_2', 'upright_99', { single: 10, forbiddenDouble: 5 });
  assertStructuralEnd('wall_showcase_100_3_350', 100, 'wall_100_short_1', 'upright_49_5', { single: 8, forbiddenDouble: 4 });
  assertStructuralEnd('wall_showcase_100_3_350', 100, 'wall_100_short_2', 'upright_99', { single: 8, forbiddenDouble: 4 });
  const corner = resolveProjectBom([
    short2('a', 'wall_100_short_2', { widthCm: 100 }),
    cornerPartner('b', 'wall_showcase_100_3_350', 100, { xCm: 100, heightCm: 350 }),
  ]);
  assert.equal(qty(corner, 'connector_corner'), 2);
  assert.equal(qty(corner, 'connector_double'), 0);
  assert.equal(qty(corner, 'panel_98'), 2);
  assert.equal(qty(corner, 'panel_corner_92'), 4);
  assert.equal(qty(corner, 'glass_shelf'), 2);
  assert.equal(qty(corner, 'upright_99'), 1);
  assert.equal(qty(corner, 'upright_346_5'), 2);
  const tee = resolveProjectBom([
    frame('host', 'wall_showcase_100_2_350', { widthCm: 100, heightCm: 350 }),
    cornerPartner('branch', 'wall_100_short_1', 100, { xCm: 50, zCm: 300, heightCm: 50 }),
  ]);
  assert.equal(qty(tee, 'panel_98'), 5);
  assert.equal(qty(tee, 'panel_corner_92'), 1);
  assert.equal(qty(tee, 'glass_shelf'), 1);
  assert.equal(qty(tee, 'connector_corner'), 1);
  assert.equal(qty(tee, 'connector_double'), 0);
});

test('same-height wall shorts share one upright and one double', () => {
  const pair1 = resolveProjectBom([
    short1('a', 'wall_200_short_1', { widthCm: 200 }),
    short1('b', 'wall_150_short_1', { xCm: 200, widthCm: 150 }),
  ]);
  assert.equal(qty(pair1, 'upright_49_5'), 3);
  assert.equal(qty(pair1, 'connector_single'), 4);
  assert.equal(qty(pair1, 'connector_double'), 1);
  assert.equal(qty(pair1, 'profile_190'), 0);
  assert.equal(qty(pair1, 'profile_140_5'), 0);
  assert.equal(qty(pair1, 'profile_346_5'), 2);
  assert.equal(qty(pair1, 'profile_289'), 0);
  assert.equal(qty(pair1, 'profile_41_5'), 0);
  assert.equal(qty(pair1, 'panel_197'), 1);
  assert.equal(qty(pair1, 'panel_147_5'), 1);
  const pair2 = resolveProjectBom([
    short2('a', 'wall_100_short_2', { widthCm: 100 }),
    short2('b', 'wall_100_short_2', { xCm: 100, widthCm: 100 }),
  ]);
  assert.equal(qty(pair2, 'upright_99'), 3);
  assert.equal(qty(pair2, 'connector_single'), 4);
  assert.equal(qty(pair2, 'connector_double'), 1);
  assert.equal(qty(pair2, 'profile_91'), 0);
  assert.equal(qty(pair2, 'profile_190'), 2);
  const corner = resolveProjectBom([
    short1('a', 'wall_100_short_1', { widthCm: 100 }),
    cornerPartner('b', 'wall_100_short_1', 100, { xCm: 100, zCm: 300, heightCm: 50 }),
  ]);
  assert.equal(qty(corner, 'upright_49_5'), 3);
  assert.equal(qty(corner, 'connector_single'), 4);
  assert.equal(qty(corner, 'connector_corner'), 2);
  assert.equal(qty(corner, 'connector_double'), 0);
  assert.equal(qty(corner, 'panel_corner_92'), 2);
  assert.equal(qty(corner, 'panel_98'), 0);
  const tee = resolveProjectBom([
    short1('host', 'wall_200_short_1', { widthCm: 200 }),
    cornerPartner('branch', 'wall_100_short_1', 100, { xCm: 100, zCm: 300, heightCm: 50 }),
  ]);
  assert.equal(qty(tee, 'upright_49_5'), 3);
  assert.equal(qty(tee, 'connector_single'), 5);
  assert.equal(qty(tee, 'connector_corner'), 1);
  assert.equal(qty(tee, 'connector_double'), 0);
  assert.equal(qty(tee, 'panel_197'), 1);
  assert.equal(qty(tee, 'panel_corner_92'), 1);
});

test('full-height branch into a wall short host keeps the tall upright and the host panel', () => {
  const bom = resolveProjectBom([
    short1('host', 'wall_200_short_1', { widthCm: 200 }),
    cornerPartner('branch', 'wall_100_350', 100, { xCm: 100, heightCm: 350 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 2);
  assert.equal(qty(bom, 'upright_346_5'), 2);
  assert.equal(qty(bom, 'connector_single'), 15);
  assert.equal(qty(bom, 'connector_corner'), 1);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'panel_197'), 1);
  assert.equal(qty(bom, 'panel_corner_92'), 1);
  assert.equal(qty(bom, 'panel_98'), 6);
});

test('mixed-height containment drops only the contained upright', () => {
  const bom = resolveProjectBom([
    short1('small', 'wall_200_short_1', { widthCm: 200, zCm: 300 }),
    short2('tall', 'wall_200_short_2', { xCm: 200, widthCm: 200, zCm: 250 }),
  ]);
  assert.equal(qty(bom, 'upright_49_5'), 1);
  assert.equal(qty(bom, 'upright_99'), 2);
  assert.equal(qty(bom, 'upright_346_5'), 0);
  assert.equal(qty(bom, 'connector_single'), 4);
  assert.equal(qty(bom, 'connector_double'), 1);
  const corner = resolveProjectBom([
    short1('a', 'wall_100_short_1', { widthCm: 100, zCm: 300 }),
    cornerPartner('b', 'wall_100_short_2', 100, { xCm: 100, zCm: 250, heightCm: 100 }),
  ]);
  assert.equal(qty(corner, 'upright_49_5'), 1);
  assert.equal(qty(corner, 'upright_99'), 2);
  assert.equal(qty(corner, 'connector_corner'), 3);
  assert.equal(qty(corner, 'connector_single'), 3);
  assert.equal(qty(corner, 'connector_double'), 0);
  assert.equal(qty(corner, 'panel_corner_92'), 3);
  assert.equal(qty(corner, 'panel_98'), 0);
});

test('partial Z overlap and disjoint wall shorts do not transform BOM', () => {
  const partial = resolveProjectBom([
    short1('a', 'wall_100_short_1', { widthCm: 100, zCm: 200 }),
    short2('b', 'wall_100_short_2', { xCm: 100, widthCm: 100, zCm: 230 }),
  ]);
  assert.equal(qty(partial, 'upright_49_5'), 2);
  assert.equal(qty(partial, 'upright_99'), 2);
  assert.equal(qty(partial, 'connector_single'), 6);
  assert.equal(qty(partial, 'connector_double'), 0);
  const apart = resolveProjectBom([
    short1('a', 'wall_100_short_1', { widthCm: 100, zCm: 0 }),
    short1('b', 'wall_100_short_1', { xCm: 100, widthCm: 100, zCm: 300 }),
  ]);
  assert.equal(qty(apart, 'upright_49_5'), 4);
  assert.equal(qty(apart, 'connector_single'), 6);
  assert.equal(qty(apart, 'connector_double'), 0);
});

test('profile rail replacement follows span and contact, not a SKU list', () => {
  withSpanFixtures(() => {
    const wall = () => short1('wall', 'wall_200_short_1', { widthCm: 200 });
    const rail = (id, itemKey, zCm, { xCm = -40, widthCm = 480, rotationZDeg = 0 } = {}) => frame(
      id,
      itemKey,
      { xCm, yCm: 0, zCm, rotationZDeg, widthCm, heightCm: 8 },
    );
    const bottom = resolveProjectBom([wall(), rail('p', SPAN_ALPHA, 292)]);
    assert.equal(qty(bottom, 'profile_190'), 1);
    assert.equal(qty(bottom, SPAN_ALPHA), 1);
    assert.equal(qty(bottom, 'upright_49_5'), 2);
    const top = resolveProjectBom([wall(), rail('p', SPAN_BETA, 350)]);
    assert.equal(qty(top, 'profile_190'), 1);
    assert.equal(qty(top, SPAN_BETA), 1);
    const both = resolveProjectBom([
      wall(),
      rail('bottom', SPAN_ALPHA, 292),
      rail('top', SPAN_BETA, 350),
    ]);
    assert.equal(qty(both, 'profile_190'), 0);
    assert.equal(qty(both, SPAN_ALPHA), 1);
    assert.equal(qty(both, SPAN_BETA), 1);
    const sameRail = resolveProjectBom([
      wall(),
      rail('p1', SPAN_ALPHA, 292),
      rail('p2', SPAN_BETA, 292),
    ]);
    assert.equal(qty(sameRail, 'profile_190'), 1);
    assert.equal(qty(sameRail, SPAN_ALPHA), 1);
    assert.equal(qty(sameRail, SPAN_BETA), 1);
    const turned = resolveProjectBom([wall(), rail('p', SPAN_ALPHA, 292, { rotationZDeg: 90, xCm: 0 })]);
    assert.equal(qty(turned, 'profile_190'), 2);
    const shortSpan = resolveProjectBom([wall(), rail('p', SPAN_ALPHA, 292, { xCm: 0, widthCm: 80 })]);
    assert.equal(qty(shortSpan, 'profile_190'), 2);
    const middle = resolveProjectBom([wall(), rail('p', SPAN_ALPHA, 320)]);
    assert.equal(qty(middle, 'profile_190'), 2);
    const wrongZ = resolveProjectBom([wall(), rail('p', SPAN_ALPHA, 200)]);
    assert.equal(qty(wrongZ, 'profile_190'), 2);
    const continuation = resolveProjectBom([wall(), rail('p', SPAN_ALPHA, 292, { xCm: 200, widthCm: 480 })]);
    assert.equal(qty(continuation, 'profile_190'), 2);
    assert.equal(qty(continuation, 'upright_49_5'), 2);
  });
});

test('mixed partners cannot consume one wall short slot twice', () => {
  withSpanFixtures(() => {
    const bom = resolveProjectBom([
      short1('wall', 'wall_200_short_1', { xCm: 200, widthCm: 200 }),
      frame('door', 'wall_door_100_350', { xCm: 100, widthCm: 100, heightCm: 350 }),
      frame('sep', 'wall_separator_100_350', { xCm: 400, widthCm: 100, heightCm: 350 }),
      frame('bottom', SPAN_ALPHA, { xCm: 100, yCm: 0, zCm: 292, widthCm: 480, heightCm: 8 }),
      frame('top', SPAN_BETA, { xCm: 100, yCm: 0, zCm: 350, widthCm: 480, heightCm: 8 }),
    ]);
    assert.equal(qty(bom, 'upright_49_5'), 0);
    assert.equal(qty(bom, 'profile_190'), 0);
    assert.equal(qty(bom, 'connector_single'), 17);
    assert.equal(qty(bom, 'connector_double'), 2);
    assert.equal(qty(bom, 'connector_start'), 6);
    assert.equal(qty(bom, 'upright_346_5'), 4);
    assert.equal(qty(bom, 'panel_197'), 1);
    assert.equal(qty(bom, SPAN_ALPHA), 1);
    assert.equal(qty(bom, SPAN_BETA), 1);
    assert.equal(qty(bom, 'door_leaf_100'), 1);
  });
});

test('every framed partner keeps the short-band joint and ignores full-height constants', () => {
  const partners = [
    ['wall_200_350', 200],
    ['wall_door_100_350', 100],
    ['wall_separator_50_350', 50],
    ['wall_separator_50_350_sarmasik', 50],
    ['wall_separator_100_350', 100],
    ['wall_separator_100_350_sarmasik', 100],
    ['wall_showcase_100_2_350', 100],
    ['wall_showcase_100_3_350', 100],
  ];
  for (const [partnerKey, widthCm] of partners) {
    for (const strip of [1, 2]) {
      const shortKey = `wall_${widthCm}_short_${strip}`;
      const uprightKey = strip === 1 ? 'upright_49_5' : 'upright_99';
      const placed = (id, fields) => (strip === 1
        ? short1(id, shortKey, { widthCm, ...fields })
        : short2(id, shortKey, { widthCm, ...fields }));
      const end = resolveProjectBom([
        placed('a'),
        frame('b', partnerKey, { xCm: widthCm, widthCm, heightCm: 350 }),
      ]);
      assert.equal(qty(end, uprightKey), 1, `${partnerKey} ${shortKey} e2e upright`);
      assert.equal(qty(end, 'upright_346_5'), 2, `${partnerKey} ${shortKey} e2e post`);
      assert.equal(qty(end, 'connector_double'), 1, `${partnerKey} ${shortKey} e2e double`);
      assert.equal(qty(end, 'connector_corner'), 0, `${partnerKey} ${shortKey} e2e corner`);
      const corner = resolveProjectBom([
        placed('a'),
        cornerPartner('b', partnerKey, widthCm, { xCm: widthCm, heightCm: 350 }),
      ]);
      assert.equal(qty(corner, uprightKey), 1, `${partnerKey} ${shortKey} corner upright`);
      assert.equal(qty(corner, 'upright_346_5'), 2, `${partnerKey} ${shortKey} corner post`);
      assert.equal(qty(corner, 'connector_double'), 0, `${partnerKey} ${shortKey} corner double`);
      assert.equal(qty(corner, 'connector_corner'), 2, `${partnerKey} ${shortKey} corner`);
      const tee = resolveProjectBom([
        frame('host', partnerKey, { widthCm, heightCm: 350 }),
        cornerPartner('branch', shortKey, widthCm, {
          xCm: widthCm / 2,
          zCm: strip === 1 ? 300 : 250,
          heightCm: strip === 1 ? 50 : 100,
        }),
      ]);
      assert.equal(qty(tee, uprightKey), 1, `${partnerKey} ${shortKey} tee upright`);
      assert.equal(qty(tee, 'upright_346_5'), 2, `${partnerKey} ${shortKey} tee post`);
      assert.equal(qty(tee, 'connector_double'), 0, `${partnerKey} ${shortKey} tee double`);
      assert.equal(qty(tee, 'connector_corner'), 1, `${partnerKey} ${shortKey} tee`);
      const mismatch = resolveProjectBom([
        placed('a', { zCm: 400 }),
        frame('b', partnerKey, { xCm: widthCm, widthCm, heightCm: 350 }),
      ]);
      assert.equal(qty(mismatch, uprightKey), 2, `${partnerKey} ${shortKey} z`);
      assert.equal(qty(mismatch, 'connector_double'), 0, `${partnerKey} ${shortKey} z double`);
      assert.equal(qty(mismatch, 'connector_corner'), 0, `${partnerKey} ${shortKey} z corner`);
    }
  }
});

test('a field upright on the free endpoint drops the second short upright once', () => {
  const pair = [
    short2('a', 'wall_200_short_2', { widthCm: 200 }),
    short2('b', 'wall_200_short_2', { xCm: 200, widthCm: 200 }),
  ];
  const sharedOnly = resolveProjectBom(pair);
  assert.equal(qty(sharedOnly, 'upright_99'), 3);
  const post = frame('post', 'upright_346_5', {
    xCm: 396,
    widthCm: 8,
    heightCm: 346.5,
  });
  const bom = resolveProjectBom([...pair, post]);
  assert.equal(qty(bom, 'upright_99'), 2);
  assert.equal(qty(bom, 'upright_346_5'), 1);
  assert.equal(qty(bom, 'connector_single'), qty(sharedOnly, 'connector_single'));
  assert.equal(qty(bom, 'connector_double'), qty(sharedOnly, 'connector_double'));
  assert.equal(qty(bom, 'connector_corner'), 0);
  assert.equal(qty(bom, 'connector_start'), qty(sharedOnly, 'connector_start'));
  assert.equal(qty(bom, 'profile_190'), qty(sharedOnly, 'profile_190'));
  assert.equal(qty(bom, 'panel_197'), qty(sharedOnly, 'panel_197'));
  const onSharedPoint = resolveProjectBom([
    ...pair,
    frame('post', 'upright_346_5', { xCm: 196, widthCm: 8, heightCm: 346.5 }),
  ]);
  assert.equal(qty(onSharedPoint, 'upright_99'), 3);
  assert.equal(qty(onSharedPoint, 'upright_346_5'), 1);
  const throughBody = resolveProjectBom([
    ...pair,
    frame('post', 'upright_346_5', { xCm: 96, widthCm: 8, heightCm: 346.5 }),
  ]);
  assert.equal(qty(throughBody, 'upright_99'), 3);
  const above = resolveProjectBom([
    ...pair,
    frame('post', 'upright_346_5', { xCm: 396, zCm: 400, widthCm: 8, heightCm: 346.5 }),
  ]);
  assert.equal(qty(above, 'upright_99'), 3);
  assert.equal(qty(above, 'upright_346_5'), 1);
});

test('saved scene upright at the short end counts on a 500 cm stand', () => {
  initializeStandDimensions({ ...CANONICAL_STAND_DIMENSIONS, heightCm: 500 });
  try {
    const bom = resolveProjectBom([
      short2('s2', 'wall_200_short_2', { xCm: 192, yCm: 300, widthCm: 200 }),
      frame('post', 'upright_346_5', {
        xCm: 392,
        yCm: 300,
        zCm: 0,
        widthCm: 8,
        heightCm: 346.5,
      }),
    ]);
    assert.equal(qty(bom, 'upright_99'), 1);
    assert.equal(qty(bom, 'upright_346_5'), 1);
    assert.equal(qty(bom, 'connector_single'), 3);
    assert.equal(qty(bom, 'connector_double'), 0);
    assert.equal(qty(bom, 'connector_start'), 2);
    assert.equal(qty(bom, 'profile_190'), 2);
    assert.equal(qty(bom, 'panel_197'), 2);
  } finally {
    initializeStandDimensions(CANONICAL_STAND_DIMENSIONS);
  }
});

test('same-width column keeps one bottom rail, one top rail, and two bottom starts', () => {
  const stacked = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short2('s2', 'wall_200_short_2', { widthCm: 200 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200 }),
  ]);
  assert.equal(qty(stacked, 'profile_190'), 2);
  assert.equal(qty(stacked, 'connector_start'), 2);
  assert.equal(qty(stacked, 'upright_346_5'), 2);
  assert.equal(qty(stacked, 'upright_99'), 2);
  assert.equal(qty(stacked, 'upright_49_5'), 2);
  assert.equal(qty(stacked, 'panel_197'), 10);
  assert.equal(qty(stacked, 'connector_single'), 19);
  assert.equal(qty(stacked, 'connector_double'), 0);
  assert.equal(qty(stacked, 'connector_corner'), 0);
  assert.equal(moduleQty(stacked, 'wall', 'profile_190'), 2);
  assert.equal(moduleQty(stacked, 'wall', 'connector_start'), 2);
  assert.equal(moduleQty(stacked, 's2', 'profile_190'), 0);
  assert.equal(moduleQty(stacked, 's2', 'connector_start'), 0);
  assert.equal(moduleQty(stacked, 's1', 'profile_190'), 0);
  assert.equal(moduleQty(stacked, 's1', 'connector_start'), 0);

  const narrower = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short1('s1', 'wall_100_short_1', { widthCm: 100 }),
  ]);
  assert.equal(qty(narrower, 'profile_190'), 2);
  assert.equal(qty(narrower, 'profile_91'), 2);
  assert.equal(qty(narrower, 'connector_start'), 4);

  const gapped = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200, zCm: 400 }),
  ]);
  assert.equal(qty(gapped, 'profile_190'), 4);
  assert.equal(qty(gapped, 'connector_start'), 4);

  const extended = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200, zCm: 350 }),
  ]);
  assert.equal(qty(extended, 'profile_190'), 2);
  assert.equal(qty(extended, 'connector_start'), 2);
  assert.equal(moduleQty(extended, 'wall', 'profile_190'), 1);
  assert.equal(moduleQty(extended, 'wall', 'connector_start'), 2);
  assert.equal(moduleQty(extended, 's1', 'profile_190'), 1);
  assert.equal(moduleQty(extended, 's1', 'connector_start'), 0);

  const shorts = resolveProjectBom([
    short2('outer', 'wall_200_short_2', { widthCm: 200 }),
    short1('inner', 'wall_200_short_1', { widthCm: 200 }),
  ]);
  assert.equal(qty(shorts, 'profile_190'), 2);
  assert.equal(qty(shorts, 'connector_start'), 2);
  assert.equal(moduleQty(shorts, 'outer', 'profile_190'), 2);
  assert.equal(moduleQty(shorts, 'outer', 'connector_start'), 2);
  assert.equal(moduleQty(shorts, 'inner', 'profile_190'), 0);
  assert.equal(moduleQty(shorts, 'inner', 'connector_start'), 0);

  const abutted = resolveProjectBom([
    short2('lower', 'wall_200_short_2', { widthCm: 200, zCm: 250 }),
    short1('upper', 'wall_200_short_1', { widthCm: 200, zCm: 350 }),
  ]);
  assert.equal(qty(abutted, 'profile_190'), 2);
  assert.equal(qty(abutted, 'connector_start'), 2);
  assert.equal(moduleQty(abutted, 'lower', 'profile_190'), 1);
  assert.equal(moduleQty(abutted, 'lower', 'connector_start'), 2);
  assert.equal(moduleQty(abutted, 'upper', 'profile_190'), 1);
  assert.equal(moduleQty(abutted, 'upper', 'connector_start'), 0);
});

test('same-width short on a door or showcase drops the short rails only', () => {
  const door = resolveProjectBom([
    frame('door', 'wall_door_100_350', { widthCm: 100, heightCm: 350 }),
    short2('s2', 'wall_100_short_2', { widthCm: 100 }),
    short1('s1', 'wall_100_short_1', { widthCm: 100 }),
  ]);
  assert.equal(qty(door, 'profile_91'), 1);
  assert.equal(qty(door, 'connector_start'), 2);
  assert.equal(qty(door, 'upright_346_5'), 2);
  assert.equal(qty(door, 'upright_99'), 2);
  assert.equal(qty(door, 'upright_49_5'), 2);
  assert.equal(moduleQty(door, 's2', 'profile_91'), 0);
  assert.equal(moduleQty(door, 's2', 'connector_start'), 0);
  assert.equal(moduleQty(door, 'door', 'connector_start'), 2);

  const above = resolveProjectBom([
    frame('door', 'wall_door_100_350', { widthCm: 100, heightCm: 350 }),
    short2('s2', 'wall_100_short_2', { widthCm: 100, zCm: 350 }),
  ]);
  assert.equal(qty(above, 'profile_91'), 1);
  assert.equal(qty(above, 'connector_start'), 2);
  assert.equal(qty(above, 'panel_98'), 5);
  assert.equal(qty(above, 'upright_445_5'), 2);
  assert.equal(qty(above, 'upright_346_5'), 0);
  assert.equal(qty(above, 'upright_99'), 0);
  assert.equal(moduleQty(above, 'door', 'profile_91'), 1);
  assert.equal(moduleQty(above, 's2', 'profile_91'), 0);

  const showcase = resolveProjectBom([
    frame('show', 'wall_showcase_100_2_350', { widthCm: 100, heightCm: 350 }),
    short1('s1', 'wall_100_short_1', { widthCm: 100 }),
  ]);
  assert.equal(qty(showcase, 'profile_91'), 4);
  assert.equal(qty(showcase, 'connector_start'), 4);
  assert.equal(moduleQty(showcase, 's1', 'profile_91'), 0);
  assert.equal(moduleQty(showcase, 's1', 'connector_start'), 0);
  assert.equal(qty(showcase, 'panel_98'), 6);
  assert.equal(qty(showcase, 'connector_single'), 12);
});

test('stacked short corner pays one corner per panel band: 18 corner, 20 single', () => {
  const bom = resolveProjectBom([
    frame('wallA', 'wall_200_350', { xCm: 100, widthCm: 200, heightCm: 350 }),
    frame('wallB', 'wall_200_350', { xCm: 300, widthCm: 200, heightCm: 350, rotationZDeg: 270 }),
    short2('highB', 'wall_200_short_2', { xCm: 300, widthCm: 200, zCm: 350, rotationZDeg: 270 }),
    short1('topB', 'wall_200_short_1', { xCm: 300, widthCm: 200, zCm: 450, rotationZDeg: 270 }),
    short2('highA', 'wall_200_short_2', { xCm: 100, widthCm: 200, zCm: 350 }),
    short1('topA', 'wall_200_short_1', { xCm: 100, widthCm: 200, zCm: 450 }),
  ]);
  assert.equal(qty(bom, 'connector_corner'), 18);
  assert.equal(qty(bom, 'connector_single'), 20);
  assert.equal(qty(bom, 'connector_double'), 0);
  assert.equal(qty(bom, 'connector_start'), 4);
  assert.equal(qty(bom, 'profile_190'), 4);
  assert.equal(qty(bom, 'upright_495'), 3);
  assert.equal(qty(bom, 'upright_346_5'), 0);
  assert.equal(qty(bom, 'upright_99'), 0);
  assert.equal(qty(bom, 'upright_49_5'), 0);
});

test('shorts stacked on a 346.5 post become one upright per plan end', () => {
  const onShort1 = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200, zCm: 350 }),
  ]);
  assert.equal(qty(onShort1, 'upright_396'), 2);
  assert.equal(qty(onShort1, 'upright_346_5'), 0);
  assert.equal(qty(onShort1, 'upright_49_5'), 0);
  assert.equal(qty(onShort1, 'profile_190'), 2);
  assert.equal(qty(onShort1, 'connector_start'), 2);

  const onShort2 = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short2('s2', 'wall_200_short_2', { widthCm: 200, zCm: 350 }),
  ]);
  assert.equal(qty(onShort2, 'upright_445_5'), 2);
  assert.equal(qty(onShort2, 'upright_346_5'), 0);
  assert.equal(qty(onShort2, 'upright_99'), 0);

  const both = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short2('s2', 'wall_200_short_2', { widthCm: 200, zCm: 350 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200, zCm: 450 }),
  ]);
  assert.equal(qty(both, 'upright_495'), 2);
  assert.equal(qty(both, 'upright_346_5'), 0);
  assert.equal(qty(both, 'upright_99'), 0);
  assert.equal(qty(both, 'upright_49_5'), 0);
  assert.equal(qty(both, 'profile_190'), 2);
  assert.equal(qty(both, 'connector_start'), 2);

  const inside = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short2('s2', 'wall_200_short_2', { widthCm: 200 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200 }),
  ]);
  assert.equal(qty(inside, 'upright_495'), 0);
  assert.equal(qty(inside, 'upright_346_5'), 2);
  assert.equal(qty(inside, 'upright_99'), 2);
  assert.equal(qty(inside, 'upright_49_5'), 2);

  const shortsOnly = resolveProjectBom([
    short2('lower', 'wall_200_short_2', { widthCm: 200, zCm: 250 }),
    short1('upper', 'wall_200_short_1', { widthCm: 200, zCm: 350 }),
  ]);
  assert.equal(qty(shortsOnly, 'upright_495'), 0);
  assert.equal(qty(shortsOnly, 'upright_99'), 2);
  assert.equal(qty(shortsOnly, 'upright_49_5'), 2);

  const besidePlain = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short2('s2', 'wall_200_short_2', { widthCm: 200, zCm: 350 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200, zCm: 450 }),
    cornerPartner('next', 'wall_200_350', 200, { xCm: 200, heightCm: 350 }),
  ]);
  assert.equal(qty(besidePlain, 'upright_495'), 2);
  assert.equal(qty(besidePlain, 'upright_346_5'), 1);
  assert.equal(qty(besidePlain, 'upright_99'), 0);
  assert.equal(qty(besidePlain, 'upright_49_5'), 0);
});

test('same-width column still meets a neighbor on end, corner, and tee', () => {
  const end = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short2('s2', 'wall_200_short_2', { widthCm: 200 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200 }),
    frame('next', 'wall_200_350', { xCm: 200, widthCm: 200, heightCm: 350 }),
  ]);
  assert.equal(qty(end, 'profile_190'), 4);
  assert.equal(qty(end, 'connector_start'), 4);
  assert.equal(qty(end, 'upright_346_5'), 3);
  assert.equal(qty(end, 'upright_99'), 2);
  assert.equal(qty(end, 'upright_49_5'), 1);
  assert.equal(qty(end, 'connector_double'), 8);
  assert.equal(qty(end, 'connector_corner'), 0);
  assert.equal(qty(end, 'connector_single'), 16);
  assert.equal(qty(end, 'panel_197'), 17);

  const corner = resolveProjectBom([
    frame('wall', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short2('s2', 'wall_200_short_2', { widthCm: 200 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200 }),
    cornerPartner('next', 'wall_200_350', 200, { xCm: 200, heightCm: 350 }),
  ]);
  assert.equal(qty(corner, 'profile_190'), 4);
  assert.equal(qty(corner, 'connector_start'), 4);
  assert.equal(qty(corner, 'connector_double'), 0);
  assert.equal(qty(corner, 'connector_corner'), 14);
  assert.equal(qty(corner, 'connector_single'), 18);
  assert.equal(qty(corner, 'upright_346_5'), 3);
  assert.equal(qty(corner, 'upright_99'), 2);
  assert.equal(qty(corner, 'upright_49_5'), 1);
  assert.equal(qty(corner, 'panel_corner_192'), 15);
  assert.equal(qty(corner, 'panel_197'), 2);

  const tee = resolveProjectBom([
    frame('host', 'wall_200_350', { widthCm: 200, heightCm: 350 }),
    short2('s2', 'wall_200_short_2', { widthCm: 200 }),
    short1('s1', 'wall_200_short_1', { widthCm: 200 }),
    cornerPartner('branch', 'wall_100_350', 100, { xCm: 100, heightCm: 350 }),
  ]);
  assert.equal(qty(tee, 'profile_190'), 2);
  assert.equal(qty(tee, 'profile_91'), 2);
  assert.equal(qty(tee, 'connector_start'), 4);
  assert.equal(qty(tee, 'connector_double'), 0);
  assert.equal(qty(tee, 'connector_corner'), 7);
  assert.equal(qty(tee, 'connector_single'), 25);
  assert.equal(qty(tee, 'upright_346_5'), 3);
  assert.equal(qty(tee, 'upright_99'), 2);
  assert.equal(qty(tee, 'upright_49_5'), 2);
  assert.equal(qty(tee, 'panel_197'), 10);
  assert.equal(qty(tee, 'panel_corner_92'), 7);
});

test('save and load rebuild the same wall short relationship BOM from placement', () => {
  const modules = [
    short1('a', 'wall_100_short_1', { widthCm: 100 }),
    frame('b', 'wall_door_100_350', { xCm: 100, widthCm: 100, heightCm: 350 }),
  ];
  const before = resolveProjectBom(modules);
  const loaded = JSON.parse(JSON.stringify(modules)).map((module) => normalizeModuleItemState(module));
  const after = resolveProjectBom(loaded);
  for (const itemKey of ['upright_49_5', 'upright_346_5', 'connector_single', 'connector_double', 'connector_start']) {
    assert.equal(qty(after, itemKey), qty(before, itemKey), itemKey);
  }
});

function post(id, xCm, yCm) {
  return frame(id, 'upright_346_5', { xCm, yCm, widthCm: 8, heightCm: 346.5 });
}

test('short run profiles span from support to support: L stand front scene', () => {
  const bom = resolveProjectBom([
    short1('r1', 'wall_200_short_1', { xCm: 950, yCm: 0, rotationZDeg: 90, widthCm: 200 }),
    short1('r2', 'wall_200_short_1', { xCm: 950, yCm: 200, rotationZDeg: 90, widthCm: 200 }),
    short1('r3', 'wall_200_short_1', { xCm: 950, yCm: 400, rotationZDeg: 90, widthCm: 200 }),
    short1('r4', 'wall_200_short_1', { xCm: 950, yCm: 600, rotationZDeg: 90, widthCm: 200 }),
    short1('f1', 'wall_200_short_1', { xCm: 0, yCm: 800, widthCm: 200 }),
    short1('f2', 'wall_200_short_1', { xCm: 200, yCm: 800, widthCm: 200 }),
    short1('f3', 'wall_100_short_1', { xCm: 400, yCm: 800, widthCm: 100 }),
    short1('f4', 'wall_50_short_1', { xCm: 500, yCm: 800, widthCm: 50 }),
    short1('f5', 'wall_200_short_1', { xCm: 550, yCm: 800, widthCm: 200 }),
    short1('f6', 'wall_200_short_1', { xCm: 750, yCm: 800, widthCm: 200 }),
    post('p1', 950, 400),
    post('p2', 500, 800),
    post('p3', 950, 800),
  ]);
  // 950 hattı: 0–400 ve 400–800 → 388; 800 hattı: 0–500 → 487, 500–950 → 388 + 41,5. İki ray.
  assert.equal(qty(bom, 'profile_388'), 6);
  assert.equal(qty(bom, 'profile_487'), 2);
  assert.equal(qty(bom, 'profile_41_5'), 2);
  assert.equal(qty(bom, 'profile_190'), 0);
  assert.equal(qty(bom, 'profile_91'), 0);
  assert.ok(bom.relationshipNotes.includes('Kısa panel profil birleşimi: 8 açıklık.'));
});

test('short run without a support takes the longest profile plus the rest', () => {
  const bom = resolveProjectBom([0, 200, 400, 600].map((xCm, index) => (
    short2(`s${index}`, 'wall_200_short_2', { xCm, widthCm: 200 })
  )));
  assert.equal(qty(bom, 'profile_487'), 2);
  assert.equal(qty(bom, 'profile_289'), 2);
  assert.equal(qty(bom, 'profile_190'), 0);
});

test('short run splits at a full-height partner end and at a field upright', () => {
  const wallEnd = resolveProjectBom([
    short1('a', 'wall_200_short_1', { widthCm: 200 }),
    short1('b', 'wall_200_short_1', { xCm: 200, widthCm: 200 }),
    frame('w', 'wall_100_350', { xCm: 200, yCm: 0, rotationZDeg: 270, widthCm: 100, heightCm: 350 }),
  ]);
  assert.equal(qty(wallEnd, 'profile_190'), 4);
  assert.equal(qty(wallEnd, 'profile_388'), 0);
  const posted = resolveProjectBom([
    short1('a', 'wall_200_short_1', { widthCm: 200 }),
    short1('b', 'wall_200_short_1', { xCm: 200, widthCm: 200 }),
    post('p', 196, 0),
  ]);
  assert.equal(qty(posted, 'profile_190'), 4);
  assert.equal(qty(posted, 'profile_388'), 0);
});

test('single and double row shorts side by side share only the aligned top rail', () => {
  const bom = resolveProjectBom([
    short1('one', 'wall_200_short_1', { widthCm: 200 }),
    short2('two', 'wall_200_short_2', { xCm: 200, widthCm: 200 }),
  ]);
  assert.equal(qty(bom, 'profile_388'), 1);
  assert.equal(qty(bom, 'profile_190'), 2);
});

test('a lone short keeps its own rails', () => {
  const bom = resolveProjectBom([short1('a', 'wall_200_short_1', { widthCm: 200 })]);
  assert.equal(qty(bom, 'profile_190'), 2);
  assert.equal(bom.relationshipNotes.some((note) => note.includes('profil birleşimi')), false);
});
