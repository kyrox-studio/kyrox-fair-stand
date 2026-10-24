import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createModuleStateFromCatalogKey,
  createModuleStateFromDescriptor,
  createBaseModuleState,
  createCounterModuleState,
} from '../src/designState.js';
import { getItem, itemHasSceneRender, listRegisteredItems } from '../src/items.js';

const DESIGN_STATE_SOURCE = readFileSync(new URL('../src/designState.js', import.meta.url), 'utf8');

test('factory gates on item.isRender, not catalogVisible or type lists', () => {
  assert.match(DESIGN_STATE_SOURCE, /itemHasSceneRender/);
  assert.doesNotMatch(DESIGN_STATE_SOURCE, /catalogVisible/);
  assert.doesNotMatch(DESIGN_STATE_SOURCE, /PLACEABLE_ITEM_TYPES/);

  const virtual = [];
  const catalogHiddenButRenderable = [];
  for (const item of listRegisteredItems()) {
    const fromItem = createModuleStateFromDescriptor(item);
    const fromKey = createModuleStateFromCatalogKey(item.itemKey);
    if (item.isRender !== true) {
      virtual.push(item.itemKey);
      assert.equal(itemHasSceneRender(item), false, item.itemKey);
      assert.equal(fromItem, null, item.itemKey);
      assert.equal(fromKey, null, item.itemKey);
      continue;
    }
    assert.equal(itemHasSceneRender(item.itemKey), true, item.itemKey);
    if (item.catalogVisible !== true) catalogHiddenButRenderable.push(item.itemKey);
  }

  assert.equal(getItem('connector_start').isRender, true);
  assert.equal(getItem('connector_start').catalogVisible, false);
  assert.equal(createModuleStateFromDescriptor(getItem('connector_start')), null);
  assert.equal(createModuleStateFromCatalogKey('connector_start'), null);
  assert.equal(getItem('panel_197').isRender, true);
  assert.equal(getItem('panel_197').catalogVisible, false);
  assert.equal(createModuleStateFromDescriptor(getItem('panel_197')), null);
  assert.equal(createModuleStateFromCatalogKey('connector_start'), null);

  assert.ok(catalogHiddenButRenderable.includes('upright_99'));
  // Işıklı Strafor 0084 ile katalog kartıdır; fabrika yine isRender ile çalışır.
  assert.equal(catalogHiddenButRenderable.includes('illuminated-foam'), false);
  const upright = createModuleStateFromCatalogKey('upright_99');
  assert.ok(upright);
  assert.equal(upright.itemKey, 'upright_99');
  const foam = createModuleStateFromCatalogKey('illuminated-foam');
  assert.ok(foam);
  assert.equal(foam.itemKey, 'illuminated-foam');

  const wall = createModuleStateFromCatalogKey('wall_200_350');
  assert.ok(wall);
  assert.equal(wall.itemKey, 'wall_200_350');
});

test('recipe surfaces take embedded isRender part identity; catalog is not the draw gate', () => {
  const wall = createModuleStateFromCatalogKey('wall_200_350');
  assert.ok(wall.strips.length > 0);
  assert.ok(wall.strips.every((strip) => getItem(strip.itemKey)?.isRender === true));
  assert.ok(wall.strips.every((strip) => getItem(strip.itemKey)?.catalogVisible !== true));

  const base = createBaseModuleState(100);
  assert.equal(base.faces.front.itemKey, 'panel_98');
  assert.equal(getItem(base.faces.left.itemKey).type, 'panel');
  assert.equal(wall.strips[0].widthCm, getItem(wall.strips[0].itemKey).dimensions.widthCm);
  assert.equal(wall.strips[0].heightCm, getItem(wall.strips[0].itemKey).dimensions.heightCm);
  // Stamp keeps BOM child identity/size on state; procedural base mesh uses module aperture instead.
  assert.equal(base.renderParts.tops[0].widthCm, getItem('base_top_107_50').dimensions.widthCm);
  assert.equal(base.renderParts.tops[0].heightCm, getItem('base_top_107_50').dimensions.heightCm);
  assert.equal(getItem('base_top_107_50').isRender, true);
  assert.equal(getItem('base_top_107_50').catalogVisible, false);

  const banko = createCounterModuleState(100);
  assert.equal(getItem(banko.faces.frontLower.itemKey).isRender, true);
  assert.equal(banko.renderParts.tops[0].itemKey, 'counter_top_110_60');
  assert.equal(getItem('connector_start').isRender, true);
  assert.equal(getItem('connector_start').catalogVisible, false);
  assert.equal(getItem('glass_shelf').isRender, true);
  assert.equal(getItem('video_wall_panel').isRender, true);
});
