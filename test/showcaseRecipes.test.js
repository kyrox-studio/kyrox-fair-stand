import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import {
  getExpandedModuleRecipe,
  getModuleRecipe,
} from './recipeParentItemKey.js';

test('fake aggregate showcase production parts are removed', () => {
  assert.equal(getItem('showcase_2_100'), null);
  assert.equal(getItem('showcase_3_100'), null);
  assert.equal(getItem('wall_showcase_100_2_350').itemKey, 'wall_showcase_100_2_350');
  assert.equal(getItem('wall_showcase_100_3_350').itemKey, 'wall_showcase_100_3_350');
});

test('2-eye wall showcase BASE recipe matches verified production data', () => {
  const recipe = getModuleRecipe('showcase-2', 100);
  assert.deepEqual(recipe.items, [
    { itemKey: 'profile_91', quantity: 4 },
    { itemKey: 'upright_346_5', quantity: 2, heightMatched: true },
    { itemKey: 'panel_98', quantity: 5, perBand: 1 },
    { itemKey: 'connector_start', quantity: 4 },
    { itemKey: 'connector_single', quantity: 9, perBand: 2 },
    { itemKey: 'showcase_side_94_6_30', quantity: 2 },
    { itemKey: 'showcase_horizontal_87_4_30', quantity: 2 },
    { itemKey: 'glass_shelf', quantity: 1 },
  ]);
});

test('3-eye wall showcase BASE recipe matches verified production data', () => {
  const recipe = getModuleRecipe('showcase-3', 100);
  assert.deepEqual(recipe.items, [
    { itemKey: 'profile_91', quantity: 4 },
    { itemKey: 'upright_346_5', quantity: 2, heightMatched: true },
    { itemKey: 'panel_98', quantity: 4, perBand: 1 },
    { itemKey: 'connector_start', quantity: 4 },
    { itemKey: 'connector_single', quantity: 7, perBand: 2 },
    { itemKey: 'showcase_side_143_5_30', quantity: 2 },
    { itemKey: 'showcase_horizontal_87_4_30', quantity: 2 },
    { itemKey: 'glass_shelf', quantity: 2 },
  ]);
});

test('wall showcase expand stays on composition.items', () => {
  for (const [type, panelQuantity, baseSingleQuantity] of [
    ['showcase-2', 5, 9],
    ['showcase-3', 4, 7],
  ]) {
    const normal = getExpandedModuleRecipe(type, 100);
    const normalByKey = new Map(normal.items.map((entry) => [entry.itemKey, entry.quantity]));
    assert.equal(normalByKey.get('panel_98'), panelQuantity, type);
    assert.equal(normalByKey.get('connector_single'), baseSingleQuantity, type);
    assert.equal(normalByKey.has('connector_corner'), false, type);
    assert.equal(normalByKey.has('panel_corner_92'), false, type);
  }
});

test('expanded showcase recipes resolve only real physical child Items', () => {
  for (const [type, expectedSide, glassQuantity] of [
    ['showcase-2', 'showcase_side_94_6_30', 1],
    ['showcase-3', 'showcase_side_143_5_30', 2],
  ]) {
    const expanded = getExpandedModuleRecipe(type, 100);
    const keys = new Set(expanded.items.map((entry) => entry.itemKey));
    assert.ok(keys.has(expectedSide));
    assert.ok(keys.has('showcase_horizontal_87_4_30'));
    assert.ok(keys.has('glass_shelf'));
    assert.equal(expanded.items.find((entry) => entry.itemKey === 'glass_shelf').quantity, glassQuantity);
    assert.equal(keys.has('showcase_2_100'), false);
    assert.equal(keys.has('showcase_3_100'), false);
  }
});
