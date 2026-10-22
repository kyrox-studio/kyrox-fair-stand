import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import {
  getRecipeItemKey,
} from '../src/moduleRecipes.js';
import {
  getExpandedModuleRecipe,
  getExpandedStraightWallRecipe,
  getModuleRecipe,
  getStraightWallRecipe,
} from './recipeParentItemKey.js';

const PROFILE_190_DIMS = Object.freeze({ widthCm: 190, heightCm: 8, depthCm: 8 });

const CASES = [
  [getStraightWallRecipe(200), 2],
  [getModuleRecipe('counter', 200, { shape: 'L' }), 5],
  [getModuleRecipe('counter', 200), 3],
  [getModuleRecipe('base', 200), 4],
];

test('profile_190 is a canonical single production Item with verified 190 x 8 cm dimensions', () => {
  const item = getItem('profile_190');

  assert.equal(item.itemKey, 'profile_190');
  assert.equal(item.partId, undefined);
  assert.equal(item.name, 'Profil 190');
  assert.equal(item.type, 'profile');
  assert.equal(item.unit, 'adet');
  assert.deepEqual(item.dimensions, PROFILE_190_DIMS);
});

test('profile_190 uses canonical itemKey in all 4 verified parent recipes and preserves quantities', () => {
  const quantities = [];

  for (const [recipe, expectedQuantity] of CASES) {
    assert.ok(recipe);
    const matches = recipe.items.filter((item) => getRecipeItemKey(item) === 'profile_190');
    assert.equal(matches.length, 1, recipe.recipeId);
    assert.deepEqual(matches[0], { itemKey: 'profile_190', quantity: expectedQuantity });
    quantities.push(expectedQuantity);
  }

  assert.deepEqual(quantities, [2, 5, 3, 4]);
});

test('expanded recipes resolve profile_190 metadata through canonical itemKey', () => {
  const expandedWall = getExpandedStraightWallRecipe(200);
  const wallProfile = expandedWall.items.find((item) => item.itemKey === 'profile_190');
  assert.ok(wallProfile);
  assert.equal(wallProfile.part.itemKey, 'profile_190');
  assert.deepEqual(wallProfile.part.dimensions, PROFILE_190_DIMS);

  const expandedCounter = getExpandedModuleRecipe('counter', 200, { shape: 'L' });
  const counterProfile = expandedCounter.items.find((item) => item.itemKey === 'profile_190');
  assert.ok(counterProfile);
  assert.equal(counterProfile.quantity, 5);
  assert.equal(counterProfile.part.name, 'Profil 190');
});

test('the full production profile family now uses canonical Item identity', () => {
  for (const itemKey of ['profile_41_5', 'profile_91', 'profile_140_5', 'profile_190']) {
    const item = getItem(itemKey);
    assert.equal(item.itemKey, itemKey);
    assert.equal(item.partId, undefined, itemKey);
    assert.equal(item.type, 'profile');
  }
});
