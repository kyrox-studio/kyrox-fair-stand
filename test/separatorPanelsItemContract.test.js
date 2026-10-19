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

const CASES = {
  separator_panel_48_5: {
    metadata: {
      name: 'Separatör Paneli 48,5 × 47 cm',
      dimensions: { widthCm: 48.5, heightCm: 47, depthCm: 0.8 },
      material: 'mdf',
      defaultColor: 0xc79b63,
    },
    recipes: [['separator', 50, 7]],
  },
  separator_panel_98: {
    metadata: {
      name: 'Separatör Paneli 98 × 47 cm',
      dimensions: { widthCm: 98, heightCm: 47, depthCm: 0.8 },
      material: 'mdf',
      defaultColor: 0xc79b63,
    },
    recipes: [['separator', 100, 7]],
  },
};

test('separator panel production Items use canonical itemKey with verified 0.8 cm MDF metadata and default color', () => {
  for (const [itemKey, { metadata }] of Object.entries(CASES)) {
    const item = getItem(itemKey);
    assert.equal(item.itemKey, itemKey);
    assert.equal(item.partId, undefined);
    assert.equal(item.name, metadata.name);
    assert.equal(item.type, 'separator-panel');
    assert.equal(item.unit, 'adet');
    assert.deepEqual(item.dimensions, metadata.dimensions);
    assert.equal(item.material, metadata.material);
    assert.equal(item.defaultColor, metadata.defaultColor);
  }
});

test('separator panels use canonical itemKey in the verified recipe occurrences with quantity parity', () => {
  let total = 0;
  for (const [itemKey, { recipes }] of Object.entries(CASES)) {
    for (const [type, width, quantity] of recipes) {
      const recipe = getModuleRecipe(type, width);
      assert.ok(recipe);
      const matches = recipe.items.filter((item) => getRecipeItemKey(item) === itemKey);
      assert.equal(matches.length, 1, `${recipe.recipeId}:${itemKey}`);
      // 100'lük ayırıcıda panel bant başına 1 artar/azalır (0070); 50'lik kural dışında.
      assert.deepEqual(matches[0], { itemKey, quantity, ...(/^wall_separator_(50|100)_350(_sarmasik)?$/.test(recipe.recipeId) ? { perBand: 1 } : {}) });
      total += matches.length;
    }
  }
  assert.equal(total, 2);
});

test('expanded separator recipes resolve canonical separator metadata through itemKey', () => {
  for (const width of [50, 100]) {
    const expanded = getExpandedModuleRecipe('separator', width);
    assert.ok(expanded);
    for (const item of expanded.items.filter((entry) => entry.part?.type === 'separator-panel')) {
      assert.equal(item.part.itemKey, item.itemKey);
      assert.equal(item.part.partId, undefined);
      assert.equal(item.part.dimensions.depthCm, 0.8);
      assert.equal(item.part.material, 'mdf');
      assert.equal(item.part.defaultColor, 0xc79b63);
      assert.equal(item.part.unit, 'adet');
    }
  }
});

test('separator panel migration remains isolated from still-legacy production families', () => {
  assert.equal(getItem('showcase_2_100'), null);
  assert.equal(getItem('showcase_3_100'), null);
});
