import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import {
  getRecipeItemKey,
} from '../src/moduleRecipes.js';
import {
  getExpandedModuleRecipe,
  getModuleRecipe,
  getStraightWallRecipe,
} from './recipeParentItemKey.js';

const PANEL_CASES = {
  panel_48_5: {
    metadata: { name: 'Panel 48,5 × 47 cm', dimensions: { widthCm: 48.5, heightCm: 47, depthCm: 0.8 } },
    recipes: [
      ['wall', 50, {}, 7],
      ['counter', 100, { shape: 'L' }, 4],
      ['counter', 150, { shape: 'L' }, 4],
      ['counter', 200, { shape: 'L' }, 4],
      ['counter', 100, {}, 4],
      ['counter', 150, {}, 4],
      ['counter', 200, {}, 4],
      ['base', 100, {}, 2],
      ['base', 150, {}, 2],
      ['base', 200, {}, 2],
    ],
  },
  panel_98: {
    metadata: { name: 'Panel 98 × 47 cm', dimensions: { widthCm: 98, heightCm: 47, depthCm: 0.8 } },
    recipes: [
      ['wall', 100, {}, 7],
      ['door', 100, {}, 3],
      ['showcase-2', 100, {}, 5],
      ['showcase-3', 100, {}, 4],
      ['counter', 100, { shape: 'L' }, 4],
      ['counter', 100, {}, 2],
      ['base', 100, {}, 2],
    ],
  },
  panel_147_5: {
    metadata: { name: 'Panel 147,5 × 47 cm', dimensions: { widthCm: 147.5, heightCm: 47, depthCm: 0.8 } },
    recipes: [
      ['wall', 150, {}, 7],
      ['counter', 150, { shape: 'L' }, 4],
      ['counter', 150, {}, 2],
      ['base', 150, {}, 2],
    ],
  },
};

test('straight panel production Items use canonical itemKey with verified metadata', () => {
  for (const [itemKey, { metadata }] of Object.entries(PANEL_CASES)) {
    const item = getItem(itemKey);
    assert.equal(item.itemKey, itemKey);
    assert.equal(item.partId, undefined);
    assert.equal(item.name, metadata.name);
    assert.equal(item.type, 'panel');
    assert.equal(item.unit, 'adet');
    assert.deepEqual(item.dimensions, metadata.dimensions);
    assert.equal(item.nominalModuleWidthCm, undefined);
  }
});

test('straight panels use canonical itemKey in exactly 21 verified recipe occurrences with quantity parity', () => {
  let total = 0;
  for (const [itemKey, { recipes }] of Object.entries(PANEL_CASES)) {
    let occurrences = 0;
    for (const [type, width, options, quantity] of recipes) {
      const recipe = getModuleRecipe(type, width, options);
      assert.ok(recipe);
      const matches = recipe.items.filter((item) => getRecipeItemKey(item) === itemKey);
      assert.equal(matches.length, 1, `${recipe.recipeId}:${itemKey}`);
      // Düz duvar reçetesinde panel bant başına 1 artar/azalır (0068).
      assert.deepEqual(matches[0], { itemKey, quantity, ...(/^wall_(50|100|150|200)_350$/.test(recipe.recipeId) ? { perBand: 1 } : {}) });
      occurrences += matches.length;
    }
    assert.equal(occurrences, recipes.length, itemKey);
    total += occurrences;
  }
  assert.equal(total, 21);
});

test('expanded recipes resolve straight panel metadata through canonical itemKey', () => {
  const examples = [
    ['panel_48_5', 'counter', 200, {}],
    ['panel_98', 'door', 100, {}],
    ['panel_147_5', 'wall', 150, {}],
  ];

  for (const [itemKey, type, width, options] of examples) {
    const expanded = getExpandedModuleRecipe(type, width, options);
    const panel = expanded.items.find((item) => item.itemKey === itemKey);
    assert.ok(panel, itemKey);
    assert.equal(panel.part.itemKey, itemKey);
    assert.equal(panel.part.partId, undefined);
    assert.equal(panel.part.type, 'panel');
    assert.deepEqual(panel.part.dimensions, getItem(itemKey).dimensions);
  }
});

test('straight panel recipes keep composition.items only and corner panels remain standalone Items', () => {
  assert.equal(getItem('showcase_2_100'), null);
  assert.equal(getItem('showcase_3_100'), null);

  for (const width of [50, 100, 150, 200]) {
    const recipe = getStraightWallRecipe(width);
    assert.equal(recipe.composition.innerCorner, undefined);
    assert.equal(recipe.variants, undefined);
  }
  for (const itemKey of ['panel_corner_42_5', 'panel_corner_92', 'panel_corner_142_5', 'panel_corner_192']) {
    assert.equal(getItem(itemKey).itemKey, itemKey);
  }
});
