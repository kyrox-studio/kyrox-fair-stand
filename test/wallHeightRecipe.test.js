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
  // Kural kapı ve vitrinde (0069) ve 100'lük ayırıcıda (0070) var; 50'lik ayırıcı türetilmez.
  assert.equal(getItem('wall_door_100_250').wallHeightBaseItemKey, 'wall_door_100_350');
  assert.equal(getItem('wall_showcase_100_2_250').wallHeightBaseItemKey, 'wall_showcase_100_2_350');
  assert.equal(getItem('wall_separator_100_250').wallHeightBaseItemKey, 'wall_separator_100_350');
  assert.equal(getItem('wall_separator_100_250_sarmasik').wallHeightBaseItemKey, 'wall_separator_100_350_sarmasik');
  assert.equal(getItem('wall_separator_50_250').wallHeightBaseItemKey, 'wall_separator_50_350');
  assert.equal(getItem('wall_separator_50_250_sarmasik').wallHeightBaseItemKey, 'wall_separator_50_350_sarmasik');
});

// Ürün tablosu (250 cm): kapı 1 panel / 1 tekli, 2 gözlü 3 panel / 5 tekli, 3 gözlü 2 panel / 3 tekli.
test('250 cm door and showcases match the product table, fixed parts stay', () => {
  assert.deepEqual(bomByKey('wall_door_100_250'), {
    profile_91: 1, upright_247_5: 2, panel_98: 1, connector_start: 2, connector_single: 1, door_leaf_100: 1,
  });
  assert.deepEqual(bomByKey('wall_showcase_100_3_250'), {
    profile_91: 4, upright_247_5: 2, panel_98: 2, connector_start: 4, connector_single: 3,
    showcase_side_143_5_30: 2, showcase_horizontal_87_4_30: 2, glass_shelf: 2,
  });
  assert.deepEqual(bomByKey('wall_showcase_100_2_250'), {
    profile_91: 4, upright_247_5: 2, panel_98: 3, connector_start: 4, connector_single: 5,
    showcase_side_94_6_30: 2, showcase_horizontal_87_4_30: 2, glass_shelf: 1,
  });
  // Not: 300 cm kapı 2 panel, 3 tekli ile başlar.
  assert.equal(bomByKey('wall_door_100_300').panel_98, 2);
  assert.equal(bomByKey('wall_door_100_300').connector_single, 3);
});

test('door and showcases follow the band rule at every height', () => {
  for (const heightCm of WALL_LINE_HEIGHTS_CM) {
    const bands = heightCm / 50;
    const [uprightKey] = UPRIGHTS[heightCm];
    for (const [itemKey, occupied] of [['wall_door_100', 4], ['wall_showcase_100_2', 2], ['wall_showcase_100_3', 3]]) {
      const bom = bomByKey(`${itemKey}_${heightCm}`);
      const panels = bands - occupied;
      assert.equal(bom.panel_98, panels, `${itemKey}_${heightCm}`);
      assert.equal(bom.connector_single, 2 * panels - 1, `${itemKey}_${heightCm}`);
      assert.equal(bom[uprightKey], 2, `${itemKey}_${heightCm}`);
    }
  }
});

test('resolveWallItemKeyForHeight maps any wall height and leaves other Items alone', () => {
  assert.equal(resolveWallItemKeyForHeight('wall_100_350', 250), 'wall_100_250');
  assert.equal(resolveWallItemKeyForHeight('wall_100_250', 500), 'wall_100_500');
  assert.equal(resolveWallItemKeyForHeight('wall_100_450', 350), 'wall_100_350');
  assert.equal(resolveWallItemKeyForHeight('wall_door_100_350', 250), 'wall_door_100_250');
  assert.equal(resolveWallItemKeyForHeight('wall_separator_100_350', 250), 'wall_separator_100_250');
  assert.equal(resolveWallItemKeyForHeight('wall_separator_100_350_sarmasik', 500), 'wall_separator_100_500_sarmasik');
  assert.equal(resolveWallItemKeyForHeight('wall_separator_50_350', 250), 'wall_separator_50_250');
  assert.equal(resolveWallItemKeyForHeight('wall_100_350', 275), 'wall_100_350');
});

test('short walls align to the wall top of the stand height (250: short_2 z 150, short_1 z 200)', async () => {
  const { setActiveWallLineHeightCm, resolveItemDefaultZCm, isWallShortFamilyDescriptor } = await import('../src/items.js');
  const shorts = listRegisteredItems().filter((item) => isWallShortFamilyDescriptor(item));
  assert.ok(shorts.length > 0);
  try {
    for (const item of shorts) {
      const bands = item.variant === 'wall-short-2' ? 2 : 1;
      setActiveWallLineHeightCm(350);
      assert.equal(resolveItemDefaultZCm(item.itemKey), 350 - bands * 50, item.itemKey);
      setActiveWallLineHeightCm(250);
      assert.equal(resolveItemDefaultZCm(item.itemKey), 250 - bands * 50, item.itemKey);
      setActiveWallLineHeightCm(500);
      assert.equal(resolveItemDefaultZCm(item.itemKey), 500 - bands * 50, item.itemKey);
    }
    // Duvar dışı Item etkilenmez.
    setActiveWallLineHeightCm(250);
    assert.equal(resolveItemDefaultZCm('wall_100_350'), 0);
  } finally {
    setActiveWallLineHeightCm(350);
  }
});

test('100 cm separators follow the band rule; sarmaşık part stays one', () => {
  for (const heightCm of WALL_LINE_HEIGHTS_CM) {
    const bands = heightCm / 50;
    const [uprightKey] = UPRIGHTS[heightCm];
    for (const suffix of ['', '_sarmasik']) {
      const itemKey = `wall_separator_100_${heightCm}${suffix}`;
      const bom = bomByKey(itemKey);
      assert.equal(bom.separator_panel_98, bands, itemKey);
      assert.equal(bom.connector_single, 2 * bands - 1, itemKey);
      assert.equal(bom[uprightKey], 2, itemKey);
      assert.equal(bom.profile_91, 2, itemKey);
      assert.equal(bom.connector_start, 2, itemKey);
    }
  }
  // 250: 5 panel, 9 tekli (kullanıcı onayı).
  assert.equal(bomByKey('wall_separator_100_250').separator_panel_98, 5);
  assert.equal(bomByKey('wall_separator_100_250').connector_single, 9);
});

test('top rail (projector) sits on the wall top at every height', async () => {
  const { createModuleStateFromDescriptor } = await import('../src/designState.js');
  const { createModulePlacement } = await import('../src/modulePlacement.js');
  const { resolveVirtualTopRailZCm } = await import('../src/itemSnap.js');
  for (const heightCm of WALL_LINE_HEIGHTS_CM) {
    const wall = createModuleStateFromDescriptor({ type: 'flat-panel', widthCm: 100, itemKey: `wall_100_${heightCm}` });
    wall.placement = createModulePlacement({ xCm: 0, yCm: 0 });
    assert.equal(resolveVirtualTopRailZCm(wall, getItem('profile_91')), heightCm, `wall_100_${heightCm}`);
  }
});

// Ürün tablosu (250): 50’lik ayırıcı 2 × upright_247_5, 2 × profile_41_5, 5 × separator_panel_48_5, 2 başlangıç, 9 tekli.
test('50 cm separators match the product table and follow the band rule', () => {
  for (const suffix of ['', '_sarmasik']) {
    const bom250 = bomByKey(`wall_separator_50_250${suffix}`);
    assert.equal(bom250.upright_247_5, 2);
    assert.equal(bom250.profile_41_5, 2);
    assert.equal(bom250.separator_panel_48_5, 5);
    assert.equal(bom250.connector_start, 2);
    assert.equal(bom250.connector_single, 9);
    assert.equal(bom250.separator_panel_98, undefined);
    for (const heightCm of WALL_LINE_HEIGHTS_CM) {
      const bands = heightCm / 50;
      const bom = bomByKey(`wall_separator_50_${heightCm}${suffix}`);
      assert.equal(bom.separator_panel_48_5, bands);
      assert.equal(bom.connector_single, 2 * bands - 1);
      assert.equal(bom[UPRIGHTS[heightCm][0]], 2);
    }
  }
});
