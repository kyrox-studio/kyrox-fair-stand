import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getCatalogItem,
} from '../src/catalog.js';
import { createEamesChairModuleState, createEamesTableChairSetModuleState } from '../src/designState.js';
import { getItem } from '../src/items.js';

test('chair_eames katalog ve state kimliği sabittir', () => {
  const catalog = getCatalogItem('chair_eames');
  const item = getItem('chair_eames');
  assert.equal(item.itemKey, 'chair_eames');
  assert.equal(item.type, 'chair');
  assert.equal(item.name, 'Eames Sandalye');
  assert.equal(catalog.label, 'Eames Sandalye');
  assert.equal(item.dimensions.widthCm, 46);
  assert.equal(item.dimensions.depthCm, 58);
  assert.equal(item.dimensions.heightCm, 82);
  assert.ok(getCatalogItem('chair_eames') != null);

  const state = createEamesChairModuleState();
  assert.equal(state.itemKey, 'chair_eames');
  assert.equal(state.itemKey, 'chair_eames');
  assert.equal(state.type, 'chair');
  assert.equal(state.widthCm, 46);
  assert.equal(state.depthCm, 58);
  assert.equal(state.heightCm, 82);
  assert.equal(state.chairCount, undefined);
  assert.equal(state.surface.color, '#ffffff');
});

test('chair renderer loads the shared Eames GLB once as type chair', () => {
  const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(source, /function createEamesChairModule/);
  assert.match(source, /moduleState\.type === 'chair'/);
  assert.match(source, /loadItemModel\('chair_eames'\)/);
  assert.match(source, /plastic_wit/);
  assert.equal(getItem('chair_eames').modelFile, 'eames_chair.glb');
});

test('Eames set is a cluster of one glass table and four chairs', () => {
  const set = createEamesTableChairSetModuleState();
  const item = getItem('furniture_table_chair_set_eames');
  assert.equal(set.itemKey, 'furniture_table_chair_set_eames');
  assert.equal(set.type, 'table-chair-set-eames');
  assert.equal(set.chairCount, 4);
  assert.deepEqual(item.composition.items, [
    { itemKey: 'glass_table', quantity: 1 },
    { itemKey: 'chair_eames', quantity: 4 },
  ]);
});
