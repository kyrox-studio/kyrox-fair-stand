import assert from 'node:assert/strict';
import test from 'node:test';

import { listRegisteredItems } from '../src/items.js';

const COVER_TYPES = new Set(['panel', 'flat-panel', 'door', 'showcase-2', 'showcase-3']);
const COLOR_IMAGE_TYPES = new Set(['base', 'counter', 'door-leaf']);
const COLOR_TYPES = new Set([
  'separator',
  'separator-panel',
  'base-top',
  'counter-top',
  'shelf',
  'sofa-set-classic',
  'sofa-single-classic',
  'sofa-double-classic',
  'chair',
  'bar-stool',
  'led-floodlight',
]);

function expectedFlags(item) {
  // profile_8: yalnız uzun parça bölünüşünün parçası (0079), sahnede çizilmez.
  if (item.type === 'floor' || item.type === 'panel-glass' || item.itemKey === 'shelf_leg' || item.itemKey === 'profile_8'
    || ['shelf_100_self', 'shelf_150_self', 'shelf_200_self'].includes(item.itemKey)) {
    return { isRender: false, color: false, image: false, lightbox: false, glass: false, mesh: false };
  }
  if (COVER_TYPES.has(item.type)) {
    return { isRender: true, color: true, image: true, lightbox: true, glass: true, mesh: true };
  }
  if (COLOR_IMAGE_TYPES.has(item.type)) {
    return { isRender: true, color: true, image: true, lightbox: false, glass: false, mesh: false };
  }
  if (item.type === 'tulle-fabric') {
    return { isRender: true, color: true, image: false, lightbox: false, glass: false, mesh: false };
  }
  if (item.type === 'floor-showcase') {
    // Ayaklı vitrin gövdesinin ön/sol/sağ yüzü: renk, görsel, Lightbox.
    return { isRender: true, color: true, image: true, lightbox: true, glass: false, mesh: false };
  }
  if (item.type === 'box-block') {
    return { isRender: true, color: true, image: true, lightbox: true, glass: false, mesh: true };
  }
  if (COLOR_TYPES.has(item.type) || item.itemKey === 'furniture_table_chair_set_eames') {
    return { isRender: true, color: true, image: false, lightbox: false, glass: false, mesh: false };
  }
  if (item.type === 'indoor-plant-1' && item.itemKey.startsWith('extra_long_planter_')) {
    return { isRender: true, color: true, image: false, lightbox: false, glass: false, mesh: false };
  }
  return { isRender: true, color: false, image: false, lightbox: false, glass: false, mesh: false };
}

test('every catalog item surface flag matches the scene audit', () => {
  const items = listRegisteredItems();
  assert.equal(items.length, 133);
  for (const item of items) {
    const expected = expectedFlags(item);
    assert.deepEqual({
      isRender: item.isRender === true,
      color: item.acceptsColor === true,
      image: item.acceptsImage === true,
      lightbox: item.acceptsLightbox === true,
      glass: item.acceptsGlass === true,
      mesh: item.acceptsMesh === true,
    }, expected, item.itemKey);
  }
});
