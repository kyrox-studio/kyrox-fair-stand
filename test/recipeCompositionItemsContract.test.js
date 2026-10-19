import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveItemBom } from '../src/itemBom.js';
import { getItem, listRegisteredItems } from '../src/items.js';

function childTuples(entries) {
  return (entries ?? []).map((entry) => [entry.itemKey, entry.quantity]);
}

const EXPECTED_RECIPE_ITEMS = Object.freeze({
  wall_door_100_350: [['profile_91', 1], ['upright_346_5', 2], ['panel_98', 3], ['connector_start', 2], ['connector_single', 5], ['door_leaf_100', 1]],
  base_100: [['profile_91', 4], ['profile_41_5', 4], ['upright_49_5', 4], ['panel_98', 2], ['panel_48_5', 2], ['connector_start', 8], ['connector_single', 8], ['base_top_107_50', 1]],
  base_150: [['profile_140_5', 4], ['profile_41_5', 4], ['upright_49_5', 4], ['panel_147_5', 2], ['panel_48_5', 2], ['connector_start', 8], ['connector_single', 8], ['base_top_157_50', 1]],
  base_200: [['profile_190', 4], ['profile_41_5', 4], ['upright_49_5', 4], ['panel_197', 2], ['panel_48_5', 2], ['connector_start', 8], ['connector_single', 8], ['base_top_206_50', 1]],
  desk_banko_100: [['profile_91', 3], ['profile_41_5', 4], ['upright_99', 4], ['panel_98', 2], ['panel_48_5', 4], ['connector_start', 6], ['connector_single', 12], ['counter_top_110_60', 1]],
  desk_banko_150: [['profile_140_5', 3], ['profile_41_5', 4], ['upright_99', 4], ['panel_147_5', 2], ['panel_48_5', 4], ['connector_start', 6], ['connector_single', 12], ['counter_top_160_60', 1]],
  desk_banko_200: [['profile_190', 3], ['profile_41_5', 4], ['upright_99', 4], ['panel_197', 2], ['panel_48_5', 4], ['connector_start', 6], ['connector_single', 12], ['counter_top_210_60', 1]],
  desk_banko_100_l: [['profile_91', 5], ['profile_41_5', 5], ['upright_99', 5], ['panel_98', 4], ['panel_48_5', 4], ['connector_start', 8], ['connector_single', 16], ['counter_top_110_60', 1], ['counter_top_52_60', 1]],
  desk_banko_150_l: [['profile_140_5', 5], ['profile_91', 1], ['profile_41_5', 4], ['upright_99', 5], ['panel_147_5', 4], ['panel_48_5', 4], ['connector_start', 8], ['connector_single', 16], ['counter_top_160_60', 1], ['counter_top_102_60', 1]],
  desk_banko_200_l: [['profile_190', 5], ['profile_140_5', 1], ['profile_41_5', 4], ['upright_99', 5], ['panel_197', 4], ['panel_48_5', 4], ['connector_start', 8], ['connector_single', 16], ['counter_top_210_60', 1], ['counter_top_150_60', 1]],
  wall_50_350: [['profile_41_5', 2], ['upright_346_5', 2], ['panel_48_5', 7], ['connector_start', 2], ['connector_single', 13]],
  wall_100_350: [['profile_91', 2], ['upright_346_5', 2], ['panel_98', 7], ['connector_start', 2], ['connector_single', 13]],
  wall_150_350: [['profile_140_5', 2], ['upright_346_5', 2], ['panel_147_5', 7], ['connector_start', 2], ['connector_single', 13]],
  wall_200_350: [['profile_190', 2], ['upright_346_5', 2], ['panel_197', 7], ['connector_start', 2], ['connector_single', 13]],
  wall_200_short_2: [['profile_190', 2], ['upright_99', 2], ['panel_197', 2], ['connector_start', 2], ['connector_single', 3]],
  wall_150_short_2: [['profile_140_5', 2], ['upright_99', 2], ['panel_147_5', 2], ['connector_start', 2], ['connector_single', 3]],
  wall_100_short_2: [['profile_91', 2], ['upright_99', 2], ['panel_98', 2], ['connector_start', 2], ['connector_single', 3]],
  wall_50_short_2: [['profile_41_5', 2], ['upright_99', 2], ['panel_48_5', 2], ['connector_start', 2], ['connector_single', 3]],
  wall_200_short_1: [['profile_190', 2], ['upright_49_5', 2], ['panel_197', 1], ['connector_start', 2], ['connector_single', 3]],
  wall_150_short_1: [['profile_140_5', 2], ['upright_49_5', 2], ['panel_147_5', 1], ['connector_start', 2], ['connector_single', 3]],
  wall_100_short_1: [['profile_91', 2], ['upright_49_5', 2], ['panel_98', 1], ['connector_start', 2], ['connector_single', 3]],
  wall_50_short_1: [['profile_41_5', 2], ['upright_49_5', 2], ['panel_48_5', 1], ['connector_start', 2], ['connector_single', 3]],
  // 50’lik ayırıcı ürün kararı (2026-10-19, 0071): bant başına 1 panel, 2B − 1 tekli → 350’de 13.
  wall_separator_50_350: [['profile_41_5', 2], ['upright_346_5', 2], ['separator_panel_48_5', 7], ['connector_start', 2], ['connector_single', 13]],
  wall_separator_100_350: [['profile_91', 2], ['upright_346_5', 2], ['separator_panel_98', 7], ['connector_start', 2], ['connector_single', 13]],
  wall_separator_50_350_sarmasik: [['profile_41_5', 2], ['upright_346_5', 2], ['separator_panel_48_5', 7], ['connector_start', 2], ['connector_single', 13]],
  wall_separator_100_350_sarmasik: [['profile_91', 2], ['upright_346_5', 2], ['separator_panel_98', 7], ['connector_start', 2], ['connector_single', 13]],
  wall_showcase_100_2_350: [['profile_91', 4], ['upright_346_5', 2], ['panel_98', 5], ['connector_start', 4], ['connector_single', 9], ['showcase_side_94_6_30', 2], ['showcase_horizontal_87_4_30', 2], ['glass_shelf', 1]],
  wall_showcase_100_3_350: [['profile_91', 4], ['upright_346_5', 2], ['panel_98', 4], ['connector_start', 4], ['connector_single', 7], ['showcase_side_143_5_30', 2], ['showcase_horizontal_87_4_30', 2], ['glass_shelf', 2]],
});

test('recipe parents keep composition.items equal to the proven former recipe copy', () => {
  const parents = listRegisteredItems().filter((item) => item.composition?.mode === 'recipe');
  assert.equal(parents.length, 28);
  assert.deepEqual(parents.map((item) => item.itemKey).sort(), Object.keys(EXPECTED_RECIPE_ITEMS).sort());

  for (const item of parents) {
    assert.ok(Array.isArray(item.composition.items), `${item.itemKey} composition.items missing`);
    assert.deepEqual(childTuples(item.composition.items), EXPECTED_RECIPE_ITEMS[item.itemKey], item.itemKey);
  }
});

test('legacy innerCorner is stripped from recipe and cluster Items', () => {
  for (const item of listRegisteredItems().filter((entry) => entry.composition?.mode === 'recipe')) {
    assert.equal(item.composition.innerCorner, undefined, item.itemKey);
    assert.equal(item.nominalModuleWidthCm, undefined, item.itemKey);
  }
});

test('cluster parents keep composition.items without recipe mode', () => {
  const clusters = listRegisteredItems().filter(
    (item) => item.composition?.items && item.composition?.mode !== 'recipe',
  );
  assert.deepEqual(
    clusters.map((item) => item.itemKey).sort(),
    ['furniture_sofa_set_classic', 'furniture_table_chair_set_eames'],
  );
  for (const item of clusters) {
    assert.equal(item.composition.innerCorner, undefined, item.itemKey);
  }
});

test('furniture clusters are not opened by resolveItemBom', () => {
  for (const itemKey of ['furniture_sofa_set_classic', 'furniture_table_chair_set_eames']) {
    assert.equal(getItem(itemKey).composition.mode, undefined, itemKey);
    assert.throws(() => resolveItemBom(itemKey), /Missing canonical unit/, itemKey);
  }
});

