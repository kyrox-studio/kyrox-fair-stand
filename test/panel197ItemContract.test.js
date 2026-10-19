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

const PANEL_197_DIMS = Object.freeze({ widthCm: 197, heightCm: 47, depthCm: 0.8 });

const RECIPE_CASES = [
  ['wall', 200, {}, 7],
  ['counter', 200, { shape: 'L' }, 4],
  ['counter', 200, {}, 2],
  ['base', 200, {}, 2],
];

test('panel_197 is a canonical single production Item', () => {
  const item = getItem('panel_197');

  assert.equal(item.itemKey, 'panel_197');
  assert.equal(item.partId, undefined);
  assert.equal(item.name, 'Panel 197 × 47 cm');
  assert.equal(item.type, 'panel');
  assert.equal(item.unit, 'adet');
  assert.deepEqual(item.dimensions, PANEL_197_DIMS);
  assert.equal(item.nominalModuleWidthCm, undefined);
});

test('panel_197 uses canonical itemKey in exactly four verified parent recipes with quantity parity', () => {
  let occurrences = 0;

  for (const [type, width, options, quantity] of RECIPE_CASES) {
    const recipe = getModuleRecipe(type, width, options);
    assert.ok(recipe);
    const matches = recipe.items.filter((item) => getRecipeItemKey(item) === 'panel_197');
    assert.equal(matches.length, 1, recipe.recipeId);
    // Düz duvar reçetesinde panel bant başına 1 artar/azalır (0068).
    assert.deepEqual(matches[0], { itemKey: 'panel_197', quantity, ...(/^wall_(50|100|150|200)_350$/.test(recipe.recipeId) ? { perBand: 1 } : {}) });
    occurrences += matches.length;
  }

  assert.equal(occurrences, 4);
});

test('expanded recipe resolves panel_197 metadata through canonical itemKey', () => {
  const expanded = getExpandedModuleRecipe('counter', 200);
  const panel = expanded.items.find((item) => item.itemKey === 'panel_197');

  assert.ok(panel);
  assert.equal(panel.part.itemKey, 'panel_197');
  assert.equal(panel.part.partId, undefined);
  assert.equal(panel.part.unit, 'adet');
  assert.deepEqual(panel.part.dimensions, PANEL_197_DIMS);
});

test('panel_197 remains isolated from the canonical inner-corner panel family', () => {
  for (const itemKey of ['panel_corner_42_5', 'panel_corner_92', 'panel_corner_142_5', 'panel_corner_192']) {
    const item = getItem(itemKey);
    assert.equal(item.itemKey, itemKey);
    assert.equal(item.partId, undefined, itemKey);
    assert.equal(item.type, 'panel', itemKey);
  }

  const wall200 = getStraightWallRecipe(200);
  assert.equal(wall200.composition.innerCorner, undefined);
  assert.equal(wall200.variants, undefined);
  assert.ok(wall200.items.find((item) => getRecipeItemKey(item) === 'panel_197'));
});
