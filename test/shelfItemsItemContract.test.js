import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getItem, listRegisteredItems } from '../src/items.js';
import {
  getModuleRecipe,
} from './recipeParentItemKey.js';

const SHELF_CASES = Object.freeze({
  shelf_100: Object.freeze({ widthCm: 100 }),
  shelf_150: Object.freeze({ widthCm: 150 }),
  shelf_200: Object.freeze({ widthCm: 200 }),
});

const EXPECTED_COLOR = 0xffffff;

test('shelf production Items use canonical identity and verified sunta dimensions/default color', () => {
  for (const [itemKey, { widthCm }] of Object.entries(SHELF_CASES)) {
    const item = getItem(itemKey);
    assert.equal(item.itemKey, itemKey);
    assert.equal(item.partId, undefined);
    assert.equal(item.name, `Raf ${widthCm} cm`);
    assert.equal(item.type, 'shelf');
    assert.equal(item.unit, 'adet');
    assert.deepEqual(
      item.dimensions,
      { widthCm, depthCm: 38, heightCm: 1.8 },
    );
    assert.deepEqual(item.sceneDimensions, { widthCm, heightCm: 1.8 });
    assert.equal(item.material, 'sunta');
    assert.equal(item.defaultColor, EXPECTED_COLOR);
  }

  assert.equal(
    listRegisteredItems().find((item) => item.type === 'shelf' && item.itemKey === 'shelf_50'),
    undefined,
  );
});

test('silinen wall_shelf parent recipes leaf shelf_* Item’lara artık bağlanmaz', () => {
  for (const { widthCm } of Object.values(SHELF_CASES)) {
    assert.equal(getModuleRecipe('shelf', widthCm, { shelfCount: 2 }), null);
    assert.equal(getModuleRecipe('shelf', widthCm, { shelfCount: 3 }), null);
    assert.equal(getModuleRecipe('shelf', widthCm), null);
  }
});

test('shelf renderer consumes canonical Item depth, thickness and default color while retaining explicit fit override', () => {
  const catalogSource = readFileSync(new URL('../src/catalog.js', import.meta.url), 'utf8');
  const itemsSource = readFileSync(new URL('../src/items.js', import.meta.url), 'utf8');
  const rendererSource = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  const shelfRenderer = rendererSource.slice(
    rendererSource.indexOf('function createShelfModule'),
    rendererSource.indexOf('function createFlatPanelModule'),
  );

  assert.doesNotMatch(catalogSource, /projectionCm:\s*38/);
  assert.doesNotMatch(catalogSource, /thicknessCm:\s*3/);
  assert.match(shelfRenderer, /const item = getItem\(moduleState\.itemKey\);/);
  assert.doesNotMatch(itemsSource, /export function getShelfLeafItem/);
  assert.doesNotMatch(shelfRenderer, /getShelfLeafItem/);
  assert.match(shelfRenderer, /resolveSceneDimensions\(rowItem\)/);
  assert.match(shelfRenderer, /resolveSceneDimensions\(item\)/);
  assert.match(shelfRenderer, /color: item\.defaultColor/);
  assert.match(shelfRenderer, /new THREE\.BoxGeometry\(widthM, thicknessM, depthM\)/);
  assert.doesNotMatch(shelfRenderer, /color:\s*0xb8bcc1/);
  assert.doesNotMatch(shelfRenderer, /const frontProfile = new THREE\.Mesh/);
  assert.doesNotMatch(shelfRenderer, /new THREE\.BoxGeometry\(innerWidthM, 0\.025, 0\.025\)/);
  assert.doesNotMatch(shelfRenderer, /createFlatPanelModule/);
});
