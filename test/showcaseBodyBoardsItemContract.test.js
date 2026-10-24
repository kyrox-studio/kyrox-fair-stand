import test from 'node:test';
import assert from 'node:assert/strict';

import { getItem } from '../src/items.js';
import { resolveItemBom } from '../src/itemBom.js';
import { getItemSurfaceCapabilities } from '../src/itemCapabilities.js';

const CASES = Object.freeze([
  Object.freeze({ itemKey: 'showcase_side_94_6_30', widthCm: 94.6 }),
  Object.freeze({ itemKey: 'showcase_side_143_5_30', widthCm: 143.5 }),
  Object.freeze({ itemKey: 'showcase_horizontal_87_4_30', widthCm: 87.4 }),
]);

const GROUPED_BODY_SURFACE_CAPABILITIES = Object.freeze({
  color: true,
  image: false,
  glass: false,
  lightbox: false,
  mesh: false,
});

test('showcase body boards own canonical dimensions, sunta material, and white default', () => {
  for (const expected of CASES) {
    const item = getItem(expected.itemKey);
    assert.ok(item, expected.itemKey);
    assert.equal(item.itemKey, expected.itemKey);
    assert.equal(item.type, 'showcase-board');
    assert.equal(item.unit, 'adet');
    assert.deepEqual(item.dimensions, {
      widthCm: expected.widthCm,
      depthCm: 30,
      heightCm: 1.8,
    });
    assert.equal(item.material, 'sunta');
    assert.equal(item.defaultColor, 0xffffff);
    assert.ok(Object.isFrozen(item));
    assert.ok(Object.isFrozen(item.dimensions));
  }
});

test('showcase body boards resolve directly as leaf BOM Items', () => {
  for (const expected of CASES) {
    const lines = resolveItemBom(expected.itemKey, 2);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].itemKey, expected.itemKey);
    assert.equal(lines[0].quantity, 2);
    assert.equal(lines[0].unit, 'adet');
    assert.equal(lines[0].item, getItem(expected.itemKey));
  }
});

test('showcase body boards support grouped body color without image or cover capabilities', () => {
  for (const expected of CASES) {
    assert.deepEqual(
      getItemSurfaceCapabilities(expected.itemKey),
      GROUPED_BODY_SURFACE_CAPABILITIES,
      expected.itemKey,
    );
  }
});
