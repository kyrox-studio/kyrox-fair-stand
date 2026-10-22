import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import {
  getExpandedModuleRecipe,
  getModuleRecipe,
} from './recipeParentItemKey.js';

function counterTopDims(widthCm) {
  return { widthCm, depthCm: 60, heightCm: 1.8 };
}

test('production catalog contains verified banko upright and tops', () => {
  assert.equal(getItem('upright_99').dimensions.heightCm, 99);
  assert.deepEqual(getItem('counter_top_110_60').dimensions, counterTopDims(110));
  assert.deepEqual(getItem('counter_top_160_60').dimensions, counterTopDims(160));
  assert.deepEqual(getItem('counter_top_210_60').dimensions, counterTopDims(210));
  assert.deepEqual(getItem('counter_top_52_60').dimensions, counterTopDims(52));
  assert.deepEqual(getItem('counter_top_102_60').dimensions, counterTopDims(102));
  assert.deepEqual(getItem('counter_top_150_60').dimensions, counterTopDims(150));
});

test('banko 100 recipe matches verified production data', () => {
  const recipe = getModuleRecipe('counter', 100);
  assert.deepEqual(recipe.items, [
    { itemKey: 'profile_91', quantity: 3 },
    { itemKey: 'profile_41_5', quantity: 4 },
    { itemKey: 'upright_99', quantity: 4 },
    { itemKey: 'panel_98', quantity: 2 },
    { itemKey: 'panel_48_5', quantity: 4 },
    { itemKey: 'connector_start', quantity: 6 },
    { itemKey: 'connector_single', quantity: 12 },
    { itemKey: 'counter_top_110_60', quantity: 1 },
  ]);
});

test('banko 150 recipe matches verified production data', () => {
  const quantities = Object.fromEntries(getModuleRecipe('counter', 150).items.map((item) => [item.itemKey ?? item.partId, item.quantity]));
  assert.equal(quantities.profile_140_5, 3);
  assert.equal(quantities.profile_41_5, 4);
  assert.equal(quantities.upright_99, 4);
  assert.equal(quantities.panel_147_5, 2);
  assert.equal(quantities.panel_48_5, 4);
  assert.equal(quantities.connector_start, 6);
  assert.equal(quantities.connector_single, 12);
  assert.equal(quantities.counter_top_160_60, 1);
});

test('banko 200 recipe matches verified production data', () => {
  const quantities = Object.fromEntries(getModuleRecipe('counter', 200).items.map((item) => [item.itemKey ?? item.partId, item.quantity]));
  assert.equal(quantities.profile_190, 3);
  assert.equal(quantities.profile_41_5, 4);
  assert.equal(quantities.upright_99, 4);
  assert.equal(quantities.panel_197, 2);
  assert.equal(quantities.panel_48_5, 4);
  assert.equal(quantities.connector_start, 6);
  assert.equal(quantities.connector_single, 12);
  assert.equal(quantities.counter_top_210_60, 1);
});

test('expanded banko recipe resolves top and upright production parts', () => {
  const expanded = getExpandedModuleRecipe('counter', 100);
  assert.equal(expanded.items[2].part.name, 'Dikme 99');
  assert.equal(expanded.items.at(-1).part.name, 'Banko Üstü 110 × 60 cm');
});
