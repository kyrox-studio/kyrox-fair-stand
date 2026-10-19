import test from 'node:test';
import assert from 'node:assert/strict';
import './registerCanonicalItemCatalog.mjs';
import { WALL_LINE_HEIGHTS_CM, getItem, listRegisteredItems, resolveWallItemKeyForHeight } from '../src/items.js';
import { resolveItemBom } from '../src/itemBom.js';

const PANELS = { 50: 'panel_48_5', 100: 'panel_98', 150: 'panel_147_5', 200: 'panel_197' };
const PROFILES = { 50: 'profile_41_5', 100: 'profile_91', 150: 'profile_140_5', 200: 'profile_190' };
// Ürün tablosu: duvar yüksekliği → dikmenin gerçek boyu.
const UPRIGHTS = {
  250: ['upright_247_5', 247.5],
  300: ['upright_297', 297],
  350: ['upright_346_5', 346.5],
  400: ['upright_396', 396],
  450: ['upright_445_5', 445.5],
  500: ['upright_495', 495],
};

function bomByKey(itemKey) {
  return Object.fromEntries(resolveItemBom(itemKey).map((line) => [line.itemKey, line.quantity]));
}

test('350 cm wall recipes are unchanged by the height rule', () => {
  for (const width of [50, 100, 150, 200]) {
    assert.deepEqual(bomByKey(`wall_${width}_350`), {
      [PROFILES[width]]: 2,
      upright_346_5: 2,
      [PANELS[width]]: 7,
      connector_start: 2,
      connector_single: 13,
    });
  }
});

test('250 cm walls match the product table', () => {
  for (const width of [50, 100, 150, 200]) {
    assert.deepEqual(bomByKey(`wall_${width}_250`), {
      [PROFILES[width]]: 2,
      upright_247_5: 2,
      [PANELS[width]]: 5,
      connector_start: 2,
      connector_single: 9,
    });
  }
});

test('every wall height follows bands = height / 50, singles = 2 × bands − 1', () => {
  for (const heightCm of WALL_LINE_HEIGHTS_CM) {
    const bands = heightCm / 50;
    const [uprightKey, realCm] = UPRIGHTS[heightCm];
    assert.equal(getItem(uprightKey).dimensions.heightCm, realCm, uprightKey);
    for (const width of [50, 100, 150, 200]) {
      const itemKey = `wall_${width}_${heightCm}`;
      const item = getItem(itemKey);
      assert.ok(item, itemKey);
      assert.equal(item.sceneDimensions.heightCm, heightCm, itemKey);
      assert.deepEqual(bomByKey(itemKey), {
        [PROFILES[width]]: 2,
        [uprightKey]: 2,
        [PANELS[width]]: bands,
        connector_start: 2,
        connector_single: 2 * bands - 1,
      }, itemKey);
    }
  }
});

test('derived heights stay out of the Item list and the catalog', () => {
  const listed = new Set(listRegisteredItems().map((item) => item.itemKey));
  for (const heightCm of WALL_LINE_HEIGHTS_CM.filter((height) => height !== 350)) {
    const itemKey = `wall_100_${heightCm}`;
    assert.equal(listed.has(itemKey), false, itemKey);
    assert.equal(getItem(itemKey).catalogVisible, false, itemKey);
    assert.equal(getItem(itemKey).wallHeightBaseItemKey, 'wall_100_350', itemKey);
  }
  // Kural yalnız düz duvarda: kapı ve vitrin türetilmez.
  assert.equal(getItem('wall_door_100_250'), null);
  assert.equal(getItem('wall_showcase_100_2_250'), null);
});

test('resolveWallItemKeyForHeight maps any wall height and leaves other Items alone', () => {
  assert.equal(resolveWallItemKeyForHeight('wall_100_350', 250), 'wall_100_250');
  assert.equal(resolveWallItemKeyForHeight('wall_100_250', 500), 'wall_100_500');
  assert.equal(resolveWallItemKeyForHeight('wall_100_450', 350), 'wall_100_350');
  assert.equal(resolveWallItemKeyForHeight('wall_door_100_350', 250), 'wall_door_100_350');
  assert.equal(resolveWallItemKeyForHeight('wall_100_350', 275), 'wall_100_350');
});
