import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getCatalogItem,
} from '../src/catalog.js';
import { createCounterModuleState } from '../src/designState.js';
import {
  getModuleRecipe,
} from './recipeParentItemKey.js';
import { getItem } from '../src/items.js';

test('desk_banko_150_l is a 150 x 150 catalog module', () => {
  // Köşe banko kartı tek (desk_banko_100_l, 0083); 150×150 ölçü penceresinden gelir.
  assert.equal(getCatalogItem('desk_banko_150_l'), null);
  assert.equal(getItem('desk_banko_150_l').name, 'Köşe Banko 150×150');
});

test('150 L counter state keeps 150 cm physical depth and eight editable faces', () => {
  const state = createCounterModuleState(150, { shape: 'L', depthCm: 150 });
  assert.equal(state.widthCm, 150);
  assert.equal(state.depthCm, 150);
  assert.equal(state.shape, 'L');
  assert.equal(Object.keys(state.faces).length, 8);
});

test('150 L counter renderer is 150 x 150 with a 50 cm arm and 100 cm return extension', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(source, /const widthCm = Number\(moduleState\.widthCm\) \|\| 100;/);
  assert.match(source, /const depthCm = Number\(moduleState\.depthCm\) \|\| widthCm;/);
  assert.match(source, /const armM = 0\.50;/);
  assert.match(source, /const returnExtensionM = Math\.max\(depthM - armM, 0\.02\);/);
  assert.match(source, /widthM \+ topOverhangM \* 2/);
});

test('150 L counter BOM remains separate from renderer geometry', () => {
  const recipe = getModuleRecipe('counter', 150, { shape: 'L' });
  assert.equal(recipe.recipeId, 'desk_banko_150_l');
  assert.deepEqual(recipe.items.map((item) => [item.itemKey ?? item.partId, item.quantity]), [
    ['profile_140_5', 5], ['profile_91', 1], ['profile_41_5', 4], ['upright_99', 5],
    ['panel_147_5', 4], ['panel_48_5', 4], ['connector_start', 8], ['connector_single', 16],
    ['counter_top_160_60', 1], ['counter_top_102_60', 1],
  ]);
  assert.equal(getItem('counter_top_102_60').dimensions.widthCm, 102);
});
