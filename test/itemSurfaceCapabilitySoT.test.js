import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getItem, listRegisteredItems } from '../src/items.js';
import {
  getItemSurfaceCapabilities,
  itemSurfaceAcceptsImage,
} from '../src/itemCapabilities.js';

test('itemCapabilities reads Item accepts* columns, not type maps', () => {
  const source = readFileSync(new URL('../src/itemCapabilities.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ITEM_SURFACE_CAPABILITIES_BY_TYPE/);
  assert.match(source, /item\.acceptsColor === true/);
  assert.match(source, /item\.acceptsGlass === true/);

  for (const item of listRegisteredItems()) {
    const capabilities = getItemSurfaceCapabilities(item);
    assert.equal(capabilities.color, item.acceptsColor === true, item.itemKey);
    assert.equal(capabilities.image, item.acceptsImage === true, item.itemKey);
    assert.equal(capabilities.glass, item.acceptsGlass === true, item.itemKey);
    assert.equal(capabilities.lightbox, item.acceptsLightbox === true, item.itemKey);
    assert.equal(capabilities.mesh, item.acceptsMesh === true, item.itemKey);
    assert.equal(itemSurfaceAcceptsImage(item), item.acceptsImage === true, item.itemKey);
  }

  const panel = getItem('panel_197');
  assert.equal(panel.acceptsColor, true);
  assert.equal(panel.acceptsImage, true);
  assert.equal(panel.acceptsGlass, true);
  assert.equal(panel.acceptsLightbox, true);
  assert.equal(panel.acceptsMesh, true);
  assert.equal(itemSurfaceAcceptsImage(getItem('wall_100_350')), true);
  assert.equal(getItemSurfaceCapabilities(getItem('desk_banko_100')).glass, false);
  assert.equal(getItemSurfaceCapabilities(getItem('connector_start')).color, false);
  assert.equal(getItem('connector_start').isRender, false); // DB: aparat sahnede çizilmez
  assert.equal(getItemSurfaceCapabilities(getItem('door_leaf_100')).image, true);
  assert.equal(getItemSurfaceCapabilities(getItem('door_leaf_100')).glass, false);
});

test('scene3d binds mesh accepts* from item capabilities', () => {
  const scene = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(scene, /surfaceCapabilityUserData\(surfaceState\?\.itemKey \?\? moduleState\.itemKey\)/);
  assert.match(scene, /surfaceCapabilityUserData\(doorLeafItem\)/);
  assert.match(scene, /acceptsGlass === true/);
  assert.doesNotMatch(scene, /const supportsGlass = surface\?\.userData\.selectionMode === 'panel'/);
});
