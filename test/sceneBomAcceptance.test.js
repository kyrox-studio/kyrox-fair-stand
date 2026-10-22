/**
 * Real-scene BOM acceptance.
 * Expected maps are catalog recipe leaves plus the locked joint rules.
 * Full-height keep/double/corner tables stay on full-height pairs.
 * A short band converts one upright and one single per paying endpoint.
 * A full-height partner converts only the panel bands covered by the short.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeModuleItemState } from '../src/designState.js';
import { getItem, initializeItemRegistry, listRegisteredItems } from '../src/items.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { countOverlappingPanelBands } from '../src/relationshipBom.js';

function withProductionItems(run) {
  const snapshot = listRegisteredItems().map((item) => structuredClone(item));
  initializeItemRegistry([
    ...snapshot,
    {
      itemKey: 'lightbox_fabric',
      name: 'Lightbox Bezi',
      type: 'production',
      unit: 'metre_kare',
      catalogVisible: false,
      isRender: false,
      isActive: true,
    },
  ]);
  try {
    return run();
  } finally {
    initializeItemRegistry(snapshot);
  }
}
import { STAND_DIMENSIONS } from '../src/standDimensions.js';

const PANEL_SWAP = Object.freeze({
  panel_48_5: 'panel_corner_42_5',
  panel_98: 'panel_corner_92',
  panel_147_5: 'panel_corner_142_5',
  panel_197: 'panel_corner_192',
});

const RECIPE = Object.freeze({
  wall_50_350: { profile_41_5: 2, upright_346_5: 2, panel_48_5: 7, connector_start: 2, connector_single: 13 },
  wall_100_350: { profile_91: 2, upright_346_5: 2, panel_98: 7, connector_start: 2, connector_single: 13 },
  wall_150_350: { profile_140_5: 2, upright_346_5: 2, panel_147_5: 7, connector_start: 2, connector_single: 13 },
  wall_200_350: { profile_190: 2, upright_346_5: 2, panel_197: 7, connector_start: 2, connector_single: 13 },
  wall_door_100_350: { profile_91: 1, upright_346_5: 2, panel_98: 3, connector_start: 2, connector_single: 5, door_leaf_100: 1 },
  // 50’lik ayırıcı ürün kararı (2026-10-19, 0071): bant başına 1 panel, 2B − 1 tekli → 350’de 13.
  wall_separator_50_350: { profile_41_5: 2, upright_346_5: 2, separator_panel_48_5: 7, connector_start: 2, connector_single: 13 },
  wall_separator_100_350: { profile_91: 2, upright_346_5: 2, separator_panel_98: 7, connector_start: 2, connector_single: 13 },
  wall_separator_50_350_sarmasik: { profile_41_5: 2, upright_346_5: 2, separator_panel_48_5: 7, connector_start: 2, connector_single: 13 },
  wall_separator_100_350_sarmasik: { profile_91: 2, upright_346_5: 2, separator_panel_98: 7, connector_start: 2, connector_single: 13 },
  wall_showcase_100_2_350: { profile_91: 4, upright_346_5: 2, panel_98: 5, connector_start: 4, connector_single: 9, showcase_side_94_6_30: 2, showcase_horizontal_87_4_30: 2, glass_shelf: 1 },
  wall_showcase_100_3_350: { profile_91: 4, upright_346_5: 2, panel_98: 4, connector_start: 4, connector_single: 7, showcase_side_143_5_30: 2, showcase_horizontal_87_4_30: 2, glass_shelf: 2 },
  wall_50_short_1: { profile_41_5: 2, upright_49_5: 2, panel_48_5: 1, connector_start: 2, connector_single: 3 },
  wall_100_short_1: { profile_91: 2, upright_49_5: 2, panel_98: 1, connector_start: 2, connector_single: 3 },
  wall_150_short_1: { profile_140_5: 2, upright_49_5: 2, panel_147_5: 1, connector_start: 2, connector_single: 3 },
  wall_200_short_1: { profile_190: 2, upright_49_5: 2, panel_197: 1, connector_start: 2, connector_single: 3 },
  wall_50_short_2: { profile_41_5: 2, upright_99: 2, panel_48_5: 2, connector_start: 2, connector_single: 3 },
  wall_100_short_2: { profile_91: 2, upright_99: 2, panel_98: 2, connector_start: 2, connector_single: 3 },
  wall_150_short_2: { profile_140_5: 2, upright_99: 2, panel_147_5: 2, connector_start: 2, connector_single: 3 },
  wall_200_short_2: { profile_190: 2, upright_99: 2, panel_197: 2, connector_start: 2, connector_single: 3 },
  base_100: { profile_91: 4, profile_41_5: 4, upright_49_5: 4, panel_98: 2, panel_48_5: 2, connector_start: 8, connector_single: 8, base_top_107_50: 1 },
  base_150: { profile_140_5: 4, profile_41_5: 4, upright_49_5: 4, panel_147_5: 2, panel_48_5: 2, connector_start: 8, connector_single: 8, base_top_157_50: 1 },
  base_200: { profile_190: 4, profile_41_5: 4, upright_49_5: 4, panel_197: 2, panel_48_5: 2, connector_start: 8, connector_single: 8, base_top_206_50: 1 },
  desk_banko_100: { profile_91: 3, profile_41_5: 4, upright_99: 4, panel_98: 2, panel_48_5: 4, connector_start: 6, connector_single: 12, counter_top_110_60: 1 },
  desk_banko_150: { profile_140_5: 3, profile_41_5: 4, upright_99: 4, panel_147_5: 2, panel_48_5: 4, connector_start: 6, connector_single: 12, counter_top_160_60: 1 },
  desk_banko_200: { profile_190: 3, profile_41_5: 4, upright_99: 4, panel_197: 2, panel_48_5: 4, connector_start: 6, connector_single: 12, counter_top_210_60: 1 },
  desk_banko_100_l: { profile_91: 5, profile_41_5: 5, upright_99: 5, panel_98: 4, panel_48_5: 4, connector_start: 8, connector_single: 16, counter_top_110_60: 1, counter_top_52_60: 1 },
  desk_banko_150_l: { profile_140_5: 5, profile_91: 1, profile_41_5: 4, upright_99: 5, panel_147_5: 4, panel_48_5: 4, connector_start: 8, connector_single: 16, counter_top_160_60: 1, counter_top_102_60: 1 },
  desk_banko_200_l: { profile_190: 5, profile_140_5: 1, profile_41_5: 4, upright_99: 5, panel_197: 4, panel_48_5: 4, connector_start: 8, connector_single: 16, counter_top_210_60: 1, counter_top_150_60: 1 },
  profile_41_5: { profile_41_5: 1 },
  profile_91: { profile_91: 1 },
  profile_140_5: { profile_140_5: 1 },
  profile_190: { profile_190: 1 },
  upright_49_5: { upright_49_5: 1 },
  upright_99: { upright_99: 1 },
  upright_346_5: { upright_346_5: 1 },
  shelf_100: { shelf_100_self: 1, shelf_leg: 2 },
  shelf_150: { shelf_150_self: 1, shelf_leg: 3 },
  shelf_200: { shelf_200_self: 1, shelf_leg: 3 },
  panel_197: { panel_197: 1 },
  panel_cam_197: { panel_cam_197: 1 },
  connector_start: { connector_start: 1 },
  connector_single: { connector_single: 1 },
  connector_double: { connector_double: 1 },
  connector_corner: { connector_corner: 1 },
  door_leaf_100: { door_leaf_100: 1 },
  glass_shelf: { glass_shelf: 1 },
});

const SWAPS_PANELS = new Set([
  'wall_50_350', 'wall_100_350', 'wall_150_350', 'wall_200_350',
  'wall_door_100_350',
  'wall_showcase_100_2_350', 'wall_showcase_100_3_350',
]);

const HOSTED_BASE_100 = Object.freeze({
  profile_91: 2, panel_98: 1, upright_49_5: 2, profile_41_5: 4, panel_48_5: 2,
  connector_start: 6, connector_single: 8, base_top_107_50: 1,
});
const HOSTED_BASE_200 = Object.freeze({
  profile_190: 2, panel_197: 1, upright_49_5: 2, profile_41_5: 4, panel_48_5: 2,
  connector_start: 6, connector_single: 8, base_top_206_50: 1,
});

function positive(map) {
  return Object.fromEntries(Object.entries(map).filter(([, quantity]) => quantity > 0));
}

function add(...maps) {
  const out = {};
  for (const map of maps) {
    for (const [itemKey, quantity] of Object.entries(map)) {
      out[itemKey] = (out[itemKey] ?? 0) + quantity;
    }
  }
  return out;
}

function bump(map, itemKey, delta) {
  return { ...map, [itemKey]: (map[itemKey] ?? 0) + delta };
}

/** Uç uca kısa panel açıklığı: her rayda paneller kendi profilini düşer, açıklık profili girer. */
function shortRun(map, { drop, add: pieces, rails }) {
  let next = { ...map };
  for (let rail = 0; rail < rails; rail += 1) {
    for (const itemKey of drop) next = bump(next, itemKey, -1);
    for (const itemKey of pieces) next = bump(next, itemKey, 1);
  }
  return next;
}

function swapKeys(map, itemKeys) {
  const next = { ...map };
  for (const itemKey of itemKeys) {
    const cornerKey = PANEL_SWAP[itemKey];
    const quantity = next[itemKey] ?? 0;
    if (!cornerKey || !(quantity > 0)) continue;
    next[cornerKey] = (next[cornerKey] ?? 0) + quantity;
    next[itemKey] = 0;
  }
  return next;
}

function keepStraight(map, itemKey, quantity) {
  const cornerKey = PANEL_SWAP[itemKey];
  const next = { ...map };
  next[itemKey] = (next[itemKey] ?? 0) + quantity;
  next[cornerKey] = (next[cornerKey] ?? 0) - quantity;
  return next;
}

function isShort(itemKey) {
  return itemKey.includes('_short_');
}

function straightPanels(itemKey) {
  return Object.keys(RECIPE[itemKey]).filter((key) => PANEL_SWAP[key]);
}

function shortBandRange(itemKey) {
  if (itemKey.endsWith('_short_2')) return { minCm: 250, maxCm: 350 };
  if (itemKey.endsWith('_short_1')) return { minCm: 300, maxCm: 350 };
  return null;
}

function overlapLimit(itemKey, partnerKey) {
  const range = shortBandRange(partnerKey);
  if (isShort(itemKey) || !range) return null;
  return countOverlappingPanelBands(itemKey, 0, range);
}

function swapParticipant(map, itemKey, limit = null) {
  if (!(isShort(itemKey) || SWAPS_PANELS.has(itemKey))) return map;
  const next = { ...map };
  let remaining = limit;
  for (const panelKey of straightPanels(itemKey)) {
    const available = RECIPE[itemKey][panelKey] ?? 0;
    const quantity = remaining == null ? available : Math.min(remaining, available);
    const cornerKey = PANEL_SWAP[panelKey];
    if (!cornerKey || !(quantity > 0)) continue;
    next[panelKey] = (next[panelKey] ?? 0) - quantity;
    next[cornerKey] = (next[cornerKey] ?? 0) + quantity;
    if (remaining != null) remaining -= quantity;
  }
  return next;
}

function shortUprightKey(itemKey) {
  if (itemKey.includes('_short_1')) return 'upright_49_5';
  if (itemKey.includes('_short_2')) return 'upright_99';
  return null;
}

function expectShortJoint(leftKey, rightKey, kind) {
  let expected = add(RECIPE[leftKey], RECIPE[rightKey]);
  if (kind === 'apart' || kind === 'face') return expected;
  const uprightKey = shortUprightKey(leftKey) ?? shortUprightKey(rightKey);
  if (kind === 'end') {
    return bump(bump(bump(expected, uprightKey, -1), 'connector_single', -2), 'connector_double', 1);
  }
  if (kind === 'corner') {
    const bands = (key) => (isShort(key) && key.includes('_short_2') ? 2 : 1);
    const units = isShort(leftKey) && isShort(rightKey) ? bands(leftKey) + bands(rightKey) : 2;
    expected = bump(bump(bump(expected, uprightKey, -1), 'connector_single', -units), 'connector_corner', units);
    return swapParticipant(
      swapParticipant(expected, leftKey, overlapLimit(leftKey, rightKey)),
      rightKey,
      overlapLimit(rightKey, leftKey),
    );
  }
  const branchKey = isShort(rightKey) ? rightKey : leftKey;
  const branchUpright = shortUprightKey(branchKey);
  if (branchUpright) expected = bump(expected, branchUpright, -1);
  expected = bump(bump(expected, 'connector_single', -1), 'connector_corner', 1);
  return swapParticipant(expected, branchKey);
}

function lineMap(bom) {
  return Object.fromEntries(bom.lines.map((line) => [line.itemKey, line.quantity]).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

function assertBom(label, modules, expected, stand = null) {
  const bom = resolveProjectBom(modules, stand);
  for (const line of bom.lines) {
    assert.ok(line.quantity > 0, `${label} ${line.itemKey}`);
    assert.equal(line.unit === 'm2' || line.unit === 'adet', true, `${label} ${line.itemKey} unit`);
  }
  assert.deepEqual(lineMap(bom), positive(expected), label);
  return bom;
}

function place(id, itemKey, {
  xCm = 0, yCm = 0, zCm = 0, rotationZDeg = 0, widthCm, heightCm, strips,
} = {}) {
  const item = getItem(itemKey);
  return {
    id,
    itemKey,
    type: item?.type ?? null,
    variant: item?.variant,
    widthCm: widthCm ?? item?.dimensions?.widthCm ?? item?.sceneDimensions?.widthCm,
    heightCm: heightCm ?? item?.dimensions?.heightCm ?? item?.sceneDimensions?.heightCm,
    depthCm: item?.dimensions?.depthCm ?? item?.sceneDimensions?.depthCm,
    placement: { xCm, yCm, zCm, rotationZDeg, wallId: 'free' },
    ...(strips ? { strips } : {}),
  };
}

function shortOf(id, itemKey, fields = {}) {
  const band = itemKey.endsWith('_short_2') ? { zCm: 250, heightCm: 100 } : { zCm: 300, heightCm: 50 };
  return place(id, itemKey, { ...band, ...fields });
}

function cornerOf(id, itemKey, xCm, fields = {}) {
  return place(id, itemKey, { xCm, yCm: 0, rotationZDeg: 270, ...fields });
}

function widthOf(itemKey) {
  const match = itemKey.match(/_(\d+)_/);
  return Number(match[1]);
}

const FUTURE_PROFILE = 'profile_future_span';

function withFutureProfile(run) {
  const current = listRegisteredItems().map((item) => structuredClone(item));
  initializeItemRegistry([
    ...current,
    {
      itemKey: FUTURE_PROFILE,
      name: FUTURE_PROFILE,
      type: 'profile',
      unit: 'adet',
      dimensions: { widthCm: 480, depthCm: 8, heightCm: 8 },
      sceneDimensions: { widthCm: 480, depthCm: 8, heightCm: 8 },
    },
  ]);
  try {
    return run();
  } finally {
    initializeItemRegistry(current);
  }
}

function reload(modules) {
  return JSON.parse(JSON.stringify(modules)).map((module) => normalizeModuleItemState(structuredClone(module)));
}

test('standalone structural recipes resolve to leaves and omit the parent key', () => {
  const parents = [
    'wall_50_350', 'wall_100_350', 'wall_150_350', 'wall_200_350',
    'wall_door_100_350',
    'wall_separator_50_350', 'wall_separator_100_350',
    'wall_separator_50_350_sarmasik', 'wall_separator_100_350_sarmasik',
    'wall_showcase_100_2_350', 'wall_showcase_100_3_350',
    'wall_50_short_1', 'wall_100_short_1', 'wall_150_short_1', 'wall_200_short_1',
    'wall_50_short_2', 'wall_100_short_2', 'wall_150_short_2', 'wall_200_short_2',
    'desk_banko_100', 'desk_banko_150', 'desk_banko_200',
    'desk_banko_100_l', 'desk_banko_150_l', 'desk_banko_200_l',
    'base_100', 'base_150', 'base_200',
  ];
  for (const itemKey of parents) {
    const module = isShort(itemKey)
      ? shortOf('a', itemKey)
      : place('a', itemKey, { heightCm: getItem(itemKey)?.dimensions?.heightCm });
    assertBom(itemKey, [module], RECIPE[itemKey]);
    assert.equal(RECIPE[itemKey][itemKey] ?? 0, 0, `${itemKey} parent line`);
  }
  for (const itemKey of [
    'profile_41_5', 'profile_91', 'profile_140_5', 'profile_190',
    'upright_49_5', 'upright_99', 'upright_346_5',
    'shelf_100', 'shelf_150', 'shelf_200',
    'panel_197', 'panel_cam_197', 'door_leaf_100', 'glass_shelf',
    'connector_start', 'connector_single', 'connector_double', 'connector_corner',
  ]) {
    assertBom(itemKey, [place('a', itemKey)], RECIPE[itemKey]);
  }
});

test('full-height relationship scenes lock the final leaf map', () => {
  const wall = (id, itemKey, fields) => place(id, itemKey, { heightCm: 350, ...fields });
  const scenes = [
    ['wall-wall end', [wall('a', 'wall_200_350'), wall('b', 'wall_200_350', { xCm: 200 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_200_350), 'upright_346_5', -1), 'connector_single', -14), 'connector_double', 7)],
    ['wall-wall corner', [wall('a', 'wall_200_350'), cornerOf('b', 'wall_150_350', 200, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_150_350), 'upright_346_5', -1), 'connector_single', -12), 'connector_corner', 12), ['panel_197', 'panel_147_5'])],
    ['wall-wall tee', [wall('host', 'wall_200_350'), cornerOf('branch', 'wall_100_350', 100, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_100_350), 'upright_346_5', -1), 'connector_single', -6), 'connector_corner', 6), ['panel_98'])],
    ['wall-wall back face', [wall('a', 'wall_100_350'), wall('b', 'wall_100_350', { xCm: 100, rotationZDeg: 90 })], keepStraight(swapKeys(bump(bump(bump(add(RECIPE.wall_100_350, RECIPE.wall_100_350), 'upright_346_5', -1), 'connector_single', -6), 'connector_corner', 6), ['panel_98']), 'panel_98', 7)],
    ['wall-door end', [wall('a', 'wall_200_350'), wall('b', 'wall_door_100_350', { xCm: 200 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_door_100_350), 'upright_346_5', -1), 'connector_single', -10), 'connector_double', 3)],
    ['wall-door corner', [wall('a', 'wall_200_350'), cornerOf('b', 'wall_door_100_350', 200, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_door_100_350), 'upright_346_5', -1), 'connector_single', -8), 'connector_corner', 8), ['panel_197', 'panel_98'])],
    ['wall-door tee', [wall('host', 'wall_200_350'), cornerOf('branch', 'wall_door_100_350', 100, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_door_100_350), 'upright_346_5', -1), 'connector_single', -2), 'connector_corner', 2), ['panel_98'])],
    ['wall-separator end', [wall('a', 'wall_200_350'), wall('b', 'wall_separator_50_350', { xCm: 200 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_separator_50_350), 'upright_346_5', -1), 'connector_single', -14), 'connector_double', 7)],
    ['wall-separator corner', [wall('a', 'wall_200_350'), cornerOf('b', 'wall_separator_50_350', 200, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_separator_50_350), 'upright_346_5', -1), 'connector_single', -12), 'connector_corner', 12), ['panel_197'])],
    ['wall-separator tee', [wall('host', 'wall_200_350'), cornerOf('branch', 'wall_separator_100_350', 100, { heightCm: 350 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_separator_100_350), 'upright_346_5', -1), 'connector_single', -6), 'connector_corner', 6)],
    ['wall-separator-50 tee', [wall('host', 'wall_200_350'), cornerOf('branch', 'wall_separator_50_350', 100, { heightCm: 350 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_separator_50_350), 'upright_346_5', -1), 'connector_single', -6), 'connector_corner', 6)],
    ['wall-sarmasik end', [wall('a', 'wall_100_350'), wall('b', 'wall_separator_100_350_sarmasik', { xCm: 100 })], bump(bump(bump(add(RECIPE.wall_100_350, RECIPE.wall_separator_100_350_sarmasik), 'upright_346_5', -1), 'connector_single', -14), 'connector_double', 7)],
    ['wall-sarmasik corner', [wall('a', 'wall_50_350'), cornerOf('b', 'wall_separator_50_350_sarmasik', 50, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_50_350, RECIPE.wall_separator_50_350_sarmasik), 'upright_346_5', -1), 'connector_single', -12), 'connector_corner', 12), ['panel_48_5'])],
    ['wall-sarmasik tee', [wall('host', 'wall_200_350'), cornerOf('branch', 'wall_separator_100_350_sarmasik', 100, { heightCm: 350 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_separator_100_350_sarmasik), 'upright_346_5', -1), 'connector_single', -6), 'connector_corner', 6)],
    ['wall-showcase-2 end', [wall('a', 'wall_50_350'), wall('b', 'wall_showcase_100_2_350', { xCm: 50 })], bump(bump(bump(add(RECIPE.wall_50_350, RECIPE.wall_showcase_100_2_350), 'upright_346_5', -1), 'connector_single', -10), 'connector_double', 5)],
    ['wall-showcase-2 corner', [wall('a', 'wall_200_350'), cornerOf('b', 'wall_showcase_100_2_350', 200, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_showcase_100_2_350), 'upright_346_5', -1), 'connector_single', -10), 'connector_corner', 10), ['panel_197', 'panel_98'])],
    ['wall-showcase-2 tee', [wall('host', 'wall_200_350'), cornerOf('branch', 'wall_showcase_100_2_350', 100, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_showcase_100_2_350), 'upright_346_5', -1), 'connector_single', -4), 'connector_corner', 4), ['panel_98'])],
    ['wall-showcase-3 end', [wall('a', 'wall_200_350'), wall('b', 'wall_showcase_100_3_350', { xCm: 200 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_showcase_100_3_350), 'upright_346_5', -1), 'connector_single', -8), 'connector_double', 4)],
    ['wall-showcase-3 corner', [wall('a', 'wall_100_350'), cornerOf('b', 'wall_showcase_100_3_350', 100, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_100_350, RECIPE.wall_showcase_100_3_350), 'upright_346_5', -1), 'connector_single', -9), 'connector_corner', 9), ['panel_98'])],
    ['wall-showcase-3 tee', [wall('host', 'wall_200_350'), cornerOf('branch', 'wall_showcase_100_3_350', 100, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_showcase_100_3_350), 'upright_346_5', -1), 'connector_single', -3), 'connector_corner', 3), ['panel_98'])],
    ['three wall chain', [wall('a', 'wall_200_350', { xCm: 0 }), wall('b', 'wall_200_350', { xCm: 200 }), wall('c', 'wall_200_350', { xCm: 400 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_200_350, RECIPE.wall_200_350), 'upright_346_5', -2), 'connector_single', -28), 'connector_double', 14)],
    ['tee three participants', [wall('a', 'wall_200_350', { xCm: 0 }), wall('b', 'wall_200_350', { xCm: 200 }), cornerOf('c', 'wall_showcase_100_2_350', 200, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_200_350, RECIPE.wall_showcase_100_2_350), 'upright_346_5', -2), 'connector_single', -16), 'connector_corner', 16), ['panel_197', 'panel_98'])],
    ['door-door end', [wall('a', 'wall_door_100_350'), wall('b', 'wall_door_100_350', { xCm: 100 })], bump(bump(bump(add(RECIPE.wall_door_100_350, RECIPE.wall_door_100_350), 'upright_346_5', -1), 'connector_single', -6), 'connector_double', 3)],
    ['separator-separator end', [wall('a', 'wall_separator_50_350'), wall('b', 'wall_separator_50_350', { xCm: 50 })], bump(bump(bump(add(RECIPE.wall_separator_50_350, RECIPE.wall_separator_50_350), 'upright_346_5', -1), 'connector_single', -14), 'connector_double', 7)],
    ['separator-separator corner', [wall('a', 'wall_separator_100_350'), cornerOf('b', 'wall_separator_100_350', 100, { heightCm: 350 })], bump(bump(bump(add(RECIPE.wall_separator_100_350, RECIPE.wall_separator_100_350), 'upright_346_5', -1), 'connector_single', -12), 'connector_corner', 12)],
    ['door-door corner', [wall('a', 'wall_door_100_350'), cornerOf('b', 'wall_door_100_350', 100, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_door_100_350, RECIPE.wall_door_100_350), 'upright_346_5', -1), 'connector_single', -4), 'connector_corner', 4), ['panel_98'])],
    ['showcase-2 showcase-3 end', [wall('a', 'wall_showcase_100_2_350'), wall('b', 'wall_showcase_100_3_350', { xCm: 100 })], bump(bump(bump(add(RECIPE.wall_showcase_100_2_350, RECIPE.wall_showcase_100_3_350), 'upright_346_5', -1), 'connector_single', -8), 'connector_double', 4)],
    ['separator tee door', [wall('a', 'wall_separator_100_350', { xCm: 0 }), wall('b', 'wall_separator_100_350', { xCm: 100 }), cornerOf('c', 'wall_door_100_350', 100, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_separator_100_350, RECIPE.wall_separator_100_350, RECIPE.wall_door_100_350), 'upright_346_5', -2), 'connector_single', -14), 'connector_corner', 14), ['panel_98'])],
    ['overlapping walls are not a joint', [wall('a', 'wall_200_350', { xCm: 0 }), wall('b', 'wall_200_350', { xCm: 50 })], add(RECIPE.wall_200_350, RECIPE.wall_200_350)],
  ];
  for (const [label, modules, expected] of scenes) {
    assertBom(label, modules, expected);
    assert.equal((expected.connector_double ?? 0) > 0 && (expected.connector_corner ?? 0) > 0, false, label);
  }
});

test('wall short structural partners lock short-band finals, not full-height constants', () => {
  const pairs = [
    ['wall_200_350', 'wall_200_short_1'],
    ['wall_150_350', 'wall_150_short_2'],
    ['wall_door_100_350', 'wall_100_short_1'],
    ['wall_door_100_350', 'wall_100_short_2'],
    ['wall_separator_100_350', 'wall_100_short_1'],
    ['wall_separator_50_350', 'wall_50_short_2'],
    ['wall_separator_50_350_sarmasik', 'wall_50_short_1'],
    ['wall_separator_50_350_sarmasik', 'wall_50_short_2'],
    ['wall_separator_100_350_sarmasik', 'wall_100_short_1'],
    ['wall_separator_100_350_sarmasik', 'wall_100_short_2'],
    ['wall_showcase_100_2_350', 'wall_100_short_1'],
    ['wall_showcase_100_2_350', 'wall_100_short_2'],
    ['wall_showcase_100_3_350', 'wall_100_short_1'],
    ['wall_showcase_100_3_350', 'wall_100_short_2'],
  ];
  for (const [partnerKey, shortKey] of pairs) {
    const width = widthOf(partnerKey);
    const uprightKey = shortUprightKey(shortKey);
    const end = assertBom(`${shortKey} ${partnerKey} end`, [
      shortOf('a', shortKey),
      place('b', partnerKey, { xCm: width, heightCm: 350 }),
    ], expectShortJoint(shortKey, partnerKey, 'end'));
    assert.equal(lineMap(end)[uprightKey], 1, shortKey);
    assert.equal(lineMap(end).upright_346_5, 2, shortKey);
    assert.equal(lineMap(end).connector_double, 1, shortKey);
    assert.equal(lineMap(end).connector_corner ?? 0, 0, shortKey);
    const corner = assertBom(`${shortKey} ${partnerKey} corner`, [
      shortOf('a', shortKey),
      cornerOf('b', partnerKey, width, { heightCm: 350 }),
    ], expectShortJoint(shortKey, partnerKey, 'corner'));
    assert.equal(lineMap(corner).connector_corner, 2, shortKey);
    assert.equal(lineMap(corner).connector_double ?? 0, 0, shortKey);
    const tee = assertBom(`${shortKey} ${partnerKey} tee`, [
      place('host', partnerKey, { heightCm: 350 }),
      cornerOf('branch', shortKey, width / 2, {
        zCm: shortKey.endsWith('_2') ? 250 : 300,
        heightCm: shortKey.endsWith('_2') ? 100 : 50,
      }),
    ], expectShortJoint(partnerKey, shortKey, 'tee'));
    assert.equal(lineMap(tee)[uprightKey], 1, shortKey);
    assert.equal(lineMap(tee).upright_346_5, 2, shortKey);
    assert.equal(lineMap(tee).connector_double ?? 0, 0, shortKey);
    assertBom(`${shortKey} ${partnerKey} z`, [
      shortOf('a', shortKey, { zCm: 400 }),
      place('b', partnerKey, { xCm: width, heightCm: 350 }),
    ], add(RECIPE[shortKey], RECIPE[partnerKey]));
  }
  assertBom('wall short face', [
    shortOf('a', 'wall_200_short_1'),
    place('b', 'wall_200_350', { yCm: 10, heightCm: 350 }),
  ], add(RECIPE.wall_200_short_1, RECIPE.wall_200_350));
});

test('wall short to wall short scenes lock shared uprights once', () => {
  assertBom('short-1 end', [shortOf('a', 'wall_200_short_1'), shortOf('b', 'wall_150_short_1', { xCm: 200 })], shortRun(expectShortJoint('wall_200_short_1', 'wall_150_short_1', 'end'), { drop: ['profile_190', 'profile_140_5'], add: ['profile_289', 'profile_41_5'], rails: 2 }));
  assertBom('short-2 end', [shortOf('a', 'wall_200_short_2'), shortOf('b', 'wall_200_short_2', { xCm: 200 })], shortRun(expectShortJoint('wall_200_short_2', 'wall_200_short_2', 'end'), { drop: ['profile_190', 'profile_190'], add: ['profile_388'], rails: 2 }));
  assertBom('short-1 corner', [shortOf('a', 'wall_100_short_1'), cornerOf('b', 'wall_100_short_1', 100, { zCm: 300, heightCm: 50 })], expectShortJoint('wall_100_short_1', 'wall_100_short_1', 'corner'));
  assertBom('short-2 corner', [shortOf('a', 'wall_100_short_2'), cornerOf('b', 'wall_100_short_2', 100, { zCm: 250, heightCm: 100 })], expectShortJoint('wall_100_short_2', 'wall_100_short_2', 'corner'));
  assertBom('short tee', [shortOf('host', 'wall_200_short_1'), cornerOf('branch', 'wall_100_short_1', 100, { zCm: 300, heightCm: 50 })], expectShortJoint('wall_200_short_1', 'wall_100_short_1', 'tee'));
  assertBom('short containment', [shortOf('small', 'wall_200_short_1', { zCm: 300 }), shortOf('tall', 'wall_200_short_2', { xCm: 200, zCm: 250 })], shortRun(expectShortJoint('wall_200_short_1', 'wall_200_short_2', 'end'), { drop: ['profile_190', 'profile_190'], add: ['profile_388'], rails: 1 }));
  assertBom('partial z', [shortOf('a', 'wall_100_short_1', { zCm: 200 }), shortOf('b', 'wall_100_short_2', { xCm: 100, zCm: 230 })], add(RECIPE.wall_100_short_1, RECIPE.wall_100_short_2));
  assertBom('no z overlap', [shortOf('a', 'wall_100_short_1', { zCm: 0 }), shortOf('b', 'wall_100_short_1', { xCm: 100, zCm: 300 })], add(RECIPE.wall_100_short_1, RECIPE.wall_100_short_1));
});

test('field upright consumes one free short endpoint and keeps its own line', () => {
  const post = (id, fields) => place(id, 'upright_346_5', { widthCm: 8, heightCm: 346.5, ...fields });
  const alone = (shortKey) => add(RECIPE[shortKey], RECIPE.upright_346_5);
  assertBom('short-1 right', [shortOf('a', 'wall_200_short_1'), post('post', { xCm: 196 })], bump(alone('wall_200_short_1'), 'upright_49_5', -1));
  assertBom('short-1 left', [shortOf('a', 'wall_200_short_1'), post('post', { xCm: -4 })], bump(alone('wall_200_short_1'), 'upright_49_5', -1));
  assertBom('short-2 right', [shortOf('a', 'wall_200_short_2'), post('post', { xCm: 196 })], bump(alone('wall_200_short_2'), 'upright_99', -1));
  assertBom('short-2 left', [shortOf('a', 'wall_100_short_2'), post('post', { xCm: -4 })], bump(alone('wall_100_short_2'), 'upright_99', -1));
  const pair = [shortOf('a', 'wall_200_short_2'), shortOf('b', 'wall_200_short_2', { xCm: 200 })];
  const shared = expectShortJoint('wall_200_short_2', 'wall_200_short_2', 'end');
  assertBom('shared endpoint does not double consume', [...pair, post('post', { xCm: 196 })], add(shared, RECIPE.upright_346_5));
  assertBom('free endpoint after a shared joint', [...pair, post('post', { xCm: 396 })], shortRun(bump(add(shared, RECIPE.upright_346_5), 'upright_99', -1), { drop: ['profile_190', 'profile_190'], add: ['profile_388'], rails: 2 }));
  assertBom('body middle', [shortOf('a', 'wall_200_short_2'), post('post', { xCm: 96 })], alone('wall_200_short_2'));
  assertBom('z outside', [shortOf('a', 'wall_200_short_2'), post('post', { xCm: 196, zCm: 400 })], alone('wall_200_short_2'));
  assertBom('wrong footprint', [shortOf('a', 'wall_200_short_2'), post('post', { xCm: 196, yCm: 20 })], alone('wall_200_short_2'));
  assertBom('top gap beyond 3.5 cm', [shortOf('a', 'wall_200_short_2'), post('post', { xCm: 196, heightCm: 340 })], add(RECIPE.wall_200_short_2, { upright_346_5: 1 }));
});

test('profile rails replace a covered short child profile by span and contact', () => {
  const wall = () => shortOf('wall', 'wall_100_short_1');
  const rail = (id, itemKey, zCm, fields = {}) => place(id, itemKey, { zCm, heightCm: 8, ...fields });
  assertBom('bottom catalog profile_140_5', [wall(), rail('p', 'profile_140_5', 292, { xCm: -40.5 })], add(bump(RECIPE.wall_100_short_1, 'profile_91', -1), RECIPE.profile_140_5));
  assertBom('top catalog profile_190', [wall(), rail('p', 'profile_190', 350, { xCm: -45 })], add(bump(RECIPE.wall_100_short_1, 'profile_91', -1), RECIPE.profile_190));
  assertBom('bottom and top', [wall(), rail('bottom', 'profile_140_5', 292, { xCm: -40.5 }), rail('top', 'profile_190', 350, { xCm: -45 })], add(bump(RECIPE.wall_100_short_1, 'profile_91', -2), RECIPE.profile_140_5, RECIPE.profile_190));
  assertBom('two profiles on the bottom rail', [wall(), rail('p1', 'profile_140_5', 292, { xCm: -40.5 }), rail('p2', 'profile_190', 292, { xCm: -45 })], add(bump(RECIPE.wall_100_short_1, 'profile_91', -1), RECIPE.profile_140_5, RECIPE.profile_190));
  assertBom('two profiles on the top rail', [wall(), rail('p1', 'profile_140_5', 350, { xCm: -40.5 }), rail('p2', 'profile_190', 350, { xCm: -45 })], add(bump(RECIPE.wall_100_short_1, 'profile_91', -1), RECIPE.profile_140_5, RECIPE.profile_190));
  assertBom('short catalog span', [wall(), rail('p', 'profile_91', 292, { xCm: 0 })], add(RECIPE.wall_100_short_1, RECIPE.profile_91));
  assertBom('turned profile', [wall(), rail('p', 'profile_190', 292, { xCm: 0, rotationZDeg: 90 })], add(RECIPE.wall_100_short_1, RECIPE.profile_190));
  assertBom('profile through the body', [wall(), rail('p', 'profile_190', 320, { xCm: -45 })], add(RECIPE.wall_100_short_1, RECIPE.profile_190));
  assertBom('wrong z', [wall(), rail('p', 'profile_190', 200, { xCm: -45 })], add(RECIPE.wall_100_short_1, RECIPE.profile_190));
  assertBom('continuation past the end', [wall(), rail('p', 'profile_190', 292, { xCm: 100 })], add(RECIPE.wall_100_short_1, RECIPE.profile_190));
  assertBom('different sku on a 50 cm short', [shortOf('wall', 'wall_50_short_2'), rail('p', 'profile_91', 242, { xCm: -20 })], add(bump(RECIPE.wall_50_short_2, 'profile_41_5', -1), RECIPE.profile_91));
  withFutureProfile(() => {
    assertBom('future profile type', [shortOf('wall', 'wall_200_short_1'), place('p', FUTURE_PROFILE, { xCm: -40, zCm: 292, widthCm: 480, heightCm: 8 })], add(bump(RECIPE.wall_200_short_1, 'profile_190', -1), { profile_future_span: 1 }));
    assertBom('very long future profile still one rail', [
      shortOf('wall', 'wall_200_short_2'),
      place('bottom', FUTURE_PROFILE, { xCm: -40, zCm: 242, widthCm: 480, heightCm: 8 }),
      place('top', FUTURE_PROFILE, { xCm: -40, zCm: 350, widthCm: 480, heightCm: 8 }),
    ], add(bump(RECIPE.wall_200_short_2, 'profile_190', -2), { profile_future_span: 2 }));
  });
});

test('multi-joint scenes cap each short end, rail and single once', () => {
  const bottom = place('bottom', 'profile_140_5', { xCm: 80, zCm: 292, heightCm: 8 });
  const top = place('top', 'profile_190', { xCm: 60, zCm: 350, heightCm: 8 });
  const short = shortOf('wall', 'wall_100_short_1', { xCm: 100 });
  assertBom('scene A', [
    place('left', 'wall_100_350', { heightCm: 350 }),
    short,
    place('right', 'wall_100_350', { xCm: 200, heightCm: 350 }),
    bottom,
    top,
  ], add(bump(bump(bump(bump(add(RECIPE.wall_100_350, RECIPE.wall_100_350, RECIPE.wall_100_short_1), 'upright_49_5', -2), 'connector_single', -4), 'connector_double', 2), 'profile_91', -2), RECIPE.profile_140_5, RECIPE.profile_190));
  assertBom('scene B', [
    place('left', 'wall_door_100_350', { heightCm: 350 }),
    short,
    place('right', 'wall_separator_100_350', { xCm: 200, heightCm: 350 }),
    bottom,
    top,
  ], add(bump(bump(bump(bump(add(RECIPE.wall_door_100_350, RECIPE.wall_separator_100_350, RECIPE.wall_100_short_1), 'upright_49_5', -2), 'connector_single', -4), 'connector_double', 2), 'profile_91', -2), RECIPE.profile_140_5, RECIPE.profile_190));
  assertBom('scene C', [
    place('left', 'wall_showcase_100_2_350', { heightCm: 350 }),
    short,
    place('post', 'upright_346_5', { xCm: 196, widthCm: 8, heightCm: 346.5 }),
    bottom,
  ], add(bump(bump(bump(bump(add(RECIPE.wall_showcase_100_2_350, RECIPE.wall_100_short_1, RECIPE.upright_346_5), 'upright_49_5', -2), 'connector_single', -2), 'connector_double', 1), 'profile_91', -1), RECIPE.profile_140_5));
  withFutureProfile(() => {
    assertBom('scene D', [
      shortOf('a', 'wall_200_short_2'),
      shortOf('b', 'wall_200_short_2', { xCm: 200 }),
      place('post', 'upright_346_5', { xCm: 396, widthCm: 8, heightCm: 346.5 }),
      place('bottom', FUTURE_PROFILE, { xCm: -40, zCm: 242, widthCm: 480, heightCm: 8 }),
      place('top', FUTURE_PROFILE, { xCm: -40, zCm: 350, widthCm: 480, heightCm: 8 }),
    ], add(bump(bump(bump(bump(add(RECIPE.wall_200_short_2, RECIPE.wall_200_short_2, RECIPE.upright_346_5), 'upright_99', -2), 'connector_single', -2), 'connector_double', 1), 'profile_190', -4), { profile_future_span: 2 }));
  });
});

test('baza hosts stay on the baza motor and ignore wall short joints', () => {
  const flushY = (50 + STAND_DIMENSIONS.depthCm) / 2;
  const baza = (id, itemKey, fields = {}) => place(id, itemKey, { yCm: flushY, ...fields });
  assertBom('base plus wall', [place('wall', 'wall_200_350', { heightCm: 350 }), baza('base', 'base_200')], add(RECIPE.wall_200_350, HOSTED_BASE_200));
  assertBom('base plus separator', [place('sep', 'wall_separator_100_350', { heightCm: 350 }), baza('base', 'base_100')], add(RECIPE.wall_separator_100_350, HOSTED_BASE_100));
  assertBom('base plus sarmasik', [place('sep', 'wall_separator_100_350_sarmasik', { heightCm: 350 }), baza('base', 'base_100')], add(RECIPE.wall_separator_100_350_sarmasik, HOSTED_BASE_100));
  assertBom('base plus showcase', [place('case', 'wall_showcase_100_3_350', { heightCm: 350 }), baza('base', 'base_100')], add(RECIPE.wall_showcase_100_3_350, HOSTED_BASE_100));
  assertBom('invalid width', [place('wall', 'wall_100_350', { heightCm: 350 }), baza('base', 'base_200')], add(RECIPE.wall_100_350, RECIPE.base_200));
  assertBom('invalid alignment', [place('wall', 'wall_200_350', { heightCm: 350 }), place('base', 'base_200', { yCm: 25 })], add(RECIPE.wall_200_350, RECIPE.base_200));
  assertBom('door is not a host', [place('door', 'wall_door_100_350', { heightCm: 350 }), baza('base', 'base_100')], add(RECIPE.wall_door_100_350, RECIPE.base_100));
  assertBom('wall short is not a host', [shortOf('short', 'wall_200_short_2'), baza('base', 'base_200')], add(RECIPE.wall_200_short_2, RECIPE.base_200));
  assertBom('short joint does not unhost the baza', [
    place('wall', 'wall_200_350', { heightCm: 350 }),
    shortOf('short', 'wall_200_short_1', { xCm: 200 }),
    baza('base', 'base_200'),
  ], add(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_200_short_1), 'upright_49_5', -1), 'connector_single', -2), 'connector_double', 1), HOSTED_BASE_200));
});

test('panel glass and corner swaps stay on the participating straight panels', () => {
  assertBom('glass split', [place('a', 'wall_200_350', {
    heightCm: 350,
    strips: Array.from({ length: 7 }, (_, index) => ({ itemKey: 'panel_197', isGlass: index < 4 })),
  })], bump(bump(RECIPE.wall_200_350, 'panel_197', -4), 'panel_cam_197', 4));
  assertBom('corner glass', [
    place('a', 'wall_200_350', {
      heightCm: 350,
      strips: Array.from({ length: 7 }, (_, index) => ({ itemKey: 'panel_197', isGlass: index < 4 })),
    }),
    cornerOf('b', 'wall_200_350', 200, { heightCm: 350 }),
  ], add(swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_200_350), 'upright_346_5', -1), 'connector_single', -12), 'connector_corner', 12), ['panel_197']), { panel_corner_192: -4, panel_corner_cam_192: 4 }));
  assertBom('wall short corner glass', [
    shortOf('a', 'wall_200_short_1', { strips: [{ itemKey: 'panel_197', isGlass: true }] }),
    cornerOf('b', 'wall_150_350', 200, { heightCm: 350 }),
  ], add(expectShortJoint('wall_200_short_1', 'wall_150_350', 'corner'), { panel_corner_192: -1, panel_corner_cam_192: 1 }));
  const separatorCorner = assertBom('separator panels stay straight', [
    place('a', 'wall_200_350', { heightCm: 350 }),
    cornerOf('b', 'wall_separator_100_350', 200, { heightCm: 350 }),
  ], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_separator_100_350), 'upright_346_5', -1), 'connector_single', -12), 'connector_corner', 12), ['panel_197']));
  assert.equal(lineMap(separatorCorner).separator_panel_98, 7);
  assert.equal(lineMap(separatorCorner).panel_197 ?? 0, 0);
});

test('save and load rebuilds the same final BOM from placement', () => {
  const scenes = [
    ['end', [place('a', 'wall_200_350', { heightCm: 350 }), place('b', 'wall_200_350', { xCm: 200, heightCm: 350 })], bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_200_350), 'upright_346_5', -1), 'connector_single', -14), 'connector_double', 7)],
    ['corner', [place('a', 'wall_200_350', { heightCm: 350 }), cornerOf('b', 'wall_150_350', 200, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_150_350), 'upright_346_5', -1), 'connector_single', -12), 'connector_corner', 12), ['panel_197', 'panel_147_5'])],
    ['tee', [place('host', 'wall_200_350', { heightCm: 350 }), cornerOf('branch', 'wall_100_350', 100, { heightCm: 350 })], swapKeys(bump(bump(bump(add(RECIPE.wall_200_350, RECIPE.wall_100_350), 'upright_346_5', -1), 'connector_single', -6), 'connector_corner', 6), ['panel_98'])],
    ['wall short profile', [shortOf('wall', 'wall_100_short_1'), place('p', 'profile_190', { xCm: -45, zCm: 350, heightCm: 8 })], add(bump(RECIPE.wall_100_short_1, 'profile_91', -1), RECIPE.profile_190)],
    ['wall short upright', [shortOf('a', 'wall_200_short_2'), place('post', 'upright_346_5', { xCm: 196, widthCm: 8, heightCm: 346.5 })], bump(add(RECIPE.wall_200_short_2, RECIPE.upright_346_5), 'upright_99', -1)],
    ['multi', [
      place('left', 'wall_100_350', { heightCm: 350 }),
      shortOf('wall', 'wall_100_short_1', { xCm: 100 }),
      place('right', 'wall_100_350', { xCm: 200, heightCm: 350 }),
      place('bottom', 'profile_140_5', { xCm: 80, zCm: 292, heightCm: 8 }),
      place('top', 'profile_190', { xCm: 60, zCm: 350, heightCm: 8 }),
    ], add(bump(bump(bump(bump(add(RECIPE.wall_100_350, RECIPE.wall_100_350, RECIPE.wall_100_short_1), 'upright_49_5', -2), 'connector_single', -4), 'connector_double', 2), 'profile_91', -2), RECIPE.profile_140_5, RECIPE.profile_190)],
  ];
  for (const [label, modules, expected] of scenes) {
    assertBom(`${label} live`, modules, expected);
    assertBom(`${label} reloaded`, reload(modules), expected);
  }
});

test('negative contacts do not invent a BOM delta', () => {
  assertBom('face offset', [place('a', 'wall_200_350', { heightCm: 350 }), place('b', 'wall_200_350', { yCm: 10, heightCm: 350 })], add(RECIPE.wall_200_350, RECIPE.wall_200_350));
  assertBom('shelf at a wall end', [place('wall', 'wall_200_350', { heightCm: 350 }), place('shelf', 'shelf_200', { xCm: 200 })], add(RECIPE.wall_200_350, RECIPE.shelf_200));
  assertBom('counter beside a short', [shortOf('wall', 'wall_100_short_1'), place('banko', 'desk_banko_100', { xCm: 100 })], add(RECIPE.wall_100_short_1, RECIPE.desk_banko_100));
  assertBom('fixture-side has no shared structural part', [
    place('banko', 'desk_banko_100', { heightCm: 100 }),
    place('cheek', 'wall_50_350', { xCm: 0, yCm: -25, rotationZDeg: 270, heightCm: 350 }),
  ], add(RECIPE.desk_banko_100, RECIPE.wall_50_350));
  assertBom('corner face miss', [place('a', 'wall_200_350', { heightCm: 350 }), cornerOf('b', 'wall_100_350', 100, { yCm: 10, heightCm: 350 })], add(RECIPE.wall_200_350, RECIPE.wall_100_350));
  const plant = resolveProjectBom([shortOf('wall', 'wall_100_short_2'), place('plant', 'extra_indoor_plant_1', { xCm: 100 })]);
  assert.deepEqual(lineMap(plant), positive(RECIPE.wall_100_short_2));
  assert.equal(plant.unresolved[0].itemKey, 'extra_indoor_plant_1');
});

test('live shelf composition reaches resolveProjectBom as board plus legs', () => {
  const snapshot = listRegisteredItems().map((item) => structuredClone(item));
  try {
    const next = snapshot.map((item) => structuredClone(item));
    const shelf = next.find((item) => item.itemKey === 'shelf_200');
    const board = structuredClone(shelf);
    board.itemKey = 'shelf_200_self';
    board.name = 'Raf 200 Tek';
    board.unit = 'adet';
    board.composition = { items: [{ itemKey: 'shelf_leg', quantity: 3 }] };
    shelf.composition = { mode: 'recipe', items: [{ itemKey: 'shelf_200_self', quantity: 1 }, { itemKey: 'shelf_leg', quantity: 3 }] };
    initializeItemRegistry([...next, board]);
    assertBom('shelf_200 live', [place('shelf', 'shelf_200')], { shelf_200_self: 1, shelf_leg: 3 });
  } finally {
    initializeItemRegistry(snapshot);
  }
});

test('floor and print layers do not change structural hardware', () => {
  const hardware = assertBom('floor plus wall', [place('wall', 'wall_200_350', { heightCm: 350 })], add(RECIPE.wall_200_350, { hali: 12 }), { xCm: 400, yCm: 300, itemKey: 'hali' });
  assert.equal(hardware.lines.find((line) => line.itemKey === 'hali').unit, 'm2');
  const bom = withProductionItems(() => resolveProjectBom([place('wall', 'wall_200_350', {
    heightCm: 350,
    strips: [{ stripIndex: 0, fabricGroupId: 'lb', fabricType: 'lightbox', itemKey: 'panel_197' }],
  })]));
  const structural = { ...lineMap(bom) };
  delete structural.lightbox_fabric;
  assert.deepEqual(structural, positive(RECIPE.wall_200_350), 'lightbox hardware');
  const lightbox = bom.lines.find((line) => line.itemKey === 'lightbox_fabric');
  const lightboxSection = bom.printAreas.find((section) => section.id === 'lightbox');
  assert.equal(lightboxSection.lines.length, 1);
  assert.equal(lightbox.quantity, lightboxSection.totalAreaM2);
  assert.equal(lightbox.quantity, 0.9259);
  assert.equal(lightbox.unit, 'metre_kare');
  assert.equal(lightbox.name, 'Lightbox Bezi');
  assert.equal(bom.lines.find((line) => line.itemKey === 'panel_197').quantity, 7);
  assert.equal(bom.printAreas.some((section) => section.id === 'mesh'), false);
  const foam = withProductionItems(() => resolveProjectBom([
    place('foam', 'illuminated-foam', { widthCm: 200, heightCm: 50 }),
  ]));
  const foamSection = foam.printAreas.find((section) => section.id === 'foam');
  const foamLine = foam.lines.find((line) => line.itemKey === 'illuminated-foam');
  assert.equal(foam.unresolved.some((entry) => entry.itemKey === 'illuminated-foam'), false);
  assert.equal(foam.lines.filter((line) => line.itemKey === 'illuminated-foam').length, 1);
  assert.equal(foamSection.lines[0].widthCm, 200);
  assert.equal(foamLine.quantity, foamSection.totalAreaM2);
  assert.equal(foamLine.quantity, 1);
  assert.equal(foamLine.unit, 'metre_kare');
  assert.equal(foamLine.name, 'Işıklı Strafor / Logo');
});
