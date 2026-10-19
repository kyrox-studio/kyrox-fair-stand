import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import {
  getExpandedModuleRecipe,
  getModuleRecipe,
} from './recipeParentItemKey.js';

test('production catalog contains separator panel parts', () => {
  assert.equal(getItem('separator_panel_48_5').name, 'Separatör Paneli 48,5 × 47 cm');
  assert.equal(getItem('separator_panel_98').name, 'Separatör Paneli 98 × 47 cm');
});

test('separator 50 recipe matches verified production data', () => {
  const recipe = getModuleRecipe('separator', 50);
  assert.deepEqual(recipe.items, [
    { itemKey: 'profile_41_5', quantity: 2 },
    { itemKey: 'upright_346_5', quantity: 2, heightMatched: true },
    { itemKey: 'separator_panel_48_5', quantity: 7, perBand: 1 },
    { itemKey: 'connector_start', quantity: 2 },
    { itemKey: 'connector_single', quantity: 13, perBand: 2 }, // 50’lik ayırıcı ürün kararı (2026-10-19, 0071): bant başına 1 panel, 2B − 1 tekli → 350’de 13.,
  ]);
});

test('separator 100 recipe matches verified production data', () => {
  const recipe = getModuleRecipe('separator', 100);
  assert.deepEqual(recipe.items, [
    { itemKey: 'profile_91', quantity: 2 },
    { itemKey: 'upright_346_5', quantity: 2, heightMatched: true },
    { itemKey: 'separator_panel_98', quantity: 7, perBand: 1 },
    { itemKey: 'connector_start', quantity: 2 },
    { itemKey: 'connector_single', quantity: 13, perBand: 2 },
  ]);
});

test('expanded separator recipe resolves separator panel metadata', () => {
  const expanded = getExpandedModuleRecipe('separator', 50);
  assert.equal(expanded.items[2].part.dimensions.widthCm, 48.5);
  assert.equal(expanded.items.some((item) => item.itemKey === 'separator_panel_98'), false);
});
