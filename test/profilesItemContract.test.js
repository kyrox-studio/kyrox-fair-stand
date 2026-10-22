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

const PROFILE_CASES = {
  profile_41_5: {
    name: 'Profil 41,5',
    dimensions: { widthCm: 41.5, heightCm: 8, depthCm: 8 },
    recipes: [
      ['wall', 50, {}, 2],
      ['separator', 50, {}, 2],
      ['counter', 100, { shape: 'L' }, 5],
      ['counter', 150, { shape: 'L' }, 4],
      ['counter', 200, { shape: 'L' }, 4],
      ['counter', 100, {}, 4],
      ['counter', 150, {}, 4],
      ['counter', 200, {}, 4],
      ['base', 100, {}, 4],
      ['base', 150, {}, 4],
      ['base', 200, {}, 4],
    ],
  },
  profile_91: {
    name: 'Profil 91',
    dimensions: { widthCm: 91, heightCm: 8, depthCm: 8 },
    recipes: [
      ['wall', 100, {}, 2],
      ['door', 100, {}, 1],
      ['showcase-2', 100, {}, 4],
      ['showcase-3', 100, {}, 4],
      ['separator', 100, {}, 2],
      ['counter', 100, { shape: 'L' }, 5],
      ['counter', 150, { shape: 'L' }, 1],
      ['counter', 100, {}, 3],
      ['base', 100, {}, 4],
    ],
  },
  profile_140_5: {
    name: 'Profil 140,5',
    dimensions: { widthCm: 140.5, heightCm: 8, depthCm: 8 },
    recipes: [
      ['wall', 150, {}, 2],
      ['counter', 150, { shape: 'L' }, 5],
      ['counter', 200, { shape: 'L' }, 1],
      ['counter', 150, {}, 3],
      ['base', 150, {}, 4],
    ],
  },
};

test('remaining production profiles are canonical single Items with verified metadata parity', () => {
  for (const [itemKey, expected] of Object.entries(PROFILE_CASES)) {
    const item = getItem(itemKey);
    assert.equal(item.itemKey, itemKey);
    assert.equal(item.partId, undefined, itemKey);
    assert.equal(item.name, expected.name);
    assert.equal(item.type, 'profile');
    assert.equal(item.unit, 'adet');
    assert.deepEqual(item.dimensions, expected.dimensions);
  }
});

test('remaining production profiles use canonical itemKey in exactly 25 verified parent recipe rows with quantity parity', () => {
  let totalOccurrences = 0;

  for (const [itemKey, expected] of Object.entries(PROFILE_CASES)) {
    let occurrences = 0;
    for (const [type, width, options, expectedQuantity] of expected.recipes) {
      const recipe = getModuleRecipe(type, width, options);
      assert.ok(recipe);
      const matches = recipe.items.filter((item) => getRecipeItemKey(item) === itemKey);
      assert.equal(matches.length, 1, recipe.recipeId);
      assert.deepEqual(matches[0], { itemKey, quantity: expectedQuantity }, recipe.recipeId);
      assert.equal(matches[0].partId, undefined, recipe.recipeId);
      occurrences += 1;
    }
    assert.equal(occurrences, expected.recipes.length, itemKey);
    totalOccurrences += occurrences;
  }

  assert.equal(totalOccurrences, 25);
});

test('expanded recipes resolve all migrated profile metadata through canonical Item identity', () => {
  for (const [itemKey, expected] of Object.entries(PROFILE_CASES)) {
    for (const [type, width, options, expectedQuantity] of expected.recipes) {
      const expanded = getExpandedModuleRecipe(type, width, options);
      const profile = expanded.items.find((item) => getRecipeItemKey(item) === itemKey);
      assert.ok(profile, `${type}:${width}:${itemKey}`);
      assert.equal(profile.quantity, expectedQuantity, expanded.recipeId);
      assert.equal(profile.part.itemKey, itemKey, expanded.recipeId);
      assert.equal(profile.part.partId, undefined, expanded.recipeId);
      assert.equal(profile.part.unit, 'adet', expanded.recipeId);
      assert.deepEqual(
        profile.part.dimensions,
        expected.dimensions,
        expanded.recipeId,
      );
    }
  }
});

test('profile family cutover preserves the already canonical profile_190 contract', () => {
  const profile190 = getItem('profile_190');
  assert.equal(profile190.itemKey, 'profile_190');
  assert.equal(profile190.partId, undefined);
  assert.equal(profile190.type, 'profile');
  assert.equal(profile190.unit, 'adet');
  assert.deepEqual(profile190.dimensions, { widthCm: 190, heightCm: 8, depthCm: 8 });
});
