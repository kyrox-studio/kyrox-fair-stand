import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import {
  getRecipeItemKey,
} from '../src/moduleRecipes.js';
import {
  getExpandedModuleRecipe,
  getModuleRecipe,
} from './recipeParentItemKey.js';

const CASES = [
  {
    itemKey: 'upright_99',
    name: 'Dikme 99',
    dimensions: { widthCm: 8, heightCm: 99, depthCm: 8 },
    recipes: [
      ['counter', 100, {}, 4],
      ['counter', 150, {}, 4],
      ['counter', 200, {}, 4],
      ['counter', 100, { shape: 'L' }, 5],
      ['counter', 150, { shape: 'L' }, 5],
      ['counter', 200, { shape: 'L' }, 5],
    ],
  },
  {
    itemKey: 'upright_49_5',
    name: 'Dikme 49,5',
    dimensions: { widthCm: 8, heightCm: 49.5, depthCm: 8 },
    recipes: [
      ['base', 100, {}, 4],
      ['base', 150, {}, 4],
      ['base', 200, {}, 4],
    ],
  },
];

for (const { itemKey, name, dimensions, recipes } of CASES) {
  test(`${itemKey} is a canonical single production Item`, () => {
    const item = getItem(itemKey);
    assert.equal(item.itemKey, itemKey);
    assert.equal(item.partId, undefined);
    assert.equal(item.name, name);
    assert.equal(item.type, 'upright');
    assert.equal(item.unit, 'adet');
    assert.deepEqual(item.dimensions, dimensions);
  });

  test(`${itemKey} uses canonical itemKey and preserves all verified quantities`, () => {
    let occurrences = 0;
    for (const [type, width, options, quantity] of recipes) {
      const recipe = getModuleRecipe(type, width, options);
      assert.ok(recipe);
      const match = recipe.items.find((item) => getRecipeItemKey(item) === itemKey);
      assert.deepEqual(match, { itemKey, quantity });
      occurrences += 1;
    }
    assert.equal(occurrences, recipes.length);
  });

  test(`${itemKey} expanded recipe resolves metadata through canonical itemKey`, () => {
    const [type, width, options] = recipes[0];
    const expanded = getExpandedModuleRecipe(type, width, options);
    const item = expanded.items.find((entry) => entry.itemKey === itemKey);
    assert.ok(item);
    assert.equal(item.part.itemKey, itemKey);
    assert.equal(item.part.name, name);
    assert.equal(item.part.unit, 'adet');
    assert.deepEqual(item.part.dimensions, dimensions);
  });
}
