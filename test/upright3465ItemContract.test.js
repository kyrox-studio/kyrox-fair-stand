import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import {
  getRecipeItemKey,
} from '../src/moduleRecipes.js';
import {
  getExpandedStraightWallRecipe,
  getModuleRecipe,
  listStraightWallRecipes,
} from './recipeParentItemKey.js';

const UPRIGHT_346_5_DIMS = Object.freeze({ widthCm: 8, heightCm: 346.5, depthCm: 8 });

function listAllVerifiedRecipes() {
  return [
    ...listStraightWallRecipes(),
    ...[
      ['door', 100],
      ['showcase-2', 100],
      ['showcase-3', 100],
      ['separator', 50],
      ['separator', 100],
      ['counter', 100, { shape: 'L' }],
      ['counter', 150, { shape: 'L' }],
      ['counter', 200, { shape: 'L' }],
      ['counter', 100],
      ['counter', 150],
      ['counter', 200],
      ['base', 100],
      ['base', 150],
      ['base', 200],
    ].map(([type, width, options]) => getModuleRecipe(type, width, options ?? {})),
  ];
}

test('upright_346_5 is a canonical single production Item', () => {
  const item = getItem('upright_346_5');

  assert.equal(item.itemKey, 'upright_346_5');
  assert.equal(item.partId, undefined);
  assert.equal(item.type, 'upright');
  assert.equal(item.unit, 'adet');
  assert.deepEqual(item.dimensions, UPRIGHT_346_5_DIMS);
});

test('upright_346_5 uses canonical itemKey in all 9 verified parent recipes and keeps quantity 2', () => {
  let occurrences = 0;

  for (const recipe of listAllVerifiedRecipes()) {
    assert.ok(recipe);
    for (const item of recipe.items) {
      if (getRecipeItemKey(item) !== 'upright_346_5') continue;
      occurrences += 1;
      // Düz duvarda dikme seçilen yüksekliğe göre değişir (0068).
      assert.deepEqual(item, { itemKey: 'upright_346_5', quantity: 2, ...(/^wall_(50|100|150|200|door_100|showcase_100_[23]|separator_100|separator_50)_350(_sarmasik)?$/.test(recipe.recipeId) ? { heightMatched: true } : {}) });
    }
  }

  assert.equal(occurrences, 9);
});

test('upright_346_5 remains canonical while neighboring upright Items migrate independently', () => {
  for (const itemKey of ['upright_346_5', 'upright_99', 'upright_49_5']) {
    const item = getItem(itemKey);
    assert.equal(item.itemKey, itemKey);
    assert.equal(item.partId, undefined);
    assert.equal(item.type, 'upright');
    assert.equal(item.unit, 'adet');
  }
});

test('expanded recipe resolves upright_346_5 metadata through canonical itemKey', () => {
  const expanded = getExpandedStraightWallRecipe(200);
  const upright = expanded.items.find((item) => item.itemKey === 'upright_346_5');

  assert.ok(upright);
  assert.equal(upright.part.itemKey, 'upright_346_5');
  assert.equal(upright.part.name, 'Dikme 346,5');
  assert.equal(upright.part.unit, 'adet');
  assert.deepEqual(upright.part.dimensions, UPRIGHT_346_5_DIMS);
});
