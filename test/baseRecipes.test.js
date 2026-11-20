import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import {
  getExpandedModuleRecipe,
  getModuleRecipe,
} from './recipeParentItemKey.js';

// DB reçete satırlarının sıra sütunu yoktur (kayıt sırası): reçeteler sıradan bağımsız karşılaştırılır (2026-11-20).
const byKey = (items) => [...items].sort((a, b) => String(a.itemKey ?? a[0]).localeCompare(String(b.itemKey ?? b[0])));
const partOf = (expanded, itemKey) => expanded.items.find((entry) => entry.itemKey === itemKey).part;

function baseTopDims(widthCm) {
  return { widthCm, depthCm: 50, heightCm: 1.8 };
}

test('production catalog contains verified baza upright and tops', () => {
  assert.equal(getItem('upright_49_5').dimensions.heightCm, 49.5);
  assert.deepEqual(getItem('base_top_107_50').dimensions, baseTopDims(107));
  assert.deepEqual(getItem('base_top_157_50').dimensions, baseTopDims(157));
  assert.deepEqual(getItem('base_top_206_50').dimensions, baseTopDims(206));
});

const expectedRecipes = {
  100: {
    profileItemKey: 'profile_91',
    panelItemKey: 'panel_98',
    topItemKey: 'base_top_107_50',
  },
  150: {
    profileItemKey: 'profile_140_5',
    panelItemKey: 'panel_147_5',
    topItemKey: 'base_top_157_50',
  },
  200: {
    profileItemKey: 'profile_190',
    panelItemKey: 'panel_197',
    topItemKey: 'base_top_206_50',
  },
};

for (const [width, expected] of Object.entries(expectedRecipes)) {
  test(`baza ${width} recipe matches verified production data`, () => {
    const recipe = getModuleRecipe('base', Number(width));
    const quantities = Object.fromEntries(recipe.items.map((item) => [item.itemKey ?? item.partId, item.quantity]));

    assert.equal(quantities[expected.profileItemKey], 4);
    assert.equal(quantities.profile_41_5, 4);
    assert.equal(quantities.upright_49_5, 4);
    assert.equal(quantities[expected.panelItemKey], 2);
    assert.equal(quantities.panel_48_5, 2);
    assert.equal(quantities.connector_start, 8);
    assert.equal(quantities.connector_single, 8);
    assert.equal(quantities[expected.topItemKey], 1);
  });
}

test('expanded baza recipe resolves top and upright production parts', () => {
  const expanded = getExpandedModuleRecipe('base', 150);
  assert.equal(expanded.items.find((item) => item.itemKey === 'upright_49_5').part.name, 'Dikme 49,5');
  assert.equal(partOf(expanded, 'base_top_157_50').name, 'Baza Üstü 157 × 50 cm');
});
