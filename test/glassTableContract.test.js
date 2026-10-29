import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getCatalogItem,
} from '../src/catalog.js';
import { createGlassTableModuleState } from '../src/designState.js';
import { getItem } from '../src/items.js';

test('glass_table katalog ve state kimliği sabittir', () => {
  const catalog = getCatalogItem('glass_table');
  const item = getItem('glass_table');
  assert.equal(item.itemKey, 'glass_table');
  assert.equal(item.type, 'table-glass');
  assert.equal(item.name, 'Cam Masa');
  assert.equal(item.dimensions.widthCm, 75);
  assert.equal(item.dimensions.depthCm, 75);
  assert.equal(catalog.type, undefined);
  assert.equal(catalog.label, 'Cam Masa');
  assert.equal(item.dimensions.widthCm, 75);
  assert.equal(item.dimensions.depthCm, 75);
  assert.equal(item.dimensions.heightCm, 74);
  assert.ok(getCatalogItem('glass_table') != null);

  const state = createGlassTableModuleState();
  assert.equal(state.itemKey, 'glass_table');
  assert.equal(state.itemKey, 'glass_table');
  assert.equal(state.type, 'table-glass');
  assert.equal(state.widthCm, 75);
  assert.equal(state.depthCm, 75);
  assert.equal(state.heightCm, 74);
  assert.equal(state.surface, undefined);
});

test('glass_table renderer uses the canonical Item diameter', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(source, /function createGlassTableModule/);
  assert.match(source, /moduleState\.type === 'table-glass'/);
  assert.match(source, /function addProceduralGlassTable/);
  assert.match(source, /tableItem\.dimensions\.widthCm/);
});
